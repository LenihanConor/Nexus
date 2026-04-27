import { describe, it, expect, vi, afterEach } from "vitest";
import { getPeriodStart, computeSpend, evaluateBudget } from "../checker.js";
import type { UsageRecord, BudgetCap } from "@nexus/shared";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Helper to build a minimal UsageRecord
function makeRecord(overrides: Partial<UsageRecord> & { project: string; timestamp: string }): UsageRecord {
  return {
    id: Math.random().toString(36).slice(2),
    session_id: "sess-default",
    agent_type: "claude-code",
    model: "claude-sonnet-4-6",
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    estimated_cost_usd: 0.001,
    ...overrides,
  };
}

describe("getPeriodStart", () => {
  it("returns 2000-01-01 for all-time", () => {
    const result = getPeriodStart("all-time");
    expect(result).toBe("2000-01-01T00:00:00.000Z");
  });

  it("returns start of today (00:00:00 local) for daily", () => {
    const result = getPeriodStart("daily");
    const parsed = new Date(result);
    const now = new Date();
    // Must be the same local date
    expect(parsed.getFullYear()).toBe(now.getFullYear());
    expect(parsed.getMonth()).toBe(now.getMonth());
    expect(parsed.getDate()).toBe(now.getDate());
    // Must be midnight in local time
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
  });

  it("returns ISO string (not just a date string) for daily", () => {
    const result = getPeriodStart("daily");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns start of this Monday for weekly", () => {
    const result = getPeriodStart("weekly");
    const parsed = new Date(result);
    // Monday is day 1
    expect(parsed.getDay()).toBe(1);
    // Must be midnight local
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });

  it("weekly: date is at most 6 days ago", () => {
    const result = getPeriodStart("weekly");
    const parsed = new Date(result);
    const now = new Date();
    const diffDays = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(7);
    expect(diffDays).toBeGreaterThanOrEqual(0);
  });

  it("returns first of this month for monthly", () => {
    const result = getPeriodStart("monthly");
    const parsed = new Date(result);
    const now = new Date();
    expect(parsed.getFullYear()).toBe(now.getFullYear());
    expect(parsed.getMonth()).toBe(now.getMonth());
    expect(parsed.getDate()).toBe(1);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });
});

describe("computeSpend", () => {
  it("returns zero summary when no records", () => {
    const summary = computeSpend([], "C:/Projects/foo", "all-time");
    expect(summary.total_input_tokens).toBe(0);
    expect(summary.total_output_tokens).toBe(0);
    expect(summary.total_cost_usd).toBe(0);
    expect(summary.session_count).toBe(0);
  });

  it("sums tokens and cost across matching records", () => {
    const records = [
      makeRecord({ project: "C:/Projects/foo", timestamp: "2000-06-01T12:00:00.000Z", input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.001 }),
      makeRecord({ project: "C:/Projects/foo", timestamp: "2000-06-02T12:00:00.000Z", input_tokens: 200, output_tokens: 100, estimated_cost_usd: 0.002 }),
    ];

    const summary = computeSpend(records, "C:/Projects/foo", "all-time");
    expect(summary.total_input_tokens).toBe(300);
    expect(summary.total_output_tokens).toBe(150);
    expect(summary.total_cost_usd).toBeCloseTo(0.003, 6);
  });

  it("filters by project — excludes other projects", () => {
    const records = [
      makeRecord({ project: "C:/Projects/foo", timestamp: "2000-06-01T12:00:00.000Z", estimated_cost_usd: 0.001 }),
      makeRecord({ project: "C:/Projects/bar", timestamp: "2000-06-01T12:00:00.000Z", estimated_cost_usd: 0.005 }),
    ];

    const summary = computeSpend(records, "C:/Projects/foo", "all-time");
    expect(summary.total_cost_usd).toBeCloseTo(0.001, 6);
  });

  it("counts unique sessions correctly", () => {
    const records = [
      makeRecord({ project: "proj", timestamp: "2000-06-01T12:00:00.000Z", session_id: "s1", estimated_cost_usd: 0.001 }),
      makeRecord({ project: "proj", timestamp: "2000-06-01T13:00:00.000Z", session_id: "s1", estimated_cost_usd: 0.001 }),
      makeRecord({ project: "proj", timestamp: "2000-06-01T14:00:00.000Z", session_id: "s2", estimated_cost_usd: 0.001 }),
    ];

    const summary = computeSpend(records, "proj", "all-time");
    expect(summary.session_count).toBe(2);
  });

  it("respects period boundaries — excludes records before period start", () => {
    // Use a fixed "today" that is 2026-04-27 by testing all-time vs daily
    const records = [
      makeRecord({ project: "proj", timestamp: "2020-01-01T12:00:00.000Z", estimated_cost_usd: 0.010 }),
      makeRecord({ project: "proj", timestamp: new Date().toISOString(), estimated_cost_usd: 0.001 }),
    ];

    const allTime = computeSpend(records, "proj", "all-time");
    expect(allTime.total_cost_usd).toBeCloseTo(0.011, 6);

    const daily = computeSpend(records, "proj", "daily");
    // Only the current-day record should be counted
    expect(daily.total_cost_usd).toBeCloseTo(0.001, 6);
  });

  it("respects resetTimestamp — excludes records before it", () => {
    const records = [
      makeRecord({ project: "proj", timestamp: "2000-06-01T10:00:00.000Z", estimated_cost_usd: 0.010 }),
      makeRecord({ project: "proj", timestamp: "2000-06-01T12:00:00.000Z", estimated_cost_usd: 0.001 }),
    ];

    // Reset at 11:00 — only the 12:00 record counts
    const summary = computeSpend(records, "proj", "all-time", "2000-06-01T11:00:00.000Z");
    expect(summary.total_cost_usd).toBeCloseTo(0.001, 6);
  });

  it("resetTimestamp older than all records has no effect", () => {
    const records = [
      makeRecord({ project: "proj", timestamp: "2000-06-01T12:00:00.000Z", estimated_cost_usd: 0.001 }),
    ];
    const summary = computeSpend(records, "proj", "all-time", "1999-01-01T00:00:00.000Z");
    expect(summary.total_cost_usd).toBeCloseTo(0.001, 6);
  });

  it("period_start and period_end are ISO strings", () => {
    const summary = computeSpend([], "proj", "daily");
    expect(summary.period_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(summary.period_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("monthly period excludes records from previous month", () => {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);

    const records = [
      makeRecord({ project: "proj", timestamp: prevMonth.toISOString(), estimated_cost_usd: 0.050 }),
      makeRecord({ project: "proj", timestamp: new Date().toISOString(), estimated_cost_usd: 0.002 }),
    ];

    const summary = computeSpend(records, "proj", "monthly");
    expect(summary.total_cost_usd).toBeCloseTo(0.002, 6);
  });
});

describe("evaluateBudget", () => {
  const makeCap = (soft: number | null, hard: number | null): BudgetCap => ({
    soft_cap_usd: soft,
    hard_cap_usd: hard,
    period: "daily",
  });

  it("returns ok when no caps set", () => {
    expect(evaluateBudget(100, makeCap(null, null))).toBe("ok");
  });

  it("returns ok when below soft cap", () => {
    expect(evaluateBudget(3, makeCap(5, 10))).toBe("ok");
  });

  it("returns soft_cap_reached when spend equals soft cap", () => {
    expect(evaluateBudget(5, makeCap(5, 10))).toBe("soft_cap_reached");
  });

  it("returns soft_cap_reached when spend exceeds soft cap but below hard cap", () => {
    expect(evaluateBudget(7, makeCap(5, 10))).toBe("soft_cap_reached");
  });

  it("returns hard_cap_exceeded when spend equals hard cap", () => {
    expect(evaluateBudget(10, makeCap(5, 10))).toBe("hard_cap_exceeded");
  });

  it("returns hard_cap_exceeded when spend exceeds hard cap", () => {
    expect(evaluateBudget(15, makeCap(5, 10))).toBe("hard_cap_exceeded");
  });

  it("returns hard_cap_exceeded even without soft cap", () => {
    expect(evaluateBudget(15, makeCap(null, 10))).toBe("hard_cap_exceeded");
  });

  it("returns soft_cap_reached even without hard cap", () => {
    expect(evaluateBudget(6, makeCap(5, null))).toBe("soft_cap_reached");
  });

  it("returns ok when only soft cap set and spend is below it", () => {
    expect(evaluateBudget(3, makeCap(5, null))).toBe("ok");
  });

  it("returns ok when only hard cap set and spend is below it", () => {
    expect(evaluateBudget(3, makeCap(null, 10))).toBe("ok");
  });

  it("returns ok for zero spend with caps", () => {
    expect(evaluateBudget(0, makeCap(5, 10))).toBe("ok");
  });
});
