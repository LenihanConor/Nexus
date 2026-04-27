import { describe, it, expect, expectTypeOf } from "vitest";
import type { NexusEvent, EventPayloadMap, KnownEventType } from "../events.js";
import { KNOWN_EVENT_TYPES } from "../events.js";

describe("Event Schema", () => {
  const baseEvent = {
    id: "evt-123",
    timestamp: "2026-04-26T12:00:00.000Z",
    project: "C:/GitHub/TestProject",
    session_id: "sess-456",
    correlation_id: "corr-789",
    agent_id: "agent-abc",
    user_id: "testuser",
  };

  it("accepts a known event type with correct payload", () => {
    const event: NexusEvent<"session.started"> = {
      ...baseEvent,
      event_type: "session.started",
      payload: {
        parent_id: null,
        agent_type: "claude-code",
        task_description: "Implement auth",
      },
    };

    expect(event.event_type).toBe("session.started");
    expect(event.payload.agent_type).toBe("claude-code");
  });

  it("accepts an untyped event with Record payload", () => {
    const event: NexusEvent = {
      ...baseEvent,
      event_type: "custom.something",
      payload: { foo: "bar" },
    };

    expect(event.event_type).toBe("custom.something");
    expect(event.payload.foo).toBe("bar");
  });

  it("includes all Phase 1 event types in KNOWN_EVENT_TYPES", () => {
    expect(KNOWN_EVENT_TYPES).toContain("audit.started");
    expect(KNOWN_EVENT_TYPES).toContain("audit.cleanup");
    expect(KNOWN_EVENT_TYPES).toContain("session.started");
    expect(KNOWN_EVENT_TYPES).toContain("session.updated");
    expect(KNOWN_EVENT_TYPES).toContain("session.ended");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.created");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.conflict_detected");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.merged");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.merge_failed");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.stale_detected");
    expect(KNOWN_EVENT_TYPES).toContain("worktree.cleaned");
    expect(KNOWN_EVENT_TYPES).toHaveLength(11);
  });

  it("NexusEvent has all required fields", () => {
    expectTypeOf<NexusEvent>().toHaveProperty("id");
    expectTypeOf<NexusEvent>().toHaveProperty("timestamp");
    expectTypeOf<NexusEvent>().toHaveProperty("event_type");
    expectTypeOf<NexusEvent>().toHaveProperty("project");
    expectTypeOf<NexusEvent>().toHaveProperty("session_id");
    expectTypeOf<NexusEvent>().toHaveProperty("correlation_id");
    expectTypeOf<NexusEvent>().toHaveProperty("agent_id");
    expectTypeOf<NexusEvent>().toHaveProperty("user_id");
    expectTypeOf<NexusEvent>().toHaveProperty("payload");
  });

  it("session_id and agent_id are nullable", () => {
    const event: NexusEvent<"audit.started"> = {
      ...baseEvent,
      event_type: "audit.started",
      session_id: null,
      agent_id: null,
      payload: { version: "0.1.0" },
    };

    expect(event.session_id).toBeNull();
    expect(event.agent_id).toBeNull();
  });

  it("worktree event payloads include worktree_id", () => {
    const event: NexusEvent<"worktree.created"> = {
      ...baseEvent,
      event_type: "worktree.created",
      payload: {
        worktree_id: "wt-001",
        branch: "feature/auth",
        parent_branch: "main",
        path: "C:/GitHub/TestProject-worktrees/feature-auth",
        scope: ["src/auth/"],
      },
    };

    expect(event.payload.worktree_id).toBe("wt-001");
    expect(event.payload.scope).toEqual(["src/auth/"]);
  });
});
