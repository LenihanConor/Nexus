# Plan: Session Views

**Spec:** @docs/specs/systems/nexus-dashboard/session-views.md
**Status:** Done
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Component Structure

All session view components live in `packages/dashboard/src/client/views/sessions/`:
- `SessionStatusBadge.tsx` — Reusable status badge with symbol + colour
- `SessionFilters.tsx` — Filter controls, URL param serialization, `useSessionFilters()` hook
- `SessionList.tsx` — Table with sortable columns, pagination, stale banner
- `SessionDetail.tsx` — Metadata header, snapshot timeline, associated worktree, recent events
- `SessionLineage.tsx` — CSS-indented tree with expand/collapse, status colours, click-to-navigate
- `index.ts` — Barrel exports

### Routing

Routes registered in `App.tsx`:
- `/sessions` → `SessionList`
- `/sessions/:id` → `SessionDetail`
- `/sessions/:id/lineage` → `SessionLineage`

### Data Flow

All components consume `DashboardData` from `useDashboard()` context. No independent API calls.
Tree building uses `buildSessionTree()` implemented inline in `SessionLineage.tsx`.
Filter state persisted in URL query params via `useSearchParams`.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Session List feature (all tasks) | Done | SessionList.tsx, SessionStatusBadge.tsx |
| 2 | Session Filters feature (all tasks) | Done | SessionFilters.tsx with URL params, debounced search |
| 3 | Session Detail feature (all tasks) | Done | SessionDetail.tsx with snapshots, worktree, events |
| 4 | Lineage Tree feature (all tasks) | Done | SessionLineage.tsx with CSS tree, expand/collapse |
| 5 | Update App.tsx with new routes | Done | Replaced old Sessions import, added :id and :id/lineage routes |
| 6 | Add tests for session views | Done | 38 new tests: filters, detail derivation, lineage tree, status badge |
| 7 | Update specs to Done | Done | All 4 feature specs + system spec marked Done |

## Session Notes

### 2026-04-27
- Implemented all 4 features: SessionList, SessionFilters, SessionDetail, SessionLineage
- Updated App.tsx routing: replaced old Sessions.tsx with new session views module
- Both server and client builds pass, all 180 existing tests pass
- Old Sessions.tsx still exists (not deleted) — kept for reference until tests confirm replacement works
