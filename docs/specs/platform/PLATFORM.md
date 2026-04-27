# Platform Spec: Nexus

## Overview

**Nexus** is a local-first orchestration platform for AI-assisted development. It gives developers visibility into, control over, and coordination between multiple CLI-LLM agent sessions (Claude Code, Cursor, Aider, etc.) working across multiple projects on the same machine.

The platform is a single codebase, multi-application project. Shared architecture, binding decisions, and conventions are defined here. New work is spec-driven: every feature is designed and approved before any code is written.

### Core Problem

Developers using CLI-LLM tools lose control once they move beyond single-agent, single-task workflows. Nexus solves 13 identified pain points across three categories:

**Visibility:** Resource awareness, session lineage, audit trails, visual dashboard
**Control:** Cost/budget management, approval delegation, quality gates, context window health
**Coordination:** Change isolation, resource contention, coordination overhead, spec lifecycle, ideation backlog

### Design Philosophy

- **Simple** -- file-based, local-first, minimal dependencies
- **Visual** -- the dashboard is a first-class application, not a bolt-on
- **Spec-driven** -- every feature designed and approved before implementation
- **Composable** -- infrastructure systems (audit, isolation, sessions) are foundations that higher-level systems plug into

## Applications

| Application | Description | Spec | Status |
|-------------|-------------|------|--------|
| Nexus Core | CLI and orchestration engine -- audit trail, worktree isolation, session registry, budget/approval systems | @docs/specs/applications/nexus-core.md | Planned |
| Nexus Dashboard | Local web UI -- visual layer over Core's data, real-time session views, event timelines | @docs/specs/applications/nexus-dashboard.md | Planned |

## Shared Codebase

_Shared modules and libraries will emerge as Core and Dashboard are built. Expected shared concerns:_

- **Event schema** -- shared TypeScript types for the append-only event log (consumed by Core, rendered by Dashboard)
- **Session types** -- shared data model for session registry
- **Configuration** -- shared config loading (JSON files)
- **File I/O utilities** -- JSONL read/write, file rotation, atomic writes

## Architecture Principles

1. **Modular design** -- clear separation between Core (engine) and Dashboard (visual layer); Dashboard is a consumer of Core's data, not tangled with it
2. **Spec-driven development** -- every feature approved before implementation
3. **Traceability** -- every feature traces back to a platform decision
4. **File-first storage** -- JSONL for events and sessions, JSON for configuration; no database for v1
5. **Append-only events** -- the audit trail is the source of truth; other views are derived from it
6. **Local-first** -- runs on the developer's machine; no cloud dependency for v1
7. **Future-ready** -- architecture must not preclude multi-human support in a future version

## Non-Functional Requirements

| Concern | Requirement |
|---------|-------------|
| Deployment | Local-only for v1 (single developer machine) |
| Storage | File-based: JSONL for events/sessions, JSON for config; centralized in `~/.nexus/` |
| Language | TypeScript end-to-end (CLI, engine, dashboard) |
| Performance | Dashboard updates within 10 seconds of events occurring |
| Data retention | 90 days hot event storage, then archive |
| Multi-human | Not in v1, but architecture must not preclude it |
| Dependencies | Minimal external dependencies; no database, no cloud services |

## Conventions

Coding standards, naming conventions, and tooling defined in:
- Tech standards: @.claude/steering/tech.md
- Codebase structure: @.claude/steering/structure.md

## Change Policy

Changes to shared platform modules follow this process:

1. **Proposal** -- Create a feature spec using `/spec-feature` in the relevant system
2. **Review** -- AI review questions must be answered; binding decisions checked
3. **Implementation** -- Changes implemented per approved spec
4. **Testing** -- Tests required for all API changes
5. **Documentation** -- Update architecture docs if structure changes
6. **Breaking Changes** -- Require PD- decision approval; impact analysis on all applications

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| PD-001 | TypeScript as the sole language | Single language for CLI, engine, and dashboard eliminates context-switching and serialization boundaries; natural fit for visual-first design | Platform | Accepted | Yes |
| PD-002 | File-based storage for v1 (JSONL/JSON) | Simplest viable storage; no database dependency; sufficient for local single-developer use; database migration is a known future cost | Platform | Accepted | Yes |
| PD-003 | Local-only deployment for v1 | Reduces complexity; no network dependency; multi-human support deferred but not precluded | Platform | Accepted | Yes |
| PD-004 | Append-only event log pattern | Audit trail is the nervous system of the platform; append-only ensures immutability and auditability; every system emits events into a shared log | Platform | Accepted | Yes |
| PD-005 | Git worktree for change isolation | Lightweight, battle-tested, familiar; prevents file-level collisions between concurrent agents; aligns with existing git workflow conventions | Platform | Accepted | Yes |
| PD-006 | Core and Dashboard are separate applications | Clean separation of engine from visual layer; Dashboard consumes Core's data via APIs/files, not by reaching into internals; allows independent evolution | Platform | Accepted | Yes |
| PD-007 | Centralized storage in `~/.nexus/` (user home) | Nexus is a global orchestrator across multiple projects, not per-project; centralized storage gives a unified audit trail, session registry, and dashboard view; events include a `project` field for filtering | Platform | Accepted | Yes |

**Status values:** `Proposed` / `Accepted` / `Rejected` / `Superseded`
**Binding:** `Yes` = enforced constraint on all children / `No` = guidance only

## Phased Delivery

Based on research evaluation (docs/research/ai_dev_orch/), systems are delivered in phases:

| Phase | Systems | Focus |
|-------|---------|-------|
| Phase 1 | Audit Trail, Worktree Isolation, Session Registry | Infrastructure layer -- events, isolation, identity |
| Phase 2 | Budget & Metering, Approval Engine, Spec/Backlog Manager, Dashboard | Control and visibility layer |
| Phase 3 | Agent Task Scheduler, Quality Gate Pipeline | Automation and autonomy layer |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Architecture | How will Dashboard consume Core's data -- direct file reads, a Core API, or both? | To be decided in app specs. Likely file reads for v1 (simple), with a Core API as an option for future real-time updates. |
| 2 | Storage | What happens when JSONL files grow large? Is rotation/archival part of v1 or deferred? | 90-day retention is an NFR. Rotation strategy to be defined in the Audit Trail system spec. |
| 3 | Isolation | Git worktrees share the object database -- what happens if an agent corrupts it? | Low risk for normal operations. Mitigation: Nexus should validate worktree health before and after agent sessions. Detail in Worktree Isolation system spec. |
| 4 | Multi-human | What specific architectural choices now would preclude multi-human later? | Hardcoded single-user assumptions in session ownership, file paths, or config. Mitigation: use user_id fields from day one even if there's only one user. |
| 5 | Scope | 13 pain points is a lot. Is Phase 1 (3 systems) enough to deliver tangible value, or does it need Dashboard to feel useful? | Phase 1 delivers infrastructure. A minimal CLI-based status view could bridge the gap before the full Dashboard in Phase 2. |
| 6 | Decisions | PD-002 says no database, but session queries (lineage trees, filtering) may get complex. At what point does file-based storage break? | Likely at 10K+ sessions or complex cross-session queries. The migration path is to add a SQLite layer (still local, still file-based) without changing the event format. |
