# Research Summary -- AI Development Orchestration

**Session folder:** docs/research/ai_dev_orch/
**Date:** 2026-04-26

## One-Line Answer

Nexus starts as three foundational infrastructure systems -- audit trail, worktree isolation, and session lineage -- built in TypeScript with file-based storage, forming the control plane that all future orchestration features plug into.

## Journey

1. **Explored:** Mapped 13 pain points across visibility, control, and coordination when running multiple CLI-LLM agents. Found that every concern maps to a proven pattern (distributed tracing, quotas, DAG scheduling, append-only logs) but no existing tool solves the full problem end-to-end.
2. **Ideated:** 10 candidates generated spanning S to XL scope -- from thin git worktree wrappers to a full quality gate pipeline with agent reputation scoring.
3. **Evaluated:** Audit Trail (4.60), Worktree Isolation (4.55), and Session Registry (4.30) ranked highest -- all scored top marks on cost, risk, and platform fit. They're foundational: everything else depends on them.
4. **Chose:** Bundle all three as the infrastructure layer. User confirmed TypeScript, file-based storage, local-only with future multi-human in mind, and "simple and visual" as a design philosophy.

## Chosen Work Item

**Name:** Infrastructure Layer Bundle (Audit Trail + Worktree Isolation + Session Registry)
**Home application/system:** Nexus platform-level systems
**Suggested spec type:** One system spec containing three feature specs (or three system specs if they warrant independent lifecycles)
**Estimated size:** M (3-5 weeks total for all three)

## Key Insights from Exploration

- **No existing tool covers this space** -- multi-agent frameworks (CrewAI, AutoGen, LangGraph) handle agent communication but miss dev-specific concerns like git isolation, cost budgets, and spec lifecycle
- **CI/CD is the closest analogy** -- concurrency groups, approval gates, resource constraints, and pipeline stages all map directly to Nexus concerns
- **The existing spec/plan workflow is a strong foundation** -- the 4-level hierarchy, plan-per-feature, and commit-after-task conventions are natural orchestration boundaries that Nexus formalizes rather than replaces
- **File-based storage is sufficient for MVP** -- JSONL for events and sessions, JSON for config; database migration is a known future cost but not needed yet
- **TypeScript is the right language** -- single language for CLI, orchestration, and the visual dashboard; "simple and visual" demands the UI be native, not bolted on
- **Build order matters** -- audit trail first (other systems emit into it), then worktree isolation (immediate pain relief), then session registry (identity layer everything references)

## Discarded Candidates

| Candidate | Why discarded |
|-----------|--------------|
| C2: Budget & Token Metering | Phase 2 -- depends on session registry for correlation |
| C4: Approval Policy Engine | Phase 2 -- depends on audit trail and session registry |
| C5: Context Health Monitor | Low platform value, can be layered on later |
| C6: Orchestration Dashboard | Phase 2 -- needs data from infrastructure layer first |
| C7: Agent Task Scheduler | Phase 3 -- high value but high complexity and risk |
| C9: Spec & Backlog Manager | Phase 2 -- good fit but not foundational |
| C10: Quality Gate Pipeline | Phase 3 -- most ambitious, depends on nearly everything else |

## References

- docs/research/ai_dev_orch/explore.md
- docs/research/ai_dev_orch/ideate.md
- docs/research/ai_dev_orch/evaluate.md
- docs/research/ai_dev_orch/choose.md
