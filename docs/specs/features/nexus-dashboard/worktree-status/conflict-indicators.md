# Feature Spec: Conflict Indicators

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Worktree Status | @docs/specs/systems/nexus-dashboard/worktree-status.md |

## Problem Statement

When active worktrees in the same project have overlapping file scopes, the Dashboard needs to visually flag the overlap so developers can act before merge conflicts occur.

## Acceptance Criteria

- [ ] `⚠ OVERLAP` badge on worktree rows with scope overlap
- [ ] Overlap badge shows overlapping paths on hover (tooltip) or inline expansion
- [ ] Conflict banner at top of project group when overlaps exist: "N worktrees have overlapping scope"
- [ ] Overlap detection uses same path prefix logic as Core (per WS-002) via shared utility
- [ ] Only checks active worktrees in the same project
- [ ] Advisory visual — amber/warning colour, not error red
- [ ] Overlap detail shows both worktrees and the specific overlapping paths

## Data Models / API

```typescript
function detectOverlaps(worktrees: WorktreeRecord[]): OverlapReport[];

interface OverlapReport {
  worktree_a: WorktreeRecord;
  worktree_b: WorktreeRecord;
  overlapping_paths: string[];
}
```

Uses `pathsOverlap()` from `packages/shared` (same logic as Core's Conflict Detection feature).

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Move `pathsOverlap()` to `packages/shared` (if not already there from Core implementation) | Not Started |
| 2 | Implement client-side `detectOverlaps()` using shared path logic | Not Started |
| 3 | Implement OverlapBadge component (amber `⚠ OVERLAP` with tooltip) | Not Started |
| 4 | Implement conflict banner at project group level | Not Started |
| 5 | Implement overlap detail expansion (both worktrees + specific paths) | Not Started |
| 6 | Add tests: overlap detection, badge rendering, banner, no-overlap case | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Visual indicator only, no action taken |
| WS-002 | Client-side overlap mirrors Core's advisory model | Same `pathsOverlap()` logic from shared, advisory not blocking |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Shared Logic | Should `pathsOverlap()` and `detectOverlaps()` both be in shared, or just `pathsOverlap()`? | Both — Dashboard and Core both need overlap detection on WorktreeRecord arrays. Avoid reimplementation. | Both in shared. Core and Dashboard use the same overlap detection logic. |

## Status

`Approved`
