# Feature Spec: Event Query

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Audit Trail | @docs/specs/systems/nexus-core/audit-trail.md |

## Problem Statement

Systems and the CLI need to read and filter events across daily log files by session, agent, type, correlation ID, and time range.

## Acceptance Criteria

- [ ] `query(filters)` returns events matching filter criteria across relevant daily files
- [ ] `tail(filters?)` returns an `AsyncIterable` that streams new events from the latest file
- [ ] Filters supported: `project`, `session_id`, `correlation_id`, `event_type` (exact or prefix match), `agent_id`, `from`/`to` time range, `limit`, `offset`
- [ ] Only reads files within the requested time range (not all 90 days)
- [ ] Malformed JSONL lines skipped, not fatal (per AT-002)
- [ ] Line-by-line streaming read via `readline` — not full file load into memory
- [ ] Returns events sorted by timestamp (newest first by default)
- [ ] `tail()` watches the current day's file and yields new events as they're appended

## Data Models / API

### Query Interface

```typescript
interface EventQuery {
  project?: string;
  session_id?: string;
  correlation_id?: string;
  event_type?: string;           // Exact match or prefix (e.g., "session.*" matches "session.started")
  agent_id?: string;
  from?: string;                 // ISO 8601 — only read files from this date onward
  to?: string;                   // ISO 8601 — only read files up to this date
  limit?: number;                // Default 100
  offset?: number;               // Default 0
}

function query(filters: EventQuery): Promise<NexusEvent[]>;
function tail(filters?: Partial<EventQuery>): AsyncIterable<NexusEvent>;
```

### Internal Details

```typescript
// List event files within a date range
function getEventFiles(from?: string, to?: string): string[];
// Returns: ["~/.nexus/events/events-2026-04-27.jsonl", ...]

// Read a single JSONL file line-by-line, yielding parsed events
function readEventFile(path: string): AsyncIterable<NexusEvent>;

// Match an event against query filters
function matchesFilters(event: NexusEvent, filters: EventQuery): boolean;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `getEventFiles()` — list and filter `~/.nexus/events/` files by date range | Not Started |
| 2 | Implement `readEventFile()` — streaming JSONL reader with malformed line skipping | Not Started |
| 3 | Implement `matchesFilters()` — filter matching including event_type prefix support | Not Started |
| 4 | Implement `query()` — orchestrate file selection, streaming read, filter, limit/offset | Not Started |
| 5 | Implement `tail()` — watch current day's file, yield new lines as they appear | Not Started |
| 6 | Add shared JSONL read utilities to `packages/shared` (used by both Core and Dashboard) | Not Started |
| 7 | Add tests: multi-file query, prefix matching, malformed line resilience, tail streaming | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Reads JSONL files from `~/.nexus/events/` |
| PD-003 | Local-only deployment | All file reads are local filesystem |
| PD-004 | Append-only event log | Read-only access; never modifies event files |
| PD-007 | Centralized storage in `~/.nexus/` | Reads from `~/.nexus/events/` |
| CD-001 | Centralized `~/.nexus/` directory | Reads from `~/.nexus/events/` |
| AT-002 | Malformed lines skipped, not fatal | Reader skips unparseable lines and continues |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Performance | Should `query()` read files newest-first (for "show me recent events") or oldest-first? | Newest-first — most queries want recent data; stop early once limit is reached | Newest-first. Read today's file first, then yesterday's, etc. Stop when limit reached. |
| 2 | Tail | How does `tail()` detect new lines — `fs.watch`, polling, or `fs.watchFile`? | `fs.watchFile` with 1-second poll interval — simpler and more portable than `fs.watch` which has platform quirks | `fs.watchFile` with 1-second interval. Cross-platform reliable; `fs.watch` has known issues on Windows with network drives. |
| 3 | Prefix Match | How does `event_type` prefix matching work? Does "session" match "session.started"? | Prefix match with implicit wildcard: "session" matches any type starting with "session". Exact match for full type names. | Yes, prefix match. "session" matches "session.started", "session.ended", etc. "session.started" is an exact match. |
| 4 | Shared Utilities | Which JSONL read utilities should go in `packages/shared` vs stay in Core? | `readJsonlFile()` and `parseJsonlLine()` in shared (Dashboard needs them too). `query()` and `tail()` in Core (Dashboard uses the shell's data layer). | Read utilities in `packages/shared`. Query/tail logic in Core only. |

## Status

`Done`
