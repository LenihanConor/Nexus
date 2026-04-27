import { describe, it, expect } from "vitest";
import { worktreeStatusSymbol, worktreeStatusClasses } from "../views/worktrees/WorktreeStatusBadge.js";

describe("worktreeStatusSymbol", () => {
  it("returns correct symbol for each status", () => {
    expect(worktreeStatusSymbol("active")).toBe("●");
    expect(worktreeStatusSymbol("completed")).toBe("◐");
    expect(worktreeStatusSymbol("merged")).toBe("○");
    expect(worktreeStatusSymbol("conflict")).toBe("✕");
    expect(worktreeStatusSymbol("stale")).toBe("◌");
    expect(worktreeStatusSymbol("cleaned")).toBe("—");
  });

  it("returns ? for unknown status", () => {
    expect(worktreeStatusSymbol("unknown")).toBe("?");
  });
});

describe("worktreeStatusClasses", () => {
  it("returns classes for known statuses", () => {
    expect(worktreeStatusClasses("active")).toContain("green");
    expect(worktreeStatusClasses("conflict")).toContain("red");
    expect(worktreeStatusClasses("stale")).toContain("orange");
    expect(worktreeStatusClasses("merged")).toContain("gray");
  });

  it("returns default for unknown status", () => {
    expect(worktreeStatusClasses("unknown")).toContain("gray");
  });
});
