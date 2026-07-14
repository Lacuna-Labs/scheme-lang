// tests/r7rs-small/exceptions.test.mjs — R7RS-small §6.11 (exceptions).

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.11 error, error-object accessors ─────────────────────────────────

test('§6.11 — error raises an error-object', () => {
  const { run } = makeRunner()
  const src = `(guard (e (#t e))
                 (error "bad thing"))`
  const e = run(src)
  assert.equal(e._isErrorObject || e instanceof Error, true)
})

test('§6.11 — error-object? on an error is #t', () => {
  const { run } = makeRunner()
  const src = `(guard (e ((error-object? e) #t))
                 (error "boom"))`
  assert.equal(run(src), true)
})

test('§6.11 — error-object? on non-error is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(error-object? 'foo)"), false)
})

test('§6.11 — error-object-message', () => {
  const { run } = makeRunner()
  const src = `(guard (e ((error-object? e) (error-object-message e)))
                 (error "bad thing"))`
  assert.equal(run(src), 'bad thing')
})

test('§6.11 — error-object-irritants', () => {
  const { run } = makeRunner()
  const src = `(guard (e ((error-object? e) (error-object-irritants e)))
                 (error "bad" 1 2 3))`
  assert.deepEqual(run(src), [1, 2, 3])
})

// ── §6.11 raise ─────────────────────────────────────────────────────────

test('§6.11 — raise a value; guard catches it', () => {
  const { run } = makeRunner()
  assert.equal(run("(guard (e (#t e)) (raise 'oops))").name, 'oops')
})

test('§6.11 — raise a number; guard receives it', () => {
  const { run } = makeRunner()
  assert.equal(run('(guard (e (#t e)) (raise 42))'), 42)
})

// ── §6.11 raise-continuable ─────────────────────────────────────────────

test('§6.11 — raise-continuable — handler return becomes value', () => {
  const { run } = makeRunner()
  const src = `(with-exception-handler
                 (lambda (e) (* e 2))
                 (lambda () (raise-continuable 5)))`
  assert.equal(run(src), 10)
})

// ── §6.11 with-exception-handler ────────────────────────────────────────

test('§6.11 — with-exception-handler installs handler', () => {
  const { run } = makeRunner()
  const src = `(with-exception-handler
                 (lambda (e) (list 'caught e))
                 (lambda () (raise 99)))`
  assert.deepEqual(run(src), [{ name: 'caught' }, 99])
})

test('§6.11 — with-exception-handler passes through if no raise', () => {
  const { run } = makeRunner()
  const src = `(with-exception-handler
                 (lambda (e) 'caught)
                 (lambda () 42))`
  assert.equal(run(src), 42)
})

// ── §6.11 read-error? / file-error? ─────────────────────────────────────

test('§6.11 — file-error? is #f (no file ports per decision-022)', () => {
  const { run } = makeRunner()
  assert.equal(run("(file-error? 'anything)"), false)
})

test('§6.11 — read-error? on a non-read-error is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(read-error? (guard (e (#t e)) (error "x")))'), false)
})

// ── §6.11 guard interacts with call/cc for non-local exit ───────────────

test('§6.11 — guard clause matches by predicate', () => {
  const { run } = makeRunner()
  const src = `(guard (e ((and (error-object? e)
                                (equal? (error-object-message e) "specific"))
                          'match))
                 (error "specific"))`
  assert.equal(run(src).name, 'match')
})

test('§6.11 — guard re-raises unhandled exception to outer guard', () => {
  const { run } = makeRunner()
  const src = `(guard (outer (else outer))
                 (guard (inner ((= inner 0) 'zero))
                   (raise 5)))`
  assert.equal(run(src), 5)
})
