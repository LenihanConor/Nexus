import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorktreeRecord, WorktreeStatus } from "@nexus/shared";
import { readJsonlFile, serializeJsonlLine } from "@nexus/shared";
import { getNexusDir } from "../audit/emitter.js";

export function getWorktreeStorePath(): string {
  return join(getNexusDir(), "worktrees", "worktrees.jsonl");
}

let storeDirCreated = false;

async function ensureStoreDir(): Promise<void> {
  if (storeDirCreated) return;
  await mkdir(join(getNexusDir(), "worktrees"), { recursive: true });
  storeDirCreated = true;
}

export function resetStoreDirCache(): void {
  storeDirCreated = false;
}

export async function appendWorktreeRecord(record: WorktreeRecord): Promise<void> {
  await ensureStoreDir();
  const line = serializeJsonlLine(record) + "\n";
  await appendFile(getWorktreeStorePath(), line, "utf-8");
}

async function readAllRecords(): Promise<WorktreeRecord[]> {
  const storePath = getWorktreeStorePath();
  if (!existsSync(storePath)) return [];

  const records: WorktreeRecord[] = [];
  for await (const record of readJsonlFile<WorktreeRecord>(storePath)) {
    records.push(record);
  }
  return records;
}

function deriveCurrentState(records: WorktreeRecord[]): Map<string, WorktreeRecord> {
  const state = new Map<string, WorktreeRecord>();
  for (const record of records) {
    state.set(record.id, record);
  }
  return state;
}

export async function getWorktree(worktreeId: string): Promise<WorktreeRecord | null> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  return state.get(worktreeId) ?? null;
}

export async function listWorktrees(filters?: {
  project?: string;
  session_id?: string;
  status?: WorktreeStatus | WorktreeStatus[];
}): Promise<WorktreeRecord[]> {
  const records = await readAllRecords();
  const state = deriveCurrentState(records);
  let results = Array.from(state.values());

  if (filters?.project) {
    results = results.filter((r) => r.project === filters.project);
  }
  if (filters?.session_id) {
    results = results.filter((r) => r.session_id === filters.session_id);
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    results = results.filter((r) => statuses.includes(r.status));
  }

  return results;
}
