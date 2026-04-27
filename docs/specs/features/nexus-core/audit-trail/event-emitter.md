# Feature Spec: Event Emitter

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Audit Trail | @docs/specs/systems/nexus-core/audit-trail.md |

## Problem Statement

Systems need a simple function to append structured events to the daily JSONL log file with atomic, non-throwing writes.

## Acceptance Criteria

- [ ] `emit(event)` appends a complete `NexusEvent` to `~/.nexus/events/events-YYYY-MM-DD.jsonl`
- [ ] `emitEvent(type, sessionId, payload)` convenience function auto-fills `id` (UUID v4), `timestamp` (ISO 8601 now), and `user_id`
- [ ] Writes are atomic: single-line JSON followed by `\n`, using `fs.appendFile`
- [ ] `emit()` never throws on write failure (per AT-003) — logs error to stderr and returns
- [ ] Auto-creates `~/.nexus/events/` directory on first write if it doesn't exist
- [ ] New file created automatically when the first event of a new UTC day is emitted
- [ ] Returns the complete `NexusEvent` with assigned `id` and `timestamp`
- [ ] Works correctly under rapid sequential calls (Node.js event loop serialization)

## Data Models / API

### Write API

```typescript
// Append a fully-formed event (caller provides all fields except id/timestamp)
function emit(event: Omit<NexusEvent, 'id' | 'timestamp'>): NexusEvent;

// Convenience: auto-fills id, timestamp, user_id, correlation_id
function emitEvent(
  type: string,
  sessionId: string | null,
  payload: Record<string, unknown>,
  opts?: {
    project?: string;
    correlationId?: string;
    agentId?: string | null;
  }
): NexusEvent;
```

### Internal Details

```typescript
// Resolve the current day's event file path
function getEventFilePath(date?: Date): string;
// Returns: ~/.nexus/events/events-2026-04-27.jsonl

// Ensure the events directory exists (called once on first write)
function ensureEventsDir(): void;
```

### Serialization

Each event is serialized as a single line of JSON with no pretty-printing:

```
{"id":"evt-abc","timestamp":"2026-04-27T14:30:00.000Z","event_type":"session.started",...}\n
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `getEventFilePath()` — resolve `~/.nexus/events/events-YYYY-MM-DD.jsonl` using UTC date | Not Started |
| 2 | Implement `ensureEventsDir()` — create `~/.nexus/events/` if missing, with error handling | Not Started |
| 3 | Implement `emit()` — assign id/timestamp, serialize to JSON line, append via `fs.appendFile` | Not Started |
| 4 | Implement `emitEvent()` convenience wrapper — resolve user_id, default correlation_id, delegate to `emit()` | Not Started |
| 5 | Add non-throwing error handling — catch write failures, log to stderr, return the event anyway | Not Started |
| 6 | Add tests: successful write, directory auto-creation, date rollover, write failure resilience | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Writes events as JSONL to `~/.nexus/events/` |
| PD-003 | Local-only deployment | All file I/O is local filesystem |
| PD-004 | Append-only event log | Events are only ever appended, never modified or deleted |
| PD-007 | Centralized storage in `~/.nexus/` | Writes to `~/.nexus/events/` |
| CD-001 | Centralized `~/.nexus/` directory | Event files in `~/.nexus/events/` |
| CD-002 | Daily rotation | New file per UTC day via date in filename |
| AT-001 | `user_id` included even in v1 | `emitEvent()` resolves and includes `user_id` |
| AT-003 | `emit()` never throws on write failure | Write failures caught, logged to stderr, event returned regardless |
| AT-004 | Event types are namespaced strings | Accepts any string as `event_type` |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | API | How is `user_id` resolved in `emitEvent()`? | Read from `~/.nexus/config.json` or fall back to OS username (`os.userInfo().username`) | OS username fallback with config override. Simple, works for single-user v1, configurable for future multi-human. |
| 2 | Serialization | Should `JSON.stringify` be called with a replacer to strip `undefined` values? | Yes — `undefined` values in payload would serialize inconsistently; strip them for clean JSONL | Yes, strip `undefined` values. Consistent JSONL output. |
| 3 | Concurrency | What if `emit()` is called rapidly in sequence — can appends interleave? | No — single Node.js process, `fs.appendFile` calls are queued by the event loop. Single writer guaranteed by `~/.nexus/nexus.lock`. | No interleaving. Node.js event loop + lock file guarantee single writer. |
| 4 | Directory Creation | Should `ensureEventsDir()` use `mkdir -p` equivalent or check first? | `fs.mkdir` with `{ recursive: true }` — idempotent, no check needed | `fs.mkdir({ recursive: true })` — idempotent, single call, no race conditions. |

## Status

`Approved`
