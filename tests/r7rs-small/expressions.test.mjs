// tests/r7rs-small/expressions.test.mjs — R7RS-small §4 (expressions).
//
// Covers §4.1 (quote, lambda, if, set!), §4.2 (cond, case, and, or,
// when, unless, let, let*, letrec, letrec*, let-values, let*-values,
// begin, do, delay, delay-force, force, make-promise, parameterize,
// guard, quasiquote / unquote / unquote-splicing, case-lambda).

// Note: non-strict `node:assert` — deepEqual treats Sym / Ch instances as
// structurally equal to plain-object literals with the same shape.
import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner, Sym } from './_helpers.mjs'

// ── §4.1.1 Variable references ──────────────────────────────────────────

test('§4.1.1 — variable reference resolves', () => {
  const { run } = makeRunner()
  assert.equal(run('(define x 42) x'), 42)
})

// ── §4.1.2 Literal expressions (quote) ──────────────────────────────────

test('§4.1.2 — quote returns datum unchanged', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(quote (1 2 3))'), [1, 2, 3])
  assert.equal(run("(quote a)").name, 'a')
})

test("§4.1.2 — quote reader shorthand ' expands to (quote …)", () => {
  const { run } = makeRunner()
  assert.deepEqual(run("'(1 2 3)"), [1, 2, 3])
})

// ── §4.1.3 Procedure calls ──────────────────────────────────────────────

test('§4.1.3 — procedure call evaluates operator + operands', () => {
  const { run } = makeRunner()
  assert.equal(run('(+ 1 2 3)'), 6)
})

// ── §4.1.4 Procedures (lambda) ──────────────────────────────────────────

test('§4.1.4 — lambda fixed-arity', () => {
  const { run } = makeRunner()
  assert.equal(run('((lambda (x y) (+ x y)) 3 4)'), 7)
})

test('§4.1.4 — lambda variadic (single Sym as param)', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('((lambda args args) 1 2 3)'), [1, 2, 3])
})

test('§4.1.4 — lambda dotted-tail', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('((lambda (a b . rest) rest) 1 2 3 4 5)'), [3, 4, 5])
})

// ── §4.1.5 Conditionals (if) ────────────────────────────────────────────

test('§4.1.5 — if consequent when test is truthy', () => {
  const { run } = makeRunner()
  assert.equal(run('(if #t 1 2)'), 1)
})

test('§4.1.5 — if alternate when test is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(if #f 1 2)'), 2)
})

test('§4.1.5 — only #f is falsy — 0, empty list, empty string are truthy', () => {
  const { run } = makeRunner()
  assert.equal(run('(if 0 (quote t) (quote f))').name, 't')
  assert.equal(run("(if (list) (quote t) (quote f))").name, 't')
  assert.equal(run('(if "" (quote t) (quote f))').name, 't')
})

// ── §4.1.6 Assignments (set!) ───────────────────────────────────────────

test('§4.1.6 — set! mutates existing binding', () => {
  const { run } = makeRunner()
  assert.equal(run('(define x 1) (set! x 42) x'), 42)
})

// ── §4.2.1 Conditionals — cond, case, and, or, when, unless ─────────────

test('§4.2.1 — cond with match', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond ((= 1 2) 1) ((= 2 2) 2) (else 3))'), 2)
})

test('§4.2.1 — cond with else clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond ((= 1 2) 1) (else 99))'), 99)
})

test('§4.2.1 — cond with => clause (arrow)', () => {
  const { run } = makeRunner()
  // (cond ((assv 3 '((1 a) (2 b) (3 c))) => cdr))
  assert.deepEqual(
    run("(cond ((assv 3 '((1 a) (2 b) (3 c))) => cdr))"),
    [{ name: 'c' }]
  )
})

test('§4.2.1 — case matches literal set', () => {
  const { run } = makeRunner()
  assert.equal(run("(case 2 ((1 2 3) 'small) ((4 5 6) 'mid) (else 'large))").name, 'small')
})

test('§4.2.1 — case else', () => {
  const { run } = makeRunner()
  assert.equal(run("(case 99 ((1) 'a) (else 'other))").name, 'other')
})

test('§4.2.1 — and returns last on all truthy', () => {
  const { run } = makeRunner()
  assert.equal(run('(and 1 2 3)'), 3)
})

test('§4.2.1 — and short-circuits at first #f', () => {
  const { run } = makeRunner()
  // If short-circuit worked, error inside never fires.
  assert.equal(run('(and #f (error "should not fire"))'), false)
})

test('§4.2.1 — (and) with no args is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(and)'), true)
})

test('§4.2.1 — or returns first truthy', () => {
  const { run } = makeRunner()
  assert.equal(run('(or #f #f 3 4)'), 3)
})

test('§4.2.1 — (or) with no args is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(or)'), false)
})

test('§4.2.1 — when runs body when truthy', () => {
  const { run } = makeRunner()
  assert.equal(run('(when #t 1 2 3)'), 3)
})

test('§4.2.1 — when returns nothing when falsy', () => {
  const { run } = makeRunner()
  const r = run('(when #f 1 2 3)')
  assert.ok(r === undefined || r === false)
})

test('§4.2.1 — unless runs body when falsy', () => {
  const { run } = makeRunner()
  assert.equal(run('(unless #f 1 2 3)'), 3)
})

// ── §4.2.2 Binding constructs — let, let*, letrec, letrec* ──────────────

test('§4.2.2 — let binds in parallel', () => {
  const { run } = makeRunner()
  assert.equal(run('(let ((a 1) (b 2)) (+ a b))'), 3)
})

test('§4.2.2 — named let is a loop', () => {
  const { run } = makeRunner()
  assert.equal(
    run('(let loop ((i 0) (a 0)) (if (= i 5) a (loop (+ i 1) (+ a i))))'),
    10
  )
})

test('§4.2.2 — let* binds sequentially (later sees earlier)', () => {
  const { run } = makeRunner()
  assert.equal(run('(let* ((a 1) (b (+ a 1))) b)'), 2)
})

test('§4.2.2 — letrec supports mutual recursion', () => {
  const { run } = makeRunner()
  const src = `(letrec ((even? (lambda (n) (if (= n 0) #t (odd? (- n 1)))))
                        (odd?  (lambda (n) (if (= n 0) #f (even? (- n 1))))))
                 (even? 10))`
  assert.equal(run(src), true)
})

test('§4.2.2 — letrec* also supports mutual recursion (semantics identical here)', () => {
  const { run } = makeRunner()
  const src = `(letrec* ((f (lambda (n) (if (= n 0) 1 (* n (f (- n 1)))))))
                  (f 5))`
  assert.equal(run(src), 120)
})

test('§4.2.2 — let-values splices multiple-value bindings', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('(let-values (((a b) (values 1 2)) ((c d) (values 3 4))) (list a b c d))'),
    [1, 2, 3, 4]
  )
})

test('§4.2.2 — let*-values sees prior bindings', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('(let*-values (((a b) (values 1 2)) ((c d) (values (+ a b) 4))) (list a b c d))'),
    [1, 2, 3, 4]
  )
})

// ── §4.2.3 Sequencing — begin ───────────────────────────────────────────

test('§4.2.3 — begin returns last expression', () => {
  const { run } = makeRunner()
  assert.equal(run('(begin 1 2 3)'), 3)
})

// ── §4.2.4 Iteration — do ───────────────────────────────────────────────

test('§4.2.4 — do accumulates via step', () => {
  const { run } = makeRunner()
  assert.equal(
    run('(do ((i 0 (+ i 1)) (r 0 (+ r i))) ((= i 5) r))'),
    10  // 0+1+2+3+4
  )
})

test('§4.2.4 — do without step keeps var constant', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('(do ((v (make-vector 3 0)) (i 0 (+ i 1))) ((= i 3) v) (vector-set! v i (* i i)))'),
    [0, 1, 4]
  )
})

// ── §4.2.5 Delayed evaluation — delay, force, delay-force, make-promise ─

test('§4.2.5 — (force (delay x)) is x', () => {
  const { run } = makeRunner()
  assert.equal(run('(force (delay 42))'), 42)
})

test('§4.2.5 — delay memoizes (side effect fires only once)', () => {
  const { run } = makeRunner()
  const src = `(define count 0)
               (define p (delay (begin (set! count (+ count 1)) count)))
               (force p) (force p) (force p)
               count`
  assert.equal(run(src), 1)
})

test('§4.2.5 — delay-force chains lazily and terminates', () => {
  const { run } = makeRunner()
  assert.equal(run('(force (delay-force (delay 99)))'), 99)
})

test('§4.2.5 — make-promise wraps a value that force unwraps', () => {
  const { run } = makeRunner()
  assert.equal(run('(force (make-promise 7))'), 7)
})

// ── §4.2.6 Dynamic bindings — parameterize + make-parameter ─────────────

test('§4.2.6 — parameterize temporarily rebinds', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run(`(define p (make-parameter 10))
         (list (p) (parameterize ((p 20)) (p)) (p))`),
    [10, 20, 10]
  )
})

// ── §4.2.7 Exception handling — guard ───────────────────────────────────

test('§4.2.7 — guard catches with #t clause', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run("(guard (e (#t (list 'caught e))) (raise 'oops))"),
    [{ name: 'caught' }, { name: 'oops' }]
  )
})

test('§4.2.7 — guard with predicate clause', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run("(guard (e ((symbol? e) (list 'sym e))) (raise 'x))"),
    [{ name: 'sym' }, { name: 'x' }]
  )
})

test('§4.2.7 — guard else clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(guard (e (else e)) (raise 42))'), 42)
})

test('§4.2.7 — guard re-raises when no clause matches', () => {
  const { run } = makeRunner()
  const src = `(guard (outer (else outer))
                 (guard (e ((= e 0) 'zero) ((= e 1) 'one))
                   (raise 99)))`
  assert.equal(run(src), 99)
})

// ── §4.2.8 Quasiquotation ───────────────────────────────────────────────

test('§4.2.8 — quasiquote with unquote', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('(let ((x 5)) `(a ,x b))'),
    [{ name: 'a' }, 5, { name: 'b' }]
  )
})

test('§4.2.8 — quasiquote with unquote-splicing', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('(let ((lst (list 1 2 3))) `(a ,@lst b))'),
    [{ name: 'a' }, 1, 2, 3, { name: 'b' }]
  )
})

test('§4.2.8 — literal quasiquote (no unquote) is a data list', () => {
  const { run } = makeRunner()
  assert.deepEqual(
    run('`(1 2 3)'),
    [1, 2, 3]
  )
})

// ── §4.2.9 Case-lambda ──────────────────────────────────────────────────

test('§4.2.9 — case-lambda dispatches on arity', () => {
  const { run } = makeRunner()
  const src = `(define f (case-lambda
                            (() 0)
                            ((a) 1)
                            ((a b) 2)
                            ((a b c) 3)))
               (list (f) (f 1) (f 1 2) (f 1 2 3))`
  assert.deepEqual(run(src), [0, 1, 2, 3])
})
