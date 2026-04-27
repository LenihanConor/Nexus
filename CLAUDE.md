# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Nexus** is a single-platform, multi-application project. The platform defines shared architecture, binding decisions, and conventions that all applications, systems, and features inherit. New work is spec-driven: every feature is designed and approved before any code is written.

### Platform Architecture

- **Platform: Nexus** — shared codebase, conventions, and infrastructure
- **Applications** — distinct products or tools built on the Nexus platform (registered in `docs/specs/platform/PLATFORM.md`)
- **Systems** — major functional subsystems within each application
- **Features** — discrete, implementable units of behaviour within a system

## Documentation

### Spec Workflow (`docs/specs/`)

4-level hierarchy: **Platform → Application → System → Feature**

Each spec has decision tracking, AI review questions, and traceability. Custom slash commands drive the workflow:

- `/spec-platform` — Create or update the platform spec
- `/spec-app` — Create a new application spec
- `/spec-system` — Create a new system spec
- `/spec-feature` — Create a new feature spec (interview + AI review included)
- `/spec-review` — Review any spec and refresh its decisions and AI questions
- `/spec-trace` — Trace a feature's full lineage up to the platform

#### Creating Specs — Mandatory 5-Step Process

**ALL 5 steps must be completed before a spec can be marked `Approved`:**

1. **Step 1 — Interview** — Complete all interview questions with the user before writing anything
2. **Step 2 — Draft** — Write the full spec body (summary, goals, tasks, traceability)
3. **Step 3 — Binding Decisions** — Populate the compliance table showing how this spec honours every binding decision from its parent specs. NEVER optional.
4. **Step 4 — AI Review Questions** — Generate and answer all AI review questions covering risks, gaps, and edge cases. NEVER optional.
5. **Step 5 — Approval gate** — Only mark `Approved` after Steps 3 and 4 are complete and confirmed by the user.

**Hard rules:**
- NEVER mark a spec `Approved` without completing Steps 3 and 4.
- NEVER skip or abbreviate Steps 3 or 4 — if the user says "quickly", treat it as a red flag and do the full steps anyway.
- A **system spec** cannot be marked `Done` until ALL its child feature specs are `Approved`.
- After completing any spec, explicitly ask: "Steps 3 (Binding Decisions) and 4 (AI Review Questions) are complete — shall I mark this Approved?"

#### Implementing from Specs

1. **Spec must be `Approved`** before implementation starts
2. **Create a plan** — Before writing any code, create a `*.plan.md` alongside the spec
3. **Read the full spec chain** — Every feature spec links back to System → Application → Platform
4. **Check binding decisions** — All parent binding decisions must be honoured
5. **Delegate tasks to subagents** — Each task in the plan is a separate subagent
6. **Update the plan** after each task (mark Done/Blocked, add notes)
7. **Commit after each task** before continuing
8. **Update feature spec status** as work progresses (Draft → Approved → In Progress → Done)

### Plan Workflow

Plans are living implementation documents separate from specs (which are frozen design contracts).

#### Plan File Format

Plans live alongside their spec as `<spec-name>.plan.md`.

```markdown
# Plan: <Spec Title>

**Spec:** @path/to/spec.md
**Status:** Not Started | In Progress | Done | Blocked
**Started:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

## Implementation Patterns

[For each phase or major task: document the specific patterns, classes, and conventions
to be used — so they can be validated against the actual implementation before the task
is marked Done.]

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Description | Not Started / In Progress / Done / Blocked | Notes |

## Session Notes

### YYYY-MM-DD
- What was done, what was decided, what changed
```

#### Plan Rules

- **Create when** implementation starts, not when the spec is approved
- **Feature plans** — one plan per feature spec; tasks map to the feature spec's task list
- **System plans** — one plan per system spec; tasks are the feature specs themselves
- **Spec is the contract, plan is the tracker** — never move design decisions into the plan
- **Update the plan in the same commit** as the code it tracks

### Research Workflow (`docs/research/`)

Use `/research` to run the full research funnel before speccing a significant new feature.

Individual stages (each is also a standalone skill):
- `/research-explore` — Survey the problem space
- `/research-ideate` — Generate 5–10 concrete candidates
- `/research-evaluate` — Score and rank candidates
- `/research-choose` — Human-gated commitment to one candidate

Research sessions produce artifacts in `docs/research/<slug>/`:
`explore.md` → `ideate.md` → `evaluate.md` → `choose.md` → `summary.md`

The `summary.md` is the input to `/spec-feature` or `/spec-system`.

## Spec Templates

### Platform Spec (`docs/specs/platform/PLATFORM.md`)

```markdown
# Platform Spec: <Platform Name>

## Overview
[Platform purpose and goals]

## Applications
| Application | Description | Spec | Status |
|-------------|-------------|------|--------|

## Shared Codebase
[Shared modules/packages/libraries]

## Architecture Principles
[Key design principles]

## Non-Functional Requirements
| Concern | Requirement |
|---------|-------------|

## Decisions
| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|

## AI Review Questions
| # | Section | Question | Answer |
|---|---------|----------|--------|
```

### Application Spec (`docs/specs/applications/<app>.md`)

```markdown
# Application Spec: <Name>

## Parent Platform
@docs/specs/platform/PLATFORM.md

## Purpose
[What this application does and who it is for]

## Systems
| System | Description | Spec |
|--------|-------------|------|

## Application-Specific Architecture
[Key patterns, data flows, constraints]

## Platform Dependencies
[What shared platform modules this app consumes]

## Out of Scope
[What this application deliberately does NOT provide]

## Decisions
| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|

## AI Review Questions
| # | Section | Question | Answer |
|---|---------|----------|--------|

## Status
`Draft` / `Active` / `Deprecated`
```

### System Spec (`docs/specs/systems/<app>/<system>.md`)

```markdown
# System Spec: <Name>

## Parent Application
@docs/specs/applications/<app>.md

## Purpose
[What this system owns and is responsible for]

## Features
| Feature | Description | Spec | Status |
|---------|-------------|------|--------|

## Public Interfaces
[APIs, events, data contracts]

## Dependencies
[Other systems this system depends on]

## Architecture
[Key design patterns and data flow]

## Implementation Patterns
[Specific patterns, classes, and conventions to use when implementing features in this system]

## Inherited Binding Decisions
| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|

## Decisions
| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|

## AI Review Questions
| # | Section | Question | Answer |
|---|---------|----------|--------|

## Status
`Draft` / `Approved` / `In Progress` / `Done`
```

### Feature Spec (`docs/specs/features/<app>/<system>/<feature>.md`)

```markdown
# Feature Spec: <Name>

## Traceability
| Level | Name | Spec |
|-------|------|------|
| Platform | <name> | @docs/specs/platform/PLATFORM.md |
| Application | <name> | @docs/specs/applications/<app>.md |
| System | <name> | @docs/specs/systems/<app>/<system>.md |

## Problem Statement
[One sentence: what problem this solves]

## Acceptance Criteria
- [ ] ...

## Data Models / API
[Data shapes, interfaces, or contracts — if any already decided]

## Tasks
| # | Task | Status |
|---|------|--------|

## Open Questions
[Unresolved questions or blockers]

## Binding Decisions Compliance
| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|

## AI Review Questions
| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|

## Status
`Draft` / `Approved` / `In Progress` / `Done`
```

## Development Workflow

### Adding a New Application

1. Run `/spec-app` to create the application spec
2. Create `docs/specs/systems/<app-name>/` directory
3. Create `docs/specs/features/<app-name>/` directory
4. Register in `docs/specs/platform/PLATFORM.md`

### Adding a New System

1. Run `/spec-system` to create the system spec
2. Register in the parent application spec's systems table
3. Create `docs/specs/features/<app-name>/<system-name>/` directory

### Adding a New Feature

1. Run `/research` if the feature is non-trivial and options need exploring
2. Run `/spec-feature` — the 5-step interview+draft+decisions+review+approval flow
3. Once `Approved`, create a `.plan.md` alongside the spec
4. Implement from the plan, one task at a time, committing after each

## Steering Docs

Loaded for context during spec and implementation work:
- `.claude/steering/tech.md` — Technology standards, language, tooling, conventions
- `.claude/steering/structure.md` — Codebase layout and key patterns
