# System Spec: Worktree Status

## Parent Application

@docs/specs/applications/nexus-dashboard.md

## Purpose

Worktree Status owns the visual representation of git worktrees in the Dashboard. It shows active worktrees grouped by project, highlights scope conflicts between concurrent agents, displays merge status, and warns about stale orphaned worktrees. This is where the developer sees "who is working where, and is anything colliding?"

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Worktree List | Worktrees grouped by project with status indicators, branch names, and owning sessions | @docs/specs/features/nexus-dashboard/worktree-status/worktree-list.md | Planned |
| Worktree Detail | Drilldown view showing full record, scope, merge result, associated session and events | @docs/specs/features/nexus-dashboard/worktree-status/worktree-detail.md | Planned |
| Conflict Indicators | Visual highlighting when two active worktrees in the same project have overlapping scope | @docs/specs/features/nexus-dashboard/worktree-status/conflict-indicators.md | Planned |
| Stale Warnings | Banner and visual indicators for orphaned worktrees that need cleanup | @docs/specs/features/nexus-dashboard/worktree-status/stale-warnings.md | Planned |

## Public Interfaces

### View Registration

```typescript
{
  id: "worktrees",
  label: "Worktrees",
  route: "/worktrees",
  icon: "git-branch",
  component: WorktreesView,
  order: 4              // After Events (3)
}
```

### Routes

| Route | View | Description |
|-------|------|-------------|
| `/worktrees` | Worktree List | Grouped by project, filterable by status |
| `/worktrees/:id` | Worktree Detail | Full detail for a single worktree |

### Data Consumed

From Dashboard Shell's data layer (`/api/data`):

```typescript
worktrees: WorktreeRecord[];      // Deduplicated current state
sessions: SessionRecord[];        // For resolving owning session links
events: NexusEvent[];             // For showing worktree-related events
```

No server API endpoints of its own — pure frontend component.

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Dashboard Shell | Layout container, data layer (`/api/data`), project filter state, view registry |
| `packages/shared` — Worktree types | `WorktreeRecord`, `WorktreeStatus`, `MergeResult` types |
| `packages/shared` — Session types | `SessionRecord` for resolving owning session |
| `packages/shared` — Event schema | `NexusEvent` for showing worktree-related events |

## Architecture

### Worktree List View

```
┌─────────────────────────────────────────────────────────────────┐
│  Worktrees                                                      │
│                                                                 │
│  [Status ▼]                                      [Search...]    │
│                                                                 │
│  ⚠ 1 stale worktree needs cleanup                [View]        │
│                                                                 │
│  ┌─── C:/GitHub/Cluiche (3 worktrees) ─────────────────────────┐│
│  │                                                             ││
│  │  ● active   │ feature/add-auth    │ claude-code │ ses-abc   ││
│  │             │ scope: src/auth/, src/config.ts               ││
│  │                                                             ││
│  │  ● active   │ bugfix/login-fix    │ aider       │ ses-def   ││
│  │             │ scope: src/auth/login.ts          ⚠ OVERLAP   ││
│  │                                                             ││
│  │  ◌ stale    │ feature/old-feature │ cursor      │ ses-ghi   ││
│  │             │ scope: src/utils/                              ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─── C:/GitHub/Nexus (1 worktree) ───────────────────────────┐ │
│  │                                                             ││
│  │  ○ merged   │ feature/add-events  │ claude-code │ ses-jkl   ││
│  │             │ merged to main (3 commits, no conflicts)      ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Grouped by project** — each project is a collapsible section showing its worktrees.

**Each worktree row shows:**
1. Status indicator
2. Branch name
3. Agent type
4. Owning session (linked)
5. Declared scope
6. Conflict badge if scope overlaps with another active worktree

### Status Indicators

| Status | Indicator | Colour |
|--------|-----------|--------|
| `active` | ● | Green |
| `completed` | ◐ | Blue |
| `merged` | ○ | Grey |
| `conflict` | ✕ | Red |
| `stale` | ◌ | Orange (pulsing) |
| `cleaned` | — | Hidden by default |

### Conflict Highlighting

When two active worktrees in the same project have overlapping declared scope:
- Both rows get an `⚠ OVERLAP` badge
- Overlapping paths shown in a tooltip or inline expansion
- Conflict banner at the top of the project group: "2 worktrees have overlapping scope"
- Colour: amber/warning — it's advisory (WI-002), not blocking

```
┌─── Scope Overlap Detail ────────────────────────────────────────┐
│  feature/add-auth (ses-abc) and bugfix/login-fix (ses-def)      │
│  share: src/auth/login.ts                                       │
│                                                                 │
│  This is advisory — agents may still work in parallel.          │
│  Risk: merge conflicts when both complete.                      │
└─────────────────────────────────────────────────────────────────┘
```

### Stale Worktree Banner

Shown at the top of the worktree list when any stale worktrees exist:

```
⚠ 1 stale worktree needs cleanup
  feature/old-feature in Cluiche — session ses-ghi is no longer running
  Clean up via: nexus worktree clean --stale
  [View]
```

### Worktree Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Worktrees    Worktree: wt-abc-1234                ● active   │
│                                                                 │
│  Project:        C:/GitHub/Cluiche                               │
│  Branch:         feature/add-auth                                │
│  Parent Branch:  main                                            │
│  Path:           C:/GitHub/.nexus-worktrees/cluiche-feature-...  │
│  Created:        2026-04-26 14:42                                │
│                                                                 │
│  Session:        ses-abc-5678  →  [View Session]                │
│  Agent:          claude-code                                     │
│  Task:           "Add authentication flow"                       │
│                                                                 │
│  ┌─── Declared Scope ──────────────────────────────────────────┐│
│  │  src/auth/                                                  ││
│  │  src/config.ts                                              ││
│  │  ⚠ Overlaps with bugfix/login-fix: src/auth/login.ts       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─── Merge Result ────────────────────────────────────────────┐│
│  │  (not yet merged)                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─── Recent Events ──────────────────────────────────────────┐ │
│  │  14:42  worktree.created    feature/add-auth                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [View Session]  [View All Events]                              │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. **Header** — worktree metadata (project, branch, path, timing)
2. **Owning Session** — linked to Session Detail
3. **Declared Scope** — file/directory list with conflict callouts
4. **Merge Result** — shown when merged or conflicted; lists conflicting files if applicable
5. **Recent Events** — worktree-related events
6. **Navigation** — links to session and full event list

### Data Derivation

```typescript
// Worktrees grouped by project
function getWorktreesByProject(data: DashboardData, filters: WorktreeFilters): Map<string, WorktreeRecord[]>;

// Conflict detection between active worktrees in same project
function detectOverlaps(worktrees: WorktreeRecord[]): OverlapReport[];

interface OverlapReport {
  worktree_a: WorktreeRecord;
  worktree_b: WorktreeRecord;
  overlapping_paths: string[];
}

// Single worktree with resolved links
function getWorktreeDetail(data: DashboardData, worktreeId: string): {
  worktree: WorktreeRecord;
  session: SessionRecord | null;
  events: NexusEvent[];               // Events with this worktree_id in payload
  overlaps: OverlapReport[];          // Overlaps involving this worktree
};

interface WorktreeFilters {
  project?: string;
  status?: WorktreeStatus | WorktreeStatus[];
  search?: string;
}
```

### Overlap Detection (Client-Side)

```typescript
function detectOverlaps(worktrees: WorktreeRecord[]): OverlapReport[] {
  // Only check active worktrees in same project
  // For each pair, check if any scope paths overlap:
  //   - "src/auth/" overlaps "src/auth/login.ts" (prefix match)
  //   - "src/auth/login.ts" overlaps "src/auth/login.ts" (exact match)
  //   - "src/auth/" overlaps "src/auth/" (exact match)
  //   - "src/auth/" does NOT overlap "src/utils/" (no common prefix)
}
```

## Implementation Patterns

### Component Structure

```
WorktreesView/
├── WorktreeList.tsx          # Main view with project grouping
├── WorktreeProjectGroup.tsx  # Collapsible project section
├── WorktreeRow.tsx           # Single worktree row
├── WorktreeDetail.tsx        # Detail drilldown
├── WorktreeStatusBadge.tsx   # Reusable status indicator
├── OverlapBadge.tsx          # Conflict/overlap indicator
├── StaleWarningBanner.tsx    # Top-of-list stale worktree warning
└── ScopeList.tsx             # Declared scope display with overlap highlighting
```

### Grouping

- Group worktrees by `project` field
- Each group is a collapsible section, expanded by default if it has active worktrees
- Groups sorted by: projects with active worktrees first, then alphabetical
- Global project filter narrows to one project (single group)

### Filtering

- Status filter: show active, completed, merged, conflict, stale (cleaned hidden by default)
- Filters stored as URL query params (consistent with SV-002, ET-004)
- Combined with global project filter from the shell
- Client-side filtering on pre-loaded `DashboardData.worktrees`

### Navigation

- Worktree List → click row → Worktree Detail
- Worktree Detail → click session link → Session Detail
- Worktree Detail → "View All Events" → Event Timeline filtered to this worktree
- Stale banner → "View" → Worktree Detail for the stale worktree
- All navigation uses client-side routing

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All components written in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | No direct file access; consumes data from Dashboard Shell |
| PD-003 | Local-only deployment for v1 | Rendered in local browser only |
| PD-005 | Git worktree for change isolation | This view visualises the worktrees managed by Core's Worktree Isolation system |
| PD-006 | Core and Dashboard are separate apps | No Core imports; worktree types via `packages/shared` |
| PD-007 | Centralized storage in `~/.nexus/` | Worktree data from all projects shown; project filter applies |
| DD-001 | Dashboard is strictly read-only | Worktree Status is read-only; cleanup commands shown as CLI instructions, not executed |
| DD-003 | Direct JSONL file reads, no Core API | Data from shell's file-based polling |
| DD-004 | Global project filter in header | Worktree list respects the shell's project filter |
| DS-001 | Server-side polling with in-memory cache | Consumes cached data from shell |
| DS-003 | SPA architecture | Components render within the SPA shell |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| WS-001 | Group by project, not flat list | Worktrees are inherently project-scoped; grouping makes "what's happening in project X?" instantly visible | System | Accepted | Yes |
| WS-002 | Client-side overlap detection mirrors Core's advisory model | Consistent with WI-002 (advisory, not enforced); Dashboard shows the same overlaps Core detects; no false authority | System | Accepted | Yes |
| WS-003 | Stale cleanup shown as CLI command, not a Dashboard action | Dashboard is read-only (DD-001); showing the command teaches the user the CLI while maintaining the read-only boundary | System | Accepted | Yes |
| WS-004 | Cleaned worktrees hidden by default | Cleaned worktrees are historical noise; user can toggle "Show cleaned" if they need history | System | Accepted | No |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Overlap Detection | Client-side overlap detection re-implements Core's logic. Should it use Core's results instead? | Core's conflict detection runs at creation time. Dashboard's overlap detection is a continuous visual check on current state. They serve different moments. Shared logic could live in `packages/shared` to avoid drift. |
| 2 | Scale | How many worktrees per project is realistic to display? | Soft limit of 10 active per project (from Worktree Isolation spec). Even 20-30 is displayable in a grouped list. Beyond that, pagination within the group. |
| 3 | Stale Banner | What if there are many stale worktrees (e.g., 10+)? Does the banner become unwieldy? | Collapse to: "10 stale worktrees need cleanup — [View all]". Link to worktree list filtered to status=stale. |
| 4 | Merge Result | How prominently should merge conflicts be shown? They require human action. | Conflict status gets a red ✕ badge and floats to the top of its project group. Detail view shows the conflicting file list. This is urgent information — visual weight should match. |
| 5 | Empty State | What shows when there are no worktrees? | "No worktrees active. When an agent starts work via Nexus, its isolated worktree will appear here." |
| 6 | Path Display | Worktree paths can be long. How to handle display? | Truncate middle with ellipsis: `C:/GitHub/.nexus-work.../cluiche-feature-add-auth`. Full path in tooltip on hover. Detail view shows full path. |

## Status

`Approved`
