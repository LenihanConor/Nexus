import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PendingApproval, ResolvedApproval } from "@nexus/shared";
import { getNexusDir } from "../audit/emitter.js";

let storeDirCreated = false;

export function getApprovalsDir(): string {
  return join(getNexusDir(), "approvals");
}

export function getPendingPath(): string {
  return join(getApprovalsDir(), "pending.json");
}

export function getResolutionsPath(): string {
  return join(getApprovalsDir(), "resolutions.json");
}

export function resetStoreDirCache(): void {
  storeDirCreated = false;
}

async function ensureStoreDir(): Promise<void> {
  if (storeDirCreated) return;
  await mkdir(getApprovalsDir(), { recursive: true });
  storeDirCreated = true;
}

export async function readPending(): Promise<PendingApproval[]> {
  const path = getPendingPath();
  if (!existsSync(path)) return [];
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as PendingApproval[];
  } catch {
    return [];
  }
}

export async function writePending(pending: PendingApproval[]): Promise<void> {
  await ensureStoreDir();
  await writeFile(getPendingPath(), JSON.stringify(pending, null, 2) + "\n", "utf-8");
}

export async function addPending(entry: PendingApproval): Promise<void> {
  const pending = await readPending();
  pending.push(entry);
  await writePending(pending);
}

export async function resolvePending(
  id: string,
  resolution: ResolvedApproval,
): Promise<PendingApproval | null> {
  const pending = await readPending();
  const index = pending.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const entry = pending[index]!;
  pending.splice(index, 1);
  await writePending(pending);
  void resolution; // resolution is written separately via writeResolution
  return entry;
}

export async function listPending(): Promise<PendingApproval[]> {
  return readPending();
}

export async function cleanStalePending(olderThanMs = 3_600_000): Promise<number> {
  const pending = await readPending();
  const cutoff = Date.now() - olderThanMs;
  const fresh = pending.filter((p) => new Date(p.requested_at).getTime() >= cutoff);
  const removed = pending.length - fresh.length;
  if (removed > 0) {
    await writePending(fresh);
  }
  return removed;
}

// --- Resolution store ---

async function readAllResolutions(): Promise<Record<string, ResolvedApproval>> {
  const path = getResolutionsPath();
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as Record<string, ResolvedApproval>;
  } catch {
    return {};
  }
}

async function writeAllResolutions(
  resolutions: Record<string, ResolvedApproval>,
): Promise<void> {
  await ensureStoreDir();
  await writeFile(
    getResolutionsPath(),
    JSON.stringify(resolutions, null, 2) + "\n",
    "utf-8",
  );
}

export async function writeResolution(
  id: string,
  resolution: ResolvedApproval,
): Promise<void> {
  const resolutions = await readAllResolutions();
  resolutions[id] = resolution;
  await writeAllResolutions(resolutions);
}

export async function readResolution(
  id: string,
): Promise<ResolvedApproval | null> {
  const resolutions = await readAllResolutions();
  return resolutions[id] ?? null;
}

export async function clearResolution(id: string): Promise<void> {
  const resolutions = await readAllResolutions();
  if (id in resolutions) {
    delete resolutions[id];
    await writeAllResolutions(resolutions);
  }
}
