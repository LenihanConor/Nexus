import { describe, it, expect, vi, afterEach } from "vitest";
import { estimateCost, MODEL_PRICING } from "../pricing.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MODEL_PRICING", () => {
  it("contains expected models", () => {
    expect(MODEL_PRICING["claude-opus-4-7"]).toBeDefined();
    expect(MODEL_PRICING["claude-sonnet-4-6"]).toBeDefined();
    expect(MODEL_PRICING["claude-haiku-4-5"]).toBeDefined();
    expect(MODEL_PRICING["gpt-4o"]).toBeDefined();
    expect(MODEL_PRICING["gpt-3.5-turbo"]).toBeDefined();
  });
});

describe("estimateCost", () => {
  it("returns 0 for zero tokens on known model", () => {
    const cost = estimateCost("claude-sonnet-4-6", 0, 0, 0, 0);
    expect(cost).toBe(0);
  });

  it("calculates correct cost for claude-sonnet-4-6 input tokens", () => {
    // 1000 input tokens at $0.003/1K = $0.003
    const cost = estimateCost("claude-sonnet-4-6", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.003, 6);
  });

  it("calculates correct cost for claude-sonnet-4-6 output tokens", () => {
    // 1000 output tokens at $0.015/1K = $0.015
    const cost = estimateCost("claude-sonnet-4-6", 0, 1000, 0, 0);
    expect(cost).toBeCloseTo(0.015, 6);
  });

  it("calculates correct cost for claude-sonnet-4-6 cache read tokens", () => {
    // 1000 cache read tokens at $0.0003/1K = $0.0003
    const cost = estimateCost("claude-sonnet-4-6", 0, 0, 1000, 0);
    expect(cost).toBeCloseTo(0.0003, 6);
  });

  it("calculates correct cost for claude-sonnet-4-6 cache creation tokens", () => {
    // 1000 cache creation tokens at $0.00375/1K = $0.00375
    const cost = estimateCost("claude-sonnet-4-6", 0, 0, 0, 1000);
    expect(cost).toBeCloseTo(0.00375, 6);
  });

  it("calculates combined cost for all token types", () => {
    // Input: 2000 * 0.003/1000 = 0.006
    // Output: 500 * 0.015/1000 = 0.0075
    // Cache read: 1000 * 0.0003/1000 = 0.0003
    // Cache creation: 1000 * 0.00375/1000 = 0.00375
    const expected = 0.006 + 0.0075 + 0.0003 + 0.00375;
    const cost = estimateCost("claude-sonnet-4-6", 2000, 500, 1000, 1000);
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("calculates correct cost for claude-opus-4-7", () => {
    // 1000 input tokens at $0.015/1K = $0.015
    const cost = estimateCost("claude-opus-4-7", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.015, 6);
  });

  it("calculates correct cost for claude-haiku-4-5", () => {
    // 1000 input tokens at $0.0008/1K = $0.0008
    const cost = estimateCost("claude-haiku-4-5", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.0008, 6);
  });

  it("calculates correct cost for gpt-4o", () => {
    // 1000 input tokens at $0.005/1K = $0.005
    const cost = estimateCost("gpt-4o", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.005, 6);
  });

  it("calculates correct cost for gpt-3.5-turbo", () => {
    // 1000 output tokens at $0.0015/1K = $0.0015
    const cost = estimateCost("gpt-3.5-turbo", 0, 1000, 0, 0);
    expect(cost).toBeCloseTo(0.0015, 6);
  });

  it("returns 0 and warns for unknown model", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cost = estimateCost("unknown-model-xyz", 1000, 500, 0, 0);
    expect(cost).toBe(0);
    expect(stderrSpy).toHaveBeenCalledOnce();
    const msg = String(stderrSpy.mock.calls[0]![0]);
    expect(msg).toContain("unknown-model-xyz");
    expect(msg).toContain("$0");
  });

  it("does NOT warn for known model", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    estimateCost("claude-sonnet-4-6", 100, 100, 0, 0);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("prefix matching: claude-sonnet-4-6-20250514 matches claude-sonnet-4-6", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cost = estimateCost("claude-sonnet-4-6-20250514", 1000, 0, 0, 0);
    // Should match sonnet pricing: $0.003/1K input
    expect(cost).toBeCloseTo(0.003, 6);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("prefix matching: claude-haiku-4-5-beta matches claude-haiku-4-5", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cost = estimateCost("claude-haiku-4-5-beta", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.0008, 6);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("prefix matching: claude-opus-4-7-latest matches claude-opus-4-7", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cost = estimateCost("claude-opus-4-7-latest", 1000, 0, 0, 0);
    expect(cost).toBeCloseTo(0.015, 6);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("handles large token counts correctly", () => {
    // 1M input tokens for claude-sonnet-4-6: 1000000 * 0.003 / 1000 = $3
    const cost = estimateCost("claude-sonnet-4-6", 1_000_000, 0, 0, 0);
    expect(cost).toBeCloseTo(3.0, 4);
  });

  it("gpt-4o cache creation is 0", () => {
    // gpt-4o has cache_creation: 0.0
    const cost = estimateCost("gpt-4o", 0, 0, 0, 1000);
    expect(cost).toBe(0);
  });

  it("gpt-3.5-turbo cache tokens are 0", () => {
    const cost = estimateCost("gpt-3.5-turbo", 0, 0, 1000, 1000);
    expect(cost).toBe(0);
  });
});
