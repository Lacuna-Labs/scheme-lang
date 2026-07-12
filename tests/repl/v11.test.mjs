// tests/repl/v11.test.mjs — v1.1 feature tests.
//
// These tests cover the features shipped in v1.1:
//   • ,trace / ,untrace
//   • ,inspect (piped fallback only — TTY walker is manual)
//   • ,watch-file / ,unwatch-file
//   • ,save / ,load full session replay
//   • Inline image router + PNG encoder
//
// Companion to smoke.test.mjs. Run with:
//   node --test scheme-lang/tests/repl/v11.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPL_ROOT = join(__dirname, '..', '..')
const SAKURA = join(REPL_ROOT, 'bin', 'sakura-scheme')

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') }

function runReplPiped(script, envOverrides = {}) {
  const env = {
    ...process.env,
    NO_COLOR: '1',
    SCHEME_LANG_FORCE_BRAILLE: '1',
    // Wipe iTerm/kitty/etc. from the test environment so image tests can
    // control them explicitly.
    TERM_PROGRAM: '',
    KITTY_WINDOW_ID: '',
    ...envOverrides,
  }
  const r = spawnSync(SAKURA, ['repl'], { encoding: 'utf-8', input: script, env })
  return { stdout: stripAnsi(r.stdout || ''), stderr: r.stderr, status: r.status }
}

function tmpFile(name) {
  const d = mkdtempSync(join(tmpdir(), 'scheme-lang-test-'))
  return join(d, name)
}

// ── ,trace ──────────────────────────────────────────────────────────

test('trace — logs entry and exit of a user-defined recursive fn', () => {
  const script = [
    '(define (fib n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))',
    ',trace fib',
    '(fib 2)',
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  // Should see nested arrows.
  assert.match(r.stdout, /→ fib 2/)
  assert.match(r.stdout, /→ fib 1/)
  assert.match(r.stdout, /← fib = 1/)
  assert.match(r.stdout, /← fib = 1/)
  // The final result of (fib 2) is 1.
  assert.match(r.stdout, /\b1\b/)
})

test('trace — untrace restores original + no more logging', () => {
  const script = [
    '(define (double n) (* n 2))',
    ',trace double',
    '(double 3)',
    ',untrace double',
    '(double 5)',
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  // First call logged.
  assert.match(r.stdout, /→ double 3/)
  assert.match(r.stdout, /← double = 6/)
  // Second call should NOT log — count arrows: exactly one → after the (double 5).
  const secondArrows = r.stdout.split('(double 5)')[1] || ''
  assert.doesNotMatch(secondArrows, /→ double 5/)
  // And returns 10.
  assert.match(r.stdout, /\b10\b/)
})

test('trace — refuses to trace unbound name', () => {
  const r = runReplPiped(',trace no-such-verb\n,exit\n')
  assert.match(r.stdout, /unbound/)
})

test('trace — refuses to double-trace', () => {
  const script = [
    '(define (f n) n)',
    ',trace f',
    ',trace f',
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  assert.match(r.stdout, /already tracing/)
})

test('trace — bare ,trace with none active reports nothing', () => {
  const r = runReplPiped(',trace\n,exit\n')
  assert.match(r.stdout, /nothing traced/)
})

test('trace — works on primitives too', () => {
  const script = [
    ',trace car',
    "(car '(1 2 3))",
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  assert.match(r.stdout, /→ car/)
  assert.match(r.stdout, /← car = 1/)
})

// ── ,inspect (piped fallback) ───────────────────────────────────────

test('inspect — non-TTY prints value + notice', () => {
  const script = [
    "(define v (list 1 2 3))",
    ",inspect v",
    ",exit",
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  // Piped mode: should print the rendered value.
  assert.match(r.stdout, /\(1 2 3\)/)
  // And note that the walker needs a TTY.
  assert.match(r.stdout, /non-interactive/)
})

test('inspect — with no arg + no _ says nothing to inspect', () => {
  const r = runReplPiped(',inspect\n,exit\n')
  assert.match(r.stdout, /nothing to inspect/)
})

// ── ,watch-file / ,unwatch-file ─────────────────────────────────────

test('watch-file — initial load pulls defines into env', () => {
  const path = tmpFile('lib.scm')
  writeFileSync(path, '(define seven-figure 314159)\n(define (halve n) (/ n 2))\n')
  const script = [
    `,watch-file ${path}`,
    'seven-figure',
    '(halve 10)',
    `,unwatch-file ${path}`,
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  assert.match(r.stdout, /watching/)
  assert.match(r.stdout, /314159/)
  assert.match(r.stdout, /\b5\b/)
  assert.match(r.stdout, /unwatched/)
})

test('watch-file — missing file reports gracefully', () => {
  const r = runReplPiped(',watch-file /definitely/does/not/exist.scm\n,exit\n')
  assert.match(r.stdout, /no such file/)
})

test('watch-file — bare ,watch-file lists active watches (empty)', () => {
  const r = runReplPiped(',watch-file\n,exit\n')
  assert.match(r.stdout, /no active watchers/)
})

test('unwatch-file — with no active watchers reports', () => {
  const r = runReplPiped(',unwatch-file\n,exit\n')
  assert.match(r.stdout, /no active watchers/)
})

test('watch-file — --yes-all overrides confirm', () => {
  const path = tmpFile('overrides.scm')
  writeFileSync(path, '(define x 100)\n')
  const script = [
    '(define x 1)',
    `,watch-file ${path} --yes-all`,
    'x',
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  // With --yes-all the file's `x` wins.
  assert.match(r.stdout, /100/)
})

// ── ,save / ,load ───────────────────────────────────────────────────

test('save — writes a slat with defines and history', () => {
  const path = tmpFile('session.slat')
  const script = [
    '(define a 1)',
    '(define (b x) (+ x 1))',
    '(b a)',
    `,save ${path}`,
    ',exit',
  ].join('\n') + '\n'
  const r = runReplPiped(script)
  assert.match(r.stdout, /saved 2 define\(s\)/)
  assert.ok(existsSync(path))
  const contents = readFileSync(path, 'utf-8')
  assert.match(contents, /#slat scheme-lang-session/)
  assert.match(contents, /## defines/)
  assert.match(contents, /## history/)
  assert.match(contents, /## results/)
  assert.match(contents, /\(define a 1\)/)
})

test('load — replays defines into a fresh env', () => {
  const path = tmpFile('replay.slat')
  // First session — save.
  runReplPiped([
    '(define greet 99)',
    '(define (add-one n) (+ n 1))',
    `,save ${path}`,
    ',exit',
  ].join('\n') + '\n')
  // Fresh REPL — load and use.
  const r = runReplPiped([
    `,load ${path} --yes-all`,
    'greet',
    '(add-one greet)',
    ',exit',
  ].join('\n') + '\n')
  assert.match(r.stdout, /loaded 2 define\(s\)/)
  assert.match(r.stdout, /99/)
  assert.match(r.stdout, /100/)
})

test('load — restores results into _', () => {
  const path = tmpFile('results.slat')
  runReplPiped([
    '(+ 20 22)',
    `,save ${path}`,
    ',exit',
  ].join('\n') + '\n')
  const r = runReplPiped([
    `,load ${path} --yes-all`,
    '_',
    ',exit',
  ].join('\n') + '\n')
  // Last result was 42, restored into `_`.
  const bare42 = r.stdout.match(/\b42\b/g) || []
  assert.ok(bare42.length >= 1, 'expected _ to bind 42 from replay')
})

test('load — bad path reports', () => {
  const r = runReplPiped(',load /nope/nope/nope.slat\n,exit\n')
  assert.match(r.stdout, /load failed/)
})

test('load — rejects file lacking session header', () => {
  const path = tmpFile('bogus.slat')
  writeFileSync(path, 'this is not a slat\n')
  const r = runReplPiped(`,load ${path}\n,exit\n`)
  assert.match(r.stdout, /bad header/)
})

// ── ,image (capability report) ──────────────────────────────────────

test('image — reports capabilities, defaults to braille when nothing set', () => {
  const r = runReplPiped(',image\n,exit\n')
  assert.match(r.stdout, /inline image capabilities/)
  assert.match(r.stdout, /protocol\s+braille/)
})

test('image — detects iTerm2 via TERM_PROGRAM', () => {
  const r = runReplPiped(',image\n,exit\n', { TERM_PROGRAM: 'iTerm.app' })
  assert.match(r.stdout, /protocol\s+iterm2/)
  assert.match(r.stdout, /iterm2\s+true/)
})

test('image — detects kitty via KITTY_WINDOW_ID', () => {
  const r = runReplPiped(',image\n,exit\n', { KITTY_WINDOW_ID: '42' })
  assert.match(r.stdout, /protocol\s+kitty/)
})

// ── imageRouter unit tests ──────────────────────────────────────────

import { detectCapabilities, pickProtocol, rasterize, renderInline, renderITerm, renderKitty, renderSixel } from '../../src/repl/imageRouter.js'
import { encodePng } from '../../src/repl/pngEncoder.js'

test('imageRouter — detectCapabilities reads env safely', () => {
  const caps = detectCapabilities({})
  assert.equal(caps.iterm, false)
  assert.equal(caps.kitty, false)
  assert.equal(caps.wezterm, false)
  assert.equal(caps.sixel, false)
})

test('imageRouter — detects iTerm.app', () => {
  const caps = detectCapabilities({ TERM_PROGRAM: 'iTerm.app' })
  assert.equal(caps.iterm, true)
  assert.equal(pickProtocol(caps), 'iterm2')
})

test('imageRouter — detects WezTerm as iterm2 protocol', () => {
  const caps = detectCapabilities({ TERM_PROGRAM: 'WezTerm' })
  assert.equal(caps.wezterm, true)
  assert.equal(pickProtocol(caps), 'iterm2')
})

test('imageRouter — detects kitty via TERM', () => {
  const caps = detectCapabilities({ TERM: 'xterm-kitty' })
  assert.equal(caps.kitty, true)
  assert.equal(pickProtocol(caps), 'kitty')
})

test('imageRouter — detects kitty via KITTY_WINDOW_ID', () => {
  const caps = detectCapabilities({ KITTY_WINDOW_ID: '1' })
  assert.equal(caps.kitty, true)
})

test('imageRouter — detects sixel via COLORTERM', () => {
  const caps = detectCapabilities({ COLORTERM: 'sixel' })
  assert.equal(caps.sixel, true)
  assert.equal(pickProtocol(caps), 'sixel')
})

test('imageRouter — iterm2 wins over kitty when both present', () => {
  const caps = detectCapabilities({ TERM_PROGRAM: 'iTerm.app', KITTY_WINDOW_ID: '1' })
  assert.equal(pickProtocol(caps), 'iterm2')
})

test('imageRouter — rasterize circle produces pixel buffer', () => {
  const r = rasterize(['circle', 100, 100, 50])
  assert.ok(r)
  assert.equal(r.pixels.length, r.width * r.height * 4)
})

test('imageRouter — rasterize plot with data', () => {
  const r = rasterize({ kind: 'plot', data: [1, 2, 3, 4, 5] })
  assert.ok(r)
  assert.ok(r.pixels.length > 0)
})

test('imageRouter — rasterize returns null for unknown value', () => {
  const r = rasterize(42)
  assert.equal(r, null)
})

test('imageRouter — renderInline returns null when no protocol', () => {
  const s = renderInline(['circle', 100, 100, 50], { env: {}, caps: undefined })
  // Empty env → braille fallback → null.
  assert.equal(s, null)
})

test('imageRouter — renderInline produces iterm2 escape sequence', () => {
  const s = renderInline(['circle', 100, 100, 50], {
    caps: { iterm: true, wezterm: false, kitty: false, sixel: false },
  })
  assert.ok(s.startsWith('\x1b]1337;File=inline=1'))
  assert.ok(s.endsWith('\x07'))
})

test('imageRouter — renderInline produces kitty escape sequence', () => {
  const s = renderInline(['circle', 100, 100, 50], {
    caps: { iterm: false, wezterm: false, kitty: true, sixel: false },
  })
  assert.ok(s.startsWith('\x1b_G'))
})

test('imageRouter — renderInline produces sixel escape sequence', () => {
  const s = renderInline(['circle', 100, 100, 50], {
    caps: { iterm: false, wezterm: false, kitty: false, sixel: true },
  })
  assert.ok(s.startsWith('\x1bPq'))
  assert.ok(s.endsWith('\x1b\\'))
})

test('imageRouter — forceProtocol overrides detected caps', () => {
  const s = renderInline(['circle', 100, 100, 50], {
    caps: { iterm: true, wezterm: false, kitty: false, sixel: false },
    forceProtocol: 'kitty',
  })
  assert.ok(s.startsWith('\x1b_G'))
})

test('pngEncoder — produces a valid PNG signature', () => {
  const pixels = new Uint8Array(2 * 2 * 4)
  pixels.fill(255)
  const png = encodePng(pixels, 2, 2)
  // PNG signature is 89 50 4E 47 0D 0A 1A 0A.
  assert.equal(png[0], 137)
  assert.equal(png[1], 80)
  assert.equal(png[2], 78)
  assert.equal(png[3], 71)
  // Should contain IHDR + IDAT + IEND chunks.
  const hex = Buffer.from(png).toString('ascii')
  assert.ok(hex.includes('IHDR'))
  assert.ok(hex.includes('IDAT'))
  assert.ok(hex.includes('IEND'))
})

test('pngEncoder — rejects mismatched pixel buffer', () => {
  assert.throws(() => encodePng(new Uint8Array(3), 2, 2), /pixels length/)
})

// ── session module unit tests ───────────────────────────────────────

import { extractDefines, saveSession, loadSession, recordSessionLine } from '../../src/repl/session.js'
import { makeBaseEnv } from '../../src/base.js'

test('session — extractDefines pulls define + define-syntax forms', () => {
  const lines = [
    '(define x 1)',
    '(+ 1 2)',
    '(define (f a) (* a 2))',
    '(f 5)',
  ]
  const d = extractDefines(lines)
  assert.equal(d.length, 2)
  assert.match(d[0], /^\(define x 1\)$/)
  assert.match(d[1], /^\(define \(f a\)/)
})

test('session — saveSession + loadSession round-trip', () => {
  const path = tmpFile('rt.slat')
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const results = { last: 42, list: [42] }
  const ctx = { env, fuel, results, sessionLines: ['(define answer 42)', 'answer'], writeLine: () => {}, confirm: () => true, rebindResults: () => {} }
  const save = saveSession(ctx, path)
  assert.ok(save.ok)

  // Load into a fresh env.
  const env2 = makeBaseEnv(fuel)
  const ctx2 = { env: env2, fuel, results: { last: undefined, list: [] }, sessionLines: [], writeLine: () => {}, confirm: () => true, rebindResults: () => {}, history: null }
  const load = loadSession(ctx2, path, { yesAll: true })
  assert.ok(load.ok)
  assert.equal(load.counts.defines, 1)
  // The value should now be bound.
  assert.equal(env2.get('answer'), 42)
})

// ── fileWatcher unit tests ──────────────────────────────────────────

import { addWatch, removeWatch, listWatches } from '../../src/repl/fileWatcher.js'

test('fileWatcher — addWatch loads defines immediately', () => {
  const path = tmpFile('immediate.scm')
  writeFileSync(path, '(define eleven 11)\n')
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const ctx = { env, fuel, writeLine: () => {}, confirm: () => true }
  const r = addWatch(ctx, path)
  assert.ok(r.ok)
  assert.equal(env.get('eleven'), 11)
  removeWatch(ctx, path)
})

test('fileWatcher — listWatches returns absolute paths', () => {
  const path = tmpFile('listed.scm')
  writeFileSync(path, '(define k 1)\n')
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const ctx = { env, fuel, writeLine: () => {}, confirm: () => true }
  addWatch(ctx, path)
  const list = listWatches(ctx)
  assert.equal(list.length, 1)
  assert.ok(list[0].endsWith('listed.scm'))
  removeWatch(ctx, path)
})

test('fileWatcher — removeWatch stops all when path omitted', () => {
  const a = tmpFile('a.scm')
  const b = tmpFile('b.scm')
  writeFileSync(a, '(define a 1)\n')
  writeFileSync(b, '(define b 2)\n')
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const ctx = { env, fuel, writeLine: () => {}, confirm: () => true }
  addWatch(ctx, a)
  addWatch(ctx, b)
  assert.equal(listWatches(ctx).length, 2)
  removeWatch(ctx, null)
  assert.equal(listWatches(ctx).length, 0)
})

// ── trace unit tests ────────────────────────────────────────────────

import { installTrace, removeTrace, tracedNames } from '../../src/repl/trace.js'

test('trace — installTrace on a primitive returns ok', () => {
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const captured = []
  const ctx = { env, fuel, writeLine: (s) => captured.push(s), applyFn: () => null }
  const r = installTrace(ctx, 'car')
  assert.ok(r.ok)
  assert.deepEqual(tracedNames(ctx), ['car'])
  removeTrace(ctx, 'car')
  assert.deepEqual(tracedNames(ctx), [])
})

test('trace — installTrace on unbound name fails', () => {
  const fuel = { n: 50000 }
  const env = makeBaseEnv(fuel)
  const ctx = { env, fuel, writeLine: () => {} }
  const r = installTrace(ctx, 'no-such-thing')
  assert.equal(r.ok, false)
})

// ── ,help lists v1.1 commands ───────────────────────────────────────

test('help — lists ,trace and ,inspect and ,watch-file and ,image', () => {
  const r = runReplPiped(',help\n,exit\n')
  assert.match(r.stdout, /,trace/)
  assert.match(r.stdout, /,inspect/)
  assert.match(r.stdout, /,watch-file/)
  assert.match(r.stdout, /,image/)
})

// ── v1.2 stubs still discoverable ───────────────────────────────────

test('stubs — ,notebook returns not-connected voice', () => {
  const r = runReplPiped(',notebook\n,exit\n')
  assert.match(r.stdout, /waiting for her|not connected/i)
})

test('paredit — ,paredit shows key bindings', () => {
  const r = runReplPiped(',paredit\n,exit\n')
  assert.match(r.stdout, /paredit key bindings/)
  assert.match(r.stdout, /barf-forward/)
  assert.match(r.stdout, /slurp-forward/)
})

test('stubs — ,lsp returns not-connected voice', () => {
  const r = runReplPiped(',lsp\n,exit\n')
  assert.match(r.stdout, /waiting for her|not connected/i)
})

// ── braille inline path (fallback) still works ──────────────────────

test('graphics — Braille rendering still works when no protocol', () => {
  const r = runReplPiped("(list 'circle 100 100 50)\n,exit\n")
  assert.match(r.stdout, /[⠀-⣿]/)
})

// ── paredit unit tests ─────────────────────────────────────────────

import { slurpForward, barfForward, slurpBackward, killForm, findEnclosingForm, selectFormBounds } from '../../src/repl/paredit.js'

test('paredit — findEnclosingForm finds nearest parens', () => {
  const buf = '(foo (bar baz) qux)'
  const f = findEnclosingForm(buf, 8)  // cursor inside (bar baz)
  assert.deepEqual(f, { start: 5, end: 14 })
})

test('paredit — findEnclosingForm returns null at top level', () => {
  const buf = 'foo'
  const f = findEnclosingForm(buf, 1)
  assert.equal(f, null)
})

test('paredit — slurpForward pulls the next form in', () => {
  // Cursor inside (foo), next form is bar → (foo bar).
  const buf = '(foo) bar'
  const r = slurpForward(buf, 2)
  assert.equal(r.buffer, '(foo bar)')
})

test('paredit — barfForward pops last child out', () => {
  const buf = '(foo bar baz)'
  const r = barfForward(buf, 5)
  // Should push `baz` out of the parens.
  assert.equal(r.buffer, '(foo bar) baz')
})

test('paredit — slurpBackward pulls the previous form in', () => {
  const buf = 'foo (bar baz)'
  const r = slurpBackward(buf, 6)  // cursor inside (bar baz)
  assert.equal(r.buffer, '(foo bar baz)')
})

test('paredit — killForm deletes the enclosing form', () => {
  const buf = 'before (junk here) after'
  const r = killForm(buf, 10)
  assert.equal(r.buffer, 'before  after')
  assert.equal(r.cursor, 7)
})

test('paredit — killForm at top level is a no-op', () => {
  const buf = 'plain text'
  const r = killForm(buf, 3)
  assert.equal(r.buffer, 'plain text')
})

test('paredit — slurpForward at end-of-buffer is a no-op', () => {
  const buf = '(foo)'
  const r = slurpForward(buf, 2)
  assert.equal(r.buffer, '(foo)')
})

test('paredit — selectFormBounds returns bounds', () => {
  const buf = 'outside (inner form) more'
  const b = selectFormBounds(buf, 12)
  assert.deepEqual(b, { start: 8, end: 20 })
})

test('paredit — respects strings (paren inside string does not count)', () => {
  const buf = '(foo "not (a) paren" bar)'
  const f = findEnclosingForm(buf, 10)
  assert.deepEqual(f, { start: 0, end: 25 })
})

test('paredit — respects line comments', () => {
  const buf = '(foo bar) ; (not a form)'
  const f = findEnclosingForm(buf, 15)
  // Comment content isn't a form.
  assert.equal(f, null)
})

// ── easter eggs + quasiquote family ─────────────────────────────────

test('quasiquote is a bound symbol', () => {
  const r = spawnSync(SAKURA, ['eval', 'quasiquote'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stdout, /unbound/)
})

test('unquote is a bound symbol', () => {
  const r = spawnSync(SAKURA, ['eval', 'unquote'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stdout, /unbound/)
})

test('unquote-splicing is a bound symbol', () => {
  const r = spawnSync(SAKURA, ['eval', 'unquote-splicing'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stdout, /unbound/)
})

test('quasiquote special form still works', () => {
  const r = spawnSync(SAKURA, ['eval', "(define b 42) `(a ,b c)"], { encoding: 'utf-8' })
  assert.match(r.stdout, /\(a 42 c\)/)
})

test('circle is a bound shape verb (no quote needed)', () => {
  const r = spawnSync(SAKURA, ['eval', '(circle 40 40 15)'], { encoding: 'utf-8' })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stdout, /unbound/)
})

test('HAL 9000 easter egg', () => {
  const r = spawnSync(SAKURA, ['eval', "(open 'pod-bay-doors)"], { encoding: 'utf-8' })
  assert.match(r.stdout, /I'm sorry Dave/)
})
