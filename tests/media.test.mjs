// tests/media.test.mjs — L1 MEDIA smoke + unit tests.
//
// Covers Phases 1-3 of the sakura-scheme-lang burndown plan:
//   Phase 1 — framebuffer, set-mode, circle/disc/line/rect/plot/clear/render
//             and the dots/iterm2/kitty/sixel/browser-canvas adapters.
//   Phase 2 — tone/note/sfx/music/silence + parsePitch + pitch → freq.
//   Phase 3 — on-frame/on-key/on-mouse/on-gamepad, tick-frame, sleep/sync,
//             save-cart/load-cart.
//
// Run with:
//   node --test tests/media.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SAKURA = join(ROOT, 'bin', 'sakura-scheme')

// ── unit tests — the pure modules ──────────────────────────────────

import {
  Framebuffer, DEFAULT_PALETTE, MODES, resolveMode, NAMED_COLORS,
} from '../src/framebuffer.js'
import {
  parsePitch, parseDuration, getSoundEngine,
  BellAdapter, WebAudioAdapter, NodeSpeakerAdapter,
} from '../src/sound.js'
import { renderFramebuffer as renderDots } from '../src/repl/dots.js'
import { renderFramebuffer as renderITerm2 } from '../src/repl/iterm2.js'
import { renderFramebuffer as renderKitty } from '../src/repl/kitty.js'
import { renderFramebuffer as renderSixel } from '../src/repl/sixel.js'
import { renderFramebuffer as renderBrowserCanvas } from '../src/repl/browser-canvas.js'

// ── framebuffer ────────────────────────────────────────────────────

test('framebuffer — new buffer starts black', () => {
  const fb = new Framebuffer(20, 15)
  assert.equal(fb.w, 20)
  assert.equal(fb.h, 15)
  for (let i = 0; i < fb.pixels.length; i++) assert.equal(fb.pixels[i], 0)
})

test('framebuffer — plot writes a pixel', () => {
  const fb = new Framebuffer(10, 10)
  fb.plot(3, 4, 8)
  assert.equal(fb.peek(3, 4), 8)
  assert.equal(fb.peek(0, 0), 0)
})

test('framebuffer — plot off-buffer is a no-op', () => {
  const fb = new Framebuffer(10, 10)
  fb.plot(-1, 0, 5)
  fb.plot(0, -1, 5)
  fb.plot(10, 5, 5)
  fb.plot(5, 10, 5)
  // Nothing set — corners still 0.
  for (const [x, y] of [[0, 0], [9, 9], [0, 9], [9, 0]]) assert.equal(fb.peek(x, y), 0)
})

test('framebuffer — circle draws 8-way symmetric', () => {
  const fb = new Framebuffer(20, 20)
  fb.circle(10, 10, 5, 8)
  // Points on the cardinal axes at radius 5 must be set.
  assert.equal(fb.peek(15, 10), 8)
  assert.equal(fb.peek(5, 10), 8)
  assert.equal(fb.peek(10, 15), 8)
  assert.equal(fb.peek(10, 5), 8)
})

test('framebuffer — disc fills the interior', () => {
  const fb = new Framebuffer(20, 20)
  fb.disc(10, 10, 3, 8)
  // Center + a nearby interior point must be set.
  assert.equal(fb.peek(10, 10), 8)
  assert.equal(fb.peek(9, 10), 8)
  assert.equal(fb.peek(10, 11), 8)
  // Points outside radius stay 0.
  assert.equal(fb.peek(14, 14), 0)
})

test('framebuffer — line draws a diagonal', () => {
  const fb = new Framebuffer(10, 10)
  fb.line(0, 0, 9, 9, 8)
  assert.equal(fb.peek(0, 0), 8)
  assert.equal(fb.peek(9, 9), 8)
  assert.equal(fb.peek(5, 5), 8)
})

test('framebuffer — rect draws four sides only', () => {
  const fb = new Framebuffer(10, 10)
  fb.rect(1, 1, 6, 4, 8)
  // Corners
  assert.equal(fb.peek(1, 1), 8)
  assert.equal(fb.peek(6, 1), 8)
  assert.equal(fb.peek(1, 4), 8)
  assert.equal(fb.peek(6, 4), 8)
  // Interior point should NOT be filled.
  assert.equal(fb.peek(3, 2), 0)
})

test('framebuffer — clear wipes to zero', () => {
  const fb = new Framebuffer(10, 10)
  fb.disc(5, 5, 3, 8)
  fb.clear()
  for (let i = 0; i < fb.pixels.length; i++) assert.equal(fb.pixels[i], 0)
})

test('framebuffer — clear(c) wipes to color c', () => {
  const fb = new Framebuffer(6, 6)
  fb.clear(3)
  for (let i = 0; i < fb.pixels.length; i++) assert.equal(fb.pixels[i], 3)
})

test('framebuffer — setColor by index and name', () => {
  const fb = new Framebuffer(10, 10)
  fb.setColor(11)
  assert.equal(fb.color, 11)
  fb.setColor('petal')
  assert.equal(fb.color, 14)
  fb.setColor('white')
  assert.equal(fb.color, 7)
})

test('framebuffer — toObject / fromObject round-trip', () => {
  const fb = new Framebuffer(20, 20)
  fb.disc(10, 10, 5, 8)
  fb.color = 11
  fb.frame = 42
  const snap = fb.toObject()
  const fb2 = Framebuffer.fromObject(snap)
  assert.equal(fb2.w, 20)
  assert.equal(fb2.h, 20)
  assert.equal(fb2.color, 11)
  assert.equal(fb2.frame, 42)
  assert.equal(fb2.peek(10, 10), 8)
})

test('framebuffer — plotSeries handles a numeric series', () => {
  const fb = new Framebuffer(40, 10)
  fb.plotSeries([1, 3, 2, 4, 5, 2, 1], 8)
  // At least one pixel should be set.
  let set = 0
  for (const p of fb.pixels) if (p !== 0) set++
  assert.ok(set > 0)
})

test('framebuffer — resolveMode with preset name', () => {
  assert.deepEqual(resolveMode('pico8'), { w: 128, h: 128 })
  assert.deepEqual(resolveMode('tic80'), { w: 240, h: 136 })
  assert.deepEqual(resolveMode('sakura'), { w: 80, h: 80 })
})

test('framebuffer — resolveMode with w,h', () => {
  assert.deepEqual(resolveMode(64, 48), { w: 64, h: 48 })
})

test('framebuffer — resolveMode rejects unreasonable sizes', () => {
  assert.throws(() => resolveMode(0, 10))
  assert.throws(() => resolveMode(10, 10000))
})

// ── dots adapter (renamed from braille) ────────────────────────────

test('dots — renderFramebuffer returns lines', () => {
  const fb = new Framebuffer(20, 20)
  fb.disc(10, 10, 5, 8)
  const lines = renderDots(fb, { color: false })
  assert.ok(Array.isArray(lines))
  assert.equal(lines.length, Math.ceil(20 / 4))
  // Each line should be Math.ceil(20/2) chars wide.
  for (const l of lines) assert.equal(l.length, Math.ceil(20 / 2))
})

test('dots — empty framebuffer renders all-blank', () => {
  const fb = new Framebuffer(20, 20)
  const lines = renderDots(fb, { color: false })
  const joined = lines.join('')
  // No Braille glyph (U+2800..U+28FF) should appear.
  assert.ok(!/[⠁-⣿]/.test(joined))
})

// ── iterm2 adapter ─────────────────────────────────────────────────

test('iterm2 — renderFramebuffer emits inline image escape', () => {
  const fb = new Framebuffer(16, 16)
  fb.disc(8, 8, 4, 14)
  const s = renderITerm2(fb, { scale: 2 })
  assert.ok(s.startsWith('\x1b]1337;File=inline=1'), 'must start with iTerm2 OSC 1337')
  assert.ok(s.endsWith('\x07'), 'must end with BEL')
})

// ── kitty adapter ──────────────────────────────────────────────────

test('kitty — renderFramebuffer emits APC G escape', () => {
  const fb = new Framebuffer(16, 16)
  fb.disc(8, 8, 4, 14)
  const s = renderKitty(fb, { scale: 2 })
  assert.ok(s.startsWith('\x1b_G'), 'must start with kitty APC G')
  assert.ok(s.includes('\x1b\\'), 'must contain ST terminator')
})

// ── sixel adapter ──────────────────────────────────────────────────

test('sixel — renderFramebuffer emits DCS q sequence', () => {
  const fb = new Framebuffer(12, 12)
  fb.disc(6, 6, 3, 8)
  const s = renderSixel(fb, { scale: 1 })
  assert.ok(s.startsWith('\x1bPq'), 'must start with DCS q')
  assert.ok(s.endsWith('\x1b\\'), 'must end with ST')
})

// ── browser-canvas adapter ─────────────────────────────────────────

test('browser-canvas — writes to a mock ImageData context', () => {
  const fb = new Framebuffer(10, 10)
  fb.disc(5, 5, 3, 14)  // Petal-pink disc.
  const buf = new Uint8ClampedArray(40 * 40 * 4)
  const ctx = {
    canvas: { width: 0, height: 0 },
    createImageData: (w, h) => ({ data: buf, width: w, height: h }),
    putImageData: () => {},
  }
  renderBrowserCanvas(fb, ctx, { scale: 4 })
  assert.equal(ctx.canvas.width, 40)
  assert.equal(ctx.canvas.height, 40)
  // Center pixel should be the petal color (255, 119, 168).
  const centerIdx = (20 * 40 + 20) * 4
  assert.equal(buf[centerIdx], 255)
  assert.equal(buf[centerIdx + 1], 119)
  assert.equal(buf[centerIdx + 2], 168)
})

// ── sound engine ───────────────────────────────────────────────────

test('sound — parsePitch A4 = 440', () => {
  assert.ok(Math.abs(parsePitch('A4') - 440) < 0.001)
})

test('sound — parsePitch handles sharps', () => {
  const cs4 = parsePitch('C#4')
  const cs4alt = parsePitch('Cs4')
  const cs4alt2 = parsePitch('Csharp4')
  assert.ok(Math.abs(cs4 - cs4alt) < 0.001)
  assert.ok(Math.abs(cs4 - cs4alt2) < 0.001)
})

test('sound — parsePitch handles flats', () => {
  const db4 = parsePitch('Db4')
  const db4alt = parsePitch('Dflat4')
  assert.ok(Math.abs(db4 - db4alt) < 0.001)
})

test('sound — parsePitch rejects garbage', () => {
  assert.throws(() => parsePitch('not a pitch'))
})

test('sound — parseDuration whole/half/quarter', () => {
  assert.equal(parseDuration('quarter', 120), 0.5)
  assert.equal(parseDuration('half',    120), 1)
  assert.equal(parseDuration('whole',   120), 2)
  assert.equal(parseDuration('eighth',  120), 0.25)
})

test('sound — BellAdapter is safe on non-TTY', () => {
  const a = new BellAdapter()
  // Should not throw.
  a.play({ kind: 'note', freq: 440, dur: 0.1 })
  a.play({ kind: 'silence', dur: 0.1 })
})

test('sound — WebAudioAdapter refuses to construct without ctx in node', () => {
  assert.throws(() => new WebAudioAdapter(null))
})

test('sound — NodeSpeakerAdapter refuses to construct without ctor', () => {
  assert.throws(() => new NodeSpeakerAdapter(null))
})

// ── full end-to-end via sakura-scheme eval ─────────────────────────

function runEval(expr, extraEnv = {}) {
  const r = spawnSync(SAKURA, ['eval', expr], {
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1', SAKURA_SOUND: 'off', ...extraEnv },
  })
  return { stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim(), status: r.status }
}

test('e2e — circle verb evaluates', () => {
  const r = runEval('(circle 40 40 15)')
  assert.equal(r.status, 0)
  // Prints as tagged list.
  assert.match(r.stdout, /circle/)
})

test('e2e — disc verb evaluates', () => {
  const r = runEval('(disc 40 40 15)')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /disc/)
})

test('e2e — line verb evaluates', () => {
  const r = runEval('(line 0 0 40 40)')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /line/)
})

test('e2e — rect verb evaluates', () => {
  const r = runEval('(rect 5 5 20 15)')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /rect/)
})

test('e2e — set-mode changes dimensions', () => {
  const r = runEval("(begin (set-mode 128 128) (mode-info))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '(128 128)')
})

test('e2e — set-mode preset', () => {
  const r = runEval("(begin (set-mode 'pico8) (mode-info))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '(128 128)')
})

test('e2e — clear then circle then render produces a record', () => {
  const r = runEval("(begin (clear) (circle 40 40 15) (render))")
  assert.equal(r.status, 0)
  // schemeFormat of a plain object is #<object> — enough to prove
  // a value comes back.
  assert.match(r.stdout, /object/)
})

test('e2e — set-color by index', () => {
  const r = runEval("(begin (set-color 8) (get-color))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '8')
})

test('e2e — set-color by name', () => {
  const r = runEval("(begin (set-color 'petal) (get-color))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '14')
})

test('e2e — plot renders a series', () => {
  const r = runEval("(plot '(1 3 2 4 5 2 1))")
  assert.equal(r.status, 0)
  assert.match(r.stdout, /object/)
})

test('e2e — pset / pget round-trip', () => {
  const r = runEval("(begin (pset 5 5 8) (pget 5 5))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '8')
})

test('e2e — tone runs without error', () => {
  const r = runEval("(tone 440 0.05)")
  assert.equal(r.status, 0)
})

test('e2e — note runs without error', () => {
  const r = runEval("(note 'A4 0.05 0.5)")
  assert.equal(r.status, 0)
})

test('e2e — sfx runs without error', () => {
  const r = runEval("(sfx 'pulse 440 0.05)")
  assert.equal(r.status, 0)
})

test('e2e — silence runs without error', () => {
  const r = runEval("(silence 0.05)")
  assert.equal(r.status, 0)
})

test('e2e — music runs without error', () => {
  const r = runEval("(music 'demo)")
  assert.equal(r.status, 0)
})

test('e2e — on-frame registers, tick-frame advances', () => {
  const r = runEval("(begin (on-frame (lambda () 'tick)) (tick-frame) (tick-frame) (frame))")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '2')
})

test('e2e — on-key + fire-key delivers event', () => {
  const r = runEval("(begin (define hits 0) (on-key (lambda (k) (set! hits (+ hits 1)))) (fire-key 'A) (fire-key 'B) hits)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '2')
})

test('e2e — on-mouse + fire-mouse delivers event', () => {
  const r = runEval("(begin (define seen 0) (on-mouse (lambda (x y b) (set! seen x))) (fire-mouse 42 10 0) seen)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '42')
})

test('e2e — sync returns frame counter', () => {
  const r = runEval("(sync)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '0')
})

test('e2e — sleep 0 returns immediately', () => {
  const r = runEval("(sleep 0)")
  assert.equal(r.status, 0)
})

test('e2e — sleep rejects negative', () => {
  const r = runEval("(sleep -1)")
  assert.notEqual(r.status, 0)
})

test('e2e — sleep rejects hangs', () => {
  const r = runEval("(sleep 100)")
  assert.notEqual(r.status, 0)
})

test('e2e — frame-rate defaults to 60', () => {
  const r = runEval("(frame-rate)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '60')
})

test('e2e — set-frame-rate clamps 1..120', () => {
  const r = runEval("(set-frame-rate 240)")
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '120')
})

// ── save-cart / load-cart round-trip ───────────────────────────────

test('e2e — save-cart writes a file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sakura-cart-'))
  try {
    const cartPath = join(dir, 'mygame.sks')
    const r = runEval(`(begin (clear) (disc 40 40 8) (save-cart ${JSON.stringify(cartPath)}))`)
    assert.equal(r.status, 0)
    // saved path echoes back
    assert.match(r.stdout, /\.sks/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('e2e — load-cart restores a snapshot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sakura-cart-'))
  try {
    const cartPath = join(dir, 'demo.sks')
    // Save
    let r = runEval(`(begin (clear) (disc 20 20 4) (save-cart ${JSON.stringify(cartPath)}))`)
    assert.equal(r.status, 0)
    // In a NEW process, load the cart and pget the center pixel.
    r = runEval(`(begin (load-cart ${JSON.stringify(cartPath)}) (pget 20 20))`)
    assert.equal(r.status, 0)
    // Petal color 14 is the default draw color.
    assert.equal(r.stdout, '14')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
