# Slat — specification

Slat is a line-delimited S-expression serialization format used across Lacuna for logs, event streams, and structured records that need to survive tail-ing, grepping, and diffing.

## Rules

- One complete `(form ...)` per line. Newlines inside a form are illegal.
- Whitespace outside strings is not significant.
- Comments: `;` to end of line, `#| ... |#` block form (single-line only).
- Every atom fits on one line.

## Value kinds

| Kind | Syntax | Example |
|---|---|---|
| symbol | bare identifier | `foo`, `card/open` |
| keyword | `:foo` | `:ts` |
| integer | decimal integer | `42`, `-17` |
| float | decimal with `.` or exponent | `3.14`, `1e5` |
| rational | `n/d` | `1/2` |
| string | `"..."` with `\n \t \r \\ \"` escapes | `"hi"` |
| boolean | `#t` or `#f` | `#t` |
| nil | `nil` | `nil` |
| char | `#\name` | `#\space` |
| list | `( ... )` | `(1 2 3)` |
| form | list with head symbol | `(event :ts 42)` |

## Canonical forms

A list whose head is a symbol is canonicalized into a dict with:

- `_form`: the head symbol name
- one key per `:keyword value` pair
- `_positional`: an array of every non-keyword arg after the head

Nested forms recurse. Bare lists (no leading symbol) stay as arrays.

## Round-trip

For any dict `d` produced by `loads(...)`, `loads(dumps(d))` equals `d` (modulo `Fraction` normalization and structural-sharing expansion).

## Bindings

- JavaScript: `bindings/js/slat.js` — see `slatLoads`, `slatDumps`.
- Python: `bindings/python/slat/` — see `loads`, `dumps`.

Both bindings share fixture vectors under `tests/vectors.slat` and are round-trip verified in CI.

## Related

- [Grammar](./GRAMMAR.md) — formal grammar in EBNF.
- [Examples](./EXAMPLES.md) — real-world slat lines.
