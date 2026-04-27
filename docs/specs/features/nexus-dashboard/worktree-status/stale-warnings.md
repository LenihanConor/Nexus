# Feature Spec: Stale Warnings

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Worktree Status | @docs/specs/systems/nexus-dashboard/worktree-status.md |

## Problem Statement

Stale orphaned worktrees consume disk space and create confusion — the Dashboard needs to prominently warn about them and guide the developer toward cleanup.

## Acceptance Criteria

- [ ] Banner at the top of the worktree list when stale worktrees exist
- [ ] Banner shows count and summary: "N stale worktrees need cleanup"
- [ ] Collapsed to one line if many stale worktrees (10+): "10 stale worktrees — [View all]"
- [ ] Each stale worktree listed with: branch, project, session (that died)
- [ ] CLI cleanup command shown as text: `nexus worktree clean --stale` (per WS-003)
- [ ] Stale worktree rows in the list have pulsing orange `◌` indicator
- [ ] "View" link filters the worktree list to status=stale

## Data Models / API

```typescript
function getStaleWorktrees(data: DashboardData): WorktreeRecord[];
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement StaleWarningBanner component | Not Started |
| 2 | Implement collapsed banner for 10+ stale worktrees | Not Started |
| 3 | Implement "View all" link (filters list to stale status) | Not Started |
| 4 | Implement CLI command display with copy button | Not Started |
| 5 | Implement pulsing orange indicator for stale rows in the list | Not Started |
| 6 | Add tests: banner rendering, collapse threshold, filter link, no-stale state | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Shows warning and CLI command text, does not execute cleanup |
| WS-003 | Cleanup shown as CLI command, not Dashboard action | Displays `nexus worktree clean --stale` as text instruction |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Placement | Should the stale banner also appear on the Overview page? | Yes — stale worktrees are important enough for the summary view. Show a compact version on Overview. | Yes, compact version on Overview too. Cross-reference keeps stale worktrees visible. |

## Status

`Approved`
