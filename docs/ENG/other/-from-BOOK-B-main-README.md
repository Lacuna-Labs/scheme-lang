# Engineering-manual spine records

BIG BURNDOWN Lane 9. These are **selective** engineering-doc SLAT records —
the teachable spine of each engineering doc, not the whole doc.

Per BIG-BURNDOWN-PLAN-2026-07-12 §1.2:

> **Rule of thumb across all selective engineering:** enough that she can talk
> with an engineer or user about the SHAPE of a system. Not enough to be a
> source-code oracle. Depth reaches for sidecar.

## The five domains

| Domain | % of full doc | Records |
|---|---|---|
| SLAT engineering | ~15% | `spine-slat-*.slat` |
| Hello Surface engineering | ~20% | `spine-hello-surface-*.slat` |
| Scheme engine engineering | ~25% | `spine-scheme-engine-*.slat` |
| Security engineering | ~15% | `spine-security-*.slat` |
| Training procedure meta | ~10% | `spine-training-*.slat` |

## Record shape

Each `spine` record carries:

- `:domain` — one of the five
- `:topic` — kebab-case topic
- `:body` — the teachable prose (short — spine, not tree)
- `:section-hash` — sha256 of the source-doc section (provenance)
- `:source` — repo-relative path to the source
- `:philosopher-lens` — lens tags where applicable
- `:teach-shape` — what shape she should learn from this

## What she gets vs what she doesn't

**Sees (spine):**
- SLAT format grammar (why it's parenthesized, why records are records)
- Why Merkle roots matter (integrity + audit chain)
- Composition types (that they exist, what the twelve are)
- Signing pattern (one clean walkthrough)
- Card / cart / artifact concept (what each is at a level)
- Verb registration pattern (metadata + body)
- Fuel budget concept (why we bound execution)
- Five-gate dispatcher concept (what tiers exist)
- Three harm cases (verbatim from doctrine)
- When to STOP operating (and how to resume)
- WEAVE 2.0 lens philosophy at high level
- Four-faucets model (Weights / Sidecar / Atlas / Tools)

**Doesn't get (reaches for sidecar):**
- On-disk byte-layout minutiae
- Migration internals + versioning arbitration edge cases
- Full dispatch tree walk
- Runtime module map
- Exploit specifics or attack payloads
- Key management particulars
- Mixing coefficients
- Specific evaluation gates
- Current run recipe
- Learning-rate ablations

## Source anchors

- SLAT engineering — `~/code/curator/scheme-lang/docs/ENGINEERING.md`
  (SLAT section) + Book of SLAT chapters
- Hello Surface engineering — `~/code/curator/docs/HELLO-SURFACE-1.0-ENGINEERING.md`
- Scheme engine engineering — `~/code/curator/scheme-lang/docs/ENGINEERING.md`
- Security engineering — Book of Don'ts + public-meaning doctrine memory
- Training procedure meta — `~/code/lacuna-labs/research/lacuna-docs/engineering/WEAVE-TRAINING-1.0.ENG.md`
  + `project_full_training_procedure_handoff_2026_07_12` memory

## Provenance discipline

Every `spine` record MUST carry a `:section-hash` — the sha256 of the source
section it was extracted from. When the source doc updates, the section-hash
mismatch surfaces the drift; the record gets re-authored or reconciled.

## Related

- BIG-BURNDOWN-PLAN-2026-07-12 §1.2 — selectivity rules
- Book of SLAT ch 5 — record types
- `project_full_training_procedure_handoff_2026_07_12` — training meta
