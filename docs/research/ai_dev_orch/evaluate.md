# Research: Evaluate -- AI Development Orchestration

**Input:** docs/research/ai_dev_orch/ideate.md

## Scoring Criteria

- **Platform Value (0.25):** Improves shared platform reusability or capability -- foundational systems that other candidates depend on score highest
- **User/Product Value (0.20):** Directly improves the experience for the developer running agents -- solves a daily pain point
- **Implementation Cost (0.25):** Inverse of effort -- 5 = very cheap, 1 = very expensive. Accounts for complexity, unknowns, and dependencies
- **Risk (0.15):** Inverse of uncertainty -- 5 = well-understood, 1 = highly uncertain. Proven patterns score higher
- **Platform Fit (0.15):** Aligns with existing spec/plan/research workflow and git conventions already defined in CLAUDE.md

## Scores

| Candidate | Platform (0.25) | User (0.20) | Cost (0.25) | Risk (0.15) | Fit (0.15) | Total |
|-----------|-----------------|-------------|-------------|-------------|------------|-------|
| C1: Session Registry & Lineage | 5 | 4 | 4 | 4 | 4 | 4.30 |
| C2: Budget & Token Metering | 3 | 5 | 3 | 3 | 3 | 3.40 |
| C3: Worktree Isolation Manager | 4 | 4 | 5 | 5 | 5 | 4.55 |
| C4: Approval Policy Engine | 4 | 4 | 3 | 3 | 4 | 3.60 |
| C5: Context Health Monitor | 2 | 4 | 4 | 3 | 3 | 3.20 |
| C6: Orchestration Dashboard | 3 | 5 | 2 | 3 | 3 | 3.10 |
| C7: Agent Task Scheduler | 5 | 5 | 2 | 2 | 4 | 3.60 |
| C8: Audit Trail & Event Log | 5 | 3 | 5 | 5 | 5 | 4.60 |
| C9: Spec & Backlog Manager | 3 | 4 | 3 | 4 | 5 | 3.65 |
| C10: Quality Gate Pipeline | 4 | 4 | 1 | 2 | 4 | 2.95 |

## Top 3 Candidates

### Rank 1: C8 -- Audit Trail & Event Log (score: 4.60)
**Why:** The audit trail is the nervous system of the entire platform. Every other system -- sessions, budgets, approvals, quality gates -- needs somewhere to write events. It's small (S-sized), uses a well-understood pattern (append-only JSONL), has zero external dependencies, and maps directly to the existing commit-after-each-task convention in CLAUDE.md. Building this first means every subsequent system gets observability for free from day one.
**Watch out for:** Schema design matters enormously -- if the event schema is too rigid, every new system requires schema changes. If too loose, queries become unreliable. Define a core envelope (timestamp, correlation_id, event_type, agent_id, session_id) with a flexible payload field.

### Rank 2: C3 -- Worktree Isolation Manager (score: 4.55)
**Why:** Change isolation is the most immediately felt pain point when running multiple agents. The solution is well-proven (git worktree is battle-tested), cheap to implement (thin wrapper around existing git commands), and aligns perfectly with the branch naming conventions already defined in tech.md. It also addresses resource contention at the file level -- the cheapest form of conflict prevention. High platform fit because the plan workflow already expects one-task-at-a-time with commits, and worktrees formalize that boundary.
**Watch out for:** Worktrees prevent file-level collisions but not logical conflicts (two agents changing the same API contract from different worktrees). Nexus will eventually need dependency-aware scheduling (C7) to catch those. Also, worktree cleanup on failure needs to be robust -- orphaned worktrees clutter the repo.

### Rank 3: C1 -- Session Registry & Lineage Tracker (score: 4.30)
**Why:** Session lineage is the second foundational piece after the audit trail. It answers the core question: "where did this start, what happened, and where is it now?" The session registry gives every other system a correlation point -- budgets attach to sessions, approvals reference sessions, the dashboard renders sessions. It's M-sized but most of the complexity is in the data model, not the implementation. The pattern (hierarchical IDs, parent pointers, state snapshots) is well-established from distributed tracing.
**Watch out for:** The session registry needs to be defined before other systems are built, but it doesn't need to be feature-complete. Start with create/update/query operations and a simple JSONL store. Resist the urge to build a full tracing system -- the MVP just needs ID assignment, parent linking, and status tracking.

## Recommendation

The **Audit Trail & Event Log (C8)** should be built first. It's the smallest, safest, and most foundational candidate. Every other system in Nexus will emit events, and having a structured event log from day one means the platform grows with observability built in rather than bolted on. The append-only JSONL pattern is proven, requires no database, and fits the existing file-based structure defined in CLAUDE.md. It also directly supports the commit-after-each-task convention -- each commit is a natural event boundary.

The recommended build order for the first phase is: **C8 (Audit Trail) -> C3 (Worktree Isolation) -> C1 (Session Registry)**. These three form the platform's core infrastructure layer -- events, isolation, and identity -- and everything else (budgets, approvals, scheduling, dashboard) builds on top of them.
