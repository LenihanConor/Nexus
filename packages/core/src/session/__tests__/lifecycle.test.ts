import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { resetSessionStoreDirCache } from "../store.js";
import { createSession, updateSession, endSession } from "../lifecycle.js";
import { getSession } from "../store.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetSessionStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("createSession", () => {
  it("creates a session with running status", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Implement auth",
    });

    expect(session.id).toBeTruthy();
    expect(session.status).toBe("running");
    expect(session.agent_type).toBe("claude-code");
    expect(session.task_description).toBe("Implement auth");
    expect(session.parent_id).toBeNull();
    expect(session.correlation_id).toBe(session.id);
    expect(session.snapshots).toHaveLength(1);
    expect(session.snapshots[0]!.label).toBe("session_started");
  });

  it("inherits correlation_id from parent", async () => {
    const parent = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Parent task",
    });

    const child = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Child task",
      parent_id: parent.id,
    });

    expect(child.parent_id).toBe(parent.id);
    expect(child.correlation_id).toBe(parent.correlation_id);
  });

  it("allows explicit correlation_id override", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
      correlation_id: "custom-corr",
    });

    expect(session.correlation_id).toBe("custom-corr");
  });

  it("captures agent_pid", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      agent_pid: 12345,
      task_description: "Task",
    });

    expect(session.agent_pid).toBe(12345);
  });
});

describe("updateSession", () => {
  it("updates session status", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    const updated = await updateSession(session.id, { status: "paused" });
    expect(updated.status).toBe("paused");
  });

  it("appends a snapshot", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    const updated = await updateSession(session.id, {
      snapshot: {
        label: "task_1_completed",
        task_progress: "1 of 3 tasks done",
        decisions: ["Used JWT tokens"],
        files_changed: ["src/auth.ts"],
        notes: null,
      },
    });

    expect(updated.snapshots).toHaveLength(2);
    expect(updated.snapshots[1]!.label).toBe("task_1_completed");
    expect(updated.snapshots[1]!.decisions).toContain("Used JWT tokens");
  });

  it("shallow merges metadata", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
      metadata: { tokens: 100 },
    });

    const updated = await updateSession(session.id, {
      metadata: { files_changed: 3 },
    });

    expect(updated.metadata).toEqual({ tokens: 100, files_changed: 3 });
  });

  it("throws for nonexistent session", async () => {
    await expect(
      updateSession("nonexistent", { status: "paused" }),
    ).rejects.toThrow("not found");
  });
});

describe("endSession", () => {
  it("ends a session with duration", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    const ended = await endSession(session.id, { status: "completed" });
    expect(ended.status).toBe("completed");
    expect(ended.ended_at).toBeTruthy();
    expect(ended.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("is idempotent on already-ended session", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    const first = await endSession(session.id, { status: "completed" });
    const second = await endSession(session.id, { status: "failed" });

    expect(second.status).toBe("completed");
    expect(second.id).toBe(first.id);
  });

  it("appends a final snapshot", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    const ended = await endSession(session.id, {
      status: "completed",
      snapshot: {
        label: "session_ended",
        task_progress: "3 of 3 tasks done",
        decisions: [],
        files_changed: [],
        notes: "All done",
      },
    });

    expect(ended.snapshots).toHaveLength(2);
    expect(ended.snapshots[1]!.label).toBe("session_ended");
  });

  it("persists ended state to store", async () => {
    const session = await createSession({
      project: "C:/GitHub/TestProject",
      agent_type: "claude-code",
      task_description: "Task",
    });

    await endSession(session.id, { status: "failed", exit_code: 1 });

    const loaded = await getSession(session.id);
    expect(loaded!.status).toBe("failed");
    expect(loaded!.exit_code).toBe(1);
  });
});
