# Nexus Backlog

Work items sourced from completed research sessions. Ordered by phase and dependency.

## Ready to Start

| Item | Type | Size | Research | Notes |
|------|------|------|----------|-------|
| LLM Provider System | System | L | [llm_hopping](research/llm_hopping/summary.md) | 7 features in dependency order — see build order below |

### LLM Provider — Feature Build Order
1. Provider Adapter Layer (M) — foundational; nothing else works without it
2. Static Model Registry + Session-Start Assignment (S)
3. Ollama Local Model Integration (S)
4. Cost-Aware Session Router (M)
5. Per-Project Routing Rules (S)
6. Fallback Chain Configuration (S)
7. Budget-Triggered Downgrade Alerts (S)

---

## Phase 2

| Item | Type | Size | Research | Notes |
|------|------|------|----------|-------|
| Budget & Token Metering | System | M | [ai_dev_orch](research/ai_dev_orch/summary.md) | Depends on Session Registry; tracks token usage + cost, soft/hard caps per project |
| Approval Policy Engine | System | M | [ai_dev_orch](research/ai_dev_orch/summary.md) | Depends on Audit Trail + Session Registry; rule-based auto-approve vs. human review routing |
| Context Health Monitor | System | S | [ai_dev_orch](research/ai_dev_orch/summary.md) | Monitors context window health; checkpoint-and-restart on threshold |
| Spec & Backlog Lifecycle Manager | System | M | [ai_dev_orch](research/ai_dev_orch/summary.md) | Managed backlog + spec lifecycle; promotes ideas → research → spec |

---

## Phase 3

| Item | Type | Size | Research | Notes |
|------|------|------|----------|-------|
| Agent Task Scheduler | System | L | [ai_dev_orch](research/ai_dev_orch/summary.md) | DAG-based scheduler; dispatches plan tasks to agents by dependency order + resource availability |
| Quality Gate Pipeline | System | XL | [ai_dev_orch](research/ai_dev_orch/summary.md) | Multi-stage QA pipeline; risk scoring, review routing, agent reputation system |

---

## Deferred (needs re-evaluation before speccing)

| Item | Type | Size | Research | Notes |
|------|------|------|----------|-------|
| Task Complexity Classifier | Feature (LLM Provider) | L | [llm_hopping](research/llm_hopping/summary.md) | Deferred — too risky before routing layer is proven; revisit after Cost-Aware Router is live |
| Routing Dashboard View | Feature (Dashboard) | M | [llm_hopping](research/llm_hopping/summary.md) | Deferred — Dashboard work after LLM Provider Core system is functional |
