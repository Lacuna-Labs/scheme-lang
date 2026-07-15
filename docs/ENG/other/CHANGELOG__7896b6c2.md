# Changelog

All notable changes to Sakura Scheme are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- `src/slat-verbs.js` — the Book of SLAT primitive set as first-class Scheme verbs. Wires the minimum-viable ten: `slat-loads`, `slat-load`, `slat-load-doc`, `slat-dumps`, `slat-dump`, `slat-dump-doc`, `slat-read`, `slat-write`, `slat-key`, `load-community-cart`. Automatically installed by `makeBaseEnv` so every consumer picks them up without a follow-up install call. Also exported at the public API surface as `installSlatVerbs` and `SLAT_VERBS_META`. Closes BLOCKS-LAUNCH item #1 from PRE-LAUNCH-POLISH-BURNDOWN-2026-07-12 §2 — the Book of SLAT taught nine verbs that ZERO of the runtime exposed, which would have trained the model to call nonexistent verbs. Each verb bridges Sakura Scheme `Sym` values to slat `SlatValue` at the boundary, returns error records instead of throwing (honest-null pattern), and applies the Vote-1 structured-dispatch wrapper (tightened to check the head Sym.name matches the verb name — slat verbs legitimately receive Sym-headed arrays as data, unlike Curator verbs). `load-community-cart` is a clean stub that returns `(error :kind not-yet-implemented …)` — Book of SLAT §16 marks the community-registry surface as forward-looking; the stub exists so calls don't hard-crash before the registry lands.
- `tests/slat-verbs.test.js` — 48 tests covering all ten verbs (basic / edge / round-trip triples), byte-stable canonical form, the Book of SLAT's canonical round-trip property, registration metadata, and installer guardrails.

## [1.4.0] — 2026-07-09

### Added
- Initial extraction of the Sakura Scheme language runtime from Curator.
- `src/reader.js` — tokenizer + parser + source-position map + LRU AST cache.
- `src/interp.js` — tree-walking evaluator, `Env`, `Closure`, TCO trampoline, fuel budget.
- `src/base.js` — 125 primitives (arithmetic, list, string, R7RS subset, plus 8 `artifact/*` headless stubs added in the Phase-A artifact wiring). The count is measured directly against `src/base.js`: 117 unique non-artifact primitive names (some verbs like `eq?` / `equal?` are defined twice as aliases; second definition wins) plus 8 `artifact/*` verbs registered as headless stubs and re-installed by the browser-side surface at `site/apps/hello-surface/artifact/verbs.js`.
- `src/macro.js` — hygienic `syntax-rules` + `define-macro`.
- `src/verbRegistry.js` — verb metadata format + validation.
- `src/introspect.js` — `help`, `describe`, `typeOf`, `arityOf`, `docOf`, `sourceOf`.
- `src/repl.js` — REPL machinery with meta-command dispatch table.
- `src/cli.js` — bash CLI with `repl` / `eval` / `run` / `help` / `docs` / `version` / `slat` subcommands.
- `src/docs-emitter.js` — verb metadata → Markdown reference emitter.
- `src/slat.js` — thin re-export of the JS slat binding.
- `bin/sakura-scheme` — shebang stub.
- `bindings/js/slat.js` — canonical JS slat reader / writer.
- `bindings/python/` — Python slat binding, mirrored from `~/code/forge/forge/corpus/slat_*.py`.
- Public API surface documented in `PUBLIC-API.md`.
- The Sakura Scheme Book (`docs/SAKURA-SCHEME-BOOK.md`).

### Changed
- `base.js` no longer depends on Curator's `bricklayCache` — the `bricklay-pack-native` primitive still returns correct results, it just re-packs every call. A future Curator-side wrapper can memoize.
- `interp.js` imports `verbRegistry` from a sibling path (`./verbRegistry.js`) instead of the old `./runtime/verbRegistry.js`.

### Deferred
- `src/dispatch.js` was extracted with the six-file cut but is not exported from `src/index.js` for v1.4.0. The file has hard imports of Curator internals (logbus, card-api, canvasPower, chipSink, chipEvent, chatChipBus, eventLog, correlationContext) and needs a partial carve-out — core dispatcher (~500 LOC) split from Curator-specific security policy (~350 LOC). Curator continues to import its own copy at `curator-web/src/scheme/runtime/dispatch.js`. Queued as a follow-up sprint.
