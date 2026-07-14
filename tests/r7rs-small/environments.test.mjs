// tests/r7rs-small/environments.test.mjs — R7RS-small §6.12 (envs + eval).
//
// Per decision-025, runtime eval and the environment constructors are NOT
// exposed to author programs. The dispatcher gate needs to see every
// verb call statically; runtime eval breaks that invariant.
//
// This file asserts the documented deferral: `eval`, `environment`,
// `scheme-report-environment`, `null-environment`, `interaction-environment`
// are not registered.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

test('§6.12 — eval not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(eval '(+ 1 2))"), /unbound symbol: eval/)
})

test('§6.12 — environment not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(environment '(scheme base))"), /unbound symbol: environment/)
})

test('§6.12 — scheme-report-environment not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(scheme-report-environment 7)'),
    /unbound symbol: scheme-report-environment/)
})

test('§6.12 — null-environment not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(null-environment 7)'), /unbound symbol: null-environment/)
})

test('§6.12 — interaction-environment not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(interaction-environment)'),
    /unbound symbol: interaction-environment/)
})
