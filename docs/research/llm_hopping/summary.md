# Research Summary — LLM Hopping

**Session folder:** docs/research/llm_hopping/
**Date:** 2026-04-27

## One-Line Answer

A new LLM Provider system in Nexus Core that abstracts multiple providers (Claude, OpenAI, Ollama) and routes tasks to the cheapest capable model based on budget state and session policy.

## Journey

1. **Explored:** Cost disparity between frontier and lightweight models (10–50x per token) creates a strong incentive to route simpler tasks to cheaper providers; Nexus's existing session orchestration is a natural home for this logic. Key constraints include TypeScript-only adapters (PD-001), file-based config in `~/.nexus/` (PD-002, PD-007), and routing decisions as append-only audit events (PD-004).
2. **Ideated:** 9 candidates generated, ranging from S (model registry, Ollama integration) to L (task complexity classifier); candidates span plumbing, routing logic, reliability, and observability.
3. **Evaluated:** Static Model Registry scored highest (4.30) as the safest foundational primitive; Ollama Integration (4.10) and Per-Project Routing Rules (4.05) rounded out the top 3.
4. **Chose:** Full LLM Provider system spec (not a single feature) — candidates are a layered feature stack, not competing alternatives; user confirmed Option A.

## Chosen Work Item

**Name:** LLM Provider System
**Home application/system:** Nexus Core / new LLM Provider system
**Suggested spec type:** System
**Estimated size:** L (system total); individual features are S–M

## Key Insights from Exploration

- All 9 candidates are dependencies of each other — the research produced a build order, not a shortlist
- Provider Adapter Layer is the true foundation; nothing else works without it
- Ollama integration is the highest user/product value quick win — zero API cost for local execution
- Mid-session model switching is out of scope for v1; routing only at session start
- Task Complexity Classifier (Candidate 4) is deferred — too risky and expensive before routing is proven
- Routing decisions must be auditable (PD-004) — silent model downgrades erode user trust

## Discarded Candidates

| Candidate | Why discarded |
|-----------|--------------|
| Task Complexity Classifier | Highest complexity and risk; deferred until routing layer is proven |
| Routing Dashboard View | Dashboard work deferred until Core system is functional; will consume routing events from audit trail |

## References

- docs/research/llm_hopping/explore.md
- docs/research/llm_hopping/ideate.md
- docs/research/llm_hopping/evaluate.md
- docs/research/llm_hopping/choose.md
