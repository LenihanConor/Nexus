# Feature Spec: View Registry

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

View systems (Sessions, Events, Worktrees) need a way to register their routes, nav items, and components with the shell so the shell doesn't hardcode knowledge of its children.

## Acceptance Criteria

- [ ] `registerView()` accepts a view definition (id, label, route, icon, component, order)
- [ ] Registered views appear in the sidebar navigation in order
- [ ] Shell routes to the correct component based on the active URL
- [ ] Views can define nested routes (e.g., `/sessions/:id`)
- [ ] Overview page is built into the shell, not registered as a view (per DS-002)

## Data Models / API

```typescript
interface DashboardView {
  id: string;
  label: string;
  route: string;
  icon?: string;
  component: ComponentType;
  order: number;
}

function registerView(view: DashboardView): void;
function getRegisteredViews(): DashboardView[];
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement view registry (array of view definitions with register/get functions) | Not Started |
| 2 | Wire registry to sidebar navigation rendering | Not Started |
| 3 | Wire registry to client-side router for route → component mapping | Not Started |
| 4 | Register Overview as the default `/` route within the shell | Not Started |
| 5 | Add tests: view registration, nav rendering, route resolution | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| DS-002 | Overview built into shell | Overview is not a registered view; it's the shell's own component at `/` |
| DS-003 | SPA architecture | View registry feeds the client-side router |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Complexity | Is a registry over-engineered for 3-4 views? | Possibly, but it keeps the shell decoupled from view implementations. Implement simply — an array of definitions, not a plugin system. | Simple array. No dynamic loading or plugin system. Just a typed list of view definitions imported at build time. |

## Status

`Approved`
