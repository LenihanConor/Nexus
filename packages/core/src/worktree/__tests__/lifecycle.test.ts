import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { setNexusDir } from "../../audit/emitter.js";
import { resetStoreDirCache } from "../store.js";
import {
  createWorktree,
  mergeWorktree,
  cleanupWorktree,
  getWorktreePath,
} from "../lifecycle.js";

let tempDir: string;
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
  tempDir = join(tmpdir(), `nexus-lifecycle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(join(tempDir, ".nexus-data"));
  resetStoreDirCache();
  repoDir = createTestRepo();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("getWorktreePath", () => {
  it("generates path adjacent to project", () => {
    const result = getWorktreePath("C:/GitHub/MyProject", "feature/add-auth");
    expect(result).toBe(join("C:/GitHub", ".nexus-worktrees", "myproject-feature-add-auth"));
  });
});

describe("createWorktree", () => {
  it("creates a git worktree and records it", async () => {
    const { record } = await createWorktree({
      session_id: "sess-1",
      project: repoDir,
      branch: "feature/test-feature",
      parent_branch: "main",
    });

    expect(record.status).toBe("active");
    expect(record.branch).toBe("feature/test-feature");
    expect(record.parent_branch).toBe("main");
    expect(record.session_id).toBe("sess-1");

    const branches = git(repoDir, ["branch"]);
    expect(branches).toContain("feature/test-feature");
  });

  it("rejects invalid branch names", async () => {
    await expect(
      createWorktree({
        session_id: "sess-1",
        project: repoDir,
        branch: "invalid-name",
      }),
    ).rejects.toThrow("does not follow conventions");
  });

  it("runs conflict check by default", async () => {
    // Create first worktree with scope
    await createWorktree({
      session_id: "sess-1",
      project: repoDir,
      branch: "feature/first",
      parent_branch: "main",
      scope: ["src/auth/"],
    });

    // Create second with overlapping scope
    const { conflicts } = await createWorktree({
      session_id: "sess-2",
      project: repoDir,
      branch: "feature/second",
      parent_branch: "main",
      scope: ["src/auth/login.ts"],
    });

    expect(conflicts.has_conflicts).toBe(true);
    expect(conflicts.conflicts).toHaveLength(1);
  });
});

describe("mergeWorktree", () => {
  it("merges a worktree back to parent", async () => {
    const { record } = await createWorktree({
      session_id: "sess-1",
      project: repoDir,
      branch: "feature/merge-test",
      parent_branch: "main",
    });

    writeFileSync(join(record.path, "new-file.ts"), "export const x = 1;\n");
    git(record.path, ["add", "."]);
    git(record.path, ["commit", "-m", "add new file"]);

    const result = await mergeWorktree(record.id);
    expect(result.success).toBe(true);
    expect(result.commits_merged).toBeGreaterThanOrEqual(1);
  });
});

describe("cleanupWorktree", () => {
  it("removes a worktree from disk", async () => {
    const { record } = await createWorktree({
      session_id: "sess-1",
      project: repoDir,
      branch: "feature/cleanup-test",
      parent_branch: "main",
    });

    writeFileSync(join(record.path, "new-file.ts"), "export const x = 1;\n");
    git(record.path, ["add", "."]);
    git(record.path, ["commit", "-m", "add file"]);

    await mergeWorktree(record.id);
    await cleanupWorktree(record.id);

    const worktrees = git(repoDir, ["worktree", "list"]);
    expect(worktrees).not.toContain("feature/cleanup-test");
  });
});
