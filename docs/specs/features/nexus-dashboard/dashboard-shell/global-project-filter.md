# Feature Spec: Global Project Filter

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

All Dashboard views need a consistent way to filter by project — a single dropdown in the header that narrows every view to one project or shows all.

## Acceptance Criteria

- [ ] Dropdown in the header showing all known projects plus "All Projects" option
- [ ] Selecting a project filters all views (sessions, events, worktrees) to that project
- [ ] Default: "All Projects" (no filter)
- [ ] Filter state persists across view navigation (stored in URL query param or localStorage)
- [ ] Project list derived from loaded data (no manual configuration)
- [ ] Configurable default project via `~/.nexus/config.json` (`dashboard.defaultProject`)
- [ ] Filter passed to `/api/data?project=<path>` for server-side filtering

## Data Models / API

```typescript
// Project filter state
interface ProjectFilterState {
  selected: string | null;        // null = all projects
  available: string[];            // Derived from data
}

// Filter is passed as query param to API
// GET /api/data?project=C:/GitHub/Cluiche
// GET /api/summary?project=C:/GitHub/Cluiche
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement project dropdown component in the header | Done |
| 2 | Derive available projects from `DashboardData.projects` | Done |
| 3 | Implement filter state persistence (URL query param `?project=`) | Done |
| 4 | Wire filter to API calls — pass `project` param to `/api/data` and `/api/summary` | Done |
| 5 | Load default project from config if set | Done |
| 6 | Add tests: filter selection, persistence, API param passing, empty state | Done |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-007 | Centralized storage | Projects derived from centralized data covering all projects |
| DD-004 | Global project filter in header | This feature *is* the global project filter |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Display | How to display project paths — full path or just project name? | Project name (last directory component) by default, full path in tooltip. If names collide, show enough path to disambiguate. | Project name with tooltip. Disambiguate on collision. |
| 2 | Persistence | URL query param or localStorage for filter state? | URL query param (`?project=Cluiche`) — shareable, works with back button, consistent with view filters (SV-002, ET-004) | URL query param. Consistent with all other filters. |

## Status

`Done`
