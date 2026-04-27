# Feature Spec: Worktree List

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Worktree Status | @docs/specs/systems/nexus-dashboard/worktree-status.md |

## Problem Statement

Developers need to see all worktrees grouped by project — what's active, what's merged, what's conflicted, and what's stale — at a glance.

## Acceptance Criteria

- [ ] Worktrees grouped by project in collapsible sections (per WS-001)
- [ ] Each worktree row: status indicator, branch name, agent type, owning session (linked), declared scope
- [ ] Groups sorted: projects with active worktrees first, then alphabetical
- [ ] Expanded by default if project has active worktrees
- [ ] Status filter: show/hide by status (cleaned hidden by default per WS-004)
- [ ] Cleaned worktrees visible via "Show cleaned" toggle
- [ ] Respects global project filter (narrows to one group)
- [ ] Empty state: friendly message

## Data Models / API

```typescript
function getWorktreesByProject(data: DashboardData, filters: WorktreeFilters): Map<string, WorktreeRecord[]>;

interface WorktreeFilters {
  project?: string;
  status?: WorktreeStatus | WorktreeStatus[];
  search?: string;
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement WorktreeList component with project grouping | Not Started |
| 2 | Implement WorktreeProjectGroup component (collapsible section) | Not Started |
| 3 | Implement WorktreeRow component (status, branch, agent, session link, scope) | Not Started |
| 4 | Implement WorktreeStatusBadge component (colour + symbol) | Not Started |
| 5 | Implement status filter with "Show cleaned" toggle | Not Started |
| 6 | Implement group sorting (active projects first) | Not Started |
| 7 | Add tests: grouping, sorting, filtering, collapse/expand, empty state | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only |
| DD-004 | Global project filter | Respects shell's project filter |
| WS-001 | Group by project | Worktrees grouped by project in collapsible sections |
| WS-004 | Cleaned hidden by default | Cleaned worktrees only shown with explicit toggle |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Collapse | Should all project groups start expanded or only those with active worktrees? | Only projects with active worktrees expanded; others collapsed. Reduces visual noise. | Active projects expanded, others collapsed. |

## Status

`Approved`
