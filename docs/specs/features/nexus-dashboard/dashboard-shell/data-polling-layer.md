# Feature Spec: Data Polling Layer

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

The Dashboard server needs to poll `~/.nexus/` JSONL files at a configurable interval, cache parsed data, and serve it to the frontend via API endpoints.

## Acceptance Criteria

- [ ] Polls `~/.nexus/events/`, `~/.nexus/sessions/`, `~/.nexus/worktrees/` at configurable interval (default 5s)
- [ ] Checks `mtime` before re-reading files — skips unchanged files (per DS-004)
- [ ] Deduplicates sessions and worktrees (append-only latest-wins)
- [ ] Events read from today's file by default; historical files loaded on request via date range params
- [ ] Derives `projects` list from all loaded data
- [ ] Computes `DashboardSummary` from cached data
- [ ] Graceful handling: missing files → empty data, malformed lines → skipped
- [ ] Configurable poll interval via `~/.nexus/config.json` (`dashboard.pollInterval`)

## Data Models / API

### Cache Structure

```typescript
interface DataCache {
  events: NexusEvent[];
  sessions: SessionRecord[];        // Deduplicated
  worktrees: WorktreeRecord[];      // Deduplicated
  projects: string[];               // Derived
  lastUpdated: string;              // ISO 8601
  fileMtimes: Map<string, number>;  // Path → mtime for change detection
}
```

### Internal API

```typescript
// Initial data load on startup
function loadInitialData(): Promise<DataCache>;

// Poll for changes — check mtimes, re-read changed files, update cache
function pollForChanges(cache: DataCache): Promise<DataCache>;

// Start/stop the polling timer
function startPolling(intervalMs: number): void;
function stopPolling(): void;

// Deduplicate append-only records (latest per ID wins)
function deduplicateRecords<T extends { id: string }>(records: T[]): T[];

// Derive project list from all data
function deriveProjects(data: DataCache): string[];
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `mtime` checking — `fs.stat` for each tracked file | Not Started |
| 2 | Implement file reading with shared JSONL utilities and malformed line skipping | Not Started |
| 3 | Implement `deduplicateRecords()` for sessions and worktrees | Not Started |
| 4 | Implement `loadInitialData()` — full read of all current files | Not Started |
| 5 | Implement `pollForChanges()` — mtime check, selective re-read, cache update | Not Started |
| 6 | Implement polling timer with configurable interval | Not Started |
| 7 | Implement `deriveProjects()` and `DashboardSummary` computation | Not Started |
| 8 | Add tests: mtime change detection, deduplication, missing files, poll cycle | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage | Reads JSONL files directly |
| PD-007 | Centralized storage in `~/.nexus/` | Reads from `~/.nexus/` |
| DD-001 | Dashboard is read-only | Only reads files, never writes |
| DD-002 | Polling-based refresh (5s) | Configurable polling interval, default 5s |
| DD-003 | Direct JSONL file reads | No Core API; reads files with shared utilities |
| DS-001 | Server-side polling with cache | This feature *implements* the server-side cache |
| DS-004 | mtime check before re-reading | Checks file modification time, skips unchanged files |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Events | Should historical event files be cached in memory, or re-read on each request? | Cache today's events in memory (small, frequently accessed). Historical files read on demand and not cached (could be large). | Cache today's events. Historical on demand, not cached. Drop today's cache at midnight. |
| 2 | Dedup | Deduplication reads the full sessions/worktrees file every time it changes. Is this a concern? | No — these files grow slowly. Worst case: 10K records at ~1KB each = 10MB, parsed in milliseconds. | Not a concern at v1 scale. Re-read and deduplicate is fast enough. |

## Status

`Approved`
