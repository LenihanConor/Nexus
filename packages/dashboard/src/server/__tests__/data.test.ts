import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DataCache, setNexusDir, deduplicateRecords, computeSummary } from "../data.js";
import type { DashboardData } from "../data.js";
import type { SessionRecord, WorktreeRecord } from "@nexus/shared";
import { serializeJsonlLine } from "@nexus/shared";

let tempDir: string;

function makeSession(id: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    project: "C:/GitHub/Test",
    agent_type: "claude-code",
    task_description: `Task ${id}`,
    status: "running",
    parent_id: null,
    correlation_id: id,
    agent_pid: null,
    user_id: "testuser",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ended_at: null,
    duration_ms: null,
    exit_code: null,
    snapshots: [],
    metadata: {},
    ...overrides,
  };
}

function makeWorktree(id: string, overrides: Partial<WorktreeRecord> = {}): WorktreeRecord {
  return {
    id,
    session_id: "sess-1",
    project: "C:/GitHub/Test",
    branch: `feature/${id}`,
    parent_branch: "main",
    path: `/tmp/wt-${id}`,
    scope: [],
    status: "active",
    created_at: new Date().toISOString(),
    merged_at: null,
    cleaned_at: null,
    merge_result: null,
    ...overrides,
  };
}

function makeEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    timestamp: new Date().toISOString(),
    event_type: "session.started",
    project: "C:/GitHub/Test",
    session_id: "sess-1",
    correlation_id: "corr-1",
    agent_id: null,
    user_id: "testuser",
    payload: {},
    ...overrides,
  };
}

function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-dashboard-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(tempDir, "sessions"), { recursive: true });
  mkdirSync(join(tempDir, "worktrees"), { recursive: true });
  mkdirSync(join(tempDir, "events"), { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("deduplicateRecords", () => {
  it("keeps last record per id", () => {
    const records = [
      { id: "a", status: "running" },
      { id: "b", status: "running" },
      { id: "a", status: "completed" },
    ];
    const result = deduplicateRecords(records);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "a")!.status).toBe("completed");
  });

  it("handles empty array", () => {
    expect(deduplicateRecords([])).toEqual([]);
  });
});

describe("computeSummary", () => {
  it("counts active sessions and worktrees", () => {
    const data: DashboardData = {
      events: [makeEvent("e1"), makeEvent("e2")],
      sessions: [
        makeSession("s1", { status: "running" }),
        makeSession("s2", { status: "completed" }),
        makeSession("s3", { status: "stale" }),
      ],
      worktrees: [
        makeWorktree("w1", { status: "active" }),
        makeWorktree("w2", { status: "conflict" }),
        makeWorktree("w3", { status: "cleaned" }),
      ],
      projects: [],
      lastUpdated: new Date().toISOString(),
    };

    const summary = computeSummary(data);
    expect(summary.activeSessions).toBe(1);
    expect(summary.activeWorktrees).toBe(1);
    expect(summary.eventsToday).toBe(2);
    expect(summary.staleSessions).toBe(1);
    expect(summary.conflictedWorktrees).toBe(1);
  });
});

describe("DataCache", () => {
  it("loads initial data from files", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1")) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2")) + "\n");

    const worktreesPath = join(tempDir, "worktrees", "worktrees.jsonl");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1")) + "\n");

    const eventsPath = join(tempDir, "events", `events-${todayDateStr()}.jsonl`);
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e1")) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData();
    expect(data.sessions).toHaveLength(2);
    expect(data.worktrees).toHaveLength(1);
    expect(data.events).toHaveLength(1);
    expect(data.projects).toContain("C:/GitHub/Test");
  });

  it("deduplicates sessions on load", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { status: "running" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { status: "completed" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]!.status).toBe("completed");
  });

  it("handles missing files gracefully", async () => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    setNexusDir(tempDir);

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData();
    expect(data.sessions).toEqual([]);
    expect(data.worktrees).toEqual([]);
    expect(data.events).toEqual([]);
  });

  it("filters by project", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { project: "A" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2", { project: "B" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const dataA = cache.getData({ project: "A" });
    expect(dataA.sessions).toHaveLength(1);
    expect(dataA.sessions[0]!.project).toBe("A");
  });

  it("polls and picks up new data via mtime change", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1")) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    expect(cache.getData().sessions).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 50));
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2")) + "\n");
    await cache.poll();

    expect(cache.getData().sessions).toHaveLength(2);
  });

  it("skips re-read when mtime unchanged", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1")) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    await cache.poll();
    expect(cache.getData().sessions).toHaveLength(1);
  });

  it("derives projects from all data sources", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { project: "A" })) + "\n");

    const worktreesPath = join(tempDir, "worktrees", "worktrees.jsonl");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1", { project: "B" })) + "\n");

    const eventsPath = join(tempDir, "events", `events-${todayDateStr()}.jsonl`);
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e1", { project: "C" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData();
    expect(data.projects).toEqual(["A", "B", "C"]);
  });

  it("getSummary filters by project", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { project: "A", status: "running" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2", { project: "B", status: "running" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const summary = cache.getSummary("A");
    expect(summary.activeSessions).toBe(1);
  });

  it("deduplicates worktrees on load", async () => {
    const worktreesPath = join(tempDir, "worktrees", "worktrees.jsonl");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1", { status: "active" })) + "\n");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1", { status: "merged" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData();
    expect(data.worktrees).toHaveLength(1);
    expect(data.worktrees[0]!.status).toBe("merged");
  });

  it("skips malformed JSONL lines", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1")) + "\n");
    appendFileSync(sessionsPath, "not valid json\n");
    appendFileSync(sessionsPath, "{broken\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2")) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    expect(cache.getData().sessions).toHaveLength(2);
  });

  it("polls worktrees and events alongside sessions", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    const worktreesPath = join(tempDir, "worktrees", "worktrees.jsonl");
    const eventsPath = join(tempDir, "events", `events-${todayDateStr()}.jsonl`);
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1")) + "\n");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1")) + "\n");
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e1")) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    await new Promise((r) => setTimeout(r, 50));
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w2")) + "\n");
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e2")) + "\n");
    await cache.poll();

    expect(cache.getData().worktrees).toHaveLength(2);
    expect(cache.getData().events).toHaveLength(2);
  });

  it("filters events by project", async () => {
    const eventsPath = join(tempDir, "events", `events-${todayDateStr()}.jsonl`);
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e1", { project: "A" })) + "\n");
    appendFileSync(eventsPath, serializeJsonlLine(makeEvent("e2", { project: "B" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData({ project: "A" });
    expect(data.events).toHaveLength(1);
  });

  it("filters worktrees by project", async () => {
    const worktreesPath = join(tempDir, "worktrees", "worktrees.jsonl");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w1", { project: "A" })) + "\n");
    appendFileSync(worktreesPath, serializeJsonlLine(makeWorktree("w2", { project: "B" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    const data = cache.getData({ project: "B" });
    expect(data.worktrees).toHaveLength(1);
    expect(data.worktrees[0]!.project).toBe("B");
  });

  it("startPolling and stopPolling manage timer", async () => {
    const cache = new DataCache();
    await cache.loadInitial();

    cache.startPolling(100_000);
    // Calling startPolling again should not create a second timer
    cache.startPolling(100_000);
    cache.stopPolling();
    // Double stop should be safe
    cache.stopPolling();
  });

  it("projects list stays sorted", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { project: "Zebra" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2", { project: "Alpha" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s3", { project: "Middle" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    expect(cache.getData().projects).toEqual(["Alpha", "Middle", "Zebra"]);
  });

  it("empty project strings are excluded from projects list", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s1", { project: "" })) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine(makeSession("s2", { project: "Real" })) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();

    expect(cache.getData().projects).toEqual(["Real"]);
  });
});

describe("computeSummary edge cases", () => {
  it("returns all zeros for empty data", () => {
    const data: DashboardData = {
      events: [],
      sessions: [],
      worktrees: [],
      projects: [],
      lastUpdated: new Date().toISOString(),
    };
    const summary = computeSummary(data);
    expect(summary.activeSessions).toBe(0);
    expect(summary.activeWorktrees).toBe(0);
    expect(summary.eventsToday).toBe(0);
    expect(summary.staleSessions).toBe(0);
    expect(summary.conflictedWorktrees).toBe(0);
  });

  it("counts multiple statuses correctly", () => {
    const data: DashboardData = {
      events: [makeEvent("e1"), makeEvent("e2"), makeEvent("e3")],
      sessions: [
        makeSession("s1", { status: "running" }),
        makeSession("s2", { status: "running" }),
        makeSession("s3", { status: "stale" }),
        makeSession("s4", { status: "stale" }),
        makeSession("s5", { status: "stale" }),
        makeSession("s6", { status: "completed" }),
      ],
      worktrees: [
        makeWorktree("w1", { status: "active" }),
        makeWorktree("w2", { status: "active" }),
        makeWorktree("w3", { status: "conflict" }),
        makeWorktree("w4", { status: "merged" }),
      ],
      projects: [],
      lastUpdated: new Date().toISOString(),
    };
    const summary = computeSummary(data);
    expect(summary.activeSessions).toBe(2);
    expect(summary.activeWorktrees).toBe(2);
    expect(summary.eventsToday).toBe(3);
    expect(summary.staleSessions).toBe(3);
    expect(summary.conflictedWorktrees).toBe(1);
  });
});

describe("DataCache date range queries", () => {
  it("getDataWithDateRange reads historical event files", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(
      join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine(makeEvent("e1", { timestamp: "2026-04-25T10:00:00Z" })) + "\n",
    );
    appendFileSync(
      join(eventsDir, "events-2026-04-26.jsonl"),
      serializeJsonlLine(makeEvent("e2", { timestamp: "2026-04-26T10:00:00Z" })) + "\n",
    );
    appendFileSync(
      join(eventsDir, "events-2026-04-27.jsonl"),
      serializeJsonlLine(makeEvent("e3", { timestamp: "2026-04-27T10:00:00Z" })) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsFrom: "2026-04-25T00:00:00Z",
      eventsTo: "2026-04-27T23:59:59Z",
    });
    expect(data.events).toHaveLength(3);
  });

  it("getDataWithDateRange filters by from date", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(
      join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine(makeEvent("e1", { timestamp: "2026-04-25T10:00:00Z" })) + "\n",
    );
    appendFileSync(
      join(eventsDir, "events-2026-04-26.jsonl"),
      serializeJsonlLine(makeEvent("e2", { timestamp: "2026-04-26T10:00:00Z" })) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsFrom: "2026-04-26T00:00:00Z",
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.id).toBe("e2");
  });

  it("getDataWithDateRange filters by to date", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(
      join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine(makeEvent("e1", { timestamp: "2026-04-25T10:00:00Z" })) + "\n",
    );
    appendFileSync(
      join(eventsDir, "events-2026-04-26.jsonl"),
      serializeJsonlLine(makeEvent("e2", { timestamp: "2026-04-26T10:00:00Z" })) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsTo: "2026-04-25T23:59:59Z",
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.id).toBe("e1");
  });

  it("getDataWithDateRange combines date range with project filter", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(
      join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine(makeEvent("e1", { timestamp: "2026-04-25T10:00:00Z", project: "A" })) + "\n" +
      serializeJsonlLine(makeEvent("e2", { timestamp: "2026-04-25T11:00:00Z", project: "B" })) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsFrom: "2026-04-25T00:00:00Z",
      eventsTo: "2026-04-25T23:59:59Z",
      project: "A",
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.project).toBe("A");
  });

  it("getDataWithDateRange returns empty for non-existent date range", async () => {
    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsFrom: "2020-01-01T00:00:00Z",
      eventsTo: "2020-01-02T00:00:00Z",
    });
    expect(data.events).toEqual([]);
  });

  it("getDataWithDateRange ignores non-event files in events directory", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(join(eventsDir, "not-an-event.txt"), "garbage\n");
    appendFileSync(join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine(makeEvent("e1", { timestamp: "2026-04-25T10:00:00Z" })) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();

    const data = await cache.getDataWithDateRange({
      eventsFrom: "2026-04-25T00:00:00Z",
      eventsTo: "2026-04-25T23:59:59Z",
    });
    expect(data.events).toHaveLength(1);
  });
});
