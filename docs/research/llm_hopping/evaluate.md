# Research: Evaluate — LLM Hopping

**Input:** docs/research/llm_hopping/ideate.md

## Scoring Criteria

- **Platform Value (0.25):** Improves shared platform reusability or capability
- **User/Product Value (0.20):** Directly improves the experience for end users
- **Implementation Cost (0.25):** Inverse of effort — 5 = very cheap, 1 = very expensive
- **Risk (0.15):** Inverse of uncertainty — 5 = well-understood, 1 = highly uncertain
- **Platform Fit (0.15):** Aligns with existing architecture and binding decisions

## Scores

| Candidate | Platform (0.25) | User (0.20) | Cost (0.25) | Risk (0.15) | Fit (0.15) | Total |
|-----------|-----------------|-------------|-------------|-------------|------------|-------|
| 1. Provider Adapter Layer | 5 | 2 | 3 | 3 | 5 | 3.60 |
| 2. Static Model Registry | 3 | 4 | 5 | 5 | 5 | 4.30 |
| 3. Cost-Aware Session Router | 4 | 5 | 3 | 3 | 4 | 3.80 |
| 4. Task Complexity Classifier | 3 | 4 | 1 | 1 | 3 | 2.40 |
| 5. Ollama Local Model Integration | 3 | 5 | 4 | 4 | 5 | 4.10 |
| 6. Per-Project Routing Rules | 2 | 4 | 5 | 5 | 5 | 4.05 |
| 7. Routing Dashboard View | 2 | 5 | 2 | 3 | 4 | 3.05 |
| 8. Fallback Chain Configuration | 3 | 3 | 4 | 4 | 5 | 3.70 |
| 9. Budget-Triggered Downgrade Alerts | 2 | 4 | 5 | 5 | 4 | 3.90 |

## Top 3 Candidates

### Rank 1: Static Model Registry + Session-Start Assignment (score: 4.30)
**Why:** The simplest thing that delivers tangible value — a JSON model registry in `~/.nexus/` aligns perfectly with PD-002 (file-based storage) and PD-007 (centralised storage). It gives users immediate visibility into available models and costs, requires no complex routing logic, and naturally becomes the foundation every other candidate builds on top of. At size S, it can ship quickly and prove out the model abstraction before any automation is added.
**Watch out for:** This candidate alone doesn't deliver cost automation — it's a control primitive, not a router. Users still manually choose models unless a routing layer (Candidate 3) is added. The registry schema must be designed with future routing in mind to avoid a breaking change later.

### Rank 2: Ollama Local Model Integration (score: 4.10)
**Why:** Zero-cost local execution is the single highest user/product value in the set — it directly eliminates API spend for tasks where local quality is acceptable. The Ollama REST API is stable and well-documented, making this a low-risk S-sized candidate. It fits the local-first design philosophy (PD-003) and is a concrete, visible win that requires only the Provider Adapter Layer as a prerequisite.
**Watch out for:** Value depends entirely on Ollama being installed and models being pulled — Nexus cannot guarantee this. Graceful fallback handling is essential and adds surface area. Quality gap between local and cloud models must be communicated clearly to users.

### Rank 3: Per-Project Routing Rules (score: 4.05)
**Why:** Extremely cheap to build (S, pure config override logic), zero runtime risk, and addresses a real workflow need — developers want different cost/quality policies for production repos vs. experiments without touching global settings. Fits cleanly into PD-007 (centralised storage with project-level overrides) and PD-002 (file-based config).
**Watch out for:** Only valuable once a routing layer exists to apply the rules — this is a thin extension of Candidate 3, not a standalone feature. Shipping it before the router exists produces dead config.

## Recommendation

**Static Model Registry + Session-Start Assignment** is the right first spec. It is the smallest, safest thing that establishes the foundational abstraction — a declared list of providers, models, tiers, and costs — that every other LLM hopping feature depends on. Without it, Candidates 3, 5, 6, 8, and 9 have no model inventory to reason about. It aligns directly with PD-002 (file-based JSON config), PD-007 (centralised `~/.nexus/` storage), and PD-004 (routing decisions as audit events). At size S, it ships fast and lets the team validate the schema and CLI interaction before building routing automation on top. The natural follow-on is Candidate 1 (Provider Adapter Layer) as part of the same system spec, with Candidate 5 (Ollama) and Candidate 3 (Cost-Aware Router) as subsequent feature specs within the same system.
