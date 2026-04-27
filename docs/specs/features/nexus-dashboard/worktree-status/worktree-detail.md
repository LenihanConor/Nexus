# Feature Spec: Worktree Detail

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Worktree Status | @docs/specs/systems/nexus-dashboard/worktree-status.md |

## Problem Statement

Developers need a detail view of a single worktree showing its full record, scope with overlap indicators, merge result, owning session, and related events.

## Acceptance Criteria

- [ ] Route: `/worktrees/:id`
- [ ] Header: worktree metadata (project, branch, parent branch, path, status, timing)
- [ ] Owning session section with link to Session Detail
- [ ] Declared scope list with overlap highlighting (if conflicts with other active worktrees)
- [ ] Merge result section (shown when merged or conflicted): success/failure, conflicting files list
- [ ] Recent events section: worktree-related events from Audit Trail
- [ ] Navigation links: View Session, View All Events
- [ ] Path display: truncated with full path in tooltip (per Worktree Status AI Q6)
- [ ] Handles missing worktree (404 with back link)

## Data Models / API

```typescript
function getWorktreeDetail(data: DashboardData, worktreeId: string): {
  worktree: WorktreeRecord;
  session: SessionRecord | null;
  events: NexusEvent[];
  overlaps: OverlapReport[];
} | null;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement WorktreeDetail component with metadata header | Not Started |
| 2 | Implement ScopeList component with overlap highlighting | Not Started |
| 3 | Implement merge result section (success view and conflict view) | Not Started |
| 4 | Implement owning session section with link | Not Started |
| 5 | Implement worktree events section | Not Started |
| 6 | Implement path truncation with tooltip | Not Started |
| 7 | Add 404 handling for invalid worktree IDs | Not Started |
| 8 | Add tests: detail rendering, overlap highlighting, merge results, missing worktree | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only |
| WS-002 | Client-side overlap mirrors Core's advisory model | Shows overlaps found by client-side detection, consistent with Core |
| WS-003 | Cleanup shown as CLI command | If stale, shows `nexus worktree clean <id>` as text instruction |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Conflicts | Should the detail view show a "copy cleanup command" button? | Yes — small UX nicety. Clicking copies `nexus worktree clean <id>` to clipboard. | Yes, copy button. Lowers friction between seeing the problem and acting on it. |

## Status

`Approved`
