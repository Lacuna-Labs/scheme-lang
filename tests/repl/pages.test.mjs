// tests/repl/pages.test.mjs — verify the browser bundle builds + runs.
//
// This test does NOT require a browser. It:
//   1. runs docs/site/build.mjs
//   2. imports the produced dist/scheme-lang.mjs
//   3. asserts on a handful of Scheme evaluations
//   4. runs docs/site/render-ref.mjs and asserts the HTML is non-trivial
//
// It's fast (~500ms end-to-end) and belongs alongside the REPL smoke tests
// so `node --test tests/repl/` covers Pages too.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')
const SITE = join(REPO, 'docs', 'site')
const DIST = join(SITE, 'dist')

test('pages — bundle builds without error', () => {
  const r = spawnSync(process.execPath, [join(SITE, 'build.mjs')], {
    encoding: 'utf-8',
  })
  assert.equal(r.status, 0, r.stderr)
  const bundlePath = join(DIST, 'scheme-lang.mjs')
  const s = statSync(bundlePath)
  assert.ok(s.size > 40 * 1024, 'bundle too small — engine likely truncated')
  assert.ok(s.size < 500 * 1024, 'bundle unreasonably large — did something get inlined?')
})

test('pages — bundle exports the interpreter surface', async () => {
  const mod = await import(join(DIST, 'scheme-lang.mjs'))
  for (const name of ['parse', 'evaluate', 'expandProgram', 'makeBaseEnv',
                       'Sym', 'Env', 'Closure', 'CORE_DOCS']) {
    assert.ok(name in mod, `bundle missing export: ${name}`)
  }
})

test('pages — bundle evaluates basic Scheme', async () => {
  const mod = await import(join(DIST, 'scheme-lang.mjs') + '?v=1')
  const fuel = { n: 200000 }
  const env = mod.makeBaseEnv(fuel)
  function run(src) {
    const forms = mod.parse(src)
    const { forms: expanded } = mod.expandProgram(forms)
    let last
    for (const f of expanded) last = mod.evaluate(f, env, fuel)
    fuel.n = 200000
    return last
  }
  assert.equal(run('(+ 1 2)'), 3)
  assert.equal(run('(* 6 7)'), 42)
  assert.deepEqual(run("(map (lambda (x) (* x x)) '(1 2 3 4 5))"), [1, 4, 9, 16, 25])
  assert.equal(run('(define (fact n) (if (< n 2) 1 (* n (fact (- n 1))))) (fact 10)'), 3628800)
  assert.deepEqual(run("(sort '(3 1 4 1 5 9 2 6) <)"), [1, 1, 2, 3, 4, 5, 6, 9])
})

test('pages — bundle CORE_DOCS carries at least 40 entries', async () => {
  const mod = await import(join(DIST, 'scheme-lang.mjs') + '?v=2')
  assert.ok(Object.keys(mod.CORE_DOCS).length >= 40)
  // Spot-check a well-known entry.
  assert.ok(mod.CORE_DOCS['+'], 'missing docs for +')
  assert.ok(mod.CORE_DOCS['map'], 'missing docs for map')
})

test('pages — reference renderer emits non-trivial HTML', () => {
  const r = spawnSync(process.execPath, [join(SITE, 'render-ref.mjs')], {
    encoding: 'utf-8',
  })
  assert.equal(r.status, 0, r.stderr)
  const html = readFileSync(join(DIST, 'reference.html'), 'utf-8')
  assert.ok(html.length > 100 * 1024, 'reference HTML too small')
  assert.ok(html.includes('<h1'), 'missing h1 in rendered reference')
  assert.ok(html.includes('run-btn'), 'missing Run buttons in rendered reference')
  assert.ok(html.includes('class="c-keyword"'), 'missing highlighted keywords')
  assert.ok(html.includes('ref-toc'), 'missing sidebar TOC')
})

test('pages — build-site.mjs produces a complete index.html', () => {
  const r = spawnSync(process.execPath, [join(SITE, 'build-site.mjs')], {
    encoding: 'utf-8',
  })
  assert.equal(r.status, 0, r.stderr)
  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')
  assert.ok(html.includes('id="repl"'), 'index.html missing #repl mount point')
  assert.ok(html.includes('scheme-lang'), 'index.html missing brand')
  assert.ok(html.includes('Try it'), 'index.html missing "Try it" affordance')
  assert.ok(html.includes('ref-layout'), 'index.html missing reference')
  // .nojekyll exists so Pages serves the folder as-is.
  const stat = statSync(join(DIST, '.nojekyll'))
  assert.ok(stat.isFile())
})
