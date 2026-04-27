# Feature Spec: Lineage Tree

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Session Views | @docs/specs/systems/nexus-dashboard/session-views.md |

## Problem Statement

Developers need a visual tree showing how sessions relate — which session spawned which — to understand the full lineage of a piece of work.

## Acceptance Criteria

- [ ] Route: `/sessions/:id/lineage`
- [ ] Renders the session tree: root ancestor at top, children branching below
- [ ] Status-coloured nodes matching the status indicator palette
- [ ] Current session highlighted with distinct style
- [ ] Click any node → navigate to that session's detail view
- [ ] Shows correlation ID and root task description
- [ ] Default: expand to depth 3, collapse deeper nodes with expand control
- [ ] Max rendered depth: 20 (per Session Registry AI Q2)
- [ ] CSS-indented tree for v1 (per SV-001), not a graph library

## Data Models / API

```typescript
function getSessionLineage(data: DashboardData, sessionId: string): {
  root: SessionRecord;
  tree: SessionTreeNode[];
  pathToTarget: string[];
};

interface SessionTreeNode {
  session: SessionRecord;
  children: SessionTreeNode[];
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement LineageTree component with CSS-indented tree rendering | Not Started |
| 2 | Implement tree node component with status colour, task summary, duration | Not Started |
| 3 | Implement expand/collapse for deep trees (default depth 3) | Not Started |
| 4 | Highlight current session node | Not Started |
| 5 | Wire click-to-navigate on tree nodes | Not Started |
| 6 | Build tree structure from flat session data using `buildSessionTree()` from shared | Not Started |
| 7 | Add tests: tree rendering, depth limits, collapse/expand, current highlight | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | Display-only tree visualisation |
| SV-001 | CSS-indented tree, not graph library | Uses CSS for tree rendering, no heavy dependency |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Rendering | Unicode tree characters (`├──`, `└──`, `│`) or pure CSS borders? | CSS borders — more flexible for styling, hover states, click targets. Unicode works in terminals but is rigid in a web UI. | CSS borders. More control over styling and interactivity in a web context. |
| 2 | Scope | Should lineage show sessions from other projects if they share a correlation ID? | Yes — correlation groups can span projects. Show project name on each node to disambiguate. | Yes, cross-project lineage. Project name shown on each node. |

## Status

`Approved`
