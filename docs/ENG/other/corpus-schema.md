---
slug: corpus-schema
title: Corpus schema
category: spec
kind: schema
version: 1.0.0
canonical: true
owner: sakura-corpus
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-BIG-FORGE-PLAN.md · Part IV
---

# Corpus schema

## Purpose

The wire and on-disk shape of Sakura's training corpus — both the JSONL as it stands today and the slat (Lacuna Scheme cart) form v2.

## Scope

**In:** JSONL record shape; slat record shape; the minimal reader; the round-trip converter contract; the validator's normative checks.

**Out:** how the corpus is generated (that's Curator's authoring toolchain); how the corpus is consumed (that's Forge's data loader).

## Definitions

- **Pair** — one training record. Contains a `messages` array.
- **Family** — the corpus family a pair belongs to. See [`./family-taxonomy.md`](./family-taxonomy.md).
- **System prompt registry** — the map from `:sakura-default-v3` (and siblings) to the actual prompt text. Lives at `~/.forge/corpus/sakura/system-prompts.scm`.
- **Canonical file** — `~/.forge/corpus/sakura/train.jsonl`. This path is stable; the file may be a symlink into `~/code/sakura-corpus/`.

## Normative content

### JSONL form (as it stands)

One JSON per line. Each line:

```json
{"messages": [
  {"role": "system", "content": "You are Sakura. ..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]}
```

Roles seen: `system`, `user`, `assistant`. `tool` is additive when it appears.

### Slat form (v2)

Same information, richer typing:

```
(pair
  :id "sk-cart-40012"
  :family "scheme-cart"
  :provenance "curator/carts/risk-flow-guarantee-reconcile.scm"
  :system-prompt-ref :sakura-default-v3
  :messages
    ((:user "risk risk flow guarantee reconcile")
     (:assistant "risk-risk-flow-guarantee-reconcile")))
```

Slat carries provenance, family, and a system-prompt reference (saves ~30% of corpus bytes vs inlining the system prompt).

### Minimal reader

Slat's core reader (~500 lines) lives at [`~/code/forge/forge/corpus/slat_reader.py`](../../forge/forge/corpus/slat_reader.py) — implementation of [`../../lacuna-docs/specs/slat-format.md`](../../lacuna-docs/specs/slat-format.md).

### Round-trip converter

Two directions, round-trip guaranteed.

- `jsonl_to_slat(stream)` — parse each JSON line, emit slat.
- `slat_to_jsonl(stream)` — parse each slat line, emit JSON.

`round_trip_verify(stream)` returns `(True, [])` when all lines round-trip cleanly. Test coverage: `~/code/forge/tests/test_slat.py` (82 tests).

### Validator

Runs against either format. Checks:

1. **Schema** — every record has messages; roles ∈ `{system, user, assistant, tool}`; alternating pattern OK (system optional, then user/assistant pairs).
2. **Tokenization estimate** — chars × 3.5 heuristic; flag records > 2000 tokens (the C6 landmine).
3. **Length distribution** — histogram all records; report p50, p95, p99, max; compare against baseline (previous run's histogram); flag >5% drift.
4. **Family distribution** — count by tag; compare to Weave-stage target distribution.
5. **Duplicate detection** — SHA-256 the `(user, assistant)` pair; flag duplicates.
6. **Held-out contamination** — if `--held-out DIR` given, flag any train record with a hash matching a held-out record.

Output: `validation-report.jsonl` in the run dir, one record per finding. Summary card in Forge's Corpus tab.

## Non-normative examples

See [`../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md`](../../lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md) Part IV for JSONL/slat rationale and validator design notes.

## Compatibility and versioning

- **Additive:** new optional keywords in slat (e.g. `:context`), new roles (e.g. `tool`).
- **Breaking:** changing the messages array shape, renaming required fields.

## See also

- [`./family-taxonomy.md`](./family-taxonomy.md) — family types.
- [`./held-out-policy.md`](./held-out-policy.md) — the FROZEN-1001 rule.
- [`../../lacuna-docs/specs/slat-format.md`](../../lacuna-docs/specs/slat-format.md) — slat itself.
