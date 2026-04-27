import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { appendWorktreeRecord, resetStoreDirCache } from "../store.js";
import { pathsOverlap, checkConflicts } from "../conflicts.js";
import type { WorktreeRecord } from "@nexus/shared";

let tempDir: string;

function makeWorktree(overrides: Partial<WorktreeRecord> = {}): WorktreeRecord {
  return {
    id: `wt-${Math.random().toString(36).slice(2)}`,
    session_id: "sess-1",
    project: "C:/GitHub/TestProject",
    branch: "feature/test",
    parent_branch: "main",
    path: "C:/GitHub/.nexus-worktrees/test-feature-test",
    scope: [],
    status: "active",
    created_at: "2026-04-27T12:00:00Z",
    merged_at: null,
    cleaned_at: null,
    merge_result: null,
    ...overrides,
  };
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-conflict-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("pathsOverlap", () => {
  it("exact match", () => {
    expect(pathsOverlap("src/auth/login.ts", "src/auth/login.ts")).toBe(true);
  });

  it("directory contains file", () => {
    expect(pathsOverlap("src/auth/", "src/auth/login.ts")).toBe(true);
  });

  it("file contained by directory", () => {
    expect(pathsOverlap("src/auth/login.ts", "src/auth/")).toBe(true);
  });

  it("no overlap between different directories", () => {
    expect(pathsOverlap("src/auth/", "src/utils/")).toBe(false);
  });

  it("no overlap between sibling files", () => {
    expect(pathsOverlap("src/auth/login.ts", "src/auth/register.ts")).toBe(false);
  });

  it("directory prefix without slash doesn't match sibling", () => {
    expect(pathsOverlap("src/auth", "src/auth-helpers/")).toBe(false);
  });

  it("nested directory overlap", () => {
    expect(pathsOverlap("src/", "src/auth/login.ts")).toBe(true);
  });
});

describe("checkConflicts", () => {
  it("returns no conflicts when no active worktrees exist", async () => {
    const result = await checkConflicts("C:/GitHub/TestProject", ["src/auth/"]);
    expect(result.has_conflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("returns no conflicts when scope is empty", async () => {
    await appendWorktreeRecord(makeWorktree({ scope: ["src/auth/"] }));
    const result = await checkConflicts("C:/GitHub/TestProject", []);
    expect(result.has_conflicts).toBe(false);
  });

  it("detects overlap between proposed and active scope", async () => {
    await appendWorktreeRecord(
      makeWorktree({
        id: "wt-1",
        scope: ["src/auth/"],
        branch: "feature/auth",
      }),
    );

    const result = await checkConflicts("C:/GitHub/TestProject", ["src/auth/login.ts"]);
    expect(result.has_conflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.worktree_id).toBe("wt-1");
    expect(result.conflicts[0]!.overlapping_paths).toContain("src/auth/login.ts");
  });

  it("ignores non-active worktrees", async () => {
    await appendWorktreeRecord(
      makeWorktree({ scope: ["src/auth/"], status: "merged" }),
    );

    const result = await checkConflicts("C:/GitHub/TestProject", ["src/auth/"]);
    expect(result.has_conflicts).toBe(false);
  });

  it("ignores worktrees from different projects", async () => {
    await appendWorktreeRecord(
      makeWorktree({
        project: "C:/GitHub/OtherProject",
        scope: ["src/auth/"],
      }),
    );

    const result = await checkConflicts("C:/GitHub/TestProject", ["src/auth/"]);
    expect(result.has_conflicts).toBe(false);
  });

  it("reports multiple conflicts", async () => {
    await appendWorktreeRecord(
      makeWorktree({ id: "wt-1", scope: ["src/auth/"], branch: "feature/auth" }),
    );
    await appendWorktreeRecord(
      makeWorktree({ id: "wt-2", scope: ["src/config.ts"], branch: "feature/config" }),
    );

    const result = await checkConflicts("C:/GitHub/TestProject", [
      "src/auth/login.ts",
      "src/config.ts",
    ]);
    expect(result.has_conflicts).toBe(true);
    expect(result.conflicts).toHaveLength(2);
  });

  it("ignores active worktrees with empty scope", async () => {
    await appendWorktreeRecord(makeWorktree({ scope: [] }));

    const result = await checkConflicts("C:/GitHub/TestProject", ["src/auth/"]);
    expect(result.has_conflicts).toBe(false);
  });
});
