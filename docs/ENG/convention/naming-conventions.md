---
slug: naming-conventions
title: Naming conventions
category: canon
canonical-candidate: false
promoted-from: research/
promoted-on: 2026-07-09
status: promoted
---

# Naming conventions

**Status:** canonical as of 2026-04-30; Lacuna L0 confirmed
2026-05-01-PM as the existing Qwen 2.5-3B trained on Linux stuff
(SRE orchestrator on operator's Linux box). Both products use
L0/L1/L2 — same depth. Artifact-naming convention
`<product>-l<n>-llm` formalized same date.

## Canonical reference forms

Two equivalent forms, both load-bearing:

- **Formal (prose):** `<Product> L<n> LLM` — used in docs, reviews,
  conversation. Capitalized product, space, capital-L tier number,
  uppercase LLM. Example: "Sakura L1 LLM".
- **Artifact (kebab):** `<product>-l<n>-llm` — used as Ollama tags,
  registry IDs, config keys, file references where a slug is needed.
  Lowercase. Example: `sakura-l1-llm`.

The forms denote the same thing. Pick whichever the surface needs.

### Per-product instantiations

| Product | Canonical names | Notes |
|---|---|---|
| **Curator** (uses Sakura) | Sakura L0 LLM, Sakura L1 LLM (reasoning + vision embedder), Sakura L2 LLM | L0 = on-device chat (desktop browser MLC-LLM/WebGPU; iOS Apple FM; Android MLC-LLM; Linux/dev Ollama + Qwen 2.5 3B + curator-3b LoRA). L1 = our trained hosted infra: **Loam + Atlas + Gemma reasoning** (text + vision; persona-LoRA'd, vanilla Gemma is the in-L1 fallback) plus the **vision embedder** = SigLIP-2 base (768-D vectors). L2 = vendor routing fallback (DeepSeek / Anthropic / Google Vision). See [[ai-tier-strategy.md]] for the full strategy. |
| **Lacuna** | Lacuna L0 LLM, Lacuna L1 LLM, Lacuna L2 LLM | **L0 = SRE orchestrator** (Qwen 2.5-3B trained on Linux stuff; on operator's Linux box / self-hosted Docker; MRCL routing through diagnostic chains; **this is what's running now**). **L1 = multi-agent dialectical** (multiple DeepSeek-class instances arguing; design deferred). **L2 = third-party SaaS wrapper** (label only). |
| **Meridian** (was Lacuna Monitoring, renamed 2026-07-09) | Meridian L1 LLM (oracle / AI-judge; no L0 yet, no L2) | Distinct from Lacuna's L0 SRE orchestrator — Meridian's L1 oracle is passive (reads LMTP traces from `lacunad` and emits digests + anomaly callouts) and runs on our hosted infra, not the operator's hardware. Repo: `~/code/meridian/`. |

`<Product>` is one of: **Curator** (the product) using **Sakura**
(its AI brand); **Lacuna** (the open-source AI product); **Meridian**
(the observability product, formerly Lacuna Monitoring).

## Why this form

Three reasons, each load-bearing:

1. **Tier-first.** `L<n>` carries the location/ownership semantics
   from `canonical-taxonomy.md`. Anyone reading the name knows
   immediately whether it runs on device, on our infra, or on a
   third party's.
2. **Product-scoped.** `<Product>` prefix prevents cross-product
   bleed. "Sakura L0" is unambiguously Curator's; "Lacuna L1" is
   unambiguously Lacuna's. No mixed surfaces.
3. **Suffix-stable.** The `LLM` suffix is the artifact type. ML
   surfaces and other AI artifact types take different suffixes
   (e.g., `Sakura ML attribution_tier`).

## What `<product>-l<n>-llm` names at each tier

The canonical name slots a *role*, not always a *us-trained
artifact*:

- **L0** (on operator's hardware) and **L1** (our hosted infra) —
  these are typically us-trained or us-packaged artifacts. The name
  identifies the model file / Ollama tag / cloud deployment.
- **L2** (third-party SaaS) — the canonical name is a
  **routing/configuration label** for "whatever third-party model
  is wired in". No us-trained artifact behind it. The label keeps
  cascade addressing consistent regardless of which provider serves
  the call.

Physical artifact names (Ollama tags, registry IDs) may differ from
the canonical name when there's a meaningful versioning or technical
prefix to preserve — e.g., `curator-3b` is the historical Ollama tag
for the L1 text-reasoner LoRA; under the new convention it would
ship as `sakura-l1-llm`. Both names refer to the same artifact;
the canonical-name form is what docs use, the historical form is
preserved where code references it.

## File-naming rules

When the canonical name appears in filenames, use lowercase with
hyphens and the tier embedded:

- `sakura-l1-vision-plan-v0.1.md` ✓ (was `sakura-llm-vision-plan-v0.1.md`)
- `sakura-allhands-prep-v0.1.md` ✓ (Sakura-only; tier-agnostic)
- `lacuna-3b-lora-training-v0.1.md` ✓ (training artifact, not LLM-tiered)

## Documents stay product-scoped

A single document covers one product. Cross-product strategy lives
here in `/research/`, not in any one product's `ai/`.

## Out of scope here

- Atlas / persona / corpus internal naming (Curator-internal).
- Cascade `LAYER_*` constants in `cascade.py` (legacy, kept; tests
  depend on them; only documentation around them uses canonical
  taxonomy).
