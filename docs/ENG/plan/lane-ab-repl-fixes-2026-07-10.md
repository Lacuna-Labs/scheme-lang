# Lane AB — REPL bug fixes (2026-07-10)

Fixed the three REPL bugs Lane U's audit surfaced in `~/code/sakura-scheme`. Language now shippable to a beginner.

## Bug 1 — Fuel-boxing in `map` / `filter` / `reduce` / `apply` / `for-each`

**Files touched:** `src/base.js`

**Diff summary:** Higher-order primitives at lines 68-74 captured `fuel` as a raw number from `makeBaseEnv(fuel)` and passed it into `apply()`, which threads the interpreter's boxed `{n: number}` and decrements via `--fuel.n`. JS-function callbacks skipped the trampoline so `filter odd?` worked, but any lambda callback threw `Cannot create property 'n' on number '200000'`. Fix: box the fuel budget once at `makeBaseEnv` entry — `const fuelBox = (typeof fuel === 'number') ? { n: fuel } : fuel` — and route all 10 call sites (`for-each`, `map`, `filter`, `reduce`, `apply`, `any`, `every`, `count`, `list-index`, `sort`) through `fuelBox`. Same shape the rest of the interp already uses.

**Test added:** `tests/repl-fixes.test.js` — 6 cases: `map`, `for-each`, `reduce`, `apply`, `filter`, `sort` each with a lambda callback.

## Bug 2 — `display` and `newline` unbound

**Files touched:** `src/base.js`

**Diff summary:** Added both primitives writing to `process.stdout`. `display` prints values with strings unquoted (R7RS §6.13.3 — the contract that distinguishes it from `write`); `newline` writes `\n`. Both return void so a top-level `(display "hi")` doesn't echo a bogus `=> ...` line. Local `_displayFormat` helper handles the reader-visible spellings for `#t` / `#f` / `()` and recurses into lists.

**Test added:** 5 cases — display of string, number, list; newline alone; the `(begin (display "hi") (newline))` composite from the task spec.

## Bug 3 — Empty base verb registry

**Files touched:** `src/base.js`

**Diff summary:** Added `BASE_META` manifest for ~90 base primitives (arithmetic, comparisons, predicates, list ops, higher-order, strings, I/O, randomness). Each entry ships `name`, `arity` (scalar or `[min, max]`), `doc`, one novice `example`, and a `namespace`. Registration runs at module-load time (not inside `makeBaseEnv`) so the CLI's `sakura-scheme help car` path works before any `Env` exists — the CLI's `help` command never touches the evaluator.

**Test added:** 3 cases — `help('car')` returns full metadata; every core primitive (`+`, `-`, `*`, `/`, `car`, `cdr`, `cons`, `list`, `map`, `filter`, `reduce`, `apply`, `display`, `newline`) has non-empty doc + at least one example; unknown verb still returns `null`.

## `npm test` result

**39 passed** (was 25). New file `tests/repl-fixes.test.js` adds 14 tests; the original 25 in `interp` / `introspect` / `reader` / `slat` all still pass.

## Optional bugs status

- **`define-macro`** — HOLD. Requires wiring a new special form through the macro expander in `src/macro.js`; well past the 30-line budget. Existing `define-syntax` + `syntax-rules` covers most macro needs.
- **`guard` / `error?`** — HOLD. R7RS §6.11 exception system needs a handler-stack threaded through `evaluate` + `apply` and continuation plumbing that doesn't fit the "small addition" bar.

## Sample verification

```
$ bin/sakura-scheme eval '(map (lambda (x) (* x x)) (list 1 2 3))'
(1 4 9)
$ bin/sakura-scheme eval '(begin (display "hi") (newline))'
hi
$ bin/sakura-scheme help car
car  —  The first element of a non-empty list.
Arity:    1
```

## PR URL

https://github.com/Lacuna-Labs/sakura-scheme/pull/18

## Verdict

**REPL now works for a beginner.** The three blockers Lane U found are gone; `(map (lambda …) …)` runs, `(display "hi")` prints, `,help car` shows real metadata. `define-macro` and `guard` are proper follow-up lanes — not floor-level ergonomics blockers.
