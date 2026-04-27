# System Spec: Event Timeline

## Parent Application

@docs/specs/applications/nexus-dashboard.md

## Purpose

Event Timeline owns the chronological event stream view in the Dashboard. It renders the Audit Trail as a filterable, scrollable timeline — the raw "what happened" feed across all projects and sessions. Developers use it to understand the sequence of actions, trace causality between events, and investigate what happened during a session or across sessions.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Event Stream | Chronological scrollable list of events with type icons, timestamps, and summary text | @docs/specs/features/nexus-dashboard/event-timeline/event-stream.md | Done |
| Event Detail | Expandable/click-through view showing the full event payload as formatted JSON | @docs/specs/features/nexus-dashboard/event-timeline/event-detail.md | Done |
| Event Filters | Filter by project, session, agent, event type, correlation ID, and time range; combinable | @docs/specs/features/nexus-dashboard/event-timeline/event-filters.md | Done |
| Live Tail Mode | Auto-scroll to latest events as they arrive via polling; toggle on/off | @docs/specs/features/nexus-dashboard/event-timeline/live-tail-mode.md | Done |

## Public Interfaces

### View Registration

```typescript
{
  id: "events",
  label: "Events",
  route: "/events",
  icon: "activity",
  component: EventsView,
  order: 3              // After Sessions (2)
}
```

### Routes

| Route | View | Description |
|-------|------|-------------|
| `/events` | Event Stream | Filterable chronological timeline |
| `/events/:id` | Event Detail | Full payload view for a single event (or inline expand) |

### Data Consumed

From Dashboard Shell's data layer (`/api/data`):

```typescript
events: NexusEvent[];             // Today's events (or visible time range)
sessions: SessionRecord[];        // For resolving session links
worktrees: WorktreeRecord[];      // For resolving worktree links
```

No server API endpoints of its own — pure frontend component.

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Dashboard Shell | Layout container, data layer (`/api/data`), project filter state, view registry |
| `packages/shared` — Event schema | `NexusEvent` type for rendering events |
| `packages/shared` — Session types | `SessionRecord` for resolving session links in events |
| `packages/shared` — Worktree types | `WorktreeRecord` for resolving worktree links in events |

## Architecture

### Event Stream View

```
┌─────────────────────────────────────────────────────────────────┐
│  Events                                          [Live Tail: ON]│
│                                                                 │
│  [Type ▼] [Session ▼] [Agent ▼] [Time Range ▼]  [Search...]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 14:42:03  ◆ worktree.created                                ││
│  │           Cluiche │ claude-code │ feature/add-auth           ││
│  │                                                             ││
│  │ 14:42:01  ◆ session.started                                 ││
│  │           Cluiche │ claude-code │ "Add auth flow"            ││
│  │                                                             ││
│  │ 14:38:15  ◇ session.updated                                 ││
│  │           Nexus │ aider │ task_2_completed                   ││
│  │                                                             ││
│  │ 14:35:00  ◆ worktree.merged                                 ││
│  │           Cluiche │ claude-code │ feature/fix-tests → main   ││
│  │                                                             ││
│  │ 14:30:22  ◇ session.ended                                   ││
│  │           Cluiche │ claude-code │ completed (exit 0, 45m)    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Showing 5 of 142 events today                   [< 1 2 3 >]   │
└─────────────────────────────────────────────────────────────────┘
```

**Each event row shows:**
1. Timestamp (HH:MM:SS)
2. Type icon (namespaced — different icon per event category)
3. Event type name
4. Summary line: project, agent, and a human-readable description derived from the payload

**Sort:** Newest first (default), toggle to oldest first
**Pagination:** 50 events per page

### Event Type Icons

| Category | Icon | Event Types |
|----------|------|-------------|
| Session | ◇ | `session.started`, `session.updated`, `session.ended`, `session.stale_detected` |
| Worktree | ◆ | `worktree.created`, `worktree.merged`, `worktree.merge_failed`, `worktree.cleaned`, `worktree.conflict_detected`, `worktree.stale_detected` |
| Audit | ● | `audit.started` |
| Other | ○ | Any future event types (budget, approval, etc.) |

### Event Detail (Expanded)

Click an event row to expand inline (or navigate to `/events/:id`):

```
┌─────────────────────────────────────────────────────────────────┐
│  ▼ 14:42:03  ◆ worktree.created                                │
│                                                                 │
│  Event ID:       evt-abc-1234                                   │
│  Timestamp:      2026-04-26T14:42:03.456Z                       │
│  Project:        C:/GitHub/Cluiche                               │
│  Session:        ses-def-5678  →  [View Session]                │
│  Agent:          claude-code                                     │
│  Correlation:    cor-ghi-9012                                    │
│                                                                 │
│  Payload:                                                       │
│  {                                                              │
│    "worktree_id": "wt-jkl-3456",                                │
│    "branch": "feature/add-auth",                                │
│    "parent_branch": "main",                                     │
│    "path": "C:/GitHub/.nexus-worktrees/cluiche-feature-add-auth"│
│    "scope": ["src/auth/", "src/config.ts"]                      │
│  }                                                              │
│                                                                 │
│  [View Session]  [View Worktree]                                │
└─────────────────────────────────────────────────────────────────┘
```

**Links:** Session ID and worktree ID link to their respective detail views.

### Live Tail Mode

- Toggle button in the header: "Live Tail: ON / OFF"
- When ON: auto-scroll to show newest events as they arrive via polling refresh
- When OFF: stay at current scroll position; new events appear above but don't push the view
- Visual indicator when new events are available but not scrolled into view: "↑ 3 new events"
- Default: OFF (less disorienting)

### Event Summary Generation

Each event type has a human-readable summary derived from its payload:

```typescript
function summarizeEvent(event: NexusEvent): string {
  switch (event.event_type) {
    case "session.started":
      return event.payload.task_description;
    case "session.ended":
      return `${event.payload.status} (exit ${event.payload.exit_code}, ${formatDuration(event.payload.duration_ms)})`;
    case "session.updated":
      return event.payload.snapshot_label || "status updated";
    case "worktree.created":
      return event.payload.branch;
    case "worktree.merged":
      return `${event.payload.branch} → ${event.payload.merge_result?.success ? "success" : "conflicts"}`;
    case "worktree.conflict_detected":
      return `${event.payload.overlapping_paths?.length} overlapping paths`;
    default:
      return event.event_type;
  }
}
```

Unknown event types fall back to showing the event type name — extensible as new systems add new event types.

### Data Derivation

```typescript
// Filtered and sorted events for the stream
function getEventList(data: DashboardData, filters: EventFilters): NexusEvent[];

// Single event with resolved links
function getEventDetail(data: DashboardData, eventId: string): {
  event: NexusEvent;
  session: SessionRecord | null;      // Resolved from session_id
  worktree: WorktreeRecord | null;    // Resolved from payload worktree_id (if applicable)
};

interface EventFilters {
  project?: string;
  session_id?: string;
  correlation_id?: string;
  agent_id?: string;
  event_type?: string;                // Exact or prefix (e.g., "worktree.*")
  from?: string;
  to?: string;
  search?: string;                    // Free-text search across type + summary
}
```

## Implementation Patterns

### Component Structure

```
EventsView/
├── EventStream.tsx           # Main timeline list with pagination
├── EventRow.tsx              # Single event row (collapsed)
├── EventDetail.tsx           # Expanded event detail with payload
├── EventFilters.tsx          # Filter controls
├── EventTypeIcon.tsx         # Icon mapping by event category
├── EventSummary.tsx          # Human-readable summary generation
└── LiveTailToggle.tsx        # Auto-scroll toggle control
```

### Filtering

- Filters stored as URL query params (consistent with Session Views SV-002)
- Combined with global project filter from the shell
- Client-side filtering on pre-loaded `DashboardData.events`
- Free-text search matches against event type and generated summary

### Time Range

- Default: today (current day's events)
- User can select a date range; shell fetches additional event files via `/api/data?eventsFrom=&eventsTo=`
- Date picker or quick-select buttons: "Today", "Yesterday", "Last 7 days"

### Payload Rendering

- Format payload as syntax-highlighted JSON
- Collapse large payloads (>10 keys) with "Show all" toggle
- Linkify known ID fields (session_id → Session Detail, worktree_id → Worktree Detail)

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All components written in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | No direct file access; consumes data from Dashboard Shell |
| PD-003 | Local-only deployment for v1 | Rendered in local browser only |
| PD-006 | Core and Dashboard are separate apps | No Core imports; event types via `packages/shared` |
| PD-007 | Centralized storage in `~/.nexus/` | Events from all projects shown; project filter applies |
| DD-001 | Dashboard is strictly read-only | Event Timeline is read-only; no mutation |
| DD-003 | Direct JSONL file reads, no Core API | Data from shell's file-based polling |
| DD-004 | Global project filter in header | Event list respects the shell's project filter |
| DS-001 | Server-side polling with in-memory cache | Consumes cached data from shell |
| DS-003 | SPA architecture | Components render within the SPA shell |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| ET-001 | Inline expand for event detail, not a separate page | Events are small; expanding in-place is faster than navigating away; keeps timeline context visible | System | Accepted | No |
| ET-002 | Live Tail defaults to OFF | Less disorienting; user opts in when they want real-time monitoring; consistent with terminal tail behaviour | System | Accepted | No |
| ET-003 | Event summary generation is a client-side switch statement | Simple, no server logic; new event types fall back to showing the type name; easy to extend | System | Accepted | Yes |
| ET-004 | Filters stored as URL query params | Consistent with Session Views (SV-002); enables shareable filtered views and back-button navigation | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Performance | With 1000+ events per day, is client-side filtering fast enough? | Yes — filtering an in-memory array of 1000 objects by field values is sub-millisecond. Pagination at 50 per page limits rendering. Multi-day ranges could grow larger; server-side filtering in `/api/data` handles that. |
| 2 | Time Range | How does the shell know to load additional day files when the user selects "Last 7 days"? | The `eventsFrom`/`eventsTo` params on `/api/data` tell the shell which day files to read. Shell only loads today by default; historical range triggers additional file reads. |
| 3 | Extensibility | Future event types (budget, approval) will need new icons and summaries. Is the switch statement maintainable? | At <20 event types it's fine. If it grows, refactor to a registry pattern (map of type → {icon, summarize}). For now, the fallback handles unknown types gracefully. |
| 4 | Search | Free-text search across event type and summary — is this enough? | For v1, yes. Users can also filter by specific fields. Full-text search of payloads would require indexing — defer to Phase 2 if needed. |
| 5 | Payload Links | Linkifying IDs in the JSON payload requires knowing which fields are IDs. How? | Convention: fields ending in `_id` that match known patterns (session_id, worktree_id) are linkified. Unknown `_id` fields shown as plain text. Simple regex match on field names. |
| 6 | Empty State | What shows when there are no events for the selected time range? | "No events found for this time range." with suggestion to adjust filters. If no events exist at all: "No events recorded yet. Start an agent with `nexus run` to see events here." |

## Status

`Done`
