import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { recordUsage, checkBudget, resetBudget, resetBudgetAlertState } from "../lifecycle.js";
import { resetStoreDirCache } from "../store.js";
import { saveBudgetConfig } from "../config.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-budget-lifecycle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
  resetBudgetAlertState();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  resetStoreDirCache();
  resetBudgetAlertState();
  vi.restoreAllMocks();
});

function readEvents(): Array<Record<string, unknown>> {
  const eventsDir = join(tempDir, "events");
  try {
    const files = readdirSync(eventsDir);
    const events: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const lines = readFileSync(join(eventsDir, file as string), "utf-8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        events.push(JSON.parse(line) as Record<string, unknown>);
      }
    }
    return events;
  } catch {
    return [];
  }
}

const baseInput = {
  session_id: "sess-abc",
  project: "C:/Projects/test",
  agent_type: "claude-code",
  model: "claude-sonnet-4-6",
  input_tokens: 1000,
  output_tokens: 500,
  cache_read_tokens: 0,
  cache_creation_tokens: 0,
};

describe("recordUsage", () => {
  it("creates and stores a UsageRecord", async () => {
    const { record } = await recordUsage(baseInput);

    expect(record.id).toBeTruthy();
    expect(record.session_id).toBe("sess-abc");
    expect(record.project).toBe("C:/Projects/test");
    expect(record.model).toBe("claude-sonnet-4-6");
    expect(record.input_tokens).toBe(1000);
    expect(record.output_tokens).toBe(500);
    expect(record.timestamp).toBeTruthy();
    expect(record.estimated_cost_usd).toBeGreaterThan(0);
  });

  it("calculates estimated cost correctly", async () => {
    const { record } = await recordUsage({
      ...baseInput,
      input_tokens: 1000,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
    // claude-sonnet-4-6: $0.003/1K input = $0.003
    expect(record.estimated_cost_usd).toBeCloseTo(0.003, 6);
  });

  it("emits budget.usage_recorded event", async () => {
    await recordUsage(baseInput);

    const events = readEvents();
    const usageEvent = events.find((e) => e["event_type"] === "budget.usage_recorded");
    expect(usageEvent).toBeDefined();
    expect((usageEvent!["payload"] as Record<string, unknown>)["session_id"]).toBe("sess-abc");
    expect((usageEvent!["payload"] as Record<string, unknown>)["project"]).toBe("C:/Projects/test");
  });

  it("returns status ok when no caps configured", async () => {
    const { status } = await recordUsage(baseInput);
    expect(status.status).toBe("ok");
    expect(status.soft_cap_usd).toBeNull();
    expect(status.hard_cap_usd).toBeNull();
  });

  it("emits budget.threshold_reached when soft cap crossed", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: 0.001, hard_cap_usd: null, period: "all-time" },
      projects: {},
    });

    const { status } = await recordUsage(baseInput);
    expect(status.status).toBe("soft_cap_reached");

    const events = readEvents();
    const thresholdEvent = events.find((e) => e["event_type"] === "budget.threshold_reached");
    expect(thresholdEvent).toBeDefined();
    expect((thresholdEvent!["payload"] as Record<string, unknown>)["session_id"]).toBe("sess-abc");
  });

  it("emits budget.cap_exceeded when hard cap crossed", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 0.001, period: "all-time" },
      projects: {},
    });

    const { status } = await recordUsage(baseInput);
    expect(status.status).toBe("hard_cap_exceeded");

    const events = readEvents();
    const capEvent = events.find((e) => e["event_type"] === "budget.cap_exceeded");
    expect(capEvent).toBeDefined();
    expect((capEvent!["payload"] as Record<string, unknown>)["session_id"]).toBe("sess-abc");
  });

  it("threshold event only emitted once per session (soft cap dedup)", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: 0.001, hard_cap_usd: null, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    await recordUsage(baseInput); // same session, should not re-emit
    await recordUsage(baseInput);

    const events = readEvents();
    const thresholdEvents = events.filter((e) => e["event_type"] === "budget.threshold_reached");
    expect(thresholdEvents).toHaveLength(1);
  });

  it("hard cap event only emitted once per session (hard cap dedup)", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 0.001, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    await recordUsage(baseInput);
    await recordUsage(baseInput);

    const events = readEvents();
    const capEvents = events.filter((e) => e["event_type"] === "budget.cap_exceeded");
    expect(capEvents).toHaveLength(1);
  });

  it("different sessions each get their own threshold warning", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: 0.001, hard_cap_usd: null, period: "all-time" },
      projects: {},
    });

    await recordUsage({ ...baseInput, session_id: "sess-1" });
    await recordUsage({ ...baseInput, session_id: "sess-2" });

    const events = readEvents();
    const thresholdEvents = events.filter((e) => e["event_type"] === "budget.threshold_reached");
    expect(thresholdEvents).toHaveLength(2);
  });

  it("does not emit threshold_reached when status is hard_cap_exceeded", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: 0.001, hard_cap_usd: 0.001, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);

    const events = readEvents();
    // Should emit cap_exceeded but NOT threshold_reached (since it went straight to hard cap)
    const capEvents = events.filter((e) => e["event_type"] === "budget.cap_exceeded");
    const thresholdEvents = events.filter((e) => e["event_type"] === "budget.threshold_reached");
    expect(capEvents).toHaveLength(1);
    expect(thresholdEvents).toHaveLength(0);
  });
});

describe("checkBudget", () => {
  it("returns ok status with null caps when no config", async () => {
    const status = await checkBudget("C:/Projects/test");
    expect(status.status).toBe("ok");
    expect(status.soft_cap_usd).toBeNull();
    expect(status.hard_cap_usd).toBeNull();
    expect(status.remaining_usd).toBeNull();
    expect(status.spent_usd).toBe(0);
  });

  it("returns correct spent_usd after recording usage", async () => {
    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.spent_usd).toBeGreaterThan(0);
  });

  it("returns soft_cap_reached when spend exceeds soft cap", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: 0.001, hard_cap_usd: null, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.status).toBe("soft_cap_reached");
  });

  it("returns hard_cap_exceeded when spend exceeds hard cap", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 0.001, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.status).toBe("hard_cap_exceeded");
  });

  it("uses project-specific cap over global cap", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 100, period: "all-time" },
      projects: {
        "C:/Projects/test": { soft_cap_usd: 0.001, hard_cap_usd: null, period: "all-time" },
      },
    });

    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.status).toBe("soft_cap_reached");
  });

  it("remaining_usd is calculated relative to hard_cap", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 10, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.remaining_usd).not.toBeNull();
    expect(status.remaining_usd!).toBeCloseTo(10 - status.spent_usd, 4);
  });

  it("remaining_usd is 0 (not negative) when hard cap exceeded", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: 0.001, period: "all-time" },
      projects: {},
    });

    await recordUsage(baseInput);
    const status = await checkBudget("C:/Projects/test");
    expect(status.remaining_usd).toBe(0);
  });

  it("period reflects cap configuration", async () => {
    await saveBudgetConfig({
      global: { soft_cap_usd: null, hard_cap_usd: null, period: "weekly" },
      projects: {},
    });

    const status = await checkBudget("C:/Projects/test");
    expect(status.period).toBe("weekly");
  });
});

describe("resetBudget", () => {
  it("emits budget.reset event", async () => {
    await resetBudget("C:/Projects/test");

    const events = readEvents();
    const resetEvent = events.find((e) => e["event_type"] === "budget.reset");
    expect(resetEvent).toBeDefined();
    expect((resetEvent!["payload"] as Record<string, unknown>)["project"]).toBe("C:/Projects/test");
  });

  it("emits budget.reset with null project for global reset", async () => {
    await resetBudget();

    const events = readEvents();
    const resetEvent = events.find((e) => e["event_type"] === "budget.reset");
    expect(resetEvent).toBeDefined();
    expect((resetEvent!["payload"] as Record<string, unknown>)["project"]).toBeNull();
  });

  it("does NOT delete usage records", async () => {
    await recordUsage(baseInput);
    const { listUsageRecords } = await import("../store.js");
    const before = await listUsageRecords();
    expect(before).toHaveLength(1);

    await resetBudget("C:/Projects/test");

    const after = await listUsageRecords();
    expect(after).toHaveLength(1);
  });

  it("reset event includes reset_at timestamp", async () => {
    const before = new Date().toISOString();
    await resetBudget("C:/Projects/test");
    const after = new Date().toISOString();

    const events = readEvents();
    const resetEvent = events.find((e) => e["event_type"] === "budget.reset");
    const resetAt = (resetEvent!["payload"] as Record<string, unknown>)["reset_at"] as string;
    expect(resetAt >= before).toBe(true);
    expect(resetAt <= after).toBe(true);
  });
});
