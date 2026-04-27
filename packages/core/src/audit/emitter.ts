import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir, userInfo } from "node:os";
import { randomUUID } from "node:crypto";
import type { NexusEvent } from "@nexus/shared";
import { serializeJsonlLine } from "@nexus/shared";

let nexusDir: string | null = null;
let eventsDirCreated = false;

export function getNexusDir(): string {
  return nexusDir ?? join(homedir(), ".nexus");
}

export function setNexusDir(dir: string): void {
  nexusDir = dir;
  eventsDirCreated = false;
}

export function getEventsDir(): string {
  return join(getNexusDir(), "events");
}

export function getEventFilePath(date?: Date): string {
  const d = date ?? new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return join(getEventsDir(), `events-${yyyy}-${mm}-${dd}.jsonl`);
}

async function ensureEventsDir(): Promise<void> {
  if (eventsDirCreated) return;
  await mkdir(getEventsDir(), { recursive: true });
  eventsDirCreated = true;
}

export async function emit(
  event: Omit<NexusEvent, "id" | "timestamp">,
): Promise<NexusEvent> {
  const complete: NexusEvent = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  try {
    await ensureEventsDir();
    const filePath = getEventFilePath();
    const line = serializeJsonlLine(complete) + "\n";
    await appendFile(filePath, line, "utf-8");
  } catch (err) {
    process.stderr.write(
      `[nexus] Failed to write event: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  return complete;
}

export async function emitEvent(
  type: string,
  sessionId: string | null,
  payload: Record<string, unknown>,
  opts?: {
    project?: string;
    correlationId?: string;
    agentId?: string | null;
  },
): Promise<NexusEvent> {
  return emit({
    event_type: type,
    project: opts?.project ?? "",
    session_id: sessionId,
    correlation_id: opts?.correlationId ?? sessionId ?? randomUUID(),
    agent_id: opts?.agentId ?? null,
    user_id: userInfo().username,
    payload,
  });
}
