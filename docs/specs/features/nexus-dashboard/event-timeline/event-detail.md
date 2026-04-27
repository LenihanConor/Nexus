# Feature Spec: Event Detail

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Event Timeline | @docs/specs/systems/nexus-dashboard/event-timeline.md |

## Problem Statement

Developers need to see the full payload of an event — including all metadata and linked entities — when investigating what happened.

## Acceptance Criteria

- [ ] Click an event row to expand inline (per ET-001)
- [ ] Expanded view shows: all event fields (id, timestamp, type, project, session, agent, correlation) and full payload as formatted JSON
- [ ] Payload rendered as syntax-highlighted JSON
- [ ] Large payloads (>10 keys) collapsed with "Show all" toggle
- [ ] Known ID fields in payload are linkified (session_id → Session Detail, worktree_id → Worktree Detail)
- [ ] Linkification uses convention: fields ending in `_id` matching known patterns (per Event Timeline AI Q5)
- [ ] Collapse event back to row by clicking again

## Data Models / API

```typescript
function getEventDetail(data: DashboardData, eventId: string): {
  event: NexusEvent;
  session: SessionRecord | null;
  worktree: WorktreeRecord | null;
};
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement EventDetail component with inline expand/collapse | Not Started |
| 2 | Implement JSON payload rendering with syntax highlighting | Not Started |
| 3 | Implement payload collapse for large payloads (>10 keys) | Not Started |
| 4 | Implement ID field linkification (detect `_id` fields, link to appropriate views) | Not Started |
| 5 | Add navigation links to associated session and worktree | Not Started |
| 6 | Add tests: expand/collapse, JSON rendering, linkification, large payloads | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only |
| ET-001 | Inline expand, not separate page | Expands in-place within the event stream |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Highlighting | Which JSON syntax highlighting approach? | CSS classes on parsed tokens — no heavy library needed for simple JSON highlighting. Or use a lightweight lib like `highlight.js` JSON grammar. | CSS classes on parsed tokens. Lightweight, no dependency. JSON is simple enough for manual tokenization. |

## Status

`Approved`
