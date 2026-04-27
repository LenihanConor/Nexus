import { describe, it, expect } from "vitest";
import {
  applyEventFilters,
  eventFiltersToParams,
  eventParamsToFilters,
} from "../views/events/EventFilters.js";
import type { EventFilterValues } from "../views/events/EventFilters.js";
import type { NexusEvent } from "@nexus/shared";

function makeEvent(id: string, overrides: Partial<NexusEvent> = {}): NexusEvent {
  return {
    id,
    timestamp: "2026-04-27T10:00:00Z",
    event_type: "session.started",
    project: "C:/GitHub/Test",
    session_id: "s1",
    correlation_id: "corr-1",
    agent_id: null,
    user_id: "testuser",
    payload: { task_description: "Test task" },
    ...overrides,
  };
}

const emptyFilters: EventFilterValues = {
  event_type: null,
  session_id: null,
  correlation_id: null,
  from: null,
  to: null,
  search: "",
};

describe("applyEventFilters", () => {
  const events = [
    makeEvent("e1", { event_type: "session.started", session_id: "s1", timestamp: "2026-04-27T10:00:00Z" }),
    makeEvent("e2", { event_type: "session.ended", session_id: "s1", timestamp: "2026-04-27T11:00:00Z" }),
    makeEvent("e3", { event_type: "worktree.created", session_id: "s2", timestamp: "2026-04-27T12:00:00Z" }),
    makeEvent("e4", { event_type: "audit.started", session_id: null, timestamp: "2026-04-26T10:00:00Z" }),
  ];

  it("returns all events with empty filters", () => {
    expect(applyEventFilters(events, emptyFilters)).toHaveLength(4);
  });

  it("filters by exact event_type", () => {
    const result = applyEventFilters(events, { ...emptyFilters, event_type: "session.started" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e1");
  });

  it("filters by category event_type", () => {
    const result = applyEventFilters(events, { ...emptyFilters, event_type: "session" });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("filters by session_id", () => {
    const result = applyEventFilters(events, { ...emptyFilters, session_id: "s2" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e3");
  });

  it("filters by correlation_id", () => {
    const result = applyEventFilters(events, { ...emptyFilters, correlation_id: "corr-1" });
    expect(result).toHaveLength(4);
  });

  it("filters by from date", () => {
    const result = applyEventFilters(events, { ...emptyFilters, from: "2026-04-27T11:00:00Z" });
    expect(result).toHaveLength(2);
  });

  it("filters by to date", () => {
    const result = applyEventFilters(events, { ...emptyFilters, to: "2026-04-26T23:59:59Z" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e4");
  });

  it("filters by search text (matches event type)", () => {
    const result = applyEventFilters(events, { ...emptyFilters, search: "worktree" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e3");
  });

  it("combines multiple filters with AND logic", () => {
    const result = applyEventFilters(events, {
      event_type: "session",
      session_id: "s1",
      correlation_id: null,
      from: "2026-04-27T10:30:00Z",
      to: null,
      search: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e2");
  });

  it("returns empty when no events match", () => {
    expect(applyEventFilters(events, { ...emptyFilters, search: "nonexistent" })).toHaveLength(0);
  });

  it("handles empty events array", () => {
    expect(applyEventFilters([], { ...emptyFilters, event_type: "session" })).toEqual([]);
  });
});

describe("eventFiltersToParams / eventParamsToFilters roundtrip", () => {
  it("serializes and deserializes event_type", () => {
    const filters: EventFilterValues = { ...emptyFilters, event_type: "session.started" };
    const params = eventFiltersToParams(filters);
    expect(params.get("type")).toBe("session.started");
    const restored = eventParamsToFilters(params);
    expect(restored.event_type).toBe("session.started");
  });

  it("serializes and deserializes session_id", () => {
    const filters: EventFilterValues = { ...emptyFilters, session_id: "s123" };
    const params = eventFiltersToParams(filters);
    expect(params.get("session")).toBe("s123");
    const restored = eventParamsToFilters(params);
    expect(restored.session_id).toBe("s123");
  });

  it("serializes and deserializes correlation_id", () => {
    const filters: EventFilterValues = { ...emptyFilters, correlation_id: "corr-abc" };
    const params = eventFiltersToParams(filters);
    expect(params.get("correlation")).toBe("corr-abc");
    const restored = eventParamsToFilters(params);
    expect(restored.correlation_id).toBe("corr-abc");
  });

  it("serializes and deserializes date range", () => {
    const filters: EventFilterValues = {
      ...emptyFilters,
      from: "2026-04-25T00:00:00Z",
      to: "2026-04-27T23:59:59Z",
    };
    const params = eventFiltersToParams(filters);
    const restored = eventParamsToFilters(params);
    expect(restored.from).toBe("2026-04-25T00:00:00Z");
    expect(restored.to).toBe("2026-04-27T23:59:59Z");
  });

  it("serializes and deserializes search", () => {
    const filters: EventFilterValues = { ...emptyFilters, search: "worktree" };
    const params = eventFiltersToParams(filters);
    const restored = eventParamsToFilters(params);
    expect(restored.search).toBe("worktree");
  });

  it("omits empty/default values from params", () => {
    const params = eventFiltersToParams(emptyFilters);
    expect(params.toString()).toBe("");
  });

  it("deserializes empty params to defaults", () => {
    const restored = eventParamsToFilters(new URLSearchParams());
    expect(restored.event_type).toBeNull();
    expect(restored.session_id).toBeNull();
    expect(restored.correlation_id).toBeNull();
    expect(restored.from).toBeNull();
    expect(restored.to).toBeNull();
    expect(restored.search).toBe("");
  });
});
