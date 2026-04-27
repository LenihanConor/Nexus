import { dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { WorktreeRecord, MergeResult, ConflictReport } from "@nexus/shared";
import { emitEvent } from "../audit/emitter.js";
import { execGit, detectMainBranch } from "./git.js";
import { appendWorktreeRecord, getWorktree, listWorktrees } from "./store.js";
import { checkConflicts } from "./conflicts.js";

const BRANCH_PATTERN = /^(feature|bugfix|docs)\/.+$/;

function slugify(branch: string): string {
  return branch.replace(/\//g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
}

export function getWorktreePath(project: string, branch: string): string {
  const projectName = basename(project).toLowerCase();
  const parentDir = dirname(project);
  return join(parentDir, ".nexus-worktrees", `${projectName}-${slugify(branch)}`);
}

export async function createWorktree(opts: {
  session_id: string;
  project: string;
  branch: string;
  parent_branch?: string;
  scope?: string[];
  skipConflictCheck?: boolean;
}): Promise<{ record: WorktreeRecord; conflicts: ConflictReport }> {
  if (!BRANCH_PATTERN.test(opts.branch)) {
    throw new Error(
      `Branch name "${opts.branch}" does not follow conventions. Use feature/, bugfix/, or docs/ prefix.`,
    );
  }

  const scope = opts.scope ?? [];
  let conflicts: ConflictReport = { has_conflicts: false, conflicts: [] };

  if (!opts.skipConflictCheck && scope.length > 0) {
    conflicts = await checkConflicts(opts.project, scope);
  }

  const parentBranch = opts.parent_branch ?? await detectMainBranch(opts.project);
  const worktreePath = getWorktreePath(opts.project, opts.branch);
  const id = randomUUID();

  const result = await execGit(opts.project, [
    "worktree",
    "add",
    "-b",
    opts.branch,
    worktreePath,
    parentBranch,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${result.stderr}`);
  }

  const record: WorktreeRecord = {
    id,
    session_id: opts.session_id,
    project: opts.project,
    branch: opts.branch,
    parent_branch: parentBranch,
    path: worktreePath,
    scope,
    status: "active",
    created_at: new Date().toISOString(),
    merged_at: null,
    cleaned_at: null,
    merge_result: null,
  };

  await appendWorktreeRecord(record);

  await emitEvent("worktree.created", opts.session_id, {
    worktree_id: id,
    branch: opts.branch,
    parent_branch: parentBranch,
    path: worktreePath,
    scope,
  }, { project: opts.project });

  if (conflicts.has_conflicts) {
    for (const c of conflicts.conflicts) {
      await emitEvent("worktree.conflict_detected", opts.session_id, {
        worktree_id: id,
        conflicting_session_id: c.session_id,
        overlapping_paths: c.overlapping_paths,
      }, { project: opts.project });
    }
  }

  return { record, conflicts };
}

export async function mergeWorktree(
  worktreeId: string,
  opts?: { strategy?: "merge" | "fast-forward" | "rebase" },
): Promise<MergeResult> {
  const record = await getWorktree(worktreeId);
  if (!record) throw new Error(`Worktree ${worktreeId} not found`);
  if (record.status !== "active" && record.status !== "completed") {
    throw new Error(`Worktree ${worktreeId} has status "${record.status}" — cannot merge`);
  }

  const strategy = opts?.strategy ?? "merge";

  const logResult = await execGit(record.project, [
    "rev-list",
    "--count",
    `${record.parent_branch}..${record.branch}`,
  ]);
  const commitsMerged = parseInt(logResult.stdout.trim(), 10) || 0;

  await execGit(record.project, ["checkout", record.parent_branch]);

  let mergeArgs: string[];
  switch (strategy) {
    case "fast-forward":
      mergeArgs = ["merge", "--ff-only", record.branch];
      break;
    case "rebase":
      mergeArgs = ["rebase", record.branch];
      break;
    default:
      mergeArgs = ["merge", "--no-ff", record.branch];
  }

  const result = await execGit(record.project, mergeArgs);

  if (result.exitCode !== 0) {
    const conflictFiles = await getConflictFiles(record.project);

    await execGit(record.project, ["merge", "--abort"]);

    const mergeResult: MergeResult = {
      success: false,
      conflicts: conflictFiles,
      commits_merged: 0,
    };

    await appendWorktreeRecord({
      ...record,
      status: "conflict",
      merge_result: mergeResult,
    });

    await emitEvent("worktree.merge_failed", record.session_id, {
      worktree_id: worktreeId,
      branch: record.branch,
      conflicts: conflictFiles,
    }, { project: record.project });

    return mergeResult;
  }

  const mergeResult: MergeResult = {
    success: true,
    conflicts: [],
    commits_merged: commitsMerged,
  };

  await appendWorktreeRecord({
    ...record,
    status: "merged",
    merged_at: new Date().toISOString(),
    merge_result: mergeResult,
  });

  await emitEvent("worktree.merged", record.session_id, {
    worktree_id: worktreeId,
    branch: record.branch,
    merge_result: mergeResult,
  }, { project: record.project });

  return mergeResult;
}

async function getConflictFiles(projectPath: string): Promise<string[]> {
  const result = await execGit(projectPath, ["diff", "--name-only", "--diff-filter=U"]);
  if (result.exitCode !== 0 || !result.stdout.trim()) return [];
  return result.stdout.trim().split("\n");
}

export async function cleanupWorktree(
  worktreeId: string,
  opts?: { force?: boolean },
): Promise<void> {
  const record = await getWorktree(worktreeId);
  if (!record) throw new Error(`Worktree ${worktreeId} not found`);

  if (!opts?.force && record.status === "active") {
    const dirty = await isWorktreeDirty(record.path);
    if (dirty) {
      throw new Error(
        `Worktree ${worktreeId} has uncommitted changes. Use --force to remove anyway.`,
      );
    }
  }

  const removeArgs = ["worktree", "remove", record.path];
  if (opts?.force) removeArgs.push("--force");

  const result = await execGit(record.project, removeArgs);
  if (result.exitCode !== 0) {
    throw new Error(`git worktree remove failed: ${result.stderr}`);
  }

  const branchMerged = await execGit(record.project, [
    "branch",
    "--merged",
    record.parent_branch,
  ]);
  if (branchMerged.stdout.includes(record.branch)) {
    await execGit(record.project, ["branch", "-d", record.branch]);
  }

  await appendWorktreeRecord({
    ...record,
    status: "cleaned",
    cleaned_at: new Date().toISOString(),
  });

  await emitEvent("worktree.cleaned", record.session_id, {
    worktree_id: worktreeId,
    branch: record.branch,
    path: record.path,
  }, { project: record.project });
}

export async function markStale(worktreeId: string): Promise<void> {
  const record = await getWorktree(worktreeId);
  if (!record) throw new Error(`Worktree ${worktreeId} not found`);

  await appendWorktreeRecord({ ...record, status: "stale" });

  await emitEvent("worktree.stale_detected", record.session_id, {
    worktree_id: worktreeId,
    session_id: record.session_id,
    branch: record.branch,
  }, { project: record.project });
}

export async function isWorktreeDirty(worktreePath: string): Promise<boolean> {
  const result = await execGit(worktreePath, ["status", "--porcelain"]);
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}
