import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import {
  appendWorktreeRecord,
  getWorktree,
  listWorktrees,
  getWorktreeStorePath,
  resetStoreDirCache,
} from "../store.js";
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
  tempDir = join(tmpdir(), `nexus-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("appendWorktreeRecord", () => {
  it("creates the store directory and file", async () => {
    const record = makeWorktree();
    await appendWorktreeRecord(record);
    expect(existsSync(getWorktreeStorePath())).toBe(true);
  });

  it("appends multiple records", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2" }));

    const all = await listWorktrees();
    expect(all).toHaveLength(2);
  });
});

describe("getWorktree", () => {
  it("returns the latest state for a worktree ID", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "active" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "merged" }));

    const result = await getWorktree("wt-1");
    expect(result).not.toBeNull();
    expect(result!.status).toBe("merged");
  });

  it("returns null for unknown ID", async () => {
    const result = await getWorktree("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when store file doesn't exist", async () => {
    const result = await getWorktree("any-id");
    expect(result).toBeNull();
  });
});

describe("listWorktrees", () => {
  it("returns all worktrees with latest state", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "active" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "merged" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2", status: "active" }));

    const all = await listWorktrees();
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.id === "wt-1")!.status).toBe("merged");
    expect(all.find((w) => w.id === "wt-2")!.status).toBe("active");
  });

  it("filters by project", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", project: "A" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2", project: "B" }));

    const result = await listWorktrees({ project: "A" });
    expect(result).toHaveLength(1);
    expect(result[0]!.project).toBe("A");
  });

  it("filters by status", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "active" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2", status: "merged" }));

    const result = await listWorktrees({ status: "active" });
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("active");
  });

  it("filters by multiple statuses", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", status: "active" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2", status: "merged" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-3", status: "stale" }));

    const result = await listWorktrees({ status: ["active", "stale"] });
    expect(result).toHaveLength(2);
  });

  it("filters by session_id", async () => {
    await appendWorktreeRecord(makeWorktree({ id: "wt-1", session_id: "s1" }));
    await appendWorktreeRecord(makeWorktree({ id: "wt-2", session_id: "s2" }));

    const result = await listWorktrees({ session_id: "s1" });
    expect(result).toHaveLength(1);
    expect(result[0]!.session_id).toBe("s1");
  });

  it("returns empty array when store doesn't exist", async () => {
    const result = await listWorktrees();
    expect(result).toEqual([]);
  });
});
