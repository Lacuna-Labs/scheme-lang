# CLAUDE.md — Sakura Scheme

Per-repo agent guidance. This is the language repo; be careful and precise.

## What this repo is

Sakura Scheme is a Scheme dialect written in JavaScript. It was extracted from Curator on 2026-07-09 to become the shared language runtime for every Lacuna consumer (Curator, Lacuna, Gastronomy Graph, Forge).

The engine is small (~2,000 LOC), hermetic (no dependency on any consumer), and the six extracted files preserve their full commit history from Curator.

## What to change here vs. downstream

- **Language semantics** (reader, evaluator, macros, base library) — change here.
- **Verb metadata format** — change here.
- **REPL / CLI / doc-emitter** — change here.
- **Slat format spec** — change here (see `docs/slat/`).
- **Verbs specific to Curator or Lacuna** — change in the consumer's verb layer, NOT here.

If a verb is dialect-neutral (both consumers want it, same signature, same semantics), file an issue for promotion into the base library. Promotion is a minor version bump.

## Public API surface

Only what `src/index.js` re-exports is public. Everything else is internal and may change without a version bump. See `PUBLIC-API.md` for the full list.

## Version discipline

Semantic versioning. Every change to `src/index.js` needs a `CHANGELOG.md` entry. Patch bumps for bugfixes, minor for additions, major for breaking changes.

## Testing

`npm test` runs the vitest suite. `npm run test:fast` is the same suite in dot-reporter mode. Cross-binding slat round-trip is under `tests/slat.test.js` and mirrors `bindings/python/tests/`.

## Docs

The Book (`docs/SAKURA-SCHEME-BOOK.md`) is the canonical reference. Every chapter has runnable examples. When you add or change a language feature, update the Book — the Book is the source, not this file.

## Notes on the extraction

The dispatch layer (`src/dispatch.js`) currently retains hard imports of Curator internals (logbus, card-api, canvasPower, chipSink, chipEvent, chatChipBus, eventLog, correlationContext). Cleanly extracting it requires splitting the core dispatcher (~500 LOC) from the Curator-specific security policy (~350 LOC). That carve-out is queued as a follow-up sprint. For v1.4.0, `dispatch.js` lives in the repo (history preserved) but is **not** exported from `src/index.js` — Curator continues to import its own copy at `curator-web/src/scheme/runtime/dispatch.js`.
