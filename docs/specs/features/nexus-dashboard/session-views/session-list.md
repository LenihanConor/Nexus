# Feature Spec: Session List

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Session Views | @docs/specs/systems/nexus-dashboard/session-views.md |

## Problem Statement

Developers need a filterable, sortable table of all sessions to quickly see what's running, what's finished, and what's gone wrong.

## Acceptance Criteria

- [ ] Table showing: status indicator, agent type, project, task description, duration
- [ ] Sortable by: created_at (default, newest first), status, duration, project
- [ ] Filterable by: status, agent type, time range
- [ ] Combinable with global project filter
- [ ] Pagination: 20 sessions per page
- [ ] Click row → navigate to Session Detail
- [ ] Status indicators use colour + distinct symbols (per Session Views spec)
- [ ] Stale session banner at top when stale sessions exist
- [ ] Empty state: friendly message with instructions
- [ ] Search: free-text search across task description

## Data Models / API

```typescript
interface SessionFilters {
  status?: SessionStatus | SessionStatus[];
  agent_type?: string;
  from?: string;
  to?: string;
  search?: string;
}

function getSessionList(data: DashboardData, filters: SessionFilters): SessionRecord[];
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement SessionList component with table rendering | Not Started |
| 2 | Implement column sorting (click header to toggle) | Not Started |
| 3 | Implement SessionFilters component (status, agent, time range dropdowns) | Not Started |
| 4 | Implement pagination (20 per page) | Not Started |
| 5 | Implement SessionStatusBadge component (colour + symbol) | Not Started |
| 6 | Implement stale session banner | Not Started |
| 7 | Implement free-text search | Not Started |
| 8 | Add tests: filtering, sorting, pagination, empty state, stale banner | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Table is display-only |
| DD-004 | Global project filter | Respects shell's project filter |
| SV-002 | Filters in URL query params | Filter state stored in URL for back-button and shareability |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Duration | Show duration for running sessions as live-updating counter or static "started X ago"? | Static "12m ago" that updates on each data refresh. Live counter adds complexity for minimal value. | Static, updates on refresh. Simpler, sufficient. |

## Status

`Approved`
