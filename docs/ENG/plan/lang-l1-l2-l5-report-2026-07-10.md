# Language Burndown Report — L1 + L2-02 + L5-02 · 2026-07-10

**Lane:** LANGUAGE BURNDOWN — combines Phase L1 doc reconciliation, L2-02 GUIDE classification, L5-02 consumer-side audit.

**Scope:** one PR against `sakura-scheme` `main` for L1; research-only for L2-02 and L5-02.

---

## §1 · L1 PR — doc reconciliation

**Branch:** `docs/lang-l1-reconciliation`
**PR:** [Lacuna-Labs/sakura-scheme#60](https://github.com/Lacuna-Labs/sakura-scheme/pull/60)
**Status:** Open. **NOT auto-merged.**

**Files changed (6):**

| File                                             | Change |
| ------------------------------------------------ | ------ |
| `CHANGELOG.md`                                   | L1-01 — correct v1.4.0 primitive count from `~80` to 125 (117 unique non-artifact + 8 `artifact/*` stubs). |
| `docs/artifact-verbs.md`                         | L1-02 — NEW file. Documents the 8 `artifact/*` headless-stub verbs that already ship in v1.4 (name, arity, perm, returns, headless-throw note, pointer to the browser-side implementation and to the `ARTIFACT_CORE_VERBS` data export). |
| `docs/book/14-autogen.md`                        | L1-03 — `NOT YET SHIPPED` banner (plain text, no emoji) at the top of Chapter 14 marking `sakura/*` autogen verbs as aspirational v1.5+ roadmap. |
| `docs/TUTORIAL.html`                             | L1-04 — `NOT YET SHIPPED` `.callout.warn` banner in §14 marking FRP `time/*`, unified `memory/*`, and the ASK floor as aspirational. Uses the doc's existing CSS pattern. |
| `docs/REFERENCE.md`                              | L1-05 — one-line clarification appended to the `rng-uniform` entry (§15.7) noting process-time seeding, no user-seedability, seedable primitives planned for v1.5+. |
| `docs/primitive-coverage-2026-07-10.md`          | L1-06 — NEW file. Coverage audit: 125 base primitives total; 117 in `REFERENCE.md`, 8 in the new `artifact-verbs.md`, **zero uncovered** after this PR. Notes duplicate `def('eq?', …)` / `def('equal?', …)` registrations in `src/base.js` at lines 115/116 and 286/287 as a follow-up cleanup (behaviour unchanged; `env.define` is last-writer-wins and metadata is populated once from `BASE_META`). |

**Primitive count method:** enumerated every `def('name', …)` and `e.define('name', …)` call site in `src/base.js`. Raw call count: 127 (includes the two duplicate pairs). Unique names: 125 (117 non-artifact + 8 `artifact/*`).

**L1-06 audit finding (repeated here):** the only base primitives missing from `docs/REFERENCE.md` were the 8 `artifact/*` verbs, which L1-02 documents in `docs/artifact-verbs.md`. Reference-side verbs that are NOT in `src/base.js` are almost all in the consumer-side verb layer (`comb/*`, `seq/*`, `geom/*`, `card/*`, `paint/*`, `sprite/*`, `cortex/*`, `marketplace/*`, `note/*`, `audio/*`, `fx/*`, `sakura/*` and the roll-up expansion waves) — this is the intended language/consumer split from `CLAUDE.md`, not a bug.

---

## §2 · L2-02 · GUIDE chapter classification

Table below classifies each of the 15 chapters at `~/code/curator/curator-web/src/scheme/GUIDE/` for the eventual sakura-scheme canon migration.

Classification legend:

- **fold** — fold content into an existing sakura-scheme canon book.
- **promote** — the chapter has enough distinct material to warrant its own book or its own dedicated seat in the extended canon.
- **drop** — content is Curator-specific host lore that does not belong in the language canon.

Effort legend: S = <½ day, M = ½–2 days, L = >2 days.

| # | File | Summary | Classification | Target | Effort |
|---|------|---------|---------------|--------|:------:|
| 01 | `01-mental-model.md` | Homoiconicity as "the one rule" — every value is the same shape. Explains why Curator chose Scheme. | fold | `docs/book/01-hello-sakura-scheme.md` (already covers "why Scheme") | S |
| 02 | `02-quick-start.md` | Ten-line card + twenty-line game + AutomationStudio three-button workflow. Very Curator-Studio-specific. | drop | Curator-host lore, not language canon. Preserve as Curator-side onboarding under `curator-docs/`. | S |
| 03 | `03-card-primitives.md` | The `button`, `analog-pad`, `display` primitives + `define-card` verb. Card-shell composition model. | fold | `docs/book/hello-surface/` — this is exactly the hello-surface substrate that seat is for. | M |
| 04 | `04-card-verbs.md` | Runtime card verbs: open, close, focus, move, get, set!, iterate. Reflection model on the surface. | fold | `docs/book/hello-surface/` — same seat as 03; card-verb chapter alongside card-primitive chapter. | M |
| 05 | `05-cart-verbs.md` | The cart-as-state-machine language: `next`, `done`, `escalate`, `wait`, `after`, `act`, `interrupted`, ctx helpers. | fold | `docs/book/04-lists.md`/`05-recursion.md` neighbourhood is wrong; better target is `docs/book/systems/` (systems book already covers the cart driver-loop pattern) OR a new "carts" seat inside the extended canon. Owner call. | M |
| 06 | `06-paint-primitives.md` | `surface-paint-text`, `surface-paint-dots`, dot mutation, the SurfaceRegistry ABI, paint-fn contract. | fold | `docs/book/hello-surface/` — paint verbs are surface substrate. | M |
| 07 | `07-sound-primitives.md` | Web-Audio-scheduler tone/SFX/music-arrangement verbs, ADSR + voice basics. | fold | `docs/book/instruments/` (Instruments book covers per-instrument synthesis/voice) OR `docs/book/music/` (Music book covers sound/composition). Split: ADSR + voice → Instruments; scheduler + arrangement → Music. | M |
| 08 | `08-chip-economy.md` | Logs-as-chips substrate: how log atoms become automation conditions; the "code-is-data" principle applied to logs. Curator-specific but principle-heavy. | fold | `docs/book/systems/` — the log/chip pipeline is systems-book material. | M |
| 09 | `09-heal-playbook.md` | How Sakura auto-fixes platform gotchas; chapter is marked "needs Alfred's review; canon evolving." | fold | `docs/book/self/` (Book of Self covers her faculties, escalation, self-knowledge — heal is a specialisation of that) with the caveat that the heal API is unstable and Alfred flagged this chapter for accuracy review. | M |
| 10 | `10-animation-primitives.md` | Explicitly marked "mostly gaps" — proposed animation model, most verbs are aspirational. | fold | `docs/book/motion/` (Motion book covers motion primitives + embodiment axis). Land the "animations-and-automations are structurally close" thesis; drop the specific PROPOSED verb list unless it's shipped. | M |
| 11 | `11-reference.md` | Alphabetical verb lookup for the Curator runtime — a reference manual, not a book chapter. Backed by `base.js`, `widgets.js`, `cardVerbs.js`, `cartPrelude.js`, `surfaces.js`, `sound.js`, `shopVerbs.js`. | fold | `docs/REFERENCE.md` (top-level, not book/). Reconcile any Curator-only verbs (widgets/cardVerbs/cartPrelude/surfaces/shopVerbs) as consumer-side per CLAUDE.md; keep the base-runtime verbs in `docs/REFERENCE.md`. | L |
| 12 | `12-pixel-games.md` | Four-step pixel-game progression: blinking pixel → small game → pixel groups → block games. Progressive-tutorial spine. | promote | **Book of Games** (task L3-03). GUARD: task #25 book-of-games PRESERVE memory slug. Do NOT drop under any circumstances. This is the seed corpus for the Book of Games seat. | M |
| 13 | `13-recipes.md` | Etsy publish, eBay sync, retry-with-backoff, multi-platform fan-out, cross-platform "when any throws X". Copy-paste cart recipes. | drop | Curator-shop-specific host lore, not language canon. Preserve as Curator-side recipes under `curator-docs/recipes/`. | S |
| 14 | `14-for-sakura.md` | Meta: the guide is dual-audience (human + Sakura). Named "For Sakura" acknowledgement chapter. | drop | Meta-frame chapter about GUIDE itself; not language content. When GUIDE is retired, this chapter is retired with it. | S |
| 15 | `15-contributing.md` | How to add a new Scheme verb to the runtime; layered extension model. | fold | `docs/book/miscellany/` (Miscellany covers feature-tools + general scripting + L1/L2/Loam service-catalog literacy — extension model fits alongside). Alternatively fold into `CONTRIBUTING.md` at sakura-scheme root. | M |

**Counts:** fold=11 · promote=1 · drop=3 · total=15.

**Guard note:** chapter 12 (`12-pixel-games.md`) is explicitly PRESERVED under task #25 book-of-games slug; classification is **promote → Book of Games** (task L3-03), not drop.

---

## §3 · L5-02 · consumer-side residual local-import audit

**Consumer:** `~/code/curator/curator-web/src/`.

**Method:** grepped for import statements that reference local `./scheme/*` module paths (reader, interp, base, macro, verbRegistry, introspect, slat, dispatch) rather than the extracted `sakura-scheme` npm package.

**Result:** **13 residual local-import callsites** found across 4 engine modules. Zero callsites import from the `sakura-scheme` package name today; extraction is code-complete on the sakura-scheme side but Curator has NOT yet been switched over to the package. This is the whole L5-01 lane.

### `./scheme/reader.js` (9 callsites)

| File | Line | Import |
|------|-----:|--------|
| `components/cards/shopServicesManifest.js` | 3 | `import { Sym } from '../../scheme/reader.js'` |
| `components/cards/shopServicesManifest.test.js` | 25 | `import { sym } from '../../scheme/reader.js'` |
| `components/cards/orchestraStudio/schemeIO.js` | 57 | `import { parse as parseScheme, Sym } from '../../../scheme/reader.js'` |
| `components/cards/createStudio/SchemeBuffer.jsx` | 19 | `import { parse as parseScheme } from '../../../scheme/reader.js'` |
| `__tests__/animationEngine.deterministic.test.js` | 37 | `import { sym } from '../scheme/reader.js'` |
| `lib/memoryUnified.js` | 31 | `import { sym } from '../scheme/reader.js'` |
| `lib/sakuraCoauthor.js` | 36 | `import { parse as parseScheme } from '../scheme/reader.js'` |
| `lib/operatorCards.js` | 33 | `import { parse as parseScheme } from '../scheme/reader.js'` |
| `lib/services/normalizeIncomingItem.js` | 31 | `import { Sym } from '../../scheme/reader.js'` |

### `./scheme/interp.js` (3 callsites)

| File | Line | Import |
|------|-----:|--------|
| `surface/scheme-host/__tests__/sceneVerbs.test.js` | 16 | `import { Env } from '../../../scheme/interp.js'` |
| `__tests__/animationEngine.deterministic.test.js` | 36 | `import { Env } from '../scheme/interp.js'` |
| `lib/surface/TickRegistry.js` | 27 | `import { apply } from '../../scheme/interp.js'` |

### `./scheme/base.js` (1 callsite)

| File | Line | Import |
|------|-----:|--------|
| `lib/schemeLibraryQuery.js` | 28 | `import { makeBaseEnv } from '../scheme/base.js'` |

### `./scheme/macro.js` (0 callsites)

None found.

### `./scheme/verbRegistry.js` / `introspect.js` / `slat.js` / `dispatch.js` (0 callsites)

None found across curator-web/src at the checked paths. (Dispatch is expected — CLAUDE.md notes Curator continues to import its own copy at `curator-web/src/scheme/runtime/dispatch.js`; this was not counted as extraction-incomplete.)

**Summary:** 13 callsites to migrate in a future L5-01 lane. Recommend batching by module (reader batch of 9 first — the largest and most straightforward, since `Sym`/`sym`/`parse` are all top-level exports from `sakura-scheme`), then interp (3), then base (1).

---

## §4 · HOLDs / blockers

None on this lane. The PR is open and ready for owner review. Neither Part 2 nor Part 3 touched code.

Follow-ups that are **out of scope for this lane** but surfaced by the audit:

1. **Duplicate `def('eq?')` / `def('equal?')`** in `src/base.js` (L1-06). Doc-noted; a follow-up cleanup PR should collapse each pair to a single definition. Behaviour is unchanged.
2. **Chapter 09 `09-heal-playbook.md`** was flagged "needs Alfred's review for accuracy — canon evolving (2026-06-02)." Any fold into the sakura-scheme canon should re-check the heal API state before committing wording.
3. **Chapter 11 `11-reference.md`** covers Curator-side verbs (widgets/cardVerbs/cartPrelude/surfaces/shopVerbs) that are NOT in `src/base.js`. Folding into `docs/REFERENCE.md` requires deciding which verbs are language-layer and which are consumer-layer per `CLAUDE.md`.
4. **Curator-side extraction migration (L5-01)** is the 13-callsite lane. Recommend it as the next language-lane follow-up.

---

## §5 · Recommendations for the next language lane

1. **L5-01 consumer migration lane.** Switch the 13 residual callsites over to the `sakura-scheme` package. Reader batch first (9 callsites, straightforward), then interp (3), then base (1). Requires publishing `sakura-scheme` to the local package resolver Curator uses. Small, focused, well-scoped.
2. **L2-03 GUIDE fold execution lane.** Take the classification table in §2 and produce the actual fold PRs — one per target book seat. Owner call on chapter 05 (cart-verbs → systems book vs. new carts seat) and chapter 15 (miscellany book vs. `CONTRIBUTING.md`) needed first.
3. **L3-03 Book of Games seat.** Task #25 preserves `12-pixel-games.md` as the seed; the promotion to a full Book of Games seat is the next step. Draft the seat structure + progression (blinking pixel → small game → pixel groups → block games → beyond) and open a doc-only PR.
4. **Follow-up cleanup PR.** Consolidate the duplicate `eq?` / `equal?` registrations in `src/base.js` (§4 item 1). Doc-note done; the code cleanup is a 2-line diff.
5. **Chapter 09 heal-playbook API re-check.** Before folding, ping Alfred / the heal-team on API state. Might turn into a HOLD.

---

## Guardrails compliance

- One PR (Part 1), not auto-merged. ✅
- Parts 2 + 3 are read-only; no file edits outside sakura-scheme's L1 doc set. ✅
- No emoji in the PR or in any of the shipped docs. ✅
- No banned words; no audience-tells; no `--force`; no `--no-verify`. ✅
- Nothing under `~/.forge/{runs,corpus,scripts}/` touched. ✅
- Nothing deleted. ✅
- No new code shipped — no new primitive registrations, no new verb registrations, no runtime changes. ✅
- `12-pixel-games.md` classification is **promote → Book of Games** (task L3-03). Task #25 book-of-games PRESERVE memory slug respected. ✅
