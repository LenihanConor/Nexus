import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { UsageRecord } from "@nexus/shared";
import { readJsonlFile, serializeJsonlLine } from "@nexus/shared";
import { getNexusDir } from "../audit/emitter.js";

export function getUsageStorePath(): string {
  return join(getNexusDir(), "usage", "usage.jsonl");
}

let storeDirCreated = false;

async function ensureStoreDir(): Promise<void> {
  if (storeDirCreated) return;
  await mkdir(join(getNexusDir(), "usage"), { recursive: true });
  storeDirCreated = true;
}

export function resetStoreDirCache(): void {
  storeDirCreated = false;
}

export async function appendUsageRecord(record: UsageRecord): Promise<void> {
  await ensureStoreDir();
  const line = serializeJsonlLine(record) + "\n";
  await appendFile(getUsageStorePath(), line, "utf-8");
}

async function readAllRecords(): Promise<UsageRecord[]> {
  const storePath = getUsageStorePath();
  if (!existsSync(storePath)) return [];

  const records: UsageRecord[] = [];
  for await (const record of readJsonlFile<UsageRecord>(storePath)) {
    records.push(record);
  }
  return records;
}

function deriveCurrentState(records: UsageRecord[]): Map<string, UsageRecord> {
  const state = new Map<string, UsageRecord>();
  for (const record of records) {
    state.set(record.id, record);
  }
  return state;
}

export async function listUsageRecords(filters?: {
  project?: string;
  session_id?: string;
  from?: string;
  to?: string;
}): Promise<UsageRecord[]> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  let results = Array.from(state.values());

  if (filters?.project) {
    results = results.filter((r) => r.project === filters.project);
  }
  if (filters?.session_id) {
    results = results.filter((r) => r.session_id === filters.session_id);
  }
  if (filters?.from) {
    results = results.filter((r) => r.timestamp >= filters.from!);
  }
  if (filters?.to) {
    results = results.filter((r) => r.timestamp <= filters.to!);
  }

  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return results;
}
