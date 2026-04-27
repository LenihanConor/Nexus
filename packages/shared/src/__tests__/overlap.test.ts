import { describe, it, expect } from "vitest";
import { pathsOverlap, detectOverlaps } from "../overlap.js";
import type { WorktreeRecord } from "../worktree.js";

function makeWorktree(id: string, overrides: Partial<WorktreeRecord> = {}): WorktreeRecord {
  return {
    id,
    session_id: `sess-${id}`,
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

describe("pathsOverlap", () => {
  it("exact match", () => {
    expect(pathsOverlap("src/auth/login.ts", "src/auth/login.ts")).toBe(true);
  });

  it("directory contains file", () => {
    expect(pathsOverlap("src/auth/", "src/auth/login.ts")).toBe(true);
  });

  it("file inside directory (reverse order)", () => {
    expect(pathsOverlap("src/auth/login.ts", "src/auth/")).toBe(true);
  });

  it("directory contains directory", () => {
    expect(pathsOverlap("src/", "src/auth/")).toBe(true);
  });

  it("no overlap — different directories", () => {
    expect(pathsOverlap("src/auth/", "src/utils/")).toBe(false);
  });

  it("no overlap — same prefix but different paths", () => {
    expect(pathsOverlap("src/auth", "src/authorization/")).toBe(false);
  });

  it("handles backslashes (normalizes to forward)", () => {
    expect(pathsOverlap("src\\auth\\", "src/auth/login.ts")).toBe(true);
  });

  it("identical directories", () => {
    expect(pathsOverlap("src/auth/", "src/auth/")).toBe(true);
  });
});

describe("detectOverlaps", () => {
  it("returns empty for no worktrees", () => {
    expect(detectOverlaps([])).toEqual([]);
  });

  it("returns empty for single worktree", () => {
    expect(detectOverlaps([makeWorktree("a", { scope: ["src/"] })])).toEqual([]);
  });

  it("detects overlap between two active worktrees in same project", () => {
    const worktrees = [
      makeWorktree("a", { scope: ["src/auth/"] }),
      makeWorktree("b", { scope: ["src/auth/login.ts"] }),
    ];
    const overlaps = detectOverlaps(worktrees);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.overlapping_paths).toHaveLength(1);
  });

  it("does not detect overlap for non-active worktrees", () => {
    const worktrees = [
      makeWorktree("a", { scope: ["src/auth/"], status: "active" }),
      makeWorktree("b", { scope: ["src/auth/login.ts"], status: "merged" }),
    ];
    expect(detectOverlaps(worktrees)).toEqual([]);
  });

  it("does not detect overlap across different projects", () => {
    const worktrees = [
      makeWorktree("a", { project: "ProjectA", scope: ["src/auth/"] }),
      makeWorktree("b", { project: "ProjectB", scope: ["src/auth/"] }),
    ];
    expect(detectOverlaps(worktrees)).toEqual([]);
  });

  it("detects multiple overlaps", () => {
    const worktrees = [
      makeWorktree("a", { scope: ["src/auth/", "src/config.ts"] }),
      makeWorktree("b", { scope: ["src/auth/login.ts"] }),
      makeWorktree("c", { scope: ["src/config.ts"] }),
    ];
    const overlaps = detectOverlaps(worktrees);
    expect(overlaps).toHaveLength(2);
  });

  it("returns empty when scopes are disjoint", () => {
    const worktrees = [
      makeWorktree("a", { scope: ["src/auth/"] }),
      makeWorktree("b", { scope: ["src/utils/"] }),
    ];
    expect(detectOverlaps(worktrees)).toEqual([]);
  });

  it("returns empty when worktrees have empty scopes", () => {
    const worktrees = [
      makeWorktree("a", { scope: [] }),
      makeWorktree("b", { scope: [] }),
    ];
    expect(detectOverlaps(worktrees)).toEqual([]);
  });
});
