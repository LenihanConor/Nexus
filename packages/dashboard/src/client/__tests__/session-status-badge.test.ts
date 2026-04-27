import { describe, it, expect } from "vitest";
import { statusColor, statusSymbol } from "../views/sessions/SessionStatusBadge.js";

describe("statusSymbol", () => {
  it("returns correct symbol for each status", () => {
    expect(statusSymbol("running")).toBe("●");
    expect(statusSymbol("paused")).toBe("◐");
    expect(statusSymbol("completed")).toBe("○");
    expect(statusSymbol("failed")).toBe("✕");
    expect(statusSymbol("interrupted")).toBe("⚠");
    expect(statusSymbol("stale")).toBe("◌");
  });

  it("returns ? for unknown status", () => {
    expect(statusSymbol("unknown")).toBe("?");
  });
});

describe("statusColor", () => {
  it("returns classes for known statuses", () => {
    expect(statusColor("running")).toContain("green");
    expect(statusColor("paused")).toContain("yellow");
    expect(statusColor("completed")).toContain("gray");
    expect(statusColor("failed")).toContain("red");
    expect(statusColor("interrupted")).toContain("orange");
    expect(statusColor("stale")).toContain("orange");
  });

  it("returns default for unknown status", () => {
    expect(statusColor("unknown")).toContain("gray");
  });
});
