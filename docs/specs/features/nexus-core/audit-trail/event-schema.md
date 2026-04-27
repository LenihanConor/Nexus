# Feature Spec: Event Schema

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Audit Trail | @docs/specs/systems/nexus-core/audit-trail.md |

## Problem Statement

All Nexus systems need a shared, typed event structure so events can be emitted and consumed consistently across Core and Dashboard.

## Acceptance Criteria

- [ ] `NexusEvent` interface defined in `packages/shared`
- [ ] All Phase 1 event types defined: `audit.started`, `session.started`, `session.updated`, `session.ended`, `worktree.created`, `worktree.conflict_detected`, `worktree.merged`, `worktree.merge_failed`, `worktree.stale_detected`, `worktree.cleaned`
- [ ] Event type is a namespaced string, not an enum (per AT-004)
- [ ] Every event includes: `id`, `timestamp`, `event_type`, `project`, `session_id`, `correlation_id`, `agent_id`, `user_id`, `payload`
- [ ] Payload shapes are typed per event type (discriminated union or generic with type map)
- [ ] Types exported for use by both Core (writer) and Dashboard (reader)
- [ ] Known event type constants exported for autocompletion without enforcement
- [ ] Unit tests verify type correctness (compile-time checks)

## Data Models / API

### Core Interface

```typescript
interface NexusEvent<T extends string = string> {
  id: string;                         // UUID v4
  timestamp: string;                  // ISO 8601
  event_type: T;                      // Namespaced string
  project: string;                    // Resolved project path
  session_id: string | null;          // Owning session (null for system-level)
  correlation_id: string;             // Groups related events
  agent_id: string | null;            // Agent that triggered (null for human)
  user_id: string;                    // User who owns this event
  payload: EventPayloadMap[T];        // Typed per event type
}
```

### Event Type Map

```typescript
interface EventPayloadMap {
  "audit.started": { version: string };
  "session.started": { parent_id: string | null; agent_type: string; task_description: string };
  "session.updated": { status: string; snapshot_label?: string };
  "session.ended": { status: string; exit_code: number | null; duration_ms: number };
  "worktree.created": { worktree_id: string; branch: string; parent_branch: string; path: string; scope: string[] };
  "worktree.conflict_detected": { worktree_id: string; conflicting_session_id: string; overlapping_paths: string[] };
  "worktree.merged": { worktree_id: string; branch: string; merge_result: { success: boolean; conflicts: string[]; commits_merged: number } };
  "worktree.merge_failed": { worktree_id: string; branch: string; conflicts: string[] };
  "worktree.stale_detected": { worktree_id: string; session_id: string; branch: string };
  "worktree.cleaned": { worktree_id: string; branch: string; path: string };
  [key: string]: Record<string, unknown>;  // Extensible for future event types
}
```

### Known Event Types

```typescript
const KNOWN_EVENT_TYPES = [
  "audit.started",
  "session.started",
  "session.updated",
  "session.ended",
  "worktree.created",
  "worktree.conflict_detected",
  "worktree.merged",
  "worktree.merge_failed",
  "worktree.stale_detected",
  "worktree.cleaned",
] as const;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Set up `packages/shared` package (package.json, tsconfig) | Not Started |
| 2 | Define `NexusEvent` interface with generic type parameter | Not Started |
| 3 | Define `EventPayloadMap` with all Phase 1 event payloads | Not Started |
| 4 | Export `KNOWN_EVENT_TYPES` constant list | Not Started |
| 5 | Add type tests verifying discriminated payload types work correctly | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Types defined in TypeScript in `packages/shared` |
| PD-002 | File-based storage (JSONL/JSON) | Schema defines the shape of what gets written to JSONL; no storage logic in this feature |
| PD-004 | Append-only event log | Schema supports immutable events (no `updatedAt` or mutation fields) |
| PD-006 | Core and Dashboard separate | Types live in `packages/shared`, imported by both without coupling |
| PD-007 | Centralized storage in `~/.nexus/` | `project` field on every event enables multi-project filtering |
| CD-003 | Agent-agnostic adapter | `agent_id` is a nullable string, not tied to any specific agent |
| AT-001 | `user_id` included even in v1 | `user_id` is a required field on `NexusEvent` |
| AT-004 | Event types are namespaced strings, not enums | `event_type` is `string` with a type map for known types; `KNOWN_EVENT_TYPES` is a constant list, not an enum |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Data Models | Should `NexusEvent` use a generic parameter for typed payloads, or a discriminated union? | Generic with `EventPayloadMap` — allows unknown types to pass through while giving typed payloads for known types | Generic with `EventPayloadMap`. Discriminated unions would reject unknown event types, breaking extensibility (AT-004). |
| 2 | Data Models | The index signature `[key: string]: Record<string, unknown>` makes the type map extensible but weakens type safety for known types. Is this acceptable? | Yes — known types get full type safety via the explicit entries; unknown types get basic object typing; this matches the "extensible strings, not enums" philosophy | Yes, acceptable. Known types are fully typed; unknown types get basic safety. The alternative (strict union) would break every time a new system adds events. |
| 3 | Tasks | Should `packages/shared` setup (Task 1) include a build step, or just raw TypeScript consumed via project references? | TypeScript project references — no build artifact needed since both Core and Dashboard are TypeScript | TypeScript project references. No build step needed for shared types consumed by sibling packages. |
| 4 | Acceptance Criteria | Are compile-time type tests sufficient, or do runtime validation functions need to be included? | Compile-time only for v1. Runtime validation (e.g., Zod schemas) adds complexity; JSONL reader already skips malformed lines (AT-002). | Compile-time only. Runtime validation deferred — malformed line resilience (AT-002) is the safety net. |

## Status

`Done`
