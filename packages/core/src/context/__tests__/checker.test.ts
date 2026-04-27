import { describe, it, expect } from "vitest";
import { checkContextHealth } from "../checker.js";
import type { ContextHealthConfig } from "@nexus/shared";

const DEFAULT_CONFIG: ContextHealthConfig = {
  warn_at_percent: 80,
  critical_at_percent: 95,
};

describe("checkContextHealth", () => {
  it("returns ok when below warn threshold", () => {
    const result = checkContextHealth(50, DEFAULT_CONFIG);
    expect(result.level).toBe("ok");
    expect(result.context_window_percent).toBe(50);
    expect(result.threshold_crossed).toBeNull();
  });

  it("returns ok at 0%", () => {
    const result = checkContextHealth(0, DEFAULT_CONFIG);
    expect(result.level).toBe("ok");
    expect(result.threshold_crossed).toBeNull();
  });

  it("returns ok just below warn threshold", () => {
    const result = checkContextHealth(79, DEFAULT_CONFIG);
    expect(result.level).toBe("ok");
    expect(result.threshold_crossed).toBeNull();
  });

  it("returns warn when exactly at warn threshold", () => {
    const result = checkContextHealth(80, DEFAULT_CONFIG);
    expect(result.level).toBe("warn");
    expect(result.context_window_percent).toBe(80);
    expect(result.threshold_crossed).toBe(80);
  });

  it("returns warn when between warn and critical", () => {
    const result = checkContextHealth(88, DEFAULT_CONFIG);
    expect(result.level).toBe("warn");
    expect(result.context_window_percent).toBe(88);
    expect(result.threshold_crossed).toBe(80);
  });

  it("returns warn just below critical threshold", () => {
    const result = checkContextHealth(94, DEFAULT_CONFIG);
    expect(result.level).toBe("warn");
    expect(result.threshold_crossed).toBe(80);
  });

  it("returns critical when exactly at critical threshold", () => {
    const result = checkContextHealth(95, DEFAULT_CONFIG);
    expect(result.level).toBe("critical");
    expect(result.context_window_percent).toBe(95);
    expect(result.threshold_crossed).toBe(95);
  });

  it("returns critical when above critical threshold", () => {
    const result = checkContextHealth(99, DEFAULT_CONFIG);
    expect(result.level).toBe("critical");
    expect(result.context_window_percent).toBe(99);
    expect(result.threshold_crossed).toBe(95);
  });

  it("returns critical at 100%", () => {
    const result = checkContextHealth(100, DEFAULT_CONFIG);
    expect(result.level).toBe("critical");
    expect(result.threshold_crossed).toBe(95);
  });

  it("threshold_crossed is null when ok", () => {
    const result = checkContextHealth(10, DEFAULT_CONFIG);
    expect(result.threshold_crossed).toBeNull();
  });

  it("threshold_crossed equals the warn threshold that was crossed", () => {
    const result = checkContextHealth(82, DEFAULT_CONFIG);
    expect(result.threshold_crossed).toBe(80);
  });

  it("threshold_crossed equals the critical threshold that was crossed", () => {
    const result = checkContextHealth(97, DEFAULT_CONFIG);
    expect(result.threshold_crossed).toBe(95);
  });

  it("works with custom thresholds (50/90)", () => {
    const config: ContextHealthConfig = { warn_at_percent: 50, critical_at_percent: 90 };

    const ok = checkContextHealth(49, config);
    expect(ok.level).toBe("ok");

    const warn = checkContextHealth(50, config);
    expect(warn.level).toBe("warn");
    expect(warn.threshold_crossed).toBe(50);

    const critical = checkContextHealth(90, config);
    expect(critical.level).toBe("critical");
    expect(critical.threshold_crossed).toBe(90);
  });

  it("works with custom thresholds — between warn and critical", () => {
    const config: ContextHealthConfig = { warn_at_percent: 60, critical_at_percent: 85 };
    const result = checkContextHealth(75, config);
    expect(result.level).toBe("warn");
    expect(result.threshold_crossed).toBe(60);
  });

  it("returns the exact percent passed in as context_window_percent", () => {
    const result = checkContextHealth(73.5, DEFAULT_CONFIG);
    expect(result.context_window_percent).toBe(73.5);
  });
});
