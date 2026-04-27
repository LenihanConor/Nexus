# Feature Spec: Session Lifecycle

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Session Registry | @docs/specs/systems/nexus-core/session-registry.md |

## Problem Statement

Agent sessions need to be registered, tracked through status changes, and properly ended — giving every session a unique identity and a complete lifecycle record.

## Acceptance Criteria

- [ ] `createSession()` assigns a UUID, sets status to `running`, appends record to `~/.nexus/sessions/sessions.jsonl`
- [ ] `updateSession()` appends an updated record with new status and/or snapshot
- [ ] `endSession()` calculates duration, sets terminal status, appends final record
- [ ] All operations emit corresponding events into the Audit Trail
- [ ] `agent_pid` captured for liveness checking (used by stale detection)
- [ ] `correlation_id` defaults to own ID for root sessions, inherited from parent for child sessions (per SR-002)
- [ ] `user_id` resolved from OS username or config (per AT-001)
- [ ] Append-only storage with latest-wins semantics (per SR-001)
- [ ] Auto-creates `~/.nexus/sessions/` directory if missing

## Data Models / API

```typescript
function createSession(opts: {
  project: string;
  agent_type: string;
  agent_pid?: number;
  task_description: string;
  parent_id?: string;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<SessionRecord>;

function updateSession(sessionId: string, update: {
  status?: SessionStatus;
  snapshot?: Omit<SessionSnapshot, 'timestamp'>;
  metadata?: Record<string, unknown>;
}): Promise<SessionRecord>;

function endSession(sessionId: string, result: {
  status: "completed" | "failed" | "interrupted";
  exit_code?: number;
  snapshot?: Omit<SessionSnapshot, 'timestamp'>;
  metadata?: Record<string, unknown>;
}): Promise<SessionRecord>;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Define `SessionRecord`, `SessionStatus`, `SessionSnapshot` types in `packages/shared` | Not Started |
| 2 | Implement `createSession()` — assign ID, resolve correlation_id/user_id, append, emit event | Not Started |
| 3 | Implement `updateSession()` — load current record, merge updates, append new record, emit event | Not Started |
| 4 | Implement `endSession()` — calculate duration, set terminal status, append, emit event | Not Started |
| 5 | Implement `ensureSessionsDir()` — create `~/.nexus/sessions/` if missing | Not Started |
| 6 | Add tests: create/update/end lifecycle, correlation_id inheritance, duration calculation | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Session records in `~/.nexus/sessions/sessions.jsonl` |
| PD-004 | Append-only event log | Records append-only; emits events to Audit Trail |
| PD-007 | Centralized storage in `~/.nexus/` | Sessions from all projects in one file |
| CD-003 | Agent-agnostic adapter | `agent_type` is a string; any agent can register |
| SR-001 | Append-only with latest-wins | Every update appends a full record; latest per ID wins |
| SR-002 | Correlation ID defaults to own ID for root | Root sessions self-correlate; children inherit |
| AT-001 | user_id included even in v1 | user_id resolved on every session record |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Update | Should `updateSession()` fail if the session doesn't exist? | Yes — return an error. Creating and updating are distinct operations. | Yes, fail with a clear error: "Session <id> not found." |
| 2 | End | Can `endSession()` be called on an already-ended session? | No — idempotent is safer. If already ended, return the existing final record without appending. | Idempotent. Return existing record if already ended. Log a warning but don't error. |
| 3 | Metadata Merge | How are metadata updates merged — shallow or deep? | Shallow merge (`Object.assign`). Deep merge adds complexity for minimal benefit at this stage. | Shallow merge. Simple and predictable. |

## Status

`Done`
