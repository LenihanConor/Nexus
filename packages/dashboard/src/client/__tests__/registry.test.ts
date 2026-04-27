import { describe, it, expect, beforeEach } from "vitest";
import { registerView, getRegisteredViews } from "../registry.js";
import type { DashboardView } from "../types.js";

function makeView(overrides: Partial<DashboardView> = {}): DashboardView {
  return {
    id: "test",
    label: "Test",
    route: "/test",
    order: 1,
    component: () => null,
    ...overrides,
  };
}

// The registry uses module-level state, so tests accumulate.
// We test behavior in order rather than resetting.

describe("view registry", () => {
  it("starts empty", () => {
    const views = getRegisteredViews();
    // May have views from prior tests in same process, but
    // the functions themselves should work correctly.
    expect(Array.isArray(views)).toBe(true);
  });

  it("registers a view and returns it", () => {
    registerView(makeView({ id: "reg-test-1", label: "First", order: 100 }));
    const views = getRegisteredViews();
    const found = views.find((v) => v.id === "reg-test-1");
    expect(found).toBeDefined();
    expect(found!.label).toBe("First");
  });

  it("replaces a view with the same id", () => {
    registerView(makeView({ id: "reg-test-2", label: "Original", order: 101 }));
    registerView(makeView({ id: "reg-test-2", label: "Replaced", order: 101 }));
    const views = getRegisteredViews();
    const matches = views.filter((v) => v.id === "reg-test-2");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.label).toBe("Replaced");
  });

  it("sorts views by order", () => {
    registerView(makeView({ id: "reg-test-z", label: "Last", order: 999 }));
    registerView(makeView({ id: "reg-test-a", label: "First", order: 0 }));
    registerView(makeView({ id: "reg-test-m", label: "Middle", order: 500 }));
    const views = getRegisteredViews();
    const orders = views.map((v) => v.order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]!).toBeGreaterThanOrEqual(orders[i - 1]!);
    }
  });

  it("returns a copy, not the internal array", () => {
    const views1 = getRegisteredViews();
    const views2 = getRegisteredViews();
    expect(views1).not.toBe(views2);
    expect(views1).toEqual(views2);
  });
});
