# Feature Spec: Live Tail Mode

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Event Timeline | @docs/specs/systems/nexus-dashboard/event-timeline.md |

## Problem Statement

When monitoring active agent sessions, developers want events to auto-scroll into view as they happen — like `tail -f` but in the browser.

## Acceptance Criteria

- [ ] Toggle button: "Live Tail: ON / OFF" in the Event Timeline header
- [ ] When ON: auto-scroll to show newest events as they arrive via polling refresh
- [ ] When OFF: stay at current scroll position; new events appear but don't push the view
- [ ] When OFF and new events exist above: show "↑ N new events" indicator, click to scroll up
- [ ] Default: OFF (per ET-002)
- [ ] Live tail respects active filters — only auto-scrolls for events matching the current filter
- [ ] Turning ON scrolls to the top (newest) immediately

## Data Models / API

```typescript
interface LiveTailState {
  enabled: boolean;
  newEventCount: number;          // Events arrived since last scroll (when OFF)
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement LiveTailToggle component | Not Started |
| 2 | Implement auto-scroll behavior when enabled | Not Started |
| 3 | Implement "N new events" indicator when disabled and new events arrive | Not Started |
| 4 | Implement click-to-scroll on the new events indicator | Not Started |
| 5 | Track new event count between data refreshes | Not Started |
| 6 | Add tests: toggle behavior, auto-scroll, new event indicator, filter interaction | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Component in TypeScript |
| DD-001 | Dashboard is read-only | UI-only behavior, no writes |
| DD-002 | Polling-based refresh | Live tail works with polling — auto-scrolls when new data arrives from poll |
| ET-002 | Live Tail defaults to OFF | Default state is OFF |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | UX | Should live tail disable pagination (show continuous stream) or keep pages? | Disable pagination when live tail is ON — show a continuous scrolling stream. Re-enable pagination when turned OFF. | Disable pagination during live tail. Continuous stream. Pagination returns when OFF. |

## Status

`Approved`
