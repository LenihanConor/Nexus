import { describe, it, expect } from "vitest";
import type { NexusEvent } from "../events.js";
import { summarizeEvent } from "../summary.js";

function makeEvent(type: string, payload: Record<string, unknown>): NexusEvent {
  return {
    id: "evt-1",
    timestamp: "2026-04-27T12:00:00Z",
    event_type: type,
    project: "C:/GitHub/Test",
    session_id: "sess-1",
    correlation_id: "corr-1",
    agent_id: null,
    user_id: "testuser",
    payload,
  };
}

describe("summarizeEvent", () => {
  it("summarizes audit.started", () => {
    expect(summarizeEvent(makeEvent("audit.started", { version: "0.1.0" }))).toBe("v0.1.0");
  });

  it("summarizes audit.cleanup", () => {
    expect(
      summarizeEvent(makeEvent("audit.cleanup", { files_deleted: ["a", "b"], files_skipped: [] })),
    ).toBe("2 files deleted");
  });

  it("summarizes session.started", () => {
    expect(
      summarizeEvent(makeEvent("session.started", { parent_id: null, agent_type: "claude", task_description: "Implement auth" })),
    ).toBe("Implement auth");
  });

  it("summarizes session.updated", () => {
    expect(summarizeEvent(makeEvent("session.updated", { status: "paused" }))).toBe("paused");
  });

  it("summarizes session.ended", () => {
    expect(
      summarizeEvent(makeEvent("session.ended", { status: "completed", exit_code: 0, duration_ms: 5000 })),
    ).toBe("completed (5000ms)");
  });

  it("summarizes worktree.created", () => {
    expect(
      summarizeEvent(makeEvent("worktree.created", { worktree_id: "wt-1", branch: "feature/auth", parent_branch: "main", path: "/tmp", scope: [] })),
    ).toBe("feature/auth");
  });

  it("summarizes worktree.conflict_detected", () => {
    expect(
      summarizeEvent(makeEvent("worktree.conflict_detected", { worktree_id: "wt-1", conflicting_session_id: "s2", overlapping_paths: ["src/a", "src/b", "src/c"] })),
    ).toBe("3 paths");
  });

  it("summarizes worktree.merged", () => {
    expect(
      summarizeEvent(makeEvent("worktree.merged", { worktree_id: "wt-1", branch: "feature/auth", merge_result: {} })),
    ).toBe("feature/auth");
  });

  it("summarizes worktree.merge_failed", () => {
    expect(
      summarizeEvent(makeEvent("worktree.merge_failed", { worktree_id: "wt-1", branch: "feature/auth", conflicts: ["a.ts", "b.ts"] })),
    ).toBe("feature/auth: 2 conflicts");
  });

  it("summarizes worktree.stale_detected", () => {
    expect(
      summarizeEvent(makeEvent("worktree.stale_detected", { worktree_id: "wt-1", session_id: "s1", branch: "feature/old" })),
    ).toBe("feature/old");
  });

  it("summarizes worktree.cleaned", () => {
    expect(
      summarizeEvent(makeEvent("worktree.cleaned", { worktree_id: "wt-1", branch: "feature/done", path: "/tmp" })),
    ).toBe("feature/done");
  });

  it("summarizes unknown event types with truncated JSON", () => {
    const summary = summarizeEvent(makeEvent("custom.event", { foo: "bar", baz: 42 }));
    expect(summary).toContain("foo");
    expect(summary.length).toBeLessThanOrEqual(60);
  });
});
