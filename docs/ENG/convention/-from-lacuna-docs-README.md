# canon/

**Locked decisions.** Things that shape everything else and don't get relitigated without a canon change.

## What's here

Each canon entry is a short doc (usually <500 words) stating:

1. **The decision** — one sentence.
2. **The date it was locked.**
3. **The reasoning** — enough that a future reader understands why.
4. **What it forbids** — the temptations this rules out.

Current canon (illustrative — see files for the full list):

- **`16-books.md`** — the Sakura book canon is exactly 16. Not 17. Reasoning family collapses inward.
- **`corner-flower-is-sakura.md`** — the pink header flower **is** the persona/LLM. The 16 canvas sprites are blossoms she directs.
- **`mac-studio-dev-only.md`** — Mac Studio is dev + training only. Never prod serving. Sanctioned exception: Sakura Media Factory.
- **`max-only-no-api-key.md`** — no Claude API key. Max subscription only. Cost policy consequence.
- **`sakura-epistemic-stance.md`** — she's an LLM that doesn't live in the real world → defers real-world consequential choices, verifies, evidential register.
- **`corpus-goes-in-sakura-corpus.md`** — training data lives in the `sakura-corpus/` repo, not per-project.
- **`CHANGELOG.md`** — one line per canon change, dated.

## Scope

**In:** decisions with cross-project reach that would break other docs if silently reversed.

**Out:** in-flight design tradeoffs (those are per-project). Per-repo conventions (those are `../engineering/`).

## Rule

Adding to canon takes discipline. **Removing from canon takes a `CHANGELOG.md` entry and a grep for every doc that referenced it.**
