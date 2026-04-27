import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { resetSessionStoreDirCache } from "../../session/store.js";
import { resetStoreDirCache as resetWorktreeStoreDirCache } from "../../worktree/store.js";
import { getSession } from "../../session/store.js";
import { getWorktree } from "../../worktree/store.js";
import { BaseAdapter } from "../base.js";
import { GenericAdapter } from "../generic.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-adapter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetSessionStoreDirCache();
  resetWorktreeStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("BaseAdapter", () => {
  it("start creates a session", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    expect(session.sessionId).toBeTruthy();
    expect(session.agentType).toBe("test-agent");
    expect(session.project).toBe("C:/GitHub/TestProject");
    expect(session.worktreeId).toBeNull();
    expect(session.worktreePath).toBeNull();

    const record = await getSession(session.sessionId);
    expect(record).toBeTruthy();
    expect(record!.status).toBe("running");
    expect(record!.task_description).toBe("Test task");
  });

  it("start with noWorktree=true skips worktree creation", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Quick fix",
      noWorktree: true,
    });

    expect(session.worktreeId).toBeNull();
    expect(session.worktreePath).toBeNull();
  });

  it("checkpoint updates session with snapshot", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.checkpoint(session, {
      label: "file_edit",
      filesChanged: ["src/auth.ts"],
      notes: "Added login function",
    });

    const record = await getSession(session.sessionId);
    expect(record!.snapshots).toHaveLength(2);
    expect(record!.snapshots[1]!.label).toBe("file_edit");
    expect(record!.snapshots[1]!.files_changed).toEqual(["src/auth.ts"]);
  });

  it("end with completed status ends session", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.end(session, {
      status: "completed",
      exitCode: 0,
    });

    const record = await getSession(session.sessionId);
    expect(record!.status).toBe("completed");
    expect(record!.exit_code).toBe(0);
    expect(record!.ended_at).toBeTruthy();
    expect(record!.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("end with failed status ends session", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.end(session, {
      status: "failed",
      exitCode: 1,
    });

    const record = await getSession(session.sessionId);
    expect(record!.status).toBe("failed");
    expect(record!.exit_code).toBe(1);
  });

  it("end with interrupted status ends session", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.end(session, { status: "interrupted" });

    const record = await getSession(session.sessionId);
    expect(record!.status).toBe("interrupted");
  });

  it("end with snapshot includes final snapshot", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.end(session, {
      status: "completed",
      exitCode: 0,
      snapshot: {
        label: "final",
        filesChanged: ["src/main.ts"],
        notes: "Done",
      },
    });

    const record = await getSession(session.sessionId);
    const lastSnap = record!.snapshots[record!.snapshots.length - 1]!;
    expect(lastSnap.label).toBe("final");
    expect(lastSnap.files_changed).toEqual(["src/main.ts"]);
  });

  it("multiple checkpoints accumulate snapshots", async () => {
    const adapter = new BaseAdapter("test-agent");
    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Test task",
      noWorktree: true,
    });

    await adapter.checkpoint(session, { label: "step1" });
    await adapter.checkpoint(session, { label: "step2" });
    await adapter.checkpoint(session, { label: "step3" });

    const record = await getSession(session.sessionId);
    expect(record!.snapshots).toHaveLength(4); // 1 initial + 3 checkpoints
  });

  it("start passes parent and correlation IDs", async () => {
    const adapter = new BaseAdapter("test-agent");
    const parent = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Parent task",
      noWorktree: true,
    });

    const child = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Child task",
      noWorktree: true,
      parentSessionId: parent.sessionId,
    });

    const childRecord = await getSession(child.sessionId);
    expect(childRecord!.parent_id).toBe(parent.sessionId);

    const parentRecord = await getSession(parent.sessionId);
    expect(childRecord!.correlation_id).toBe(parentRecord!.correlation_id);
  });
});

describe("GenericAdapter", () => {
  it("works with default agent type", async () => {
    const adapter = new GenericAdapter();
    expect(adapter.agentType).toBe("generic");

    const session = await adapter.start({
      project: "C:/GitHub/TestProject",
      task: "Generic task",
      noWorktree: true,
    });

    expect(session.agentType).toBe("generic");
  });

  it("works with custom agent type", async () => {
    const adapter = new GenericAdapter("custom-tool");
    expect(adapter.agentType).toBe("custom-tool");
  });
});
