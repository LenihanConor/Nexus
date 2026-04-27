# Feature Spec: Event Stream

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Event Timeline | @docs/specs/systems/nexus-dashboard/event-timeline.md |

## Problem Statement

Developers need a chronological, scrollable list of all events with type icons, timestamps, and human-readable summaries to see what's happening across all systems.

## Acceptance Criteria

- [ ] Chronological list of events with: timestamp, type icon, event type name, summary line
- [ ] Summary line shows: project, agent, and payload-derived description (using `summarizeEvent()` from shared)
- [ ] Sort: newest first (default), toggle to oldest first
- [ ] Pagination: 50 events per page
- [ ] Default time range: today
- [ ] Time range selector: Today, Yesterday, Last 7 days, custom date picker
- [ ] Event type icons grouped by category (session, worktree, audit, other)
- [ ] Empty state with helpful message

## Data Models / API

```typescript
function getEventList(data: DashboardData, filters: EventFilters): NexusEvent[];
```

Uses `summarizeEvent()` from `packages/shared` for human-readable summaries.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement EventStream component with event list rendering | Not Started |
| 2 | Implement EventRow component (timestamp, icon, type, summary) | Not Started |
| 3 | Implement EventTypeIcon component (category-based icon mapping) | Not Started |
| 4 | Implement EventSummary using shared `summarizeEvent()` | Not Started |
| 5 | Implement sort toggle (newest/oldest first) | Not Started |
| 6 | Implement pagination (50 per page) | Not Started |
| 7 | Implement time range selector with quick presets and custom date picker | Not Started |
| 8 | Add tests: rendering, sorting, pagination, time range, empty state | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only event list |
| ET-003 | Event summary is client-side switch | Uses shared `summarizeEvent()` |
| ET-004 | Filters in URL query params | Filter state in URL |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Time Range | How does selecting "Last 7 days" trigger loading additional event files? | Updates the `eventsFrom` param in the API call to `/api/data`. Server reads the relevant day files. | URL param change triggers API call with `eventsFrom`. Server handles multi-file reads. |

## Status

`Approved`
