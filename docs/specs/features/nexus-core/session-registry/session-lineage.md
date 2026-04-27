# Feature Spec: Session Lineage

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Session Registry | @docs/specs/systems/nexus-core/session-registry.md |

## Problem Statement

Developers need to trace the full parent-child tree of sessions to understand how a piece of work evolved across multiple agent invocations.

## Acceptance Criteria

- [ ] `getLineage(sessionId)` returns the full tree: root ancestor, path to target, direct children, and all descendants
- [ ] Traversal follows `parent_id` pointers upward and discovers children by scanning for matching `parent_id` values
- [ ] Correlation group query: find all sessions sharing a `correlation_id`
- [ ] Max traversal depth of 20 with warning (per system spec AI Q2)
- [ ] Iterative traversal, not recursive (prevents stack overflow)
- [ ] Works across projects (a correlation group may span multiple projects)

## Data Models / API

```typescript
function getLineage(sessionId: string): Promise<SessionLineage>;

interface SessionLineage {
  root: SessionRecord;
  path_to_target: SessionRecord[];   // Root → target (inclusive)
  children: SessionRecord[];         // Direct children of target
  descendants: SessionRecord[];      // Full subtree below target
}

// Find all sessions in a correlation group
function getCorrelationGroup(correlationId: string): Promise<SessionRecord[]>;

// Build a tree structure for rendering
function buildSessionTree(sessions: SessionRecord[]): SessionTreeNode;

interface SessionTreeNode {
  session: SessionRecord;
  children: SessionTreeNode[];
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement ancestor traversal — follow `parent_id` up to root with depth limit | Not Started |
| 2 | Implement descendant discovery — find all sessions with `parent_id` in subtree | Not Started |
| 3 | Implement `getLineage()` — combine ancestor + descendant into `SessionLineage` | Not Started |
| 4 | Implement `getCorrelationGroup()` — filter sessions by `correlation_id` | Not Started |
| 5 | Implement `buildSessionTree()` — convert flat session list into nested tree structure | Not Started |
| 6 | Add tests: linear chain, branching tree, depth limit, cross-project correlation | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage | Reads session records from JSONL; lineage computed in-memory |
| PD-007 | Centralized storage | Single sessions file contains all projects; cross-project lineage works naturally |
| SR-001 | Append-only with latest-wins | Reads deduplicated session records |
| SR-002 | Correlation ID inheritance | Uses correlation_id to find related sessions across the tree |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Performance | Loading all sessions into memory for tree building — acceptable at scale? | Yes for v1. At local single-developer scale, even 10K sessions fits comfortably in memory. Add indexing if it becomes slow. | Yes, in-memory is fine for v1 scale. |
| 2 | Orphans | What if a session references a parent_id that doesn't exist (e.g., parent was purged)? | Treat as a root — the session becomes the top of its subtree. Log a warning. | Treat as root. Log warning: "Parent <id> not found, treating as root." |
| 3 | Shared Types | Should `SessionLineage` and `SessionTreeNode` live in `packages/shared` for Dashboard use? | Yes — Dashboard's Session Views needs these exact types for rendering lineage trees | Yes, in `packages/shared`. Dashboard consumes them directly. |

## Status

`Done`
