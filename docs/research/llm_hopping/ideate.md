# Research: Ideate — LLM Hopping

**Input:** docs/research/llm_hopping/explore.md

## Candidates

### Candidate 1: Provider Adapter Layer
**Home application/system:** Nexus Core / new LLM Provider system
**Size:** M
**Description:** A TypeScript abstraction layer that normalises communication with multiple LLM backends (Anthropic, OpenAI, Ollama) behind a single interface. Each provider gets a thin adapter implementing a shared `LLMProvider` interface (model list, invoke, stream, cost estimate). No routing logic — this is purely the plumbing that makes routing possible. Includes health-check and availability detection for local providers (Ollama).
**Primary value:** Every other LLM hopping feature is built on top of this; without it, each routing feature must re-implement provider-specific details.

---

### Candidate 2: Static Model Registry + Session-Start Assignment
**Home application/system:** Nexus Core / LLM Provider system
**Size:** S
**Description:** A JSON config file (`~/.nexus/models.json`) that declares the available models, their provider, tier (premium / standard / cheap), and estimated cost per 1K tokens. When `nexus run` starts a session, the user or a rule selects a model from the registry. No dynamic routing — the model is fixed for the session. Includes a CLI command to list, add, and remove models from the registry.
**Primary value:** Gives users explicit visibility and control over which models are available and at what cost, without any automation complexity.

---

### Candidate 3: Cost-Aware Session Router
**Home application/system:** Nexus Core / LLM Provider system
**Size:** M
**Description:** At session start, Nexus evaluates a configurable routing policy against the current budget state (from the Budget & Metering system) and the task's declared priority or type. If remaining budget is above a high-water mark, route to the premium model. If between low and high marks, use standard. If below low-water mark, use the cheapest available model or block. Routing decisions are emitted as audit events. Users can override per-session via a `--model` flag.
**Primary value:** Automatically protects budget by downgrading to cheaper models as spend approaches limits, without requiring manual intervention.

---

### Candidate 4: Task Complexity Classifier
**Home application/system:** Nexus Core / LLM Provider system
**Size:** L
**Description:** A lightweight classifier (rule-based or a small embedded model) that inspects a task's description, file types, and codebase size to estimate complexity (low / medium / high). The complexity score feeds into the router as a second signal alongside budget. Low-complexity tasks (e.g., "format this file", "summarise this diff") are sent to cheap models even when budget is healthy. High-complexity tasks (e.g., "refactor this entire module", "debug this race condition") are protected and sent to premium models. Requires defining a taxonomy of task types.
**Primary value:** Reduces cost even before budget limits are hit, by matching model capability to actual task need rather than defaulting to the most capable model for everything.

---

### Candidate 5: Ollama Local Model Integration
**Home application/system:** Nexus Core / LLM Provider system
**Size:** S
**Description:** A dedicated Ollama adapter that connects to a locally running Ollama instance, discovers available models via the Ollama REST API, and exposes them through the Provider Adapter Layer. Includes availability detection (is Ollama running?), model pull status checking, and graceful fallback to cloud providers when local models are unavailable. Config allows setting Ollama as the default provider for cost-zero local execution.
**Primary value:** Enables zero-cost local LLM execution for tasks where quality requirements allow it, with automatic fallback when Ollama is not running.

---

### Candidate 6: Per-Project Routing Rules
**Home application/system:** Nexus Core / LLM Provider system
**Size:** S
**Description:** Extends the routing config to support per-project overrides stored in a project's `.nexus/routing.json` file. A project working on a critical production codebase might lock all sessions to Opus; a personal experiment project might default everything to Haiku or Ollama. Global rules in `~/.nexus/routing.json` are the fallback; project rules take precedence. The CLI shows which rule is active when a session starts.
**Primary value:** Lets developers apply different cost/quality policies to different projects without changing global settings each time.

---

### Candidate 7: Routing Dashboard View
**Home application/system:** Nexus Dashboard / new Routing panel
**Size:** M
**Description:** A Dashboard panel that visualises LLM usage across sessions: which models were used, estimated cost per session and per provider, routing decisions (why a model was chosen), and a cost trend over time. Consumes routing events from the audit trail. Includes a cost breakdown by project, provider, and model tier. Allows the user to see at a glance whether routing policy is working as intended.
**Primary value:** Makes the cost-saving impact of routing visible and actionable — without this, users have no feedback loop to know if routing is helping.

---

### Candidate 8: Fallback Chain Configuration
**Home application/system:** Nexus Core / LLM Provider system
**Size:** S
**Description:** Users configure an ordered fallback chain per tier or per task type (e.g., `[claude-opus, claude-sonnet, gpt-4o]` for premium; `[ollama/llama3, claude-haiku, gpt-3.5]` for cheap). If the first provider in the chain is unavailable or returns an error, Nexus automatically tries the next. Fallback events are emitted to the audit trail. Configurable via `~/.nexus/routing.json`.
**Primary value:** Increases reliability — sessions are not blocked by a single provider outage or local model unavailability, and the fallback behaviour is explicit and auditable.

---

### Candidate 9: Budget-Triggered Model Downgrade Alerts
**Home application/system:** Nexus Core + Dashboard
**Size:** S
**Description:** When the routing system downgrades a session's model due to budget constraints, it emits a structured alert event visible in the Dashboard and optionally in the CLI. The alert shows which session was affected, which model was requested vs. assigned, and the budget state at the time. Users can acknowledge the alert and optionally override the downgrade for that session. No new routing logic — purely observability and user control layered on top of the Cost-Aware Router.
**Primary value:** Prevents silent quality degradation — users always know when a cheaper model was substituted and can make an informed decision about whether to accept it.

---

## Coverage Map

The candidate list spans the full design space from explore.md:

- **Routing trigger:** Candidates 3 (budget-driven), 4 (task-complexity-driven), 6 (project-policy-driven) cover static, dynamic, and hybrid triggers
- **Provider abstraction:** Candidates 1 (adapter layer), 5 (Ollama), 8 (fallback chain) address the plumbing and reliability axes
- **User control:** Candidates 6 (per-project rules), 9 (downgrade alerts + override) address the autonomy vs. automation tension
- **Observability:** Candidates 7 (dashboard) and 9 (alerts) close the feedback loop
- **Scope range:** S candidates (2, 5, 6, 8, 9) through M (1, 3, 7) to L (4) — no XL candidates, reflecting that LLM hopping is an extension of existing systems rather than a greenfield platform
