# Feature Spec: Log Rotation

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Audit Trail | @docs/specs/systems/nexus-core/audit-trail.md |

## Problem Statement

Event log files need daily rotation and 90-day retention to keep storage manageable without manual intervention.

## Acceptance Criteria

- [ ] New event file created automatically when the first event of a new UTC day is emitted (handled by Event Emitter's date-based filename)
- [ ] `cleanupOldEvents()` deletes event files older than the retention period (default 90 days)
- [ ] Cleanup runs on Nexus startup and periodically during runtime (configurable interval, default every 6 hours)
- [ ] Retention period configurable via `~/.nexus/config.json`
- [ ] Cleanup logs what it deletes as an `audit.cleanup` event
- [ ] Cleanup never fails fatally — if a file can't be deleted, log warning and continue

## Data Models / API

```typescript
interface RetentionConfig {
  retentionDays?: number;         // Default 90
  cleanupIntervalMs?: number;     // Default 6 hours (21600000)
}

// Delete event files older than retentionDays
function cleanupOldEvents(config?: RetentionConfig): Promise<CleanupResult>;

interface CleanupResult {
  filesDeleted: string[];
  filesSkipped: string[];         // Failed to delete
  oldestRetained: string;         // Date of oldest kept file
}

// Start periodic cleanup timer
function startCleanupSchedule(config?: RetentionConfig): void;
function stopCleanupSchedule(): void;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `cleanupOldEvents()` — list files, parse dates from filenames, delete those beyond retention | Not Started |
| 2 | Implement `startCleanupSchedule()` / `stopCleanupSchedule()` — `setInterval` based periodic trigger | Not Started |
| 3 | Add retention config support to `~/.nexus/config.json` schema | Not Started |
| 4 | Emit `audit.cleanup` event on each cleanup run (add to Event Schema's known types) | Not Started |
| 5 | Add tests: file deletion, retention boundary, failed deletion resilience, config override | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Operates on JSONL files in `~/.nexus/events/` |
| PD-003 | Local-only deployment | Local filesystem operations only |
| PD-004 | Append-only event log | Events are never modified; old files are deleted whole (retention), not edited |
| PD-007 | Centralized storage in `~/.nexus/` | Operates on `~/.nexus/events/` |
| CD-001 | Centralized `~/.nexus/` directory | Event files in `~/.nexus/events/` |
| CD-002 | Daily rotation | Rotation is date-based via filename (Event Emitter creates new files); this feature handles retention/cleanup |
| AT-003 | `emit()` never throws | Cleanup emits events but failure to emit doesn't halt cleanup |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Retention | Should retention be exactly 90 days or "files older than 90 days"? Edge case: file from exactly 90 days ago. | Files older than 90 days (exclusive) — the file from exactly 90 days ago is kept | Keep files from the last 90 days inclusive. Delete files from day 91+. |
| 2 | Cleanup Event | Emitting an `audit.cleanup` event during cleanup creates a chicken-and-egg: what if the emitter is the thing being cleaned? | Not a real issue — cleanup deletes old files, the new event goes to today's file | No conflict. Cleanup deletes old files; the cleanup event writes to today's file. |
| 3 | Concurrency | What if cleanup runs while `query()` is reading an old file? | File deletion while reading may cause a read error on some platforms. Mitigation: `query()` handles missing files gracefully (returns empty for that file). | `query()` already handles missing/unreadable files gracefully. Acceptable race condition — worst case is one query misses events from a file that was about to be deleted anyway. |

## Status

`Approved`
