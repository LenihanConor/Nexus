import type { SessionSnapshot } from "@nexus/shared";
import { createSession, updateSession, endSession } from "../session/lifecycle.js";
import { createWorktree, mergeWorktree } from "../worktree/lifecycle.js";
import type {
  AgentAdapter,
  AdapterStartOpts,
  AdapterSession,
  AdapterSnapshot,
  AdapterResult,
} from "./types.js";

function toSessionSnapshot(snap: AdapterSnapshot): Omit<SessionSnapshot, "timestamp"> {
  return {
    label: snap.label,
    task_progress: snap.taskProgress ?? null,
    decisions: snap.decisions ?? [],
    files_changed: snap.filesChanged ?? [],
    notes: snap.notes ?? null,
  };
}

export class BaseAdapter implements AgentAdapter {
  readonly agentType: string;

  constructor(agentType: string) {
    this.agentType = agentType;
  }

  async start(opts: AdapterStartOpts): Promise<AdapterSession> {
    const session = await createSession({
      project: opts.project,
      agent_type: this.agentType,
      task_description: opts.task,
      parent_id: opts.parentSessionId,
      correlation_id: opts.correlationId,
      metadata: opts.metadata,
    });

    let worktreeId: string | null = null;
    let worktreePath: string | null = null;

    if (!opts.noWorktree && opts.branch) {
      try {
        const { record } = await createWorktree({
          session_id: session.id,
          project: opts.project,
          branch: opts.branch,
          scope: opts.scope,
        });
        worktreeId = record.id;
        worktreePath = record.path;
      } catch (err) {
        await endSession(session.id, {
          status: "failed",
          snapshot: {
            label: "worktree_creation_failed",
            task_progress: null,
            decisions: [],
            files_changed: [],
            notes: err instanceof Error ? err.message : String(err),
          },
        });
        throw err;
      }
    }

    return {
      sessionId: session.id,
      worktreeId,
      worktreePath,
      project: opts.project,
      branch: opts.branch ?? null,
      agentType: this.agentType,
      startedAt: session.created_at,
    };
  }

  async checkpoint(session: AdapterSession, snapshot: AdapterSnapshot): Promise<void> {
    await updateSession(session.sessionId, {
      snapshot: toSessionSnapshot(snapshot),
    });
  }

  async end(session: AdapterSession, result: AdapterResult): Promise<void> {
    await endSession(session.sessionId, {
      status: result.status,
      exit_code: result.exitCode,
      snapshot: result.snapshot ? toSessionSnapshot(result.snapshot) : undefined,
      metadata: result.metadata,
    });

    if (session.worktreeId && result.status === "completed" && result.mergeStrategy !== "skip") {
      await mergeWorktree(session.worktreeId, {
        strategy: result.mergeStrategy ?? "merge",
      });
    }
  }
}
