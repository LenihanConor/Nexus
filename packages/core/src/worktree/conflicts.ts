import type { ConflictReport } from "@nexus/shared";
import { listWorktrees } from "./store.js";

const IS_WINDOWS = process.platform === "win32";

function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, "/");
  if (IS_WINDOWS) normalized = normalized.toLowerCase();
  return normalized;
}

export function pathsOverlap(a: string, b: string): boolean {
  const na = normalizePath(a);
  const nb = normalizePath(b);

  if (na === nb) return true;
  if (na.endsWith("/") && nb.startsWith(na)) return true;
  if (nb.endsWith("/") && na.startsWith(nb)) return true;
  if (!na.endsWith("/") && nb.startsWith(na + "/")) return true;
  if (!nb.endsWith("/") && na.startsWith(nb + "/")) return true;

  return false;
}

export async function checkConflicts(
  project: string,
  scope: string[],
): Promise<ConflictReport> {
  if (scope.length === 0) {
    return { has_conflicts: false, conflicts: [] };
  }

  const activeWorktrees = await listWorktrees({ project, status: "active" });

  const conflicts: ConflictReport["conflicts"] = [];

  for (const wt of activeWorktrees) {
    if (wt.scope.length === 0) continue;

    const overlapping: string[] = [];
    for (const proposedPath of scope) {
      for (const activePath of wt.scope) {
        if (pathsOverlap(proposedPath, activePath)) {
          overlapping.push(proposedPath);
          break;
        }
      }
    }

    if (overlapping.length > 0) {
      conflicts.push({
        worktree_id: wt.id,
        session_id: wt.session_id,
        branch: wt.branch,
        overlapping_paths: overlapping,
      });
    }
  }

  return {
    has_conflicts: conflicts.length > 0,
    conflicts,
  };
}
