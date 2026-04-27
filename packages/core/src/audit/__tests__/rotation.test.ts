import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../emitter.js";
import { cleanupOldEvents } from "../rotation.js";

let tempDir: string;
let eventsDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-rotation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  eventsDir = join(tempDir, "events");
  mkdirSync(eventsDir, { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function createEventFile(date: string): void {
  writeFileSync(
    join(eventsDir, `events-${date}.jsonl`),
    '{"id":"test","event_type":"test"}\n',
    "utf-8",
  );
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

describe("cleanupOldEvents", () => {
  it("deletes files older than retention period", async () => {
    createEventFile(daysAgo(5));
    createEventFile(daysAgo(2));
    createEventFile(daysAgo(0));

    const result = await cleanupOldEvents({ retentionDays: 3 });

    expect(result.filesDeleted).toHaveLength(1);
    expect(result.filesDeleted[0]).toContain(daysAgo(5));
    expect(existsSync(join(eventsDir, `events-${daysAgo(5)}.jsonl`))).toBe(false);
    expect(existsSync(join(eventsDir, `events-${daysAgo(2)}.jsonl`))).toBe(true);
    expect(existsSync(join(eventsDir, `events-${daysAgo(0)}.jsonl`))).toBe(true);
  });

  it("keeps files within retention period", async () => {
    createEventFile(daysAgo(89));
    createEventFile(daysAgo(0));

    const result = await cleanupOldEvents({ retentionDays: 90 });

    expect(result.filesDeleted).toHaveLength(0);
    expect(result.oldestRetained).toBe(daysAgo(89));
  });

  it("reports oldest retained file", async () => {
    createEventFile(daysAgo(100));
    createEventFile(daysAgo(50));
    createEventFile(daysAgo(10));

    const result = await cleanupOldEvents({ retentionDays: 90 });

    expect(result.filesDeleted).toHaveLength(1);
    expect(result.oldestRetained).toBe(daysAgo(50));
  });

  it("handles empty events directory", async () => {
    const result = await cleanupOldEvents();
    expect(result.filesDeleted).toEqual([]);
    expect(result.filesSkipped).toEqual([]);
  });

  it("handles nonexistent events directory", async () => {
    setNexusDir(join(tempDir, "nonexistent"));
    const result = await cleanupOldEvents();
    expect(result.filesDeleted).toEqual([]);
  });

  it("ignores non-event files", async () => {
    createEventFile(daysAgo(100));
    writeFileSync(join(eventsDir, "random.txt"), "not an event file");

    const result = await cleanupOldEvents({ retentionDays: 90 });

    expect(result.filesDeleted).toHaveLength(1);
    expect(existsSync(join(eventsDir, "random.txt"))).toBe(true);
  });

  it("emits an audit.cleanup event after cleanup", async () => {
    createEventFile(daysAgo(100));

    await cleanupOldEvents({ retentionDays: 90 });

    // The cleanup event is written to today's file
    const todayFile = join(eventsDir, `events-${daysAgo(0)}.jsonl`);
    expect(existsSync(todayFile)).toBe(true);

    const { readFileSync: readFs } = await import("node:fs");
    const content = readFs(todayFile, "utf-8");
    const lines = content.trim().split("\n");
    const lastEvent = JSON.parse(lines[lines.length - 1]!);
    expect(lastEvent.event_type).toBe("audit.cleanup");
  });
});
