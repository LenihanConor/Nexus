import { execFile } from "node:child_process";
import type { SessionRecord } from "@nexus/shared";
import { listSessions } from "./store.js";
import { updateSession } from "./lifecycle.js";
import { emitEvent } from "../audit/emitter.js";

const IS_WINDOWS = process.platform === "win32";

export async function isProcessAlive(pid: number): Promise<boolean> {
  if (IS_WINDOWS) {
    return new Promise((resolve) => {
      execFile(
        "tasklist",
        ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
        { timeout: 5000 },
        (error, stdout) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(stdout.includes(String(pid)));
        },
      );
    });
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function detectStaleSessions(): Promise<SessionRecord[]> {
  const running = await listSessions({ status: "running", limit: 1000 });
  const stale: SessionRecord[] = [];

  for (const session of running) {
    if (session.agent_pid === null) continue;

    const alive = await isProcessAlive(session.agent_pid);
    if (!alive) {
      const updated = await updateSession(session.id, { status: "stale" });
      stale.push(updated);

      await emitEvent("session.stale_detected", session.id, {
        session_id: session.id,
        agent_type: session.agent_type,
        agent_pid: session.agent_pid,
        last_updated: session.updated_at,
      }, { project: session.project });
    }
  }

  return stale;
}

let staleTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionStaleDetection(intervalMs = 60_000): void {
  stopSessionStaleDetection();
  staleTimer = setInterval(() => {
    detectStaleSessions().catch(() => {});
  }, intervalMs);
  staleTimer.unref();
}

export function stopSessionStaleDetection(): void {
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
}
