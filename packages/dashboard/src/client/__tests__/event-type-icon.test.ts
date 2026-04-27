import { describe, it, expect } from "vitest";
import { eventCategory, EVENT_CATEGORIES } from "../views/events/EventTypeIcon.js";

describe("eventCategory", () => {
  it("extracts category from dot-separated event type", () => {
    expect(eventCategory("session.started")).toBe("session");
    expect(eventCategory("worktree.created")).toBe("worktree");
    expect(eventCategory("audit.started")).toBe("audit");
  });

  it("returns full string if no dot", () => {
    expect(eventCategory("custom")).toBe("custom");
  });

  it("handles nested dots correctly", () => {
    expect(eventCategory("worktree.merge_failed")).toBe("worktree");
  });
});

describe("EVENT_CATEGORIES", () => {
  it("contains session, worktree, audit", () => {
    expect(EVENT_CATEGORIES).toContain("session");
    expect(EVENT_CATEGORIES).toContain("worktree");
    expect(EVENT_CATEGORIES).toContain("audit");
  });
});
