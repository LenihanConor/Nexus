# Feature Spec: Session Detail

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Session Views | @docs/specs/systems/nexus-dashboard/session-views.md |

## Problem Statement

Developers need a single-page view of a session's full story — metadata, snapshot timeline, associated worktree, and related events — without navigating between views.

## Acceptance Criteria

- [ ] Route: `/sessions/:id`
- [ ] Header: session metadata (project, agent, task, timing, status, correlation link, parent link)
- [ ] Snapshot timeline: chronological list of snapshots with labels, files changed, and decisions
- [ ] Associated worktree: shows the worktree tied to this session (if any) with status
- [ ] Recent events: events filtered to this session ID (last 20)
- [ ] Navigation: "View Lineage" button, "View All Events" link
- [ ] Clickable parent/correlation links navigate to other sessions
- [ ] Handles missing session gracefully (404 with back link)
- [ ] Snapshots collapsed if >10 with "Show N earlier" toggle (per Session Views AI Q3)

## Data Models / API

```typescript
function getSessionDetail(data: DashboardData, sessionId: string): {
  session: SessionRecord;
  worktree: WorktreeRecord | null;
  events: NexusEvent[];
} | null;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement SessionDetail component with metadata header | Not Started |
| 2 | Implement SnapshotTimeline component (vertical timeline with expand/collapse) | Not Started |
| 3 | Implement associated worktree section with link to worktree detail | Not Started |
| 4 | Implement session events section (filtered event list) | Not Started |
| 5 | Wire up navigation links (parent, correlation, lineage, events) | Not Started |
| 6 | Add 404 handling for invalid session IDs | Not Started |
| 7 | Add tests: detail rendering, snapshot collapse, missing session, navigation | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only, no mutations |
| SV-003 | Detail shows worktree and events inline | All associated data on one page |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Events | Should the event list in detail show the same rich format as Event Timeline, or simplified? | Simplified — timestamp, type, summary. Click "View All Events" to get the full Event Timeline filtered to this session. | Simplified inline list. Full detail via Event Timeline link. |

## Status

`Approved`
