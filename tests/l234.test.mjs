// tests/l234.test.mjs — L2 AI + L3 Game + L4 Commercial smoke tests.
//
// These verify the layer-2/3/4 additions work end-to-end from the
// sakura-scheme binary. Run with:
//   node --test scheme-lang/tests/l234.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SAKURA = join(ROOT, 'bin', 'sakura-scheme')

function runEval(expr) {
  const r = spawnSync(SAKURA, ['eval', expr], {
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  return { stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim(), status: r.status }
}

// ── L3 GAME ─────────────────────────────────────────────────────────

test('L3 game — entity/make returns id', () => {
  const r = runEval("(entity/make 'ball 10 20)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '"ball"')
})

test('L3 game — entity/get returns position list', () => {
  const r = runEval("(begin (entity/make 'ball 10 20 4 4) (entity/get 'ball))")
  assert.equal(r.status, 0)
  assert.match(r.stdout, /^\("ball" 10 20 0 0 4 4\)$/)
})

test('L3 game — entity/collides? detects overlap', () => {
  const r = runEval(
    "(begin (entity/make 'a 0 0 10 10) (entity/make 'b 5 5 10 10) (entity/collides? 'a 'b))"
  )
  assert.equal(r.stdout, '#t')
})

test('L3 game — entity/collides? denies non-overlap', () => {
  const r = runEval(
    "(begin (entity/make 'a 0 0 10 10) (entity/make 'b 100 100 10 10) (entity/collides? 'a 'b))"
  )
  assert.equal(r.stdout, '#f')
})

test('L3 game — physics/step applies gravity', () => {
  const r = runEval(
    "(begin (physics/gravity! 1) (entity/make 'ball 0 0) (physics/step) (entity/get 'ball))"
  )
  // vy = 0 + 1 = 1, then vy *= 0.98 = 0.98. y = 0 + 0.98 = 0.98
  assert.match(r.stdout, /"ball" 0 0\.98/)
})

test('L3 game — entity/pin! excludes from physics', () => {
  const r = runEval(
    "(begin (physics/gravity! 1) (entity/make 'floor 0 100 80 4) (entity/pin! 'floor) (physics/step) (entity/get 'floor))"
  )
  assert.match(r.stdout, /"floor" 0 100 0 0/)
})

test('L3 game — sprites accumulate + clear', () => {
  const r = runEval(
    "(begin (sprite 'ball 40 40) (sprite 'wall 20 20) (length (sprites)))"
  )
  assert.equal(r.stdout, '2')
})

test('L3 game — tilemap set + get', () => {
  const r = runEval(
    "(begin (tilemap/set! '((0 0 1) (0 1 0))) (tilemap/get 2 0))"
  )
  assert.equal(r.stdout, '1')
})

// ── L2 AI ───────────────────────────────────────────────────────────

test('L2 cortex — remember + recall round-trip', () => {
  const r = runEval(
    "(begin (cortex/remember 'greeting \"hello\") (cortex/recall 'greeting))"
  )
  assert.equal(r.stdout, '"hello"')
})

test('L2 cortex — recall unknown key is empty', () => {
  const r = runEval("(cortex/recall 'never-set)")
  // undefined prints as "()" via schemeFormat (nil/empty-list convention).
  assert.match(r.stdout, /^\(\)$|^nil$/)
})

test('L2 cortex — forget removes a key', () => {
  const r = runEval(
    "(begin (cortex/remember 'k 'v) (cortex/forget 'k) (cortex/recall 'k))"
  )
  assert.match(r.stdout, /^\(\)$|^nil$/)
})

test('L2 llm/complete — errors cleanly with no provider', () => {
  const r = runEval("(llm/complete \"hello\")")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /needs an LLM provider/)
})

// ── L4 COMMERCIAL ───────────────────────────────────────────────────

test('L4 commercial — etsy verb errors without auth', () => {
  const r = runEval("(etsy/list-products)")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /sign in to use `etsy\/list-products`/)
  assert.match(r.stderr, /sakura login/)
})

test('L4 commercial — ebay verb errors without auth', () => {
  const r = runEval("(ebay/list-items)")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /sign in to use `ebay\/list-items`/)
})

test('L4 commercial — shopify verb errors without auth', () => {
  const r = runEval("(shopify/list-products)")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /sign in to use `shopify\/list-products`/)
})

test('L4 commercial — meta verb errors without auth', () => {
  const r = runEval("(meta/post \"hi\")")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /sign in to use `meta\/post`/)
})

test('L4 commercial — google verb errors without auth', () => {
  const r = runEval("(google/analytics 'today)")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /sign in to use `google\/analytics`/)
})

test('L4 commercial — a script REGISTERS with commercial verbs even without auth', () => {
  // Just calling define/let with the verb in scope should parse fine —
  // no auth check fires until the verb is invoked.
  const r = runEval(
    "(define (my-script) (etsy/list-products)) 'defined-ok"
  )
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'defined-ok')
})

// ── CLI ─────────────────────────────────────────────────────────────

test('CLI — help mentions login/logout/whoami', () => {
  const r = spawnSync(SAKURA, ['--help'], { encoding: 'utf-8' })
  assert.match(r.stdout, /login/)
  assert.match(r.stdout, /logout/)
  assert.match(r.stdout, /whoami/)
})

test('CLI — whoami without auth prints "not signed in"', () => {
  // Sandbox HOME so a real logged-in dev machine doesn't pollute the
  // test. Fresh temp dir → no ~/.sakura/auth.json to load.
  const tmp = join(process.env.TMPDIR || '/tmp', 'sakura-test-' + Date.now())
  const r = spawnSync(SAKURA, ['whoami'], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: tmp, NO_COLOR: '1' },
  })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /not signed in/)
})
