import type { WorktreeRecord } from "@nexus/shared";
import { listWorktrees } from "./store.js";
import { markStale } from "./lifecycle.js";

export type SessionChecker = (sessionId: string) => Promise<boolean>;

let defaultSessionChecker: SessionChecker = async () => false;

export function setSessionChecker(checker: SessionChecker): void {
  defaultSessionChecker = checker;
}

export async function detectStaleWorktrees(
  checker?: SessionChecker,
): Promise<WorktreeRecord[]> {
  const check = checker ?? defaultSessionChecker;
  const active = await listWorktrees({ status: "active" });
  const stale: WorktreeRecord[] = [];

  for (const wt of active) {
    const sessionAlive = await check(wt.session_id);
    if (!sessionAlive) {
      await markStale(wt.id);
      stale.push({ ...wt, status: "stale" });
    }
  }

  return stale;
}

let staleTimer: ReturnType<typeof setInterval> | null = null;

export function startStaleDetection(intervalMs = 60_000): void {
  stopStaleDetection();
  staleTimer = setInterval(() => {
    detectStaleWorktrees().catch(() => {});
  }, intervalMs);
  staleTimer.unref();
}

export function stopStaleDetection(): void {
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
}
