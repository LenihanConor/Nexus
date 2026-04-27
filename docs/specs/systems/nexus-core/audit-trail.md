# System Spec: Audit Trail

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

The Audit Trail owns the append-only structured event log for the Nexus platform. Every significant action across all systems — session lifecycle events, worktree operations, file changes, commits, conflicts, approvals, budget checks — is captured as a structured event in daily-rotated JSONL files.

It is the foundational system: every other system in Nexus emits events into the Audit Trail, and the Dashboard reads from it. Nothing else in the platform needs to exist for the Audit Trail to work.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Event Emitter | Core `emit()` function that appends structured events to the current day's JSONL file with atomic writes | @docs/specs/features/nexus-core/audit-trail/event-emitter.md | Planned |
| Event Query | `query()` function to read and filter events by session ID, agent ID, event type, time range, and correlation ID | @docs/specs/features/nexus-core/audit-trail/event-query.md | Planned |
| Event Schema | TypeScript types for the event envelope and all known event types; lives in `packages/shared` | @docs/specs/features/nexus-core/audit-trail/event-schema.md | Planned |
| Log Rotation | Daily file rotation (new file per day) and 90-day retention with archival/deletion of old files | @docs/specs/features/nexus-core/audit-trail/log-rotation.md | Planned |
| CLI Commands | `nexus events list`, `nexus events search`, `nexus events tail` for inspecting the audit trail from the terminal | @docs/specs/features/nexus-core/audit-trail/cli-commands.md | Planned |

## Public Interfaces

### Event Envelope Schema

```typescript
interface NexusEvent {
  id: string;                    // Unique event ID (UUID v4)
  timestamp: string;             // ISO 8601 timestamp
  event_type: string;            // Namespaced type (e.g., "session.started", "worktree.created")
  project: string;               // Resolved project path (e.g., "C:/GitHub/Cluiche")
  session_id: string | null;     // Owning session (null for system-level events)
  correlation_id: string;        // Groups related events across systems
  agent_id: string | null;       // Agent that triggered this (null for human actions)
  user_id: string;               // User who owns this event (supports future multi-human)
  payload: Record<string, unknown>; // Event-type-specific data
}
```

### Event Types (Phase 1)

| Event Type | Emitted By | Payload |
|------------|-----------|---------|
| `audit.started` | Audit Trail | `{ version }` |
| `session.started` | Session Registry | `{ parent_id, agent_type, task_description }` |
| `session.updated` | Session Registry | `{ status, snapshot }` |
| `session.ended` | Session Registry | `{ status, exit_code, duration_ms }` |
| `worktree.created` | Worktree Isolation | `{ branch, path, scope }` |
| `worktree.conflict_detected` | Worktree Isolation | `{ conflicting_session_id, files }` |
| `worktree.merged` | Worktree Isolation | `{ branch, merge_result }` |
| `worktree.cleaned` | Worktree Isolation | `{ branch, path }` |

_Additional event types will be added as Phase 2 systems (Budget, Approval, Backlog) are built. The schema is extensible via the `payload` field._

### Write API

```typescript
// Append an event to today's log file
function emit(event: Omit<NexusEvent, 'id' | 'timestamp'>): NexusEvent;

// Emit with just the essentials (id, timestamp, user_id auto-filled)
function emitEvent(type: string, sessionId: string | null, payload: Record<string, unknown>): NexusEvent;
```

### Read API

```typescript
interface EventQuery {
  project?: string;              // Filter by project path
  session_id?: string;
  correlation_id?: string;
  event_type?: string;           // Exact match or prefix (e.g., "session.*")
  agent_id?: string;
  from?: string;                 // ISO 8601 start time
  to?: string;                   // ISO 8601 end time
  limit?: number;                // Max events to return (default 100)
  offset?: number;               // Pagination offset
}

// Query events across all log files matching the time range
function query(filters: EventQuery): NexusEvent[];

// Stream events from the latest log file (like tail -f)
function tail(filters?: Partial<EventQuery>): AsyncIterable<NexusEvent>;
```

### File Layout

```
~/.nexus/events/                 # Centralized — all projects' events in one place
├── events-2026-04-26.jsonl      # Today's events (all projects)
├── events-2026-04-25.jsonl      # Yesterday's events
└── ...                          # Up to 90 days retained
```

Events from all projects are interleaved in the same files, filterable by the `project` field.

## Dependencies

None. The Audit Trail is the bottom of the dependency tree. Other systems depend on it:

| Dependent System | How It Uses Audit Trail |
|-----------------|------------------------|
| Session Registry | Emits session lifecycle events |
| Worktree Isolation | Emits worktree operation events |
| Dashboard (future) | Reads and renders event streams |

## Architecture

### Data Flow

```
Any System ──→ emit(event) ──→ serialize to JSON ──→ atomic append ──→ ~/.nexus/events/events-YYYY-MM-DD.jsonl
                                                                              │
Dashboard / CLI ──→ query(filters) ──→ read JSONL files ──→ filter ──→ return ◄┘
```

### Write Path

1. Caller invokes `emit()` with event data
2. System assigns `id` (UUID v4) and `timestamp` (ISO 8601 now)
3. Event serialized to single-line JSON
4. Appended to today's file using atomic write (write to temp, append, fsync)
5. Returns the complete event with assigned fields

### Read Path

1. Caller invokes `query()` with filters
2. System determines which daily files overlap the time range
3. Files read line-by-line, each line parsed as JSON
4. Events filtered against query criteria
5. Results returned (or streamed for `tail()`)

### Atomic Writes

To prevent partial writes (e.g., if process crashes mid-write):
- Each event is a single JSON line (no multi-line)
- Append uses `fs.appendFile` with newline delimiter
- For critical durability: write to temp file, then rename (for config-level data, not per-event)

### File Rotation

- New file created when the first event of a new UTC day is emitted
- No active rotation process needed — file name includes the date
- Retention: files older than 90 days are deleted on startup and periodically during runtime

## Implementation Patterns

### File I/O

- Use `packages/shared` JSONL utilities for all reads/writes
- Append path: `fs.appendFile` with `\n` delimiter, no locking needed for single-writer
- Read path: `readline` interface for streaming line-by-line parsing
- Rotation check: compare current UTC date against filename date

### Concurrency

- Single Nexus Core instance enforced by `~/.nexus/nexus.lock` (from CD-004)
- Within that instance, `emit()` calls are serialized (single Node.js event loop)
- `query()` and `tail()` are read-only and safe to run concurrently

### Error Handling

- If event file cannot be written: log error to stderr, do not throw (other systems should not fail because audit is down)
- If event file cannot be read: return empty results with error flag
- Malformed lines in JSONL files: skip and continue (resilient reader)

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | Audit Trail implemented entirely in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Events stored as daily JSONL files in `~/.nexus/events/` |
| PD-003 | Local-only deployment for v1 | File I/O is local filesystem only; `user_id` field included in event schema for future multi-human |
| PD-007 | Centralized storage in `~/.nexus/` | All events from all projects in one directory; `project` field on every event for filtering |
| PD-004 | Append-only event log pattern | This system *is* the append-only event log; events are never modified or deleted (only aged out by retention) |
| PD-005 | Git worktree for change isolation | N/A — Audit Trail does not perform git operations; it logs events from the Worktree Isolation system |
| PD-006 | Core and Dashboard are separate apps | Audit Trail is a Core system; Dashboard reads its JSONL files but does not write to them |
| CD-001 | Centralized `~/.nexus/` directory | Events stored under `~/.nexus/events/` |
| CD-002 | Daily rotation for event logs | One JSONL file per UTC day |
| CD-003 | Agent-agnostic adapter interface | Event schema uses optional fields (`agent_id`, `payload`) — adapters enrich events but are not required |
| CD-004 | CLI-first interface | `nexus events list/search/tail` commands expose all read functionality |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| AT-001 | Event envelope includes `user_id` even in v1 | Future multi-human support requires knowing who triggered what; cheaper to add now than retrofit | System | Accepted | Yes |
| AT-002 | Malformed JSONL lines are skipped, not fatal | Resilience over strictness — a corrupt line should not prevent reading the rest of the file | System | Accepted | Yes |
| AT-003 | `emit()` never throws on write failure | Audit Trail is observability infrastructure; it must not cause other systems to fail | System | Accepted | Yes |
| AT-004 | Event types are namespaced strings, not enums | Extensibility — new systems can define new event types without modifying the Audit Trail code | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Write Path | Is `fs.appendFile` safe for concurrent appends from async operations within a single Node process? | Yes — Node.js `fs.appendFile` on a single file from a single process is safe due to the event loop. Multiple Nexus instances are prevented by the lock file (CD-004). |
| 2 | Schema | Should event types be validated against a registry, or is any string accepted? | Any string accepted for extensibility (AT-004). A `known_event_types` list in shared types gives autocompletion and documentation without enforcement. |
| 3 | Retention | What happens to events referenced by active sessions when they age past 90 days? | Events are deleted by file date regardless. Session lineage captures key state snapshots independently. If full replay is needed, archival (copy to archive dir) is the path — not extended retention. |
| 4 | Performance | What's the read performance for `query()` across 90 days of files? | At ~1000 events/day, that's ~90K events in 90 files. Sequential read with line-by-line filtering is fast enough for CLI use. Dashboard should cache/index if it needs faster queries. |
| 5 | Correlation | Who generates the `correlation_id`? Can it span multiple sessions? | The caller generates it. Typically set at the "user intent" level — e.g., one correlation ID for "implement feature X" that spans multiple agent sessions. If not provided, defaults to the session ID. |
| 6 | Testing | How do you test the audit trail without polluting real event files? | Tests use a configurable data directory (override `.nexus/` path). Test setup creates a temp dir, test teardown deletes it. |

## Status

`Done`
