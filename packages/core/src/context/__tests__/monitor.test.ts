import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { checkAndAlert } from "../monitor.js";
import { resetAlertState, sessionAlertState } from "../types.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-ctx-monitor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  // Clear all in-memory alert state between tests
  resetAlertState();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  resetAlertState();
});

function writeDefaultConfig(overrides?: Partial<{ warn_at_percent: number; critical_at_percent: number }>): void {
  const config = {
    context: {
      warn_at_percent: 80,
      critical_at_percent: 95,
      ...overrides,
    },
  };
  writeFileSync(join(tempDir, "config.json"), JSON.stringify(config));
}

describe("checkAndAlert", () => {
  it("does nothing when contextWindowPercent is undefined", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-1", "my-project", undefined);

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("does nothing when contextWindowPercent is 0", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-1", "my-project", 0);

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("does nothing when below warn threshold", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-1", "my-project", 50);

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("emits context.warn event and writes stderr when warn threshold crossed", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    // Use a short session ID to make slice(0,8) predictable
    const sessionId = "abcd1234efgh";
    await checkAndAlert(sessionId, "my-project", 82);

    // Check stderr output — slice(0,8) gives "abcd1234"
    const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const warnCall = stderrCalls.find((s) => s.includes("[nexus] Warning: Session"));
    expect(warnCall).toBeDefined();
    expect(warnCall).toContain("abcd1234");
    expect(warnCall).toContain("82%");
    expect(warnCall).toContain("warn threshold: 80%");

    // Check event was written
    const { readdirSync } = await import("node:fs");
    const eventsDir = join(tempDir, "events");
    const files = readdirSync(eventsDir);
    expect(files.length).toBeGreaterThan(0);
    const content = readFileSync(join(eventsDir, files[0] as string), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.event_type).toBe("context.warn");
    expect(event.payload.session_id).toBe(sessionId);
    expect(event.payload.context_window_percent).toBe(82);
    expect(event.payload.threshold).toBe(80);

    stderrSpy.mockRestore();
  });

  it("only emits warn once per session (dedup)", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-dedup", "my-project", 82);
    await checkAndAlert("session-dedup", "my-project", 84);
    await checkAndAlert("session-dedup", "my-project", 86);

    const warnCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes("[nexus] Warning: Session"));
    expect(warnCalls).toHaveLength(1);

    stderrSpy.mockRestore();
  });

  it("emits context.critical event and writes stderr when critical threshold crossed", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    // Use a session ID where slice(0,8) is predictable: "xyz78900"
    const sessionId = "xyz78900abcd";
    await checkAndAlert(sessionId, "my-project", 97);

    const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const critCall = stderrCalls.find((s) => s.includes("[nexus] Critical:"));
    expect(critCall).toBeDefined();
    expect(critCall).toContain("xyz78900");
    expect(critCall).toContain("97%");
    expect(critCall).toContain("consider compacting or restarting");

    stderrSpy.mockRestore();
  });

  it("only emits critical once per session (dedup)", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-crit-dedup", "my-project", 96);
    await checkAndAlert("session-crit-dedup", "my-project", 97);
    await checkAndAlert("session-crit-dedup", "my-project", 99);

    const critCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes("[nexus] Critical:"));
    expect(critCalls).toHaveLength(1);

    stderrSpy.mockRestore();
  });

  it("emits both warn and critical for the same session if both thresholds crossed in sequence", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    // First call crosses warn threshold
    await checkAndAlert("session-both", "my-project", 82);
    // Second call crosses critical threshold
    await checkAndAlert("session-both", "my-project", 97);

    const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const warnCalls = stderrCalls.filter((s) => s.includes("Warning:"));
    const critCalls = stderrCalls.filter((s) => s.includes("Critical:"));
    expect(warnCalls).toHaveLength(1);
    expect(critCalls).toHaveLength(1);

    stderrSpy.mockRestore();
  });

  it("does not emit warn when jumping straight to critical", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    // Jump directly to critical without hitting warn first
    await checkAndAlert("session-jump", "my-project", 96);

    const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const warnCalls = stderrCalls.filter((s) => s.includes("Warning:"));
    const critCalls = stderrCalls.filter((s) => s.includes("Critical:"));
    // warn is not emitted when level is critical (checkContextHealth returns critical, not warn)
    expect(warnCalls).toHaveLength(0);
    expect(critCalls).toHaveLength(1);

    stderrSpy.mockRestore();
  });

  it("alert state tracks warnEmitted correctly", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    const sessionId = "session-state-check";
    expect(sessionAlertState.has(sessionId)).toBe(false);

    await checkAndAlert(sessionId, "my-project", 82);

    expect(sessionAlertState.has(sessionId)).toBe(true);
    const state = sessionAlertState.get(sessionId)!;
    expect(state.warnEmitted).toBe(true);
    expect(state.criticalEmitted).toBe(false);

    stderrSpy.mockRestore();
  });

  it("alert state tracks criticalEmitted correctly", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    const sessionId = "session-crit-state";
    await checkAndAlert(sessionId, "my-project", 97);

    const state = sessionAlertState.get(sessionId)!;
    expect(state.criticalEmitted).toBe(true);

    stderrSpy.mockRestore();
  });

  it("different sessions get independent alert states", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-A", "proj", 82);
    await checkAndAlert("session-B", "proj", 82);

    const warnCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes("[nexus] Warning: Session"));
    expect(warnCalls).toHaveLength(2);

    stderrSpy.mockRestore();
  });
});

describe("resetAlertState", () => {
  it("clears state for a specific session", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-reset", "proj", 82);
    expect(sessionAlertState.has("session-reset")).toBe(true);

    resetAlertState("session-reset");
    expect(sessionAlertState.has("session-reset")).toBe(false);

    stderrSpy.mockRestore();
  });

  it("does not affect other sessions when resetting a specific session", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-keep", "proj", 82);
    await checkAndAlert("session-remove", "proj", 82);

    resetAlertState("session-remove");

    expect(sessionAlertState.has("session-keep")).toBe(true);
    expect(sessionAlertState.has("session-remove")).toBe(false);

    stderrSpy.mockRestore();
  });

  it("clears all state when called without args", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    await checkAndAlert("session-1", "proj", 82);
    await checkAndAlert("session-2", "proj", 82);
    await checkAndAlert("session-3", "proj", 96);

    expect(sessionAlertState.size).toBe(3);

    resetAlertState();

    expect(sessionAlertState.size).toBe(0);

    stderrSpy.mockRestore();
  });

  it("allows re-emission after reset", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    writeDefaultConfig();

    const sessionId = "session-re-emit";

    await checkAndAlert(sessionId, "proj", 82);
    let warnCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes("Warning:"));
    expect(warnCalls).toHaveLength(1);

    // After reset, the same session should be able to emit again
    resetAlertState(sessionId);
    await checkAndAlert(sessionId, "proj", 83);
    warnCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes("Warning:"));
    expect(warnCalls).toHaveLength(2);

    stderrSpy.mockRestore();
  });
});
