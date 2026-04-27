# Research: Ideate -- AI Development Orchestration

**Input:** docs/research/ai_dev_orch/explore.md

## Candidates

### Candidate 1: Session Registry & Lineage Tracker
**Home application/system:** Nexus / SessionSystem
**Size:** M (1-3 weeks)
**Description:** A core data store that tracks every agent session -- when it started, who spawned it, what it's working on, what it's touched, and how it relates to other sessions. Each session gets a unique ID with an optional parent pointer, forming a tree. State snapshots are captured at key decision points (task start, commit, approval request). The registry is append-only for auditability.

This is the "distributed tracing" equivalent for AI dev workflows. Everything else in Nexus references session IDs, so this is foundational infrastructure.
**Primary value:** You can always answer "where did this start, what path did it take, and where is it now?"

### Candidate 2: Budget & Token Metering
**Home application/system:** Nexus / BudgetSystem
**Size:** M (1-3 weeks)
**Description:** A metering layer that intercepts or polls agent activity to track token usage and cost in real time. Budgets are set per-project or per-task with configurable enforcement: soft cap (warn and continue), hard cap (block new requests), or graceful degradation (downgrade model). Alerts fire at configurable thresholds (e.g., 50%, 80%, 100%).

Requires an agent adapter to capture token counts -- for Claude Code, this could hook into session metrics or parse output. Budget state is persisted to survive restarts.
**Primary value:** No more surprise token bills; every task has a known cost boundary.

### Candidate 3: Worktree Isolation Manager
**Home application/system:** Nexus / IsolationSystem
**Size:** S (less than 1 week)
**Description:** A thin wrapper around `git worktree` that automatically creates an isolated working directory for each agent task, enforces branch naming conventions (from tech.md), and detects file-level conflicts before they happen. When two tasks declare overlapping file scopes, it flags the contention and offers to serialize them.

On task completion, the manager handles merge-back to the parent branch and cleans up the worktree. Integrates with the session registry so every worktree maps to a session ID.
**Primary value:** Agents can't accidentally step on each other's files; isolation is automatic, not manual.

### Candidate 4: Approval Policy Engine
**Home application/system:** Nexus / ApprovalSystem
**Size:** M (1-3 weeks)
**Description:** A rule engine that classifies every agent decision into tiers (routine, constrained, standard, critical) and routes them accordingly. Routine decisions (run tests, lint, read files) auto-approve. Constrained decisions (merge feature branch) auto-approve if conditions are met (tests pass, budget under limit). Standard and critical decisions queue for human review.

Rules are configured declaratively (YAML or JSON). The engine logs every decision -- auto-approved or human-reviewed -- to the audit trail with the rule that matched. Over time, you tune the rules to approve more without losing control.
**Primary value:** You stop being the bottleneck for routine agent decisions without giving up oversight of important ones.

### Candidate 5: Context Health Monitor
**Home application/system:** Nexus / ContextSystem
**Size:** S (less than 1 week)
**Description:** Monitors active agent sessions for signs of context window degradation: token count approaching limits, conversation length, repetition in outputs, increasing error rates. When a session hits a configurable threshold (e.g., 80% of context window), it alerts the user with options: continue, compact, checkpoint-and-restart.

On checkpoint, it captures the current task state (what's done, what's next, key decisions, relevant file paths) and can seed a fresh session with that summary. Lightweight -- reads session metadata rather than intercepting agent internals.
**Primary value:** Sessions get killed or refreshed before they go stale, not after you've noticed degraded output.

### Candidate 6: Orchestration Dashboard
**Home application/system:** Nexus / DashboardApp
**Size:** L (1-2 months)
**Description:** A local web application providing a unified visual view of all Nexus systems. Panels include: active sessions with status and budget burn, approval queue with pending items, contention heatmap showing overlapping work, timeline of recent events, cost breakdown by project/task, and spec lifecycle status.

Built as a local web server (serves on localhost) with near-real-time updates. Clicking any item drills into detail -- a session shows its full lineage, a task shows its audit trail. Filterable by date, agent, project, and status.
**Primary value:** You can see everything that's happening, has happened, and is waiting for you -- at a glance.

### Candidate 7: Agent Task Scheduler
**Home application/system:** Nexus / SchedulerSystem
**Size:** L (1-2 months)
**Description:** A DAG-based task scheduler that takes a plan's task list, resolves dependencies, and dispatches tasks to available agents. Tasks declare their inputs (what they need from prior tasks), outputs (what they produce), and resource requirements (estimated tokens, file scope). The scheduler starts tasks when dependencies are satisfied and resources are available.

Handles priority queuing (urgent tasks jump the line), preemption (pause low-priority work when budget is tight), and fairness (no single project monopolizes agents). Integrates with the plan workflow -- each plan task becomes a scheduler task.
**Primary value:** You stop being the dispatcher; Nexus figures out what can run next and runs it.

### Candidate 8: Audit Trail & Event Log
**Home application/system:** Nexus / AuditSystem
**Size:** S (less than 1 week)
**Description:** An append-only structured event log that captures every significant action across all Nexus systems: session starts/stops, budget checks, approval decisions, file changes, commits, conflicts detected, quality gate results. Each event has a timestamp, correlation ID (ties to session), event type, agent ID, and structured payload.

Queryable by session, agent, time range, or event type. File-based for MVP (JSONL, rotated daily) with a simple CLI for querying. Retention policy: 90 days hot, then archive.
**Primary value:** You can always trace back through "why does this code look like this?" to the agent decisions that produced it.

### Candidate 9: Spec & Backlog Lifecycle Manager
**Home application/system:** Nexus / BacklogSystem
**Size:** M (1-3 weeks)
**Description:** Extends the existing spec and research workflows into a managed lifecycle. Active specs are surfaced prominently; implemented specs auto-archive. Ideas from any source (conversation, research session, ad-hoc note) land in a structured backlog with size estimates, priority, and links to related research.

The backlog integrates with the research funnel: ideas can be promoted to research sessions, research outputs feed into spec creation. Specs in flight show progress (from their plan files). The system answers: "What's in the pipeline, what's active, what's blocked, and what's just an idea?"
**Primary value:** Ideas don't get lost, active work is visible, finished work gets out of the way.

### Candidate 10: Quality Gate Pipeline
**Home application/system:** Nexus / QualitySystem
**Size:** XL (2+ months)
**Description:** A multi-stage quality assurance pipeline that every agent output passes through before it's considered "done." Stage 1: automated checks (tests pass, linter clean, no security issues, type checks). Stage 2: risk scoring based on change scope, complexity, and which files were touched. Stage 3: review routing -- low-risk changes get a spot check, high-risk changes get full human review.

Tracks per-agent quality metrics over time (first-time pass rate, rejection reasons, rework frequency). Builds an agent reputation system -- agents that consistently pass checks earn higher auto-approval thresholds. Integrates with the approval engine for review routing.
**Primary value:** Review effort scales with risk, not with volume; you review what matters instead of everything.

## Coverage Map

The 10 candidates span all 13 pain points identified in exploration:

| Pain Point | Covered By |
|------------|------------|
| Resource awareness | C2 (Budget & Metering) |
| Cost/budget control | C2 (Budget & Metering) |
| Session lineage | C1 (Session Registry) |
| Context window degradation | C5 (Context Health Monitor) |
| Ideation backlog | C9 (Spec & Backlog Manager) |
| Spec lifecycle | C9 (Spec & Backlog Manager) |
| Approval delegation | C4 (Approval Policy Engine) |
| Quality gate | C10 (Quality Gate Pipeline) |
| Change isolation | C3 (Worktree Isolation Manager) |
| Resource contention | C3 (Worktree) + C7 (Scheduler) |
| Coordination overhead | C7 (Agent Task Scheduler) |
| Audit trail | C8 (Audit Trail & Event Log) |
| Visual dashboard | C6 (Orchestration Dashboard) |

**Size distribution:** 3x S, 3x M, 2x L, 1x XL -- spans small tactical wins to large foundational systems. C1 (Session Registry) and C8 (Audit Trail) are foundational infrastructure that other candidates depend on. C6 (Dashboard) and C7 (Scheduler) are the largest integrations. C10 (Quality Gate) is the most ambitious, building a reputation system on top of automated checks.
