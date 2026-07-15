---
slug: scheme-runtime-features-plan-2026-07-10
title: Sakura Scheme runtime — 6 features to ship for the book (Q3 plan)
category: spec
kind: plan
status: draft
owner: Marcus
last-reviewed: 2026-07-10
---

# Sakura Scheme runtime — 6 features plan (Q3)

## Context

Alfred ruled (Q3, 2026-07-10): **ship all runtime features** rather than the split scope-down. Six primitives are called by Run buttons in book chapters 6, 8, 9, 10, 11, 14. None exist today. Reader hits Run, sees runtime error, loses trust in the book. This plan enumerates each feature so lanes can build them sequentially.

## The six features

| # | Feature | Used by chapter | Est. cycles | Integration file(s) |
|---|---|---|---|---|
| 1 | `define-record` (record type + accessors + predicate) | Ch 6 pattern matching intro | 2-3 | `src/interp.js` (special form) + `src/base.js` (record class) |
| 2 | `match` (pattern matching with literals, wildcards, list dest) | Ch 6 pattern matching | 3-4 | `src/interp.js` (special form) |
| 3 | `delay` / `force` / `await` (promises + async) | Ch 7 async | 3-4 | `src/base.js` (Promise wrapper) + `src/interp.js` (async point) |
| 4 | `guard` / `error` (typed exceptions + guard clauses) | Ch 8 error handling | 2-3 | `src/interp.js` (special form) + `src/base.js` (Error class) |
| 5 | `module` / `import` (namespaces + exports) | Ch 9 modules | 3-4 | `src/base.js` (module registry) + `src/reader.js` (form detect) |
| 6 | `sakura/complete` (auto-completion API for the REPL) | Ch 11 REPL super-features | 2 | `src/base.js` (verb list export) |

## Total estimate

- **Sum:** 15-20 lane cycles.
- **This pass:** feature 1 only (`define-record`) — smallest, no dependency on the others, unblocks Ch 6 partially.
- **Remaining:** 13-17 lane cycles across features 2-6.

## Ordering rationale

- `define-record` → `match` — records give match something interesting to destructure over. Ship records first so Ch 6 examples can be written iteratively.
- `guard`/`error` before `delay`/`force`/`await` — async needs a way to raise errors, and `guard` handles the sync case in Ch 8.
- `module`/`import` last of the "hard" features — it touches the reader, base library exports, and the REPL.
- `sakura/complete` — trivial once base is stable; a getter over the verb registry.

## Feature 1 — `define-record` (this pass)

### Spec

R7RS-lite record type:
```scheme
(define-record point x y)
;; expands to:
;;   - constructor:     (point x y) → record
;;   - predicate:       (point? obj) → boolean
;;   - accessors:       (point-x p) → number
;;                      (point-y p) → number
;;   - setter (opt):    (set-point-x! p new-x) → undefined
```

### Integration point

- Special form in `src/interp.js`. Added to `SPECIAL_FORMS`. Case handler calls a helper that:
  1. Reads `(define-record NAME field1 field2 ...)`.
  2. Defines a `Record` class instance for this type (small class, stored per-record in a hidden `_type` field).
  3. Binds `NAME` as the constructor, `NAME?` as the predicate, `NAME-FIELD` per field as accessor, `set-NAME-FIELD!` per field as setter.

### Test skeleton

`tests/interp.test.js` — add cases:
```js
test('define-record: basic', () => {
  const env = base()
  runProgram(env, '(define-record point x y) (define p (point 3 4)) (point-x p)')
  // expect 3
})

test('define-record: predicate', () => {
  runProgram(env, '(define-record point x y) (define p (point 3 4)) (point? p)')
  // expect true
})

test('define-record: setter', () => {
  runProgram(env, '(define-record point x y) (define p (point 3 4)) (set-point-x! p 10) (point-x p)')
  // expect 10
})
```

### Cycles

- Design + implement:      1 cycle
- Test + book Ch 6 verify: 1 cycle
- Optional r7rs alignment: 0.5 cycle

## Guardrails per feature build

- Every feature ships with tests in `tests/` matching the existing shape.
- Every feature bumps `CHANGELOG.md`.
- Every feature adds one program per accessor path to `docs/SAKURA-SCHEME-BOOK.md` at the right chapter.
- No feature is landed against `main` without CI green (`vitest run`).

## Not in scope for this plan

- Full R7RS compliance (see the R5RS/SICP compat memory slug — semantic-not-stylistic).
- The 20 escalate-shims (`loam/*`, `system/*`, `cortex/*`, `voice/*`, `location/*`, `image/*`, `sakura/*`, `surface/*`) — those stay Curator-side per D25 of the burndown.
- `define-macro` — Lane AB parked; not called by chapters 6-14 in the Q3 list, tracked separately.
