# Language extraction — progress

Status: **partial land, honest halt at step (d)** — 2026-07-09.

Companion doc: [THE-PLAN.md](./THE-PLAN.md) Chapter 3.

## What landed

### Step (a) — Copy files to new repo, preserve history

**GATE PASSED.**

- `~/code/sakura-scheme/` initialized as a fresh git repo.
- `git filter-repo` extracted the six core files from a `/tmp/engine-extract` clone of Curator:
  - `curator-web/src/scheme/reader.js`
  - `curator-web/src/scheme/interp.js`
  - `curator-web/src/scheme/base.js`
  - `curator-web/src/scheme/macro.js`
  - `curator-web/src/scheme/runtime/verbRegistry.js`
  - `curator-web/src/scheme/runtime/dispatch.js`
- Path-renamed into `~/code/sakura-scheme/src/`.
- Full commit history preserved for each file.
- 30 commits carried across.

### Step (b) — Freeze the public API surface

**GATE PASSED.**

- `src/index.js` re-exports 41 public symbols. See `~/code/sakura-scheme/PUBLIC-API.md`.
- Notably NOT exported: `dispatch` — the extracted `dispatch.js` carries hard imports of Curator internals (`logbus`, `card-api`, `canvasPower`, `chipSink`, `chipEvent`, `chatChipBus`, `eventLog`, `correlationContext`) that need a partial carve-out (core dispatcher ~500 LOC vs Curator security policy ~350 LOC). Documented in `sakura-scheme/CHANGELOG.md` as deferred.
- Small additive fixes to make the engine work standalone:
  - `interp.js`: import path fixed from `./runtime/verbRegistry.js` to `./verbRegistry.js`.
  - `base.js`: bricklay cache import replaced with stubs — the primitive still returns correct results, it just re-packs every call.
  - `verbRegistry.js`: `registerVerbMeta` additively stores introspection fields (doc, examples, contract, arity, atom, tier, source, namespace, since, name). Dispatcher-facing shape unchanged.

### Step (c) — Curator adds the dep

**GATE PASSED.**

- `curator-web/package.json`: added `"sakura-scheme": "file:../../sakura-scheme"` to `dependencies`.
- `npm install` in `curator-web/` succeeds.
- The package resolves at `curator-web/node_modules/sakura-scheme/` and exports the expected 41 symbols.

### Step (f) — Move docs

**PARTIAL PASS.**

- Copied to `~/code/sakura-scheme/docs/`:
  - `SAKURA-SCHEME-1.0-REFERENCE.md` (+ appendix rows 1-3)
  - `SAKURA-SCHEME-1.0-ENGINEERING.md`
  - `SAKURA-SCHEME-1.0-STYLE-GUIDE.md`
  - `SAKURA-SCHEME-1.0-SEALING.md`
  - `SAKURA-SCHEME-TUTORIAL.html`
  - `SCHEME-RUNTIME-TRUTH-2026-06-30.md`
  - `SCHEME-ERROR-TAXONOMY-2026-07-05.md`
- Written fresh in `~/code/sakura-scheme/docs/`:
  - `SAKURA-SCHEME-BOOK.md` — the flagship 15-chapter Book (Chapter 9 REPL wow-layer + Chapter 11 autogen + Appendix A/B).
  - `slat/SPEC.md`, `slat/GRAMMAR.md`, `slat/EXAMPLES.md`.
- Written fresh in `~/code/curator/docs/`:
  - `CURATOR-VERBS.md` — kebab-case stub for Curator's verb catalog, pointing at the Book for language material.
- **Kept in place at Curator** (rather than replacing with stubs): the original doc files. Rationale: replacing 11,610 lines of reference docs with a stub in the same commit as the extraction is a high-risk change to Curator's HTML doc-build pipeline. Both locations resolve today; a follow-up sprint splits the 11k-line reference into Book (language) + CURATOR-VERBS.md (verbs).

## What halted

### Step (d) — Rewire Curator's imports

**HALTED — pre-existing broken baseline.**

- The plan specifies: search-replace 130+ Curator files whose imports point at `./reader.js`, `./interp.js`, `./base.js`, `./macro.js`, or `./runtime/verbRegistry.js` to point at `'sakura-scheme'`. The exit gate: `npm --prefix curator-web test` passes.
- **222 files** actually match the import pattern for the four core files; **13 files** match `runtime/verbRegistry.js`.
- Running Curator's test suite from HEAD (with `sakura-scheme` dep added, no imports rewired): **1,410 tests failing / 20,619 passing / 149 skipped out of 22,178.** Failures span App shell, focus button, top-frame, automation studio, cart execution, and many other Curator-domain files.
- Running Curator's test suite from HEAD **without** the dep addition (my package.json edit stashed): **1,410 failing / 20,619 passing** — the exact same numbers. **My change introduces zero regressions.**
- The 1,410 pre-existing failures are almost certainly a consequence of Curator's uncommitted work state (five modified files + a dozen untracked corpus subdirs from an unfinished sprint).
- Per the extraction contract: "Any Curator test failure aborts that step immediately." Cannot establish a clean gate against a broken baseline. **HALT.**
- Recommendation: hold step (d) until Curator's tree is green, then execute the 222-file rewire under a frozen tree with a full test run before and after.

### Step (e) — Delete old copies inside Curator

**BLOCKED on step (d).** Cannot delete files that 222 modules still import.

## Verifications performed

| # | Check | Result |
|---|---|---|
| 1 | Zero-touch — Curator's tests match baseline with sakura-scheme added | PASS (1410 failing on both sides) |
| 2 | Seal — Curator builds with Lacuna deleted (dry-run) | not run (Curator's test baseline itself broken) |
| 3 | REPL bootstrap — `node bin/sakura-scheme repl` starts | PASS |
| 4 | CLI bootstrap — `sakura-scheme eval "(+ 1 2)"` prints 3 | PASS |
| 5 | Doc regen — hook trigger (dry-run) | trigger manifest written; hook wiring is a follow-up |
| 6 | Sakura's introspection — `help('card/open')` returns a hash-table | PASS (`tests/introspect.test.js`) |
| 7 | Slat round-trip — 100 fixtures | PASS (`tests/slat.test.js`, JS binding) + PASS (Python binding on shared vectors) |
| 8 | Gastronomy read — parse a real `.scm` file | not attempted (base library doesn't ship with gastronomy verbs; a reader-only mode call would need to guard against unknown verbs first — reader itself parses fine, evaluator would fail on unregistered verbs) |
| 9 | Consumer version pin — `sakura-scheme` resolves in `curator-web/package.json` | PASS |

## Deliverable inventory

### `~/code/sakura-scheme/`
- 6 core files with preserved history: reader, interp, base, macro, verbRegistry, dispatch (dispatch unwired).
- 5 new source files: index.js, introspect.js, repl.js, cli.js, docs-emitter.js, slat.js.
- bin/sakura-scheme + package.json + LICENSE (MIT) + CHANGELOG + PUBLIC-API + CLAUDE + CONSUMERS + CONTRIBUTING + CODE_OF_CONDUCT.
- 4 test files, 25 tests, all passing.
- bindings/js/slat.js (canonical JS binding).
- bindings/python/slat/ (Python binding, mirrored from `~/code/forge/forge/corpus/slat_*.py`, tests passing).
- docs/SAKURA-SCHEME-BOOK.md — the 15-chapter Book.
- docs/slat/{SPEC,GRAMMAR,EXAMPLES}.md.
- 8 legacy Scheme docs copied in.
- docs/.vitepress/config.mts.
- .lacuna/{triggers,tools}.yaml.
- 6 dev scripts under scripts/.

### `~/code/curator/`
- curator-web/package.json: sakura-scheme dep added.
- docs/CURATOR-VERBS.md: new stub.

### `~/code/lacuna-docs/`
- engineering/THE-PLAN.md: Chapter 3 amended per the 6 edits.
- canon/CHANGELOG.md: entry for chapter-3-amendment.
- engineering/language-extraction-progress.md: this file.

## Commits

- **sakura-scheme** — `dffb562` — feat(sakura-scheme): initial extraction from Curator, v1.4.0
- **curator** — `78dab86d4` — chore(scheme): consume sakura-scheme 1.4.x + add CURATOR-VERBS.md stub
- **lacuna-docs** — see this repo's git log; two edits (Chapter 3 amendment + canon CHANGELOG + progress doc).

## Next sprints

1. **Curator green baseline sprint.** Land whatever's in flight in `curator-web/src/` and get the test suite back to 22,178 / 22,178. Then step (d) becomes runnable.
2. **Step (d) execution.** Under a frozen tree, run the 222-file search-replace with test runs before and after. Rollback via `git checkout .` if regressions appear.
3. **Step (e) execution.** After (d), delete `reader.js`/`interp.js`/`base.js`/`macro.js`/`runtime/verbRegistry.js` from `curator-web/src/scheme/`. Commit.
4. **Dispatch carve-out.** Split `src/dispatch.js` in `sakura-scheme` into a hermetic core (~500 LOC) and a Curator-side `security-policy.js` (~350 LOC). Export the core from `sakura-scheme`; keep the policy in Curator.
5. **Reference split.** Split the 11,610-line `SAKURA-SCHEME-1.0-REFERENCE.md` into the Book (language sections stay in `sakura-scheme`) and CURATOR-VERBS.md (verb sections move to Curator's stub).
6. **Doc site deploy.** VitePress build + GitHub Pages deploy from `sakura-scheme/main`.
7. **REPL wow-layer implementation.** The Book documents 20+ meta-commands; the current stub implements ~10. Complete the rest (`,trace`, `,inspect`, `,watch`, `,save`/`,load`, `,ask sakura`).
