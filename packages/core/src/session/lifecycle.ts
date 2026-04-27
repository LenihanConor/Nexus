import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import type { SessionRecord, SessionStatus, SessionSnapshot } from "@nexus/shared";
import { emitEvent } from "../audit/emitter.js";
import { appendSessionRecord, getSession } from "./store.js";

function createSnapshot(data: Omit<SessionSnapshot, "timestamp">): SessionSnapshot {
  return { ...data, timestamp: new Date().toISOString() };
}

export async function createSession(opts: {
  project: string;
  agent_type: string;
  agent_pid?: number;
  task_description: string;
  parent_id?: string;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<SessionRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();

  let correlationId = opts.correlation_id;
  if (!correlationId && opts.parent_id) {
    const parent = await getSession(opts.parent_id);
    if (parent) {
      correlationId = parent.correlation_id;
    }
  }
  if (!correlationId) {
    correlationId = id;
  }

  const record: SessionRecord = {
    id,
    parent_id: opts.parent_id ?? null,
    project: opts.project,
    correlation_id: correlationId,
    agent_type: opts.agent_type,
    agent_pid: opts.agent_pid ?? null,
    user_id: userInfo().username,
    task_description: opts.task_description,
    status: "running",
    created_at: now,
    updated_at: now,
    ended_at: null,
    exit_code: null,
    duration_ms: null,
    snapshots: [
      createSnapshot({
        label: "session_started",
        task_progress: null,
        decisions: [],
        files_changed: [],
        notes: null,
      }),
    ],
    metadata: opts.metadata ?? {},
  };

  await appendSessionRecord(record);

  await emitEvent("session.started", id, {
    parent_id: record.parent_id,
    agent_type: record.agent_type,
    task_description: record.task_description,
  }, {
    project: record.project,
    correlationId: record.correlation_id,
  });

  return record;
}

export async function updateSession(
  sessionId: string,
  update: {
    status?: SessionStatus;
    snapshot?: Omit<SessionSnapshot, "timestamp">;
    metadata?: Record<string, unknown>;
  },
): Promise<SessionRecord> {
  const current = await getSession(sessionId);
  if (!current) throw new Error(`Session ${sessionId} not found`);

  const snapshots = [...current.snapshots];
  if (update.snapshot) {
    snapshots.push(createSnapshot(update.snapshot));
  }

  const record: SessionRecord = {
    ...current,
    status: update.status ?? current.status,
    updated_at: new Date().toISOString(),
    snapshots,
    metadata: update.metadata
      ? { ...current.metadata, ...update.metadata }
      : current.metadata,
  };

  await appendSessionRecord(record);

  await emitEvent("session.updated", sessionId, {
    status: record.status,
    snapshot_label: update.snapshot?.label,
  }, {
    project: record.project,
    correlationId: record.correlation_id,
  });

  return record;
}

const TERMINAL_STATUSES: SessionStatus[] = ["completed", "failed", "interrupted"];

export async function endSession(
  sessionId: string,
  result: {
    status: "completed" | "failed" | "interrupted";
    exit_code?: number;
    snapshot?: Omit<SessionSnapshot, "timestamp">;
    metadata?: Record<string, unknown>;
  },
): Promise<SessionRecord> {
  const current = await getSession(sessionId);
  if (!current) throw new Error(`Session ${sessionId} not found`);

  if (TERMINAL_STATUSES.includes(current.status)) {
    return current;
  }

  const now = new Date();
  const durationMs = now.getTime() - new Date(current.created_at).getTime();

  const snapshots = [...current.snapshots];
  if (result.snapshot) {
    snapshots.push(createSnapshot(result.snapshot));
  }

  const record: SessionRecord = {
    ...current,
    status: result.status,
    updated_at: now.toISOString(),
    ended_at: now.toISOString(),
    exit_code: result.exit_code ?? null,
    duration_ms: durationMs,
    snapshots,
    metadata: result.metadata
      ? { ...current.metadata, ...result.metadata }
      : current.metadata,
  };

  await appendSessionRecord(record);

  await emitEvent("session.ended", sessionId, {
    status: record.status,
    exit_code: record.exit_code,
    duration_ms: record.duration_ms,
  }, {
    project: record.project,
    correlationId: record.correlation_id,
  });

  return record;
}
