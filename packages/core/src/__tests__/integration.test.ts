import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../audit/emitter.js";
import { query } from "../audit/query.js";
import { resetSessionStoreDirCache } from "../session/store.js";
import { resetStoreDirCache } from "../worktree/store.js";
import { createSession, updateSession, endSession } from "../session/lifecycle.js";
import { createWorktree, mergeWorktree, cleanupWorktree } from "../worktree/lifecycle.js";
import { detectStaleWorktrees, setSessionChecker } from "../worktree/stale.js";
import { getSession, listSessions } from "../session/store.js";
import { listWorktrees, getWorktree } from "../worktree/store.js";
import { getLineage, getCorrelationGroup } from "../session/lineage.js";

let tempDir: string;
let nexusDir: string;
let repoDir: string;

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function createTestRepo(): string {
  const dir = join(tempDir, "test-repo");
  mkdirSync(dir, { recursive: true });
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "test@test.com"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["checkout", "-b", "main"]);
  writeFileSync(join(dir, "README.md"), "# Test\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "initial"]);
  return dir;
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  nexusDir = join(tempDir, ".nexus-data");
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(nexusDir);
  resetSessionStoreDirCache();
  resetStoreDirCache();
  repoDir = createTestRepo();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("session lifecycle emits audit events", () => {
  it("emits session.started, session.updated, and session.ended events", async () => {
    const session = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Integration test task",
    });

    await updateSession(session.id, {
      status: "paused",
      snapshot: {
        label: "midpoint",
        task_progress: "1 of 2",
        decisions: ["chose approach A"],
        files_changed: ["src/a.ts"],
        notes: null,
      },
    });

    await endSession(session.id, { status: "completed", exit_code: 0 });

    const events = await query({ session_id: session.id, limit: 100 });
    const types = events.map((e) => e.event_type);

    expect(types).toContain("session.started");
    expect(types).toContain("session.updated");
    expect(types).toContain("session.ended");
    expect(events.length).toBe(3);

    const startedEvent = events.find((e) => e.event_type === "session.started")!;
    expect(startedEvent.payload).toHaveProperty("agent_type", "claude-code");
    expect(startedEvent.payload).toHaveProperty("task_description", "Integration test task");

    const endedEvent = events.find((e) => e.event_type === "session.ended")!;
    expect(endedEvent.payload).toHaveProperty("status", "completed");
    expect(endedEvent.payload).toHaveProperty("exit_code", 0);
  });
});

describe("worktree lifecycle emits audit events", () => {
  it("emits worktree.created and worktree.cleaned events", async () => {
    const session = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Worktree test",
    });

    const { record } = await createWorktree({
      session_id: session.id,
      project: repoDir,
      branch: "feature/integration-test",
      parent_branch: "main",
      scope: ["src/"],
    });

    await cleanupWorktree(record.id, { force: true });

    const events = await query({ event_type: "worktree", limit: 100 });
    const types = events.map((e) => e.event_type);

    expect(types).toContain("worktree.created");
    expect(types).toContain("worktree.cleaned");

    const createdEvent = events.find((e) => e.event_type === "worktree.created")!;
    expect(createdEvent.payload).toHaveProperty("branch", "feature/integration-test");
    expect(createdEvent.payload).toHaveProperty("scope", ["src/"]);
  });
});

describe("worktree merge emits correct events", () => {
  it("emits worktree.created and worktree.merged on successful merge", async () => {
    const session = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Merge test",
    });

    const { record } = await createWorktree({
      session_id: session.id,
      project: repoDir,
      branch: "feature/merge-integration",
      parent_branch: "main",
    });

    writeFileSync(join(record.path, "new-file.ts"), "export const x = 1;\n");
    git(record.path, ["add", "."]);
    git(record.path, ["commit", "-m", "add feature"]);

    const mergeResult = await mergeWorktree(record.id);
    expect(mergeResult.success).toBe(true);

    const events = await query({ event_type: "worktree", limit: 100 });
    const types = events.map((e) => e.event_type);
    expect(types).toContain("worktree.merged");
  });
});

describe("stale worktree detection cross-references session status", () => {
  it("marks worktree as stale when owning session is ended", async () => {
    const session = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Stale test",
    });

    const { record } = await createWorktree({
      session_id: session.id,
      project: repoDir,
      branch: "feature/stale-test",
      parent_branch: "main",
    });

    await endSession(session.id, { status: "failed", exit_code: 1 });

    setSessionChecker(async (sessionId: string) => {
      const s = await getSession(sessionId);
      return s !== null && s.status === "running";
    });

    const stale = await detectStaleWorktrees();
    expect(stale).toHaveLength(1);
    expect(stale[0]!.id).toBe(record.id);

    const updated = await getWorktree(record.id);
    expect(updated!.status).toBe("stale");

    const events = await query({ event_type: "worktree.stale_detected", limit: 100 });
    expect(events).toHaveLength(1);
  });
});

describe("conflict detection across worktrees", () => {
  it("detects scope conflicts between concurrent worktrees", async () => {
    const s1 = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Auth work",
    });

    await createWorktree({
      session_id: s1.id,
      project: repoDir,
      branch: "feature/auth-impl",
      parent_branch: "main",
      scope: ["src/auth/", "src/config.ts"],
    });

    const s2 = await createSession({
      project: repoDir,
      agent_type: "aider",
      task_description: "Also auth work",
    });

    const { conflicts } = await createWorktree({
      session_id: s2.id,
      project: repoDir,
      branch: "feature/auth-tests",
      parent_branch: "main",
      scope: ["src/auth/login.ts", "src/utils/"],
    });

    expect(conflicts.has_conflicts).toBe(true);
    expect(conflicts.conflicts).toHaveLength(1);
    expect(conflicts.conflicts[0]!.overlapping_paths).toContain("src/auth/login.ts");

    const events = await query({ event_type: "worktree.conflict_detected", limit: 100 });
    expect(events).toHaveLength(1);
  });
});

describe("full workflow: session → worktree → changes → merge → end", () => {
  it("produces complete audit trail for an agent task lifecycle", async () => {
    // 1. Create root session
    const root = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Implement feature X",
    });

    // 2. Create child session for subtask
    const child = await createSession({
      project: repoDir,
      agent_type: "claude-code",
      task_description: "Write tests for feature X",
      parent_id: root.id,
    });

    // 3. Create worktree for the child
    const { record: wt } = await createWorktree({
      session_id: child.id,
      project: repoDir,
      branch: "feature/test-feature-x",
      parent_branch: "main",
      scope: ["tests/"],
    });

    // 4. Make changes in worktree
    writeFileSync(join(wt.path, "test.ts"), "// tests\n");
    git(wt.path, ["add", "."]);
    git(wt.path, ["commit", "-m", "add tests"]);

    // 5. Update session with snapshot
    await updateSession(child.id, {
      snapshot: {
        label: "tests_written",
        task_progress: "1 of 1",
        decisions: [],
        files_changed: ["test.ts"],
        notes: null,
      },
    });

    // 6. Merge worktree
    const mergeResult = await mergeWorktree(wt.id);
    expect(mergeResult.success).toBe(true);

    // 7. Cleanup worktree
    await cleanupWorktree(wt.id);

    // 8. End child session
    await endSession(child.id, {
      status: "completed",
      exit_code: 0,
      snapshot: {
        label: "session_ended",
        task_progress: "1 of 1",
        decisions: [],
        files_changed: ["test.ts"],
        notes: "All tests pass",
      },
    });

    // 9. End root session
    await endSession(root.id, { status: "completed" });

    // Verify: full audit trail
    const allEvents = await query({ limit: 1000 });
    expect(allEvents.length).toBeGreaterThanOrEqual(8);

    const eventTypes = allEvents.map((e) => e.event_type);
    expect(eventTypes).toContain("session.started");
    expect(eventTypes).toContain("session.updated");
    expect(eventTypes).toContain("session.ended");
    expect(eventTypes).toContain("worktree.created");
    expect(eventTypes).toContain("worktree.merged");
    expect(eventTypes).toContain("worktree.cleaned");

    // Verify: session lineage
    const lineage = await getLineage(child.id);
    expect(lineage.root.id).toBe(root.id);
    expect(lineage.path_to_target).toHaveLength(2);

    // Verify: correlation group
    const group = await getCorrelationGroup(root.correlation_id);
    expect(group).toHaveLength(2);

    // Verify: child session has all snapshots
    const finalChild = await getSession(child.id);
    expect(finalChild!.snapshots).toHaveLength(3); // started + tests_written + ended
    expect(finalChild!.status).toBe("completed");
    expect(finalChild!.duration_ms).toBeGreaterThanOrEqual(0);

    // Verify: worktree record shows cleaned
    const finalWt = await getWorktree(wt.id);
    expect(finalWt!.status).toBe("cleaned");

    // Verify: both sessions ended
    const runningSessions = await listSessions({ status: "running" });
    expect(runningSessions).toHaveLength(0);

    const completedSessions = await listSessions({ status: "completed" });
    expect(completedSessions).toHaveLength(2);
  });
});

describe("multi-project event filtering", () => {
  it("events are tagged with correct project and filterable", async () => {
    const s1 = await createSession({
      project: "C:/GitHub/ProjectA",
      agent_type: "claude-code",
      task_description: "Work on A",
    });

    const s2 = await createSession({
      project: "C:/GitHub/ProjectB",
      agent_type: "aider",
      task_description: "Work on B",
    });

    const projectAEvents = await query({ project: "C:/GitHub/ProjectA", limit: 100 });
    const projectBEvents = await query({ project: "C:/GitHub/ProjectB", limit: 100 });

    expect(projectAEvents.length).toBeGreaterThan(0);
    expect(projectBEvents.length).toBeGreaterThan(0);
    expect(projectAEvents.every((e) => e.project === "C:/GitHub/ProjectA")).toBe(true);
    expect(projectBEvents.every((e) => e.project === "C:/GitHub/ProjectB")).toBe(true);
  });
});
