import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { resetSessionStoreDirCache, listSessions } from "../store.js";
import { createSession, endSession } from "../lifecycle.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-session-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetSessionStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("listSessions filters", () => {
  it("filters by project", async () => {
    await createSession({ project: "A", agent_type: "claude", task_description: "t1" });
    await createSession({ project: "B", agent_type: "claude", task_description: "t2" });

    const result = await listSessions({ project: "A" });
    expect(result).toHaveLength(1);
    expect(result[0]!.project).toBe("A");
  });

  it("filters by status", async () => {
    const s1 = await createSession({ project: "A", agent_type: "claude", task_description: "t1" });
    await createSession({ project: "A", agent_type: "claude", task_description: "t2" });
    await endSession(s1.id, { status: "completed" });

    const running = await listSessions({ status: "running" });
    expect(running).toHaveLength(1);

    const completed = await listSessions({ status: "completed" });
    expect(completed).toHaveLength(1);
    expect(completed[0]!.id).toBe(s1.id);
  });

  it("filters by multiple statuses", async () => {
    const s1 = await createSession({ project: "A", agent_type: "claude", task_description: "t1" });
    const s2 = await createSession({ project: "A", agent_type: "claude", task_description: "t2" });
    await endSession(s1.id, { status: "completed" });
    await endSession(s2.id, { status: "failed" });

    const result = await listSessions({ status: ["completed", "failed"] });
    expect(result).toHaveLength(2);
  });

  it("filters by agent_type", async () => {
    await createSession({ project: "A", agent_type: "claude", task_description: "t1" });
    await createSession({ project: "A", agent_type: "aider", task_description: "t2" });

    const result = await listSessions({ agent_type: "aider" });
    expect(result).toHaveLength(1);
    expect(result[0]!.agent_type).toBe("aider");
  });

  it("filters by correlation_id", async () => {
    const s1 = await createSession({ project: "A", agent_type: "claude", task_description: "root" });
    await createSession({ project: "A", agent_type: "claude", task_description: "child", parent_id: s1.id });
    await createSession({ project: "A", agent_type: "claude", task_description: "unrelated" });

    const result = await listSessions({ correlation_id: s1.correlation_id });
    expect(result).toHaveLength(2);
  });

  it("filters by parent_id", async () => {
    const root = await createSession({ project: "A", agent_type: "claude", task_description: "root" });
    await createSession({ project: "A", agent_type: "claude", task_description: "child1", parent_id: root.id });
    await createSession({ project: "A", agent_type: "claude", task_description: "child2", parent_id: root.id });
    await createSession({ project: "A", agent_type: "claude", task_description: "other" });

    const result = await listSessions({ parent_id: root.id });
    expect(result).toHaveLength(2);
  });

  it("filters by date range", async () => {
    const s1 = await createSession({ project: "A", agent_type: "claude", task_description: "t1" });

    const now = new Date();
    const future = new Date(now.getTime() + 100_000).toISOString();
    const past = new Date(now.getTime() - 100_000).toISOString();

    const fromFuture = await listSessions({ from: future });
    expect(fromFuture).toHaveLength(0);

    const fromPast = await listSessions({ from: past });
    expect(fromPast).toHaveLength(1);

    const toPast = await listSessions({ to: past });
    expect(toPast).toHaveLength(0);

    const toFuture = await listSessions({ to: future });
    expect(toFuture).toHaveLength(1);
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createSession({ project: "A", agent_type: "claude", task_description: `t${i}` });
    }

    const result = await listSessions({ limit: 3 });
    expect(result).toHaveLength(3);
  });

  it("respects offset", async () => {
    for (let i = 0; i < 5; i++) {
      await createSession({ project: "A", agent_type: "claude", task_description: `t${i}` });
    }

    const all = await listSessions({ limit: 100 });
    const offset2 = await listSessions({ limit: 100, offset: 2 });
    expect(offset2).toHaveLength(3);
    expect(offset2[0]!.id).toBe(all[2]!.id);
  });

  it("returns newest first by default", async () => {
    const s1 = await createSession({ project: "A", agent_type: "claude", task_description: "first" });
    const s2 = await createSession({ project: "A", agent_type: "claude", task_description: "second" });

    const result = await listSessions();
    expect(result[0]!.id).toBe(s2.id);
    expect(result[1]!.id).toBe(s1.id);
  });

  it("returns empty when no sessions exist", async () => {
    const result = await listSessions();
    expect(result).toEqual([]);
  });
});
