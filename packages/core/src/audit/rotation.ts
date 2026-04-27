import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getEventsDir } from "./emitter.js";
import { emitEvent } from "./emitter.js";

export interface RetentionConfig {
  retentionDays?: number;
  cleanupIntervalMs?: number;
}

export interface CleanupResult {
  filesDeleted: string[];
  filesSkipped: string[];
  oldestRetained: string;
}

const EVENT_FILE_PATTERN = /^events-(\d{4}-\d{2}-\d{2})\.jsonl$/;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getCutoffDate(retentionDays: number): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cutoff.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function cleanupOldEvents(
  config?: RetentionConfig,
): Promise<CleanupResult> {
  const retentionDays = config?.retentionDays ?? 90;
  const cutoffDate = getCutoffDate(retentionDays);
  const eventsDir = getEventsDir();

  const result: CleanupResult = {
    filesDeleted: [],
    filesSkipped: [],
    oldestRetained: "",
  };

  let entries: string[];
  try {
    entries = await readdir(eventsDir);
  } catch {
    return result;
  }

  const eventFiles: { name: string; date: string }[] = [];
  for (const entry of entries) {
    const match = entry.match(EVENT_FILE_PATTERN);
    if (match) {
      eventFiles.push({ name: entry, date: match[1]! });
    }
  }

  eventFiles.sort((a, b) => a.date.localeCompare(b.date));

  for (const file of eventFiles) {
    if (file.date < cutoffDate) {
      try {
        await unlink(join(eventsDir, file.name));
        result.filesDeleted.push(file.name);
      } catch {
        result.filesSkipped.push(file.name);
      }
    } else {
      if (!result.oldestRetained) {
        result.oldestRetained = file.date;
      }
    }
  }

  if (!result.oldestRetained && eventFiles.length > 0) {
    const last = eventFiles[eventFiles.length - 1]!;
    result.oldestRetained = last.date;
  }

  try {
    await emitEvent("audit.cleanup", null, {
      files_deleted: result.filesDeleted,
      files_skipped: result.filesSkipped,
      oldest_retained: result.oldestRetained,
    });
  } catch {
    // Cleanup event emission should never block
  }

  return result;
}

export function startCleanupSchedule(config?: RetentionConfig): void {
  stopCleanupSchedule();
  const intervalMs = config?.cleanupIntervalMs ?? 6 * 60 * 60 * 1000;
  cleanupTimer = setInterval(() => {
    cleanupOldEvents(config).catch(() => {});
  }, intervalMs);
  cleanupTimer.unref();
}

export function stopCleanupSchedule(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
