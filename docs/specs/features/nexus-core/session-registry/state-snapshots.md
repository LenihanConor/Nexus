# Feature Spec: State Snapshots

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Session Registry | @docs/specs/systems/nexus-core/session-registry.md |

## Problem Statement

Sessions need to capture point-in-time snapshots of task progress, decisions made, and files changed — so lineage tracking shows *what happened*, not just *that something happened*.

## Acceptance Criteria

- [ ] `SessionSnapshot` type defined with: timestamp, label, task_progress, decisions, files_changed, notes
- [ ] Snapshots embedded in the `SessionRecord.snapshots` array (per SR-003)
- [ ] `updateSession()` accepts an optional snapshot that gets timestamped and appended to the array
- [ ] `endSession()` accepts an optional final snapshot
- [ ] Minimum contract: snapshot at session start and end (adapter responsibility)
- [ ] Optional snapshots at: task boundaries, approval requests, context restarts
- [ ] Snapshots are lightweight — strings and short arrays, not full file contents

## Data Models / API

```typescript
interface SessionSnapshot {
  timestamp: string;              // ISO 8601 (auto-assigned)
  label: string;                  // What triggered this (e.g., "task_2_completed")
  task_progress: string | null;   // Current progress (e.g., "3 of 7 tasks done")
  decisions: string[];            // Key decisions since last snapshot
  files_changed: string[];        // Files modified since last snapshot
  notes: string | null;           // Freeform context
}

// Convenience: create a snapshot with auto-timestamp
function createSnapshot(data: Omit<SessionSnapshot, 'timestamp'>): SessionSnapshot;
```

Snapshots are not a standalone API — they flow through `updateSession()` and `endSession()` in the Session Lifecycle feature.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Define `SessionSnapshot` type in `packages/shared` | Not Started |
| 2 | Implement `createSnapshot()` helper with auto-timestamp | Not Started |
| 3 | Integrate snapshot append logic into `updateSession()` and `endSession()` | Not Started |
| 4 | Add tests: snapshot creation, append to session, multiple snapshots in sequence | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Types and logic in TypeScript |
| PD-002 | File-based storage | Snapshots stored inline in session JSONL records |
| SR-001 | Append-only with latest-wins | Each update with a snapshot appends a new full record (snapshots accumulate) |
| SR-003 | Snapshots embedded, not separate storage | Snapshots are an array field on `SessionRecord` |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Size | What if a session accumulates 50+ snapshots? Record size grows. | Acceptable — at ~200 bytes per snapshot, 50 snapshots adds ~10KB to the record. Log a warning at 100+ as a signal to the adapter to reduce frequency. | Acceptable. Warn at 100+. Adapters should self-regulate snapshot frequency. |
| 2 | Merge | When `updateSession()` appends a new record with a snapshot, does it carry forward all previous snapshots? | Yes — the new record is the full current state including all previous snapshots. Latest-wins means the new record must be complete. | Yes, carry forward. Each appended record is self-contained. |
| 3 | Content | Should snapshots include diff summaries or just file paths? | Just file paths for v1. Diff summaries add significant size and the actual diffs live in git. | File paths only. Git has the diffs. |

## Status

`Approved`
