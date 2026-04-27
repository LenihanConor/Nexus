# Feature Spec: Application Layout

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

The Dashboard needs a consistent page shell — header, sidebar navigation, main content area, and status bar — that all views render inside.

## Acceptance Criteria

- [ ] Page shell with: header (title + project filter), sidebar (nav links), main content area, status bar
- [ ] Sidebar shows registered views with icons and labels
- [ ] Active view highlighted in nav
- [ ] Status bar shows: active session count, active worktree count, stale count, last update time
- [ ] Responsive enough for comfortable use at 1280px+ width (desktop only, per DD out-of-scope)
- [ ] Clean, minimal visual design — functional over decorative
- [ ] Dark and light theme support (or one good default)

## Data Models / API

### Layout Component Props

```typescript
interface ShellProps {
  views: DashboardView[];           // Registered views for nav
  activeViewId: string;             // Currently active view
  summary: DashboardSummary;        // For status bar
  projectFilter: string | null;     // Current project filter
  projects: string[];               // Available projects for filter dropdown
  onProjectFilterChange: (project: string | null) => void;
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Choose and set up SPA framework (React, Svelte, or Preact) | Not Started |
| 2 | Implement Shell component — header, sidebar, content area, status bar | Not Started |
| 3 | Implement sidebar navigation with view registration | Not Started |
| 4 | Implement status bar with summary counts | Not Started |
| 5 | Set up CSS/styling approach (Tailwind, CSS modules, or plain CSS) | Not Started |
| 6 | Add client-side routing for view navigation | Not Started |
| 7 | Add tests: layout renders, nav highlights active view, status bar updates | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Frontend components in TypeScript |
| DS-003 | SPA architecture | Shell is the root SPA component |
| DD-004 | Global project filter in header | Project filter dropdown in the header |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Framework | Which SPA framework — React, Svelte, or Preact? | React — largest ecosystem, most familiar to most developers, well-supported with TypeScript. Preact if bundle size matters. | React. Widest ecosystem, TypeScript support is excellent, most contributors will know it. |
| 2 | Styling | Which CSS approach? | Tailwind CSS — utility-first, fast to build, consistent design, no custom CSS files to manage | Tailwind CSS. Fast to prototype, consistent, visual-first philosophy aligns with utility classes. |
| 3 | Theme | Dark or light default? | Dark — most developer tools default to dark; easier on the eyes for a dashboard that runs alongside coding. Light mode as future option. | Dark default. Developer tool convention. Light mode deferred. |

## Status

`Approved`
