import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serializeJsonlLine } from "@nexus/shared";
import type { NexusEvent } from "@nexus/shared";
import { setNexusDir } from "../emitter.js";
import { query, getEventFiles, matchesFilters } from "../query.js";

let tempDir: string;
let eventsDir: string;

function makeEvent(overrides: Partial<NexusEvent> = {}): NexusEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    timestamp: "2026-04-26T12:00:00.000Z",
    event_type: "session.started",
    project: "C:/GitHub/TestProject",
    session_id: "sess-1",
    correlation_id: "corr-1",
    agent_id: "agent-1",
    user_id: "testuser",
    payload: { parent_id: null, agent_type: "claude", task_description: "test" },
    ...overrides,
  };
}

function writeEventsToFile(filename: string, events: NexusEvent[]): void {
  const content = events.map((e) => serializeJsonlLine(e)).join("\n") + "\n";
  writeFileSync(join(eventsDir, filename), content, "utf-8");
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-query-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  eventsDir = join(tempDir, "events");
  mkdirSync(eventsDir, { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("matchesFilters", () => {
  it("matches when no filters are set", () => {
    expect(matchesFilters(makeEvent(), {})).toBe(true);
  });

  it("filters by project", () => {
    const event = makeEvent({ project: "C:/GitHub/Foo" });
    expect(matchesFilters(event, { project: "C:/GitHub/Foo" })).toBe(true);
    expect(matchesFilters(event, { project: "C:/GitHub/Bar" })).toBe(false);
  });

  it("filters by session_id", () => {
    const event = makeEvent({ session_id: "sess-42" });
    expect(matchesFilters(event, { session_id: "sess-42" })).toBe(true);
    expect(matchesFilters(event, { session_id: "sess-99" })).toBe(false);
  });

  it("filters by event_type exact match", () => {
    const event = makeEvent({ event_type: "session.started" });
    expect(matchesFilters(event, { event_type: "session.started" })).toBe(true);
    expect(matchesFilters(event, { event_type: "session.ended" })).toBe(false);
  });

  it("filters by event_type prefix match", () => {
    const event = makeEvent({ event_type: "session.started" });
    expect(matchesFilters(event, { event_type: "session" })).toBe(true);
    expect(matchesFilters(event, { event_type: "worktree" })).toBe(false);
  });

  it("filters by time range", () => {
    const event = makeEvent({ timestamp: "2026-04-26T12:00:00.000Z" });
    expect(matchesFilters(event, { from: "2026-04-26T00:00:00.000Z" })).toBe(true);
    expect(matchesFilters(event, { from: "2026-04-27T00:00:00.000Z" })).toBe(false);
    expect(matchesFilters(event, { to: "2026-04-27T00:00:00.000Z" })).toBe(true);
    expect(matchesFilters(event, { to: "2026-04-25T00:00:00.000Z" })).toBe(false);
  });
});

describe("getEventFiles", () => {
  it("lists files sorted newest first", async () => {
    writeEventsToFile("events-2026-04-24.jsonl", [makeEvent()]);
    writeEventsToFile("events-2026-04-25.jsonl", [makeEvent()]);
    writeEventsToFile("events-2026-04-26.jsonl", [makeEvent()]);

    const files = await getEventFiles();
    expect(files).toHaveLength(3);
    expect(files[0]).toContain("2026-04-26");
    expect(files[2]).toContain("2026-04-24");
  });

  it("filters by date range", async () => {
    writeEventsToFile("events-2026-04-24.jsonl", [makeEvent()]);
    writeEventsToFile("events-2026-04-25.jsonl", [makeEvent()]);
    writeEventsToFile("events-2026-04-26.jsonl", [makeEvent()]);

    const files = await getEventFiles("2026-04-25", "2026-04-25");
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("2026-04-25");
  });

  it("returns empty array when events directory does not exist", async () => {
    setNexusDir(join(tempDir, "nonexistent"));
    const files = await getEventFiles();
    expect(files).toEqual([]);
  });

  it("ignores non-event files", async () => {
    writeEventsToFile("events-2026-04-26.jsonl", [makeEvent()]);
    writeFileSync(join(eventsDir, "random.txt"), "not an event file");

    const files = await getEventFiles();
    expect(files).toHaveLength(1);
  });
});

describe("query", () => {
  it("returns events matching filters across files", async () => {
    writeEventsToFile("events-2026-04-25.jsonl", [
      makeEvent({ event_type: "session.started", timestamp: "2026-04-25T10:00:00Z" }),
      makeEvent({ event_type: "worktree.created", timestamp: "2026-04-25T11:00:00Z" }),
    ]);
    writeEventsToFile("events-2026-04-26.jsonl", [
      makeEvent({ event_type: "session.ended", timestamp: "2026-04-26T09:00:00Z" }),
    ]);

    const results = await query({ event_type: "session" });
    expect(results).toHaveLength(2);
    expect(results[0]!.event_type).toBe("session.ended");
    expect(results[1]!.event_type).toBe("session.started");
  });

  it("respects limit", async () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ timestamp: `2026-04-26T${String(i).padStart(2, "0")}:00:00Z` }),
    );
    writeEventsToFile("events-2026-04-26.jsonl", events);

    const results = await query({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("respects offset", async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        timestamp: `2026-04-26T${String(i).padStart(2, "0")}:00:00Z`,
      }),
    );
    writeEventsToFile("events-2026-04-26.jsonl", events);

    const all = await query({ limit: 100 });
    const offset2 = await query({ limit: 100, offset: 2 });
    expect(offset2).toHaveLength(3);
    expect(offset2[0]!.id).toBe(all[2]!.id);
  });

  it("skips malformed lines", async () => {
    const content = [
      serializeJsonlLine(makeEvent({ id: "good-1" })),
      "THIS IS NOT JSON",
      serializeJsonlLine(makeEvent({ id: "good-2" })),
    ].join("\n") + "\n";
    writeFileSync(join(eventsDir, "events-2026-04-26.jsonl"), content, "utf-8");

    const results = await query();
    expect(results).toHaveLength(2);
  });

  it("returns newest events first", async () => {
    writeEventsToFile("events-2026-04-26.jsonl", [
      makeEvent({ id: "early", timestamp: "2026-04-26T08:00:00Z" }),
      makeEvent({ id: "late", timestamp: "2026-04-26T16:00:00Z" }),
    ]);

    const results = await query();
    expect(results[0]!.id).toBe("late");
    expect(results[1]!.id).toBe("early");
  });

  it("returns empty array when no events match", async () => {
    writeEventsToFile("events-2026-04-26.jsonl", [
      makeEvent({ project: "C:/GitHub/Foo" }),
    ]);

    const results = await query({ project: "C:/GitHub/Bar" });
    expect(results).toEqual([]);
  });
});
