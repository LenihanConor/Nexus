# Research: Explore — LLM Hopping

**Session date:** 2026-04-27
**Folder:** docs/research/llm_hopping/

## Problem Space Overview

As AI-assisted development matures, developers are increasingly running multiple agent tasks simultaneously — some requiring deep reasoning and nuanced code generation, others needing only simple summarisation, formatting, or classification. The cost disparity between frontier models (Claude Opus, GPT-4o) and lighter options (Claude Haiku, GPT-3.5, local Ollama models) is significant — often 10–50x per token. Without deliberate routing, every task runs on the most capable (and most expensive) model by default.

LLM hopping — dynamically routing tasks to different models based on task characteristics, cost constraints, or capability requirements — addresses this directly. In the context of Nexus, which already orchestrates multiple agent sessions, this capability fits naturally into the orchestration engine. Nexus can observe the nature of tasks, enforce budget constraints, and dispatch to the appropriate backend, giving developers cost awareness and model control without changing their workflow.

The problem is compounded by the diversity of LLM backends: cloud APIs (Anthropic, OpenAI), local runtimes (Ollama), and future options (Mistral, Groq, etc.) all have different interfaces, pricing models, capability profiles, and latency characteristics. A clean abstraction layer is needed so that routing logic does not become entangled with provider-specific details.

## Existing Approaches

- **Manual model selection per session** — user explicitly names the model when starting an agent (Claude Code's `--model` flag, Aider's `--model` flag). No automation.
- **LiteLLM** — open-source proxy that normalises multiple LLM providers behind a single OpenAI-compatible API; supports cost tracking and fallback routing.
- **OpenRouter** — cloud-hosted LLM routing proxy; routes to cheapest or fastest provider; no local model support.
- **Semantic Router** — library that classifies prompts/task descriptions and routes to different handlers based on intent.
- **LangChain / LangGraph router nodes** — graph-based routing; task nodes dispatch to different LLM nodes based on conditional logic.
- **Agent frameworks with model-per-role** — e.g., AutoGen, CrewAI allow each agent role to be assigned a different model; roles are static, not dynamic.
- **Budget-aware orchestrators** — systems like Martian or custom middleware that monitor token usage and downgrade model when budget thresholds are hit.
- **Capability tiering** — classify tasks into tiers (complex reasoning, standard coding, simple Q&A) and map tiers to models statically.

## Design Axes

| Axis | Options | Notes |
|------|---------|-------|
| Routing trigger | Static (configured upfront) / Dynamic (per-task at runtime) / Hybrid | Dynamic is more flexible; static is simpler to reason about |
| Routing signal | Task type / Budget remaining / Latency target / User override / All of above | Cost is the primary driver here; task type is secondary |
| Provider abstraction | Thin shim per provider / Unified adapter layer / Third-party proxy (LiteLLM) | Adapter layer gives control; proxy adds a dependency |
| Model registry | Hardcoded list / Config file / Discovered at runtime (Ollama introspection) | Config file is pragmatic for v1; discovery is nice-to-have |
| Scope of routing | Only new session starts / Mid-session switching / Both | Mid-session switching is complex; session-start routing is simpler and safer |
| User control | Fully automatic / Always prompt / Configurable threshold | Configurable threshold respects user autonomy |
| Budget enforcement | Advisory (warn) / Hard limit (block) / Soft limit (downgrade model) | Soft downgrade is most useful; hard block is a safety valve |

## Known Tradeoffs

- **Capability vs. cost:** cheaper models produce lower-quality output on complex tasks; routing must be conservative — downgrade only when the task genuinely warrants it
- **Latency:** local Ollama models avoid API cost but may be slower or lower quality; network latency of cloud APIs varies
- **Context compatibility:** different models have different context window sizes; a task that fits in Opus's 200K window may overflow a smaller model
- **Prompt compatibility:** system prompts tuned for Claude may not translate well to GPT or Llama — routing may require prompt adaptation per provider
- **Observability cost:** tracking model usage, cost, and quality across providers adds complexity to the audit trail
- **User trust:** automatic downgrading without visibility erodes trust; routing decisions must be auditable
- **Local model availability:** Ollama models must be pulled/running; Nexus cannot assume they are always available

## Known Pitfalls

- Routing on task description alone is unreliable — short descriptions don't capture actual complexity
- Mid-session model switching can break context continuity (agent loses memory/state)
- Cost estimates based on token counts are approximations; actual billing may differ
- Treating all Ollama models as "cheap" ignores that some local models are large and slow
- Over-engineering the router before knowing actual usage patterns — premature optimisation
- Provider API changes (auth, endpoint, response format) break the adapter layer unexpectedly
- Ignoring quality feedback — cheaper model produces bad output, user re-runs on Opus, doubling cost

## Platform-Specific Opportunities

### Relevant Existing Modules / Systems

| Module/System | Relevance |
|---------------|-----------|
| Audit Trail | Every routing decision and model invocation should be emitted as an event — model chosen, estimated cost, task type |
| Session Registry | Sessions already track agent identity; extending to track model + provider per session is natural |
| Budget & Metering (Phase 2) | LLM routing is the enforcement arm of the budget system — route to cheaper model when budget threshold approached |
| Worktree Isolation | Model selection happens at session start, same point as worktree allocation — natural coupling |
| Nexus Core CLI | The `nexus run` command (or equivalent) is the entry point for model selection and routing config |

### Platform Decision Constraints

| Decision | Implication for this topic |
|----------|---------------------------|
| PD-001 TypeScript only | Provider adapters must be TypeScript; no Python-native LLM libraries (LangChain, etc.) without a subprocess boundary |
| PD-002 File-based storage | Model registry, routing rules, and cost ledger stored as JSON config files in `~/.nexus/` |
| PD-004 Append-only event log | Routing decisions emitted as structured events; never mutated after the fact |
| PD-006 Core and Dashboard are separate | Routing logic lives in Core; Dashboard consumes routing events for visualisation |
| PD-007 Centralized storage in `~/.nexus/` | Provider config (API keys, model lists, routing rules) stored centrally, not per-project |

## Open Questions for Ideation

- Should routing be purely cost-driven, or should task-type classification also be a first-class input?
- How does Nexus detect task complexity — from the task description, from the calling agent, or from a classifier model?
- Should Nexus manage API keys for multiple providers, or delegate that to the user's environment?
- Is mid-session model switching in scope for v1, or only session-start routing?
- How should Nexus handle the case where a preferred model (Ollama) is unavailable — fallback automatically or fail loudly?
- Should routing rules be global (per user) or per-project?
- How does this interact with Claude Code's own model selection (`--model` flag) — does Nexus wrap or replace that?
