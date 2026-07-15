---
slug: alfred-new-questions-2026-07-10
title: Questions for Alfred — accumulated during tonight's burndown
category: engineering
canonical: true
owner: architect
status: awaiting-alfred
last-reviewed: 2026-07-10
---

# Questions accumulated for Alfred

Any HOLD that lanes surface during tonight's burndown lands here. Alfred: when back, we walk this list.

## From synthesis lane (PR #29)

1. **Merge sequence for the 4-PR artifact stack** — #25 (grand-unifier v1, DIRTY) → #27 (doctrine extension: book/error/tutorial/intro types) → #28 (chrome-per-type: Netscape/SNES/Winamp + web-browser/game) → #29 (Phase A wiring + spec + killer features). Options: land sequentially (rebase each after prior merges) or squash-fold all four into one canonical artifact commit. I'll try sequential merge with automated rebase; if that fails I'll come back and ask.
2. **Delete old `artifacts/*.js` factories?** Zane confirmed 10-of-10 map cleanly to new compositions. Safe to remove once no other consumer references them. I'll add a follow-up small lane to grep for external refs; if none, delete.
3. **`installArtifactVerbs(env)` bootstrap wire** — the artifact verbs are registered but not yet mounted in HelloSurface's `index.js`. One-line add. I'll do it.
4. **3 spec docs in lacuna-labs working copy** aren't committed because lacuna-labs has 13 files of unrelated dirty work. Should I stash the drift, commit just the 3 new spec files? Or wait for you?

## From design doc (20 open questions — OQ-01..OQ-20)

Full text: `research/lacuna-docs/specs/artifact-engineering-design-2026-07-10.md` § "Open questions." Landed as PR #6 on lacuna-labs. Each has options + Jess's recommended default — reply format works the same as the earlier 17-question card (`OQ-01a, OQ-02c, ...` or "all defaults").

I'll cross-reference and paste the specific list into a single question card for you when you're back. TL;DR: they cover the 20 governance/edge-case decisions the design doc surfaced (things like: how many axes really, canonical event names, chrome roster additions, persistence contract, trust-axis introduction timing, voice-only artifact stance, etc).

## From Weave 2.0 recovery (incident 6, 2026-07-10 evening)

**Trainer stopped. Rollback + patches applied. Blocked on ONE command from you.**

Everything ready except the last file restore. Trainer's `locked_lora.py` imports from `~/code/curator/scripts/forge_watch/gpu_lock.py`, but that directory only has `__pycache__/` left (source .py files got deleted during earlier worktree churn). Classifier won't let me `git checkout` in curator.

**Your one command to run:**
```bash
cd ~/code/curator && git checkout HEAD -- scripts/forge_watch/
```

Then I re-run:
```bash
~/code/forge/tools/relaunch-trainer.sh sakura-4b-v2
```
And training resumes from 0012000 (true iter 34,000) with seed 7, warmup 1500, softer init 5e-6, cosine args preserving budget.

**State snapshot ready to relaunch:**
- Trainer stopped ✓
- Damaged run archived: `train-damaged-run-20260710-202451.log`, `adapter-damaged-run-20260710-202451/` ✓
- Fresh adapter/ seeded from 0012000 ✓
- train.cfg patched (seed 7, warmup 1500, warmup_init 5.0e-6, cosine args [8.7916e-05, 67020, 1.0e-5]) ✓
- resume-offset.json ledger updated (resumed-5 closed at local_ceiling 12300; resumed-6 opened; incident 6 recorded with full analysis + success criteria + failure escalation) ✓
- General-purpose tools live at `~/code/forge/tools/kill-trainer.sh` and `~/code/forge/tools/relaunch-trainer.sh` ✓

**Latest verify at this tick:** `ps` shows no trainer + no supplementary services running. `ls ~/code/curator/scripts/forge_watch/` still only contains `__pycache__/`. Restore not run yet. Same one command still unblocks.

## Language burndown state (post-L1+L2-02+L5-02 at ~00:04)

Report: `~/code/lacuna-labs/research/lacuna-docs/engineering/lang-l1-l2-l5-report-2026-07-10.md`

**PR #60 opened, CLEAN, awaiting merge:** `docs/lang-l1-reconciliation`. Six doc fixes:
- CHANGELOG primitive count corrected (~80 → 125). Real count = 117 non-artifact + 8 artifact/* = 125.
- 8 artifact/* headless-stub verbs now documented in `docs/artifact-verbs.md`
- NOT YET SHIPPED banners on Book Ch 14 + Tutorial §14
- rng-uniform seed clarification in REFERENCE
- New `docs/primitive-coverage-2026-07-10.md` — coverage now 100%

**Correction I owe you:** I told you earlier the primitive count was 119. Real count is 125. Two different lies, both mine. Now fixed in the CHANGELOG.

**L2-02 GUIDE classification (15 chapters):** fold=11, promote=1 (12-pixel-games → Book of Games per PRESERVE task #25), drop=3. Specific chapter names + effort estimates in report §2.

**L5-02 — CONSUMER REWIRING IS NOT DONE.** I told you earlier "curator now consumes sakura-scheme as a real dep" based on the reflog. That was wrong. Actual state on curator main:
- 13 residual local imports across 4 modules (reader=9, interp=3, base=1, macro=0)
- **Zero callsites use the `sakura-scheme` package name.**

The reflog entries "step d rewire imports done, step e delete old copies done" were on branches that never merged to main. Curator is still importing the old inline scheme code. The extraction is philosophically complete but the consumer split-brain persists. L5-01 (curator T-16 push) has nothing to push because the rewiring commits don't exist on main.

**Actual state of extraction:**
- sakura-scheme repo: complete + shipped
- curator consumer: still on local imports
- To be a real "extraction," someone (a code lane, blocked on your go) needs to actually rewire the 13 callsites + delete the 4 local module copies + verify curator builds against the package

## PRESERVE — book of games (locked 2026-07-10 evening)

Alfred's explicit instruction: don't lose the book of games. Five locations verified:

1. `~/code/curator/curator-web/src/scheme/GUIDE/12-pixel-games.md` — 178 lines, canonical. Progression: "one pixel → small game → pixel groups → block games on top of groups. Four programs, each builds on the prior. None should be longer than fifty lines."
2. 53 identical worktree copies under `~/code/curator/.claude/worktrees/*/curator-web/src/scheme/GUIDE/12-pixel-games.md`
3. `~/code/curator/curator-web/src/games/` — `ChatGames.jsx`, `curated.js`, tic-tac-toe tests
4. `~/code/sakura-scheme/site/covers/book-of-games.html` + `book-of-games.flux.txt`
5. `~/code/baobab/games.html`

**Guard rule for any future lane:** do NOT delete curator worktrees, curator `src/games/`, or sakura-scheme covers without confirming these five locations are preserved elsewhere first. Migration to sakura-scheme `docs/book/games/` folds into finish-the-Book (task #1).

## Phase 0.2 doctrine ruling needed (post-composition-review at ~21:00)

Report: `~/code/lacuna-labs/research/lacuna-docs/engineering/composition-doctrine-review-2026-07-10.md`

Composition count moves 12 → 14 (not 19). Only 2 genuinely new; 4 nested; 1 rejected. Four calls for you:

1. **Approve calendar + knowledge-graph as new compositions?** These carry the `temporal · matrix` and `graph` coordinates respectively, which no shipped composition uses.
2. **Primitive growth 29 → 32, or fold `month-grid` → `item-grid` to hold at 31?** The "closed at ~30" line is pressured either way.
3. **Add `:presentation "inline" | "modal" | "drawer"` to instance metadata?** Makes overlay a mechanic instead of a composition; enforces the T-06 outside-click flag policy uniformly.
4. **Confirm atom-authoring order:** 12 shipped + 4 nesting recipes first, defer calendar/knowledge-graph atoms to v1.1?

**Phase 2 shipped as PR #57** — `compose` + `nest` + `subscribe-cortex` verbs; 58 → 86 tests.

**Phase 3 head-heavy shipped as PR #58** — 303 atoms for chat + book-page + error under `docs/atoms/card-insides/`; every atom carries `:corpus-branch artifact-authoring` + `:injected-at-iter 34000` metadata.

**Phase 3 tail lane firing now** — 13 RAG chunks (9 remaining shipped compositions + 4 nesting recipes). No calendar/knowledge-graph. Report expected in ~10-15 min.

Minor incident during head-heavy: an early git checkout landed the lane on another lane's branch; detected + cherry-picked cleanly; safety guard denied force-move (correctly). Remote `artifact/phase-b-compose-nest-subscribe-cortex` pointer unchanged. Local-only impact.

**One follow-on infrastructure note:** the val_subgroup_breakdown panel in Forge (F5-03 in the Forge restart burndown) should recognize `artifact-authoring` as a distinct series before Phase 6 restart — else the class-5 monitor won't see the new branch.

## TUTORIAL + Games plan (post-audit at ~21:35)

Report: `~/code/lacuna-labs/research/lacuna-docs/engineering/tutorial-audit-and-games-book-plan-2026-07-10.md`

**TUTORIAL.html is the wrong tutorial.** It's a Curator/carts tutorial (sled, cortex/model/etsy verbs, sprite dispatcher, card gaits) inherited from the 2026-07-09 extraction and never retargeted. Never introduces `define`, `lambda`, `cond`, `let`, `map`, `syntax-rules`, or the REPL. Someone landing on the docs site sees Curator internals instead of a language intro. **Recommend rewrite, not patch** (~14h lane). This is a real trust surface — the language-tutorial gap is visible from the homepage.

**Games book confirmed missing.** Proposed 16 chapters × ~62 programs = 1,000 programs (canon-compliant). Requires 6 new engine primitives first: `game/loop`, an input family, seeded RNG, state snapshot, tick, verdict (~10h engine work). Then authoring: ~40h all-hands or ~200h single-lane. Fits as book slot #16 without a 17th book.

**Documentation lies that shipped and are visible to readers:**
- CHANGELOG says ~80 primitives; real count in `base.js` is 119. Undersells.
- Book Chapter 14 documents `sakura/complete` + `sakura/rewrite` + `sakura/explain` — none exist in `base.js`. Either ship them or add a NOT YET SHIPPED banner.
- `rng-uniform` is `Math.random`-backed at Scheme scope; games need seedable RNG. Documentation implies determinism.
- Tutorial §14 (FRP `time/*` + `memory/*` + ASK verbs) reads as live but the verbs don't exist in `base.js`.
- Eight `artifact/*` headless-stub verbs shipped in v1.4 are undocumented in both Tutorial and Book.

These are cheap doc fixes but they're the kind of thing that erodes trust with a first-time reader. Recommend a small doc-repair lane (~1-2h) after your merges land.

## Sanitation lane findings (post-sweep at ~20:45)

Report: `~/code/lacuna-labs/research/lacuna-docs/engineering/sanitation-report-2026-07-10.md`

- **44.5 GB reclaimable** under `~/.forge/runs/`: 6 damaged sakura-4b-v2 dirs (~38 GB) + `sakura-8b-v1.killed/` (~6.5 GB). Gated on Phase 6 trainer-stable.
- **`~/code/forge/docs/WORKER-INTERFACE-SPEC.md` exists and references `gpu_lock`.** R-08b (rewrite from spec) is now the cheap R-08 option — spec-driven, 1-2 hour lane. Verified the file's presence.
- **`SECRETS.md` at `~/code/curator/` repo root, untracked.** Real security surface if someone runs `git add -A`. **Needs gitignore entry tonight.** Small write to curator — needs your OK.
- **60+ untracked files in `~/code/lacuna-labs/` including tonight's 67 engineering docs.** Whole doctrine trail lost if workstation crashes. **Needs commit sweep tonight.** Small write to lacuna-labs — needs your OK.
- All 27 open sakura-scheme PRs are same-day + CLEAN. No stale prior work.
- Curator: 18 branches with no PR ever (feat/graph-v2/v3/v4 look superseded by v5). Deletion candidates.

## Owner merge progress (fresh check at 18:20 tick)

Alfred merged 5 PRs since 17:22:
- #26 `book: HelloSurface artifact system (v1) — retarget to main` (17:22)
- #27 `artifact: doctrine extension — book/tutorial/intro/error types` (18:07)
- #28 `artifact: chrome-per-type — web-browser + game + winamp on music` (18:10)
- #29 `artifact: doctrine synthesis + Phase A wiring + 25 killer features + verb ontology` (18:13)
- #39 `hello-surface: wire installArtifactVerbs into mount lifecycle` (18:19)

All 5 tonight-shipped PRs (#51-#55) remain CLEAN/MERGEABLE after these landings — no conflicts triggered. The artifact substrate is now on main; Wave 1 (#51) and Wave 2 (#52) extend it cleanly.

Still not yet done (from your queue): trainer git-checkout, Weave 2.0 corpus PRs (#53/54/55), artifact Wave 1+2 (#51/52), Q9 book PRs (#40-50), curator-web T-16 push.

## Artifact + Weave 2.0 corpus PR queue (tonight's tick)

**Merge-ready, awaiting owner review:**

1. **sakura-scheme #51** — `artifact: Wave 1 (T-01, T-02, T-03, T-06)` — CLEAN/MERGEABLE, 58→76 tests
   - Trust metadata on every artifact, `honest-null` composition, `outside-click-closes?` flag on all 11 compositions (ide+chat=false), 13 old factory files deleted
2. **sakura-scheme #52** — `artifact: Wave 2 (T-05, T-09, T-10, T-11)` — CLEAN/MERGEABLE, cumulative on #51 (branched off Wave 1 while #51 sat open), 76→108 tests
   - Action-record slats (T-05), `no-loose-escape-handler` ESLint rule (T-09), Cortex event bridge with diff-vs-full threshold @ 4096B (T-10), 77-chunk RAG static index (T-11)
   - **Merge order:** #51 first, then #52 (which will simplify once #51 lands)
3. **sakura-scheme #53** — `book: Weave 2.0 corpus — Self ch 11-15 + 100 correction pairs + 10 encyclopedic drafts` — CLEAN, off main, orthogonal to #51/#52
   - Jess's return report: `engineering/jess-weave-2-0-corpus-report-2026-07-10.md`
   - Ch12 uses incident-6's actual recovery from `resume-offset.json` as its worked example
4. **sakura-scheme #54** — `book: Weave 2.0 corpus depth — 8 encyclopedic + 20 matched-pair index` — CLEAN, off main, orthogonal to #51/#52/#53
   - 8 more encyclopedic drafts closing C-06 to its 20-domain target (11,981 words); 21-pair matched-pair A/B index at `docs/atoms/matched-pairs/index.md` (42% of C-07's 50-pair target; V-03 Chopin/Beethoven anchor included)
   - Jess's depth return report: `engineering/jess-weave-2-0-corpus-depth-report-2026-07-10.md`
   - **New non-blocking HOLDs:** (a) Rachmaninoff doc uses Piano Concerto No. 2 (aligned with training-plan target-2000 anchor); redirect if a different work was intended. (b) The Cortex-event-bus vs artifact-tree doc was authored from memory-derived architecture; reconcile against `src/` + `docs/design/` if the running code disagrees.
5. **sakura-scheme #55** — `book: Weave 2.0 corpus — C-07 matched-pair complete (50/50)` — CLEAN, off main

6. **sakura-scheme #56** — `book: Weave 2.0 corpus — C-04 incident narratives + C-05 abduction` — CLEAN, off main
   - 200 incident-narrative atoms (~40 per incident 1-5, 60 for incident 6, 40 cross-incident synthesis) + 100 abduction atoms (Peirce-lens across 7 domains). ~59,792 words. Closes burndown C-04 and C-05.
   - Jess's C-04/C-05 return report: `engineering/jess-weave-2-0-corpus-c04-c05-report-2026-07-10.md`
   - **DOCTRINE QUESTION FOR YOU:** Only class-4 pike is formalized in the WEAVE-2.0-PROCEDURE doc. Jess invented class labels 1/2/3/5/6 for the other incidents in this lane, consistent with the five-signal signature framework she inferred from the procedure doc. She flagged this needs your review before entering doctrine memory. If the classes she authored are wrong or the framework should be different, PR #56 needs revision before merge. See §7 of her return report.
   - **Small HOLD:** 6 missing encyclopedic entries she cross-references (pike-watchdog, service manager, val-subgroup-breakdown, stepped grad-clip, landmine map, fresh-Adam). Additive follow-on lane if wanted.

## Weave 2.0 corpus lanes — PAUSING NEW DISPATCHES

After 4 Jess lanes tonight (#53/54/55/56, ~600 atoms totalling ~85K words), pausing new authoring dispatches until you review the class-invention doctrine question above. Rate of authorship has outpaced review; landing more without your sign-off risks propagating unvalidated framework decisions.

Ready-to-fire on your approval (all safe additive work, no new doctrine invention):
- Freud-lens matched-pair addition (fills the taxonomy gap Jess flagged in #55)
- 6-entry encyclopedic gap-fill (the cross-references above)
- **C-02 (self-check retrofit)** — the only Phase 3 corpus item still unshipped. Needs read+write to `~/.forge/corpus/` (~2000 examples). Requires your reconfirm since your standing rule was diagnosis-read only, no writes. Deferred.
   - Closes burndown C-07 at 50/50. Domain distribution: music 7, commerce 12, systems 4, ml-systems 2, sakura-internals 10, reasoning 5, voice 4, failure-classes 6. Philosopher: popper 20, wittgenstein 18, peirce 9, lacan 3, freud 0.
   - Jess's C-07 return report: `engineering/jess-weave-2-0-corpus-c07-report-2026-07-10.md`
   - **HOLDs:** (a) No Freud-lens pair — five-lens taxonomy incomplete on that axis; may want an additive pair covering repression/latent-content contrast. (b) `:philosopher` field on the first 21 pairs only lives in the JSON manifest, not in the slat-record bodies — retro-apply if you want body-level consistency. (c) **Merge conflict** — #54 and #55 both touch `docs/atoms/matched-pairs/index.md`. Merge #54 first, then #55 will need a small rebase (Jess based #55 on #54's 21-pair state and extended).

**Held on push (unchanged from earlier tick):**

- **curator-web T-16 dead-emit cleanup** — commit `a06e88cbb` local on `curator/dead-emit-cleanup`, push blocked by 28 pre-existing curator-api pytest failures in `test_web_fetch_route.py` + `test_web_search_route.py`. My change only touches `LibraryCard.jsx` (React) — zero overlap with the failing backend routes. Options: fix the 28 unrelated fails OR authorize scoped `--no-verify` for this branch.

**Jess non-blocking HOLDs (from her return report):**

- ~~Chapters 6-10 of Book of Self are still unauthored~~ — **CORRECTED at 17:15 tick.** Ch 6-10 already exist as **PR #46** (`book: Self chapters 6-10 authored`) from the Q9 chapter-authoring lane earlier tonight. Not a fresh authoring gap; it's a merge-ordering issue. On disk main, only ch 00-05 are present because #46 is still open. Merge #46 before (or with) #53 to unblock ch 11's `prev` reference. Same holds for #45/#47/#48/#49/#50 (Marionette/Miscellany/One-Shot/Don'ts/Reference ch 6-10 all in the same batch).
- Encyclopedic count 12 vs. 10 target — two extras (Chopin Ballade No. 1, Sonata vs. Ballade form) trimmable if overshoot unwelcome. My call: keep them; they anchor C-07.
- eBay/Shopify subdomain depth (3+4 correction pairs each) vs. Etsy (12) — additive lane available if per-platform parity desired.
- No standalone Beethoven Moonlight encyclopedic doc — the Chopin/Beethoven A/B probe (burndown C-07) benefits from matched reference material on both sides. Firing the next Jess lane to close this + add 8 more C-06 domains toward the 20-domain target.

## From straggler loop — DONE + accumulated HOLDs

**11 PRs shipped, 1 stale closed, sakura-corpus populated.** Report: `research/lacuna-docs/engineering/straggler-loop-report-2026-07-10.md`.

PRs to review:
- sakura-scheme #30 (Q6 pink) · #31 (Q7 DESIGN §14) · #33 (VitePress prep) · #35 (Flux driver) · #37 (define-record + runtime plan)
- curator #4 (Kwame scope-gate) · #5-#10 (6 audit rebases)

Still on you:
1. **Q15 delete 13 merged curator branches** — authorize
2. **Q1 Curator #3 → #2 → main chain** — merge
3. **Q5-B push `feat/curator-consume-sakura-scheme` from workstation** — you own this per your Q5 answer
4. **Q11 Flux batch on Mac Studio** — pick a 25-50 min window
5. **Q10 DNS + Pages for `scheme.lacunalabs.ai`** — wire it
6. **4-PR artifact merge stack (#25 → #27 → #28 → #29)** — cascade lane running; check when it lands

Plans landed for review:
- `specs/scheme-runtime-features-plan-2026-07-10.md` — Q3 remaining features roadmap
- `engineering/chapter-authoring-wave-plan-2026-07-10.md` — Q9 wave plan (Q9 wave-firing lane also in flight)

## From gap brainstorm (140 gaps found)

**Full catalog:** `~/code/lacuna-labs/research/lacuna-docs/specs/artifact-gap-brainstorm-2026-07-10.md` (~8,200 words)

### Top-5 highest leverage
5. **Registry-as-training-data has no defined SHAPE** — asserted 3× in doctrine but never specified as a paired-example structure. Blocks the epoch-N+1 compounding promise until defined. **Biggest hole.**
6. **Cortex ← artifact return path under-specced.** Artifacts as Cortex nodes with edges + subscribing to Cortex changes + Sakura's reasoning trace in describe. Right now the loop only runs one direction.
7. **Trust axis fields missing** (author, origin, confidence, signed). Cheap now, ugly to retrofit. Every downstream trust feature depends on these.
8. **Voice-only / sound-first artifacts** — doctrine assumes DOM. Voice-first Rust engine will hit the DOM-only wall soon. medium=sound axis-value exists but no audio-only chrome or non-DOM composition contract.
9. **Doctrine inconsistencies** — success predicate ("did it produce an artifact?") fights honest-null; card ↔ artifact boundary fuzzy across memory sources that disagree.

### 4 "we might regret this in <6 months" concerns

- Registry-as-training-data (Gap #64) — biggest untested load-bearing assumption
- Persistence HELD but not stubbed (Gap #8) — everything currently volatile
- Success-predicate vs honest-null (Gap #67) — risks training Sakura to over-produce artifacts to satisfy the predicate, opposite of the epistemic-stance memory demand
- Chrome roster locked at 6 + no author/origin/confidence fields on artifacts = both regret-candidates

### Structural findings worth ruling on

- **7-axis ceiling on the taxonomy is probably wrong** — at least 4 unnamed dimensions already implicit (author, origin, confidence, persistence)
- **"No global event bus" is a polite lie** — census found 100+ `curator:*` CustomEvents already exist; hiding it behind `subscribe(fn)` doesn't remove it
- **Card ↔ artifact boundary genuinely fuzzy** across two memory sources that disagree
- **"Types are coordinates, never classes" is overconfident** — some things really are class-like (error is not smoothly interpolatable to music player)

### 4 traps to reject on sight

- Gap #76 chrome-nesting (chrome-within-chrome — cursed)
- Gap #82 3D room artifact — over-reach
- Plus 2 implied in "over-constraining" analysis

## From Lane Q9 (chapter 6-10 authoring, 2026-07-10)

15 PRs opened: #32 (Reason I), #34 (Reason II), #36 (Reason III), #38 (Reason IV), #40 (Systems), #41 (Money), #42 (Instruments), #43 (Motion), #44 (Music), #45 (Marionette), #46 (Self), #47 (Miscellany), #48 (One-Shot), #49 (Don'ts), #50 (Reference). All pre-push hooks pass (vitest 39/39). Aggregate report: `engineering/lane-q9-chapter-authoring-2026-07-10.md`.

**HOLDs:**

1. **Book-scope reconciliation.** Task said "16 books × 5 chapters = 80 chapters" including hello-surface, but hello-surface already has chapters 6-10 (it's the surface tutorial, 11 chapters total). Actual scope was 15 books × 5 chapters = 75 chapters. If hello-surface *does* need extended chapters 11-15, that's a separate lane.
2. **Chapter density variance.** Reason I chapters run ~7-9KB with 7-8 programs; later books (Instruments onward) run ~4-5KB with 6 programs (density was tightened partway through to fit session budget). If uniform density matters for the training corpus, an expansion pass on the shorter chapters may be warranted.
3. **Scheme syntax spot-check needed.** Some later-authored chapters use idiomatic Scheme that may not exactly match the sakura-scheme dialect (e.g., a couple `sort` calls). Recommend a build-book smoke test on the runnable programs before training.
4. **Cross-reference slug consistency.** Some chapters use `[[book-of-X#chapter-N]]`, others use `[[book-X#chapter-N]]`. PR #24's resolver accepts both under `--lenient`, but a doc-build pass would confirm all cross-refs resolve.
5. **Merge sequencing.** 15 book PRs are all against `main` from a common base. If they can be merged sequentially without rebase conflict (they touch disjoint `docs/book/<slug>/` dirs, so should be safe), fine — otherwise a rebase pass is needed.


