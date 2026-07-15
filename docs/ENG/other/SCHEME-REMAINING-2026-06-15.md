# Scheme Corpus — What's Left to Write (2026-06-15)

Counts derived from `docs/CART-REVIEW-FINAL-2026-06-15.md` minus on-disk,
§2 audit miss, §4 param-collapse, §3 infra-gated.

**Headline: ~635 write-ready.** 1,101 on disk · ~2,250 honest-unique designed
· ~270 param-collapse · ~360 infra-gated.

## Per-tier breakdown

| Tier | Designed | On disk (2026-06-15 18:14 UTC) | Param-collapse saves | Infra-gated stage-later | **Write-ready remaining** |
|---|---:|---:|---:|---:|---:|
| **Free** (light-purple)   | ~720 | 348 pink + 17 scenes + ~145 etsy-free + 48 cron + 20 rules + 4 radio + 6 google + 3 personal + 3 transfer + 1 layout = **~595** | 80 | 38 (voice-corpus / Lane-E MLP / wake-word) | **~7** |
| **Imagine** $19.99 | ~640 | **250** | 70 | 22 (Veo budget / vision tier) | **~298** |
| **Dream** $59.99 | ~620 | **160** | 60 | 90 (Cat-I cron PII / write gates) | **~310** |
| **Magic** $99.99 | ~274 | 11 + ~86 etsy-Magic | 60 | 110 (L2 P1 / PII export / attorney) | **~7** |
| **§7a Cortex flagship + multistore** | **44** | 0 | 0 | 0 | **44** |
| **TOTAL** | **~2,298** | **~1,101** | **~270** | **~360** | **~635** |

Etsy's 231 are mixed across tiers; counted per-tier above.

## Dispatch-ready spec list

One source per writer dispatch.

**A. §7a Cortex flagship + multistore — 44 (all Free except 2) — DISPATCH FIRST.** Source: `CART-REVIEW-FINAL` §7a tables F1–F11 · M1–M14 · B1–B8 · K1–K5 · W1–W6. Owner-named P0. Build order in §10 rank 1–25.

**B. Dream — ~310.** PLUS-DREAM (100 post-trim) + COMBO-CARTS-A-H E-series (~70 post-§5 tier corrections) + 10-MORE-FAMILIES Dream slice (~140 post-§3 cuts).

**C. Imagine — ~298.** PLUS-IMAGINE (~100 post-merge) + CARDS-EMAIL-VEO §3a static-image replacements (~30) + 10-MORE-FAMILIES Imagine (~168). Veo-22 cut; write static-image siblings.

**D. Magic — ~7.** §9 P0 ships-today rows: P5, P8, E5, E14, E19, E22, MCMC M1. P33–P50 multi-day + P55–P64 legal STAGE behind L2 P1 `checkpoint.write/wake`.

**E. Free — ~7.** §3a Rule-A replacements: free-tap-to-voice-24, free-SMS-compose-12, free-morning-3-things-MLP-light, free-onboarding-cortex-seed-from-csv, free-batch-undo-window, free-app-permission-self-audit, free-sakura-explains-this-cart.

**Infra-gated stage-laters (DO NOT write yet).** F66–F74 (voice-ingest primitive missing) · Lane-E MLP (corpus untrained) · P11–P12 (PII ledger open) · P51–P54 (`computer.use` sandbox) · Veo-22 (budget absent) · F1-Voice 24 (wake-word) · F7-Live 14 (partner API) · F10 SMS 12 (TCPA) · P33–P50 (L2 P1). Each cart ships in the same PR as its unlock.
