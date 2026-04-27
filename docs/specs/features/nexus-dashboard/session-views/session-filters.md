# Feature Spec: Session Filters

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Session Views | @docs/specs/systems/nexus-dashboard/session-views.md |

## Problem Statement

The session list needs filter controls that let developers narrow by status, agent type, and time range — combinable, persistent, and sharable via URL.

## Acceptance Criteria

- [ ] Status filter: multi-select dropdown (running, paused, completed, failed, interrupted, stale)
- [ ] Agent type filter: dropdown derived from available agent types in data
- [ ] Time range filter: preset options (Today, Yesterday, Last 7 days, Last 30 days, All) plus custom date picker
- [ ] Free-text search across task description
- [ ] Filters combinable (AND logic)
- [ ] Filter state stored in URL query params (per SV-002)
- [ ] Combined with global project filter from the shell
- [ ] Clear all filters button
- [ ] Filter client-side on pre-loaded data

## Data Models / API

```typescript
interface SessionFilters {
  status?: SessionStatus[];
  agent_type?: string;
  from?: string;
  to?: string;
  search?: string;
}

// Serialize/deserialize to URL query params
function filtersToParams(filters: SessionFilters): URLSearchParams;
function paramsToFilters(params: URLSearchParams): SessionFilters;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement SessionFilters component with status, agent, time range controls | Done |
| 2 | Implement URL query param serialization/deserialization | Done |
| 3 | Implement free-text search input with debounce | Done |
| 4 | Implement "Clear all filters" button | Done |
| 5 | Derive available agent types from loaded session data | Done |
| 6 | Add tests: filter combination, URL sync, clear, debounce | Done |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-004 | Global project filter | Session filters combine with shell's project filter |
| SV-002 | Filters in URL query params | All filter state stored in URL |
| ET-004 | Consistent filter URL params | Same URL param pattern as Event Timeline filters |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Debounce | How long to debounce the search input? | 300ms — fast enough to feel responsive, slow enough to avoid filtering on every keystroke | 300ms debounce. |

## Status

`Done`
