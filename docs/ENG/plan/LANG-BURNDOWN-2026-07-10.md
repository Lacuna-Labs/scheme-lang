---
slug: lang-burndown-2026-07-10
title: Language burndown — Sakura Scheme through the unattended loop
category: engineering
canonical: true
authored: 2026-07-10
authors: [claude]
owner: alfred
complements: EPOCH-2-LANDING-SEQUENCE-2026-07-10.md
---

# Language burndown

Complements the Epoch 2 landing sequence. The Epoch 2 doc handles training-side landing (corpus rebuild + trainer restart). This doc handles the language itself — what's shipped, what's stale, what's missing, what to do next. Runs in the same unattended-loop pattern.

Cross-references:
- Extraction plan (Phase 2 of THE-PLAN): `~/.claude/plans/rippling-discovering-lobster.md`
- Tutorial + Games audit: `~/code/lacuna-labs/research/lacuna-docs/engineering/tutorial-audit-and-games-book-plan-2026-07-10.md`
- Composition doctrine review: `~/code/lacuna-labs/research/lacuna-docs/engineering/composition-doctrine-review-2026-07-10.md`
- Card-insides census: `~/code/lacuna-labs/research/lacuna-docs/engineering/card-insides-census-2026-07-10.md`
- Book of Games preservation memory: `~/.claude/projects/-Users-alfred-code/memory/project_book_of_games_preserve_2026_07_10.md`

## Status snapshot (2026-07-10 evening)

**Language extraction — COMPLETE.**
- `~/code/sakura-scheme/` fully populated. 12 core modules shipped. `bin/sakura-scheme` executable + `package.json@1.4.0` with `exports` map. Tests for reader/interp/introspect/repl/slat/artifact-verbs. Docs shipped: REFERENCE, ENGINEERING, STYLE-GUIDE, TUTORIAL.html, SAKURA-SCHEME-BOOK, SEALING, three appendix rows.
- Consumer rewiring (curator): steps a/d/e/f done per reflog. Branch `curator/dead-emit-cleanup` at `a06e88cbb` (T-16). Push blocked by 28 pre-existing curator-api pytest failures.

**Books — uneven.**
- 15 canon books at ch 00-05 on main (6/16 each). Ch 06-10 in Q9 PRs #40-50 (unmerged).
- Book of Self ch 11-15 in PR #53 (unmerged). Once #46 + #53 merge = 16/16.
- Hello-surface at ch 00-10 (11/16).
- Curator SCHEME GUIDE (`~/code/curator/curator-web/src/scheme/GUIDE/`) — 15 chapters (01-15), never migrated to sakura-scheme. Contains 12-pixel-games (book of games — PRESERVE task #25).
- Book of Games canonical (`docs/book/games/`) — does not exist.

**Documentation lies shipped** (from tutorial audit):
- CHANGELOG says ~80 primitives; real count in `base.js` is **119**.
- Book Chapter 14 documents `sakura/complete` + `sakura/rewrite` + `sakura/explain` — none exist in `base.js`.
- `rng-uniform` documented but `Math.random`-backed at Scheme scope; not seedable.
- Tutorial §14 FRP `time/*` + `memory/*` + ASK verbs — described as live, don't exist in `base.js`.
- 8 `artifact/*` headless-stub verbs shipped in v1.4 — undocumented in Tutorial and Book.

**TUTORIAL.html — wrong content.** It's a Curator/carts tutorial (sled, cortex/model/etsy verbs, sprite dispatcher, card gaits) inherited from the 2026-07-09 extraction, never retargeted. Never introduces `define`, `lambda`, `cond`, `let`, `map`, `syntax-rules`, or the REPL. Someone landing on the docs site sees Curator internals instead of a language intro.

---

## Phases

### Phase L1 — Documentation reconciliation (auto-authorized; safe reads + doc PRs)

| ID | Item | Cycles | Trigger |
|---|---|---|---|
| **L1-01** | Audit + fix CHANGELOG primitive count (says ~80, real is 119) | S | auto |
| **L1-02** | Register the 8 artifact headless-stub verbs in `docs/artifact-verbs.md` (they ship, just aren't documented) | S | auto |
| **L1-03** | Add `NOT YET SHIPPED` banner to Book Ch 14 sakura/* verbs | S | auto |
| **L1-04** | Add `NOT YET SHIPPED` banner to Tutorial §14 FRP time/memory/ASK verbs | S | auto |
| **L1-05** | Fix `rng-uniform` docs to explicitly note "seeded by process-time, not user-seedable" | S | auto |
| **L1-06** | Cross-reference audit: for every primitive in `base.js`, verify it appears in REFERENCE.md; report gaps | M | auto |

### Phase L2 — TUTORIAL.html + GUIDE migration (needs Alfred go; big)

| ID | Item | Cycles | Trigger |
|---|---|---|---|
| **L2-01** | Rewrite `docs/TUTORIAL.html` as a language tutorial (not Curator/carts). ~14h lane. Grounded in Book chapters 01-14. | L | Alfred go |
| **L2-02** | Audit each of the 15 curator SCHEME GUIDE chapters. Classify as: fold-into-existing-book / promote-to-16th-canon-book / drop. Report to Alfred. | M | auto (research only; no writes) |
| **L2-03** | Execute the ratified migration from L2-02 | L | Alfred go |

### Phase L3 — Book completion (needs Alfred go; huge)

| ID | Item | Cycles | Trigger |
|---|---|---|---|
| **L3-01** | Ch 11-15 for 14 canon books (music, motion, instruments, marionette, systems, money, one-shot, donts, reference, miscellany, reason-i, reason-ii, reason-iii, reason-iv). 5 × 14 = 70 chapters at ~1000 programs each. | XL | Alfred go |
| **L3-02** | Ch 11-15 for hello-surface | L | Alfred go |
| **L3-03** | Book of Games — 16 chapters + ~1000 programs. Depends on L4-02 (engine primitives). Migrates 12-pixel-games.md content in as chapter 12 baseline. | XL | Alfred go (blocks on L4-02) |
| **L3-04** | Migrate curator `src/games/` (ChatGames.jsx, tic-tac-toe tests) into sakura-scheme where appropriate. Preserve, don't delete. | M | Alfred go |

### Phase L4 — Primitive + feature shipments (needs Alfred go; code)

| ID | Item | Cycles | Trigger | Notes |
|---|---|---|---|---|
| **L4-01** | Seedable RNG primitive (`rng-seeded`, `rng-next`, `rng-state`) | S | Alfred go | Games dependency; also improves reproducibility for training and testing |
| **L4-02** | Game engine primitive family: `game/loop`, `game/input`, `game/state-snapshot`, `game/tick`, `game/verdict`, plus deterministic time source | M | Alfred go | Enables L3-03 (Book of Games) |
| **L4-03** | Ship `sakura/complete` + `sakura/rewrite` + `sakura/explain` OR add NOT YET SHIPPED banner in Book Ch 14 (L1-03) | M / S | Alfred go | Choose ship-now or defer |
| **L4-04** | FRP roster — `time/*`, `memory/*`, ASK verbs — ship or remove from Tutorial §14 (L1-04) | L / S | Alfred go | Choose ship-now or defer |
| **L4-05** | Sakura Scheme runtime features 2-6 from Q3 plan: `match` (native pattern-match), `delay/force/await`, `guard/error`, `module/import`, `sakura/complete` | XL | Alfred go | Roadmap follow-on |

### Phase L5 — Consumer rewiring completion (needs Alfred go)

| ID | Item | Cycles | Trigger |
|---|---|---|---|
| **L5-01** | Curator T-16 dead-emit push. Currently local commit `a06e88cbb` on `curator/dead-emit-cleanup`; 28 pre-existing curator-api pytest failures block the push hook. | S | Alfred go |
| **L5-02** | Final curator consume-sakura-scheme audit — verify no `import from '../scheme/{reader,interp,base,macro}'` calls remain; every consumer imports from the package | S | auto (research) |

### Phase L6 — Corpus alignment (couples with Epoch 2)

| ID | Item | Cycles | Trigger |
|---|---|---|---|
| **L6-01** | Verify the Epoch 2 corpus rebuild picks up the current `docs/book/` tree (all ch 00-05 chapters + tonight's PRs once merged + hello-surface ch 00-10) | S | Epoch 2 Phase 5 |
| **L6-02** | Verify RAG chunk index picks up REFERENCE.md content (77 chunks → grows once L1 doc reconciliation lands) | S | Epoch 2 Phase 5 |
| **L6-03** | Add `corpus-branch: language-docs` tagging to any lang-doc atoms so class-5 val-drift monitor sees them separately | S | Epoch 2 Phase 5 |

---

## Sequencing

**Now (auto-authorized, safe):**
- L1-01…L1-05 — the 5 doc-lie fixes as one PR
- L1-06 — primitive coverage audit
- L2-02 — GUIDE chapter classification
- L5-02 — final consume-sakura-scheme audit

Estimated: 2-3 doc-only PRs in ~2-3 hours.

**Blocks on Alfred go-signal:**
- L2-01 (TUTORIAL rewrite, 14h)
- L2-03 (GUIDE migration execution)
- L3-01…L3-04 (book completion + games migration)
- L4-01…L4-05 (new primitives + features)
- L5-01 (curator T-16 push)

**Couples with Epoch 2:**
- L6-01…L6-03 fires when Alfred authorizes Phase 5 corpus rebuild

## Loop guardrail additions

Auto-authorized language lanes may:
- Read any file in `~/code/sakura-scheme/`
- Author doc PRs against `docs/*.md` (`REFERENCE.md`, `ENGINEERING.md`, `docs/artifact-verbs.md`, etc.)
- Author survey reports under `~/code/lacuna-labs/research/lacuna-docs/engineering/`
- Grep across curator/forge for consumer verification

Auto-authorized language lanes may NOT:
- Ship new primitives or verbs in `src/`
- Modify `bin/sakura-scheme` behavior
- Author book chapters (needs Alfred ratification of scope + budget)
- Push to curator repo (owner-only)
- Touch `~/.forge/`
- Delete anything

## Cross-references

- Language docs: `~/code/sakura-scheme/docs/`
- Language src: `~/code/sakura-scheme/src/`
- Book tree: `~/code/sakura-scheme/docs/book/`
- Reference: `~/code/sakura-scheme/docs/REFERENCE.md`
- Curator GUIDE (unmigrated): `~/code/curator/curator-web/src/scheme/GUIDE/`
- Book of Games preservation: task #25 + memory slug
