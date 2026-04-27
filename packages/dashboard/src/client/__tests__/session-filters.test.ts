import { describe, it, expect } from "vitest";
import { applyFilters, filtersToParams, paramsToFilters } from "../views/sessions/SessionFilters.js";
import type { SessionFilterValues } from "../views/sessions/SessionFilters.js";
import type { SessionRecord } from "@nexus/shared";

function makeSession(id: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    project: "C:/GitHub/Test",
    agent_type: "claude-code",
    task_description: `Task ${id}`,
    status: "running",
    parent_id: null,
    correlation_id: id,
    agent_pid: null,
    user_id: "testuser",
    created_at: "2026-04-27T10:00:00Z",
    updated_at: "2026-04-27T10:00:00Z",
    ended_at: null,
    duration_ms: null,
    exit_code: null,
    snapshots: [],
    metadata: {},
    ...overrides,
  };
}

const emptyFilters: SessionFilterValues = {
  status: [],
  agent_type: null,
  from: null,
  to: null,
  search: "",
};

describe("applyFilters", () => {
  const sessions = [
    makeSession("s1", { status: "running", agent_type: "claude-code", created_at: "2026-04-27T10:00:00Z", task_description: "Add auth" }),
    makeSession("s2", { status: "completed", agent_type: "aider", created_at: "2026-04-26T10:00:00Z", task_description: "Fix tests" }),
    makeSession("s3", { status: "failed", agent_type: "claude-code", created_at: "2026-04-25T10:00:00Z", task_description: "Update deps" }),
    makeSession("s4", { status: "stale", agent_type: "cursor", created_at: "2026-04-24T10:00:00Z", task_description: "Refactor API" }),
  ];

  it("returns all sessions with empty filters", () => {
    expect(applyFilters(sessions, emptyFilters)).toHaveLength(4);
  });

  it("filters by single status", () => {
    const result = applyFilters(sessions, { ...emptyFilters, status: ["running"] });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s1");
  });

  it("filters by multiple statuses", () => {
    const result = applyFilters(sessions, { ...emptyFilters, status: ["running", "failed"] });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("filters by agent_type", () => {
    const result = applyFilters(sessions, { ...emptyFilters, agent_type: "aider" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s2");
  });

  it("filters by from date", () => {
    const result = applyFilters(sessions, { ...emptyFilters, from: "2026-04-26T00:00:00Z" });
    expect(result).toHaveLength(2);
  });

  it("filters by to date", () => {
    const result = applyFilters(sessions, { ...emptyFilters, to: "2026-04-25T23:59:59Z" });
    expect(result).toHaveLength(2);
  });

  it("filters by search text (case insensitive)", () => {
    const result = applyFilters(sessions, { ...emptyFilters, search: "auth" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s1");
  });

  it("combines multiple filters with AND logic", () => {
    const result = applyFilters(sessions, {
      status: ["running", "completed"],
      agent_type: "claude-code",
      from: null,
      to: null,
      search: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s1");
  });

  it("returns empty array when no sessions match", () => {
    const result = applyFilters(sessions, { ...emptyFilters, search: "nonexistent" });
    expect(result).toHaveLength(0);
  });

  it("handles empty sessions array", () => {
    expect(applyFilters([], { ...emptyFilters, status: ["running"] })).toEqual([]);
  });
});

describe("filtersToParams / paramsToFilters roundtrip", () => {
  it("serializes and deserializes status filter", () => {
    const filters: SessionFilterValues = { ...emptyFilters, status: ["running", "failed"] };
    const params = filtersToParams(filters);
    expect(params.get("status")).toBe("running,failed");
    const restored = paramsToFilters(params);
    expect(restored.status).toEqual(["running", "failed"]);
  });

  it("serializes and deserializes agent_type", () => {
    const filters: SessionFilterValues = { ...emptyFilters, agent_type: "claude-code" };
    const params = filtersToParams(filters);
    expect(params.get("agent_type")).toBe("claude-code");
    const restored = paramsToFilters(params);
    expect(restored.agent_type).toBe("claude-code");
  });

  it("serializes and deserializes date range", () => {
    const filters: SessionFilterValues = {
      ...emptyFilters,
      from: "2026-04-25T00:00:00Z",
      to: "2026-04-27T23:59:59Z",
    };
    const params = filtersToParams(filters);
    const restored = paramsToFilters(params);
    expect(restored.from).toBe("2026-04-25T00:00:00Z");
    expect(restored.to).toBe("2026-04-27T23:59:59Z");
  });

  it("serializes and deserializes search", () => {
    const filters: SessionFilterValues = { ...emptyFilters, search: "auth flow" };
    const params = filtersToParams(filters);
    const restored = paramsToFilters(params);
    expect(restored.search).toBe("auth flow");
  });

  it("omits empty/default values from params", () => {
    const params = filtersToParams(emptyFilters);
    expect(params.toString()).toBe("");
  });

  it("deserializes empty params to defaults", () => {
    const restored = paramsToFilters(new URLSearchParams());
    expect(restored.status).toEqual([]);
    expect(restored.agent_type).toBeNull();
    expect(restored.from).toBeNull();
    expect(restored.to).toBeNull();
    expect(restored.search).toBe("");
  });

  it("does not serialize all statuses (treated as no filter)", () => {
    const all: SessionFilterValues = {
      ...emptyFilters,
      status: ["running", "paused", "completed", "failed", "interrupted", "stale"],
    };
    const params = filtersToParams(all);
    expect(params.has("status")).toBe(false);
  });
});
