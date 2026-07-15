# Lane U — Sakura Scheme REPL Verification (2026-07-10)

Repo: `~/code/sakura-scheme/` @ `1.4.0`. Every row RAN.

## Level 0 — smoke

| Test | Expected | Actual | Verdict |
|---|---|---|---|
| `(+ 1 2)` | `3` | `3` | PASS |
| `(car '(1 2 3))` | `1` | `1` | PASS |
| `(cdr '(1 2 3))` | `(2 3)` | `(2 3)` | PASS |
| `(cons 'a '(b c))` | `(a b c)` | `(a b c)` | PASS |
| `(map (lambda (x) (* x x)) '(1 2 3))` | `(1 4 9)` | `error: Cannot create property 'n' on number '200000'` | **FAIL** |
| `(filter odd? '(1 2 3 4 5))` | `(1 3 5)` | `(1 3 5)` | PASS |
| `(let ((x 10) (y 20)) (+ x y))` | `30` | `30` | PASS |
| `(define (fact n) …) (fact 6)` | `720` | `720` | PASS |
| `(cond ((= 1 2) 'no) (else 'yes))` | `yes` | `yes` | PASS |
| `(begin (display "hi") (newline))` | prints `hi` | `error: unbound symbol: display` | **FAIL** |

## Level 1 — non-trivial

| Test | Expected | Actual | Verdict |
|---|---|---|---|
| Tail-loop 10 000 | `done` | `done` (no overflow) | PASS |
| `((lambda (f) (f 5)) (lambda (x) (* x 2)))` | `10` | `10` | PASS |
| `define-macro` swap! | works | `unbound symbol: define-macro` | **FAIL** (not impl) |
| `define-syntax`+`syntax-rules` swap! | `(2 1)` | `(2 1)` | PASS |
| `(guard (e ((error? e) 'caught)) …)` | `caught` | `unbound symbol: guard` | **FAIL** (not impl) |

## Level 2 — REPL meta-commands

REPL banner prints; readline over non-TTY streams doesn't fire, so I invoked
`META_COMMANDS[cmd].run(ctx, argv)` directly (same code path).

`,help / ,type / ,doc / ,arity / ,expand`: **PASS** when the verb is registered.
Bare `,help` prints `usage: ,help <verb>` — no global listing.
`,trace ,untrace ,watch ,inspect ,undo ,save ,load ,shell ,ask`: all print
`(… not yet implemented)`. Base primitives (`car`, `map`, …) are not
pre-registered, so `,help car` returns `unknown verb` from a fresh REPL.

## Level 3 — introspection API (from JS)

`import { help, describe, typeOf, arityOf, docOf, sourceOf }` — all exports
present, signatures match `PUBLIC-API.md`, return correctly-shaped hash-tables
**only if a verb is registered first**. Fresh process `snapshotRegistry()` size
is `0`, `help('car')` → `null`. `makeBaseEnv` populates the Env but not the
verb registry — every introspection surface is empty until a consumer wires it.

## Test suite

`npm test`: **4 files passed / 25 tests passed / 0 failed / 606 ms**
(interp 6 · introspect 6 · reader 7 · slat 6). Zero regressions.

## Declared-but-missing (docs vs. runtime)

- `display`, `newline`, `print` — §15.9 says "installed by the host"; the
  standalone CLI/REPL ships no host.
- `guard`, `error?`, `raise`, `error` — no error-handling verbs bound.
- `define-macro` — only `syntax-rules` shipped.
- Verb-registry entries for base primitives — zero.

## Bug (READ-ONLY: not fixed)

`src/base.js:68-74` — higher-order primitives (`for-each`, `map`, `filter`,
`reduce`, `apply`) close over the outer `fuel` param of `makeBaseEnv(fuel = 200000)`
and pass the RAW NUMBER into `apply()` as if it were `{n: …}`. `interp.js:282`
does `--fuel.n`, throwing `Cannot create property 'n' on number '200000'` the
moment the callback is a `Closure`. JS-function callbacks (`odd?`) bypass the
trampoline — that's why `filter odd?` passes and `map (lambda …)` fails. Same
failure for `for-each` / `reduce` / `(apply f xs)` / user-lambda `filter`.

## Verdict

**Not shippable to a beginner as-is.** `map` with a lambda throws an internal
error. Without `display`/`newline` a beginner cannot *see* output. And
`,help car` says `unknown verb`. Top-3 blockers:

1. **`fuel` boxing bug** in every higher-order primitive (`base.js:68-74`) —
   breaks `map` / `for-each` / `reduce` / `apply` on Closure callbacks.
2. **No `display` / `newline` in the standalone runtime** — §15.9 punts to a
   host that doesn't exist in the CLI.
3. **Empty verb registry for base primitives** — `,help`, `,doc`, `,arity`,
   CLI `help <verb>` all return null/`unknown`.

Runners-up: `define-macro` and `guard`/`error?` in docs are absent; bare
`,help` doesn't enumerate meta-commands.
