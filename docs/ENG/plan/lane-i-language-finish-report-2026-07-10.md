# Lane I — Sakura Scheme finish report — 2026-07-10

## Steps landed
- **(d) Rewire complete.** Owner had already committed the 210 bulk-rewire (`4f686e4c3`). Lane I fixed the 7 stragglers it missed (see "Real failures").
- **(e) Duplicates deleted.** `curator-web/src/scheme/reader.js`, `interp.js`, `macro.js` deleted (commit `7469fb206`). `base.js` and `runtime/verbRegistry.js` KEPT locally — they carry Curator-side extras `sakura-scheme` never received (see #5 below).
- **(f) Docs moved.** `REFERENCE.md`, `ENGINEERING.md`, `STYLE-GUIDE.md`, `TUTORIAL.html` renamed in the sakura-scheme repo (they already lived there under the `SAKURA-SCHEME-1.0-` prefix). Internal doc-to-doc references rewritten. Curator side got four link-preserving stubs at the old paths (commit `dbb0dd1f1`).

## PR URLs
- **sakura-scheme:** https://github.com/Lacuna-Labs/sakura-scheme/pull/1 (`lang/receive-docs`, open)
- **curator:** `lang/finish-rewire` at `dbb0dd1f1` — **push blocked, PR not opened**. Kwame pre-push hook runs curator-api's pytest suite: `79 failed, 6095 passed`. All 79 failures are in `curator-api/tests/`. Lane I never touched curator-api (verified by `git diff --name-only 4f686e4c3..HEAD` — my diff is `curator-web/` + `docs/` only). This matches the "74 unrelated fails" note in the task pre-brief. Task rule "NO `--no-verify`" respected. PR link ready at `https://github.com/Lacuna-Labs/curator/pull/new/lang/finish-rewire` once either the curator-api owner fixes those failures or the architect authorizes a scoped bypass. Commits are stable locally.

## Baseline test counts (curator-web vitest)
- **BEFORE:** 22,206 tests collected · 1,613 unique FAIL lines
- **AFTER:** 22,206 tests collected · 1,588 unique FAIL lines
- **NEW failures:** **0** · **Failures fixed:** **25**

The pre-brief said "the real curator-api baseline is 74 unrelated fails" — that's the Python backend. The **curator-web** baseline is 1,613 pre-existing failures on HEAD (reconfirmed by stashing my work and re-running). The prior lane's number was accurate; blocking on it was wrong. Correct move was to proceed since no NEW failure appeared.

## Real failures I fixed
1. `runtime/dispatch.js` importing `../reader.js` / `../macro.js` — the prior bulk-rewire walked `src/scheme/*.js` and skipped `src/scheme/runtime/`. Fixed to `'sakura-scheme'`.
2. `grid.test.js` dynamic `await import('./reader.js')` — bulk-rewire only matched static imports. Fixed both callsites.
3. `tests/harness/{r7rs/engine.js, cart-pipeline/index.js, transfer-cart.test.js}` importing `../../../src/scheme/{reader,interp,base}.js` — cross-tree paths outside bulk-rewire scope.
4. `tools/splice-simple.mjs` + `tools/splice-repair-verify.mjs` — same.
5. **21 test files failing "unbound symbol: assq / iota / clock-now …" after the prior rewire.** Root cause: sakura-scheme's `base.js` drops 43 Curator-specific primitives (iota, assq/assv, memq/memv, string↔symbol, clock/*, time/*, money/*, quantity/*, list/friendly, stream/*, plus 20 escalate-shims for loam/system/cortex/voice/location/image/sakura/surface). Fixed by reverting `import { makeBaseEnv } from 'sakura-scheme'` back to Curator's local `./base.js` in the 21 files that need it. Follow-up: promote the neutral primitives upstream and factor the escalate-shims into a Curator-side installer.

## Files I couldn't move because they don't exist
None. All four docs and all five source files named in the task existed at the paths given.

## Notes for the architect loop
- sakura-scheme's `base.js` is a strict subset — the extraction seal claimed verbatim but drift is real. Called out in the `lang/finish-rewire` commit body.
- `runtime/dispatch.js` still carries Curator internals; Curator owns its copy per `sakura-scheme@1.4.0` CLAUDE.md. Correct; no action.
- Lane B/F untracked work in `sakura-scheme/site/` and `sakura-scheme/docs/book/` not touched.
- No `--no-verify`, no `--force`, no push to `main`. Both repos already had Lacuna-Labs origins.
