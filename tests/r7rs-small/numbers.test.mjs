// tests/r7rs-small/numbers.test.mjs — R7RS-small §6.2 (numbers).
//
// Covers the numeric predicates, arithmetic, comparisons, exact/inexact
// bridge, exp/log/trig, exact-integer-sqrt, expt, string↔number.
//
// Per decision-011 (no numeric tower) and decision-021 (no complex
// numbers), some deviations are documented: `numerator` returns x,
// `denominator` returns 1, make-rectangular / make-polar throw. Tests
// assert the documented behavior.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.2.6 Numerical predicates ─────────────────────────────────────────

test('§6.2.6 — number? on numbers is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(number? 42)'), true)
  assert.equal(run('(number? 3.14)'), true)
  assert.equal(run('(number? "hi")'), false)
})

test('§6.2.6 — integer? / rational? / real?', () => {
  const { run } = makeRunner()
  assert.equal(run('(integer? 5)'), true)
  assert.equal(run('(rational? 5)'), true)
  assert.equal(run('(real? 5)'), true)
})

test('§6.2.6 — complex? — #t on finite reals (per decision-021)', () => {
  const { run } = makeRunner()
  assert.equal(run('(complex? 5)'), true)
  assert.equal(run('(complex? 3.14)'), true)
})

test('§6.2.6 — exact? and inexact? predicates', () => {
  const { run } = makeRunner()
  assert.equal(run('(exact? 3)'), true)
})

test('§6.2.6 — exact-integer? / exact-rational?', () => {
  const { run } = makeRunner()
  assert.equal(run('(exact-integer? 5)'), true)
  assert.equal(run('(exact-rational? 5)'), true)
})

test('§6.2.6 — zero? / positive? / negative? / odd? / even?', () => {
  const { run } = makeRunner()
  assert.equal(run('(zero? 0)'), true)
  assert.equal(run('(zero? 1)'), false)
  assert.equal(run('(positive? 5)'), true)
  assert.equal(run('(negative? -3)'), true)
  assert.equal(run('(odd? 3)'), true)
  assert.equal(run('(even? 4)'), true)
})

// ── §6.2.6 Arithmetic ───────────────────────────────────────────────────

test('§6.2.6 — + associates left with identity 0', () => {
  const { run } = makeRunner()
  assert.equal(run('(+)'), 0)
  assert.equal(run('(+ 1 2 3 4)'), 10)
})

test('§6.2.6 — * associates left with identity 1', () => {
  const { run } = makeRunner()
  assert.equal(run('(*)'), 1)
  assert.equal(run('(* 2 3 4)'), 24)
})

test('§6.2.6 — unary - negates', () => {
  const { run } = makeRunner()
  assert.equal(run('(- 5)'), -5)
})

test('§6.2.6 — n-ary - subtracts left-to-right', () => {
  const { run } = makeRunner()
  assert.equal(run('(- 10 1 2 3)'), 4)
})

test('§6.2.6 — unary / reciprocates', () => {
  const { run } = makeRunner()
  assert.equal(run('(/ 4)'), 0.25)
})

test('§6.2.6 — abs, min, max', () => {
  const { run } = makeRunner()
  assert.equal(run('(abs -7)'), 7)
  assert.equal(run('(min 3 1 2)'), 1)
  assert.equal(run('(max 3 1 2)'), 3)
})

test('§6.2.6 — quotient / remainder / modulo', () => {
  const { run } = makeRunner()
  assert.equal(run('(quotient 13 4)'), 3)
  assert.equal(run('(remainder 13 4)'), 1)
  assert.equal(run('(modulo 13 4)'), 1)
})

test('§6.2.6 — quotient / remainder handle negatives', () => {
  const { run } = makeRunner()
  assert.equal(run('(quotient -13 4)'), -3)
  assert.equal(run('(remainder -13 4)'), -1)
  assert.equal(run('(modulo -13 4)'), 3)
})

test('§6.2.6 — gcd / lcm', () => {
  const { run } = makeRunner()
  assert.equal(run('(gcd 12 18)'), 6)
  assert.equal(run('(lcm 4 6)'), 12)
})

test('§6.2.6 — floor / ceiling / truncate / round', () => {
  const { run } = makeRunner()
  assert.equal(run('(floor 3.7)'), 3)
  assert.equal(run('(ceiling 3.2)'), 4)
  assert.equal(run('(truncate 3.7)'), 3)
  assert.equal(run('(truncate -3.7)'), -3)
})

// ── §6.2.6 floor/ and truncate/ families ────────────────────────────────

test('§6.2.6 — floor-quotient / floor-remainder', () => {
  const { run } = makeRunner()
  assert.equal(run('(floor-quotient 17 5)'), 3)
  assert.equal(run('(floor-remainder 17 5)'), 2)
})

test('§6.2.6 — truncate-quotient / truncate-remainder', () => {
  const { run } = makeRunner()
  assert.equal(run('(truncate-quotient 17 5)'), 3)
  assert.equal(run('(truncate-remainder 17 5)'), 2)
})

test('§6.2.6 — floor/ returns quotient + remainder via values', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(let-values (((q r) (floor/ 17 5))) (list q r))'), [3, 2])
})

test('§6.2.6 — truncate/ returns quotient + remainder via values', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(let-values (((q r) (truncate/ 17 5))) (list q r))'), [3, 2])
})

// ── §6.2.6 Comparisons ──────────────────────────────────────────────────

test('§6.2.6 — = / < / > / <= / >=', () => {
  const { run } = makeRunner()
  assert.equal(run('(= 3 3)'), true)
  assert.equal(run('(< 1 2)'), true)
  assert.equal(run('(> 2 1)'), true)
  assert.equal(run('(<= 3 3)'), true)
  assert.equal(run('(>= 3 3)'), true)
})

// ── §6.2.6 Transcendentals ──────────────────────────────────────────────

test('§6.2.6 — exp / log', () => {
  const { run } = makeRunner()
  assert.ok(Math.abs(run('(exp 0)') - 1) < 1e-10)
  assert.ok(Math.abs(run('(log 1)') - 0) < 1e-10)
})

test('§6.2.6 — sin / cos / tan', () => {
  const { run } = makeRunner()
  assert.ok(Math.abs(run('(sin 0)') - 0) < 1e-10)
  assert.ok(Math.abs(run('(cos 0)') - 1) < 1e-10)
  assert.ok(Math.abs(run('(tan 0)') - 0) < 1e-10)
})

test('§6.2.6 — asin / acos / atan', () => {
  const { run } = makeRunner()
  assert.ok(Math.abs(run('(asin 0)') - 0) < 1e-10)
  assert.ok(Math.abs(run('(acos 1)') - 0) < 1e-10)
  assert.ok(Math.abs(run('(atan 0)') - 0) < 1e-10)
})

test('§6.2.6 — square', () => {
  const { run } = makeRunner()
  assert.equal(run('(square 5)'), 25)
})

test('§6.2.6 — sqrt', () => {
  const { run } = makeRunner()
  assert.equal(run('(sqrt 16)'), 4)
  assert.equal(run('(sqrt 25)'), 5)
})

test('§6.2.6 — exact-integer-sqrt returns (root, remainder) as values', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(let-values (((s r) (exact-integer-sqrt 17))) (list s r))'), [4, 1])
  assert.deepEqual(run('(let-values (((s r) (exact-integer-sqrt 16))) (list s r))'), [4, 0])
})

test('§6.2.6 — exact-integer-sqrt raises on negative', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(exact-integer-sqrt -1)'))
})

test('§6.2.6 — expt', () => {
  const { run } = makeRunner()
  assert.equal(run('(expt 2 10)'), 1024)
  assert.equal(run('(expt 3 3)'), 27)
})

// ── §6.2.6 numerator / denominator / rationalize (per decision-011) ─────

test('§6.2.6 — numerator returns n (per decision-011, no rationals)', () => {
  const { run } = makeRunner()
  assert.equal(run('(numerator 5)'), 5)
})

test('§6.2.6 — denominator returns 1 (per decision-011)', () => {
  const { run } = makeRunner()
  assert.equal(run('(denominator 5)'), 1)
})

test('§6.2.6 — rationalize returns x (per decision-011)', () => {
  const { run } = makeRunner()
  assert.equal(run('(rationalize 5 0.1)'), 5)
})

// ── §6.2.6 exact / inexact bridge ───────────────────────────────────────

test('§6.2.6 — exact truncates', () => {
  const { run } = makeRunner()
  assert.equal(run('(exact 3.5)'), 3)
})

test('§6.2.6 — inexact identity on integers (per decision-011)', () => {
  const { run } = makeRunner()
  // In R7RS `inexact 3` would produce 3.0; JS Number has no distinct
  // representation, so we return 3. Documented at decision-011.
  assert.equal(run('(inexact 3)'), 3)
})

// ── §6.2.7 Numerical input / output ─────────────────────────────────────

test('§6.2.7 — number->string default base 10', () => {
  const { run } = makeRunner()
  assert.equal(run('(number->string 42)'), '42')
})

test('§6.2.7 — number->string with radix', () => {
  const { run } = makeRunner()
  assert.equal(run('(number->string 255 16)'), 'ff')
  assert.equal(run('(number->string 8 2)'), '1000')
})

test('§6.2.7 — string->number default base 10', () => {
  const { run } = makeRunner()
  assert.equal(run('(string->number "42")'), 42)
})

test('§6.2.7 — string->number with radix', () => {
  const { run } = makeRunner()
  assert.equal(run('(string->number "ff" 16)'), 255)
  assert.equal(run('(string->number "1010" 2)'), 10)
})

test('§6.2.7 — string->number returns #f on non-numeric', () => {
  const { run } = makeRunner()
  assert.equal(run('(string->number "hello")'), false)
})

// ── §6.2.6 Complex-number surface — DEFERRED per decision-021 ───────────

test('§6.2.6 — make-rectangular signals complex-numbers-unsupported (decision-021)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(make-rectangular 3 4)'), /complex/i)
})

test('§6.2.6 — make-polar signals complex-numbers-unsupported (decision-021)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(make-polar 5 0)'), /complex/i)
})

test('§6.2.6 — real-part on real x is x (decision-021)', () => {
  const { run } = makeRunner()
  assert.equal(run('(real-part 5)'), 5)
})

test('§6.2.6 — imag-part on real is 0 (decision-021)', () => {
  const { run } = makeRunner()
  assert.equal(run('(imag-part 5)'), 0)
})

test('§6.2.6 — magnitude on real is abs (decision-021)', () => {
  const { run } = makeRunner()
  assert.equal(run('(magnitude -7)'), 7)
})

test('§6.2.6 — angle on negative is π, on positive is 0 (decision-021)', () => {
  const { run } = makeRunner()
  assert.equal(run('(angle 5)'), 0)
  assert.ok(Math.abs(run('(angle -1)') - Math.PI) < 1e-10)
})
