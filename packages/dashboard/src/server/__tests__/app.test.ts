import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../app.js";
import { DataCache, setNexusDir } from "../data.js";
import { serializeJsonlLine } from "@nexus/shared";

let tempDir: string;

function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-app-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(tempDir, "sessions"), { recursive: true });
  mkdirSync(join(tempDir, "worktrees"), { recursive: true });
  mkdirSync(join(tempDir, "events"), { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Hono API routes", () => {
  it("GET /api/data returns DashboardData JSON", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s1",
      project: "TestProject",
      agent_type: "claude",
      task_description: "Test",
      status: "running",
      parent_id: null,
      correlation_id: "s1",
      agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      ended_at: null,
      duration_ms: null,
      exit_code: null,
      snapshots: [],
      metadata: {},
    }) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/data");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.projects).toContain("TestProject");
    expect(body.lastUpdated).toBeDefined();
  });

  it("GET /api/data filters by project", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s1", project: "A", agent_type: "claude", task_description: "t1",
      status: "running", parent_id: null, correlation_id: "s1", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s2", project: "B", agent_type: "claude", task_description: "t2",
      status: "running", parent_id: null, correlation_id: "s2", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/data?project=A");
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].project).toBe("A");
  });

  it("GET /api/summary returns counts", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s1", project: "A", agent_type: "claude", task_description: "t",
      status: "running", parent_id: null, correlation_id: "s1", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");

    const eventsPath = join(tempDir, "events", `events-${todayDateStr()}.jsonl`);
    appendFileSync(eventsPath, serializeJsonlLine({
      id: "e1", timestamp: new Date().toISOString(), event_type: "session.started",
      project: "A", session_id: "s1", correlation_id: "s1", agent_id: null,
      user_id: "test", payload: {},
    }) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/summary");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeSessions).toBe(1);
    expect(body.eventsToday).toBe(1);
  });

  it("GET / returns fallback text when no build exists", async () => {
    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Dashboard not built");
  });

  it("GET /api/data with eventsFrom/eventsTo reads historical files", async () => {
    const eventsDir = join(tempDir, "events");
    appendFileSync(join(eventsDir, "events-2026-04-25.jsonl"),
      serializeJsonlLine({
        id: "e1", timestamp: "2026-04-25T12:00:00Z", event_type: "session.started",
        project: "A", session_id: "s1", correlation_id: "s1", agent_id: null,
        user_id: "test", payload: {},
      }) + "\n",
    );

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/data?eventsFrom=2026-04-25T00:00:00Z&eventsTo=2026-04-25T23:59:59Z");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].id).toBe("e1");
  });

  it("GET /api/summary with project filter returns filtered counts", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s1", project: "A", agent_type: "claude", task_description: "t",
      status: "running", parent_id: null, correlation_id: "s1", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s2", project: "B", agent_type: "claude", task_description: "t2",
      status: "running", parent_id: null, correlation_id: "s2", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/summary?project=A");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeSessions).toBe(1);
  });

  it("GET /api/data returns all projects even when filtered", async () => {
    const sessionsPath = join(tempDir, "sessions", "sessions.jsonl");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s1", project: "A", agent_type: "claude", task_description: "t",
      status: "running", parent_id: null, correlation_id: "s1", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");
    appendFileSync(sessionsPath, serializeJsonlLine({
      id: "s2", project: "B", agent_type: "claude", task_description: "t2",
      status: "running", parent_id: null, correlation_id: "s2", agent_pid: null, user_id: "test",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null, duration_ms: null,
      exit_code: null, snapshots: [], metadata: {},
    }) + "\n");

    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/api/data?project=A");
    const body = await res.json();
    // Projects list should still contain both projects (for the filter dropdown)
    expect(body.projects).toContain("A");
    expect(body.projects).toContain("B");
  });

  it("GET /assets/nonexistent returns 404", async () => {
    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    const res = await app.request("/assets/nonexistent.js");
    expect(res.status).toBe(404);
  });

  it("SPA fallback serves index.html for unknown routes", async () => {
    const cache = new DataCache();
    await cache.loadInitial();
    const app = createApp(cache);

    // Without a built frontend, any non-API route should return the fallback
    const res = await app.request("/sessions/some-id");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Dashboard not built");
  });
});
