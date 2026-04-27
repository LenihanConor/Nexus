# Plan: Session Registry

**Spec:** @docs/specs/systems/nexus-core/session-registry.md
**Status:** Done
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Session Types (packages/shared)
- `SessionRecord`, `SessionStatus`, `SessionSnapshot`, `SessionLineage`, `SessionTreeNode`
- `formatDuration()` utility for human-readable durations

### Session Store (packages/core)
- Append-only JSONL at `~/.nexus/sessions/sessions.jsonl`
- Latest-wins: load all, deduplicate by ID, take latest
- Same pattern as worktree store

### Session Lifecycle (packages/core)
- `createSession()`, `updateSession()`, `endSession()`
- Emit audit trail events for all transitions
- Correlation ID: self for root, inherited for children
- `endSession` idempotent on already-ended sessions

### Session Lineage (packages/core)
- Iterative ancestor traversal (max depth 20)
- Descendant discovery by scanning parent_id pointers
- `getCorrelationGroup()`, `buildSessionTree()`

### Stale Detection (packages/core)
- `isProcessAlive()` — Windows: `tasklist`, Unix: `kill -0`
- Skip sessions with null PID
- Periodic timer, 60s default

### CLI (packages/core)
- `nexus session list/show/lineage/clean`
- Unicode tree rendering for lineage
- Duration formatting shared utility

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Session types — SessionRecord, SessionStatus, SessionSnapshot, SessionLineage in shared | Done | |
| 2 | Duration formatter — formatDuration() in shared | Done | |
| 3 | Session store — JSONL read/write, latest-wins dedup | Done | |
| 4 | Session lifecycle — createSession, updateSession, endSession | Done | |
| 5 | Session lineage — getLineage, getCorrelationGroup, buildSessionTree | Done | |
| 6 | Stale detection — isProcessAlive, detectStale, periodic timer | Done | |
| 7 | CLI commands — nexus session list/show/lineage/clean | Done | |

## Session Notes

### 2026-04-27
- Audit Trail and Worktree Isolation complete
- Starting Session Registry implementation
