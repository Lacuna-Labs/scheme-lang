<p align="left">
  <img src="./docs/images/mark.svg" alt="Sakura" width="140">
</p>

# sakura-corpus

*Training data for Sakura — one repo, one canonical location, one policy.*

Every JSONL, ledger, and staging file Sakura trains on lives here. Nothing here is app code. Nothing here is a checkpoint (checkpoints live in `~/.forge/runs/`, out of git). This repo exists so training data has a home that survives any single project.

Canonical spec: [`lacuna-docs/engineering/THE-PLAN.md`](../lacuna-docs/engineering/THE-PLAN.md) Chapter 3 §3.5.

## What it is

The Sakura Scheme training corpus. Currently ~1.1 GB across ~16 JSONLs plus the fold-counts ledger and matrix. `train.jsonl` (193,937 lines) and `valid.jsonl` (27,278 lines) are the active training and validation splits Forge reads on every run. The rest are historical folds kept for reproducibility.

The corpus was extracted from `curator/corpus/` on 2026-07-09 per THE-PLAN Phase 1. This repo is currently a **mirror/backup** — Forge still reads from `~/.forge/corpus/sakura/`. A symlink swap is deferred to Phase 2.

## What it's for

- Use it when you want a durable, versioned home for training data that outlives any app tree.
- Use it when Forge, Caliper, or the eval harness needs to read corpus by path (`~/.forge/corpus/sakura/train.jsonl` is still the canonical read location for now).
- Use it when you're adding new pairs, running the 1001-card test on `held-out/FROZEN-1001/`, or bumping a fold.
- Do NOT use it as a runtime cache. Curator writes to `sakura-corpus/staging/`; Forge reads from `~/.forge/corpus/sakura/`; that's the seam.
- Do NOT check in checkpoints, adapters, or model weights. Those live in `~/.forge/runs/`.

## Quickstart

There's nothing to run. Read a slice of the active corpus:

```bash
head -n 5 train.jsonl
```

If you're wiring a new consumer, read by canonical path:

```bash
# Forge already does this; new consumers copy the pattern.
CORPUS_ROOT="${CORPUS_ROOT:-$HOME/.forge/corpus/sakura}"
head -n 5 "$CORPUS_ROOT/train.jsonl"
```

## How Forge consumes it (today)

Forge reads from `~/.forge/corpus/sakura/` — **not** from this repo. This repo is a **copy**, made 2026-07-09. Both trees hold identical bytes:

- `train.jsonl` — 193,937 lines, ~287 MB. Active training split.
- `valid.jsonl` — 27,278 lines, ~40 MB. Active validation split.
- `train.pre-corpus-chop-20260709-172547.jsonl` — the pre-chop fold snapshot.
- `train.pre-epoch-1-20260707-122837.jsonl` — pre-epoch-1 snapshot.
- `train.pre-mega-fold-20260707-015201.jsonl` — pre-mega-fold snapshot.
- `train.before-2026-07-06-full-fold.jsonl` — pre-full-fold snapshot.
- `train.before-2026-06-01-cart-fold.jsonl` — earliest snapshot.
- `valid.*.jsonl` — matching pre-fold snapshots.
- `fold-counts.json` — per-fold row counts.
- `matrix.yaml` — corpus branch matrix.

**Phase 2 will retire the source copy.** After the engine extraction gate, `~/.forge/corpus/sakura/` becomes a symlink into this repo (or a build step publishes here to that path). Until then, if you edit corpus, edit `~/.forge/corpus/sakura/` first and re-sync here.

## Directory tour

```text
sakura-corpus/
├── train.jsonl                   # active training split (LFS)
├── valid.jsonl                   # active validation split (LFS)
├── train.pre-*.jsonl             # historical folds (LFS)
├── valid.pre-*.jsonl             # historical folds (LFS)
├── fold-counts.json              # per-fold row counts
├── matrix.yaml                   # corpus branch matrix
├── .gitattributes                # LFS policy — all *.jsonl through LFS
├── CLAUDE.md                     # per-repo agent guidance
└── README.md                     # you are here
```

## Canonical docs

Company-wide standards live in [`~/code/lacuna-docs/`](../lacuna-docs/):

- [`engineering/THE-PLAN.md`](../lacuna-docs/engineering/THE-PLAN.md) — §3.5 spells out the extraction rules; §6.2 spells out the training-safety guardrails.
- [`scheme/`](../lacuna-docs/scheme/) — the language canon; corpus schema derives from the 16-book canon and the atom specs.
- [`canon/`](../lacuna-docs/canon/) — `corpus-goes-in-sakura-corpus.md` is the locking decision.

## Project docs

There is no in-repo `docs/` yet. Corpus specs — resident-scheme ledger, world-knowledge atom spec, book canon — currently live in `curator/docs/` and will migrate here in Phase 2.

## License and status

Proprietary — Lacuna internal. Status: **alpha — mirror**. Not yet the canonical read path; Forge still reads `~/.forge/corpus/sakura/`. Symlink swap deferred to Phase 2 per THE-PLAN §6.1.
