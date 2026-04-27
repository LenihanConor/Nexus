# System Spec: Session Views

## Parent Application

@docs/specs/applications/nexus-dashboard.md

## Purpose

Session Views owns the visual representation of agent sessions in the Dashboard. It provides three connected views: a filterable session list, a detail drilldown showing snapshots and associated data, and a lineage tree visualisation showing parent-child session relationships.

This is where the Session Registry's data becomes human-readable. The developer can see at a glance what sessions are running, drill into any session's history, and trace the full lineage of how a piece of work evolved across multiple agent sessions.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Session List | Filterable, sortable table of sessions with status indicators, project, agent type, and duration | @docs/specs/features/nexus-dashboard/session-views/session-list.md | Done |
| Session Detail | Drilldown view showing full session record, snapshots timeline, associated worktrees and events | @docs/specs/features/nexus-dashboard/session-views/session-detail.md | Done |
| Lineage Tree | Visual tree rendering of parent-child session relationships with status colouring | @docs/specs/features/nexus-dashboard/session-views/lineage-tree.md | Done |
| Session Filters | Filter by status, project, agent type, time range; combinable; persists during navigation | @docs/specs/features/nexus-dashboard/session-views/session-filters.md | Done |

## Public Interfaces

### View Registration

Registers with Dashboard Shell's view registry:

```typescript
{
  id: "sessions",
  label: "Sessions",
  route: "/sessions",
  icon: "terminal",
  component: SessionsView,
  order: 2              // After Overview (1)
}
```

### Routes

| Route | View | Description |
|-------|------|-------------|
| `/sessions` | Session List | Filterable list of all sessions |
| `/sessions/:id` | Session Detail | Full detail for a single session |
| `/sessions/:id/lineage` | Lineage Tree | Visual tree rooted at or containing this session |

### Data Consumed

All data comes from Dashboard Shell's data layer (`/api/data`):

```typescript
// From DashboardData
sessions: SessionRecord[];        // Deduplicated current state
events: NexusEvent[];             // For session-associated events
worktrees: WorktreeRecord[];      // For session-associated worktrees
```

No server API endpoints of its own — pure frontend component.

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Dashboard Shell | Layout container, data layer (`/api/data`), project filter state, view registry |
| `packages/shared` — Session types | `SessionRecord`, `SessionSnapshot`, `SessionStatus` types |
| `packages/shared` — Event schema | `NexusEvent` type for filtering session-associated events |
| `packages/shared` — Worktree types | `WorktreeRecord` type for showing session-associated worktrees |

## Architecture

### Session List View

```
┌─────────────────────────────────────────────────────────────────┐
│  Sessions                                                       │
│                                                                 │
│  [Status ▼] [Agent ▼] [Time Range ▼]            [Search...]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ● Running  │ claude-code │ Cluiche │ "Add auth flow"  │ 12m││
│  │ ● Running  │ aider       │ Nexus   │ "Fix lint errors" │  3m││
│  │ ○ Complete │ claude-code │ Cluiche │ "Write tests"     │ 45m││
│  │ ◌ Stale    │ cursor      │ Cluiche │ "Refactor API"    │  2h││
│  │ ✕ Failed   │ claude-code │ Nexus   │ "Update deps"     │  8m││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Showing 5 of 23 sessions                        [< 1 2 3 >]   │
└─────────────────────────────────────────────────────────────────┘
```

**Columns:** Status indicator, agent type, project, task description, duration
**Sort:** By created_at (default, newest first), status, duration, project
**Pagination:** 20 sessions per page
**Click:** Row click navigates to Session Detail

### Status Indicators

| Status | Indicator | Colour |
|--------|-----------|--------|
| `running` | ● | Green |
| `paused` | ◐ | Yellow |
| `completed` | ○ | Grey |
| `failed` | ✕ | Red |
| `interrupted` | ⚠ | Orange |
| `stale` | ◌ | Orange (pulsing) |

### Session Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Sessions    Session: abc-1234                     ● Running  │
│                                                                 │
│  Project: C:/GitHub/Cluiche                                     │
│  Agent: claude-code          PID: 12345                         │
│  Task: "Add authentication flow"                                │
│  Started: 2026-04-26 14:30    Duration: 12m                     │
│  Correlation: xyz-5678        Parent: def-9012                  │
│                                                                 │
│  ┌─── Snapshots Timeline ───────────────────────────────────┐   │
│  │                                                           │   │
│  │  14:30 ── session_started                                 │   │
│  │  14:33 ── task_1_completed: "Set up auth middleware"      │   │
│  │           Files: src/auth/middleware.ts, src/config.ts     │   │
│  │  14:38 ── task_2_completed: "Add login endpoint"          │   │
│  │           Files: src/auth/login.ts, src/routes.ts         │   │
│  │           Decision: "Used JWT over session tokens"        │   │
│  │  14:42 ── (now) task 3 in progress                        │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Associated Worktree ──────────────────────────────────┐   │
│  │  Branch: feature/add-auth   Status: active                │   │
│  │  Path: C:/GitHub/.nexus-worktrees/cluiche-feature-add-auth│   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Recent Events (this session) ────────────────────────┐    │
│  │  14:42  worktree.created    feature/add-auth              │   │
│  │  14:38  session.updated     task_2_completed              │   │
│  │  14:33  session.updated     task_1_completed              │   │
│  │  14:30  session.started     Add authentication flow       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [View Lineage]  [View All Events]                              │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. **Header** — session metadata (project, agent, task, timing, links to parent/correlation)
2. **Snapshots Timeline** — chronological list of state snapshots with files changed and decisions
3. **Associated Worktree** — the worktree tied to this session (if any)
4. **Recent Events** — events filtered to this session ID
5. **Navigation** — links to lineage view and full event list

### Lineage Tree View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Session Detail    Lineage: abc-1234                          │
│                                                                 │
│  Correlation: xyz-5678  "Implement auth feature"                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ○ Session A: "Implement auth feature"      [45m, done]  │  │
│  │  ├── ● Session B: "Write auth middleware"   [12m, running]│  │
│  │  │   └── ○ Session D: "Fix middleware bug"  [3m, done]    │  │
│  │  └── ○ Session C: "Write auth tests"        [20m, done]  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Click any node to view session detail.                         │
│  Current session highlighted: ● Session B                       │
└─────────────────────────────────────────────────────────────────┘
```

**Rendering:**
- Tree layout with indentation (simple) or graphical nodes with edges (using a tree/DAG library)
- Status-coloured nodes matching the status indicator palette
- Current session highlighted with a distinct style
- Click any node to navigate to that session's detail view
- Collapse/expand for deep trees (default expand to depth 3)

### Data Derivation

Session Views does not fetch data independently. It derives what it needs from the shell's `DashboardData`:

```typescript
// Session list: filter and sort sessions
function getSessionList(data: DashboardData, filters: SessionFilters): SessionRecord[];

// Session detail: enrich with associated data
function getSessionDetail(data: DashboardData, sessionId: string): {
  session: SessionRecord;
  worktree: WorktreeRecord | null;     // Worktree with matching session_id
  events: NexusEvent[];                // Events with matching session_id
};

// Lineage: build tree from session parent pointers
function getSessionLineage(data: DashboardData, sessionId: string): {
  root: SessionRecord;
  tree: SessionTreeNode[];             // Nested tree structure for rendering
  pathToTarget: string[];              // Session IDs from root to target
};

interface SessionTreeNode {
  session: SessionRecord;
  children: SessionTreeNode[];
}
```

## Implementation Patterns

### Component Structure

```
SessionsView/
├── SessionList.tsx           # List view with table, filters, pagination
├── SessionDetail.tsx         # Detail drilldown with snapshots, worktree, events
├── SessionLineage.tsx        # Tree visualisation
├── SessionFilters.tsx        # Filter controls (status, agent, time range)
├── SessionStatusBadge.tsx    # Reusable status indicator
├── SnapshotTimeline.tsx      # Vertical timeline of snapshots
└── LineageTree.tsx           # Tree rendering component
```

### Tree Rendering

- Start simple: indented list with status icons and connecting lines (CSS-only)
- If more sophistication is needed: use a lightweight tree library (e.g., react-d3-tree, custom SVG)
- Max rendered depth: 20 (matches Session Registry SR AI Q2)
- Default expanded depth: 3; deeper nodes collapsed with expand control

### Filtering

- Filters stored as URL query params for shareability and back-button support
- Combined with the global project filter from the shell
- Filter logic runs client-side on the already-loaded `DashboardData`

### Navigation

- Session List → click row → Session Detail
- Session Detail → "View Lineage" → Lineage Tree
- Session Detail → click parent/correlation link → that session's Detail
- Lineage Tree → click node → Session Detail
- All navigation uses client-side routing (no page reload)

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All components written in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | No direct file access; consumes data from Dashboard Shell which reads JSONL |
| PD-003 | Local-only deployment for v1 | Rendered in local browser only |
| PD-006 | Core and Dashboard are separate apps | No Core imports; session types via `packages/shared` |
| PD-007 | Centralized storage in `~/.nexus/` | Data includes sessions from all projects; project filter from shell applies |
| DD-001 | Dashboard is strictly read-only | Session Views is read-only; no mutation endpoints or actions |
| DD-003 | Direct JSONL file reads, no Core API | Data from shell's file-based polling; no Core API |
| DD-004 | Global project filter in header | Session list and detail respect the shell's project filter |
| DS-001 | Server-side polling with in-memory cache | Consumes cached data from shell; no independent polling |
| DS-003 | SPA architecture | Components render within the SPA shell |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| SV-001 | Start with CSS-indented tree, not a graph library | Simplest rendering for v1; session trees are typically shallow (3-5 levels); avoids heavy dependency; upgrade path is clear | System | Accepted | No |
| SV-002 | Filters stored as URL query params | Enables back-button navigation and shareable filtered views; consistent with SPA conventions | System | Accepted | Yes |
| SV-003 | Session detail shows associated worktree and events inline | Avoids constant navigation between views; one page tells the full story of a session | System | Accepted | No |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Performance | What if there are thousands of sessions? Client-side filtering and rendering could lag. | Pagination (20 per page) prevents rendering bottlenecks. Client-side filter on pre-loaded data is fast even at 10K records. If it gets worse, add server-side pagination to `/api/data`. |
| 2 | Lineage | What if sessions from different projects share a correlation ID? The tree would mix projects. | Correlation IDs are UUID v4 — collisions are near-impossible. If the user explicitly sets a correlation ID across projects (legitimate use case), the tree should show it. Project filter can narrow the view. |
| 3 | Detail View | What if a session has 50+ snapshots? The timeline gets unwieldy. | Collapse older snapshots with a "Show N earlier snapshots" toggle. Show the 10 most recent by default. |
| 4 | Stale Sessions | How prominently should stale sessions be shown? They could clutter the list. | Show a banner at the top of the session list: "N stale sessions detected — [View]". Stale sessions visible in the list with pulsing orange indicator but can be filtered out. |
| 5 | Empty State | What does the session list show when there are no sessions? | Friendly empty state: "No sessions recorded yet. Start an agent with `nexus run` to see sessions here." Consistent with Dashboard Shell's empty state pattern. |
| 6 | Accessibility | Should the status indicators be accessible beyond colour? | Yes — each status has both a colour and a distinct symbol (●, ◐, ○, ✕, ⚠, ◌). Tooltip on hover with status text. Sufficient for v1; ARIA labels as a future enhancement. |

## Status

`Done`
