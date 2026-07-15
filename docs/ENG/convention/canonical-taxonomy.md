---
slug: canonical-taxonomy
title: Canonical L-tier taxonomy
category: canon
canonical-candidate: false
promoted-from: research/
promoted-on: 2026-07-09
status: promoted
---

# Canonical L-tier taxonomy

**Status:** canonical as of 2026-04-30. Architecture-corrected
2026-05-01-AM (per-product role at each tier). Lacuna L0 confirmed
2026-05-01-PM as the existing Qwen 2.5-3B trained on Linux stuff
(not reserved — already designed and in use). Both products run
the same depth: L0 / L1 / L2 / Echo.

Every product's AI pipeline uses the same tier *labels* and the
same *location/ownership semantics*. **Role at each tier is
per-product** — Sakura L0 is a chat surface; Lacuna L0 is an SRE
orchestrator. Same tier label, different jobs.

## The tier semantics (location/ownership)

| Tier | Where | Who owns |
|---|---|---|
| **L0** | On the operator's hardware (phone, browser, their Linux box / dev server) | Us — packaged for local execution |
| **L1** | Off device — our hosted infra | Us — research + production surfaces |
| **L2** | Off device — third party | External — we may pay; they may be better |
| **Echo** | Final fallback | Nobody — graceful failure |

## Per-product examples

| Product | L0 | L1 | L2 |
|---|---|---|---|
| **Sakura** (Curator's AI) | Chat surface, packaged per host. **Desktop browser:** MLC-LLM with WebGPU. **iOS:** Apple Foundation Models bridge. **Android:** MLC-LLM Android. **Linux / dev:** Ollama with Qwen 2.5 3B + curator-3b LoRA. Same persona, packaged differently per host. | Our trained hosted infra — **Loam + Atlas + Gemma reasoning** (text + vision, persona-LoRA'd; vanilla Gemma is the in-L1 fallback when the LoRA isn't loaded). Distinct same-tier surface: **vision embedder** = SigLIP-2 base (`siglip2-base-patch16-224`, off-device) producing 768-D vectors, not language. See [[ai-tier-strategy.md]]. | Vendor routing fallback: DeepSeek / Anthropic / Google Vision when L1 isn't enough. |
| **Lacuna** | **SRE orchestrator** — Qwen 2.5-3B running locally on the operator's Linux box, trained on Linux/SRE diagnostic material (the orchestration corpus, system-call traces, postmortem narratives). MRCL routing through diagnostic chains. Source-of-truth narrative: `~/Downloads/lacuna_qwen_orchestration.md`. **This is what's running now.** | **Multi-agent dialectical reasoning** — multiple DeepSeek-class instances arguing about a claim, scored + aggregated. **Design deferred.** | Third-party SaaS routing label (paid DeepSeek-class fallback). |
| **Meridian** (was Lacuna Monitoring, renamed 2026-07-09; repo: `~/code/meridian/`) | n/a (the daemon runs everywhere as deterministic infra; no per-device LLM) | Oracle / AI-judge — passive observation of LMTP traces; emits digests + anomaly callouts. **Q3+ deliverable.** | n/a |

L1 may have multiple **surfaces** (variants serving different
tasks). Each is a surface of its product's tier.

## L0 = packaging differs by host platform

For products where L0 has end-user surfaces (Sakura), one persona
ships to multiple destinations. Same training, same persona prompt;
release engineering packages per host:

- **Desktop browser:** MLC-LLM with WebGPU (downloaded on opt-in,
  cached in OPFS — see the desktop-LLM download affordance in
  Settings → Pipeline)
- **iOS native:** Apple Foundation Models bridge (the iOS app
  embeds it at build time)
- **Android native:** MLC-LLM Android (packaged with the app)
- **Linux / developer host:** Ollama with Qwen 2.5 3B + curator-3b
  LoRA — the local default for self-hosted operators

Mobile and tablet operators get L0 natively at install time;
desktop browser operators download it once (browsers don't pre-
install models). Same experience, different package.

For Lacuna L0, the model (Qwen 2.5-3B trained on Linux stuff) is
packaged for the operator's local environment — their Linux box
directly, a self-hosted Docker container, or a small managed Fly
instance they run themselves. Same model file, different
deployment targets.

## Production vs. development

The taxonomy describes **production** reality. In dev, one Mac
Mini may run a single Ollama with multiple tags collapsing several
tiers. That's operations and lives in the operations ledger, not in
product documentation.

## Out of scope here

- Per-product pipeline diagrams (they live in `ai-tier-strategy.md`).
- Per-product implementation (in each product's `ai/`).
- Persona graph behavior (Phase 2 — see
  `persona-graph-strategy.md`).
