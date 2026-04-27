# Feature Spec: Event Filters

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Event Timeline | @docs/specs/systems/nexus-dashboard/event-timeline.md |

## Problem Statement

The event stream needs filter controls to narrow by event type, session, agent, correlation ID, and time range — so developers can focus on the events that matter.

## Acceptance Criteria

- [ ] Event type filter: dropdown with known event types grouped by category (session.*, worktree.*, audit.*)
- [ ] Session filter: dropdown or text input for session ID
- [ ] Agent filter: dropdown derived from available agent types
- [ ] Correlation ID filter: text input
- [ ] Time range: preset options plus custom date picker (shared with Event Stream)
- [ ] Free-text search across event type and summary
- [ ] Filters combinable (AND logic)
- [ ] Filter state stored in URL query params (per ET-004)
- [ ] Combined with global project filter
- [ ] Clear all filters button

## Data Models / API

```typescript
interface EventFilters {
  project?: string;
  session_id?: string;
  correlation_id?: string;
  agent_id?: string;
  event_type?: string;
  from?: string;
  to?: string;
  search?: string;
}

function filtersToParams(filters: EventFilters): URLSearchParams;
function paramsToFilters(params: URLSearchParams): EventFilters;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement EventFilters component with type, session, agent, correlation controls | Not Started |
| 2 | Implement event type dropdown with category grouping | Not Started |
| 3 | Implement URL query param serialization/deserialization | Not Started |
| 4 | Implement free-text search with debounce (300ms) | Not Started |
| 5 | Implement "Clear all filters" button | Not Started |
| 6 | Add tests: filter combination, URL sync, clear, category grouping | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-004 | Global project filter | Event filters combine with shell's project filter |
| ET-004 | Filters in URL query params | All filter state in URL |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Type Filter | Should the event type filter support prefix matching (like the CLI) or exact selection from a list? | List selection with categories. Prefix matching is a CLI pattern; UI users expect to pick from a list. | List selection with categories. Each category expandable. "All session events" checkbox per category. |

## Status

`Approved`
