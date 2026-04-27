import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  emit,
  emitEvent,
  getEventFilePath,
  getEventsDir,
  setNexusDir,
} from "../emitter.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-emitter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("getEventFilePath", () => {
  it("returns a date-stamped JSONL path under the events dir", () => {
    const result = getEventFilePath(new Date("2026-04-26T15:00:00Z"));
    expect(result).toBe(join(tempDir, "events", "events-2026-04-26.jsonl"));
  });

  it("uses UTC date (not local)", () => {
    const lateUtc = new Date("2026-04-26T23:30:00Z");
    const result = getEventFilePath(lateUtc);
    expect(result).toContain("events-2026-04-26.jsonl");
  });
});

describe("emit", () => {
  it("creates the events directory and writes a JSONL line", async () => {
    const event = await emit({
      event_type: "audit.started",
      project: "C:/GitHub/Test",
      session_id: null,
      correlation_id: "corr-1",
      agent_id: null,
      user_id: "testuser",
      payload: { version: "0.1.0" },
    });

    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.event_type).toBe("audit.started");

    expect(existsSync(getEventsDir())).toBe(true);

    const filePath = getEventFilePath();
    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.event_type).toBe("audit.started");
    expect(parsed.id).toBe(event.id);
  });

  it("appends multiple events to the same file", async () => {
    await emit({
      event_type: "session.started",
      project: "C:/GitHub/Test",
      session_id: "s1",
      correlation_id: "c1",
      agent_id: "a1",
      user_id: "testuser",
      payload: { parent_id: null, agent_type: "claude", task_description: "test" },
    });

    await emit({
      event_type: "session.ended",
      project: "C:/GitHub/Test",
      session_id: "s1",
      correlation_id: "c1",
      agent_id: "a1",
      user_id: "testuser",
      payload: { status: "completed", exit_code: 0, duration_ms: 1000 },
    });

    const content = readFileSync(getEventFilePath(), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("never throws on write failure", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    setNexusDir(join(tempDir, "readonly"));
    mkdirSync(join(tempDir, "readonly", "events"), { recursive: true });
    // Point to a file (not a directory) so appendFile fails
    const fakeDir = join(tempDir, "readonly", "events");
    rmSync(fakeDir, { recursive: true, force: true });
    writeFileSync(join(tempDir, "readonly", "events"), "not a dir");

    const event = await emit({
      event_type: "test.event",
      project: "test",
      session_id: null,
      correlation_id: "c1",
      agent_id: null,
      user_id: "testuser",
      payload: {},
    });

    expect(event.event_type).toBe("test.event");
    expect(event.id).toBeTruthy();
    expect(stderrSpy).toHaveBeenCalled();

    stderrSpy.mockRestore();
    setNexusDir(tempDir);
  });

  it("assigns a UUID v4 id", async () => {
    const event = await emit({
      event_type: "audit.started",
      project: "test",
      session_id: null,
      correlation_id: "c1",
      agent_id: null,
      user_id: "testuser",
      payload: { version: "0.1.0" },
    });

    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("assigns an ISO 8601 timestamp", async () => {
    const before = new Date().toISOString();
    const event = await emit({
      event_type: "audit.started",
      project: "test",
      session_id: null,
      correlation_id: "c1",
      agent_id: null,
      user_id: "testuser",
      payload: { version: "0.1.0" },
    });
    const after = new Date().toISOString();

    expect(event.timestamp >= before).toBe(true);
    expect(event.timestamp <= after).toBe(true);
  });
});

describe("emitEvent", () => {
  it("auto-fills id, timestamp, and user_id", async () => {
    const event = await emitEvent(
      "session.started",
      "sess-1",
      { parent_id: null, agent_type: "claude", task_description: "test task" },
      { project: "C:/GitHub/Test" },
    );

    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.user_id).toBeTruthy();
    expect(event.session_id).toBe("sess-1");
    expect(event.correlation_id).toBe("sess-1");
    expect(event.agent_id).toBeNull();
  });

  it("generates correlation_id from UUID when no session_id", async () => {
    const event = await emitEvent("audit.started", null, { version: "0.1.0" });

    expect(event.correlation_id).toBeTruthy();
    expect(event.correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("uses provided correlationId and agentId", async () => {
    const event = await emitEvent(
      "session.started",
      "sess-1",
      { parent_id: null, agent_type: "claude", task_description: "test" },
      { project: "test", correlationId: "custom-corr", agentId: "agent-1" },
    );

    expect(event.correlation_id).toBe("custom-corr");
    expect(event.agent_id).toBe("agent-1");
  });
});
