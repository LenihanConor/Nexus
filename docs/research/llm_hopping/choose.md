# Research: Choice — LLM Hopping

**Date:** 2026-04-27
**Chosen candidate:** LLM Provider System (new Nexus Core system)

## Rationale

The 9 candidates are not competing alternatives — they form a layered feature stack. The right unit to spec is a new system within Nexus Core that owns all LLM provider abstraction, model routing, and cost-aware dispatch. Each candidate becomes a feature spec within that system, implemented in dependency order.

User confirmed: spec a new LLM Provider system, not a single feature.

## What Was Ruled Out

| Candidate | Reason not chosen |
|-----------|------------------|
| Task Complexity Classifier | Deferred — highest complexity (L), highest risk, lowest score; revisit after routing is proven |
| Routing Dashboard View | Deferred — Dashboard work comes after Core system is functional; consumes routing events from audit trail |

All other candidates are in scope as features within the new system, to be sequenced by dependency order.

## Pre-Spec Commitments

- Primary driver is **cost-aware task routing** — send cheaper/simpler tasks to lighter models
- Must support: Claude (Sonnet, Opus, Haiku), OpenAI (GPT-4o, GPT-3.5), Ollama (local models)
- Routing should be **cost-driven first**, task-type-driven second
- Provider config (API keys, model list, routing rules) stored in `~/.nexus/` per PD-007
- All routing decisions emitted as audit events per PD-004
- Mid-session model switching is out of scope for v1 — routing at session start only
- Task Complexity Classifier (Candidate 4) and Routing Dashboard View (Candidate 7) are deferred

## Build Order (suggested feature sequence)

1. Provider Adapter Layer — foundational plumbing
2. Static Model Registry + Session-Start Assignment — model inventory and CLI
3. Ollama Local Model Integration — first local provider
4. Cost-Aware Session Router — first routing logic
5. Per-Project Routing Rules — policy extension
6. Fallback Chain Configuration — reliability extension
7. Budget-Triggered Downgrade Alerts — observability extension

## Next Step

Run /spec-system with this candidate as input.
Suggested parent application: Nexus Core
Suggested system name: LLM Provider
