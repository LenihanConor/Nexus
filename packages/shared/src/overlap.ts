import type { WorktreeRecord } from "./worktree.js";

export interface OverlapReport {
  worktree_a: WorktreeRecord;
  worktree_b: WorktreeRecord;
  overlapping_paths: string[];
}

export function pathsOverlap(pathA: string, pathB: string): boolean {
  const a = pathA.replace(/\\/g, "/");
  const b = pathB.replace(/\\/g, "/");
  if (a === b) return true;
  const aDir = a.endsWith("/") ? a : a + "/";
  const bDir = b.endsWith("/") ? b : b + "/";
  return b.startsWith(aDir) || a.startsWith(bDir);
}

export function detectOverlaps(worktrees: WorktreeRecord[]): OverlapReport[] {
  const active = worktrees.filter((w) => w.status === "active");
  const byProject = new Map<string, WorktreeRecord[]>();
  for (const w of active) {
    const list = byProject.get(w.project) ?? [];
    list.push(w);
    byProject.set(w.project, list);
  }

  const reports: OverlapReport[] = [];
  for (const group of byProject.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const overlapping: string[] = [];
        for (const pa of a.scope) {
          for (const pb of b.scope) {
            if (pathsOverlap(pa, pb)) {
              overlapping.push(pa === pb ? pa : `${pa} <> ${pb}`);
            }
          }
        }
        if (overlapping.length > 0) {
          reports.push({ worktree_a: a, worktree_b: b, overlapping_paths: overlapping });
        }
      }
    }
  }
  return reports;
}
