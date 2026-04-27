# Research: Explore -- AI Development Orchestration

**Session date:** 2026-04-26
**Folder:** docs/research/ai_dev_orch/

## Problem Space Overview

Developers using CLI-LLM tools (Claude Code, Cursor, Aider, Copilot Workspace) are hitting a wall once they move beyond single-agent, single-task workflows. The moment you have multiple agents running concurrently -- or even sequentially on related work -- you lose visibility into what's happening, what it's costing, and whether agents are stepping on each other. The human becomes a full-time dispatcher rather than a developer.

This is the "control plane" problem for AI-assisted development. CI/CD solved a similar problem for build/test/deploy pipelines decades ago. Container orchestration (Kubernetes) solved it for services. But no equivalent exists for the emerging pattern of multi-agent coding workflows. The gap is felt most acutely by power users who push CLI-LLM tools hard and hit the limits of manual coordination.

The 13 specific concerns identified span three broad categories: **visibility** (resource awareness, session lineage, audit trail, dashboard), **control** (cost/budget, approval delegation, quality gates, context window management), and **coordination** (change isolation, resource contention, coordination overhead, spec lifecycle, ideation backlog).

## Existing Approaches

- **Multi-agent frameworks** (CrewAI, AutoGen, LangGraph) -- solve agent-to-agent communication and task graphs, but miss dev-specific concerns like git isolation, cost budgets, and spec lifecycle
- **CI/CD systems** (GitHub Actions, GitLab CI) -- proven patterns for concurrency groups, approval gates, matrix builds, and resource constraints; closest existing analogy
- **Container orchestration** (Kubernetes) -- resource requests/limits, namespace isolation, quota systems; conceptually maps to token budgets and agent isolation
- **Job schedulers** (Slurm, Airflow) -- DAG-based dependency resolution, priority queues, preemption; directly applicable to agent task scheduling
- **Distributed tracing** (Jaeger, Zipkin) -- trace IDs, span hierarchies, causality tracking; maps cleanly to session lineage
- **LLM observability** (LangSmith, Arize) -- token counting, cost calculation, tool call tracing; partial coverage of resource awareness
- **Git worktrees** -- lightweight isolation for concurrent development; cheapest way to prevent file-level collisions
- **Durable execution** (Temporal) -- replay-based fault recovery, causally consistent history; applicable to session checkpointing and audit trails

## Design Axes

| Axis | Options | Notes |
|------|---------|-------|
| Deployment model | Local-only / Cloud / Hybrid | Hybrid recommended: agents run locally, orchestration metadata centralized |
| Communication model | Polling / Reactive / Event-driven | Hybrid: event-driven locally, polling for remote aggregation |
| Agent coupling | Agent-agnostic / Agent-specific plugins | Common interface + optional enrichment plugins per agent |
| Consistency model | Strong / Eventual | Strong for budgets and approvals; eventual for metrics and audit |
| Storage backend | File-based / SQL / Time-series DB | File-based MVP, SQL for scale |
| Isolation mechanism | Git worktree / Branch-only / Container / Directory clone | Git worktree for MVP (lightweight, familiar) |
| Coordination model | Centralized scheduler / Distributed / DAG-based | Centralized DAG scheduler for MVP |
| Dashboard delivery | CLI / Local web / Cloud web | Local web server for MVP |
| Blocking model | Blocking / Non-blocking / Hybrid | Non-blocking for orchestration, blocking for approvals |

## Known Tradeoffs

- **Automation vs trust**: Auto-approving routine decisions saves time but risks wrong approvals; risk-scored routing is the middle ground
- **Rich tracking vs overhead**: Detailed audit trails and metrics add overhead to every agent action; batching and async writes help
- **Context checkpointing vs continuity**: Killing degraded sessions preserves quality but loses accumulated context; summarization bridges the gap imperfectly
- **Pre-emptive conflict prevention vs throughput**: Locking files/regions before work prevents collisions but serializes agents; optimistic concurrency is faster but risks wasted work
- **Agent-specific integration vs portability**: Deep integration with one agent (e.g., Claude Code) enables rich features but creates lock-in; generic interfaces limit what you can track
- **Centralized control vs agent autonomy**: The more Nexus controls, the less agents can self-direct; the balance point depends on trust level
- **File-based simplicity vs query power**: Files are easy to start with but hard to query at scale; database migration is a known future cost

## Known Pitfalls

- **Coordination overhead explosion**: O(N^2) coordination cost with N agents; hierarchical grouping (teams of agents) is the standard mitigation
- **Token meter overruns**: Estimated tokens != actual tokens; conservative estimates waste budget, aggressive estimates cause overruns
- **Context window degradation is silent**: Performance degrades gradually, not suddenly; by the time you notice, significant work may be low-quality
- **Merge conflicts at scale**: Git worktrees don't prevent logical conflicts (two agents changing the same API contract differently); file-level isolation isn't enough
- **Approval bottleneck replacement**: If approval rules are too conservative, you replace "human as dispatcher" with "human as approver" -- same bottleneck, different shape
- **Audit trail storage explosion**: Verbose logging grows fast; retention policies and tiered storage are essential from day one
- **Session state corruption**: Concurrent writes to shared orchestration state cause races; needs transactions or event sourcing
- **Cost attribution ambiguity**: When agent A spawns agent B, who owns the cost? Needs explicit attribution rules

## Platform-Specific Opportunities

### Relevant Existing Modules / Systems

| Module/System | Relevance |
|---------------|-----------|
| Spec workflow (CLAUDE.md) | Already defines a 4-level hierarchy (Platform > App > System > Feature) with decision tracking -- Nexus orchestration can enforce this lifecycle |
| Research workflow (docs/research/) | Structured ideation funnel already exists -- can become the backlog management system |
| Steering docs (.claude/steering/) | Tech and structure context already loaded for spec work -- orchestrator can use these as constraints for agent task assignment |
| Memory system (.claude/projects/) | Cross-session persistence already exists -- session lineage could extend this pattern |
| Plan workflow (*.plan.md) | Task-level tracking alongside specs -- natural integration point for agent task assignment and progress tracking |

### Platform Decision Constraints

| Decision | Implication for this topic |
|----------|---------------------------|
| Spec-driven development (CLAUDE.md) | Orchestrator must enforce "spec approved before implementation" -- this is a built-in quality gate |
| 5-step spec process | Approval delegation must respect the mandatory Steps 3-4 (binding decisions + AI review) -- cannot auto-approve these |
| Plan-per-feature model | Agent tasks map 1:1 to plan tasks -- natural unit of work for orchestration |
| Commit-after-each-task rule | Natural checkpoint boundary for isolation and audit trailing |
| Git workflow conventions (tech.md) | Branch naming and commit style are already defined -- orchestrator enforces these |

## Open Questions for Ideation

- Should Nexus be a standalone tool or deeply integrated into the existing CLAUDE.md/spec workflow?
- What's the right granularity for orchestration: per-session, per-task, per-commit, or per-spec?
- How does Nexus handle agents it can't instrument (e.g., Cursor, which runs inside an IDE)?
- Should the dashboard be real-time (WebSocket) or near-real-time (polling)? What latency is acceptable?
- Is file-based storage sufficient for MVP, or does queryability demand a database from day one?
- How should Nexus handle the "human as dispatcher" problem -- should it proactively suggest task assignments, or only execute what's explicitly queued?
- What's the minimum viable agent adapter? What must every agent report?
- Should budget enforcement be hard (block) or soft (warn) by default?
- How does Nexus interact with existing CI/CD pipelines -- complement, replace, or ignore?
- Can the existing research/spec/plan workflow become the ideation backlog, or does it need a separate system?
