# Feature Spec: Conflict Detection

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Worktree Isolation | @docs/specs/systems/nexus-core/worktree-isolation.md |

## Problem Statement

Before creating a worktree, Nexus needs to detect if the proposed file scope overlaps with any active worktrees in the same project — preventing agents from unknowingly working on the same files.

## Acceptance Criteria

- [ ] `checkConflicts(project, scope)` compares proposed scope against all active worktrees for that project
- [ ] Overlap detection uses path prefix matching (e.g., `src/auth/` overlaps `src/auth/login.ts`)
- [ ] Returns a `ConflictReport` with: whether conflicts exist, which worktrees conflict, and which paths overlap
- [ ] Detection is advisory, not blocking (per WI-002) — caller decides whether to proceed
- [ ] Emits `worktree.conflict_detected` event when overlaps are found
- [ ] Works with both file paths and directory prefixes in scope declarations

## Data Models / API

```typescript
function checkConflicts(project: string, scope: string[]): ConflictReport;

interface ConflictReport {
  has_conflicts: boolean;
  conflicts: Array<{
    worktree_id: string;
    session_id: string;
    branch: string;
    overlapping_paths: string[];
  }>;
}
```

### Path Overlap Logic

```typescript
// Two paths overlap if either is a prefix of the other
function pathsOverlap(a: string, b: string): boolean;
// "src/auth/" overlaps "src/auth/login.ts" → true (prefix)
// "src/auth/login.ts" overlaps "src/auth/" → true (contained)
// "src/auth/" overlaps "src/utils/" → false
// "src/auth/login.ts" overlaps "src/auth/login.ts" → true (exact)
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `pathsOverlap()` — bidirectional prefix matching with path normalization | Not Started |
| 2 | Implement `checkConflicts()` — load active worktrees for project, compare scopes, build report | Not Started |
| 3 | Integrate into `createWorktree()` — run conflict check before creation, emit event if conflicts found | Not Started |
| 4 | Add tests: prefix match, exact match, no overlap, multiple conflicts, empty scope | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-004 | Append-only event log | Emits `worktree.conflict_detected` event |
| PD-005 | Git worktree for change isolation | Conflict detection supports the worktree isolation model |
| WI-002 | Scope-based conflict detection is advisory | Returns report but does not block; caller decides |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Scope | What if an agent doesn't declare a scope (empty array)? | No conflicts reported — you can't conflict with nothing. Agent proceeds unmonitored. | No scope = no conflict check. Acceptable for v1; agents that don't declare scope simply skip the safety net. |
| 2 | Normalization | Should paths be normalized (forward slashes, no trailing slash on files, trailing slash on dirs)? | Yes — normalize all paths to forward slashes, directories end with `/`, files don't. Case-insensitive on Windows. | Yes, normalize. Forward slashes, dir trailing slash, case-insensitive comparison on Windows. |
| 3 | Integration | Should `createWorktree()` auto-run conflict check, or should the caller do it? | Auto-run in `createWorktree()` — always check, include report in the return value. Caller still decides via a `skipConflictCheck` option. | Auto-run in `createWorktree()`. Return includes conflict report. `skipConflictCheck: true` option to bypass. |

## Status

`Approved`
