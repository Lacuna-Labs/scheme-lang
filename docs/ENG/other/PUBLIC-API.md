# Public API

Only what `src/index.js` re-exports is public. Everything else in `src/` is internal and may change without a version bump.

Version: `1.4.0`.

## Reader

From `sakura-scheme` (backed by `src/reader.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `Sym` | class | S-expression symbol node. |
| `sym(name)` | function | Intern a symbol by name. |
| `parse(src)` | function | Tokenize + parse; returns an array of forms. LRU-cached by source string. |
| `posOf(form)` | function | Look up `{line, col}` for a list form. |
| `tagPos(form, pos)` | function | Attach a position record to a list form. |
| `ReadError` | class | Thrown on malformed source. |
| `tokenize(src)` | function | Public tokenizer — used by tests and by slat. |
| `clearParseCache()` | function | Test seam. |
| `parseCacheStats()` | function | Hit/miss counters. |

## Interpreter

From `sakura-scheme` (backed by `src/interp.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `Env` | class | Nested environment; `define`, `set`, `lookup`. |
| `Closure` | class | User-defined function. |
| `evaluate(form, env, fuel)` | function | Trampolined evaluator. `fuel` is `{ n: budget }`. |
| `apply(fn, args, fuel)` | function | Apply a callable to args. |
| `__resetMissingPermWarnings()` | function | Test seam. |

## Base library

From `sakura-scheme` (backed by `src/base.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `makeBaseEnv(fuel)` | function | Return a fresh `Env` with the base vocabulary bound. |

## Macros

From `sakura-scheme` (backed by `src/macro.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `MacroTable` | class | Per-program macro table. |
| `expandTop(forms, opts)` | function | Expand once. |
| `expandProgram(forms, opts)` | function | Full expansion; returns `{ forms, fuelUsed }`. |
| `__resetGensym()` | function | Test seam. |

## Verb registry

From `sakura-scheme` (backed by `src/verbRegistry.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `CANONICAL_PERMS` | array | Frozen list of allowed `:perm` values. |
| `CANONICAL_POWER_TIERS` | array | Frozen list of allowed `:tier` values. |
| `CANONICAL_CHIP_KINDS` | array | Frozen list of chip event kinds. |
| `defaultMetaFor(name)` | function | Best-guess metadata for a name. |
| `registerVerbMeta(name, meta)` | function | Register or extend metadata for a verb. |
| `getVerbMeta(name)` | function | Look up metadata by name. |
| `hasVerb(name)` | function | Existence check. |
| `validateRegistry(opts)` | function | Warn on missing docs/examples; throw on missing perms. |
| `snapshotRegistry()` | function | Copy of the current table for tests / introspection. |
| `__resetRegistry()` | function | Test seam. |

## Introspection

From `sakura-scheme` (backed by `src/introspect.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `help(name)` | function | Return the full metadata blob as a plain object. |
| `describe(name)` | function | Return a short human description. |
| `typeOf(name)` | function | Return the contract string. |
| `arityOf(name)` | function | Return the arity (scalar or `[min, max]`). |
| `docOf(name)` | function | Return the docstring alone. |
| `sourceOf(name)` | function | Return the source path. |

## REPL

From `sakura-scheme` (backed by `src/repl.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `startRepl(opts)` | async function | Start an interactive REPL. |

## Doc emitter

From `sakura-scheme` (backed by `src/docs-emitter.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `emitDocs(opts)` | async function | Emit MD files (one per verb) into `opts.outDir`. |

## Slat

From `sakura-scheme` (backed by `src/slat.js` → `bindings/js/slat.js`).

| Symbol | Kind | Purpose |
|---|---|---|
| `slatLoads(src)` | function | Parse slat text into JS values. |
| `slatDumps(obj)` | function | Serialize a JS value to a slat line. |
| `slatToJsonl(text)` | function | Convert slat → JSONL. |
| `jsonlToSlat(text)` | function | Convert JSONL → slat. |
| `SlatValue` | class | Tagged sentinel for symbols / keywords / rationals / chars. |
| `installSlatVerbs(env)` | function | Bind the ten Book-of-SLAT verbs (`slat-loads`, `slat-load`, `slat-load-doc`, `slat-dumps`, `slat-dump`, `slat-dump-doc`, `slat-read`, `slat-write`, `slat-key`, `load-community-cart`) into the given Scheme env. Idempotent. `makeBaseEnv` already calls this; consumers building an env by hand can call it directly. |
| `SLAT_VERBS_META` | array | Metadata roster for the ten slat verbs — used by doc emitters and RAG indexers to enumerate the surface without touching an env. |

## Version

| Symbol | Kind | Purpose |
|---|---|---|
| `VERSION` | string constant | `'1.4.0'`. |

## Deferred

`dispatch` is NOT exported for v1.4.0. See `CLAUDE.md` and `CHANGELOG.md` for the reason. It stays inside Curator until a carve-out sprint splits the core dispatcher from the Curator-specific security policy.
