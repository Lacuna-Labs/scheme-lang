---
slug: held-out-policy
title: Held-out policy
category: spec
kind: policy
version: 1.0.0
canonical: true
owner: sakura-corpus
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 3 §3.5
---

# Held-out policy

## Purpose

The rule that keeps FROZEN-1001 and its siblings out of training forever. Held-out contamination is a real failure mode; this spec is the discipline that prevents it.

## Scope

**In:** the `.forge-exclude` marker convention; pre-commit rejection rules; validator contamination check.

**Out:** the 1001-card generation policy (that's Curator's authoring toolchain); the eval harness (that's Caliper).

## Definitions

- **Held-out** — a corpus subset that MUST NOT enter training under any circumstances.
- **FROZEN-1001** — the canonical held-out set of ~1001 broken carts used for the "make the language yield" eval.
- **`.forge-exclude` marker** — a file in a directory that tells the Forge data loader to skip everything under that directory.

## Normative content

### The `.forge-exclude` marker

Any directory containing a `.forge-exclude` file MUST be skipped by:

1. Forge's data loader.
2. The corpus validator (except for cross-checking against training data).
3. Any authoring tool that produces training pairs.

Marker file body is empty or contains a short human-readable note. Presence is what matters.

### Directory layout

```
sakura-corpus/
  held-out/
    FROZEN-1001/
      .forge-exclude          # never train on this
      README.md               # policy statement
      cards/                  # the ~1001 broken carts
```

### Pre-commit rule

A pre-commit hook in `sakura-corpus/` MUST refuse any commit that:

1. Touches a file under `held-out/` AND
2. Touches a file under a training path (anything not under `held-out/`)

in the same commit. The two changes MUST be separate commits with separate reviewers.

### Validator contamination check

The corpus validator, when given `--held-out DIR`, walks `DIR` and computes the SHA-256 of every `(user, assistant)` pair. Then it walks the training corpus and flags any pair whose hash matches a held-out record.

Held-out contamination is a **fire**, never a warn.

### Access from Forge

Forge reads corpus by path (`~/.forge/corpus/sakura/train.jsonl`). The held-out set has its own path (`~/.forge/corpus/sakura/held-out/`) and Forge's data loader hardcodes a refusal to load from any path under `held-out/`.

## Non-normative examples

See [`../../lacuna-docs/engineering/THE-PLAN.md`](../../lacuna-docs/engineering/THE-PLAN.md) §3.5 for narrative on the 1001-card test and why held-out purity matters.

## Compatibility and versioning

- **Additive:** new held-out sets under `held-out/`.
- **Breaking:** changing the marker filename, removing the pre-commit rule.

## See also

- [`./corpus-schema.md`](./corpus-schema.md) — pair record shape.
- [`./family-taxonomy.md`](./family-taxonomy.md) — family types.
- [`../../caliper/specs/eval-harness.md`](../../caliper/specs/eval-harness.md) — the harness that uses FROZEN-1001.
