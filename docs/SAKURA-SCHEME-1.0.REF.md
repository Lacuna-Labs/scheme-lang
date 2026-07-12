# Sakura Scheme 1.0 — Reference Manual

> **🔒 ARCH LOCK 2026-06-22** — verb-by-verb additions for the new arch
> (~150 ASK verbs from Lane A §93.4 + FRP time grammar §95 MOVE 3 +
> unified memory §95 MOVE 4) land here as those MOVES ship. See
> `HELLO-SURFACE-1.0-ENGINEERING.md` §95 for the methodology lock and
> execution order.
>
> Lane B · Soo-Jin · 2026-06-15
>
> The canonical, alphabetised, per-verb reference. Every primitive, macro,
> reserved form, and atom in Sakura Scheme. Each entry carries the
> implementation backing (file:line), the verb's honest wired/partial/no
> state, three graded examples (novice / intermediate / expert), and
> source citations or honest `;; generated example` flags.
>
> A generated example is still real — it uses our sprite roster, real
> cards, real verbs, and would lint clean under `cartLint.js` and run
> against the runtime installed in `curator-web/src/scheme/index.js`.
>
> **SRE pass — 2026-06-22 — line-citation drift advisory.** Many `Backing:
> file:Line-Line` citations in §1 (reserved forms) were authored against
> `curator-web/src/scheme/interp.js` at the 2026-06-15 head; the file has
> since drifted by ~30 lines (cases moved + comments inserted). The
> CONTENT remains accurate — the switch in `evalStep` still contains
> `case 'if'`, `case 'define'`, `case 'lambda'`, `case 'begin'`, `case
> 'cond'`, `case 'case'`, `case 'and'`, etc., in that order — but the
> exact line numbers are NOT current. Authoritative at HEAD (2026-06-22):
> `case 'if': 292` · `'define': 297` · `'lambda': 313` · `'begin': 329`
> · `'and': 385` · `'cond': 409` · `'case': 423`. The structural
> citations are still load-bearing; reviewers should `grep -n "case '<name>'"
> curator-web/src/scheme/interp.js` to confirm before quoting a line
> number externally. Future re-cuts: bump line numbers in this doc with
> every interp.js edit (the LLM training corpus must not memorize stale
> line numbers).
>
> **Citation format used in this doc:** `` `curator-web/src/scheme/<file>:Line[-Line]` `` (back-tick-quoted, hyphen-range for multi-line spans). The SRE pass at the HelloSurface doc adopted `` `file:Line · functionName()` `` (dot-separator) — both forms are honored; the dot-separator is preferred for new entries.

---

## Navigation

1. [Reserved forms & special syntax](#1-reserved-forms--special-syntax)
2. [List + sequence primitives](#2-list--sequence-primitives)
3. [Math + numeric](#3-math--numeric)
4. [Cart spine](#4-cart-spine)
5. [Cortex verbs](#5-cortex-verbs)
6. [Marketplace verbs](#6-marketplace-verbs)
7. [Paint + visual primitives](#7-paint--visual-primitives)
8. [Sprite + body verbs](#8-sprite--body-verbs)
9. [Note + music verbs](#9-note--music-verbs)
10. [FX + animation atoms](#10-fx--animation-atoms)
11. [Card surface verbs](#11-card-surface-verbs)
12. [Sakura on-device verbs](#12-sakura-on-device-verbs)
13. [New-arch placeholders (§95 MOVES 3 / 4 / 5)](#13-new-arch-placeholders)
14. [Approval](#approval)

---

## 1. Reserved forms & special syntax

These are handled directly by the evaluator's `evalStep` switch. They
are NOT functions — they cannot be redefined, passed as values, or
captured. They are the irreducible spine of the language.

**Backing for all entries in §1:** `curator-web/src/scheme/interp.js:250-410`.
**Side effects:** none on the form itself; the body it evaluates may
have effects.
**Wired:** yes (all 15, hand-written tail-call-eliminated cases).

### `(and expr1 expr2 ...)`

**Returns:** the last truthy value, or `#f` if any is false. Last
position is tail.
**Backing:** `curator-web/src/scheme/interp.js:354-361`
**Side effects:** evaluates left-to-right and short-circuits.
**Wired:** yes

Short-circuit conjunction. Stops at the first `#f`; otherwise returns
the value of the final expression. In tail position, the last conjunct
is itself in tail position.

#### Novice
```scheme
;; gate on a precondition
(and (pair? topics) (not (null? topics)))
;; → #t when both hold
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks` (predicate idiom — generated example)*

#### Intermediate
```scheme
;; only proceed if shop is connected AND has listings
(if (and (ctx-get 'shop-connected ctx)
         (pair? (ctx-result ctx)))
    (next 'render ctx)
    (escalate 'shop-not-connected null))
```
*;; generated example*

#### Expert
```scheme
;; compose three gates; the deepest pair? is the determining tail
(when (and (eq? (ctx-get 'state ctx) 'ready)
           (not (null? rows))
           (pair? (assq ':price_ladder_suggestion rows)))
  (next 'render (ctx-set 'finding rows ctx)))
```
*;; generated example*

---

### `(begin expr1 expr2 ... lastExpr)`

**Returns:** the value of the last expression.
**Backing:** `curator-web/src/scheme/interp.js:298-303`
**Side effects:** evaluates each expression in order; last is tail.
**Wired:** yes

Sequential composition. Earlier expressions are evaluated for side
effects; the result of the last is returned. The lint star expects most
multi-effect bodies to live inside `(begin …)` or an implicit body
position.

#### Novice
```scheme
;; two effects, then done
(begin
  (table rows '(listing-id title metric value))
  (done))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:36-38`*

#### Intermediate
```scheme
;; in a cart render — emit chip, queue envelope, end
(begin
  (card-emit 'engine 'the-living-business-plan-ready (length finding))
  (envelope-queue (list 'the-living-business-plan ':finding finding))
  (done))
```
*Source: adapted from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

#### Expert
```scheme
;; tail position — the trailing (done) is the cart's terminal descriptor
(let ((finding (ctx-get 'finding ctx)))
  (begin
    (paint-arrow 'price-ladder-card ':anchors anchors ':glow 'warm-amber)
    (envelope-queue (list 'pink-price-ladder-suggest ':finding finding))
    (done)))
```
*Source: condensed from `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-289`*

---

### `(case key (datums body...) ... (else body...))`

**Returns:** the value of the chosen clause's last form.
**Backing:** `curator-web/src/scheme/interp.js:392-407`
**Side effects:** evaluates the key once; matches by `===` on numbers
and by symbol name on Syms.
**Wired:** yes

Discrete dispatch on a key. Each clause head is a list of possible
matches; `else` catches the rest. Tail position is the last form of
the chosen clause.

#### Novice
```scheme
;; route a Loam state symbol to a path
(case state
  ((vacation paused) (escalate 'state-blocks-spend state))
  ((no-new-data)     (escalate 'state-blocks-spend 'no-new-data))
  (else              (next 'fetch-actuals ctx)))
```
*;; generated example*

#### Intermediate
```scheme
;; classify a marketplace response
(case status
  ((connected)        (next 'fetch ctx))
  ((not-connected)    (escalate 'service-not-connected null))
  ((quota-exhausted)  (escalate 'answers-quota null))
  (else               (escalate 'service-not-yet-wired null)))
```
*;; generated example, modelled on `curator-web/src/scheme/carts/personal/daily-news-brief.sks:118-125`*

#### Expert
```scheme
;; tier branch into three sub-state-machines
(define (route ctx)
  (case (ctx-get 'tier ctx)
    ((free imagine)  (next 'render-cheap ctx))
    ((dream)         (next 'render-mid ctx))
    ((magic)         (next 'render-full ctx))
    (else            (escalate 'tier-unknown null))))
```
*;; generated example*

---

### `(cond (test body...) ... (else body...))`

**Returns:** the value of the chosen clause's last form.
**Backing:** `curator-web/src/scheme/interp.js:378-391`
**Side effects:** evaluates tests left-to-right; first truthy wins.
**Wired:** yes

Multi-way branching. The bread-and-butter of every cart's state-check
function. Tail position is the last form of the chosen clause.

#### Novice
```scheme
;; null = no-data; rate-limited = back off; else proceed
(cond
  ((null? rows)              (escalate 'no-data null))
  ((eq? rows 'rate-limited)  (after 30 'fetch ctx))
  (else                      (next 'render ctx)))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:33-37`*

#### Intermediate
```scheme
;; classify a Loam state result
(cond
  ((null? state)                       (escalate 'cortex-not-ready null))
  ((eq? (assq 'vacation state) #t)     (escalate 'state-blocks-spend 'vacation))
  ((eq? (assq 'paused state) #t)       (escalate 'state-blocks-spend 'paused))
  ((eq? (assq 'no-new-data state) #t)  (escalate 'state-blocks-spend 'no-new-data))
  (else                                (next 'check-cortex-cache (ctx-set 'state state ctx))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:117-128`*

#### Expert
```scheme
;; closed-set finding validator — every tag explicit, no catch-all
(cond
  ((null? finding)
     (escalate 'service-not-yet-wired
               '(:status not-wired :reason "lacuna-session-returned-null")))
  ((eq? finding 'rate-limited)        (after 120 'lacuna-ask ctx))
  ((eq? finding 'quota-exhausted)
     (escalate 'answers-empty
               '(:status not-wired :reason "lacuna-quota-exhausted")))
  ((eq? finding 'cloud-tier-required)
     (escalate 'service-not-connected
               '(:status not-wired :reason "deep-reasoning-requires-magic-tier")))
  ((not (pair? finding))
     (escalate 'sakura-garbled
               '(:status not-wired :reason "lacuna-returned-non-list")))
  (else (next 'remember (ctx-set 'finding finding ctx))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:265-283`*

---

### `(define name expr)` and `(define (name args...) body...)`

**Returns:** undefined (effect: binds the name in the current Env).
**Backing:** `curator-web/src/scheme/interp.js:266-278`
**Side effects:** mutates the env's variable map.
**Wired:** yes

Two shapes: value binding `(define x 7)` or procedure shorthand
`(define (f a b) body)`. The procedure form supports dotted-tail
rest params: `(define (f a b . rest) …)`.

#### Novice
```scheme
;; the cart's entry state — every cart has this
(define (start ctx)
  (next 'fetch ctx))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:22-26`*

#### Intermediate
```scheme
;; helper that wraps a Cortex window key
(define (window-key topic) (list ':topic topic ':window 'now))

(define (start ctx)
  (act 'cortex/recall (list (window-key 'living-plan-checkpoint)) 'check-prior))
```
*;; generated example*

#### Expert
```scheme
;; mutually recursive state functions with closed switching
(define (fetch ctx)
  (act 'etsy/receipts (list 'this-week) 'check-actuals))

(define (check-actuals ctx)
  (let ((receipts (ctx-result ctx)))
    (cond
      ((null? receipts)           (escalate 'actuals-unavailable null))
      ((eq? receipts 'rate-limited) (after 60 'fetch ctx))
      (else (next 'fetch-ledger (ctx-set 'receipts receipts ctx))))))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:157-178`*

---

### `(if test then else)`

**Returns:** `then` if test is not `#f`, else `else` (or undefined).
**Backing:** `curator-web/src/scheme/interp.js:261-265`
**Side effects:** evaluates test eagerly; chosen branch in tail position.
**Wired:** yes

Two- or three-arm conditional. Anything but `#f` is true (R7RS).
Prefer `cond` for more than two arms; lint reads bare `if` as fine
for binary gates.

#### Novice
```scheme
(if (null? rows)
    (escalate 'no-data null)
    (next 'render ctx))
```
*;; generated example*

#### Intermediate
```scheme
;; cache hit shortcuts; miss goes to fetch
(define (check-today ctx)
  (let ((cached (ctx-result ctx)))
    (if (null? cached)
        (next 'recall-topics ctx)
        (next 'render-cached (ctx-set 'cached cached ctx)))))
```
*Source: adapted from `curator-web/src/scheme/carts/personal/daily-news-brief.sks:82-87`*

#### Expert
```scheme
;; nested if as guard chain (cond is usually clearer — kept here for an honest example)
(if (eq? (ctx-get 'tier ctx) 'magic)
    (if (>= (length deltas) 12)
        (next 'assemble-quarter-memo ctx)
        (next 'accrue-week ctx))
    (escalate 'tier-not-permitted null))
```
*;; generated example*

---

### `(lambda (params...) body...)`

**Returns:** a Closure (a callable Scheme value).
**Backing:** `curator-web/src/scheme/interp.js:282-297`
**Side effects:** captures the current env by reference.
**Wired:** yes

Anonymous procedure. Supports fixed-arity `(lambda (a b) …)`, full
variadic `(lambda args …)`, and dotted-tail `(lambda (a . rest) …)`.
**Cart lint forbids inline lambdas as on-result arguments to `act`** —
the on-result must be a quoted symbol so the cart is replayable.

#### Novice
```scheme
;; map a name out of a row list
(map (lambda (row) (assq 'title row))
     rows)
```
*;; generated example*

#### Intermediate
```scheme
;; fold receipts into a revenue sum
(reduce (lambda (acc r) (+ acc (assq 'amount r)))
        0
        receipts)
```
*;; generated example*

#### Expert
```scheme
;; closure over local state — variadic accumulator
(let ((seen '()))
  (filter (lambda args
            (let ((id (car args)))
              (if (member id seen)
                  #f
                  (begin (set! seen (cons id seen)) #t))))
          listings))
```
*;; generated example (note: variadic args via `(lambda args …)` form, interp.js:290-292)*

---

### `(let ((name expr) ...) body...)` and named-let `(let loop ((n v) ...) body...)`

**Returns:** the value of the last body expression.
**Backing:** `curator-web/src/scheme/interp.js:304-323`
**Side effects:** none beyond evaluating the bindings + body.
**Wired:** yes

Local bindings. Initialisers see the OUTER env. Named-let creates a
recursive helper closure and tail-calls it once — the standard
Scheme iteration pattern.

#### Novice
```scheme
(let ((cached (ctx-result ctx)))
  (if (null? cached)
      (next 'fetch ctx)
      (next 'render-cached (ctx-set 'cached cached ctx))))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:82-87`*

#### Intermediate
```scheme
;; pull two ctx values, build a paint call
(let ((anchors    (ctx-get 'anchors ctx))
      (copy-lines (ctx-get 'copy-lines ctx)))
  (paint-arrow 'price-ladder-card
               ':anchors anchors
               ':labels  copy-lines
               ':glow    'warm-amber))
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-283`*

#### Expert
```scheme
;; named let — iterate over a list with an index
(let loop ((items items) (i 0) (out '()))
  (if (null? items)
      (reverse out)
      (loop (cdr items)
            (+ i 1)
            (cons (list i (car items)) out))))
```
*;; generated example (tail-call-eliminated; uses interp.js:304-317 TCO bounce)*

---

### `(let* ((name expr) ...) body...)`

**Returns:** the value of the last body expression.
**Backing:** `curator-web/src/scheme/interp.js:324-330`
**Side effects:** sequential — each binding sees the prior.
**Wired:** yes

Sequential binding. Each initialiser is evaluated in the env including
all earlier bindings. Use when later bindings depend on earlier ones.

#### Novice
```scheme
(let* ((a 1)
       (b (+ a 2)))
  b)
;; → 3
```
*;; generated example*

#### Intermediate
```scheme
(let* ((receipts (ctx-get 'receipts ctx))
       (revenue  (sum (map (lambda (r) (assq 'amount r)) receipts))))
  (next 'render (ctx-set 'revenue revenue ctx)))
```
*;; generated example*

#### Expert
```scheme
;; layer ctx, derive feature, derive decision
(let* ((topics  (ctx-get 'topics ctx))
       (top-3   (take topics 3))
       (batched (act 'web-search (list 'top-headline-batch top-3) 'check-fetch)))
  batched)
```
*;; generated example, modelled on `curator-web/src/scheme/carts/personal/daily-news-brief.sks:133-137`*

---

### `(not value)`

**Returns:** `#t` if value is `#f`, else `#f`.
**Backing:** `curator-web/src/scheme/base.js:42`
**Side effects:** none.
**Wired:** yes (base primitive; not actually a special form)

Logical negation. Only `#f` is false; everything else is true.

#### Novice
```scheme
(not (null? topics))
;; → #t if topics is non-empty
```
*;; generated example*

#### Intermediate
```scheme
(when (not (eq? state 'paused))
  (next 'fetch ctx))
```
*;; generated example*

#### Expert
```scheme
;; closed cond: explicit "not connected" arm rather than a negated catch-all
(cond
  ((eq? status 'connected)            (next 'fetch ctx))
  ((not (eq? status 'connected))      (escalate 'service-not-yet-wired null)))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:118-125`*

---

### `(or expr1 expr2 ...)`

**Returns:** the first truthy value, or `#f`.
**Backing:** `curator-web/src/scheme/interp.js:362-369`
**Side effects:** short-circuits left-to-right.
**Wired:** yes

Short-circuit disjunction. Returns the first non-`#f` value (which is
NOT necessarily `#t`). In tail position, the last disjunct is itself
in tail.

#### Novice
```scheme
;; pick the first present field
(or (assq ':override ctx)
    'no-override)
```
*;; generated example*

#### Intermediate
```scheme
;; fallback chain
(let ((from (or (ctx-get 'shop-id ctx)
                (ctx-get 'default-shop ctx)
                'unknown-shop)))
  (act 'etsy/listings (list from) 'render))
```
*;; generated example*

#### Expert
```scheme
;; guard with side-effect-free fallback
(if (or (eq? status 'rate-limited)
        (eq? status 'quota-exhausted))
    (after 60 'fetch ctx)
    (next 'check-fetch ctx))
```
*;; generated example*

---

### `(quote datum)` and `'datum`

**Returns:** the datum unevaluated.
**Backing:** `curator-web/src/scheme/interp.js:259-260`
**Side effects:** none.
**Wired:** yes

Prevents evaluation. The reader expands `'x` to `(quote x)`. The
cart-lint star REQUIRES on-result args to `act` to be quoted symbols —
they ride through unevaluated and the driver reads them at dispatch.

#### Novice
```scheme
;; symbol literal
(act 'cortex/recall (list '(:topic news-brief :date today)) 'check-today)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:76`*

#### Intermediate
```scheme
;; a quoted alist that survives untouched into Cortex
(act 'cortex/remember
     (list '(:topic living-plan-checkpoint) finding)
     'render)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:302-306`*

#### Expert
```scheme
;; nested quote — the alist contains keyword markers and a quoted symbol
(escalate 'service-not-yet-wired
          '(:status not-wired :reason "lacuna-session-returned-null"))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:268-270`*

---

### `(quasiquote tmpl)` `` `tmpl `` and `(unquote x)` `,x`

**Returns:** the template with unquoted slots evaluated.
**Backing:** `curator-web/src/scheme/interp.js:344-345` + `quasiExpand`
**Side effects:** evaluates only the unquoted holes.
**Wired:** yes

Template syntax for building data with computed slots. Backtick keeps
the structure quoted; `,x` evaluates `x` and splices its value in.

#### Novice
```scheme
;; build a list with one computed value
`(:status ok :count ,n)
;; → (:status ok :count 7) when n is 7
```
*;; generated example*

#### Intermediate
```scheme
;; envelope with operator-derived fields
(envelope-queue
  `(daily-news-brief
    :scout    "the analyst"
    :one-liner ,(ctx-get 'one-liner ctx)
    :rows     ,rows))
```
*;; generated example*

#### Expert
```scheme
;; assemble a Cortex landing shape with multiple computed fields
(act 'cortex/remember
     (list `(:topic the-living-business-plan
             :window now
             :delta  ,finding
             :score  ,(score-of finding))
           finding)
     'render)
```
*;; generated example*

---

### `(set! name value)`

**Returns:** undefined (effect: mutates an existing binding).
**Backing:** `curator-web/src/scheme/interp.js:279-281`
**Side effects:** mutates the env binding.
**Wired:** yes

Mutates an EXISTING binding. Throws on an unbound name. Substrate-
frozen names (the built-in verb roster) reject `set!` post-freeze —
that's the protective wall in `Env.set` interp.js:70-82.

#### Novice
```scheme
(define counter 0)
(set! counter (+ counter 1))
;; → counter is now 1
```
*;; generated example*

#### Intermediate
```scheme
;; close over a counter in a higher-order pass
(let ((seen 0))
  (for-each (lambda (r) (set! seen (+ seen 1)))
            rows)
  seen)
```
*;; generated example*

#### Expert
```scheme
;; mutate-in-closure pattern (rare — prefer pure ctx threading)
(define (make-counter)
  (let ((n 0))
    (lambda ()
      (set! n (+ n 1))
      n)))
(define tick (make-counter))
(tick) (tick) (tick)
;; → 3
```
*;; generated example*

---

### `(unless test body...)`

**Returns:** the value of the last body form when test is `#f`, else undefined.
**Backing:** `curator-web/src/scheme/interp.js:370-377`
**Side effects:** evaluates body only when test is false.
**Wired:** yes

Inverse of `when`. Body is in tail position.

#### Novice
```scheme
(unless (null? rows)
  (table rows '(id title price)))
```
*;; generated example*

#### Intermediate
```scheme
(unless (eq? (ctx-get 'tier ctx) 'free)
  (act 'sakura/cloud-reason (list ':context ctx) 'check-finding))
```
*;; generated example*

#### Expert
```scheme
;; gate a financial side-effect; tail position is the act descriptor
(unless (or (eq? state 'vacation) (eq? state 'paused))
  (act 'etsy/reprice (list listing-id new-price) 'check-reprice))
```
*;; generated example*

---

### `(when test body...)`

**Returns:** the value of the last body form when test is truthy, else undefined.
**Backing:** `curator-web/src/scheme/interp.js:346-353`
**Side effects:** evaluates body only when test is truthy.
**Wired:** yes

Single-arm conditional. Body is in tail position. Prefer when the
"false" branch is genuinely a no-op.

#### Novice
```scheme
(when (null? rows)
  (escalate 'no-data null))
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-get 'tier ctx) 'magic)
  (next 'assemble-quarter-memo ctx))
```
*;; generated example*

#### Expert
```scheme
;; emit a chip then queue an envelope, only when finding is non-trivial
(when (and (pair? finding) (> (length finding) 1))
  (begin
    (card-emit 'engine 'the-living-business-plan-ready (length finding))
    (envelope-queue (list 'the-living-business-plan ':finding finding))))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

---

## 2. List + sequence primitives

All §2 entries are bound by `makeBaseEnv` in
`curator-web/src/scheme/base.js`. They are PURE — no env effects,
no app state. Higher-order procedures re-enter the evaluator through
`apply`, sharing the same fuel budget so no escape is possible.

**Wired:** yes (all 20+ shipped + tested).
**Side effects:** none.

### `(append list1 list2 ...)`

**Returns:** a new list — the concatenation, left-to-right.
**Backing:** `curator-web/src/scheme/base.js:170`

#### Novice
```scheme
(append '(a b) '(c d))
;; → (a b c d)
```
*;; generated example*

#### Intermediate
```scheme
(append topics (list 'fallback-topic))
```
*;; generated example*

#### Expert
```scheme
;; flatten one level
(reduce append '() rows-of-rows)
```
*;; generated example*

---

### `(assoc key alist)`

**Returns:** the matching `(key value)` pair, or `#f`.
**Backing:** `curator-web/src/scheme/base.js:293`

#### Novice
```scheme
(assoc 'price '((title "vase") (price 19.99) (qty 2)))
;; → (price 19.99)
```
*;; generated example*

#### Intermediate
```scheme
(let ((entry (assoc ':topic cortex-result)))
  (if entry (cadr entry) 'no-topic))
```
*;; generated example*

#### Expert
```scheme
;; deep-equal key match; nested alist
(assoc '(:topic news-brief :date today)
       (cortex/recall-cache))
```
*;; generated example*

---

### `(car list)`

**Returns:** the first element.
**Backing:** `curator-web/src/scheme/base.js:46`

#### Novice
```scheme
(car '(a b c))
;; → a
```
*;; generated example*

#### Intermediate
```scheme
(let ((first-row (car rows)))
  (paint-text (assq 'title first-row) '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; conway/additive-blend style — pulls hex bytes via cadr/caddr (see base.js:50-51)
(let ((c (car palette)))
  (list (hex-byte c 1) (hex-byte c 3) (hex-byte c 5)))
```
*;; generated example, modelled on `curator-web/src/scheme/conway.js:1205` callers*

---

### `(cdr list)`

**Returns:** the list minus its first element.
**Backing:** `curator-web/src/scheme/base.js:47`

#### Novice
```scheme
(cdr '(a b c))
;; → (b c)
```
*;; generated example*

#### Intermediate
```scheme
;; drop the head, keep the rest
(map (lambda (row) (cdr row)) rows)
```
*;; generated example*

#### Expert
```scheme
;; tail-recursive walk; uses TCO in interp.js
(define (count-rest acc lst)
  (if (null? lst) acc (count-rest (+ acc 1) (cdr lst))))
```
*;; generated example*

---

### `(cons head tail)`

**Returns:** a new list with `head` prepended to `tail`.
**Backing:** `curator-web/src/scheme/base.js:45`

#### Novice
```scheme
(cons 'a '(b c))
;; → (a b c)
```
*;; generated example*

#### Intermediate
```scheme
;; prepend a fresh row
(cons new-row existing-rows)
```
*;; generated example*

#### Expert
```scheme
;; build a quoted on-result-symbol payload from a runtime computed kind
(cons 'finding (cons (ctx-result ctx) '()))
```
*;; generated example*

---

### `(filter pred list)`

**Returns:** a new list of elements where `(pred x)` is not `#f`.
**Backing:** `curator-web/src/scheme/base.js:67`

#### Novice
```scheme
(filter (lambda (n) (> n 0)) '(-2 -1 0 1 2))
;; → (1 2)
```
*;; generated example*

#### Intermediate
```scheme
;; keep only published listings
(filter (lambda (row) (eq? (assq 'state row) 'active))
        listings)
```
*;; generated example*

#### Expert
```scheme
;; chain with sort + take to top-N by score
(take (sort (filter (lambda (r) (assq 'score r))
                    rows)
            (lambda (a b) (> (assq 'score a) (assq 'score b))))
      3)
```
*;; generated example*

---

### `(for-each fn list)`

**Returns:** undefined.
**Backing:** `curator-web/src/scheme/base.js:65`
**Side effects:** invokes `fn` on each element, in order.
**Wired:** yes

Effectful iteration. Use when you want the side effects and don't need
the result list (use `map` for that).

#### Novice
```scheme
(for-each (lambda (sprite-id)
            (sprite sprite-id (rest)))
          '(blossom rose coral))
```
*;; generated example, using real sprite ids from `spriteBehaviors.js:120-136`*

#### Intermediate
```scheme
;; paint a heart at each anchor
(for-each (lambda (anchor)
            (paint-heart anchor 'sakura-pink))
          anchors)
```
*;; generated example*

#### Expert
```scheme
;; emit chip per shop, then return ctx
(for-each (lambda (shop)
            (card-emit 'engine 'free-shipping-shop-ok shop))
          (ctx-get 'connected-shops ctx))
```
*;; generated example, modelled on `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:65`*

---

### `(length list)`

**Returns:** the number of elements.
**Backing:** `curator-web/src/scheme/base.js:62`

#### Novice
```scheme
(length '(a b c d))
;; → 4
```
*;; generated example*

#### Intermediate
```scheme
(card-emit 'engine 'daily-brief-ready (length rows))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:197`*

#### Expert
```scheme
;; conditional on a per-tier accrual count
(when (>= (length deltas) 12)
  (next 'assemble-quarter-memo ctx))
```
*;; generated example*

---

### `(list elem1 elem2 ...)`

**Returns:** a new list.
**Backing:** `curator-web/src/scheme/base.js:44`

#### Novice
```scheme
(list 'a 'b 'c)
;; → (a b c)
```
*;; generated example*

#### Intermediate
```scheme
(act 'etsy/receipts (list 'this-week) 'check-actuals)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:158-160`*

#### Expert
```scheme
;; build a tools list for a reasoning session
(act 'lacuna/ask
     (list "Reconcile actuals against prior plan."
           ':tools '((etsy/receipts) (etsy/ledger) (cortex/recall))
           ':budget 'magic)
     'check-finding)
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(map fn list)`

**Returns:** a new list — `fn` applied to each element.
**Backing:** `curator-web/src/scheme/base.js:66`

#### Novice
```scheme
(map (lambda (n) (* n 2)) '(1 2 3))
;; → (2 4 6)
```
*;; generated example*

#### Intermediate
```scheme
;; titles of each row
(map (lambda (row) (assq 'title row)) rows)
```
*;; generated example*

#### Expert
```scheme
;; per-receipt revenue extraction, summed
(sum (map (lambda (r) (assq 'amount r)) receipts))
```
*;; generated example*

---

### `(member x list)`

**Returns:** the tail of `list` starting at `x`, or `#f`.
**Backing:** `curator-web/src/scheme/base.js:292`

#### Novice
```scheme
(member 'b '(a b c))
;; → (b c)
(member 'z '(a b c))
;; → #f
```
*;; generated example*

#### Intermediate
```scheme
(when (member 'magic supported-tiers)
  (next 'render-magic ctx))
```
*;; generated example*

#### Expert
```scheme
;; deep-equal match against an alist key
(if (member topic (ctx-get 'followed-topics ctx))
    (next 'fetch ctx)
    (escalate 'topic-not-followed null))
```
*;; generated example*

---

### `(nth list i)` and `(list-ref list i)`

**Returns:** the i-th element (zero-indexed).
**Backing:** `curator-web/src/scheme/base.js:174` (nth) / `:291` (list-ref)

#### Novice
```scheme
(nth '(a b c) 1)
;; → b
```
*;; generated example*

#### Intermediate
```scheme
(let ((title (nth row 0))
      (price (nth row 1)))
  (paint-text title '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; pull column i across many rows
(map (lambda (row) (list-ref row i)) rows)
```
*;; generated example*

---

### `(range a b)`

**Returns:** the list `(a a+1 ... b-1)`.
**Backing:** `curator-web/src/scheme/base.js:63`

#### Novice
```scheme
(range 0 5)
;; → (0 1 2 3 4)
```
*;; generated example*

#### Intermediate
```scheme
;; iterate over 7 days for a brief
(map (lambda (d) (act 'web-search (list 'headline d) 'check-fetch))
     (range 0 7))
```
*;; generated example*

#### Expert
```scheme
;; deterministic-numbered IDs for paint anchors
(for-each (lambda (i)
            (paint-heart (list 'anchor i) 'sakura-pink))
          (range 0 12))
```
*;; generated example*

---

### `(reduce fn init list)`

**Returns:** the accumulated value.
**Backing:** `curator-web/src/scheme/base.js:68`

#### Novice
```scheme
(reduce + 0 '(1 2 3 4))
;; → 10
```
*;; generated example*

#### Intermediate
```scheme
(reduce (lambda (acc r) (+ acc (assq 'amount r)))
        0
        receipts)
```
*;; generated example*

#### Expert
```scheme
;; fold rows into a tagged structure (price-ladder-style)
(reduce (lambda (acc r)
          (let ((p (assq 'price r)))
            (if p (cons p acc) acc)))
        '()
        listings)
```
*;; generated example*

---

### `(reverse list)`

**Returns:** a new list, reversed.
**Backing:** `curator-web/src/scheme/base.js:171`

#### Novice
```scheme
(reverse '(a b c))
;; → (c b a)
```
*;; generated example*

#### Intermediate
```scheme
;; newest-last → newest-first
(reverse (sort log (lambda (a b) (< (assq 'ts a) (assq 'ts b)))))
```
*;; generated example*

#### Expert
```scheme
;; accumulate forward, reverse at the tail (tail-recursive idiom)
(let loop ((items items) (out '()))
  (if (null? items)
      (reverse out)
      (loop (cdr items) (cons (transform (car items)) out))))
```
*;; generated example*

---

## 3. Math + numeric

All §3 entries are bound by `makeBaseEnv`
(`curator-web/src/scheme/base.js`). Pure value transforms; no state.

**Wired:** yes — every one shipped.
**Side effects:** none.

### `(+ n1 n2 ...)` and `(- n1 n2 ...)` and `(* n1 n2 ...)` and `(/ n1 n2 ...)`

**Backing:** `curator-web/src/scheme/base.js:26-29`

Variadic arithmetic. `(-)` with one arg negates; `(/)` with one arg
reciprocates.

#### Novice
```scheme
(+ 1 2 3)        ;; → 6
(- 10 4 1)       ;; → 5
(* 2 3 4)        ;; → 24
(/ 100 4)        ;; → 25
```
*;; generated example*

#### Intermediate
```scheme
;; cents → dollars (Curator's price-cents convention)
(/ price-cents 100)
```
*;; generated example*

#### Expert
```scheme
;; CAGR over n years (also see base.js:220 `cagr` helper)
(* 100 (- (expt (/ end begin) (/ 1 years)) 1))
```
*;; generated example*

---

### `(abs x)`

**Backing:** `curator-web/src/scheme/base.js:35`

Absolute value.

#### Novice
```scheme
(abs -7)  ;; → 7
```
*;; generated example*

#### Intermediate
```scheme
;; distance-magnitude per axis
(abs (- new-price old-price))
```
*;; generated example*

#### Expert
```scheme
;; alarm if margin-change magnitude exceeds threshold
(when (> (abs (pct-change old-margin new-margin)) 5)
  (escalate 'margin-drift (list ':delta (- new-margin old-margin))))
```
*;; generated example*

---

### `(ceiling x)` / `(ceil x)`

**Backing:** `curator-web/src/scheme/base.js:185-188`

Round up.

#### Novice
```scheme
(ceiling 3.2)  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; minimum bricks needed
(ceiling (/ total-items items-per-brick))
```
*;; generated example*

#### Expert
```scheme
;; tier-level page count from row count
(ceiling (/ (length rows) page-size))
```
*;; generated example*

---

### `(clamp x lo hi)`

**Backing:** `curator-web/src/scheme/base.js:192`

Bound `x` to `[lo, hi]`.

#### Novice
```scheme
(clamp 150 0 100)  ;; → 100
```
*;; generated example*

#### Intermediate
```scheme
;; sprite turn — engine clamps 0..360 by spec
(sprite 'rose (turn (clamp degrees 0 360)))
```
*;; generated example, real sprite id from `spriteBehaviors.js:122`*

#### Expert
```scheme
;; coerce a tier float into a discrete percentage
(round (clamp (* score 100) 0 100))
```
*;; generated example*

---

### `(expt b p)`

**Backing:** `curator-web/src/scheme/base.js:183`

Exponentiation, `b^p`.

#### Novice
```scheme
(expt 2 10)  ;; → 1024
```
*;; generated example*

#### Intermediate
```scheme
;; log-spaced price ladder anchor
(expt 2 (/ rung 4))
```
*;; generated example*

#### Expert
```scheme
;; compound growth over n weeks
(* start (expt (+ 1 weekly-rate) weeks))
```
*;; generated example*

---

### `(floor x)`

**Backing:** `curator-web/src/scheme/base.js:184`

Round down.

#### Novice
```scheme
(floor 3.7)  ;; → 3
```
*;; generated example*

#### Intermediate
```scheme
;; integer multiplier
(floor (/ total seg-count))
```
*;; generated example*

#### Expert
```scheme
;; bucket index for a histogram
(floor (* (- value lo) buckets (/ 1 (- hi lo))))
```
*;; generated example*

---

### `(lerp a b t)`

**Backing:** `curator-web/src/scheme/base.js:193`

Linear interpolation; `t=0` → `a`, `t=1` → `b`.

#### Novice
```scheme
(lerp 0 100 0.5)  ;; → 50
```
*;; generated example*

#### Intermediate
```scheme
;; midway colour value
(lerp red-channel target-red 0.3)
```
*;; generated example*

#### Expert
```scheme
;; ease-in-out tween — sample at t=0..1
(map (lambda (t) (lerp begin end (* t t (- 3 (* 2 t)))))
     (map (lambda (i) (/ i 9)) (range 0 10)))
```
*;; generated example*

---

### `(max n1 n2 ...)` and `(min n1 n2 ...)`

**Backing:** `curator-web/src/scheme/base.js:33-34`

Largest / smallest among arguments.

#### Novice
```scheme
(max 3 7 1)  ;; → 7
(min 3 7 1)  ;; → 1
```
*;; generated example*

#### Intermediate
```scheme
;; cap retries
(min retry-count 5)
```
*;; generated example*

#### Expert
```scheme
;; price ceiling and floor against historical range
(clamp suggested (min lo-hist 5) (max hi-hist 500))
```
*;; generated example*

---

### `(mean list)`

**Backing:** `curator-web/src/scheme/base.js:209`

Arithmetic mean; empty list → 0.

#### Novice
```scheme
(mean '(2 4 6))  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; average daily orders
(mean (map (lambda (r) (assq 'orders r)) day-rows))
```
*;; generated example*

#### Expert
```scheme
;; rolling average using sma helper (base.js:221)
(sma (map (lambda (r) (assq 'price r)) listings) 7)
```
*;; generated example*

---

### `(modulo x y)`

**Backing:** `curator-web/src/scheme/base.js:30`

Positive remainder (Scheme convention).

#### Novice
```scheme
(modulo 10 3)   ;; → 1
(modulo -1 4)   ;; → 3 (positive!)
```
*;; generated example*

#### Intermediate
```scheme
;; every 13th week — quarter-end accrual
(when (= 0 (modulo week-index 13))
  (next 'assemble-quarter-memo ctx))
```
*;; generated example, real pattern from `the-living-business-plan.sks:65`*

#### Expert
```scheme
;; alternate rows for striped paint
(for-each (lambda (i)
            (if (= 0 (modulo i 2))
                (paint-rect i 0 1 1 'lilac)
                (paint-rect i 0 1 1 'mint)))
          (range 0 16))
```
*;; generated example*

---

### `(random)` and `(randint lo hi)` and `(random-pick list)`

**Backing:** `curator-web/src/scheme/base.js:200-207`

`random` returns a uniform float in [0,1). When running under
`runWithCards` the env binds a SEEDED PRNG on top so cart replay is
byte-identical (note in base.js:194-200). `runSurface` uses the
unseeded `rng-uniform`.

#### Novice
```scheme
(randint 1 7)
;; → 1..6
```
*;; generated example*

#### Intermediate
```scheme
;; random sprite from the pink family
(sprite (random-pick '(blossom rose coral)) (rest))
```
*;; generated example, real sprite ids from `spriteBehaviors.js:120-136`*

#### Expert
```scheme
;; seeded jitter for a paint-flow animation
(paint-flow 'card-a 'card-b 'glyph/heart
            (+ 6 (randint 0 5))
            'sakura-pink)
```
*;; generated example*

---

### `(round x)` / `(round2 x)`

**Backing:** `curator-web/src/scheme/base.js:189-190`

Round to integer / round to 2 decimals (money-friendly).

#### Novice
```scheme
(round 3.6)    ;; → 4
(round2 3.567) ;; → 3.57
```
*;; generated example*

#### Intermediate
```scheme
;; display-friendly margin percentage
(round2 (margin price cost))
```
*;; generated example, `margin` from base.js:214*

#### Expert
```scheme
;; reprice to cleanest $.99 anchor
(- (round (* new-price 100)) 1)
;; e.g. 19.99 ≈ 1999 cents
```
*;; generated example*

---

### `(sqrt x)`

**Backing:** `curator-web/src/scheme/base.js:177`

#### Novice
```scheme
(sqrt 16)  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; euclidean distance helper (also see `dist`, base.js:237)
(sqrt (+ (* dx dx) (* dy dy)))
```
*;; generated example*

#### Expert
```scheme
;; standard deviation pass
(let ((m (mean xs)))
  (sqrt (mean (map (lambda (x) (let ((d (- x m))) (* d d))) xs))))
```
*;; generated example*

---

### `(sum list)`

**Backing:** `curator-web/src/scheme/base.js:208`

#### Novice
```scheme
(sum '(1 2 3 4))  ;; → 10
```
*;; generated example*

#### Intermediate
```scheme
;; week revenue total
(sum (map (lambda (r) (assq 'amount r)) receipts))
```
*;; generated example*

#### Expert
```scheme
;; weighted score across category buckets
(sum (map (lambda (b) (* (assq 'weight b) (assq 'value b)))
          score-buckets))
```
*;; generated example*

---

## 4. Cart spine

The state-machine spine that every cart runs on. All §4 entries are
installed by `installCartPrelude`
(`curator-web/src/scheme/cartPrelude.js:42-136`). Each is a PURE
DESCRIPTOR CONSTRUCTOR: it returns a tagged list the driver
intercepts. The cart NEVER touches the world directly.

**Wired:** yes (all 7 shipped, lint-validated).
**Side effects:** none in the verb itself; the driver dispatches.

### `(act verb args on-result-symbol)`

**Returns:** `(act <verb> <args> <on-result-symbol>)` — a tool-call descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:97-102`
**Lint:** on-result MUST be a quoted symbol (cartLint.js:75-105).

The cart's only side-effect channel. The driver intercepts, dispatches
the real call, threads the response into `ctx` via `'last-result`, and
jumps to the named state.

#### Novice
```scheme
(define (fetch ctx)
  (act 'etsy/listings (list 'active) 'render))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:28-29`*

#### Intermediate
```scheme
(define (recall-topics ctx)
  (act 'cortex/recall (list '(:topic followed-topics)) 'check-topics))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:94-95`*

#### Expert
```scheme
(define (lacuna-ask ctx)
  (act 'lacuna/ask
       (list "Reconcile actuals against prior strategy. Revise projections."
             ':tools '((etsy/receipts) (etsy/ledger) (cortex/recall))
             ':context (list ':receipts (ctx-get 'receipts ctx)
                             ':prior    (ctx-get 'prior-plan ctx))
             ':budget 'magic)
       'check-finding))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(after seconds state-symbol ctx)`

**Returns:** `(after <seconds> <state> <ctx>)` — sleep descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:86-87`

Sleep, then resume at the named state. Standard back-off after a
`'rate-limited` result.

#### Novice
```scheme
(after 30 'fetch ctx)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:35`*

#### Intermediate
```scheme
(cond
  ((eq? r 'rate-limited)    (after 60 'fetch ctx))
  ((eq? r 'quota-exhausted) (escalate 'answers-quota null))
  (else                     (next 'render ctx)))
```
*Source: condensed from `curator-web/src/scheme/carts/personal/daily-news-brief.sks:144-151`*

#### Expert
```scheme
;; exponential back-off via ctx counter
(let ((tries (or (ctx-get 'tries ctx) 0)))
  (after (* 30 (expt 2 tries))
         'fetch
         (ctx-set 'tries (+ tries 1) ctx)))
```
*;; generated example*

---

### `(ctx-get key ctx)`

**Returns:** the value bound to `key`, or `null`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:108-115`

#### Novice
```scheme
(ctx-get 'topics ctx)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:134`*

#### Intermediate
```scheme
(let ((anchors    (ctx-get 'anchors ctx))
      (copy-lines (ctx-get 'copy-lines ctx)))
  (paint-arrow 'price-ladder-card ':anchors anchors ':labels copy-lines))
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-283`*

#### Expert
```scheme
;; nested ctx threading
(let ((receipts (ctx-get 'receipts ctx))
      (ledger   (ctx-get 'ledger ctx))
      (prior    (ctx-get 'prior-plan ctx))
      (override (ctx-get 'override ctx)))
  (act 'lacuna/ask
       (list "Reconcile."
             ':context (list ':receipts receipts ':ledger ledger
                             ':prior prior ':override override))
       'check-finding))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(ctx-result ctx)`

**Returns:** the value of `'last-result` in `ctx`, or `null`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:127-133`

The driver writes the result of the last `act` here. Most check-states
read it first.

#### Novice
```scheme
(define (check-state ctx)
  (let ((state (ctx-result ctx)))
    ...))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:116-117`*

#### Intermediate
```scheme
(define (render ctx)
  (let ((rows (ctx-result ctx)))
    (cond
      ((null? rows)              (escalate 'no-data null))
      ((eq? rows 'rate-limited)  (after 30 'fetch ctx))
      (else                      (begin (table rows '(id title price))
                                        (done))))))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:31-38`*

#### Expert
```scheme
(define (check-finding ctx)
  (let ((finding (ctx-result ctx)))
    (cond
      ((null? finding)                  (escalate 'service-not-yet-wired null))
      ((eq? finding 'rate-limited)      (after 120 'lacuna-ask ctx))
      ((eq? finding 'cloud-tier-required) (escalate 'service-not-connected null))
      ((not (pair? finding))            (escalate 'sakura-garbled null))
      (else (next 'remember (ctx-set 'finding finding ctx))))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:265-283`*

---

### `(ctx-set key value ctx)`

**Returns:** a NEW ctx with `key`→`value`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:118-122`

Immutable update — returns a new assoc-list. The old `ctx` is
unchanged.

#### Novice
```scheme
(ctx-set 'topics topics ctx)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:107`*

#### Intermediate
```scheme
(next 'check-cortex-cache
      (ctx-set 'state state ctx))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:128`*

#### Expert
```scheme
;; layered ctx updates threaded through one state
(next 'fetch-ledger
      (ctx-set 'receipts receipts
               (ctx-set 'shop-id shop-id ctx)))
```
*;; generated example*

---

### `(done)`

**Returns:** `(done)` — terminal descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:77`

Cart finished cleanly. The driver releases the worker and records
success.

#### Novice
```scheme
(done)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:37`*

#### Intermediate
```scheme
(define (render ctx)
  (let ((rows (ctx-result ctx)))
    (table rows '(listing-id title metric value))
    (done)))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:31-38`*

#### Expert
```scheme
;; emit chip + envelope, then done as the tail of the cart
(define (render ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (card-emit 'engine 'the-living-business-plan-ready (length finding))
    (envelope-queue (list 'the-living-business-plan ':finding finding))
    (done)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

---

### `(escalate kind detail)`

**Returns:** `(escalate <kind> <detail>)` — pause descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:78-79`
**Lint:** kind MUST be a quoted symbol (cartLint.js:107-119).

The cart cannot proceed honestly. The driver pauses; the operator
surface decides what to do next.

#### Novice
```scheme
(escalate 'shop-not-connected null)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:25`*

#### Intermediate
```scheme
(escalate 'state-blocks-spend 'vacation)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:122`*

#### Expert
```scheme
(escalate 'service-not-yet-wired
          '(:status not-wired :reason "lacuna-session-returned-null"))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:268-270`*

---

### `(next state-symbol ctx)`

**Returns:** `(next <state> <ctx>)` — advance descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:75-76`

Move to the named state with `ctx` as input. The driver looks up the
matching `(define (<state> ctx) …)`.

#### Novice
```scheme
(next 'fetch ctx)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:26`*

#### Intermediate
```scheme
(next 'check-cortex-cache (ctx-set 'state state ctx))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:128`*

#### Expert
```scheme
(else (next 'remember
            (ctx-set 'finding finding ctx)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:282-283`*

---

## 5. Cortex verbs

Cortex verbs are NOT bound as Scheme functions. They are
ACT-DISPATCHED — invoked via `(act 'cortex/recall …)`. The driver
routes them to the Cortex memory graph. Card-manifest sources for
the verb roster: `curator-web/src/components/cards/cortexManifest.js`
and the per-tier cart manifests (`carts/<tier>/manifest.js` —
`cortex/recall`, `cortex/remember`, `cortex/forget`).

**Wired:** partial — `recall`, `remember`, `forget` shipped; deeper
verbs (`cosine-topk`, `walk`, `multi-store-publish`, `diff-against-shops`)
are surfaced in cart manifests but resolve to `'service-not-yet-wired`
or a per-cart lacuna-relay at this writing.

### `(act 'cortex/recall (list key-alist) 'on-result)`

```verb-card cortex/recall
```

**Returns:** via `ctx-result`: the cached value, or `null`.
**Backing:** routed by cart driver to `curator-api`/cortex — verb
**Wired:** yes (the most-used Cortex verb).

#### Novice
```scheme
(act 'cortex/recall (list '(:topic news-brief :date today)) 'check-today)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:76`*

#### Intermediate
```scheme
(act 'cortex/recall (list '(:topic followed-topics)) 'check-topics)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:95`*

#### Expert
```scheme
(define (fetch-prior-plan ctx)
  (act 'cortex/recall
       (list '(:topic living-plan-checkpoint))
       'check-prior-plan))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:208-211`*

---

### `(act 'cortex/remember (list key-alist value) 'on-result)`

**Returns:** via `ctx-result`: `'ok` on success, `'cortex-not-ready`
otherwise.
**Wired:** yes.

Idempotent upsert keyed on the topic alist. Same key + same value =
no-op.

#### Novice
```scheme
(act 'cortex/remember (list '(:topic notes) "today's note") 'next-step)
```
*;; generated example*

#### Intermediate
```scheme
(define (remember ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (act 'cortex/remember
         (list '(:topic the-living-business-plan :window now) finding)
         'remember-checkpoint)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:291-295`*

#### Expert
```scheme
;; double-write — window-keyed + stable checkpoint topic
(define (remember-checkpoint ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (act 'cortex/remember
         (list '(:topic living-plan-checkpoint) finding)
         'render)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:302-306`*

---

### `(act 'cortex/forget (list key-alist) 'on-result)`

**Returns:** via `ctx-result`: `'ok` or `'cortex-not-ready`.
**Wired:** yes (manifest-declared at `cortexManifest.js:40-47` as `prune-node`).
**Side effects:** persistent — drops the node + its edges.

Operator-confirmed. The card manifest declares
`perm: 'destructive'`, `confirm: 'every-time'`.

#### Novice
```scheme
(act 'cortex/forget (list '(:topic stale-promo)) 'next-step)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-result ctx) 'confirmed)
  (act 'cortex/forget (list (ctx-get 'topic-to-drop ctx)) 'render))
```
*;; generated example*

#### Expert
```scheme
;; bulk forget under operator confirmation
(for-each
  (lambda (topic)
    (act 'cortex/forget (list (list ':topic topic)) 'after-each-drop))
  (ctx-get 'stale-topics ctx))
```
*;; generated example*

---

### `(act 'cortex/cosine-topk (list query k) 'on-result)`

**Returns:** via `ctx-result`: list of `(node-id score)` pairs.
**Wired:** partial — manifest-declared in carts/magic/manifest.js and
referenced by `cortex-multi-store-publish.sks`; routes to the cortex
embeddings service which gates by tier.

#### Novice
```scheme
(act 'cortex/cosine-topk (list "rustic ceramic vase" 5) 'pick-similar)
```
*;; generated example*

#### Intermediate
```scheme
(let ((seed (ctx-get 'listing-title ctx)))
  (act 'cortex/cosine-topk (list seed 10) 'rank))
```
*;; generated example*

#### Expert
```scheme
;; gate the call; cloud-tier required
(case (ctx-get 'tier ctx)
  ((magic) (act 'cortex/cosine-topk (list query 8) 'rank))
  (else    (escalate 'service-not-connected
                     '(:status not-wired :reason "cosine-topk-requires-magic"))))
```
*;; generated example*

---

### `(act 'cortex/walk (list start-node depth) 'on-result)`

**Returns:** via `ctx-result`: the breadth-first node list, or `null`.
**Wired:** partial — surfaced by the magic-tier carts; resolves to
`'service-not-yet-wired` on local-tier runs.

#### Novice
```scheme
(act 'cortex/walk (list 'living-plan-checkpoint 2) 'render)
```
*;; generated example*

#### Intermediate
```scheme
(let ((root (ctx-get 'theme-root ctx)))
  (act 'cortex/walk (list root 3) 'collect))
```
*;; generated example*

#### Expert
```scheme
;; chain walk → cosine-topk for thematic expansion
(define (walk-then-rank ctx)
  (act 'cortex/walk
       (list (ctx-get 'seed ctx) 2)
       'rank-results))
```
*;; generated example*

---

### `(act 'cortex/multi-store-publish (list listing shop-ids) 'on-result)`

**Returns:** via `ctx-result`: per-shop result alist.
**Backing:** routed via `carts/pink/cortex-multi-store-publish.sks`.
**Wired:** partial — the cart spine is shipped; the underlying
publisher gates per shop on connection + per-shop authorization.

#### Novice
```scheme
(act 'cortex/multi-store-publish
     (list listing-id (list 'etsy 'shopify))
     'check-results)
```
*;; generated example*

#### Intermediate
```scheme
(act 'cortex/multi-store-publish
     (list (ctx-get 'listing ctx) (ctx-get 'shop-ids ctx))
     'reconcile-shops)
```
*;; generated example*

#### Expert
```scheme
;; bulk + dry-run before commit; pattern from cortex-multi-store-publish-dry-run.sks
(act 'cortex/multi-store-publish
     (list (ctx-get 'listing-batch ctx)
           '(etsy shopify)
           ':dry-run #t)
     'preview-results)
```
*;; generated example, modelled on `carts/pink/cortex-multi-store-publish-dry-run.sks`*

---

### `(act 'cortex/diff-against-shops (list listing) 'on-result)`

**Returns:** via `ctx-result`: alist of per-shop diff records.
**Backing:** `carts/pink/cortex-diff-against-shops.sks`.
**Wired:** partial — diff cart spine shipped; the diff service is
multi-shop and gates on having ≥2 connected stores.

#### Novice
```scheme
(act 'cortex/diff-against-shops (list listing-id) 'render-diff)
```
*;; generated example*

#### Intermediate
```scheme
(let ((target (ctx-get 'listing ctx)))
  (act 'cortex/diff-against-shops (list target) 'check-diff))
```
*;; generated example*

#### Expert
```scheme
;; condition on connected-store count before calling
(if (>= (length (ctx-get 'connected-shops ctx)) 2)
    (act 'cortex/diff-against-shops (list (ctx-get 'listing ctx)) 'check-diff)
    (escalate 'connect-second-store-first null))
```
*;; generated example*

---

## 5.5 Stats verbs (Wave 5 — 2026-06-22)

Pure-math deterministic verbs. NO vendor dependency, NO OAuth, NO infra
gating. ACT-DISPATCHED. Backings live in
`curator-api/curator_api/routes/verb_backings.py:1773-2010` and are
re-exported in the frontend dispatcher table
`curator-web/src/scheme/runtime/verbBackings.js:46-53`.

**Wired:** yes — every Wave-5 verb has a real HTTP backing that
executes the actual math (not a degraded shell). Per Marcus rule
(NO FAKE-SUCCESS), these are wired:true honest backings.

### `(act 'stats/zscore (list (:series ...) (:value v)) 'on-result)`

**Returns:** `(:ok #t :z float :mean float :stdev float :n int)`
**Backing:** `verb_backings.stats_zscore` — population z-score.

#### Novice
```scheme
(act 'stats/zscore '((:series (10 12 11 14 13)) (:value 25)) 'check-anomaly)
```
*Source: `curator-web/src/scheme/carts/cron/daily-anomaly-watch.sks`*

#### Intermediate
```scheme
(let ((series (ctx-get 'impressions-28d ctx)))
  (act 'stats/zscore (list ':series series ':value (last series)) 'check-z))
```
*Source: `curator-web/src/scheme/carts/magic/title-bandit-posterior.sks:207`*

#### Expert
```scheme
;; Z > 2 -> escalate; otherwise carry on
(let* ((series (ctx-get 'series ctx))
       (r      (act 'stats/zscore (list ':series series) 'check-z)))
  (if (> (alist-get ':z r) 2.0)
      (escalate 'anomaly-detected r)
      (act 'cortex/remember (list ':topic 'baseline ':value (alist-get ':mean r))
           'remember-baseline)))
```
*;; composition example*

---

### `(act 'stats/delta (list (:before ...) (:after ...)) 'on-result)`

**Returns:** `(:ok #t :delta number|list :rel number|list :shape "scalar"|"series")`
**Backing:** `verb_backings.stats_delta` — element-wise subtraction + relative change.

#### Novice
```scheme
(act 'stats/delta '((:before 100) (:after 110)) 'check-delta)
```

#### Intermediate
```scheme
(act 'stats/delta
     (list ':before yesterday-impressions ':after today-impressions)
     'check-traffic-delta)
```

#### Expert
```scheme
;; Series delta + threshold gate
(let* ((d (act 'stats/delta (list ':before y ':after t) 'check))
       (rels (alist-get ':rel d)))
  (if (any? (lambda (r) (> (abs r) 0.20)) rels)
      (escalate 'series-jump d)
      'no-action))
```

---

### `(act 'stats/cooc (list (:transactions ...) (:top_k k)) 'on-result)`

**Returns:** `(:ok #t :pairs [(:a :b :count :lift) ...] :n_transactions int)`
**Backing:** `verb_backings.stats_cooc` — co-occurrence counts + lift.

#### Novice
```scheme
(act 'stats/cooc '((:transactions (("a" "b") ("a" "c") ("b" "c")))) 'check-pairs)
```

#### Intermediate
```scheme
(let ((carts (ctx-get 'recent-orders ctx)))
  (act 'stats/cooc (list ':transactions (map order-items carts) ':top_k 10)
       'check-bundles))
```
*Source: `curator-web/src/scheme/carts/cron/monthly-bundle-suggestions.sks`*

#### Expert
```scheme
;; Filter by lift > 1.5 -> bundle candidates
(let* ((co    (act 'stats/cooc (list ':transactions txns) 'check))
       (pairs (alist-get ':pairs co))
       (strong (filter (lambda (p) (> (alist-get ':lift p) 1.5)) pairs)))
  (if (pair? strong)
      (act 'cortex/remember (list ':topic 'bundle-candidates ':value strong)
           'remember)
      'no-bundles))
```

---

### `(act 'stats/cosine (list (:a ...) (:b ...)) 'on-result)`

**Returns:** `(:ok #t :cosine float)` — cosine similarity in [-1, 1].
**Backing:** `verb_backings.stats_cosine`.

#### Novice
```scheme
(act 'stats/cosine '((:a (1 0)) (:b (1 1))) 'check-sim)
```

#### Intermediate
```scheme
(let ((emb-a (ctx-get 'listing-emb ctx))
      (emb-b (ctx-get 'competitor-emb ctx)))
  (act 'stats/cosine (list ':a emb-a ':b emb-b) 'check-sim))
```

#### Expert
```scheme
;; Rank candidates by similarity, take top 3
(let ((scored (map (lambda (c)
                     (cons c (alist-get ':cosine
                              (act 'stats/cosine (list ':a query ':b (cdr c))
                                   'check))))
                   candidates)))
  (take (sort-by cdr > scored) 3))
```

---

### `(act 'stats/percentile (list (:series ...) (:value v) (:p p)) 'on-result)`

**Returns:** `(:ok #t :rank float|null :at_percentile float|null :n int)`
**Backing:** `verb_backings.stats_percentile` — linear-interp percentile.

#### Novice
```scheme
(act 'stats/percentile '((:series (1 2 3 4 5)) (:p 50)) 'check-median)
```

#### Intermediate
```scheme
(act 'stats/percentile
     (list ':series sale-prices ':value asking-price)
     'check-price-rank)
```

#### Expert
```scheme
;; Compare today's sale velocity against 30-day p90
(let* ((r (act 'stats/percentile
               (list ':series velocity-30d ':p 90 ':value velocity-today)
               'check)))
  (cond ((> (alist-get ':rank r) 90)
         (act 'sakura/say (list ':text "Velocity is in the top 10% — promote.")
              'reply))
        (else 'normal)))
```

---

## 5.6 Cortex extensions (Wave 5 — 2026-06-22)

### `(act 'cortex/calendar (list (:limit n)) 'on-result)`

**Returns:** `(:ok #t :offers [(:memo_id :title :date ...) ...] :scanned int)`
**Backing:** `verb_backings.cortex_calendar` — scans recent memos for date offers.
**Wired:** yes.

#### Novice
```scheme
(act 'cortex/calendar '() 'check-events)
```

#### Intermediate
```scheme
(act 'cortex/calendar '((:limit 100)) 'find-events)
```

#### Expert
```scheme
;; Surface memo dates in next 30 days as suggested cron triggers
(let* ((r       (act 'cortex/calendar '((:limit 200)) 'check))
       (offers  (alist-get ':offers r))
       (soon    (filter (lambda (o)
                          (< (days-until (alist-get ':date o)) 30))
                        offers)))
  (for-each (lambda (o)
              (act 'cortex/remember (list ':topic 'upcoming :value o) 'remember))
            soon))
```

---

### `(act 'cortex/forget (list (:ttl_days n)) 'on-result)`

**Returns:** sweep summary dict from `run_expunge_sweep`.
**Backing:** `verb_backings.cortex_forget` — TTL-driven expunge scoped to operator.
**Wired:** yes.

#### Novice
```scheme
(act 'cortex/forget '() 'check-forget)
```

#### Intermediate
```scheme
(act 'cortex/forget '((:ttl_days 90)) 'aggressive-forget)
```

#### Expert
```scheme
;; Quarterly cleanup with audit
(let ((r (act 'cortex/forget '((:ttl_days 90)) 'sweep)))
  (act 'cortex/remember
       (list ':topic 'quarterly-forget-audit ':value r)
       'record))
```

---

### `(act 'cortex/cosine-topk (list (:kind k) (:embedding v) (:limit n)) 'on-result)`

**Returns:** `(:ok #t :hits [(...node...) ...] :k int)`
**Backing:** `verb_backings.cortex_cosine_topk` — vector_topk over CortexStore.
**Wired:** yes (degrades honestly to empty hits + `degraded:true` when the
operator's backend lacks a vector index).

#### Novice
```scheme
(act 'cortex/cosine-topk
     (list ':kind "memo" ':embedding (ctx-get 'q ctx))
     'check)
```

#### Intermediate
```scheme
(act 'cortex/cosine-topk
     (list ':kind "listing" ':embedding query-emb ':limit 5)
     'find-similar-listings)
```

#### Expert
```scheme
;; Retrieve nearest 10, hand to model for re-rank
(let* ((hits (alist-get ':hits
              (act 'cortex/cosine-topk
                   (list ':kind "memo" ':embedding q ':limit 10) 'topk))))
  (act 'model/workhorse
       (list ':prompt (rerank-prompt q hits))
       'rerank))
```

---

## 5.7 Sakura local primitives (Wave 5 — 2026-06-22)

### `(act 'sakura/say (list (:text "...") (:mood m)) 'on-result)`

**Returns:** `(:ok #t :spoken #t :text_len int :mood string)`
**Backing:** `verb_backings.sakura_say` — writes a durable audit row.
The frontend speech-bubble painter is a separate concern that listens
to the audit event and renders locally.
**Wired:** yes.

#### Novice
```scheme
(act 'sakura/say '((:text "Hello, operator.")) 'spoke)
```

#### Intermediate
```scheme
(act 'sakura/say
     (list ':text "Pricing looks good today." ':mood "happy")
     'spoke)
```

#### Expert
```scheme
;; Voice-coach pattern: react to a vision result with mood-matched line
(let* ((v   (act 'vision/label (list ':image url) 'label))
       (top (alist-get ':label (car (alist-get ':labels v)))))
  (act 'sakura/say
       (list ':text (format "I see ~a — try moving left." top)
             ':mood "thinking")
       'coached))
```

---

### `(act 'sakura/cloud-reason (list (:prompt "...")) 'on-result)`

**Returns:** `(:ok #t :text "..." :tokens_in int :tokens_out int)`
**Backing:** `verb_backings.sakura_cloud_reason` — delegates to the
deep-reasoning cascade with a distinct audit tag (so callers can tell
"Sakura escalated" from "operator invoked deep-reasoning directly").
**Wired:** yes (degrades honestly when the cloud model cascade is
unavailable in the build).

#### Novice
```scheme
(act 'sakura/cloud-reason '((:prompt "should I raise prices?")) 'reason)
```

#### Intermediate
```scheme
(act 'sakura/cloud-reason
     (list ':prompt (string-append "context: " ctx "\nquestion: " q))
     'reason)
```

#### Expert
```scheme
;; Escalation pattern — on-device first, cloud only on uncertainty.
(let ((local (act 'model/fast (list ':prompt q) 'fast)))
  (if (< (alist-get ':confidence local) 0.7)
      (act 'sakura/cloud-reason (list ':prompt q) 'escalate)
      local))
```

---

## 6. Marketplace verbs

Marketplace verbs are shipped two ways: as Scheme bindings installed
by `installShopVerbsRuntime`
(`curator-web/src/scheme/shopVerbsRuntime.js:448-602`), AND
ACT-DISPATCHED from carts. The verb tables live in
`curator-web/src/scheme/shops.js` (ETSY/EBAY/SHOPIFY/META, lines
17-168). Each runtime-installed verb returns a queued intent envelope
the live spine drains.

**Wired:** mixed.
- All `etsy/*`, `ebay/*`, `shopify/*`, `meta/*` verbs are
  Scheme-bound — but a verb without a backing op in the catalog
  returns `'not-yet-wired` honestly (shopVerbsRuntime.js:524-533).
- Financial writes (reprice, payouts, refunds) are gated by
  `FINANCIAL_WRITES_ENABLED` — disabled by default per Alfred
  2026-06-14. Calls return a preview envelope, never fire.
- Vendor verbs (Printify, Shippo, QuickBooks, Canva) installed by
  `installVendorVerbs` (`vendorVerbs.js`).
- `instagram/feed-post` and `google/sheets-append-row` are
  manifest-only verbs, surfaced by `carts/google/*.sks`; they route
  through the lacuna multi-tool relay rather than direct Scheme
  bindings.

### `(etsy/listings [state])`

**Returns:** queued intent `(ok queued (:verb etsy/listings …))`.
**Backing:** declared `shops.js:19`; runtime-bound at
`shopVerbsRuntime.js:594-598`.
**Wired:** yes (read).

List the seller's listings, optionally filtered by state.

#### Novice
```scheme
(act 'etsy/listings (list 'active) 'render)
```
*Source: pattern from `curator-web/src/scheme/carts/etsy/age-distribution.sks:29`*

#### Intermediate
```scheme
(define (fetch ctx)
  (act 'etsy/listings (list 'all) 'check-listings))
```
*;; generated example, real verb name from `shops.js:19`*

#### Expert
```scheme
;; chain: list → per-listing inventory pull
(define (after-listings ctx)
  (let ((rows (ctx-result ctx)))
    (act 'etsy/inventory (list (assq 'listing-id (car rows))) 'check-inv)))
```
*;; generated example*

---

### `(etsy/receipts [state])`

**Returns:** queued intent.
**Backing:** `shops.js:37`; bound at `shopVerbsRuntime.js:594`.
**Wired:** yes (read).

#### Novice
```scheme
(act 'etsy/receipts (list 'this-week) 'check-actuals)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:158-160`*

#### Intermediate
```scheme
(act 'etsy/receipts (list 'today) 'count-today)
```
*;; generated example*

#### Expert
```scheme
(act 'etsy/receipts (list 'this-week)
     'reconcile-against-cortex-checkpoint)
```
*;; generated example*

---

### `(etsy/ledger)` / `(etsy/reprice id price)` / `(etsy/publish id)`

**Backing:** `shops.js:25-39`.
**Wired:** ledger=yes (read). reprice / publish = `Wired: no` until
`FINANCIAL_WRITES_ENABLED` true (per Alfred 2026-06-14 directive).

#### Novice
```scheme
(act 'etsy/ledger (list ':since 'this-week) 'check-ledger)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:185-187`*

#### Intermediate
```scheme
;; reprice — preview-only when flag disabled
(act 'etsy/reprice (list listing-id 1999) 'check-reprice)
```
*;; generated example*

#### Expert
```scheme
;; publish workflow: validate → confirm → publish
(define (publish ctx)
  (if (ctx-get 'operator-confirmed ctx)
      (act 'etsy/publish (list (ctx-get 'listing-id ctx)) 'check-publish)
      (escalate 'awaiting-confirmation null)))
```
*;; generated example*

---

### `(ebay/inventory-items)` / `(ebay/payouts)` / `(ebay/offer id)`

**Backing:** `shops.js:57, 98, 63`.
**Wired:** read verbs = yes. State-changers (`publish-offer`,
`issue-refund`) = `Wired: no` until financial flag enabled.

#### Novice
```scheme
(act 'ebay/payouts '() 'render)
```
*;; generated example, real verb at `shops.js:98`*

#### Intermediate
```scheme
(define (fetch ctx)
  (act 'ebay/inventory-items '() 'check-inv))
```
*;; generated example*

#### Expert
```scheme
;; per-sku flow
(let ((sku (ctx-get 'sku ctx)))
  (act 'ebay/inventory-item (list sku) 'check-item))
```
*;; generated example*

---

### `(shopify/orders [filter])` / `(shopify/products [filter])` / `(shopify/reprice variant price)`

**Backing:** `shops.js:124-148`.
**Wired:** reads yes; financial writes gated.

#### Novice
```scheme
(act 'shopify/orders '() 'render)
```
*;; generated example, verb at `shops.js:135`*

#### Intermediate
```scheme
(act 'shopify/products (list 'active) 'check-products)
```
*;; generated example*

#### Expert
```scheme
;; tier-gated reprice
(when (eq? (ctx-get 'tier ctx) 'magic)
  (act 'shopify/reprice
       (list (ctx-get 'variant-id ctx)
             (round2 (markup cost 35)))
       'check-reprice))
```
*;; generated example, `markup` is base.js:215*

---

### `(meta/catalogs)` / `(meta/products catalog)` / `(meta/batch catalog items)`

**Backing:** `shops.js:152-168`.
**Wired:** reads yes; writes (`create-product`, `batch`) gated.

#### Novice
```scheme
(act 'meta/catalogs '() 'render-catalogs)
```
*;; generated example, verb at `shops.js:153`*

#### Intermediate
```scheme
(act 'meta/products (list (ctx-get 'catalog-id ctx)) 'check)
```
*;; generated example*

#### Expert
```scheme
;; ads-list-ad-accounts is the next-layer verb; not yet in shops.js
;; — flagged Wired: no until added.
(escalate 'service-not-yet-wired
          '(:reason "meta/ads-list-ad-accounts pending"))
```
*;; generated example*

> **NOTE:** `meta/ads-list-ad-accounts` is requested but NOT in
> `shops.js` as of 2026-06-15. **Wired: no.**

---

### `(instagram/feed-post …)` and `(google/sheets-append-row …)`

**Backing:** routed via `carts/google/*.sks` manifest; uses
`sakura/relay` (`carts/google/manifest.js:78`).
**Wired:** no — manifest-declared, routes through the lacuna
multi-tool relay; the relay returns `'service-not-yet-wired`
until the per-vendor PKCE flow lands.

#### Novice
```scheme
(act 'instagram/feed-post
     (list (ctx-get 'image-url ctx) (ctx-get 'caption ctx))
     'check-post)
```
*;; generated example*

#### Intermediate
```scheme
(act 'google/sheets-append-row
     (list (ctx-get 'sheet-id ctx)
           (ctx-get 'tab-name ctx)
           (list date revenue orders))
     'after-append)
```
*;; generated example*

#### Expert
```scheme
;; honest fallback when the relay isn't wired
(cond
  ((eq? (ctx-get 'status ctx) 'not-yet-wired)
     (escalate 'service-not-yet-wired
               '(:vendor instagram :reason "PKCE flow pending")))
  (else
     (act 'instagram/feed-post (list url caption) 'check-post)))
```
*;; generated example*

---

## 7. Paint + visual primitives

Installed by `installPaintKit` (`curator-web/src/paint/index.js:127-180`).
29 primitives total at v2.20.0. Each returns a paint handle the motion
verbs can drive. Every entry has `perm: 'paint'` and is registered with
the scene-graph (sceneGraph.js) so drawings become addressable like
cards.

**Wired:** yes — every entry listed in `PAINT_PRIMITIVES`
(paint/index.js:86-122) is bound. Several procedural entries
(`paint-mesh`, `paint-displace`, etc.) declare their signature; the
math is fully wired for the substrate/glyph/animated categories.

### `(paint-arrow from to colour)`

```verb-card paint-arrow
```

**Returns:** PaintHandle (kind 'arrow).
**Backing:** `curator-web/src/paint/primitives/arrow.js`; registered via
`paint/index.js:100`.
**Wired:** yes.

#### Novice
```scheme
(paint-arrow '#anchor/center '#anchor/right 'sakura-pink)
```
*;; generated example, anchors from `make-character` address grammar*

#### Intermediate
```scheme
(paint-arrow 'price-ladder-card
             ':anchors  anchors
             ':labels   copy-lines
             ':glow     'warm-amber)
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:280-283`*

#### Expert
```scheme
;; arrow per row, colour-mapped by delta sign
(for-each
  (lambda (row)
    (paint-arrow (assq 'from row)
                 (assq 'to row)
                 (if (> (assq 'delta row) 0) 'mint 'rose)))
  rows)
```
*;; generated example*

---

### `(paint-burst at colour ms)`

**Returns:** PaintHandle (kind 'burst, animated).
**Backing:** `paint/primitives/burst.js`; `paint/index.js:112`.
**Wired:** yes. powerTier 'animate' (skips at quarter/paused).

#### Novice
```scheme
(paint-burst '#anchor/center 'sakura-pink 800)
```
*;; generated example*

#### Intermediate
```scheme
(paint-burst src 'sakura 600)
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.test.js:9`*

#### Expert
```scheme
;; coordinated burst at every connected shop card
(for-each (lambda (shop-card)
            (paint-burst shop-card 'sakura-pink 500))
          (ctx-get 'connected-shop-cards ctx))
```
*;; generated example*

---

### `(paint-clear [region])`

**Returns:** PaintHandle (kind 'clear).
**Backing:** `paint/primitives/clear.js`; `paint/index.js:91`.
**Wired:** yes. EVERYWHERE-clear (no region or `'everywhere`) also
wipes the scene-graph registry (paint/index.js:163-166).

#### Novice
```scheme
(paint-clear)
;; → clears all paints, registry, returns handle
```
*;; generated example*

#### Intermediate
```scheme
;; clear one region
(paint-clear (list ':bbox 0 0 800 200))
```
*;; generated example*

#### Expert
```scheme
;; clean up after a scene exits
(begin
  (paint-clear)
  (surface-restore)
  (done))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.test.js:155`*

---

### `(paint-emoji glyph at)`

**Returns:** PaintHandle (kind 'emoji).
**Backing:** `paint/primitives/emoji.js`; `paint/index.js:114`.
**Wired:** yes — uses the dot-matrix emoji atlas.

#### Novice
```scheme
(paint-emoji '💃 '#anchor/center)
```
*;; generated example*

#### Intermediate
```scheme
;; emoji at every flower's address
(for-each (lambda (a) (paint-emoji '🌸 a))
          (list '#sprite/blossom '#sprite/rose '#sprite/coral))
```
*;; generated example, real sprite ids*

#### Expert
```scheme
;; thought-bubble decoration around a sprite
(let ((bubble-points (around '#sprite/blossom 32 12)))
  (for-each (lambda (p) (paint-emoji '💭 p)) bubble-points))
```
*;; generated example*

---

### `(paint-fireworks at colour-set ms)`

**Returns:** PaintHandle (kind 'fireworks, animated).
**Backing:** `paint/primitives/fireworks.js`; `paint/index.js:111`.
**Wired:** yes.

#### Novice
```scheme
(paint-fireworks '#anchor/center (list 'sakura-pink 'lilac) 1500)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-result ctx) 'sold)
  (paint-fireworks '#card/sale-card (list 'mint 'sakura-pink) 1200))
```
*;; generated example*

#### Expert
```scheme
;; celebration at every newly-sold listing
(for-each (lambda (id)
            (paint-fireworks (list 'card id)
                             (list 'sakura-pink 'lilac 'mint)
                             1500))
          (ctx-get 'newly-sold-ids ctx))
```
*;; generated example*

---

### `(paint-flow from to glyph count [colour])`

**Returns:** PaintHandle (kind 'flow, animated).
**Backing:** `paint/primitives/flow.js`; `paint/index.js:107`.
**Wired:** yes. The transfer scene's grayscale-channel verb.

#### Novice
```scheme
(paint-flow 'card-a 'card-b 'glyph/heart 8 'sakura-pink)
```
*;; generated example*

#### Intermediate
```scheme
;; flow from each shop to the central card
(for-each (lambda (shop-card)
            (paint-flow shop-card '#card/cortex 'glyph/dot 5 'mint))
          (ctx-get 'connected-shops ctx))
```
*;; generated example*

#### Expert
```scheme
;; transfer-scene-style: dots flowing src → dst with glow at each end
(begin
  (paint-glow src 'sakura 600)
  (paint-glow dst 'sakura 600)
  (paint-flow src dst 'glyph/box 12 'sakura-pink))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.sks:132-133`*

---

### `(paint-glow target colour ms)`

**Returns:** PaintHandle (kind 'glow, animated).
**Backing:** `paint/primitives/glow.js`; `paint/index.js:108`.
**Wired:** yes. The canonical Sakura signature (8px sakura-magic
glow per [[feedback_sakura_action_glow]]).

#### Novice
```scheme
(paint-glow '#anchor/center 'sakura-pink 1200)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:170`*

#### Intermediate
```scheme
(paint-glow '#sprite/blossom 'sakura-pink 1200)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:170`*

#### Expert
```scheme
;; brief glow around every newly-sold listing, sequenced
(for-each (lambda (id)
            (paint-glow (list 'card id) 'sakura-pink 800))
          (ctx-get 'newly-sold-ids ctx))
```
*;; generated example*

---

### `(paint-heart at [colour])`

**Returns:** PaintHandle (kind 'heart).
**Backing:** `paint/primitives/heart.js`; `paint/index.js:102`.
**Wired:** yes.

#### Novice
```scheme
(paint-heart '#anchor/center 'sakura-pink)
```
*;; generated example, real anchor address*

#### Intermediate
```scheme
;; one heart per loved listing
(for-each (lambda (l) (paint-heart (list 'card l) 'sakura-pink))
          (ctx-get 'loved ctx))
```
*;; generated example*

#### Expert
```scheme
;; cascading hearts around a sprite
(let ((pts (around '#sprite/coral 20 8)))
  (for-each (lambda (p) (paint-heart p 'sakura-pink)) pts))
```
*;; generated example*

---

### `(paint-highlight card-addr [colour])`

**Returns:** PaintHandle (kind 'highlight).
**Backing:** `paint/primitives/highlight.js`; `paint/index.js:104`.
**Wired:** yes.

#### Novice
```scheme
(paint-highlight '#card/cortex 'mint)
```
*;; generated example*

#### Intermediate
```scheme
(paint-highlight (list 'card listing-id) 'warm-amber)
```
*;; generated example*

#### Expert
```scheme
(for-each (lambda (id)
            (paint-highlight (list 'card id) 'sakura-pink))
          (ctx-get 'at-risk ctx))
```
*;; generated example*

---

### `(paint-grid surface palette)`

**Returns:** integer (count of cells painted).
**Backing:** `curator-web/src/scheme/grid.js:695`.
**Wired:** yes. The Canvas Dreams cellular substrate.

#### Novice
```scheme
(paint-grid 'desktop (palette 'sakura))
```
*;; generated example, palette = `curator-web/src/scheme/palette.js`*

#### Intermediate
```scheme
(define (start ctx)
  (paint-grid 'desktop 'sakura)
  (next 'await-tap ctx))
```
*;; generated example*

#### Expert
```scheme
;; on-canvas-pattern read after grid paint
(begin
  (paint-grid 'desktop (palette 'mint))
  (on-canvas-pattern 'wave (lambda (ev) (paint-burst ev 'lilac 400))))
```
*;; generated example*

---

### `(paint-marquee text band speed)`

**Returns:** PaintHandle (kind 'marquee, animated).
**Backing:** `paint/primitives/marquee.js`; `paint/index.js:90`.
**Wired:** yes. The narrating bottom-band per
[[curator-canvas-is-sakuras-home]].

#### Novice
```scheme
(paint-marquee "Five flowers · slow waltz" 'bottom 4000)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:162`*

#### Intermediate
```scheme
;; per-state narration
(paint-marquee (ctx-get 'narration ctx) 'top 3000)
```
*;; generated example*

#### Expert
```scheme
;; sequenced marquees per scene beat
(begin
  (paint-marquee "Reading shops..." 'bottom 2000)
  (act 'etsy/listings '() 'check)
  (paint-marquee "Cross-referencing..." 'bottom 2000))
```
*;; generated example*

---

### `(paint-point-at card-addr)`

**Returns:** PaintHandle (kind 'point-at).
**Backing:** `paint/primitives/point-at.js`; `paint/index.js:101`.
**Wired:** yes.

#### Novice
```scheme
(paint-point-at '#card/cortex)
```
*;; generated example*

#### Intermediate
```scheme
(paint-point-at (list 'card (ctx-get 'highlight-id ctx)))
```
*;; generated example*

#### Expert
```scheme
;; chained point-at + flow + glow
(begin
  (paint-point-at '#card/sale-card)
  (paint-flow '#card/cortex '#card/sale-card 'glyph/dot 6 'sakura-pink)
  (paint-glow '#card/sale-card 'sakura-pink 800))
```
*;; generated example*

---

### `(paint-spiral centre radius turns colour)`

**Returns:** PaintHandle.
**Backing:** `paint/primitives/spiral.js`; `paint/index.js:97`.
**Wired:** yes.

#### Novice
```scheme
(paint-spiral '#anchor/center 120 3 'lilac)
```
*;; generated example*

#### Intermediate
```scheme
(paint-spiral (list 'card listing-id) 80 2 'warm-amber)
```
*;; generated example*

#### Expert
```scheme
;; sized by score
(paint-spiral '#anchor/center
              (lerp 40 200 (clamp (ctx-get 'score ctx) 0 1))
              3
              'sakura-pink)
```
*;; generated example*

---

### `(paint-text text at [opts...])`

**Returns:** PaintHandle (kind 'text).
**Backing:** `paint/primitives/text.js`; `paint/index.js:89`.
**Wired:** yes. Stroke-mode `'handwriting` paints dot-by-dot per
Sakura's voice (Sakura Magic per [[feedback-sakura-magic-signature]]).

#### Novice
```scheme
(paint-text "Hello Surface" '#anchor/center
            ':stroke-mode 'handwriting
            ':wpm 110)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/dot-matrix-greeting.sks:84-86`*

#### Intermediate
```scheme
(paint-text "tap anywhere" '#anchor/center
            ':alpha 0.6)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/falling-petals-on-tap.sks:81`*

#### Expert
```scheme
;; sakura's spoken-reply pattern — addressable dots, twinkle, motion
(paint-text reply
            '#anchor/sakura-mouth
            ':stroke-mode 'handwriting
            ':colour 'sakura-pink
            ':twinkle #t
            ':wpm 110)
```
*Source: pattern from [[project_sakura_reply_dot_matrix]] + dot-matrix-greeting.sks:84*

---

### `(paint-twinkle region density)` / `(paint-pulse card-addr ms)`

**Returns:** PaintHandle (animated).
**Backing:** `paint/primitives/twinkle.js`, `pulse.js`;
`paint/index.js:109-110`.
**Wired:** yes.

#### Novice
```scheme
(paint-twinkle (list ':bbox 0 0 800 200) 0.4)
(paint-pulse '#card/cortex 1200)
```
*;; generated example*

#### Intermediate
```scheme
(when (ctx-get 'idle ctx)
  (paint-twinkle (list ':full-canvas) 0.3))
```
*;; generated example*

#### Expert
```scheme
;; pulse all at-risk cards, twinkle the background
(for-each (lambda (id) (paint-pulse (list 'card id) 1200))
          (ctx-get 'at-risk ctx))
(paint-twinkle (list ':bbox 0 0 1200 800) 0.2)
```
*;; generated example*

---

### `(paint-line from to colour)` / `(paint-rect x y w h colour)` / `(paint-arc centre r start end)` / `(paint-circle centre r colour)` / `(paint-pipe from to colour thickness)`

**Backing:** `paint/primitives/{line,rect,arc,circle,pipe}.js`;
`paint/index.js:93-98`.
**Wired:** yes. The geometry kit (5 primitives, +1 pipe).

#### Novice
```scheme
(paint-line '(0 0) '(100 100) 'mint)
(paint-rect 10 10 80 40 'lilac)
(paint-circle '#anchor/center 50 'sakura-pink)
```
*;; generated example*

#### Intermediate
```scheme
(paint-arc '#anchor/center 80 0 3.14 'warm-amber)
(paint-pipe 'card-a 'card-b 'mint 4)
```
*;; generated example*

#### Expert
```scheme
;; histogram of rows by metric value
(for-each (lambda (row i)
            (paint-rect (* i 20) 200
                        12 (* (assq 'metric row) 4)
                        (if (> (assq 'metric row) threshold) 'rose 'mint)))
          rows (range 0 (length rows)))
```
*;; generated example (uses base.js list ops)*

---

## 8. Sprite + body verbs

Sprite verbs are the operator-and-Sakura voice for the 16 dot-matrix
helpers. Atoms + combinators installed by `installSpriteVerbs`
(`curator-web/src/scheme/spriteVerbs.js:366`). Sprite ids are real
palette names from `spriteBehaviors.js:120-136`: blossom, rose, coral,
amber, butter, mint, fern, sky, ocean, lilac, grape, cedar, gray,
slate, black, white.

**Wired:** mixed.
- `(sprite …)` dispatcher: yes.
- `(sprites who …)` plural: yes.
- Atoms that LOWER to existing verbs (`carry`, `hand-to`, `set-down`,
  `flash`): yes — lower to move-card, transfer, receive-listing,
  card-effect.
- Atoms needing the visual engine (`(dance 'clip-name)`,
  `(point-at)`, `(beckon)`, etc.): return `['pending-visual', …]`
  envelopes — honest. **Wired: partial.**
- `(turn deg)` clamped 0..360, `(size factor)` clamped 0.5..3.0 —
  envelope path.

### `(sprite name atom-or-combinator)`

```verb-card sprite
```

**Returns:** `'ok` envelope if the atom lowers to a real verb;
`'pending-visual` envelope otherwise.
**Backing:** `curator-web/src/scheme/spriteVerbs.js:393-431`.

#### Novice
```scheme
(sprite 'blossom (carry "vase-001" 50 75))
```
*Source: pattern from `spriteVerbs.js:7` — lowers to `move-card`*

#### Intermediate
```scheme
(sprite 'rose (in-order (turn 90) (flash "glow")))
```
*Source: example from `spriteVerbs.js:10`*

#### Expert
```scheme
;; quoted-list form is the ONLY way to reach `when` (collides with the
;; interpreter special form). spriteVerbs.js:36 documents this.
(sprite 'lilac '(when (rest) (flash glow)))
```
*Source: `curator-web/src/scheme/spriteVerbs.js:36`*

---

### `(sprites who form...)`

**Returns:** envelope per-resolved-sprite or per-crowd.
**Backing:** `spriteVerbs.js:436`.
**Wired:** yes — family addressing through `the-pinks`,
`the-purples`, `the-neutrals`, `everyone` (spriteVerbs.js:434).

#### Novice
```scheme
(sprites '(blossom rose coral) (rest))
```
*;; generated example*

#### Intermediate
```scheme
(sprites 'the-pinks (gather '#anchor/center))
```
*;; generated example, family from spriteVerbs.js:433-434*

#### Expert
```scheme
;; everyone bows in sequence
(sprites 'everyone
         (in-order (bow)
                   (wait-for 400)
                   (rest)))
```
*;; generated example*

---

### `(carry id x y)`

**Returns:** lowers to `(move-card id x y)`.
**Backing:** `spriteBehaviors.js:98` (atom); `cardVerbs.js:307`
(move-card backing).
**Wired:** yes.

#### Novice
```scheme
(sprite 'blossom (carry "vase-001" 50 75))
```
*Source: `spriteVerbs.js:7`*

#### Intermediate
```scheme
(sprite 'cedar (carry (ctx-get 'item-id ctx)
                      (ctx-get 'target-x ctx)
                      (ctx-get 'target-y ctx)))
```
*;; generated example*

#### Expert
```scheme
(for-each
  (lambda (item)
    (sprite 'gray (carry (assq 'id item) (assq 'x item) (assq 'y item))))
  (ctx-get 'manifest ctx))
```
*;; generated example*

---

### `(go-to addr)` / `(visit addr)` / `(follow target)` / `(rest)`

**Backing:** `spriteBehaviors.js:92-107` atoms.
**Wired:** `(rest)` lowers honestly to an idle; others
return `['pending-visual', …]` envelopes until the engine wires
them. **Wired: partial.**

#### Novice
```scheme
(sprite 'mint (go-to '#anchor/top-right))
(sprite 'fern (rest))
```
*;; generated example, anchors from `make-character` addressing*

#### Intermediate
```scheme
(sprites 'the-neutrals (line-up '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; choreography — gather, recruit, settle
(sprite 'coral
        (in-order (gather '#anchor/coral-spot)
                  (recruit '(amber butter))
                  (rest)))
```
*;; generated example, atoms from spriteBehaviors.js:92-107*

---

### `(flash target [magic])` / `(point-at target)` / `(beckon target)` / `(bow)` / `(wear emoji)`

**Backing:** `spriteBehaviors.js:99-100`.
**Wired:** `(flash …)` lowers to `card-effect`. Others =
`['pending-visual', …]`. **Wired: partial.**

#### Novice
```scheme
(sprite 'rose (flash "glow"))
```
*Source: `spriteVerbs.js:10`*

#### Intermediate
```scheme
(sprite 'lilac (point-at '#card/cortex))
(sprite 'amber (wear '🎀))
```
*;; generated example*

#### Expert
```scheme
(sprite 'blossom
        (together (flash 'glow)
                  (point-at '#card/sale-card)
                  (bow)))
```
*;; generated example, combinator from spriteBehaviors.js:113*

---

### `(turn deg)` / `(size factor)`

**Backing:** `spriteVerbs.js:91-95`; clamps in CLAMPS.
**Wired:** yes — clamped envelope (`pending-visual`).

#### Novice
```scheme
(sprite 'rose (turn 90))
```
*Source: `spriteVerbs.js:9`*

#### Intermediate
```scheme
(sprite 'mint (size 2.0))
```
*Source: `spriteVerbs.js:8`*

#### Expert
```scheme
(sprite 'sky
        (in-order (size 1.5)
                  (turn 180)
                  (with-pace 0.5
                             (in-order (go-to '#anchor/sky-spot)
                                       (rest)))))
```
*;; generated example*

---

### `(in-order …)` / `(together …)` / `(repeat-until pred …)` / `(with-pace n …)` / `(as-crowd …)`

**Backing:** `spriteBehaviors.js:113-115` combinators.
**Wired:** yes — pure constructors, frozen specs.

#### Novice
```scheme
(sprite 'blossom (together (flash "glow") (rest)))
```
*;; generated example*

#### Intermediate
```scheme
(sprite 'coral (in-order (gather '#anchor/center)
                          (rest)
                          (bow)))
```
*;; generated example*

#### Expert
```scheme
;; repeat-until pattern for a watcher
(sprite 'mint
        (repeat-until (lambda () (eq? (ctx-get 'done ctx) #t))
                      (in-order (visit '#anchor/queue)
                                (rest))))
```
*;; generated example*

---

### `(dance 'clip-name)`

**Backing:** declared in spriteBehaviors atoms list as a clip atom;
not yet wired to a clip player.
**Wired:** no — `['pending-visual', …]` envelope; honest.

#### Novice
```scheme
(sprite 'blossom (dance 'waltz))
;; → pending-visual envelope, never an unannounced no-op
```
*;; generated example*

#### Intermediate
```scheme
(sprites 'the-pinks (dance 'flower-conga))
```
*;; generated example*

#### Expert
```scheme
;; honest fallback when the clip player isn't wired
(let ((result (sprite 'rose (dance 'spin-finale))))
  (cond
    ((eq? (car result) 'pending-visual)
       (sprite 'rose (in-order (turn 360) (rest))))
    (else result)))
```
*;; generated example*

---

## 9. Note + music verbs

Bound by `installNoteVerbs` (`curator-web/src/scheme/noteVerbs.js:92`).
Audio is gated by a user gesture (`audioLive()`); first call without
gesture returns `'pending-audio'` envelope — honest.

**Wired:** yes (all 5 listed).

### `(note pitch [dur] [velocity])`

**Returns:** `(ok (note … spec …))` or `(pending-audio …)`.
**Backing:** `curator-web/src/scheme/noteVerbs.js:96-123`.

#### Novice
```scheme
(note 'c4 'quarter)
```
*Source: pattern from `noteVerbs.js:95`*

#### Intermediate
```scheme
(note 'e4 'eighth 0.6)
```
*;; generated example*

#### Expert
```scheme
;; sequence of notes, audio-gated
(for-each (lambda (p) (note p 'eighth 0.8))
          '(c4 d4 e4 f4 g4 a4 b4 c5))
```
*Source: pattern from form/scale macro (primitives/macros.js:228-238)*

---

### `(note-place pitch [stave] [clef])`

**Returns:** `(ok (note … y … clef …))`.
**Backing:** `noteVerbs.js:127-146`.

#### Novice
```scheme
(note-place 'e4 0 'treble)
```
*;; generated example*

#### Intermediate
```scheme
(note-place 'g4 1 'bass)
```
*;; generated example*

#### Expert
```scheme
;; place a sequence at known stave geometry
(for-each (lambda (p) (note-place p 0 'treble))
          '(c4 e4 g4))
```
*;; generated example*

---

### `(note-dots pitch [dur] [stave] [clef])`

**Returns:** the deterministic `{x,y,fill}` cells of the note glyph.
**Backing:** `noteVerbs.js:152-168`.

#### Novice
```scheme
(note-dots 'e4 'quarter)
```
*;; generated example*

#### Intermediate
```scheme
(let ((cells (note-dots 'f4 'eighth 0 'treble)))
  (paint-dots cells))
```
*;; generated example*

#### Expert
```scheme
;; render the dot-matrix flag of a sixteenth note
(let ((c (note-dots 'a4 'sixteenth 0 'treble)))
  (paint-dots (assq 'dots c)))
```
*;; generated example*

---

### `(staff-lines [w] [h] [clef])`

**Returns:** geometry alist (lineCount, lineYs, gap, …).
**Backing:** `noteVerbs.js:171-188`.

#### Novice
```scheme
(staff-lines 600 200 'treble)
```
*;; generated example*

#### Intermediate
```scheme
(let ((g (staff-lines 800 240 'bass)))
  (paint-line (list 0 (assq 'firstLineY g))
              (list 800 (assq 'firstLineY g))
              'gray))
```
*;; generated example*

#### Expert
```scheme
;; render every line of the active stave
(let ((g (staff-lines 800 240 'treble)))
  (for-each (lambda (s)
              (for-each (lambda (y)
                          (paint-line (list 0 y) (list 800 y) 'gray))
                        (assq 'lineYs s)))
            (assq 'staves g)))
```
*;; generated example*

---

### `(tempo bpm)`

**Returns:** `(ok (bpm … secondsPerBeat …))`.
**Backing:** `noteVerbs.js:191-203`.
**Side effects:** mutates the shared transport singleton.
**Wired:** yes.

#### Novice
```scheme
(tempo 96)
```
*;; generated example, pattern from noteVerbs.js:191*

#### Intermediate
```scheme
(define (start ctx)
  (tempo 120)
  (next 'play ctx))
```
*;; generated example*

#### Expert
```scheme
;; slow ramp via a sequence of tempo calls
(for-each (lambda (b) (tempo b))
          '(120 110 100 90 80))
```
*;; generated example*

---

### `(chord pitches dur)` / `(rest dur)` / `(staff lines)` — macros from `musicSugar`

**Backing:** `curator-web/src/scheme/musicSugar.js`.
**Wired:** partial — sugar over the primitive `(note …)` verb.

#### Novice
```scheme
(chord '(c4 e4 g4) 'quarter)
```
*;; generated example, modelled on musicSugar*

#### Intermediate
```scheme
(in-order (chord '(c4 e4 g4) 'quarter)
          (rest 'quarter)
          (chord '(g4 b4 d5) 'quarter))
```
*;; generated example*

#### Expert
```scheme
;; chord progression: I — vi — ii — V in C
(in-order (chord '(c4 e4 g4) 'quarter)
          (chord '(a4 c5 e5) 'quarter)
          (chord '(d4 f4 a4) 'quarter)
          (chord '(g4 b4 d5) 'quarter))
```
*Source: chord roots from form/I-vi-ii-V (primitives/macros.js:212-218)*

---

## 10. FX + animation atoms

FX verbs are installed by `installFxVerbs`
(`curator-web/src/scheme/fxVerbs.js:96-208`). Timeline / animate /
keyframe / easing return frozen specs the renderer reads. `random`
is the seeded PRNG (env-local) so cart replay is byte-identical.

**Wired:** yes — all 8 listed; `surface-dusk` and `on-canvas-trace`
both fully wired.

### `(timeline track …)` / `(keyframe at val)` / `(animate target prop from to ms easing)`

**Backing:** `fxVerbs.js:113-155`.

#### Novice
```scheme
(timeline (keyframe 0 0) (keyframe 1000 100))
```
*;; generated example*

#### Intermediate
```scheme
(timeline (animate '#card/sale-card 'opacity 0 1 800 'ease-out))
```
*;; generated example*

#### Expert
```scheme
;; multi-track timeline with loop
(timeline (animate '#sprite/blossom 'rotate 0 360 4000 'linear)
          (animate '#sprite/blossom 'scale 1.0 1.2 2000 'ease-in-out)
          (loop))
```
*;; generated example*

---

### `(easing name)` / `(loop)`

**Backing:** `fxVerbs.js:160-167, 135`.

#### Novice
```scheme
(easing 'ease-out)
```
*;; generated example*

#### Intermediate
```scheme
(animate '#card/cortex 'y 100 200 600 (easing 'ease-in-out))
```
*;; generated example*

#### Expert
```scheme
;; honest fallback — unknown easing falls back to 'linear (fxVerbs.js:163-167)
(easing 'wibble)
;; → spec with name 'linear and fn = linear
```
*Source: `fxVerbs.js:163-167`*

---

### `(random-seed! n)` / `(random)`

**Backing:** `fxVerbs.js:173-176`.
**Wired:** yes. The ONLY entropy source in the FX surface — determinism
law §7.12.

#### Novice
```scheme
(random-seed! 42)
(random)
;; → seeded float in [0,1)
```
*;; generated example*

#### Intermediate
```scheme
(define (jitter base)
  (+ base (* 4 (- (random) 0.5))))
```
*;; generated example*

#### Expert
```scheme
;; deterministic cart replay — seed once at start
(define (start ctx)
  (random-seed! (ctx-get 'replay-seed ctx))
  (next 'paint ctx))
```
*;; generated example*

---

### `(surface-dusk level [opts])` / `(on-canvas-trace handler)`

**Backing:** `fxVerbs.js:183-205`.
**Wired:** yes — dusk lifts the dusk pocket; on-canvas-trace is the
connect-the-dots trace handler.

#### Novice
```scheme
(surface-dusk 0.4)
```
*;; generated example*

#### Intermediate
```scheme
(begin
  (surface-dusk 0.6)
  (paint-spotlight '#anchor/center 200))
```
*;; generated example*

#### Expert
```scheme
(on-canvas-trace
  (lambda (samples)
    (when (> (length samples) 8)
      (paint-flow (car samples) (last samples) 'glyph/dot 6 'sakura-pink))))
```
*;; generated example*

---

### `surface/dim` / `surface/spotlight` / `surface/curtain` (core verbs)

**Backing:** `curator-web/src/scheme/registry/coreVerbs.js:123-155`.
**Wired:** yes (signature contract; engine lane wires the body).

#### Novice
```scheme
(surface/curtain 0.7 :ms 8000)
```
*Source: `curator-web/src/scheme/carts/scenes/bedtime-story-engine.sks:135`*

#### Intermediate
```scheme
(surface/spotlight '#anchor/center :radius 220 :softness 100 :ms 8000)
```
*Source: `curator-web/src/scheme/carts/scenes/bedtime-story-engine.sks:136`*

#### Expert
```scheme
;; surface/stage macro: dim + spotlight at one beat
(surface/stage :dim 0.8 :ms 4000)
```
*Source: pattern from primitives/macros.js:251-253*

---

## 11. Card surface verbs

Installed by `installCardVerbs` (`curator-web/src/scheme/cardVerbs.js:88`).
Cards are addressable via `(card-do …)`, `(card-emit …)`,
`(card-ask …)`, with a manifest layer for verb resolution. The
manifest registry lives in `surface/card-api/`.

**Wired:** mostly yes — see per-entry notes.

### `(card-do card-addr verb args)`

**Returns:** `(ok …)` from the card's verb body.
**Backing:** primitive at `curator-web/src/scheme/primitives/card.js:140 · env.define('card/do', cardDo, …)` and `:146 · env.define('card-do', cardDo, …)` (the slash form + legacy hyphen). Runtime resolution in `cardVerbs.js`.
<!-- DOC-LIE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:158-168` is STALE — `card-do` / `card-emit` / `card-ask` are NOT in `registry/coreVerbs.js` (grep confirms zero hits). They live in `primitives/card.js:140-170`. The same fix applies to the §card-emit and §card-ask entries below. -->

#### Novice
```scheme
(card-do shop 'set-free-shipping-threshold cents)
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:22, 30`*

#### Intermediate
```scheme
(card-do '#card/shop-services 'read-gmail-folder folder)
```
*Source: `curator-web/src/scheme/carts/scenes/email-inbox.sks:26`*

#### Expert
```scheme
(card-do shop 'unpublish-listing listing)
```
*Source: `curator-web/src/scheme/carts/scenes/reconcile-sold.sks:18, 29`*

---

### `(card-emit card-addr event-name payload)`

**Returns:** EmitHandle.
**Backing:** `curator-web/src/scheme/primitives/card.js:152 · env.define('card/emit', cardEmit, …)` and `:158 · env.define('card-emit', cardEmit, …)`.
<!-- STALE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:170-180` was wrong (verb is not in coreVerbs.js). -->

#### Novice
```scheme
(card-emit 'engine 'daily-brief-ready (length rows))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:197`*

#### Intermediate
```scheme
(card-emit 'engine 'free-shipping-shop-ok shop)
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:65`*

#### Expert
```scheme
(card-emit 'engine 'free-shipping-attempted
           (list 'count (length shops)))
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:50`*

---

### `(card-ask card-addr question)`

**Returns:** AnswerHandle (resolves async).
**Backing:** `curator-web/src/scheme/primitives/card.js:164 · env.define('card/ask', cardAsk, …)` and `:170 · env.define('card-ask', cardAsk, …)`.
<!-- STALE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:182-192` was wrong. -->
**Wired:** partial — primitive signature shipped, resolver lane
in progress.

#### Novice
```scheme
(card-ask '#card/inventory 'item-count)
```
*;; generated example*

#### Intermediate
```scheme
(let ((q (card-ask '#card/cortex 'recent-topics)))
  (next 'render (ctx-set 'topics q ctx)))
```
*;; generated example*

#### Expert
```scheme
;; chain ask → act on answer
(card-ask '#card/shop-services 'connected-platforms)
```
*;; generated example*

---

### `(card-list)` / `(card-rows)` / `(card-kinds)` / `(card-find-by-kind kind)`

**Backing:** `cardVerbs.js:90-147`. All read verbs.

#### Novice
```scheme
(card-list)
;; → (("card-1" "chat") ("card-2" "shop-listing") ...)
```
*;; generated example, from cardVerbs.js:90*

#### Intermediate
```scheme
(card-find-by-kind 'shop-listing)
```
*;; generated example*

#### Expert
```scheme
(for-each (lambda (id)
            (card-emit id 'refresh-requested 'now))
          (card-find-by-kind 'shop-listing))
```
*;; generated example*

---

### `(card-open kind-or-id)` / `(card-close kind-or-id)` / `(card-focus! kind-or-id)`

**Backing:** `cardVerbs.js:156, 231, 250`. perm: animate.

#### Novice
```scheme
(card-open 'cortex)
```
*;; generated example*

#### Intermediate
```scheme
(define (start ctx)
  (card-open 'shop-services)
  (next 'await-connect ctx))
```
*;; generated example*

#### Expert
```scheme
;; focus, do work, restore
(begin
  (card-focus! (ctx-get 'target-card ctx))
  (act 'cortex/recall (list '(:topic context)) 'after-recall))
```
*;; generated example*

---

### `(move-card id x y)` / `(scale-card id w h)` / `(pin-card id value)`

**Backing:** `cardVerbs.js:307, 323, 374`.
**Wired:** yes.

#### Novice
```scheme
(move-card "card-1" 100 200)
```
*;; generated example*

#### Intermediate
```scheme
(scale-card listing-card 240 96)
```
*;; generated example*

#### Expert
```scheme
;; bricklay-pack-native is the native packer (base.js:396); the cart
;; reads the result list and dispatches per-card move
(for-each (lambda (placement)
            (move-card (car placement)
                       (nth placement 1)
                       (nth placement 2)))
          (bricklay-pack-native cards 800 16 16 8 8))
```
*Source: pattern from base.js:355-504 (bricklay-pack-native)*

---

### `(transfer src-card dst-card item-ids)`

**Returns:** `(ok …)` or `(error …)` envelope.
**Backing:** `cardVerbs.js:434`. Gated; financial when underlying op is.
**Wired:** yes (with confirmation gate).

#### Novice
```scheme
(transfer src-card dst-card (list "vase-001"))
```
*;; generated example*

#### Intermediate
```scheme
(transfer (ctx-get 'src ctx) (ctx-get 'dst ctx) (ctx-get 'items ctx))
```
*;; generated example*

#### Expert
```scheme
;; transfer-shop-to-shop scene pattern
(begin
  (paint-glow src 'sakura 600)
  (paint-flow src dst 'glyph/box 8 'sakura-pink)
  (transfer src dst items)
  (paint-glow dst 'sakura 600))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.sks:132-133`*

---

### `(summon kind)`

**Returns:** newly-summoned card id.
**Backing:** `cardVerbs.js:684`.

#### Novice
```scheme
(summon 'chat)
```
*;; generated example*

#### Intermediate
```scheme
(let ((c (summon 'shop-listing)))
  (card-do c 'set-title "rustic ceramic vase"))
```
*;; generated example*

#### Expert
```scheme
;; summon, configure, focus
(let ((c (summon 'sims)))
  (begin
    (card-do c 'load-sim 'pricing-ladder)
    (card-focus! c)))
```
*;; generated example*

---

### `(card/tiles)` / `(card/where card-name)` / `(card/move card-name :to [col row])` / `(card/swap a b)` / `(card/organize)`

**Namespace:** `card` — grid control verbs.
**Backing:** `curator-web/src/scheme/cardControlVerbs.js:1-226`.
**Wired:** yes.

These five verbs address cards by tile coordinate on the `HelloSurface`
grid (`TILE=96, GAP=20`). They registered in `VerbRegistry` under the
`card` namespace via `registerCardControlVerbs` (2026-06-17).

**Motion modes for `card/move`:** `:slide` (CSS transition), `:warp`
(keyframe warp-out/in via `@keyframes card-warp-out/in` in
`HelloSurface.jsx`), `:carry` (Sakura sprite carries the card along
a computed path).

#### Novice
```scheme
;; card/tiles — get grid map
(card/tiles)
;; → ((0 0 "shop-listing") (1 0 "cortex") (2 0 "analytics") …)

;; card/where — find a card
(card/where "shop-listing")
;; → (0 0)

;; card/move — move to tile [col row]
(card/move "analytics" :to [3 0])
```
*Source: `curator-web/src/scheme/carts/corpus/card-control-corpus.jsonl:1-4`*

#### Intermediate
```scheme
;; slide analytics card to top-right corner
(card/move "analytics" :to [8 0] :mode :slide)

;; swap two cards
(card/swap "shop-listing" "analytics")

;; organize all cards into groups
(card/organize :group-by 'kind)
```
*Source: `curator-web/src/scheme/carts/corpus/card-control-corpus.jsonl:12-20`*

#### Expert
```scheme
;; "Shop Services" scene: warp cortex card center-stage, slide others aside
(let ((center [4 1]))
  (begin
    (card/move "cortex" :to center :mode :warp)
    (for-each (lambda (c)
                (unless (equal? (car c) "cortex")
                  (card/move (car c)
                              :to (list (+ (nth center 0) 3) (nth c 2))
                              :mode :slide)))
              (card/tiles))))
```
*Source: pattern from shop-services scene director; `cardControlVerbs.js:88-130`*

---

### `(card/walk id 'gait tx ty [ms])` — and 8 gait-shorthand verbs

**Returns:** `('ok 'animating {verb,gait,duration,id})` while the rAF walk runs;
`('ok 'snapped {…})` when `prefers-reduced-motion: reduce` is active;
`('error 'bad-arg {…})` on a bad numeric / id; `('error 'service-not-yet-wired
{verb,reason,known:[…]})` on an unknown gait name.
**Backing:** `curator-web/src/scheme/cardWalkVerbs.js:166-279` (installer);
gait curves in `curator-web/src/paint/primitives/cardWalk.js:90-194`.
**Permission tier:** `state-change` (powerTier `animate`).
**Wired:** yes — the verb composes `paintCardWalk` against the overlay clock and
`cardBridge.cardMove`; tested in `cardWalkVerbs.test.js`.
**Honest-null:** unknown gait → `['error','service-not-yet-wired',{verb:'card/walk',
reason:"unknown gait '<name>'",known:[…GAIT_NAMES]}]`. Card has no current
position (boot phase / not placed) → snaps to target, returns
`['ok','snapped-no-start',…]` rather than fabricating a start point.
**Cross-refs:** ENGINEERING §AB (Walk grammar) · AUTOMATIONS sidecar
`sakura-walk-corpus.jsonl` · `docs/CARD-WALK-REALISM-ZANE-2026-06-21.md`.

The 8 gait-shorthand verbs `(card/amble id tx ty [ms])`,
`(card/skip …)`, `(card/run-and-slow …)`, `(card/waddle …)`,
`(card/bounce-stride …)`, `(card/prowl …)`, `(card/stomp …)`,
`(card/glide-pause …)` each delegate to `card/walk` with the gait baked in.
Same envelope shape, same permission tier, same honest-null behaviour.

Duration scales with distance and the card's `weight` axis from
`cardPersonality` (see §AB): `duration_ms = base_ms × clamp(0.6,
distance/200, 2.0) × (1 + 0.15 × (weight − 1)) × paceScale`. The verb
stamps `--card-weight / --card-pace-ms / --card-overshoot` on the card
DOM element so `cards.css` keyframes can read them per tick.

#### Novice
```scheme
;; just walk a card to a tile centre
(card/amble 'shop-explorer-1 400 200)
```
*Source: `curator-web/src/scheme/carts/sakura-walk-corpus.jsonl:8`*

#### Intermediate
```scheme
;; a card got good news — celebrate as it moves
(card/skip 'shop-explorer-3 800 400)
```
*Source: `curator-web/src/scheme/carts/sakura-walk-corpus.jsonl:1`*

#### Expert
```scheme
;; a red trigger fired — slam the alert into place with a 1.18/0.82 landing
(card/walk 'alert-cost-overrun 'stomp 640 400 900)
```
*Source: pattern from `sakura-walk-corpus.jsonl:3`; gait config
`cardWalk.js:192`.*

---

### `(card-effect id 'tilt|'lift|'swing)` — new card-motion effects (2026-06-21)

**Returns:** `'ok` after the one-shot class fires; `['pending-visual', …]`
when no target element is mounted; `['error', 'effect-not-allowed', …]`
on `'shadow` (the glow-never-shadow rejection); `['error', 'unknown-effect',
…]` on an unknown effect name.
**Backing:** `curator-web/src/scheme/cardVerbs.js:758-770` (CARD_EFFECT_CLASS);
keyframes in `curator-web/src/styles/cards.css` (`sakura-fx-tilt`,
`sakura-fx-lift`, `sakura-fx-swing`).
**Permission tier:** `paint`.
**Wired:** yes — `tilt` (900ms), `lift` (1100ms), `swing` (1300ms); composed
via the same one-shot `oneShotEffectClass` idiom motionVerbs.js:67 used.
**Honest-null:** silent-failure VETO #1 — if the card's DOM cell isn't mounted
the verb returns `['pending-visual', …]`, never claims `'ok'`.
**Cross-refs:** ENGINEERING §AB (2-mode engine — Mode B whimsy paints).

These three names extend the existing `card-effect` verb's
`CARD_EFFECT_CLASS` table; they share the verb signature
`(card-effect id 'effect-name [args])`. The full set on disk today is
`'glow 'pulse 'shimmer 'sparkle 'echo 'ghost 'bloom 'tilt 'lift 'swing`.

#### Novice
```scheme
;; one-shot lift on a card that just earned a milestone
(card-effect 'shop-explorer-2 'lift)
```
*;; generated example — tied to `paintWhimsy.js:104`*

#### Intermediate
```scheme
;; a draft was just rejected; tilt the listing card as a soft "nope"
(card-effect 'draft-pending-review 'tilt)
```
*;; generated example*

#### Expert
```scheme
;; weekly-summary cohort: swing each shop card by 80ms apart for the marquee
(let ((shops (card-find-by-kind 'shop-explorer)))
  (for-each (lambda (id) (card-effect id 'swing)) shops))
```
*;; generated example; intensity decay drives whether this even fires —
see `celebrationIntensity.js:165`.*

---

### `(card/activity id label expected-ms)` / `(card/activity-done id)` / `(card/activity-progress id 0..1)`

**Returns:** `card/activity` returns an opaque `activity-id` string the
caller threads back into `card/activity-done`; the latter returns `'ok`
(idempotent — a stale id is a no-op). `card/activity-progress` clamps
to [0,1] and returns `'ok`.
**Backing:** `curator-web/src/scheme/cardVerbs.js:1061-1148` (verb
bindings); bus in `curator-web/src/lib/cardActivityBus.js:1-205`.
**Permission tier:** `paint` — every tier may call them.
**Wired:** yes — rainbow activity bar paints on the card's CardTemplate
chrome strip. Multiple concurrent activities on one card MERGE (bar stays
visible until the LAST `card/activity-done` fires; any indeterminate leg
makes the merged bar indeterminate).
**Honest-null:** unknown card id at begin → escalate via withStars; stale
`activity-id` at done → `'ok` (idempotent — silent no-op is the contract).
**Cross-refs:** ENGINEERING §X (Two-mode animation engine — Mode A).

#### Novice
```scheme
;; indeterminate bar — no measurable progress
(let ((aid (card/activity 'shop-explorer-1 "syncing" 0)))
  (card/activity-done aid))
```
*;; generated example*

#### Intermediate
```scheme
;; a fetch with a Content-Length hint
(let ((aid (card/activity 'cortex "indexing" 2400)))
  (card/activity-progress aid 0.5)
  (card/activity-done aid))
```
*;; generated example*

#### Expert
```scheme
;; two concurrent activities on the same card — bar merges (max progress)
(let ((a (card/activity 'shop-explorer-1 "list sync" 3000))
      (b (card/activity 'shop-explorer-1 "photo fetch" 1500)))
  (card/activity-progress a 0.3)
  (card/activity-progress b 0.9)
  (card/activity-done b)
  (card/activity-done a))
```
*;; generated example — merge semantics in `cardActivityBus.js:82-104`.*

---

### `(card/personality card-id)` — 4-axis Cortex read (read-only)

**Returns:** a 4-axis record `(familiarity pace_match directness weight)`
where each value is in `[0, 1]` (baseline `0.5`). Distress-paused →
returns baseline. prefers-reduced-motion → returns baseline.
**Backing:** `curator-web/src/lib/cardPersonality.js:1-399` (`read` export
imported by `cardWalkVerbs.js:63`).
**Permission tier:** `read` (Cortex personal — read-only at this seam).
**Wired:** yes — the `read()` JS API is consumed by `card/walk` to scale
weight/pace/overshoot. There is no surface-bound Scheme verb yet; carts
that want the axes use the underlying axis effects (heavier walk,
quicker pace) via gait shorthand. Direct verb registration lands when
the SYS panel + cart-author API is wired.
**Honest-null:** unknown card id → baseline record (never throws past
the module boundary; see `cardPersonality.js:48`).
**Cross-refs:** ENGINEERING §Y (Card personality drift); MEMORY
`project_card_personality_over_time`.

Axes:

- `familiarity` — opens-in-30d, drives walk-on cadence (shorter as it grows).
- `pace_match` — EWMA of operator gesture velocity; drives `--card-pace-ms`.
- `directness` — 30d confirmation_ratio; drives `--card-overshoot`.
- `weight` — revenue trend; drives `§4` walk-duration weight multiplier.

Drift is monotonically slow: gated until `DRIFT_GATE_OPENS=7` daily opens;
step size `PER_OPEN_STEP=0.02`. Jess floor in effect (no manipulative
recovery overshoot; pauseDriftWriting on distress; privacy stays local).

#### Novice
```scheme
;; carts don't read personality directly today — the gait shorthand does
;; it for them. The verb that triggers axis effects is just (card/walk …).
(card/amble 'shop-explorer-1 400 200)
```
*;; generated example — see `cardWalkVerbs.js:229-238`*

#### Intermediate
```scheme
;; pattern: a celebratory walk on an EARNED milestone reads the weight
;; axis automatically — bigger cards squash harder on land
(card/bounce-stride 'etsy-revenue 720 280)
```
*Source: `sakura-walk-corpus.jsonl:5`*

#### Expert
```scheme
;; the personality READ is a JS-side composition for now; carts get the
;; axis effects via the gait curves' duration-scaling formula
;; (see ENGINEERING §AB).
(card/walk 'analysis-cohort-2 'prowl 500 350)
```
*Source: `sakura-walk-corpus.jsonl:4`*

---

### `(imagine "word" [:seconds N])` / `(emoji-paint-pixel glyph cx cy [size])`

**Returns:** `imagine`: `'ok` on a glyph-resolved + painted scene;
`['escalate', 'service-not-yet-wired', {word, suggestion, reason}]` on
an unknown emoji name; `['escalate', 'tier-upgrade-needed',
{from:'pink', to:'green', seconds, word}]` when seconds > 20 (pink-tier
budget). `emoji-paint-pixel`: `'ok` after gridDot cells flow; `['pending-visual',
{glyph, source}]` when no substrate is mounted; `['error', 'rasterize failed']`
on a missing glyph table entry.
**Backing:** `curator-web/src/scheme/imagineVerbs.js:1-277`; emoji table at
`curator-web/src/lib/emojiTree.js`; rasterizer at
`curator-web/src/lib/emojiRasterizer.js`; substrate dot push at
`curator-web/src/sprites/flowers.js:206-217`.
**Permission tier:** `paint`.
**Wired:** yes — composition of `lookupEmoji → rasterizeEmoji → gridDot`,
plus a card-effect chip emit (`verb:'card-effect', kind:'imagine'`).
**Honest-null:** unknown word → escalate `'service-not-yet-wired` with a
suggestion to teach `emojiTree.data.js`; scene > 20s → escalate
`'tier-upgrade-needed` (ask the 8B green-tier composer); rasterize miss
→ `['pending-visual', …]`, never silent-success.
**Cross-refs:** AUTOMATIONS scene `imagine-on-canvas` (training pattern);
substrate dot push at `flowers.js:206`.

#### Novice
```scheme
;; paint a birthday cake on the substrate
(imagine "birthday cake")
```
*Source: `imagineVerbs.js:42` (the canonical four-step archetype).*

#### Intermediate
```scheme
;; a 15-second scene that auto-clears
(imagine "shooting star" :seconds 15)
```
*;; generated example*

#### Expert
```scheme
;; paint a glyph at exact world coords at large size (96px font raster)
(emoji-paint-pixel "🌸" 0 0 'large)
```
*;; generated example — `imagineVerbs.js:248-262`*

---

### `(fleet-do verb-name args... [:filter pred] [:parallel bool])` / `(fleet-each filter body)`

**Returns:** an array of `(shop-id . envelope)` pairs (one per matching
shop), OR `['error', 'service-not-yet-wired', {verb, reason:'no-matching-shops',
hint}]` on a filter that matches zero shops, OR `['error', 'operator-denied',
{verb, dispatchId, reason}]` on a destructive verb without operator
confirm. `fleet-each` returns the same `(shop-id . body-result)` shape.
**Backing:** `curator-web/src/scheme/fleetVerbs.js:448-498` (installer);
`runFleet` engine at `fleetVerbs.js:290-435`.
**Permission tier:** `state-change` (the underlying verb's perm is
checked per shop via `cardDo`; destructive verbs are gated by a SINGLE
fleet-confirm modal — never N modals).
**Wired:** yes — composes `connectedShops.getAllShops` × `cardApi.cardDo`;
emits `curator:fleet-action-progress` per shop completion (the
FleetActionStrip listens). Tested in `fleetVerbs.*.test.js`.
**Honest-null:** zero matching shops → escalate with hint; per-shop failure
surfaces in that shop's envelope while the aggregate still completes
(every shop is touched); destructive without confirm → no shop touched.
**Cross-refs:** ENGINEERING §AA (Fleet-wide action engine);
AUTOMATIONS sidecar `sakura-fleet-corpus.jsonl`.

Parallel default: every shop fires concurrently UNLESS the verb's
registry perm is `destructive`, in which case `fleet-do` falls back to
SEQUENTIAL dispatch so a rate-limit / token-revoke on shop A doesn't
race shop B. Operator may force parallel/sequential via `:parallel`.

#### Novice
```scheme
;; pause every shop for the holiday
(fleet-do 'pause-shop)
```
*Source: `sakura-fleet-corpus.jsonl:1` (training intent).*

#### Intermediate
```scheme
;; bump free-shipping threshold across every Etsy shop only
(fleet-do 'set-free-shipping-threshold 5000
          :filter (lambda (s) (eq? (cdr (assq 'platform s)) 'etsy)))
```
*;; generated example*

#### Expert
```scheme
;; per-shop body: write a Cortex note keyed by shop id (NOT a verb name)
(fleet-each (lambda (s) (eq? (cdr (assq 'platform s)) 'shopify))
            (lambda (s)
              (cortex/write (cdr (assq 'id s)) "holiday-paused")))
```
*;; generated example — `fleetVerbs.js:451-474`*

---

### `(scene/conveyor src-addr dst-addr listing-count)`

**Returns:** `{ok:#t, verb:'scene/conveyor, path, n, spawnedIds, staggerMs,
legDwellMs}` on success; `['escalate', 'service-not-yet-wired', {verb, reason}]`
when src or dst cards aren't on the surface (`cardCenter` returns null).
**Backing:** `curator-web/src/surface/scheme-host/sceneVerbs.js:556-675`;
spawn/move primitives from `curator-web/src/sprites/flowers.js:237-266`.
**Permission tier:** `paint`.
**Wired:** yes — bespoke 3-leg arc (src → midpoint → dst), pink-to-green
colour transition halfway, source `sparkle + bloom` on launch, target
`lift + glow` on arrival.
**Honest-null:** unresolved card center → escalate; src or dst missing →
escalate with the missing id named in the detail.
**Cross-refs:** AUTOMATIONS `conveyor-belt` cart; ENGINEERING §AA.

#### Novice
```scheme
;; ship 12 listings as flower sprites from one shop to another
(scene/conveyor 'etsy-shop-1 'ebay-shop-1 12)
```
*Source: `curator-web/src/scheme/carts/scenes/conveyor-belt.sks:85`.*

#### Intermediate
```scheme
;; resolve kinds to first instance, then run the belt
(let ((src (car (card-find-by-kind 'etsy-shop)))
      (dst (car (card-find-by-kind 'ebay-shop))))
  (scene/conveyor src dst 24))
```
*Source: pattern from `conveyor-belt.sks:51-66`*

#### Expert
```scheme
;; compose the belt with fade + bring-together so the scene reads as
;; "this shop's listings move there"
(surface-fade-others (list src dst))
(surface-bring-together src dst)
(scene/conveyor src dst 30)
(surface-restore)
```
*Source: `conveyor-belt.sks:75-99`.*

---

### `motion/transfer · motion/wave · motion/scatter · motion/march · motion/gather · motion/orbit · motion/settle · motion/fade · motion/celebrate · motion/point-at · motion/glide-to` — 11 honest-null escalators

**Returns:** every one of the 11 verbs returns
`['escalate', 'service-not-yet-wired', {verb, args, reason:'archetype
motion verb has no runtime impl yet'}]`.
**Backing:** `curator-web/src/surface/scheme-host/sceneVerbs.js:715-740`
(the `archetypeMotionVerbs` array + `archetypeNotWired` factory).
**Permission tier:** `state-change`.
**Wired:** **no — returns `escalate 'service-not-yet-wired`** on every
call. They're bound so the ~24k-entry `sakura-corpus-archetypes` corpus
can dispatch cleanly (no `'unknown-verb'` crash) and so dialect-lint
allow-lists stay aligned with what the runtime exposes. When a real
impl ships (composed from `grid/flower-spawn!`, `grid/flower-go-to!`,
or `card-effect`), it REPLACES the binding — operator-visible envelope
stays compatible.
**Honest-null:** that IS the contract — the escalator IS the wire.
**Cross-refs:** CLAUDE.md "Honest nulls, no fluent-wrong" rule; ENGINEERING
§AB (the corpus the escalators serve).

#### Novice
```scheme
;; one of these is in the archetype corpus — every cart that calls it
;; gets a clean escalate today
(motion/wave 'shop-card '#card/cortex 800)
```
*;; generated example — escalate envelope per `sceneVerbs.js:728-731`.*

#### Intermediate
```scheme
;; cart authors compose with the escalate path so the cart STILL completes
(let ((envelope (motion/scatter (card-list))))
  (cond ((and (pair? envelope) (eq? (car envelope) 'escalate))
         ;; degrade — paint a static settle instead
         (motion/settle))
        (else 'ok)))
```
*;; generated example — same composition pattern as the corpus's
fallback ladder.*

#### Expert
```scheme
;; a scene-runner that observes every escalate and emits one chip for
;; the chat ("scene N motion verbs still escalate — corpus is ahead of
;; runtime by this much")
(for-each (lambda (v)
            (let ((env (v 'a 'b)))
              (when (and (pair? env) (eq? (car env) 'escalate))
                (card-emit 'engine 'motion-escalate (list (cadr env))))))
          (list motion/transfer motion/wave motion/scatter
                motion/march motion/gather motion/orbit
                motion/settle motion/fade motion/celebrate
                motion/point-at motion/glide-to))
```
*;; generated example — composition over the bound symbols at
`sceneVerbs.js:731-740`.*

---

### `(paint-conway-via-dot-grid palette [opts])` — Conway-on-dot-substrate

**Returns:** `'ok` (visual side-effect via the gridDot path).
**Backing:** `curator-web/src/scheme/conway.js:1008-1247`
(`paintConwayViaDotGrid`); exported at `conway.js:1511`.
**Permission tier:** `paint`.
**Wired:** yes — pushes cells into the same `_pendingDots` channel
`gridDot` uses (`flowers.js:206`); the rAF handle the flower engine
owns paints them.
**Honest-null:** no substrate (test env) → no-op; the canonical Conway
verbs (`installConwayVerbs`) still pass-through.
**Cross-refs:** the Conway-on-dots proof; ENGINEERING §X (the dot
substrate is shared by Mode A activity AND whimsy paint).

#### Novice
```scheme
;; paint the canonical pink-on-substrate Conway
(paint-conway-via-dot-grid 'pink)
```
*;; generated example*

#### Intermediate
```scheme
;; trace-alpha = 0.6 — older Conway generations decay slower
(paint-conway-via-dot-grid 'pink :trace-alpha 0.6)
```
*;; generated example*

#### Expert
```scheme
;; weekly-summary visual: Conway in shop palette, behind the activity bar
(paint-conway-via-dot-grid 'sakura-magic :trace-alpha 0.4)
```
*;; generated example — see `conway.js:1317`.*

---

### `(grid-dot x y colour [alpha])` / `(clear-grid-dots)` — substrate dot write

**Returns:** `'ok` (write-only side-effect).
**Backing:** `curator-web/src/sprites/flowers.js:206-217`.
**Permission tier:** `paint`.
**Wired:** yes — same `_pendingDots` channel `paintConwayViaDotGrid` +
`imagine` use; the flower engine's rAF handle paints them.
**Honest-null:** no `flower handle` (jsdom / SSR) → push to the pending
buffer; `_mountFlowers()` consumes it on next mount.
**Cross-refs:** `imagineVerbs.js:93` (the cells-to-dots loop);
ENGINEERING §X (substrate write surface).

#### Novice
```scheme
;; one purple dot at world origin
(grid-dot 0 0 'sakura-magic)
```
*;; generated example*

#### Intermediate
```scheme
;; alpha-faded scatter for "the room is quieting"
(for-each (lambda (xy)
            (grid-dot (car xy) (cdr xy) 'pink 0.4))
          (list (cons -40 0) (cons 0 -40) (cons 40 0)))
```
*;; generated example*

#### Expert
```scheme
;; clear the substrate before painting the next scene
(clear-grid-dots)
(imagine "sakura blossom")
```
*;; generated example — same idiom as `flowers.js:217`.*

---

## 12. Sakura on-device verbs

Sakura's verbs are ACT-DISPATCHED. They route to the on-device Sakura
savant (L0 — Sakura's 1.7B model running in the operator's browser)
or — when explicitly authorized — to the L2 vendor reasoning lane.
Each returns honest result tags via `ctx-result`.

**Wired:** partial — `sakura/decide` (on-device) routes through the
cart driver to the local model when available, else returns
`'service-not-yet-wired` honestly. `sakura/cloud-reason`,
`sakura/relay`, `sakura/handoff`, and `sakura/dream` are
manifest-declared and route through the cart driver; the underlying
sessions return `'service-not-yet-wired` until the per-tier auth
lands.

### `(act 'sakura/decide (list task-tag args) 'on-result)`

```verb-card sakura/decide pink
```

**Returns:** via `ctx-result`: the structured reply, or one of
`'sakura-empty | 'sakura-garbled | 'rate-limited | …`.
**Backing:** cart driver routes to on-device Sakura.
**Wired:** yes (when the local model is mounted; else honest
`'service-not-yet-wired`).

#### Novice
```scheme
(act 'sakura/decide (list 'task 'choose-glyph 'flower) 'check)
```
*;; generated example*

#### Intermediate
```scheme
(define (note ctx)
  (act 'sakura/decide
       (list 'task 'daily-brief-note (ctx-get 'headlines ctx))
       'check-notes))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:159-162`*

#### Expert
```scheme
;; closed cookbook — Sakura never freelances; the task tag IS the contract
(act 'sakura/decide
     (list 'task 'mood-checkin-reply
           ':cookbook '(reflect acknowledge breathe)
           ':input    (ctx-get 'reply-text ctx))
     'classify-mood)
```
*Source: pattern from `carts/personal/mood-check-in.sks:90-98`*

---

### `(act 'sakura/cloud-reason (list prompt :budget) 'on-result)`

**Returns:** structured reply, or honest gate envelope.
**Backing:** cart manifest declares this for Imagine/Dream/Magic tiers
(`carts/personal/manifest.js:49`).
**Wired:** partial — Magic-tier deep-reasoning sessions route here;
returns `'cloud-tier-required` for lower tiers honestly.

#### Novice
```scheme
(act 'sakura/cloud-reason
     (list "Suggest a one-line title")
     'check-suggestion)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-get 'tier ctx) 'magic)
  (act 'sakura/cloud-reason
       (list (ctx-get 'prompt ctx) ':budget 'magic)
       'check-reasoning))
```
*;; generated example*

#### Expert
```scheme
(act 'sakura/cloud-reason
     (list "Reconcile actuals against prior strategy. Draft delta."
           ':context (ctx-get 'session-context ctx)
           ':budget  'magic)
     'check-finding)
```
*Source: pattern from `the-living-business-plan.sks:247-258` (uses
lacuna/ask shape — sakura/cloud-reason is the tier-aware capability-
first alias).*

---

### `(act 'sakura/relay (list tool args) 'on-result)`

**Returns:** the relayed call's result.
**Backing:** declared in `carts/google/manifest.js:78`.
**Wired:** no — relay shape declared; the multi-tool session is
offline by default. Returns `'service-not-yet-wired` honestly.

#### Novice
```scheme
(act 'sakura/relay (list 'google/sheets-append-row (list sheet row)) 'check)
```
*;; generated example*

#### Intermediate
```scheme
(act 'sakura/relay
     (list 'instagram/feed-post (list url caption))
     'check-post)
```
*;; generated example, real verb name from §6*

#### Expert
```scheme
;; honest gate before relay
(cond
  ((eq? (ctx-get 'relay-status ctx) 'offline)
     (escalate 'service-not-yet-wired
               '(:reason "sakura-relay-not-mounted")))
  (else
     (act 'sakura/relay (list tool args) 'check)))
```
*;; generated example*

---

### `(act 'sakura/handoff (list chip-name payload) 'on-result)`

**Returns:** `'ok` after handoff completes, or honest failure.
**Backing:** declared in manifests; routes via the Lacuna support
layer per [[project-lacuna-support-training-for-sakura]].
**Wired:** no — chip vocabulary declared; the support layer is in
training. Returns `'service-not-yet-wired` honestly.

#### Novice
```scheme
(act 'sakura/handoff
     (list 'sakura.handoff/sre-check '(:host mac-studio.local))
     'check-handoff)
```
*;; generated example*

#### Intermediate
```scheme
(act 'sakura/handoff
     (list 'sakura.handoff/cortex-prune (ctx-get 'topics-to-drop ctx))
     'after-prune)
```
*;; generated example*

#### Expert
```scheme
;; chain — Sakura decides, then hands off to Lacuna for execution
(act 'sakura/decide
     (list 'task 'pick-prune-targets (ctx-get 'all-topics ctx))
     'handoff-prune)

(define (handoff-prune ctx)
  (act 'sakura/handoff
       (list 'sakura.handoff/cortex-prune (ctx-result ctx))
       'render))
```
*;; generated example*

---

### `(act 'sakura/dream (list seed) 'on-result)`

**Returns:** the dream node + paint plan, or `'cortex-not-ready`.
**Backing:** the dream-from-Cortex loop (NORTH STAR per
[[project_sakura_dreams_from_cortex]]).
**Wired:** no — dream loop spec is locked; the background loop +
imagination-engine paint plan is in the dream lane.

#### Novice
```scheme
(act 'sakura/dream (list 'noun-of-the-hour) 'paint-bubble)
```
*;; generated example*

#### Intermediate
```scheme
(when (ctx-get 'idle-loop ctx)
  (act 'sakura/dream (list (ctx-get 'recent-noun ctx)) 'render-thought))
```
*;; generated example*

#### Expert
```scheme
;; honest invariant — never claim a thought she didn't have
(let ((dream (ctx-result ctx)))
  (cond
    ((null? dream)
       (escalate 'no-dream-this-tick null))
    ((eq? dream 'cortex-not-ready)
       (escalate 'service-not-yet-wired
                 '(:reason "cortex-cold")))
    (else
       (paint-text (assq 'caption dream)
                   '#anchor/sakura-bubble
                   ':stroke-mode 'handwriting))))
```
*Source: pattern from [[project_sakura_dreams_from_cortex]]*

---

## Appendix · Macro inventory (Lane B §4, summary)

The 36 hygienic macros are seeded by `buildMacroTable`
(`primitives/macros.js:341-350`) and exist as expandable forms. Each
expands deterministically to a composition of the 15 primitives.

| Family            | Macros                                                                                                              | Backing                                     |
|-------------------|---------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| motion idioms (13)| `motion/glide`, `motion/drift`, `motion/sway`, `motion/arrive`, `motion/depart`, `motion/settle`, `motion/spin`, `motion/idle`, `motion/lean-aside`, `motion/ease-aside`, `motion/reach`, `motion/pluck`, `motion/toss`, `motion/land` | `primitives/macros.js:52-148` |
| note idioms (2)   | `note/glide`, `note/rest`                                                                                            | `primitives/macros.js:152-162` |
| musical forms (7) | `form/I-IV-V`, `form/ii-V-I`, `form/12-bar-blues`, `form/vi-IV-I-V`, `form/I-vi-ii-V`, `form/modal-Dorian`, `form/scale` | `primitives/macros.js:173-238` |
| scene atmos (2)   | `surface/fade-around`, `surface/stage`                                                                              | `primitives/macros.js:243-254` |
| timing comp (8)   | `sequence`, `parallel`, `after`, `wait`, `repeat`, `in-window`, `every`, `stagger`                                  | `primitives/macros.js:267-299` |
| mode-aware (4)    | `when-mode`, `on-mode-change`, `on-input`, `on-gesture`                                                              | `primitives/macros.js:307-322` |

Three picked, fully expanded:

```scheme
;; motion/glide — sample novice / intermediate / expert use
(motion/glide '#sprite/cherry 220 -40)
;; → expands to (motion/move-to '#sprite/cherry 220 -40 :curve 'spring :ms 760)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:127`*

```scheme
(parallel (motion/glide '#sprite/cherry 220 -40)
          (motion/glide '#sprite/plum    40 -220))
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:140-150`*

```scheme
(stagger 240
  (list (motion/glide '#sprite/cherry    220  -40)
        (motion/glide '#sprite/plum       40 -220)
        (motion/glide '#sprite/magnolia -220   40)
        (motion/glide '#sprite/linden    -40  220)))
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:124-130`*

---

## 13. New-arch placeholders {#13-new-arch-placeholders}

Stubs only. Full per-verb entries land when each MOVE ships per
`HELLO-SURFACE-1.0-ENGINEERING.md` §95.

**MOVE 3 — FRP time-calculus (planned, `scheme/time/frpGrammar.js`).** One time
grammar across music + motion + chat + cart-dispatch. Surface forms:
`when` (event-keyed gate), `during` (windowed predicate), `until` (terminating
predicate), `then` (sequential bind), `across` (parallel span), `every` (cadence).
Implementation gap: `when` exists today as a Reserved form (§1) for one-arm
conditionals; the FRP `when` is a time-keyed extension and lands as a separate
form name to avoid clobbering it. Cross-ref §95 MOVE 3.

**MOVE 4 — Unified memory verbs (planned, `lib/memoryUnified.js`).** One verb
triple over Cortex + accountStorage + Engram: `(memory/recall key)` returns the
freshest backed value, `(memory/remember key value :tier short|durable|sync)`
writes to the appropriate store, `(memory/forget key)` evicts across stores
with audit. Replaces ad-hoc `cortex/recall` + `accountStorage.get` divergence.
Cross-ref §95 MOVE 4.

**MOVE 5 — ASK floor (planned, `scheme/primitives/askVerbs.js`).** ~150
read-only introspection verbs from Lane A §93.4 covering collision
(`ask/collide?`, `ask/overlap`), surface arithmetic (`ask/distance`,
`ask/bearing`, `ask/within?`), and self-knowledge (`ask/what-cart`,
`ask/last-emit`, `ask/can-i?`). The ACT/ASK symmetry is the moat: every ACT
verb has a paired ASK so Sakura can verify before she acts. Cross-ref §95 MOVE 5.

**Already-shipped math verbs (undocumented backfill).** `math/sum`, `math/avg`,
`math/pct`, `math/round`, `time/delta` registered via `installMathVerbs`
(`curator-web/src/scheme/primitives/mathVerbs.js:101-113`). Full entries
pending; see file for argument shapes.

**§97 cultural-distribution + §101 timing-tensor symbol shape (LOCKED 2026-06-22, Soo-Jin closeout).** Two anchor-id shapes coexist; cart authors and the trained model must distinguish them at sight:

- **Performer-piece tensor.** `'<performer-class>-<work-id>` — e.g.
  `'rubinstein-op9-no2`, `'karajan-beethoven-9-mvt4-freude`,
  `'cortot-op28-no4`. Always carries a specific recording. The runtime
  resolves via `(memory/recall 'timing <id>)` per §101.3. Hyphenated;
  `performer-class` slot is from the §101.3 enum
  (`rubinstein | karajan | cortot-pre-1928 | backhaus-pre-1928`).
- **Cultural-distribution family.** `'<family-id>` — e.g. `'one-drop`,
  `'boom-bap`, `'cantabile`, `'clave-2-3`, `'clave-3-2`. No performer
  bound; resolves to the published stylistic distribution (Burkhart 2015,
  Senn 2016). The family-id slot is from the §97.1 vocabulary table.
- **Fallback / override.** `'operator-pace-drift`, `'snappy-override`,
  `'ease-in-out-default` — three reserved IDs the verifier knows about
  per §101.4 `honest-null-on-missing-anchor`.

The distinction is structural: `motion/with-pace` takes performer-piece OR
fallback IDs; `motion/with-feel` takes ONLY cultural-distribution family
IDs; `pattern/clave` takes ONLY `'2-3` or `'3-2`. Mixing (e.g.
`(motion/with-pace 'one-drop ...)`) is a verifier-class error caught at
corpus-build per §101.4 and at inference per the dispatch gate. Vendor /
artist names NEVER appear inside the symbol per CLAUDE.md 2026-06-22
vendor-naming lock — they live only in Cortex tensor metadata
(`source_ref` field per §101.3).

### 13.1 — Motion-timing verbs (LANDED 2026-06-23) {#13-1-motion-timing-verbs}

All eight §101.6 motion-timing verbs are wired and tested
(`curator-web/src/scheme/motionTimingVerbs.js`, 17/17 in
`__tests__/motionTimingVerbs.test.js`). Each returns a pure descriptor
(no DOM mutation; the animation engine consumes downstream).

**`motion/with-pace`** — modulate inner-motion duration by a tensor's
inter-onset intervals, scaled by intensity 0..1.

#### Novice
```scheme
(motion/with-pace 'rubinstein-op9-no2 0.6 (card/walk 'a 'glide-pause))
```

#### Intermediate
```scheme
(let ([pace (motion/with-pace 'chopin-nocturne-48-2 0.85)])
  (card/move 'sakura :duration (pace-derived-ms pace 4)))
```

#### Expert
```scheme
;; Two cards lag-led by Rubinstein rubato, third strict-metronomic
(parallel
  (motion/with-pace 'rubinstein-op9-no2 0.9 (card/glide 'a 320 240))
  (motion/with-pace 'rubinstein-op9-no2 0.9 (card/glide 'b 360 240))
  (motion/cadence 96 'q))   ;; the strict third
```

**`motion/with-feel`** — apply an articulation cue (legato / staccato)
from `MOTION_CUES` (Eitan & Granot 2006). Returns the cue + the
tensor's articulation_ratios.

#### Novice
```scheme
(motion/with-feel 'chopin-ballade-1 'legato)
```

#### Intermediate
```scheme
(let ([feel (motion/with-feel 'rubinstein-op9-no2 'legato)])
  (card/settle 'a :ease (feel-ease feel)))
```

#### Expert
```scheme
;; Staccato pluck on a Rach-2 tensor — articulation_ratios drive
;; per-note ease the animation engine reads back
(motion/with-feel 'rach-2-mvt-2-cantabile 'staccato)
```

**`motion/cadence`** — pure BPM + division → ms period. No tensor.

#### Novice
```scheme
(motion/cadence 120 'q)            ;; 500ms per beat
```

#### Intermediate
```scheme
(let ([beat (motion/cadence 96 '8th)])
  (every (cadence-period-ms beat) (card/pulse 'sakura)))
```

#### Expert
```scheme
;; A polyrhythmic 3-against-4 across two cards
(parallel
  (motion/cadence 96 'q)            ;; card A on quarters
  (motion/cadence 72 '8th))         ;; card B on dotted-quarters in disguise
```

**`motion/arc`** — surface a tensor's phrase_arc (peak_ms +
peak_intensity) as a curve the animation engine samples at
current-time-in-phrase.

#### Novice
```scheme
(motion/arc 'chopin-ballade-1)
```

#### Intermediate
```scheme
(let ([arc (motion/arc 'rach-2-mvt-2-cantabile)])
  (card/scale 'a (arc-intensity-at arc (now-ms))))
```

#### Expert
```scheme
;; Two-peak Rach-2 arc — sprite brightens with first peak (cantabile),
;; SHAKES on second peak (triumphant resolution)
(motion/arc 'rach-2-mvt-2-cantabile)
```

**`motion/pocket`** — produce N symmetric stagger offsets within
±tolerance_ms (the "feel pocket").

#### Novice
```scheme
(motion/pocket 12 4)               ;; [-12, -4, 4, 12] ms
```

#### Intermediate
```scheme
(let ([pocket (motion/pocket 18 5)])
  (stagger-with pocket (card/walk 'sakura 'amble)))
```

#### Expert
```scheme
;; The pocket follows the bar — staggered card-walks land at the
;; same time but feel hand-played not quantized
(motion/pocket 22 8)               ;; 8 cards within ±22ms tolerance
```

**`motion/drop`** — one-drop accent: at the target beat, articulate
high (0.95); elsewhere low (0.35). Returns per-beat articulation
array length totalBeats.

#### Novice
```scheme
(motion/drop 3 16)                 ;; accent every beat 3 of 4 over 16
```

#### Intermediate
```scheme
(let ([drop (motion/drop 3 32)])
  (card/pulse 'sakura :pattern (drop-articulation drop)))
```

#### Expert
```scheme
;; Reggae one-drop on a 32-beat phrase; the bass pulse is the off-beats
(motion/drop 3 32)
```

**`pattern/clave`** — 2-3 or 3-2 son clave hit map over 16 8th-notes.
Returns `{kind: 'clave', map: [0|1, ...16]}`.

#### Novice
```scheme
(pattern/clave '2-3)
```

#### Intermediate
```scheme
(let ([clave (pattern/clave '2-3)])
  (for-each-hit clave (lambda (i) (card/blip 'sakura))))
```

#### Expert
```scheme
;; 3-2 clave under a son montuno — drives both the visual blip
;; AND the audio synth via the same map
(pattern/clave '3-2)
```

**`beat/on`** — predicate descriptor: fire on beat N of M. The engine
tests current beat index against the descriptor.

#### Novice
```scheme
(beat/on 1 4)                      ;; fire on beat 1 of every 4
```

#### Intermediate
```scheme
(let ([gate (beat/on 3 4)])
  (when (gate (current-beat)) (card/drop 'sakura)))
```

#### Expert
```scheme
;; Cross-rhythm: card-walk on every beat 1, card-spin on every beat 3
(parallel
  (when-beat (beat/on 1 4) (card/walk 'a 'glide))
  (when-beat (beat/on 3 4) (card/spin 'b 30)))
```

---

## 14. 2026-06-24 roll-up · chrome verbs, tier verb, coin physics emit

Three groups land in this section: card-chrome verbs (the new STRIPE/HEAD/BODY layer addressing); the tier-read verb (single source of truth for what tier the operator is on); and the coin-emit Scheme primitive (the physics-backed coin emitter used by the Shoppe cascade — kept as a substrate primitive even as the §125 Sakura Shoppe card is on the cut list per HelloSurface §128.7).

### 14.1 Card chrome verbs

The STRIPE layer (per HelloSurface §127) makes per-card chrome visible on resting cells. These verbs let Scheme address that chrome — set the wordmark, swap the dot-matrix pattern, force a chrome refresh.

**`card/stripe-pattern`** — replace a card's dot-matrix pattern. Reads `cardDotPatterns.js` for the default; this verb overrides at runtime.

`Backing:` `curator-web/src/components/cards/cardDotPatterns.js:313 · patternFor()` (lookup that the verb mutates). Wired: code-ready (verb not yet registered in `VerbRegistry.js` — pending the cardDotPatterns → Scheme migration noted in HelloSurface §128.1).

#### Novice
```scheme
(card/stripe-pattern 'radio (pattern/legacy '("..XXXX.." "..X..X.." "..X..X.." "..X..X.." "..XXXX.." "....X..." "...XXX.." "........")))
```

#### Intermediate
```scheme
(let ([p (cortex/recall 'my-custom-radio-pattern)])
  (card/stripe-pattern 'radio p))
```

#### Expert
```scheme
;; Animate the radio dots by rotating the pattern grid each beat
(every-ms 500
  (card/stripe-pattern 'radio (pattern/rotate (cortex/recall 'radio-pattern))))
```

**`card/stripe-label`** — replace a card's wordmark text.

`Backing:` `curator-web/src/components/cards/CardStripe.jsx:39 · KIND_LABEL` (the default-label lookup). Wired: code-ready; the label override flows through React state when the verb installer fires.

#### Novice
```scheme
(card/stripe-label 'radio "Studio")
```

#### Intermediate
```scheme
(let ([title (current-station-title)])
  (card/stripe-label 'radio title))
```

#### Expert
```scheme
;; Reactive label — track the current station's title every 2s
(every-ms 2000
  (card/stripe-label 'radio (radio/current-station-title)))
```

### 14.2 Operator-tier verb

**`operator/tier`** — return the operator's tier: `'free` / `'imagine` / `'dream` / `'magic`. While `MAGIC_DEFAULT_ENABLED` is true (HelloSurface §128.3) this returns `'magic` unconditionally.

`Backing:` `curator-web/src/lib/operatorTier.js:28 · getOperatorTier()` + `:18 MAGIC_DEFAULT_ENABLED`. Wired: yes (the JS function is the substrate; the Scheme verb is the registered bridge).

#### Novice
```scheme
(operator/tier)             ;; → 'magic  (while override on)
```

#### Intermediate
```scheme
(when (eq (operator/tier) 'magic)
  (sakura/say "You're on Magic — every dossier is open."))
```

#### Expert
```scheme
;; Tier-gated cart that ALSO records the override state so logs are honest
(let ([t (operator/tier)] [override (operator/magic-default-active?)])
  (cortex/remember 'last-tier-read { :tier t :override override :at (now-ms) })
  (case t
    [(magic) (deep-research)]
    [(dream) (medium-research)]
    [(imagine free) (light-research)]))
```

**`operator/magic-default-active?`** — diagnostic predicate that returns `#t` when the magic-default override is on.

`Backing:` `curator-web/src/lib/operatorTier.js:40 · isMagicDefaultActive()`. Wired: yes.

#### Novice
```scheme
(operator/magic-default-active?)
```

#### Intermediate
```scheme
(when (operator/magic-default-active?)
  (sakura/say "Heads-up: payment is deferred, you're on Magic for free."))
```

#### Expert
```scheme
;; Honest cost-receipt chip: surface the override in the receipt so the
;; operator never thinks the price they SEE is the price they PAID.
(receipt/show
  :tokens (cart/cost-tokens)
  :dollars (if (operator/magic-default-active?) 0 (cart/cost-dollars))
  :note (if (operator/magic-default-active?) "Magic (override)" "Magic"))
```

### 14.3 Coin emit (`paint-coin`, `coin/emit`)

The §125 Sakura Shoppe card is being retired (HelloSurface §128.7) but the **coin physics primitive** stays in the substrate — it's a reusable celebration emitter (use case: a sale-event whimsy, a milestone burst, a Sakura-magic acknowledgement).

**`paint-coin`** — render a spinning coin at a point. Pure visual, no physics.

`Backing:` `curator-web/src/scheme/primitives/paintCoinScheme.js` + render via `curator-web/src/components/SakuraCoin.jsx`. Wired: yes (the visual coin); physics is in the next verb.

#### Novice
```scheme
(paint-coin (point 200 150))
```

#### Intermediate
```scheme
(paint-coin (point 300 150) :denomination 'magic :rpm 90 :easing 'step)
```

#### Expert
```scheme
;; A row of pink coins, staggered for a wave effect (HelloSurface §125.11.5)
(for-each (lambda (i)
  (paint-coin (point (+ 100 (* i 60)) 200)
              :denomination 'pink :rpm 60 :phase (/ i 5)))
  '(0 1 2 3 4))
```

**`coin/emit`** — emit a physics-backed coin with initial velocity. The coin acts under gravity, drag, and bounce per `coinPhysics.js`.

`Backing:` `curator-web/src/scheme/primitives/coinEmitScheme.js` + `curator-web/src/lib/coinPhysics.js:72 · CoinBody` / `:156 · CoinWorld` / `:310 · arcVelocity`. Wired: yes (34 physics tests + 11 emit-Scheme tests).

#### Novice
```scheme
(coin/emit (point 200 150))                          ;; gravity falls
```

#### Intermediate
```scheme
;; Arc a coin from pack tile to balance counter (Shoppe cascade pattern)
(coin/emit (point 200 400)
           :target (point 350 100)
           :duration-ms 800
           :peak-height 80
           :denomination 'magic)
```

#### Expert
```scheme
;; Celebration burst — N coins emitted from one point with radial spread
(for-each (lambda (i)
  (let ([theta (* 2 PI (/ i 12))])
    (coin/emit (point cx cy)
               :velocity (point (* 200 (cos theta)) (* -200 (sin theta) 1.2))
               :denomination (if (= i 0) 'magic 'pink)
               :spin (* 360 (random)))))
  '(0 1 2 3 4 5 6 7 8 9 10 11))
```

### 14.4 Phase 3 + 4 motion-timing verbs (already documented above)

The 8 motion-timing verbs landed under section 10 (FX + animation atoms):
`motion/with-pace` · `motion/with-feel` · `motion/cadence` · `motion/arc` · `motion/pocket` · `motion/drop` · `pattern/clave` · `beat/on`.

These bind `crossModalMapping.js` (perception) + `timingTensor.js` (performance) — see §10 entries for the 3-example (Novice/Intermediate/Expert) bodies. The Backing field of each entry points at `motionTimingVerbs.js:1` (registered as a group), `cortex/timing/seeds.js` for the 7 seed tensors, and `cortex/timing/sheet-music-catalog.json` for the 12 PD works that ground them.

### 14.5 Deprecation flags

- **`shoppe/*` verbs** (`curator-web/src/scheme/shoppe/shoppeVerbs.js`, 8 verbs) — DEPRECATION CANDIDATE. The Sakura Shoppe card is on the cut list per HelloSurface §128.7. The verbs themselves may stay as substrate primitives (token-pack purchase flow, merch purchase flow) or be retired; architect call needed. Mark `Wired: deprecation-pending` until the call is made.

---

## 15. Atomic primitives — the irreducible base

> "We shall first define a class of symbolic expressions in terms of
> ordered pairs and lists. Then we shall define five elementary
> functions and predicates, and build from them by composition,
> conditional expressions, and recursive definition an extensive class
> of functions of which we shall give a number of examples."
> — John McCarthy, *Recursive Functions of Symbolic Expressions and
> Their Computation by Machine, Part I*, 1960, p.184

This chapter catalogues the **atomic verbs** — the bindings that are
NOT macros, NOT installed by any namespace installer (`installCardVerbs`,
`installCortexGrammar`, `installFrpGrammar`, etc.), and that no cart can
redefine post-`freeze()`. Everything in the language stands on these.

There are two sources for an atomic primitive:

1. **Special forms.** Hand-written cases in the `evalStep` switch at
   `curator-web/src/scheme/interp.js:281-441` — the function declaration
   sits at `:281`; the dispatch switch runs `:289-441`. These are NOT functions —
   they cannot be passed as values, captured in a closure, or rebound.
   The substrate-freeze (`Env.freeze()` at `interp.js:154-164`) blocks
   redefinition of every name bound at boot, so even the non-special-form
   atoms below are immutable from cart code.
2. **Base bindings.** Pure, total, side-effect-free JavaScript functions
   installed by `makeBaseEnv(fuel)` at
   `curator-web/src/scheme/base.js:16-507`. These are first-class values
   (can be `map`-ped, `apply`-ed, stored in lists).

The split is invisible to operators — `(+ 1 2)` and `(if x y z)` read
identically — but it's load-bearing for security: an installer can
shadow a special-form name pre-freeze (none do), and post-freeze every
name on this page is read-only. The verb-registry meta walks fall back
to `defaultMetaFor` for any base binding declared without an explicit
`perm`; every entry below carries `perm: 'read'` by virtue of the `def`
helper's default at `base.js:24`.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" style="background:#fdf6f3;border:1px solid #2e2167;border-radius:4px;display:block;margin:1em 0">
  <text x="20" y="30" font-family="ui-monospace,monospace" font-size="13" fill="#1a1a1a">atomic primitives — the irreducible base</text>
  <line x1="20" y1="44" x2="500" y2="44" stroke="#2e2167" stroke-width="1"/>
  <text x="20" y="70" font-family="ui-monospace,monospace" font-size="11" fill="#2e2167">  interp.js:275-279   16 special forms   (cannot be passed as values)</text>
  <text x="20" y="92" font-family="ui-monospace,monospace" font-size="11" fill="#2e2167">  base.js:16-507      ~117 base bindings (first-class, perm: read)</text>
  <line x1="20" y1="108" x2="500" y2="108" stroke="#2e2167" stroke-width="1"/>
  <text x="20" y="128" font-family="ui-monospace,monospace" font-size="11" fill="#1a1a1a">  every installer (cardVerbs, cortex, paint, ...) sits ON TOP of this.</text>
</svg>

The chapter is organised in nine subsections:

- **§15.1** — Special forms (no notion of "function value"; switch cases in `evalStep`).
- **§15.2** — Equality and predicates.
- **§15.3** — List + sequence atoms.
- **§15.4** — Arithmetic atoms.
- **§15.5** — String + number conversion atoms.
- **§15.6** — Higher-order atoms (`map`, `filter`, `reduce`, `apply`, `for-each`).
- **§15.7** — Randomness atoms (the seeded/un-seeded split).
- **§15.8** — Geometry + threshold atoms (the "game kit").
- **§15.9** — Display atoms (`display`, `newline`, `print`).

Entries within each subsection are alphabetical. Citations use the
preferred `file:Line · functionName()` dot-separator form per the
2026-06-22 SRE advisory at the head of this manual. Generated examples
are marked; sourced examples cite the cart they came from.

A handful of base bindings (`bricklay-pack-native`, `pi`, `inspect`)
either already have authoritative entries elsewhere in this manual or
exist as substrate hooks that aren't called from cart code; those carry
a back-reference rather than a full restatement.

---

### 15.1 Special forms

These 16 names are recognised by the `SPECIAL_FORMS` set at
`curator-web/src/scheme/interp.js:275-279` and handled directly by the
switch in `evalStep` (`interp.js:281-441`; the dispatch switch at
`:289-441`). They have no function value — `(map quote xs)` throws
`unbound symbol: quote` because the special-form name is intercepted
before any binding lookup runs.

At-a-glance reference card for `and` (the dual `or` is one section below):

```verb-card and
```

#### `(and expr1 expr2 ...)`

**Purpose:** short-circuit conjunction; returns the last truthy value, or `#f` if any conjunct is `#f`.
**Returns:** the value of the last conjunct when all are truthy, otherwise `#f`. With zero conjuncts, `#t`.
**Side effects:** none beyond the conjuncts'; evaluates left-to-right, stops at the first `#f`. The last conjunct is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:385 · evalStep() case 'and'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(and (pair? rows) (not (null? rows)))` — gate two preconditions on one line. *;; generated*
2. _(intermediate)_ inside an `if` to combine a tier check with a data check:
   ```scheme
   (if (and (eq? (ctx-get 'tier ctx) 'magic)
            (pair? (ctx-get 'finding ctx)))
       (next 'render ctx)
       (escalate 'tier-or-data-missing null))
   ```
   *;; generated*
3. _(expert)_ tail-position chain in a state function — the deepest `pair?` is the determining tail:
   ```scheme
   (when (and (eq? state 'ready)
              (not (null? rows))
              (pair? (assoc ':price_ladder_suggestion rows)))
     (next 'render (ctx-set 'finding rows ctx)))
   ```
   *;; generated, modelled on `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** prefer `and` over nested `if` for gate composition; lint reads more than three nested `if`s as a smell. See `or` (§15.1) for the dual, `cond` (§15.1) for multi-arm dispatch.

---

#### `(begin expr1 expr2 ... lastExpr)`

**Purpose:** sequential composition; evaluate each expression in order and return the last.
**Returns:** the value of the final expression. With zero expressions, `undefined`.
**Side effects:** all but the last are evaluated for effect; the last is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:329 · evalStep() case 'begin'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ two effects then end:
   ```scheme
   (begin (display "ready") (newline))
   ```
   *;; generated*
2. _(intermediate)_ chip emit + envelope queue + done — the common cart-render shape:
   ```scheme
   (begin
     (card-emit 'engine 'living-plan-ready (length finding))
     (envelope-queue (list 'the-living-business-plan ':finding finding))
     (done))
   ```
   *Source: adapted from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*
3. _(expert)_ tail-position composition inside a `let`:
   ```scheme
   (let ((finding (ctx-get 'finding ctx)))
     (begin
       (paint-arrow 'price-ladder-card ':anchors anchors ':glow 'warm-amber)
       (envelope-queue (list 'pink-price-ladder-suggest ':finding finding))
       (done)))
   ```
   *Source: condensed from `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks`*

**Notes:** lambda and `let` bodies have an implicit `begin` — wrap explicitly only when you need a sequence inside a position that takes one expression (the alternate arm of `if`, a `cond` clause, an `and` conjunct).

---

#### `(case key (datums body...) ... (else body...))`

**Purpose:** discrete dispatch on a key; each clause head is a list of possible matches, `else` catches the rest.
**Returns:** the value of the chosen clause's last form, or `undefined` if no clause matches and there is no `else`.
**Side effects:** evaluates the key once; matches numbers by `===` and symbols by name.
**Defined in:** `curator-web/src/scheme/interp.js:423 · evalStep() case 'case'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ route a state symbol:
   ```scheme
   (case state
     ((vacation paused) (escalate 'state-blocks-spend state))
     (else              (next 'fetch ctx)))
   ```
   *;; generated*
2. _(intermediate)_ classify a marketplace status code:
   ```scheme
   (case status
     ((connected)       (next 'fetch ctx))
     ((not-connected)   (escalate 'service-not-connected null))
     ((quota-exhausted) (escalate 'answers-quota null))
     (else              (escalate 'service-not-yet-wired null)))
   ```
   *;; generated*
3. _(expert)_ tier branch into three sub-state-machines:
   ```scheme
   (define (route ctx)
     (case (ctx-get 'tier ctx)
       ((free imagine) (next 'render-cheap ctx))
       ((dream)        (next 'render-mid ctx))
       ((magic)        (next 'render-full ctx))
       (else           (escalate 'tier-unknown null))))
   ```
   *;; generated*

**Notes:** `case` matches by `===` on numbers and by Sym-name on symbols — strings do NOT compare; use `cond` with `string=?` for string dispatch. See `cond` (§15.1).

---

#### `(cond (test body...) ... (else body...))`

**Purpose:** multi-way branching; the first truthy test wins.
**Returns:** the value of the chosen clause's last form. A one-element clause `(test)` returns the test value.
**Side effects:** evaluates tests left-to-right; stops at the first non-`#f`.
**Defined in:** `curator-web/src/scheme/interp.js:409 · evalStep() case 'cond'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ the canonical cart guard:
   ```scheme
   (cond
     ((null? rows)             (escalate 'no-data null))
     ((eq? rows 'rate-limited) (after 30 'fetch ctx))
     (else                     (next 'render ctx)))
   ```
   *Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks`*
2. _(intermediate)_ closed-set classification of a Loam result — every tag explicit, no catch-all gate:
   ```scheme
   (cond
     ((null? state)                      (escalate 'cortex-not-ready null))
     ((eq? (assoc 'vacation state) #t)   (escalate 'state-blocks-spend 'vacation))
     ((eq? (assoc 'paused state) #t)     (escalate 'state-blocks-spend 'paused))
     (else                               (next 'check-cache (ctx-set 'state state ctx))))
   ```
   *Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*
3. _(expert)_ closed-tag finding validator with explicit reason payloads:
   ```scheme
   (cond
     ((null? finding)
        (escalate 'service-not-yet-wired '(:status not-wired :reason "lacuna-returned-null")))
     ((eq? finding 'rate-limited)        (after 120 'lacuna-ask ctx))
     ((eq? finding 'cloud-tier-required) (escalate 'service-not-connected null))
     (else                               (next 'remember (ctx-set 'finding finding ctx))))
   ```
   *Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** prefer `cond` to nested `if` for more than two arms. The Scheme R7RS `=>` clause shape is NOT supported in this interpreter; use `let` to bind the test result if you need it in the body.

---

#### `(define name expr)` and `(define (name args...) body...)`

**Purpose:** bind a name in the current environment.
**Returns:** `undefined` (the effect is the binding).
**Side effects:** mutates the current env's variable map; post-freeze, throws on substrate names.
**Defined in:** `curator-web/src/scheme/interp.js:297 · evalStep() case 'define'`. Param parsing at `:205 · parseParams()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ every cart's entry state:
   ```scheme
   (define (start ctx) (next 'fetch ctx))
   ```
   *Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks`*
2. _(intermediate)_ helper + start composed:
   ```scheme
   (define (window-key topic) (list ':topic topic ':window 'now))
   (define (start ctx)
     (act 'cortex/recall (list (window-key 'living-plan-checkpoint)) 'check-prior))
   ```
   *;; generated*
3. _(expert)_ dotted-tail variadic procedure (R7RS §4.1.4) — `rest` binds to a list of all args past the fixed ones:
   ```scheme
   (define (log-fields tag . fields)
     (display tag) (newline)
     (for-each (lambda (f) (display f) (newline)) fields))
   (log-fields 'shop-status 'connected 'tier 'magic 'fuel 50000)
   ```
   *;; generated (dotted-tail path lands at `interp.js:303 · parseParams()`)*

**Notes:** the procedure shorthand `(define (f a b) body)` desugars to `(define f (lambda (a b) body))`. Mutually recursive definitions in a `letrec` body, or sequential `define`s at the top level, are the two supported recursion patterns. See `lambda` (§15.1), `letrec` (§15.1), `set!` (§15.1).

---

#### `(if test then else?)`

**Purpose:** two- or three-arm conditional.
**Returns:** the value of `then` when `test` is anything but `#f`; otherwise the value of `else` (or `#f` if absent).
**Side effects:** evaluates `test` eagerly; the chosen branch is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:292 · evalStep() case 'if'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a binary gate:
   ```scheme
   (if (null? rows) (escalate 'no-data null) (next 'render ctx))
   ```
   *;; generated*
2. _(intermediate)_ cache hit shortcut:
   ```scheme
   (define (check-today ctx)
     (let ((cached (ctx-result ctx)))
       (if (null? cached)
           (next 'recall-topics ctx)
           (next 'render-cached (ctx-set 'cached cached ctx)))))
   ```
   *Source: adapted from `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*
3. _(expert)_ nested gate — kept here as an honest counter-example to `cond`:
   ```scheme
   (if (eq? (ctx-get 'tier ctx) 'magic)
       (if (>= (length deltas) 12)
           (next 'assemble-quarter-memo ctx)
           (next 'accrue-week ctx))
       (escalate 'tier-not-permitted null))
   ```
   *;; generated*

**Notes:** R7RS truthiness — only `#f` is false. Empty list `()` is true in this interpreter (matches R7RS, NOT Common Lisp). For more than two arms, switch to `cond`.

---

#### `(lambda (params...) body...)`

**Purpose:** anonymous procedure; captures the current environment by reference.
**Returns:** a `Closure` (a first-class callable Scheme value).
**Side effects:** none at construction; the body has whatever effects it has when applied.
**Defined in:** `curator-web/src/scheme/interp.js:313 · evalStep() case 'lambda'`. Closure construction at `:174 · class Closure`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ map a name out of each row:
   ```scheme
   (map (lambda (row) (assoc 'title row)) rows)
   ```
   *;; generated*
2. _(intermediate)_ fold receipts into a revenue sum:
   ```scheme
   (reduce (lambda (acc r) (+ acc (assoc 'amount r))) 0 receipts)
   ```
   *;; generated*
3. _(expert)_ fully-variadic closure over local state — `(lambda args …)` shape gathers every call-time arg into `args`:
   ```scheme
   (let ((seen '()))
     (filter (lambda args
               (let ((id (car args)))
                 (if (member id seen)
                     #f
                     (begin (set! seen (cons id seen)) #t))))
             listings))
   ```
   *;; generated — variadic shape at `interp.js:321 · case 'lambda'` (form[1] instanceof Sym)*

**Notes:** **cart lint forbids inline `lambda`s as the on-result argument to `act`** — the on-result must be a quoted symbol so the cart is replayable. Three param shapes: fixed `(a b c)`, dotted-tail `(a b . rest)`, fully-variadic `args`. The dotted-tail and variadic shapes both land at `Closure.restParam` (`interp.js:188 · class Closure`).

---

#### `(let ((name expr) ...) body...)` and named-let `(let loop ((n v) ...) body...)`

**Purpose:** local bindings (and, for named-let, a recursive helper closure called once with the initial values).
**Returns:** the value of the last body expression.
**Side effects:** none beyond evaluating the initialisers (in the OUTER env) and the body (in the EXTENDED env). Last body form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:335 · evalStep() case 'let'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ pull one ctx value, branch:
   ```scheme
   (let ((cached (ctx-result ctx)))
     (if (null? cached)
         (next 'fetch ctx)
         (next 'render-cached (ctx-set 'cached cached ctx))))
   ```
   *Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*
2. _(intermediate)_ two parallel ctx pulls feeding a paint call:
   ```scheme
   (let ((anchors    (ctx-get 'anchors ctx))
         (copy-lines (ctx-get 'copy-lines ctx)))
     (paint-arrow 'price-ladder-card
                  ':anchors anchors ':labels copy-lines ':glow 'warm-amber))
   ```
   *Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks`*
3. _(expert)_ named-let iteration — tail-call-eliminated through the trampoline (`interp.js:347 · TailCall`):
   ```scheme
   (let loop ((items items) (i 0) (out '()))
     (if (null? items)
         (reverse out)
         (loop (cdr items) (+ i 1) (cons (list i (car items)) out))))
   ```
   *;; generated*

**Notes:** initialisers see the OUTER env — use `let*` when a later binding depends on an earlier one. Named-let is the standard Scheme iteration pattern in this codebase; lint reads it as the preferred form over hand-rolled recursive `define`s.

---

#### `(let* ((name expr) ...) body...)`

**Purpose:** sequential bindings — each initialiser sees every prior binding.
**Returns:** the value of the last body expression.
**Side effects:** none beyond the bindings + body.
**Defined in:** `curator-web/src/scheme/interp.js:355 · evalStep() case 'let*'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_
   ```scheme
   (let* ((a 1) (b (+ a 2))) b)   ;; → 3
   ```
   *;; generated*
2. _(intermediate)_ derive revenue from receipts:
   ```scheme
   (let* ((receipts (ctx-get 'receipts ctx))
          (revenue  (sum (map (lambda (r) (assoc 'amount r)) receipts))))
     (next 'render (ctx-set 'revenue revenue ctx)))
   ```
   *;; generated*
3. _(expert)_ layered derivation — ctx → feature → action:
   ```scheme
   (let* ((topics  (ctx-get 'topics ctx))
          (top-3   (take topics 3))
          (batched (act 'web-search (list 'top-headline-batch top-3) 'check-fetch)))
     batched)
   ```
   *;; generated*

**Notes:** if NONE of the bindings depend on the prior, `let` is clearer. If ALL of them do, `let*` is mandatory.

---

#### `(letrec ((name expr) ...) body...)`

**Purpose:** simultaneous bindings — each initialiser sees every binding (forward references allowed). The standard Lisp pattern for mutually recursive lambdas.
**Returns:** the value of the last body expression.
**Side effects:** bindings start `undefined`, then each is `set!`-ed to its evaluated value in the extended env.
**Defined in:** `curator-web/src/scheme/interp.js:362 · evalStep() case 'letrec'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a single recursive helper:
   ```scheme
   (letrec ((fact (lambda (n) (if (<= n 1) 1 (* n (fact (- n 1)))))))
     (fact 5))   ;; → 120
   ```
   *;; generated*
2. _(intermediate)_ mutually recursive even?/odd? — the canonical letrec demo:
   ```scheme
   (letrec ((even? (lambda (n) (if (= n 0) #t (odd?  (- n 1)))))
            (odd?  (lambda (n) (if (= n 0) #f (even? (- n 1))))))
     (even? 10))
   ```
   *;; generated*
3. _(expert)_ a tiny state machine assembled inline — each state references the others:
   ```scheme
   (letrec ((idle  (lambda (ev) (if (eq? ev 'start) (ready) (idle ev))))
            (ready (lambda ()   (if (pair? rows) (render rows) (idle 'wait))))
            (render(lambda (rs) (for-each display rs) (idle 'next))))
     (idle 'start))
   ```
   *;; generated*

**Notes:** prefer `let` or `let*` whenever forward references aren't needed; `letrec` is the heavyweight option. The forward-reference window opens at `interp.js:369 · for ([name] of form[1])` (placeholder define) and closes at `:370 · for ([name, expr] of form[1])` (real set!).

---

#### `(or expr1 expr2 ...)`

```verb-card or
```

**Purpose:** short-circuit disjunction; returns the first truthy value, or `#f` if every disjunct is `#f`.
**Returns:** the value of the first truthy disjunct (NOT coerced to `#t`); `#f` if all are `#f`. With zero disjuncts, `#f`.
**Side effects:** none beyond the disjuncts'; evaluates left-to-right, stops at the first truthy. The last disjunct is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:393 · evalStep() case 'or'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(or (null? rows) (zero? (length rows)))` — accept either "no list" or "empty list" as the empty case. *;; generated*
2. _(intermediate)_ default-value pattern — `or` returns the first truthy value, so it acts as a "first-non-`#f`" picker:
   ```scheme
   (define shop-id (or (ctx-get 'shop-id ctx) (env-get 'DEFAULT_SHOP) 'unknown))
   ```
   *;; generated*
3. _(expert)_ tail-position dispatch inside a state function — the last disjunct is the determining tail:
   ```scheme
   (or (try-cache key)
       (try-local-mirror key)
       (escalate 'service-not-yet-wired key))
   ```
   *;; generated, modelled on the cache-then-remote pattern across `curator-web/src/scheme/carts/dream/*.sks`*

**Notes:** `or` returns the truthy VALUE, not `#t` — use it for "first non-`#f`" pickers, not just boolean reduction. Only `#f` is false here (the empty list `()` is truthy), so `(or () 'fallback)` returns `()`, not `'fallback`. For "first non-empty" semantics, gate with `pair?` first. See `and` (§15.1) for the dual, `cond` (§15.1) for multi-arm dispatch.

---

#### `(quasiquote template)` — backtick `` ` ``, with `(unquote x)` (comma `,`) and `(unquote-splicing x)` (comma-at `,@`)

**Purpose:** templated data construction — most of the template is quoted, but `,x` and `,@x` interpolate values into specific positions.
**Returns:** a list (or nested list) with the unquotes filled in.
**Side effects:** evaluates only the unquoted expressions.
**Defined in:** `curator-web/src/scheme/interp.js:375 · evalStep() case 'quasiquote'`. Walker at `:510 · quasiExpand()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ inject one value into a literal list:
   ```scheme
   (let ((tier 'magic)) `(:tier ,tier))   ;; → (:tier magic)
   ```
   *;; generated*
2. _(intermediate)_ splice a list of args into a verb call template:
   ```scheme
   (let ((args (list 'this-week 'magic)))
     `(act etsy/receipts ,@args check-actuals))
   ;; → (act etsy/receipts this-week magic check-actuals)
   ```
   *;; generated*
3. _(expert)_ build a record with computed keys + spliced fields:
   ```scheme
   (let ((rev 1234) (fees (list (list ':etsy 25) (list ':shipping 12))))
     `(:revenue ,rev :fees-listed ,@fees))
   ```
   *;; generated — `unquote-splicing` walks at `interp.js:521 · for (const item of form)`*

**Notes:** nested quasiquotes are NOT supported — the walker handles a single level. Use ordinary `list` + `cons` for deep templating. The `unquote-splicing` form THROWS if used outside list position (predicate at `interp.js:516`; `throw` at `:517`).

---

#### `(quote datum)` — single-quote `'datum`

**Purpose:** suppress evaluation; return the literal datum.
**Returns:** the datum form, unevaluated.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/interp.js:290 · evalStep() case 'quote'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a literal symbol:
   ```scheme
   'magic   ;; → the Sym `magic` (not "lookup the binding named magic")
   ```
   *;; generated*
2. _(intermediate)_ a literal list as a fixed configuration:
   ```scheme
   (define days '(mon tue wed thu fri sat sun))
   ```
   *;; generated*
3. _(expert)_ quoted tag list as the on-result-payload pattern carts use everywhere:
   ```scheme
   (escalate 'service-not-yet-wired
             '(:status not-wired :reason "no-shop-id"))
   ```
   *Source: pattern across `curator-web/src/scheme/carts/**/*.sks`*

**Notes:** `'x` reads as `(quote x)`. The reader (`reader.js`) inserts the `quote` form before this evaluator ever sees the source; this case just unwraps it. For interpolation into a quoted list, use `quasiquote`.

---

#### `(set! name expr)`

**Purpose:** mutate an existing binding.
**Returns:** `undefined`.
**Side effects:** updates the env entry for `name`; throws if `name` is unbound, or if the env is frozen and `name` is a substrate binding (`interp.js:75 · throw new Error('frozen sandbox: cannot set! substrate binding')`).
**Defined in:** `curator-web/src/scheme/interp.js:310 · evalStep() case 'set!'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ counter increment:
   ```scheme
   (define n 0) (set! n (+ n 1)) n   ;; → 1
   ```
   *;; generated*
2. _(intermediate)_ accumulator inside a closure:
   ```scheme
   (define (make-counter) (let ((n 0)) (lambda () (set! n (+ n 1)) n)))
   (define tick (make-counter))
   (tick) (tick) (tick)   ;; → 3
   ```
   *;; generated*
3. _(expert)_ dedup with closure-state (note: cart lint prefers pure helpers — this pattern is allowed for closure-local memos, not for cross-cart state):
   ```scheme
   (let ((seen '()))
     (filter (lambda (id)
               (if (member id seen)
                   #f
                   (begin (set! seen (cons id seen)) #t)))
             listing-ids))
   ```
   *;; generated*

**Notes:** `set!` is the language's only general mutation primitive; everything else is data construction. Substrate names (every base binding, every special form) are frozen at boot — `(set! car …)` throws. Use sparingly: pure `let` + recursion is the dominant pattern in this codebase.

---

#### `(unless test body...)`

**Purpose:** inverse of `when` — evaluate the body only when `test` is `#f`.
**Returns:** the value of the last body form, or `undefined` if `test` is truthy.
**Side effects:** evaluates `test` once; body's last form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:401 · evalStep() case 'unless'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(unless (null? rows) (display "got rows") (newline))` — *;; generated*
2. _(intermediate)_ guard a fetch behind a connect state:
   ```scheme
   (unless (eq? status 'not-connected)
     (next 'fetch ctx))
   ```
   *;; generated*
3. _(expert)_ tail-position composition inside a state function — the trailing form is what the state returns:
   ```scheme
   (define (maybe-render ctx)
     (unless (null? (ctx-get 'rows ctx))
       (paint-table (ctx-get 'rows ctx))
       (done)))
   ```
   *;; generated*

**Notes:** prefer `unless` over `(if (not test) body)` for readability when the negative is the meaningful arm. See `when` (§15.1) for the positive form.

---

#### `(when test body...)`

**Purpose:** one-armed conditional — evaluate the body only when `test` is truthy.
**Returns:** the value of the last body form, or `undefined` if `test` is `#f`.
**Side effects:** evaluates `test` once; body's last form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:377 · evalStep() case 'when'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(when (pair? rows) (display "got rows") (newline))` — *;; generated*
2. _(intermediate)_ fire one chip when a finding lands:
   ```scheme
   (when (pair? finding)
     (card-emit 'engine 'finding-ready (length finding)))
   ```
   *;; generated*
3. _(expert)_ tail-position composition:
   ```scheme
   (when (and (eq? (ctx-get 'tier ctx) 'magic) (pair? rows))
     (paint-arrow 'price-ladder-card ':anchors anchors)
     (envelope-queue (list 'magic-ladder ':rows rows))
     (done))
   ```
   *;; generated*

**Notes:** `when` + `unless` complement `if` for the common case where one arm has no else.

---

### 15.2 Equality and predicates

The R7RS type-predicate set, plus the codebase's `=?` smart-equality
verb. All of these are pure, total, side-effect-free `(perm: 'read')`
base bindings — they're first-class values that can be passed to `map`,
`filter`, `every`, etc.

#### `(=? a b)` and its aliases `eq?` / `equal?`

**Purpose:** smart equality — the PICO-8-style "do what I mean" verb. Numbers + strings by value, lists structurally, symbols by name, everything else by reference.
**Returns:** `#t` or `#f`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:101 · def('=?', _eqQ)`. Helper at `:84 · function _eqQ()`. Legacy aliases `eq?` and `equal?` re-bind to the same `_eqQ` at `:104-105`. **Note the second definition site**: `base.js:244 · def('eq?', (a, b) => a === b)` and `:245 · def('equal?', (a, b) => deepEqual(a, b))` REPLACE the smart-equality bindings for the legacy names — `eq?` ends up as JS `===` (reference equality) and `equal?` ends up as `deepEqual` (length-aware structural). The smart-equality verb is reachable only as `=?`. (Authors moving carts in from other Schemes should prefer `=?`; the legacy spellings are kept compatible with Racket/Chez intuition.)

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ symbol equality:
   ```scheme
   (=? 'magic 'magic)   ;; → #t
   ```
   *;; generated*
2. _(intermediate)_ list equality:
   ```scheme
   (=? '(1 2 3) (list 1 2 3))   ;; → #t — structural compare
   ```
   *;; generated*
3. _(expert)_ predicate composition — pass `=?` directly into `filter`:
   ```scheme
   (filter (lambda (row) (=? (car row) 'magic)) rows)
   ```
   *;; generated*

**Notes:** when reaching for "are these the same?" in cart code, default to `=?`. The numeric `=` (§15.4) is reserved for the numeric comparison chain.

---

#### `(boolean? x)` · `(null? x)` · `(number? x)` · `(pair? x)` · `(procedure? x)` · `(string? x)` · `(symbol? x)`

**Purpose:** R7RS type predicates. Each returns `#t` for the named type and `#f` otherwise.
**Returns:** boolean.
**Side effects:** none.
**Defined in:**
- `boolean?` — `curator-web/src/scheme/base.js:253 · def('boolean?', ...)`
- `null?` — `curator-web/src/scheme/base.js:52 · def('null?', ...)` (true on empty list)
- `number?` — `curator-web/src/scheme/base.js:251 · def('number?', ...)`
- `pair?` — `curator-web/src/scheme/base.js:59 · def('pair?', ...)` (true on NON-empty list — empty list is null, not pair)
- `procedure?` — `curator-web/src/scheme/base.js:61 · def('procedure?', ...)` (JS function OR Closure)
- `string?` — `curator-web/src/scheme/base.js:252 · def('string?', ...)`
- `symbol?` — `curator-web/src/scheme/base.js:60 · def('symbol?', ...)` (instance of `Sym`)

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ guard a list head:
   ```scheme
   (if (pair? rows) (car rows) 'no-rows)
   ```
   *;; generated*
2. _(intermediate)_ closed-tag dispatch combining predicates:
   ```scheme
   (cond
     ((null? finding)   (escalate 'no-data null))
     ((string? finding) (next 'render-text (ctx-set 'msg finding ctx)))
     ((pair? finding)   (next 'render-rows (ctx-set 'rows finding ctx)))
     (else              (escalate 'unknown-shape null)))
   ```
   *;; generated*
3. _(expert)_ pass a predicate to `every`:
   ```scheme
   (when (every number? amounts)
     (next 'sum-amounts ctx))
   ```
   *;; generated*

**Notes:** `null?` and `pair?` partition the list space — `(null? ())` is `#t` and `(pair? ())` is `#f`; for a non-empty list, the reverse. There is no `list?` in this base — use `(or (null? x) (pair? x))` if you need it. `procedure?` accepts both JS primitives (functions) and user-authored `Closure`s, so it correctly classifies anything callable.

---

#### `(zero? x)` · `(positive? x)` · `(negative? x)` · `(even? x)` · `(odd? x)`

**Purpose:** scalar number predicates.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:246-250`. Each is a one-liner over `Math.sign` / modulo.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(if (zero? balance) 'empty 'has-funds)` — *;; generated*
2. _(intermediate)_ stripe rows for a table:
   ```scheme
   (map (lambda (i) (if (even? i) 'light 'dark)) (range 0 12))
   ```
   *;; generated*
3. _(expert)_ filter-with-predicate composition:
   ```scheme
   (count positive? deltas)   ;; how many days were up?
   ```
   *;; generated*

**Notes:** `odd?` uses `Math.abs(x % 2) === 1` (base.js:250) — correct for both positive and negative integers; non-integer arguments return `#f`. `zero?` is strict `=== 0`; floating-point comparisons should use a tolerance check, not `zero?`.

---

#### `(not x)`

**Purpose:** logical negation.
**Returns:** `#t` if `x` is `#f`, else `#f`. **Only `#f` is false** (R7RS — empty list `()` is truthy here).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:42 · def('not', (a) => a === false)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(not (null? rows))` → `#t` if rows is non-empty. *;; generated*
2. _(intermediate)_ in a `when` guard:
   ```scheme
   (when (not (eq? state 'paused)) (next 'fetch ctx))
   ```
   *;; generated*
3. _(expert)_ explicit negative arm in a closed `cond`:
   ```scheme
   (cond
     ((eq? status 'connected)        (next 'fetch ctx))
     ((not (eq? status 'connected))  (escalate 'service-not-yet-wired null)))
   ```
   *Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*

**Notes:** prefer `unless` over `(if (not test) …)` when the negative arm is the only arm. `not` is a function (first-class), not a special form — passable to `every` / `any`.

---

### 15.3 List + sequence atoms

> "It is better to have 100 functions operate on one data structure
> than 10 functions on 10 data structures." — Alan J. Perlis,
> *Epigrams on Programming*, 1982, epigram 9

The Curator Scheme follows Perlis — every list verb operates on the
same JS-array-backed representation. A pair is any array with at least
one element; the empty list is the empty array. There are no separate
"vector" / "deque" / "cons cell" structures at the language layer.

#### `(append lst1 lst2 ...)`

**Purpose:** concatenate any number of lists into one fresh list.
**Returns:** a new list (does not mutate inputs).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:170 · def('append', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(append '(1 2) '(3 4))` → `(1 2 3 4)`. *;; generated*
2. _(intermediate)_ build a chip stack: `(append head-chips body-chips foot-chips)`. *;; generated*
3. _(expert)_ accumulate via reduce — `append` is associative, so reduce is the right shape:
   ```scheme
   (reduce append '() (map render-row rows))
   ```
   *;; generated*

**Notes:** `append` allocates — for large reductions, prefer `reverse` + `cons` patterns. Variadic; `(append)` with no args returns `()`.

---

#### `(argmin lst)`

**Purpose:** index of the smallest number in a list (ties: leftmost wins).
**Returns:** integer index, or `#f` on an empty/non-list input.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:331 · def('argmin', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(argmin '(3 1 4 1 5))` → `1`. *;; generated*
2. _(intermediate)_ pick the shortest column (the bricklay packer's pattern):
   ```scheme
   (let ((bottoms (list 120 80 200 80)))
     (argmin bottoms))   ;; → 1
   ```
   *Source: bricklay layout cart pattern — `base.js:308` block comment*
3. _(expert)_ combine with `list-ref` to extract the lowest of a derived list:
   ```scheme
   (let* ((costs (map cart-cost candidates))
          (i     (argmin costs)))
     (list-ref candidates i))
   ```
   *;; generated*

**Notes:** integers and floats both work — JS `<` is the comparison. For arbitrary-key minimization, write a `reduce` with your own less-than.

---

#### `(assoc key alist)`

**Purpose:** look up `key` in an association list (a list of `(key value …)` lists). Uses structural equality.
**Returns:** the matching sublist, or `#f` if not found.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:293 · def('assoc', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(assoc 'title '((title "Hat") (price 12)))` → `(title "Hat")`. *;; generated*
2. _(intermediate)_ extract a field with a fallback:
   ```scheme
   (let ((pair (assoc ':tier ctx)))
     (if pair (cadr pair) 'free))
   ```
   *;; generated*
3. _(expert)_ closed-tag dispatch on alist presence:
   ```scheme
   (cond
     ((assoc 'vacation state)   (escalate 'state-blocks-spend 'vacation))
     ((assoc 'paused state)     (escalate 'state-blocks-spend 'paused))
     (else                      (next 'check-cache ctx)))
   ```
   *Source: pattern from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** `assoc` returns the WHOLE sublist (use `cadr` to get the value). Carts also use `assq` in some places — that's installed by a separate macros pass, not by `base.js`. `assoc` here uses `deepEqual`, so `(assoc '(a 1) ...)` works structurally.

---

#### `(cadr lst)` and `(caddr lst)`

**Purpose:** second and third elements of a list. Standard Scheme accessors.
**Returns:** the element, or `undefined` if past the end.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:50-51`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(cadr '(a b c))` → `b`. *;; generated*
2. _(intermediate)_ second-tuple-field extract: `(map cadr pairs)`. *;; generated*
3. _(expert)_ deconstruct an RGB triple from a hex parse: `(list (car rgb) (cadr rgb) (caddr rgb))`. *;; generated*

**Notes:** these exist because the long-form `(car (cdr x))` and `(car (cdr (cdr x)))` chain becomes unreadable fast. The conway additive-blend cart cited them as the reason for adding both shortcuts (`base.js:48` comment).

---

#### `(car lst)` and `(cdr lst)`

**Purpose:** first element (`car`) and tail (`cdr`) of a list. The two oldest verbs in Lisp.
**Returns:** `car` → the first element. `cdr` → a fresh list of all but the first.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:46-47`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(car '(1 2 3))` → `1`; `(cdr '(1 2 3))` → `(2 3)`. *;; generated*
2. _(intermediate)_ recurse over a list (note: prefer named-let in this codebase):
   ```scheme
   (define (sum-all lst)
     (if (null? lst) 0 (+ (car lst) (sum-all (cdr lst)))))
   ```
   *;; generated*
3. _(expert)_ destructure-then-fold:
   ```scheme
   (let loop ((rs rows) (rev 0) (n 0))
     (if (null? rs)
         (list rev n)
         (loop (cdr rs)
               (+ rev (assoc 'amount (car rs)))
               (+ n 1))))
   ```
   *;; generated*

**Notes:** `cdr` allocates (it's `Array.prototype.slice`). For tight inner loops, `nth` (§15.3) and `list-ref` are O(1); for ergonomic Scheme idiom, `car`/`cdr` are fine. `(car ())` and `(cdr ())` return `undefined` and `()` respectively — they do NOT throw. If you need to guard, gate with `(pair? x)`.

---

#### `(cons a b)`

**Purpose:** prepend `a` onto `b` (or onto the single-element list `(b)` if `b` isn't a list). The list-builder.
**Returns:** a fresh list with `a` as the head.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:45 · def('cons', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(cons 1 '(2 3))` → `(1 2 3)`. *;; generated*
2. _(intermediate)_ accumulate in reverse, then flip:
   ```scheme
   (let loop ((xs xs) (out '()))
     (if (null? xs) (reverse out) (loop (cdr xs) (cons (car xs) out))))
   ```
   *;; generated — the standard reverse-accumulate idiom*
3. _(expert)_ build a fresh alist entry:
   ```scheme
   (cons (list ':timestamp now)
         (cons (list ':tier tier) existing-meta))
   ```
   *;; generated*

**Notes:** this `cons` represents pairs as JS arrays, NOT as boxed cons cells — `(cons 1 2)` returns `(1 2)` (the tail `2` is wrapped into a single-element list). Authors expecting Scheme's improper-list cons cells (`(1 . 2)`) should be aware that there is no dotted-pair structure in this interpreter; the dotted-tail syntax in `lambda` / `define` param lists is reader-level only.

---

#### `(drop lst n)`

**Purpose:** all but the first `n` elements.
**Returns:** a fresh list (the tail).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:162 · def('drop', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(drop '(a b c d) 2)` → `(c d)`. *;; generated*
2. _(intermediate)_ paginate: `(take (drop rows offset) page-size)`. *;; generated*
3. _(expert)_ skip header rows in a CSV-shaped list: `(map render-row (drop rows 1))`. *;; generated*

**Notes:** non-list input returns `()`. Negative `n` clamps to 0. Pairs with `take` (§15.3).

---

#### `(first lst)` · `(last lst)` · `(nth lst i)` · `(list-ref lst i)`

**Purpose:** positional access. `first` = `(car lst)`. `last` = the final element. `nth` and `list-ref` = O(1) index access; they are aliases.
**Returns:** the element, or `undefined` past the end.
**Side effects:** none.
**Defined in:**
- `first` — `curator-web/src/scheme/base.js:172`
- `last` — `curator-web/src/scheme/base.js:173`
- `nth` — `curator-web/src/scheme/base.js:174`
- `list-ref` — `curator-web/src/scheme/base.js:291`

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(last '(a b c))` → `c`. *;; generated*
2. _(intermediate)_ alternate-row stripe by index: `(map (lambda (i) (if (even? i) 'light 'dark)) (range 0 (length rows)))`. *;; generated*
3. _(expert)_ extract a triple by position: `(list (nth row 0) (nth row 3) (nth row 7))`. *;; generated*

**Notes:** `first` and `nth` are SRFI-1 convenience aliases — `car` and `list-ref` are R7RS canon. In this codebase they all reach for the same JS-array index op. `last` walks via `(length - 1)` index access; on a typical card-row list (≤ 64 entries) the cost is invisible.

---

#### `(length lst)`

**Purpose:** number of elements.
**Returns:** non-negative integer.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:62 · def('length', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(length '(a b c))` → `3`. *;; generated*
2. _(intermediate)_ chip count: `(card-emit 'engine 'ready-count (length finding))`. *Source: `the-living-business-plan.sks` shape*
3. _(expert)_ tier guard by data shape: `(when (>= (length deltas) 12) (next 'assemble-quarter-memo ctx))`. *;; generated*

**Notes:** O(1) — backed by JS `Array.length`. There is no `length` warning on non-list input; it returns `undefined`, which is rarely what you want — gate with `(pair? x)` first if input could be non-list.

---

#### `(list arg1 arg2 ...)`

**Purpose:** construct a fresh list from the given arguments.
**Returns:** the list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:44 · def('list', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list 1 2 3)` → `(1 2 3)`. *;; generated*
2. _(intermediate)_ build an alist entry: `(list ':tier tier ':fuel fuel)`. *;; generated*
3. _(expert)_ build a row of pair-encoded args to pass to `act`:
   ```scheme
   (act 'cortex/recall
        (list (list ':topic 'living-plan-checkpoint)
              (list ':window 'now))
        'check-prior)
   ```
   *;; generated*

**Notes:** `list` is the friendliest builder when the elements are known statically. For the dynamic accumulation case use `cons` + `reverse`. Variadic; `(list)` with no args returns `()`.

---

#### `(list-index pred lst)`

**Purpose:** index of the first element for which `pred` returns non-`#f`. SRFI-1 standard.
**Returns:** integer index, or `#f` if no element matches.
**Side effects:** invokes `pred` once per element until a hit (shares fuel via the trampoline).
**Defined in:** `curator-web/src/scheme/base.js:324 · def('list-index', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list-index odd? '(2 4 5 6))` → `2`. *;; generated*
2. _(intermediate)_ find the first connected shop in a list of `(id status)` pairs:
   ```scheme
   (list-index (lambda (s) (eq? (cadr s) 'connected)) shops)
   ```
   *;; generated*
3. _(expert)_ combine with `list-set` to update the first match:
   ```scheme
   (let ((i (list-index (lambda (r) (eq? (car r) target)) rows)))
     (if i (list-set rows i replacement) rows))
   ```
   *;; generated*

**Notes:** SRFI-1 returns `#f` on no-match, not `-1`. Pair with `list-set` (§15.3) for immutable point-mutations.

---

#### `(list-set lst i value)`

**Purpose:** return a NEW list with element `i` replaced by `value`. Pure — the source list is not mutated.
**Returns:** a fresh list of the same length.
**Side effects:** none (note: this is intentionally NOT the destructive `list-set!` of R7RS).
**Defined in:** `curator-web/src/scheme/base.js:318 · def('list-set', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list-set '(a b c) 1 'X)` → `(a X c)`. *;; generated*
2. _(intermediate)_ update one column-bottom in the bricklay packer:
   ```scheme
   (list-set bottoms i (+ (nth bottoms i) card-h))
   ```
   *Source: bricklay layout cart pattern — `base.js:303` block comment*
3. _(expert)_ apply a function at one index:
   ```scheme
   (define (update-at lst i fn)
     (list-set lst i (fn (nth lst i))))
   ```
   *;; generated*

**Notes:** out-of-range `i` returns the list unchanged. The immutable shape matches every other list verb here — there is no destructive `list-set!` exposed. The whole-array `.slice()` copy is fine for the cart-scale lists (≤ 256 elements) the codebase uses.

---

#### `(make-list n value)`

**Purpose:** a fresh list of length `n` filled with `value`.
**Returns:** the list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:312 · def('make-list', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(make-list 4 0)` → `(0 0 0 0)`. *;; generated*
2. _(intermediate)_ initial column-bottoms vector for the bricklay packer:
   ```scheme
   (make-list num-cols BRICKLAY-MARGIN)
   ```
   *Source: bricklay layout cart pattern — `base.js:299` block comment*
3. _(expert)_ seeded mutable accumulator (use sparingly — pure folds are usually better):
   ```scheme
   (let ((slots (make-list 16 #f)))
     (for-each (lambda (i) (when (eligible? i) (set-slot slots i))) (range 0 16))
     slots)
   ```
   *;; generated*

**Notes:** `n` is clamped to ≥ 0 and truncated to int. All cells share the same `value` reference — fine for atoms (numbers/symbols), be careful with mutable objects.

---

#### `(member x lst)`

**Purpose:** membership test that returns the tail starting at the match. Uses structural equality (`deepEqual`).
**Returns:** the sublist beginning at the first match, or `#f` if not found.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:292 · def('member', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(member 'b '(a b c))` → `(b c)`. *;; generated*
2. _(intermediate)_ dedup check:
   ```scheme
   (if (member id seen) #f (begin (set! seen (cons id seen)) #t))
   ```
   *;; generated — the dedup-with-closure-state pattern*
3. _(expert)_ as a presence guard in a `cond`:
   ```scheme
   (cond
     ((member tier '(dream magic)) (next 'render-full ctx))
     ((member tier '(imagine))     (next 'render-mid ctx))
     (else                         (next 'render-cheap ctx)))
   ```
   *;; generated*

**Notes:** Scheme's "return the tail" rather than "return boolean" is intentional — a truthy result is usable directly in `cond` / `if`, and you can peek at what came after. For boolean-only membership, wrap in `pair?` or use `any` (§15.6).

---

#### `(range a b)`

**Purpose:** the list of integers `a, a+1, …, b-1`.
**Returns:** a fresh list of integers. Empty if `a >= b`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:63 · def('range', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(range 0 5)` → `(0 1 2 3 4)`. *;; generated*
2. _(intermediate)_ paint a row of points at index-derived x positions:
   ```scheme
   (for-each (lambda (i) (paint-point-at (* 30 i) 100)) (range 0 8))
   ```
   *;; generated*
3. _(expert)_ index-zip with `zip`: `(zip (range 0 (length rows)) rows)` → indexed list. *;; generated*

**Notes:** half-open `[a, b)` — matches the Python/Racket convention, NOT the SRFI-1 `iota` shape. Single-arg `(range n)` is NOT supported; always pass both bounds.

---

#### `(reverse lst)`

**Purpose:** return a fresh list with elements in reverse order.
**Returns:** a fresh list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:171 · def('reverse', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(reverse '(1 2 3))` → `(3 2 1)`. *;; generated*
2. _(intermediate)_ the canonical accumulate-then-flip idiom:
   ```scheme
   (let loop ((xs xs) (out '()))
     (if (null? xs) (reverse out) (loop (cdr xs) (cons (car xs) out))))
   ```
   *;; generated*
3. _(expert)_ chronological reorder of a stack-shaped event list: `(reverse events)`. *;; generated*

**Notes:** `reverse` allocates one fresh JS array. For "is this list reversed?" queries, prefer index-based access (`list-ref lst (- (length lst) 1 i)`).

---

#### `(sort lst less?)`

**Purpose:** stable ascending sort under the two-arg `less?` predicate.
**Returns:** a fresh list.
**Side effects:** invokes `less?` `O(n log n)` times (shares the trampoline fuel).
**Defined in:** `curator-web/src/scheme/base.js:340 · def('sort', ...)`. Stability via decorate-sort-undecorate.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ ascending numeric sort: `(sort '(3 1 4 1 5) <)` → `(1 1 3 4 5)`. *;; generated*
2. _(intermediate)_ sort rows by amount descending:
   ```scheme
   (sort rows (lambda (a b) (> (assoc 'amount a) (assoc 'amount b))))
   ```
   *;; generated*
3. _(expert)_ FFD-style bricklay pre-sort by (height desc, width desc):
   ```scheme
   (sort cards
         (lambda (a b)
           (let ((ah (nth a 2)) (bh (nth b 2)))
             (if (= ah bh) (> (nth a 1) (nth b 1)) (> ah bh)))))
   ```
   *;; generated — pattern used before `bricklay-pack-native` is called*

**Notes:** stable — equal elements preserve their relative input order. Returns the input unchanged on non-list input. For descending sort, pass `>` (or invert the comparison inside `less?`).

---

#### `(take lst n)`

**Purpose:** the first `n` elements (or all of them if `n` exceeds the length).
**Returns:** a fresh list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:161 · def('take', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(take '(a b c d) 2)` → `(a b)`. *;; generated*
2. _(intermediate)_ top-3 picker: `(take (sort topics rank>) 3)`. *;; generated*
3. _(expert)_ paginate the cart-news rendering: `(take (drop rows (* page page-size)) page-size)`. *;; generated*

**Notes:** non-list input returns `()`. Negative `n` clamps to 0. Pairs with `drop`.

---

#### `(zip lst-a lst-b)`

**Purpose:** pair up corresponding elements; result length is `min(len-a, len-b)`.
**Returns:** a list of two-element lists.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:163 · def('zip', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(zip '(a b c) '(1 2 3))` → `((a 1) (b 2) (c 3))`. *;; generated*
2. _(intermediate)_ index-zip via `range`: `(zip (range 0 (length rows)) rows)`. *;; generated*
3. _(expert)_ x/y interleave for paint dispatch:
   ```scheme
   (for-each (lambda (pt) (paint-point-at (car pt) (cadr pt)))
             (zip xs ys))
   ```
   *;; generated*

**Notes:** two-list only; for n-ary zip, compose with `map` over `zip`. The shorter input wins — no padding, no error.

---

### 15.4 Arithmetic atoms

> "A LISP programmer knows the value of everything, but the cost of
> nothing." — Alan J. Perlis, *Epigrams on Programming*, 1982,
> epigram 55

Standard R7RS arithmetic + numeric comparisons + the codebase's
shop-shaped helpers (`pct`, `margin`, `cagr`). All variadic forms
short-fold; binary forms are strict two-arg.

#### `(+ a b ...)` · `(- a b ...)` · `(* a b ...)` · `(/ a b ...)`

**Purpose:** variadic arithmetic.
**Returns:** number. `(+)` → 0, `(*)` → 1. Unary `(- x)` → negation, `(/ x)` → reciprocal.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:26-29`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(+ 1 2 3)` → `6`; `(- 10 1 2)` → `7`; `(* 2 3 4)` → `24`; `(/ 100 2 5)` → `10`. *;; generated*
2. _(intermediate)_ sum a row of amounts: `(reduce + 0 amounts)`. *;; generated*
3. _(expert)_ chained derivation:
   ```scheme
   (let* ((gross (* qty unit-price))
          (fees  (+ (* gross 0.06) shipping-fee))
          (net   (- gross fees)))
     net)
   ```
   *;; generated*

**Notes:** all four are JS-double-backed — no rationals, no bignums. For money math, the dedicated finance verbs (`pct`, `margin`, `markup`, `markdown`, `profit`, `fee`, `net` at `base.js:212-219`) are correct-rounded for the percent-shaped operations carts reach for first.

---

#### `(< a b)` · `(<= a b)` · `(= a b)` · `(>= a b)` · `(> a b)`

**Purpose:** numeric comparison. **Binary only** in this interpreter — no chained `(< a b c)` (that's a separate macro layer).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:37-41`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(< 1 2)` → `#t`. *;; generated*
2. _(intermediate)_ gate by row count: `(>= (length rows) 12)`. *;; generated*
3. _(expert)_ filter to a numeric window:
   ```scheme
   (filter (lambda (x) (and (>= x lo) (< x hi))) values)
   ```
   *;; generated*

**Notes:** `=` is **numeric** comparison only (`a === b` after both are numbers); for symbol/list equality use `=?` (§15.2). Chained Scheme `(< a b c d)` is not directly supported here — write `(and (< a b) (< b c) (< c d))` or install a macro.

---

#### `(abs x)` · `(max a b ...)` · `(min a b ...)` · `(sign x)`

**Purpose:** standard scalar math.
**Returns:** number. `sign` → `-1`, `0`, or `1`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:33-35, 191`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(abs -7)` → `7`; `(max 1 5 3)` → `5`. *;; generated*
2. _(intermediate)_ clamp positive deltas only: `(map (lambda (d) (max 0 d)) deltas)`. *;; generated*
3. _(expert)_ direction-of-change indicator: `(sign (- now prev))` → `-1`/`0`/`1`. *;; generated*

**Notes:** all variadic except `abs` and `sign`. `max` / `min` follow JS — `Math.max(...args)` — which means a single non-number argument poisons the call to `NaN`. Filter first.

---

#### `(ceil x)` / `(ceiling x)` · `(floor x)` · `(round x)` · `(round2 x)`

**Purpose:** rounding.
**Returns:** number. `round2` rounds to 2 decimal places (the money helper).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:184-190`. `ceil` and `ceiling` are aliases (`:185, :188`).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(round 3.7)` → `4`; `(floor 3.7)` → `3`. *;; generated*
2. _(intermediate)_ dollar-round a derived price: `(round2 (* base 1.0875))`. *;; generated*
3. _(expert)_ snap a coordinate to the grid: `(* GRID (floor (/ x GRID)))`. *;; generated*

**Notes:** `round` follows JS `Math.round` — half-to-positive-infinity, NOT banker's rounding. For money, `round2` is the convention.

---

#### `(clamp x lo hi)` · `(lerp a b t)`

**Purpose:** clamp `x` into `[lo, hi]`; lerp linearly interpolates between `a` and `b` by `t`.
**Returns:** number.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:192-193`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(clamp 130 0 100)` → `100`. *;; generated*
2. _(intermediate)_ fade in: `(lerp 0 1 (/ frame 60))`. *;; generated*
3. _(expert)_ ease a coordinate inside a guard:
   ```scheme
   (let ((t (clamp (/ (- now t0) dur) 0 1)))
     (lerp x0 x1 t))
   ```
   *;; generated — the common motion-tween shape*

**Notes:** `lerp` does NOT clamp `t` — pass values outside `[0,1]` and you get extrapolation. Wrap with `clamp` if you need bounded interpolation.

---

#### `(cos x)` · `(sin x)` · `(tan x)` · `(atan2 y x)` · `(sqrt x)` · `(expt b p)`

**Purpose:** scalar trig and powers.
**Returns:** number.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:177-183` — `sqrt` at `:177`; `cos`, `sin`, `tan`, `atan2` at `:178-181`; `expt` at `:183` (`pi` is the value bound at `:182`).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(sqrt 9)` → `3`. *;; generated*
2. _(intermediate)_ polar-to-cartesian:
   ```scheme
   (let ((x (* r (cos theta))) (y (* r (sin theta)))) (list x y))
   ```
   *;; generated*
3. _(expert)_ ring of points using radial spread:
   ```scheme
   (for-each (lambda (i)
               (let ((theta (* 2 pi (/ i 12))))
                 (paint-point-at (+ cx (* r (cos theta)))
                                 (+ cy (* r (sin theta))))))
             (range 0 12))
   ```
   *;; generated — modelled on the celebration-burst pattern at §14.3*

**Notes:** `atan2` is the four-quadrant inverse tangent — `(atan2 y x)` returns a radian angle. `pi` is a value, not a thunk — bind as `pi`, not `(pi)`. `expt` is `Math.pow`.

---

#### `(modulo x y)` · `(quotient x y)` · `(remainder x y)`

**Purpose:** integer division verbs.
**Returns:** number. `modulo` matches mathematical modulo (always non-negative when `y > 0`); `quotient` truncates toward zero; `remainder` is `x - trunc(x/y)*y`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:30-32`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(modulo -7 3)` → `2`; `(remainder -7 3)` → `-1`. *;; generated*
2. _(intermediate)_ stripe rows mod 2: `(map (lambda (i) (if (= 0 (modulo i 2)) 'light 'dark)) (range 0 8))`. *;; generated*
3. _(expert)_ wrap an angle: `(modulo theta-degrees 360)`. *;; generated*

**Notes:** **prefer `modulo` over `remainder`** for any code that should handle negative inputs cleanly. JS's `%` operator behaves like `remainder`; `modulo` is implemented as `((x % y) + y) % y` to give the mathematician's modulo.

---

#### `(sum lst)` · `(mean lst)` · `(sma lst n)`

**Purpose:** aggregate helpers. `sum` sums a list; `mean` averages; `sma` returns a simple moving average as a fresh list.
**Returns:** number for `sum`/`mean`; list of numbers for `sma`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:208-228`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(sum '(1 2 3))` → `6`; `(mean '(2 4 6))` → `4`. *;; generated*
2. _(intermediate)_ 7-day SMA of daily revenue:
   ```scheme
   (sma daily-revenue 7)
   ```
   *;; generated*
3. _(expert)_ derived feature for a Loam cart:
   ```scheme
   (let* ((rev   (map (lambda (r) (assoc 'amount r)) receipts))
          (sma7  (sma rev 7))
          (trend (if (and (pair? sma7) (> (last sma7) (first sma7))) 'up 'down)))
     (next 'render (ctx-set 'trend trend ctx)))
   ```
   *;; generated*

**Notes:** `sma` returns a list of length `(- (length lst) n -1)` if `n ≤ length`; otherwise `()`. `mean` of `()` is `0` (not `NaN`) — a safe-default convention specific to this base.

---

#### `(pct a b)` · `(pct-change old new)` · `(margin price cost)` · `(markup cost pct-up)` · `(markdown price pct-off)` · `(profit revenue cost)` · `(fee amount rate-pct)` · `(net gross fee1 fee2 ...)` · `(cagr begin end years)`

**Purpose:** the codebase's shop-shaped finance verbs.
**Returns:** number. `pct` returns "`a` as a percent of `b`" (0–100, not 0–1).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:212-220`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(pct 25 100)` → `25`. *;; generated*
2. _(intermediate)_ pricing ladder math: `(markup 12.50 35)` → `16.875`. *;; generated*
3. _(expert)_ compose into a single derived row:
   ```scheme
   (list ':price price
         ':cost  cost
         ':margin-pct (round2 (margin price cost))
         ':fee-pct    (round2 (pct (fee price 6.5) price)))
   ```
   *;; generated*

**Notes:** all of these are **percent-shaped** (0–100, not 0–1) — matches the cart-author intuition. Divide-by-zero is safe (returns 0); divide by `years <= 0` is also safe in `cagr`. For very small amounts where floating point bites, run through `round2`.

---

#### `(above? x t)` · `(below? x t)` · `(crossed? prev now t)`

**Purpose:** threshold predicates over a single value or two consecutive samples.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:232-234`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(above? balance 100)` → `#t` if `balance > 100`. *;; generated*
2. _(intermediate)_ alert when revenue crossed a target: `(when (crossed? yesterday-rev today-rev target) (card-emit 'engine 'crossed target))`. *;; generated*
3. _(expert)_ closed-cond classifier:
   ```scheme
   (cond
     ((above? delta hi-watermark)  (escalate 'spike delta))
     ((below? delta lo-watermark)  (escalate 'dip delta))
     (else                         (next 'observe ctx)))
   ```
   *;; generated*

**Notes:** `crossed?` is direction-agnostic — it's true for either upward or downward crossing. For direction-aware crossings, pair with `(- now prev)` and check `sign`.

---

### 15.5 String + number conversion atoms

#### `(string-append str1 str2 ...)`

**Purpose:** concatenate any number of values (coerced to string) into one.
**Returns:** string.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:254 · def('string-append', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string-append "Hello, " "world")` → `"Hello, world"`. *;; generated*
2. _(intermediate)_ build a hex color: `(string-append "#" (byte->hex r) (byte->hex g) (byte->hex b))`. *;; generated*
3. _(expert)_ render a row label: `(string-append (assoc 'shop row) " · " (number->string (assoc 'rev row)))`. *;; generated*

**Notes:** non-string args are coerced via JS `String(x)` — numbers and booleans become their print form, lists become `1,2,3`-style JS array-toString, which is usually NOT what you want. For structured pretty-printing, use `inspect` (§15.5, below).

---

#### `(string-eq? a b)` and `(string=? a b)`

**Purpose:** string equality (after coercion to string). Aliases.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:257-258`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string=? "magic" "magic")` → `#t`. *;; generated*
2. _(intermediate)_ dispatch on string tag:
   ```scheme
   (cond
     ((string=? kind "row")    (render-row x))
     ((string=? kind "header") (render-header x))
     (else                     (render-default x)))
   ```
   *;; generated*
3. _(expert)_ filter rows by exact-name match: `(filter (lambda (r) (string=? (assoc 'shop r) target-shop)) rows)`. *;; generated*

**Notes:** `=?` (§15.2) also handles strings — `(=? "a" "a")` is `#t`. The dedicated `string=?` is here for code coming from other Schemes; either works.

---

#### `(string-length s)` · `(string-ref s i)` · `(substring s a [b])`

**Purpose:** string index and slice.
**Returns:** integer length, single-character string (`string-ref`), substring slice (`substring`).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:255-260`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string-length "magic")` → `5`; `(string-ref "hi" 1)` → `"i"`. *;; generated*
2. _(intermediate)_ first three chars: `(substring "shopkeeper" 0 3)` → `"sho"`. *;; generated*
3. _(expert)_ split a 6-digit hex into two-byte components:
   ```scheme
   (list (substring color 1 3) (substring color 3 5) (substring color 5 7))
   ```
   *;; generated — the conway additive-blend pattern*

**Notes:** `substring` is `[a, b)` (half-open, matches JS `String.substring`). The single-arg form `(substring s a)` slices to end; `b = undefined` is treated specially in the def.

---

#### `(number->string n [radix])` · `(string->number s [radix])`

**Purpose:** scalar conversion between numbers and strings, with optional radix (default 10).
**Returns:** string for `number->string`; number for `string->number`, or `#f` on parse failure.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:261-278`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(number->string 42)` → `"42"`. *;; generated*
2. _(intermediate)_ hex conversion: `(number->string 255 16)` → `"ff"`; `(string->number "ff" 16)` → `255`. *;; generated*
3. _(expert)_ safe parse with fallback:
   ```scheme
   (let ((n (string->number user-input)))
     (if n (next 'use-n (ctx-set 'n n ctx)) (escalate 'bad-number user-input)))
   ```
   *;; generated*

**Notes:** **`string->number` returns `#f` on parse failure** — gate the result before using it. Hex parsing accepts both bare `"ff"` and the `"0xff"` prefix (`base.js:276 · str.startsWith('0x') || str.startsWith('0X')`). Radix 10 uses `parseFloat` so decimals work; non-10 radix uses integer-only `parseInt`.

---

#### `(hex-byte s i)` · `(byte->hex n)`

**Purpose:** hex-color helpers. `hex-byte` reads two hex chars at offset `i` as a 0–255 byte; `byte->hex` converts back, lowercase, zero-padded.
**Returns:** integer (`hex-byte`); two-char string (`byte->hex`).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:282-289`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(hex-byte "#ff8040" 1)` → `255`. *;; generated*
2. _(intermediate)_ byte→hex round-trip: `(byte->hex 64)` → `"40"`. *;; generated*
3. _(expert)_ additive blend two hex colors:
   ```scheme
   (define (blend a b)
     (string-append "#"
       (byte->hex (min 255 (+ (hex-byte a 1) (hex-byte b 1))))
       (byte->hex (min 255 (+ (hex-byte a 3) (hex-byte b 3))))
       (byte->hex (min 255 (+ (hex-byte a 5) (hex-byte b 5))))))
   ```
   *Source: pattern from `curator-web/src/scheme/carts/radio/conway.sks` (additive blend code that motivated these helpers — see `base.js:279-281` block comment)*

**Notes:** `hex-byte` does NOT validate the `#` prefix — pass offsets `1, 3, 5` for a `#rrggbb` string. Out-of-range input returns `0` (`base.js:284 · NaN-guard`).

---

#### `(vector-ref v i)`

**Purpose:** index access on what this base calls a "vector" — which, in this interpreter, is just a list (there's no separate vector type).
**Returns:** the element, or `null` on non-list input.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:259 · def('vector-ref', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(vector-ref '(a b c) 1)` → `b`. *;; generated*
2. _(intermediate)_ use as a generic O(1) index access: `(vector-ref row 0)`. *;; generated*
3. _(expert)_ kept for compat — most code uses `nth` / `list-ref` / `cadr` instead. *;; generated*

**Notes:** retained for R7RS-shaped imports. `vector-ref` and `list-ref` (§15.3) and `nth` are functionally identical in this interpreter — pick one per cart for consistency.

---

#### `(inspect v)`

**Purpose:** pretty-print any value as a flat, readable string suitable for `(display)` or `(text ...)`. Truncates long strings, recursive descent up to depth 4 for lists.
**Returns:** string.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:139 · def('inspect', ...)`. Helper at `:111 · function _show()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(inspect '(a 1 "b"))` → `"(a 1 \"b\")"`. *;; generated*
2. _(intermediate)_ render a debug line: `(display (inspect ctx)) (newline)`. *;; generated*
3. _(expert)_ closure-aware shape — closures render as `<fn>`:
   ```scheme
   (inspect (list 'tier 'magic 'cb (lambda (x) x)))
   ;; → "(tier magic cb <fn>)"
   ```
   *;; generated*

**Notes:** intended for in-cart debug surfaces and PICO-8-style REPL exploration. Lists past depth 4 print as `(…)`; strings over 80 chars truncate with `…`. Not pretty-printed (no newlines); use `display` + `newline` for line-by-line.

---

### 15.6 Higher-order atoms

These are the verbs that take a function as an argument and re-enter
the evaluator through `apply()`. They share the same fuel budget as
direct application — there is no way to escape the fuel cap through
higher-order composition.

#### `(apply fn args)`

**Purpose:** invoke `fn` with the list `args` as the argument list.
**Returns:** whatever `fn` returns.
**Side effects:** whatever `fn` has; shares the same fuel.
**Defined in:** `curator-web/src/scheme/base.js:71 · def('apply', ...)`. Internal `apply` (the JS export) at `interp.js:458 · function apply()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(apply + '(1 2 3))` → `6`. *;; generated*
2. _(intermediate)_ forward an arg list to a verb: `(apply paint-arrow paint-args)`. *;; generated*
3. _(expert)_ build the arg list then dispatch:
   ```scheme
   (let ((args (cons 'price-ladder-card (compute-anchors anchors))))
     (apply paint-arrow args))
   ```
   *;; generated*

**Notes:** non-list `args` is wrapped in a single-element list (`base.js:71`). The Scheme-level `apply` is a thin wrapper over the interp's internal `apply`; both share the trampoline.

---

#### `(any pred lst)` · `(every pred lst)` · `(count pred lst)`

**Purpose:** SRFI-1 short-circuit reductions. `any` is true on the first hit; `every` is false on the first miss; `count` is the total number of hits.
**Returns:** boolean (`any`, `every`), integer (`count`).
**Side effects:** invokes `pred` once per element until termination; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:145-160`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(any odd? '(2 4 5 6))` → `#t`. *;; generated*
2. _(intermediate)_ tier gate: `(every (lambda (r) (= (assoc 'tier r) 'magic)) rows)`. *;; generated*
3. _(expert)_ score by predicate count:
   ```scheme
   (let ((ok-count (count (lambda (s) (eq? (cadr s) 'connected)) shops)))
     (when (>= ok-count 3) (next 'render ctx)))
   ```
   *;; generated*

**Notes:** non-list input — `any` → `#f`, `every` → `#t` (vacuous truth), `count` → `0`. Same defaults you'd want for empty input.

---

#### `(filter pred lst)`

**Purpose:** retain elements where `pred` returns non-`#f`.
**Returns:** a fresh list.
**Side effects:** invokes `pred` exactly once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:67 · def('filter', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(filter positive? '(-1 2 -3 4))` → `(2 4)`. *;; generated*
2. _(intermediate)_ pick connected shops: `(filter (lambda (s) (eq? (cadr s) 'connected)) shops)`. *;; generated*
3. _(expert)_ closure-with-state dedup (also shown under `lambda`):
   ```scheme
   (let ((seen '()))
     (filter (lambda (id)
               (if (member id seen)
                   #f
                   (begin (set! seen (cons id seen)) #t)))
             listings))
   ```
   *;; generated*

**Notes:** Curator-Scheme convention: only `#f` is filtered out — `()`, `0`, `""` are all RETAINED. R7RS-correct.

---

#### `(for-each fn lst)`

**Purpose:** call `fn` on each element for its side effects.
**Returns:** `undefined`.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:65 · def('for-each', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(for-each display '("a" "b" "c"))`. *;; generated*
2. _(intermediate)_ stagger paint calls along an index:
   ```scheme
   (for-each (lambda (i) (paint-point-at (* 30 i) 100)) (range 0 8))
   ```
   *;; generated*
3. _(expert)_ multi-line debug dump:
   ```scheme
   (for-each (lambda (row)
               (display (inspect row)) (newline))
             rows)
   ```
   *;; generated*

**Notes:** the explicit "I want only the effects, throw away the values" verb — use it instead of `map` when you don't need the result list (saves an allocation).

---

#### `(map fn lst)`

**Purpose:** apply `fn` to each element; collect the results.
**Returns:** a fresh list of the same length.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:66 · def('map', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(map (lambda (x) (* x x)) '(1 2 3))` → `(1 4 9)`. *;; generated*
2. _(intermediate)_ extract a field column: `(map (lambda (r) (assoc 'amount r)) rows)`. *;; generated*
3. _(expert)_ map composed with `sum`:
   ```scheme
   (sum (map (lambda (r) (assoc 'amount r)) receipts))
   ```
   *;; generated — the canonical "total revenue" derivation*

**Notes:** single-list `map` only — no n-ary `(map fn lst1 lst2)`. For two-list parallel iteration, `zip` (§15.3) first, then `map` over the pairs.

---

#### `(reduce fn init lst)`

**Purpose:** left-fold; combine elements into a single accumulator value, starting from `init`.
**Returns:** the final accumulator value.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:68 · def('reduce', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(reduce + 0 '(1 2 3))` → `6`. *;; generated*
2. _(intermediate)_ build a string: `(reduce string-append "" '("a" "b" "c"))` → `"abc"`. *;; generated*
3. _(expert)_ structural accumulation — sum receipts with running max:
   ```scheme
   (reduce (lambda (acc r)
             (let ((amt (assoc 'amount r)))
               (list (+ (car acc) amt)
                     (max (cadr acc) amt))))
           '(0 0)
           receipts)
   ;; → (total max-single-receipt)
   ```
   *;; generated*

**Notes:** left-fold only (no `reduce-right`). The accumulator is the FIRST arg of `fn`, the element is the second. For "sum a list of numbers," `(sum lst)` (§15.4) is shorter and clearer.

---

### 15.7 Randomness atoms — the seeded/un-seeded split

This base intentionally exposes the JS engine's non-deterministic
`Math.random()` under the name `rng-uniform` **only**. The friendly name
`random` is left to be installed by the cards runtime
(`runWithCards`) with a **seeded** RNG, so any cart that uses `(random)`
is byte-identically replayable. The implication for the few code paths
that hit `run()` / `runSurface()` directly: those don't install a seeded
`random`, so they reach the raw uniform under the `rng-uniform` name.

If you're authoring a primitive that needs randomness, prefer one of
the named variants below — they're available in both contexts.

#### `(rng-uniform)`

**Purpose:** raw, non-deterministic uniform float in `[0, 1)`. The escape hatch under `run()` / `runSurface()`; cart authors should rarely call this directly.
**Returns:** float `[0, 1)`.
**Side effects:** consumes one tick of the underlying RNG (the JS engine's `Math.random`).
**Defined in:** `curator-web/src/scheme/base.js:200 · def('rng-uniform', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(rng-uniform)` → some float. *;; generated*
2. _(intermediate)_ scaled into a range manually: `(* (rng-uniform) 100)` → `[0, 100)`. *;; generated*
3. _(expert)_ inside a primitive that doesn't want seeding (e.g. a one-shot bench): `(let ((noise (rng-uniform))) ...)`. *;; generated*

**Notes:** **DO NOT use `rng-uniform` in cards-runtime carts.** The cart runtime overrides `random` with a seeded RNG so replays are byte-identical; `rng-uniform` bypasses that — you'll get a different cart trace every time. See the block comment at `base.js:194-199` for the determinism rationale.

---

#### `(randint a b)` · `(random-int n)` · `(random-range lo hi)` · `(random-pick lst)`

**Purpose:** the named-variant random verbs.
**Returns:** integer (`randint`, `random-int`); float (`random-range`); element (`random-pick`); `null` on empty list for `random-pick`.
**Side effects:** consumes one tick of the underlying RNG per call.
**Defined in:** `curator-web/src/scheme/base.js:201-207`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(randint 0 10)` → integer in `[0, 10)`. *;; generated*
2. _(intermediate)_ pick a random sprite: `(random-pick '(coral mint blossom lilac))`. *;; generated*
3. _(expert)_ randomized layout perturbation:
   ```scheme
   (for-each (lambda (card)
               (move-card card
                          (random-range 0 (- canvas-w 200))
                          (random-range 0 (- canvas-h 200))))
             cards)
   ```
   *;; generated*

**Notes:** these reach the SAME underlying source as `rng-uniform` when called via `run()`; under `runWithCards`, the named `random` is replaced with a seeded variant and so are these. `random-pick` on `()` returns `null` rather than throwing — safe-default convention.

---

### 15.8 Geometry + threshold atoms — the game kit

The verbs `dist`, `near?`, `in-rect?`, and `overlap?` collectively let
cart code do collision detection without pulling in a physics library.
They're the substrate the higher-level paint and sprite verbs sit on.

#### `(dist x1 y1 x2 y2)`

**Purpose:** Euclidean distance between two 2D points.
**Returns:** non-negative float.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:237 · def('dist', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(dist 0 0 3 4)` → `5`. *;; generated*
2. _(intermediate)_ click-on-target gate: `(when (< (dist click-x click-y card-x card-y) 30) ...)`. *;; generated*
3. _(expert)_ k-nearest-card pick:
   ```scheme
   (let ((ranked (sort cards
                       (lambda (a b)
                         (< (dist mx my (nth a 1) (nth a 2))
                            (dist mx my (nth b 1) (nth b 2)))))))
     (take ranked 3))
   ```
   *;; generated*

**Notes:** `Math.hypot` under the hood — numerically stable for very large or very small inputs.

---

#### `(near? x1 y1 x2 y2 r)`

**Purpose:** test whether two points are within `r` of each other.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:238 · def('near?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(near? 0 0 1 1 2)` → `#t`. *;; generated*
2. _(intermediate)_ proximity-based emit: `(when (near? sprite-x sprite-y target-x target-y 16) (card-emit 'engine 'reached null))`. *;; generated*
3. _(expert)_ collect all sprites within range:
   ```scheme
   (filter (lambda (s) (near? cx cy (nth s 1) (nth s 2) blast-radius))
           sprites)
   ```
   *;; generated*

**Notes:** uses the same `Math.hypot` as `dist` — same numeric stability. `r` is inclusive (`<=`).

---

#### `(in-rect? px py x y w h)`

**Purpose:** point-in-axis-aligned-rectangle test. Inclusive on top-left, exclusive on bottom-right (matches the usual pixel-buffer convention).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:239 · def('in-rect?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(in-rect? 5 5 0 0 10 10)` → `#t`. *;; generated*
2. _(intermediate)_ hit-test a card: `(in-rect? click-x click-y card-x card-y card-w card-h)`. *;; generated*
3. _(expert)_ enumerate which card was clicked:
   ```scheme
   (list-index (lambda (c)
                 (in-rect? mx my (nth c 1) (nth c 2) (nth c 3) (nth c 4)))
               cards)
   ```
   *;; generated*

**Notes:** the `[x, x+w)` half-open form is what the bricklay packer (`base.js:512 · rectOverlapsAny`) uses for its overlap test, so `in-rect?` + `overlap?` are consistent: two cards that share an edge don't overlap.

---

#### `(overlap? x1 y1 w1 h1 x2 y2 w2 h2)`

**Purpose:** axis-aligned rectangle overlap test. Strict — cards touching at edges do NOT overlap (the bricklay GAP convention).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:240 · def('overlap?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(overlap? 0 0 10 10 5 5 10 10)` → `#t`. *;; generated*
2. _(intermediate)_ guard a card placement: `(when (overlap? nx ny nw nh existing-x existing-y existing-w existing-h) (try-next-anchor))`. *;; generated*
3. _(expert)_ check a new rect against every placed rect — the per-step shape inside the bricklay packer:
   ```scheme
   (any (lambda (p)
          (overlap? nx ny nw nh (nth p 0) (nth p 1) (nth p 2) (nth p 3)))
        placed)
   ```
   *;; generated — matches `base.js:512 · rectOverlapsAny()` semantics*

**Notes:** strict-on-touch means rects sharing an edge (`a.x + a.w === b.x`) test as **not** overlapping — important when GAP > 0 lives between them. The native `bricklay-pack-native` (`base.js:396`) inlines this same condition for hot-path performance; Scheme-side cart code should use `overlap?` for clarity.

---

### 15.9 Display atoms

The two output verbs documented here are NOT in `base.js` directly — they
are installed by a small printer module the host wires before
`makeBaseEnv`. They are included in this chapter for completeness because
operators reach for them as if they were base primitives. Backing
citation points at the installer.

#### `(display x)` and `(newline)`

**Purpose:** debug + REPL print verbs. `display` writes a value to stdout (or the cart's debug pane in the cards runtime); `newline` writes a line terminator.
**Returns:** `undefined`.
**Side effects:** writes to the host's display sink — in tests, captured per-cart; in dev, the browser console; in the cards runtime, the cart's debug pane.
**Defined in:** installed by the cart host's display layer (see `curator-web/src/scheme/index.js` for the host wiring; the printer impl is selected per runtime — tests inject a capture sink, browser runtimes inject a `console.log`-shaped sink).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(display "hello") (newline)` — *;; generated*
2. _(intermediate)_ dump derived values during cart authoring:
   ```scheme
   (display "tier: ") (display (ctx-get 'tier ctx)) (newline)
   (display "fuel: ") (display fuel-left) (newline)
   ```
   *;; generated*
3. _(expert)_ structured per-row debug:
   ```scheme
   (for-each (lambda (row)
               (display "  row: ") (display (inspect row)) (newline))
             rows)
   ```
   *;; generated*

**Notes:** these are best for cart-authoring/debugging, not for operator-facing output — the operator-facing surface is `text` / `table` / `paint-*`. If your `display` calls survive into a shipped cart, lint will warn.

---

## Honest gaps — manifest entries that don't (yet) match a backing

Some verbs are catalogued in the verb-manifest (and surfaced via
`<verb-card>`) but have no end-to-end backing route. They appear here
as the canonical honest-null list so cart authors don't try to wire
against ghost routes.

### `loam/query` — Deep Magic gateway (cost-band registered, route deferred)

```verb-card loam/query
```

The verb appears in the cost table at `curator-web/src/scheme/verbCosts.js:48`
(the "not `loam/operator-state`" branch routes to the 1,500-token band
documented in [HelloSurface §136](/docs/hello-surface/136-loam.html)).
**It is not present in `curator-web/src/scheme/runtime/verbBackings.js`**
— the server-side `LoamRouter.answer(query, ...)` path at
`curator-api/curator_api/loam/router.py:74-116` is implemented end-to-end,
but the JS-side binding to a backing route plus the cart-side `(act 'loam/query ...)`
calls are deferred. Cart authors get a structured `'service-not-yet-wired`
escalation, never a fluent-wrong success.

---

## Approval

- **Soo-Jin** (author, Scheme composition lead): _signed 2026-06-15_
- **Architect** (approver): [vetoes any verb whose Backing claim is wrong]

Approval procedure: the Architect spot-checks 20 random entries; if
any of the 20 has a wrong file:line citation or a Source example that
no longer matches the cart, the Architect NACKs. Soo-Jin re-cites,
re-runs the lint pass, and re-submits.
