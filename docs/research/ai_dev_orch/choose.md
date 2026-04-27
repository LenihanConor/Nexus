# Research: Choice -- AI Development Orchestration

**Date:** 2026-04-26
**Chosen candidate:** Infrastructure Layer Bundle (C8 + C3 + C1)

## Rationale

The top three candidates -- Audit Trail & Event Log (C8), Worktree Isolation Manager (C3), and Session Registry & Lineage Tracker (C1) -- form a tightly coupled infrastructure layer. Building them together gives Nexus its foundational nervous system: every action is logged (audit trail), every agent works in isolation (worktrees), and every session is tracked from start to finish (lineage). All subsequent systems (budgets, approvals, scheduling, dashboard) plug into these three.

They scored highest on platform value, implementation cost, risk, and platform fit. They're small individually (S + S + M), well-understood patterns, and have no external dependencies.

## What Was Ruled Out

| Candidate | Reason not chosen |
|-----------|------------------|
| C2: Budget & Token Metering | Important but depends on session registry (C1) -- Phase 2 |
| C4: Approval Policy Engine | Depends on audit trail (C8) and session registry (C1) -- Phase 2 |
| C5: Context Health Monitor | Nice-to-have, low platform value, can be added later |
| C6: Orchestration Dashboard | Largest visual piece but needs data from the infrastructure layer first -- Phase 2 |
| C7: Agent Task Scheduler | High value but high complexity and risk -- Phase 3 |
| C9: Spec & Backlog Manager | Good fit with existing workflow but not foundational -- Phase 2 |
| C10: Quality Gate Pipeline | Most ambitious candidate, depends on nearly everything else -- Phase 3 |

## Pre-Spec Commitments

- **Language:** TypeScript (single language for CLI, orchestration logic, and future dashboard)
- **Storage:** File-based (JSONL for events and sessions, JSON for configuration)
- **Deployment:** Local-only for v1; architecture should not preclude future multi-human support
- **Design philosophy:** Simple and visual -- the visual layer is a first-class concern, not a bolt-on
- **Build order:** C8 (Audit Trail) -> C3 (Worktree Isolation) -> C1 (Session Registry), though they'll be specced together

## Next Step

Run /spec-system (or /spec-feature for each) to define the three infrastructure systems.
Suggested parent application: Nexus (the platform itself -- these are platform-level systems).
