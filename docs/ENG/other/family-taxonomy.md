---
slug: family-taxonomy
title: Corpus family taxonomy
category: spec
kind: schema
version: 1.0.0
canonical: true
owner: sakura-corpus
status: draft
last-reviewed: 2026-07-09
---

# Corpus family taxonomy

## Purpose

The set of family tags a training pair may carry, and what each family means for authoring, validation, and Weave-stage rebalancing.

## Scope

**In:** every family tag we currently produce or accept; the authoring rules (worker class + rate) that produce them; the validator's family-distribution check.

**Out:** individual atom bodies (that's Curator's `atoms/` tree); specific book prose (that's each book's directory).

## Definitions

- **Family** — a coarse-grained tag assigned per pair. Used for target-distribution planning and validator drift detection.
- **Weave stage** — the current training stage. Each stage has a target family mix.
- **Rehearsal** — a pair that is a perturbation of another pair.

## Normative content

### The family tags

| Tag | Meaning | Typical author |
|---|---|---|
| `scheme-cart` | New Scheme carts from a topic seed. | `corpus-author.scheme-cart` |
| `persona` | Persona voice pairs from a scenario. | `corpus-author.persona` |
| `book-prose` | Book-chapter fenced code extraction. | `corpus-author.book-prose` |
| `atom-yaml` | World-knowledge atom explanations. | `corpus-author.atom-yaml` |
| `rehearsal` | Perturbation of an existing pair. | `corpus-author.rehearsal` |
| `atom-pass` | Atom-pass training samples. | curator atom passes tooling |
| `verb-help` | Verb-help pairs. | curator verb-help tooling |
| `curator-jsonl` | Curator's mixed authoring outputs. | curator authoring tools |
| `forge-synthesis` | Forge's synthesis pipeline. | Forge |
| `variety` / `rehearsal-tail` | Variety + rehearsal tail. | Forge (seeded ML generator) |
| `unknown` | Unclassified. Validator flags this. | — |

### Authoring rates

See [`../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md`](../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md) Part IV §IV.6 for per-class rate targets (10/hr scheme-cart, 100/hr persona, 500/hr book-prose, 200/hr atom-yaml, 1000/hr rehearsal).

### Validator family-distribution check

The corpus validator counts pairs by family, computes percentages, and compares to the current Weave-stage target distribution. Deviation > 5% raises a warning; > 15% fires an alert.

### Weave-stage target mixes

Each Weave stage (Stage-0 / Saturate / Rebalance / Diversify / Anneal) has a documented target mix. Those targets live in the training plan doc, not here — this spec locks the tag set, not the ratio choice.

## Compatibility and versioning

- **Additive:** new family tags.
- **Breaking:** removing or renaming an existing tag.

## See also

- [`./corpus-schema.md`](./corpus-schema.md) — pair record shape.
- [`./held-out-policy.md`](./held-out-policy.md) — the held-out policy.
- [`../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md`](../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md) Part IV.
