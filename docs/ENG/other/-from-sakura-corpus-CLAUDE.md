# sakura-corpus — Agent Rules

Training data lives here. This repo is currently a **mirror** of `~/.forge/corpus/sakura/`. Forge reads the canonical path, not this repo. Do not confuse the two.

## Rules

- **Never write to `~/.forge/runs/`** from this repo. Runs are the trainer's business.
- **Never commit anything > 5 MB** without LFS. `.gitattributes` handles the common cases; new file types need an LFS line before you `git add`.
- **The `held-out/FROZEN-1001/` set is off-limits to training** (once it's added). A pre-commit hook rejects any PR that touches both held-out and training splits in the same commit.
- **Corpus edits still land in `~/.forge/corpus/sakura/` first** until Phase 2. Then re-sync here.

## What you can do

- Read the corpus.
- Add a new JSONL branch (with an LFS entry in `.gitattributes` if needed).
- Update `fold-counts.json` and `matrix.yaml`.
- Improve README/CLAUDE.md.

## What you must not do

- **Do not delete history.** Old folds are load-bearing for reproducibility.
- **Do not force-push.** Rewriting history destroys LFS pointers.
- **Do not silently move the canonical path.** THE-PLAN §3.5 spells out the seam; changing it is a canon change.

## Canonical spec

The extraction rules and training-safety guardrails live in [`lacuna-docs/engineering/THE-PLAN.md`](../lacuna-docs/engineering/THE-PLAN.md) §3.5 and §6.2.
