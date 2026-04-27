import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SessionRecord, SessionStatus } from "@nexus/shared";
import { readJsonlFile, serializeJsonlLine } from "@nexus/shared";
import { getNexusDir } from "../audit/emitter.js";

export function getSessionStorePath(): string {
  return join(getNexusDir(), "sessions", "sessions.jsonl");
}

let storeDirCreated = false;

async function ensureStoreDir(): Promise<void> {
  if (storeDirCreated) return;
  await mkdir(join(getNexusDir(), "sessions"), { recursive: true });
  storeDirCreated = true;
}

export function resetSessionStoreDirCache(): void {
  storeDirCreated = false;
}

export async function appendSessionRecord(record: SessionRecord): Promise<void> {
  await ensureStoreDir();
  const line = serializeJsonlLine(record) + "\n";
  await appendFile(getSessionStorePath(), line, "utf-8");
}

async function readAllRecords(): Promise<SessionRecord[]> {
  const storePath = getSessionStorePath();
  if (!existsSync(storePath)) return [];

  const records: SessionRecord[] = [];
  for await (const record of readJsonlFile<SessionRecord>(storePath)) {
    records.push(record);
  }
  return records;
}

function deriveCurrentState(records: SessionRecord[]): Map<string, SessionRecord> {
  const state = new Map<string, SessionRecord>();
  for (const record of records) {
    state.set(record.id, record);
  }
  return state;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  return state.get(sessionId) ?? null;
}

export async function listSessions(filters?: {
  project?: string;
  status?: SessionStatus | SessionStatus[];
  agent_type?: string;
  correlation_id?: string;
  parent_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<SessionRecord[]> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  let results = Array.from(state.values());

  if (filters?.project) {
    results = results.filter((r) => r.project === filters.project);
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    results = results.filter((r) => statuses.includes(r.status));
  }
  if (filters?.agent_type) {
    results = results.filter((r) => r.agent_type === filters.agent_type);
  }
  if (filters?.correlation_id) {
    results = results.filter((r) => r.correlation_id === filters.correlation_id);
  }
  if (filters?.parent_id) {
    results = results.filter((r) => r.parent_id === filters.parent_id);
  }
  if (filters?.from) {
    results = results.filter((r) => r.created_at >= filters.from!);
  }
  if (filters?.to) {
    results = results.filter((r) => r.created_at <= filters.to!);
  }

  results.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  return results.slice(offset, offset + limit);
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  return Array.from(state.values());
}
