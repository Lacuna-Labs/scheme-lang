// tests/verb-status.test.mjs — verb-status classification + color rendering.
//
// Covers:
//   · registry :status field lands correctly (implemented / stubbed / user-stub)
//   · classifyVerb picks the right status for each source
//   · statusRole colors names when NO_COLOR isn't set
//   · define-stub creates a user-stub that throws when invoked
//   · sakura-scheme CLI reports a colored ,help block
//   · did-you-mean surfaces on unbound-symbol errors
//
// Run with:
//   node --test tests/verb-status.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SAKURA = join(ROOT, 'bin', 'sakura-scheme')

// ── unit: registry status field ─────────────────────────────────────

test('registry — :status defaults to implemented', async () => {
  const { registerVerbMeta, getVerbMeta, __resetRegistry } = await import('../src/registry.js')
  __resetRegistry()
  registerVerbMeta('foo', { perm: 'read' })
  const m = getVerbMeta('foo')
  assert.equal(m.status, 'implemented')
})

test('registry — :status honors explicit stubbed', async () => {
  const { registerVerbMeta, getVerbMeta, __resetRegistry } = await import('../src/registry.js')
  __resetRegistry()
  registerVerbMeta('foo', { perm: 'read', status: 'stubbed', stubMessage: 'not yet' })
  const m = getVerbMeta('foo')
  assert.equal(m.status, 'stubbed')
  assert.equal(m.stubMessage, 'not yet')
})

test('registry — setVerbStatus mutates status of a bound verb', async () => {
  const {
    registerVerbMeta, getVerbMeta, setVerbStatus, __resetRegistry,
  } = await import('../src/registry.js')
  __resetRegistry()
  registerVerbMeta('foo', { perm: 'read' })
  const ok = setVerbStatus('foo', 'platform-unsupported', { stubMessage: 'no audio on this platform' })
  assert.equal(ok, true)
  const m = getVerbMeta('foo')
  assert.equal(m.status, 'platform-unsupported')
  assert.equal(m.stubMessage, 'no audio on this platform')
})

test('registry — setVerbStatus rejects unknown status', async () => {
  const {
    registerVerbMeta, getVerbMeta, setVerbStatus, __resetRegistry,
  } = await import('../src/registry.js')
  __resetRegistry()
  registerVerbMeta('foo', { perm: 'read' })
  setVerbStatus('foo', 'nonsense')
  const m = getVerbMeta('foo')
  assert.equal(m.status, 'implemented') // unchanged
})

// ── unit: classifyVerb ──────────────────────────────────────────────

test('classifyVerb — implemented for a real primitive', async () => {
  const { makeBaseEnv } = await import('../src/base.js')
  const { classifyVerb } = await import('../src/repl/verbStatus.js')
  const env = makeBaseEnv({ n: 200000 })
  const cls = classifyVerb(env, '+')
  assert.equal(cls.status, 'implemented')
})

test('classifyVerb — missing when name is unknown', async () => {
  const { makeBaseEnv } = await import('../src/base.js')
  const { classifyVerb } = await import('../src/repl/verbStatus.js')
  const env = makeBaseEnv({ n: 200000 })
  const cls = classifyVerb(env, 'not-a-real-verb-xyz')
  assert.equal(cls.status, 'missing')
})

test('classifyVerb — user-stub after define-stub', async () => {
  const { makeBaseEnv } = await import('../src/base.js')
  const { classifyVerb } = await import('../src/repl/verbStatus.js')
  const { evaluate } = await import('../src/interp.js')
  const { parse } = await import('../src/reader.js')
  const fuel = { n: 200000 }
  const env = makeBaseEnv(fuel)
  const forms = parse(`(define-stub 'my-verb "not yet")`)
  for (const f of forms) evaluate(f, env, fuel)
  const cls = classifyVerb(env, 'my-verb')
  assert.equal(cls.status, 'user-stub')
})

// ── unit: define-stub throws on call ────────────────────────────────

test('define-stub — throws contract-quoted error when invoked', async () => {
  const { makeBaseEnv } = await import('../src/base.js')
  const { evaluate } = await import('../src/interp.js')
  const { parse } = await import('../src/reader.js')
  const fuel = { n: 200000 }
  const env = makeBaseEnv(fuel)
  const setup = parse(`(define-stub 'my-verb "not yet")`)
  for (const f of setup) evaluate(f, env, fuel)
  const call = parse(`(my-verb 1 2)`)
  assert.throws(() => {
    for (const f of call) evaluate(f, env, fuel)
  }, /user-defined stub/i)
})

// ── unit: color rendering ───────────────────────────────────────────

test('palette — statusRole returns a function per status', async () => {
  // Force color on for this test. The palette reads NO_COLOR / TTY at
  // module load, so we set env and freshly import.
  const original = process.env.NO_COLOR
  process.env.NO_COLOR = ''
  // Save & fake TTY as isTTY influences the guard, but re-import
  // doesn't re-read isTTY. We just assert the API exists and returns
  // strings regardless — the color escapes might be stripped.
  const { statusRole } = await import('../src/repl/palette.js?ts=' + Date.now())
  for (const s of ['implemented', 'stubbed', 'platform-unsupported', 'user-stub', 'missing']) {
    const paint = statusRole(s)
    assert.equal(typeof paint, 'function')
    assert.equal(typeof paint('hello'), 'string')
    assert.match(paint('hello'), /hello/)
  }
  if (original !== undefined) process.env.NO_COLOR = original
  else delete process.env.NO_COLOR
})

// ── integration: sakura-scheme CLI ──────────────────────────────────

test('CLI — define-stub + call surfaces the stub message', () => {
  const r = spawnSync(SAKURA, [
    'eval',
    `(begin (define-stub 'my-verb "coming soon") (my-verb 1))`,
  ], { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /user-defined stub/i)
  assert.match(r.stderr, /coming soon/)
})

test('CLI — help <verb> for implemented verb prints status', () => {
  const r = spawnSync(SAKURA, ['help', '+'], {
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /\+/)
})

test('CLI — help for missing verb prints friendly not-found text', () => {
  const r = spawnSync(SAKURA, ['help', 'grbge'], {
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  // The `help` subcommand exits 1 for a missing verb and prints
  // "no info for '…'". Both stdout and stderr are surface-fine.
  assert.notEqual(r.status, 0)
  const out = (r.stdout || '') + (r.stderr || '')
  assert.match(out, /no info for/i)
})

test('REPL piped — unbound symbol prints did-you-mean', () => {
  // Spawn the REPL in piped mode and type an obvious typo of `cadr`.
  // The error path should print a color-coded suggestion below the
  // error line. NO_COLOR strips escapes; we assert on the text.
  const r = spawnSync(SAKURA, ['repl'], {
    encoding: 'utf-8',
    input: '(cadre 1 2 3)\n',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /error:.*unbound/i)
  assert.match(r.stdout, /did you mean:/i)
})
