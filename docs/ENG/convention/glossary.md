---
slug: glossary
title: Glossary
category: canon
canonical-candidate: false
promoted-from: research/
promoted-on: 2026-07-09
status: promoted
---

# Glossary

**Status:** canonical as of 2026-04-30. Cross-product use only.
Per-product internal terms are not duplicated here.

| Term | Definition |
|---|---|
| **L0** | On the operator's hardware tier. Phone, browser, iOS app, their own Linux box. Fine-tuned / packaged by us. |
| **L1** | Off-device tier on our hosted infrastructure. Research + production surfaces. |
| **L2** | Off-device tier, third party. We may pay; we don't own. |
| **Echo** | Final fallback. No model. Logged + operator notified. |
| **Surface** | A specific variant within a tier (e.g., Sakura L1 vision vs. Sakura L1 text reasoner). |
| **Cascade** | The route from L0 → L1 → L2 → Echo as a request escalates through tiers. |
| **`<Product> L<n> LLM`** | Canonical naming form. See `naming-conventions.md`. |
| **Curator** | The product. Customer-facing CMS. |
| **Sakura** | Curator's AI brand. The cascade through Sakura L0/L1/L2 LLM. |
| **Lacuna LLM** (preferred over bare "Lacuna") | The open-source AI product. Dialectical, research-grade. Repo: `/Users/alfred/code/lacuna/`. |
| **Meridian** (was Lacuna Monitoring, renamed 2026-07-09) | The observability product. Daemon + dashboard + L1 oracle (Q3+). Repo: `/Users/alfred/code/meridian/`. |
| **Lacuna** (bare) | **Ambiguous — qualify always.** Either "Lacuna LLM" (the dialectical model) or "Meridian" (the observability product, formerly Lacuna Monitoring). Cross-session handoffs have used "Lacuna" for both; if you read it without qualifier, treat it as a flag to ask which product. |
| **Lacuna Engineering** | The full company. The roster that staffs all three products (Curator, Lacuna LLM, Meridian). |
| **LMTP** | Meridian's telemetry protocol. Product-neutral. |
| **Persona graph** | ML store of mood / behavior / register that an LLM consumes at system-prompt time. The persona is the *interface* the LLM presents (tone, register, vocabulary, what it will and won't say) — not a claim that the LLM has a personality. See `persona-graph-strategy.md`. |
| **ML before LLM** | The principle that deterministic ML solves what it can before reaching for an LLM. See `ml-before-llm.md`. |
| **Operator** | The human running a tenanted instance of a product. |
| **Echo notification** | The operator-side message when a turn fell all the way through to Echo. |

## Out of scope here

- Curator-internal terms (atlas, marker protocol, hallmark, etc.).
- Lacuna-internal terms (4-axis rubric, dialectical register, etc.).
- Meridian-internal terms (LMQP, LJR, etc. — see that
  product's `spec/`).
