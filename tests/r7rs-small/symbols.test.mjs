// tests/r7rs-small/symbols.test.mjs — R7RS-small §6.5 (symbols).

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

test('§6.5 — symbol? on a symbol is #t', () => {
  const { run } = makeRunner()
  assert.equal(run("(symbol? 'foo)"), true)
})

test('§6.5 — symbol? on non-symbol is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(symbol? "foo")'), false)
  assert.equal(run('(symbol? 42)'), false)
})

test('§6.5 — symbol=? on equal symbols is #t', () => {
  const { run } = makeRunner()
  assert.equal(run("(symbol=? 'foo 'foo)"), true)
})

test('§6.5 — symbol=? on different symbols is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(symbol=? 'foo 'bar)"), false)
})

test('§6.5 — symbol->string', () => {
  const { run } = makeRunner()
  assert.equal(run("(symbol->string 'hello)"), 'hello')
})

test('§6.5 — string->symbol', () => {
  const { run } = makeRunner()
  const sym = run('(string->symbol "world")')
  assert.equal(sym.name, 'world')
})

test('§6.5 — symbol->string / string->symbol round-trip', () => {
  const { run } = makeRunner()
  assert.equal(run("(symbol=? 'abc (string->symbol (symbol->string 'abc)))"), true)
})

test('§6.5 — symbols with the same name are eq?', () => {
  const { run } = makeRunner()
  assert.equal(run("(eq? 'foo 'foo)"), true)
})
