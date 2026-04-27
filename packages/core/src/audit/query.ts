import { readdir, stat } from "node:fs/promises";
import { watchFile, unwatchFile } from "node:fs";
import { join } from "node:path";
import type { NexusEvent } from "@nexus/shared";
import { readJsonlFile } from "@nexus/shared";
import { getEventsDir, getEventFilePath } from "./emitter.js";

export interface EventQuery {
  project?: string;
  session_id?: string;
  correlation_id?: string;
  event_type?: string;
  agent_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const EVENT_FILE_PATTERN = /^events-(\d{4}-\d{2}-\d{2})\.jsonl$/;

function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(EVENT_FILE_PATTERN);
  return match ? match[1]! : null;
}

export async function getEventFiles(from?: string, to?: string): Promise<string[]> {
  const eventsDir = getEventsDir();
  let entries: string[];
  try {
    entries = await readdir(eventsDir);
  } catch {
    return [];
  }

  const fromDate = from ? from.slice(0, 10) : undefined;
  const toDate = to ? to.slice(0, 10) : undefined;

  const files: { path: string; date: string }[] = [];
  for (const entry of entries) {
    const date = parseDateFromFilename(entry);
    if (!date) continue;
    if (fromDate && date < fromDate) continue;
    if (toDate && date > toDate) continue;
    files.push({ path: join(eventsDir, entry), date });
  }

  files.sort((a, b) => b.date.localeCompare(a.date));
  return files.map((f) => f.path);
}

export function matchesFilters(event: NexusEvent, filters: EventQuery): boolean {
  if (filters.project && event.project !== filters.project) return false;
  if (filters.session_id && event.session_id !== filters.session_id) return false;
  if (filters.correlation_id && event.correlation_id !== filters.correlation_id) return false;
  if (filters.agent_id && event.agent_id !== filters.agent_id) return false;

  if (filters.event_type) {
    if (event.event_type !== filters.event_type &&
        !event.event_type.startsWith(filters.event_type + ".")) {
      return false;
    }
  }

  if (filters.from && event.timestamp < filters.from) return false;
  if (filters.to && event.timestamp > filters.to) return false;

  return true;
}

export async function query(filters: EventQuery = {}): Promise<NexusEvent[]> {
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  const files = await getEventFiles(filters.from, filters.to);

  const results: NexusEvent[] = [];
  let skipped = 0;

  for (const file of files) {
    const fileEvents: NexusEvent[] = [];
    for await (const event of readJsonlFile<NexusEvent>(file)) {
      if (matchesFilters(event, filters)) {
        fileEvents.push(event);
      }
    }

    fileEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    for (const event of fileEvents) {
      if (skipped < offset) {
        skipped++;
        continue;
      }
      results.push(event);
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export async function* tail(
  filters?: Partial<EventQuery>,
): AsyncIterable<NexusEvent> {
  const filePath = getEventFilePath();
  let lastSize = 0;

  try {
    const s = await stat(filePath);
    lastSize = s.size;
  } catch {
    lastSize = 0;
  }

  // Yield existing events that match
  try {
    for await (const event of readJsonlFile<NexusEvent>(filePath)) {
      if (!filters || matchesFilters(event, filters)) {
        yield event;
      }
    }
  } catch {
    // File might not exist yet
  }

  const { createReadStream } = await import("node:fs");
  const { createInterface } = await import("node:readline");
  const { parseJsonlLine } = await import("@nexus/shared");

  yield* new TailIterable(filePath, lastSize, filters, createReadStream, createInterface, parseJsonlLine);
}

class TailIterable {
  constructor(
    private filePath: string,
    private lastSize: number,
    private filters: Partial<EventQuery> | undefined,
    private createReadStream: typeof import("node:fs").createReadStream,
    private createInterface: typeof import("node:readline").createInterface,
    private parseJsonlLine: typeof import("@nexus/shared").parseJsonlLine,
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<NexusEvent> {
    while (true) {
      const newEvents = await this.readNewEvents();
      for (const event of newEvents) {
        yield event;
      }
      await this.waitForChange();
    }
  }

  private async readNewEvents(): Promise<NexusEvent[]> {
    let currentSize: number;
    try {
      const s = await stat(this.filePath);
      currentSize = s.size;
    } catch {
      return [];
    }

    if (currentSize <= this.lastSize) return [];

    const events: NexusEvent[] = [];
    const stream = this.createReadStream(this.filePath, {
      start: this.lastSize,
      encoding: "utf-8",
    });
    const rl = this.createInterface({ input: stream, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        const parsed = this.parseJsonlLine<NexusEvent>(line);
        if (parsed && (!this.filters || matchesFilters(parsed, this.filters))) {
          events.push(parsed);
        }
      }
    } finally {
      rl.close();
      stream.destroy();
    }

    this.lastSize = currentSize;
    return events;
  }

  private waitForChange(): Promise<void> {
    return new Promise((resolve) => {
      const listener = () => {
        unwatchFile(this.filePath, listener);
        resolve();
      };
      watchFile(this.filePath, { interval: 1000 }, listener);
    });
  }
}
