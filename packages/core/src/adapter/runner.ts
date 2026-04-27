import { spawn } from "node:child_process";
import type { AgentAdapter } from "./types.js";
import type { AdapterSession } from "./types.js";

export interface RunnerOpts {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  adapter: AgentAdapter;
  session: AdapterSession;
}

export interface RunnerResult {
  exitCode: number;
  signal: string | null;
  durationMs: number;
}

const GRACE_PERIOD_MS = 5000;

export async function runAgent(opts: RunnerOpts): Promise<RunnerResult> {
  const start = Date.now();

  const childEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    NEXUS_SESSION_ID: opts.session.sessionId,
    NEXUS_PROJECT: opts.session.project,
    ...(opts.session.worktreeId ? { NEXUS_WORKTREE_ID: opts.session.worktreeId } : {}),
    ...(opts.session.branch ? { NEXUS_BRANCH: opts.session.branch } : {}),
    ...opts.env,
  };

  return new Promise<RunnerResult>((resolve) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: childEnv,
      stdio: "inherit",
      shell: true,
    });

    opts.session.agentPid = child.pid;
    let interrupted = false;

    const handleSignal = (signal: NodeJS.Signals) => {
      interrupted = true;
      if (child.pid) {
        child.kill(signal);
        setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* already dead */ }
        }, GRACE_PERIOD_MS);
      }
    };

    process.on("SIGINT", () => handleSignal("SIGINT"));
    process.on("SIGTERM", () => handleSignal("SIGTERM"));

    child.on("close", (code, signal) => {
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");

      resolve({
        exitCode: code ?? 1,
        signal: signal ?? (interrupted ? "SIGINT" : null),
        durationMs: Date.now() - start,
      });
    });
  });
}

export function mapExitToStatus(result: RunnerResult): "completed" | "failed" | "interrupted" {
  if (result.signal || result.exitCode === 130) return "interrupted";
  return result.exitCode === 0 ? "completed" : "failed";
}
