# Plan: Worktree Status

**Spec:** @docs/specs/systems/nexus-dashboard/worktree-status.md
**Status:** Done
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Component Structure

All worktree status components live in `packages/dashboard/src/client/views/worktrees/`:
- `WorktreeStatusBadge.tsx` — Status badge with symbol + colour for each worktree status
- `WorktreeList.tsx` — Main view: project grouping, status filter, stale banner, overlap badges
- `WorktreeDetail.tsx` — Full detail: metadata, scope with overlaps, merge result, events
- `index.ts` — Barrel exports

### Shared Overlap Detection

`pathsOverlap()` and `detectOverlaps()` added to `packages/shared/src/overlap.ts`:
- Prefix-based path overlap: `src/auth/` overlaps `src/auth/login.ts`
- Only checks active worktrees in the same project
- Returns `OverlapReport[]` with both worktrees and overlapping paths

### Routing

Routes registered in `App.tsx`:
- `/worktrees` → `WorktreeList`
- `/worktrees/:id` → `WorktreeDetail`

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add pathsOverlap + detectOverlaps to shared | Done | packages/shared/src/overlap.ts |
| 2 | Worktree List feature (all tasks) | Done | WorktreeList.tsx with project grouping, stale banner |
| 3 | Worktree Detail feature (all tasks) | Done | WorktreeDetail.tsx with scope, merge result, events |
| 4 | Conflict Indicators feature (all tasks) | Done | Overlap badges + project group banner |
| 5 | Stale Warnings feature (all tasks) | Done | Banner with count, CLI command, "View all" filter |
| 6 | Update App.tsx with new routes | Done | Replaced old Worktrees import, added :id route |
| 7 | Add tests | Done | 20 new tests: pathsOverlap, detectOverlaps, status badge |
| 8 | Update specs to Done | Done | All 4 feature specs + system spec marked Done |

## Session Notes

### 2026-04-27
- Implemented all 4 features in one pass
- Added overlap detection to packages/shared (shared between Dashboard and future Core use)
- Stale warning banner integrated directly into WorktreeList (not a separate component)
- Both builds pass, all 260 tests pass
