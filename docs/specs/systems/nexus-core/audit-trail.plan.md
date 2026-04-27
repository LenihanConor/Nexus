# Plan: Audit Trail

**Spec:** @docs/specs/systems/nexus-core/audit-trail.md
**Status:** Done
**Started:** 2026-04-26
**Last Updated:** 2026-04-26

## Implementation Patterns

### Event Schema (packages/shared)
- `NexusEvent<T>` generic interface with `EventPayloadMap` for typed payloads
- `KNOWN_EVENT_TYPES` as `as const` array for autocompletion
- Index signature `[key: string]: Record<string, unknown>` for extensibility
- No runtime validation — compile-time types only

### Event Emitter (packages/core)
- `emit()` and `emitEvent()` in `packages/core/src/audit/emitter.ts`
- `fs.appendFile` for atomic single-line appends
- `fs.mkdir({ recursive: true })` for directory creation
- UUID v4 via `crypto.randomUUID()`
- Never throws — catches write errors, logs to stderr
- User ID from `os.userInfo().username`

### Event Query (packages/core)
- `query()` reads files newest-first, stops at limit
- `readEventFile()` streaming JSONL reader via `readline`
- `matchesFilters()` with prefix matching for event_type
- `tail()` uses `fs.watchFile` with 1-second interval
- JSONL read utilities (`readJsonlFile`, `parseJsonlLine`) in `packages/shared`
- Malformed lines skipped per AT-002

### Log Rotation (packages/core)
- `cleanupOldEvents()` parses dates from filenames, deletes files older than retention period
- `startCleanupSchedule()` / `stopCleanupSchedule()` via `setInterval`
- Retention config from `~/.nexus/config.json`, default 90 days
- Emits `audit.cleanup` event after each run

### CLI Commands (packages/core)
- Commander for CLI framework
- `nexus events list`, `nexus events search`, `nexus events tail`
- Table formatting with colour (TTY-aware)
- `--json` flag for raw output
- `summarizeEvent()` in `packages/shared` for reuse by Dashboard

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Event Schema — NexusEvent, EventPayloadMap, KNOWN_EVENT_TYPES in packages/shared | Done | Feature: event-schema.md |
| 2 | JSONL Utilities — readJsonlFile, parseJsonlLine in packages/shared | Done | Feature: event-query.md task 6 |
| 3 | Event Emitter — emit(), emitEvent(), getEventFilePath(), ensureEventsDir() | Done | Feature: event-emitter.md |
| 4 | Event Query — query(), tail(), getEventFiles(), matchesFilters() | Done | Feature: event-query.md |
| 5 | Log Rotation — cleanupOldEvents(), cleanup schedule, config | Done | Feature: log-rotation.md |
| 6 | CLI Commands — nexus events list/search/tail with Commander | Done | Feature: cli-commands.md |

## Session Notes

### 2026-04-26
- Monorepo set up with pnpm workspaces, TypeScript 6, Vitest 4.1
- Build verified clean with stub index files
- Starting implementation with Task 1 (Event Schema)
