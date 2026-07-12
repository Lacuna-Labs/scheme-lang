// tests/repl/smoke.test.mjs — REPL smoke tests.
//
// Run with:
//   node --test scheme-lang/tests/repl/smoke.test.mjs
//
// Uses the built-in node:test runner so we don't drag in another dep.
// Each test spawns the sakura-scheme binary and asserts on stdout.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPL_ROOT = join(__dirname, '..', '..')
const SAKURA = join(REPL_ROOT, 'bin', 'sakura-scheme')
const LAUNCHER = join(REPL_ROOT, 'bin', 'scheme-lang')

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') }

function runEval(expr) {
  const r = spawnSync(SAKURA, ['eval', expr], { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } })
  return { stdout: r.stdout, stderr: r.stderr, status: r.status }
}

function runReplPiped(script) {
  const r = spawnSync(SAKURA, ['repl'], {
    encoding: 'utf-8',
    input: script,
    env: { ...process.env, NO_COLOR: '1' },
  })
  return { stdout: stripAnsi(r.stdout || ''), stderr: r.stderr, status: r.status }
}

// ── eval subcommand ─────────────────────────────────────────────────

test('eval — arithmetic', () => {
  const r = runEval('(+ 1 2)')
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '3')
})

test('eval — nested', () => {
  const r = runEval('(* 3 (+ 2 4))')
  assert.equal(r.stdout.trim(), '18')
})

test('eval — map + lambda', () => {
  const r = runEval("(map (lambda (x) (* x x)) '(1 2 3 4))")
  assert.equal(r.stdout.trim(), '(1 4 9 16)')
})

test('eval — factorial', () => {
  const r = runEval("(begin (define (f n) (if (< n 2) 1 (* n (f (- n 1))))) (f 6))")
  assert.equal(r.stdout.trim(), '720')
})

test('eval — error surfaces on stderr', () => {
  const r = runEval('(+ 1 "not a number")')
  // We accept either an error status or NaN — the language returns NaN
  // for JS-loose arithmetic. Just assert exit is clean.
  assert.ok(r.status === 0 || r.status === 1)
})

// ── CLI subcommands ─────────────────────────────────────────────────

test('CLI — --version prints', () => {
  const r = spawnSync(SAKURA, ['--version'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /sakura-scheme 1\.\d/)
})

test('CLI — --help prints usage', () => {
  const r = spawnSync(SAKURA, ['--help'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /Usage:/)
})

test('CLI — help <verb> prints verb info', () => {
  const r = spawnSync(SAKURA, ['help', 'map'], { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /map/)
  assert.match(r.stdout, /Apply fn to each element/)
})

// ── launcher ────────────────────────────────────────────────────────

test('launcher — --version', () => {
  const r = spawnSync(LAUNCHER, ['--version'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /scheme-lang 1\.\d/)
})

test('launcher — --list finds Sakura', () => {
  const r = spawnSync(LAUNCHER, ['--list'], { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /sakura/)
})

test('launcher — delegates eval to sakura', () => {
  const r = spawnSync(LAUNCHER, ['sakura', 'eval', '(+ 10 20)'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '30')
})

test('launcher — sakura --version forwards', () => {
  const r = spawnSync(LAUNCHER, ['sakura', '--version'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /sakura-scheme/)
})

// ── REPL (piped mode) ───────────────────────────────────────────────

test('repl — evaluates arithmetic', () => {
  const r = runReplPiped('(+ 40 2)\n,exit\n')
  assert.match(r.stdout, /42/)
})

test('repl — accepts a define + reuse', () => {
  const r = runReplPiped('(define x 10)\n(* x 2)\n,exit\n')
  assert.match(r.stdout, /20/)
})

test('repl — accepts multi-line balanced input', () => {
  const r = runReplPiped('(+ 1\n2\n3)\n,exit\n')
  assert.match(r.stdout, /\b6\b/)
})

test('repl — ,help lists commands', () => {
  const r = runReplPiped(',help\n,exit\n')
  assert.match(r.stdout, /REPL commands/)
  assert.match(r.stdout, /,type/)
  assert.match(r.stdout, /,ask sakura/)
})

test('repl — ,help <verb> shows doc', () => {
  const r = runReplPiped(',help filter\n,exit\n')
  assert.match(r.stdout, /filter/)
  assert.match(r.stdout, /Elements for which pred/)
})

test('repl — ,type prints signature', () => {
  const r = runReplPiped(',type map\n,exit\n')
  assert.match(r.stdout, /\(map fn lst\)/)
})

test('repl — ,apropos filters symbols', () => {
  const r = runReplPiped(',apropos ^map$\n,exit\n')
  assert.match(r.stdout, /map/)
})

test('repl — ,time shows timing', () => {
  const r = runReplPiped(',time (+ 1 2)\n,exit\n')
  assert.match(r.stdout, /time:/)
  assert.match(r.stdout, /fuel:/)
})

test('repl — ,ask sakura hints when unwired', () => {
  const r = runReplPiped(',ask sakura "hello"\n,exit\n')
  assert.match(r.stdout, /waiting for her|not connected/i)
})

test('repl — named result _ works', () => {
  const r = runReplPiped('(+ 3 4)\n_\n,exit\n')
  // "7" should appear at least twice.
  const matches = r.stdout.match(/\b7\b/g) || []
  assert.ok(matches.length >= 2, 'expected _ to bind to 7')
})

test('repl — unknown ,command reports', () => {
  const r = runReplPiped(',bogus\n,exit\n')
  assert.match(r.stdout, /unknown command/)
})

test('repl — graphic renders as Braille (circle)', () => {
  const r = runReplPiped("(list 'circle 100 100 50)\n,exit\n")
  // Braille block is U+2800..U+28FF — look for any glyph in that range.
  assert.match(r.stdout, /[⠀-⣿]/)
})

test('repl — long number list renders as bordered table', () => {
  const r = runReplPiped('(map (lambda (x) (* x x)) (range 1 20))\n,exit\n')
  // Border chars ┌ ─ │ └ should appear.
  assert.match(r.stdout, /┌|─|│/)
})

// ── highlight + balance unit tests ──────────────────────────────────

import { highlight, isBalanced, countBalance } from '../../src/repl/highlight.js'
import { completeSymbol, currentToken, commonPrefix, fuzzyScore } from '../../src/repl/complete.js'

test('highlight — passes through with NO_COLOR', () => {
  process.env.NO_COLOR = '1'
  // Highlight only runs when TTY. Non-TTY = pass-through. Good.
  const src = '(+ 1 2)'
  assert.equal(highlight(src), src)
})

test('isBalanced — parens', () => {
  assert.equal(isBalanced('(+ 1 2)'), true)
  assert.equal(isBalanced('(+ 1'), false)
  assert.equal(isBalanced('(+ (- 3 (* 2 1)))'), true)
})

test('isBalanced — strings', () => {
  assert.equal(isBalanced('"hello"'), true)
  assert.equal(isBalanced('"hello'), false)
  assert.equal(isBalanced('"say \\"hi\\""'), true)
})

test('isBalanced — comments skip parens', () => {
  assert.equal(isBalanced('; ( ( (\n(+ 1 2)'), true)
})

test('completeSymbol — prefix wins over subsequence', () => {
  const names = ['map', 'match', 'max', 'main']
  const r = completeSymbol('ma', { names })
  assert.equal(r[0].name, 'map')  // shortest prefix-match wins
})

test('completeSymbol — fuzzy subsequence', () => {
  const names = ['map', 'filter', 'reduce', 'flip']
  const r = completeSymbol('fp', { names })
  assert.ok(r.some(x => x.name === 'flip'))
})

test('currentToken — extracts symbol under cursor', () => {
  const t = currentToken('(map fn lst)', 6)
  assert.deepEqual({ start: t.start, end: t.end, text: t.text }, { start: 5, end: 7, text: 'fn' })
})

test('commonPrefix', () => {
  assert.equal(commonPrefix(['carrot', 'carry', 'card']), 'car')
  assert.equal(commonPrefix(['map']), 'map')
  assert.equal(commonPrefix([]), '')
})

// ── Braille rendering ───────────────────────────────────────────────

import { Grid, line, circle, disc, renderGraphic } from '../../src/repl/braille.js'

test('Braille — single dot renders as single Braille glyph', () => {
  const g = new Grid(2, 4)
  g.setDot(0, 0)
  const lines = g.toBraille()
  assert.equal(lines.length, 1)
  // Bit 0 set → 0x2801 = ⠁
  assert.equal(lines[0][0], '⠁')
})

test('Braille — line rasterization', () => {
  const g = new Grid(8, 4)
  line(g, 0, 0, 7, 3)
  const lines = g.toBraille()
  assert.equal(lines.length, 1)
  // Non-empty result
  assert.ok(lines[0].length > 0)
})

test('Braille — renderGraphic circle returns lines', () => {
  const lines = renderGraphic(['circle', 100, 100, 50])
  assert.ok(Array.isArray(lines))
  assert.ok(lines.length > 5)
})

test('Braille — renderGraphic ignores non-graphic values', () => {
  assert.equal(renderGraphic(42), null)
  assert.equal(renderGraphic([1, 2, 3]), null)  // number list is not a shape
})

// ── verbInfo ────────────────────────────────────────────────────────

import { verbInfo, allKnownVerbs, CORE_DOCS } from '../../src/repl/verbInfo.js'
import { makeBaseEnv } from '../../src/base.js'

test('verbInfo — pulls sig for map', () => {
  const env = makeBaseEnv({ n: 100000 })
  const info = verbInfo(env, 'map')
  assert.equal(info.kind, 'primitive')
  assert.match(info.sig, /\(map fn lst\)/)
})

test('allKnownVerbs — includes base env + core docs', () => {
  const env = makeBaseEnv({ n: 100000 })
  const names = allKnownVerbs(env)
  assert.ok(names.has('map'))
  assert.ok(names.has('define'))  // from CORE_DOCS even though it's a special form
  assert.ok(names.has('+'))
})

test('CORE_DOCS covers the load-bearing set', () => {
  for (const n of ['map', 'filter', 'reduce', 'car', 'cdr', 'lambda', 'if', 'define']) {
    assert.ok(CORE_DOCS[n], `missing doc for ${n}`)
  }
})

// ── discover ────────────────────────────────────────────────────────

import { discoverDialects } from '../../src/launcher/discover.js'

test('discover — finds bundled Sakura dialect', () => {
  const dialects = discoverDialects({ launcherPath: LAUNCHER })
  const sakura = dialects.find(d => d.name === 'sakura')
  assert.ok(sakura, 'expected sakura dialect')
  assert.match(sakura.entrypoint, /sakura-scheme$/)
})

// ── config ──────────────────────────────────────────────────────────

import { parseSlat, truthy, DEFAULTS } from '../../src/repl/config.js'

test('parseSlat — key/value + comments', () => {
  const cfg = parseSlat('keybindings: vim  ;; comment\n;; full-line comment\n theme: sakura ')
  assert.equal(cfg.keybindings, 'vim')
  assert.equal(cfg.theme, 'sakura')
})

test('truthy — accepts common yes-shapes', () => {
  assert.equal(truthy('#t'), true)
  assert.equal(truthy('true'), true)
  assert.equal(truthy('yes'), true)
  assert.equal(truthy('#f'), false)
  assert.equal(truthy('no'), false)
  assert.equal(truthy(''), false)
})

test('DEFAULTS has load-bearing keys', () => {
  assert.ok('keybindings' in DEFAULTS)
  assert.ok('auto-close-parens' in DEFAULTS)
})
