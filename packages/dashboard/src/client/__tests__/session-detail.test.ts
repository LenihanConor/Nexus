import { describe, it, expect } from "vitest";
import type { SessionRecord, NexusEvent, WorktreeRecord } from "@nexus/shared";

function makeSession(id: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    project: "C:/GitHub/Test",
    agent_type: "claude-code",
    task_description: `Task ${id}`,
    status: "running",
    parent_id: null,
    correlation_id: id,
    agent_pid: null,
    user_id: "testuser",
    created_at: "2026-04-27T10:00:00Z",
    updated_at: "2026-04-27T10:00:00Z",
    ended_at: null,
    duration_ms: null,
    exit_code: null,
    snapshots: [],
    metadata: {},
    ...overrides,
  };
}

function makeEvent(id: string, overrides: Partial<NexusEvent> = {}): NexusEvent {
  return {
    id,
    timestamp: "2026-04-27T10:00:00Z",
    event_type: "session.started",
    project: "C:/GitHub/Test",
    session_id: "s1",
    correlation_id: "corr-1",
    agent_id: null,
    user_id: "testuser",
    payload: {},
    ...overrides,
  };
}

function makeWorktree(id: string, overrides: Partial<WorktreeRecord> = {}): WorktreeRecord {
  return {
    id,
    session_id: "s1",
    project: "C:/GitHub/Test",
    branch: `feature/${id}`,
    parent_branch: "main",
    path: `/tmp/wt-${id}`,
    scope: [],
    status: "active",
    created_at: "2026-04-27T10:00:00Z",
    merged_at: null,
    cleaned_at: null,
    merge_result: null,
    ...overrides,
  };
}

function getSessionDetail(
  sessions: SessionRecord[],
  worktrees: WorktreeRecord[],
  events: NexusEvent[],
  sessionId: string,
): { session: SessionRecord; worktree: WorktreeRecord | null; events: NexusEvent[] } | null {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const worktree = worktrees.find((w) => w.session_id === sessionId) ?? null;
  const sessionEvents = events
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);
  return { session, worktree, events: sessionEvents };
}

describe("getSessionDetail", () => {
  it("returns null for unknown session", () => {
    expect(getSessionDetail([], [], [], "nonexistent")).toBeNull();
  });

  it("returns session with no worktree or events", () => {
    const sessions = [makeSession("s1")];
    const result = getSessionDetail(sessions, [], [], "s1");
    expect(result).not.toBeNull();
    expect(result!.session.id).toBe("s1");
    expect(result!.worktree).toBeNull();
    expect(result!.events).toEqual([]);
  });

  it("finds associated worktree by session_id", () => {
    const sessions = [makeSession("s1")];
    const worktrees = [
      makeWorktree("w1", { session_id: "s1" }),
      makeWorktree("w2", { session_id: "s2" }),
    ];
    const result = getSessionDetail(sessions, worktrees, [], "s1");
    expect(result!.worktree).not.toBeNull();
    expect(result!.worktree!.id).toBe("w1");
  });

  it("filters events to session_id only", () => {
    const sessions = [makeSession("s1")];
    const events = [
      makeEvent("e1", { session_id: "s1", timestamp: "2026-04-27T10:00:00Z" }),
      makeEvent("e2", { session_id: "s2", timestamp: "2026-04-27T10:01:00Z" }),
      makeEvent("e3", { session_id: "s1", timestamp: "2026-04-27T10:02:00Z" }),
    ];
    const result = getSessionDetail(sessions, [], events, "s1");
    expect(result!.events).toHaveLength(2);
    expect(result!.events[0]!.id).toBe("e3");
    expect(result!.events[1]!.id).toBe("e1");
  });

  it("limits events to 20", () => {
    const sessions = [makeSession("s1")];
    const events = Array.from({ length: 30 }, (_, i) =>
      makeEvent(`e${i}`, {
        session_id: "s1",
        timestamp: `2026-04-27T${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
      }),
    );
    const result = getSessionDetail(sessions, [], events, "s1");
    expect(result!.events).toHaveLength(20);
  });

  it("sorts events newest first", () => {
    const sessions = [makeSession("s1")];
    const events = [
      makeEvent("e1", { session_id: "s1", timestamp: "2026-04-27T10:00:00Z" }),
      makeEvent("e2", { session_id: "s1", timestamp: "2026-04-27T12:00:00Z" }),
      makeEvent("e3", { session_id: "s1", timestamp: "2026-04-27T11:00:00Z" }),
    ];
    const result = getSessionDetail(sessions, [], events, "s1");
    expect(result!.events.map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });
});
