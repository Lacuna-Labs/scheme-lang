// media.js — L1 MEDIA verbs registered on the base env.
//
// This module owns the SHARED runtime framebuffer + shared audio timeline
// + shared animation loop. Every media verb (circle, disc, line, rect,
// plot, clear, render, tone, note, on-frame, …) reads or writes this
// shared state.
//
// The shape:
//
//   getMediaState()  → the singleton { fb, audio, loop, events }
//   registerMedia(env, fuel) → attach verbs to the base env
//
// Verbs stay pure w/r/t their arguments — they mutate ONLY the media
// singleton, never each other's data. That's what lets `on-frame` and
// `render` compose cleanly.
//
// Two flavors of verbs live here:
//
//   A) DRAW verbs (`clear`, `circle`, `disc`, `line`, `rect`, `plot`).
//      These mutate the framebuffer and RETURN a tagged list of the
//      shape they drew — so `(circle 40 40 15)` at the REPL still
//      "prints as a picture" via richDisplay.js's tagged-list detection,
//      AND writes into the shared framebuffer so subsequent `(render)`
//      calls include it. Best of both worlds.
//
//   B) LIFECYCLE verbs (`set-mode`, `render`, `frame`, `on-frame`, …).
//      These affect the runtime, not one shape. They return sensible
//      Scheme values (undefined, integers, symbols).

import {
  Framebuffer,
  DEFAULT_PALETTE,
  MODES,
  resolveMode,
} from './framebuffer.js'
import { Sym } from './reader.js'
import { getSoundEngine } from './sound.js'
import { getAnimationLoop } from './animation.js'

// ── singleton state ─────────────────────────────────────────────────

let _state = null

export function getMediaState() {
  if (!_state) _state = createMediaState()
  return _state
}

// Test-only reset. Real programs never call this — the state is a
// process-wide singleton and animations run continuously.
export function resetMediaState() {
  if (_state) {
    _state.loop.stop()
    _state.audio.stop()
  }
  _state = null
}

function createMediaState() {
  const fb = new Framebuffer(80, 80)
  const audio = getSoundEngine()
  const loop = getAnimationLoop(fb)
  // Handler registry — animation.js pushes into these when the user
  // calls (on-frame …), (on-key …), etc.
  const events = {
    frame:   [],
    key:     [],
    mouse:   [],
    gamepad: [],
  }
  loop.attachEvents(events)
  return { fb, audio, loop, events }
}

// ── helper: coerce a name (string OR Scheme Sym) ────────────────────

function nameOf(v) {
  if (typeof v === 'string') return v
  if (v instanceof Sym) return v.name
  return null
}

// ── verb registration ───────────────────────────────────────────────

export function registerMedia(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Give the animation loop access to the fuel cell so per-frame
  // handlers reset fuel each tick.
  const st0 = getMediaState()
  st0.loop.attachFuel(fuel)

  // ── mode + palette ──────────────────────────────────────────────

  // (set-mode w h) or (set-mode 'pico8). Reallocates the framebuffer.
  def('set-mode', (a, b) => {
    const st = getMediaState()
    const { w, h } = resolveMode(nameOf(a) ?? a, b)
    const palette = st.fb.palette   // preserve palette across mode change
    const color   = st.fb.color
    st.fb = new Framebuffer(w, h, palette)
    st.fb.color = color
    st.loop.attachFramebuffer(st.fb)
    return [w, h]
  })

  // (set-color c) — c is an integer index 0..15 or a color name symbol.
  def('set-color', (c) => {
    const st = getMediaState()
    return st.fb.setColor(nameOf(c) ?? c)
  })

  // (get-color) — read current draw color.
  def('get-color', () => getMediaState().fb.color)

  // (mode-info) — return current mode as (w h) list.
  def('mode-info', () => {
    const fb = getMediaState().fb
    return [fb.w, fb.h]
  })

  // ── drawing ─────────────────────────────────────────────────────

  // (clear) or (clear c). Wipes the framebuffer to color 0 (or c).
  def('clear', (c) => {
    const st = getMediaState()
    st.fb.clear(c === undefined ? 0 : (c | 0))
    // Return sym so the REPL's richDisplay prints it as ';; ()' rather
    // than an accidental graphic.
    return undefined
  })

  // (circle cx cy r) → tagged list, also drawn into the framebuffer.
  def('circle', (cx, cy, r) => {
    const st = getMediaState()
    st.fb.circle(+cx, +cy, +r)
    return [new Sym('circle'), +cx, +cy, +r]
  })

  // (disc cx cy r) → tagged list, also drawn.
  def('disc', (cx, cy, r) => {
    const st = getMediaState()
    st.fb.disc(+cx, +cy, +r)
    return [new Sym('disc'), +cx, +cy, +r]
  })

  // (line x0 y0 x1 y1) → tagged list, also drawn.
  def('line', (x0, y0, x1, y1) => {
    const st = getMediaState()
    st.fb.line(+x0, +y0, +x1, +y1)
    return [new Sym('line'), +x0, +y0, +x1, +y1]
  })

  // (rect x y w h) → tagged list, also drawn.
  def('rect', (x, y, w, h) => {
    const st = getMediaState()
    st.fb.rect(+x, +y, +w, +h)
    return [new Sym('rect'), +x, +y, +w, +h]
  })

  // (rect-fill x y w h) — filled variant.
  def('rect-fill', (x, y, w, h) => {
    const st = getMediaState()
    st.fb.rectFill(+x, +y, +w, +h)
    return [new Sym('rect-fill'), +x, +y, +w, +h]
  })

  // (plot data) → a plot record. Also rasterizes into the framebuffer.
  def('plot', (data) => {
    const st = getMediaState()
    st.fb.plotSeries(data)
    return { kind: 'plot', data: Array.isArray(data) ? data.slice() : [] }
  })

  // (pset x y c) — single-pixel poke.
  def('pset', (x, y, c) => {
    getMediaState().fb.plot(+x, +y, c === undefined ? undefined : (c | 0))
    return undefined
  })

  // (flower/paint n col row [spin sx sy dy petals]) — paint a flower sprite.
  //
  // Real rasterization into the framebuffer via Framebuffer.paintFlower.
  // Sprite index n picks one of 4 canned shapes (dot-cluster / daisy /
  // hex / tulip-ish). Optional spin, X/Y scale, vertical offset, and
  // petal color list follow the reference signature.
  //
  // Returns undefined per reference §flower/paint (:signature ... -> null).
  def('flower/paint', (n, col, row, spin, sx, sy, dy, petals) => {
    getMediaState().fb.paintFlower(n, col, row, spin, sx, sy, dy, petals)
    return undefined
  }, 'animate')

  // (pget x y) — read a pixel's palette index.
  def('pget', (x, y) => getMediaState().fb.peek(+x, +y))

  // (frame ...) has two contract shapes in the reference:
  //   (frame)                         → integer, current frame counter
  //   (frame w h shape ...)           → a "composite frame" record
  //
  // We support both. Zero args returns the counter; more args returns
  // a composite record the display can render as one image.
  def('frame', (...args) => {
    const st = getMediaState()
    if (args.length === 0) return st.fb.frame
    // With args: treat the first two as width/height if they're numbers,
    // and the remaining as tagged-list shapes composed together.
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      const [w, h, ...shapes] = args
      return { kind: 'graphic', w, h, shapes }
    }
    // Otherwise every arg is a shape — bundle them.
    return { kind: 'graphic', shapes: args }
  })

  // (render) — force the current framebuffer to display via the routed
  // adapter and return a tagged-list snapshot. Also returns a plain
  // record so `,image` and richDisplay pick it up.
  def('render', () => {
    const fb = getMediaState().fb
    return { kind: 'framebuffer', w: fb.w, h: fb.h, palette: fb.palette.map(c => c.slice()), pixels: Array.from(fb.pixels) }
  })

  // (fb-snapshot) — same as render, alias kept for symmetry with
  // (fb-restore).
  def('fb-snapshot', () => {
    const fb = getMediaState().fb
    return fb.toObject()
  })

  // (fb-restore snap) — load a snapshot back into the buffer.
  def('fb-restore', (snap) => {
    const st = getMediaState()
    if (!snap || typeof snap !== 'object') throw new Error('fb-restore: bad snapshot')
    st.fb = Framebuffer.fromObject(snap)
    st.loop.attachFramebuffer(st.fb)
    return undefined
  })

  // Convert a note name like "A4", "C#5", "Bb3" to a MIDI number.
  // Returns NaN for unrecognizable input; callers should feature-test.
  function nameToMidi(name) {
    if (!name || typeof name !== 'string') return NaN
    const m = name.match(/^([A-Ga-g])([#b])?(-?\d+)$/)
    if (!m) return NaN
    const letter = m[1].toUpperCase()
    const accidental = m[2] || ''
    const octave = parseInt(m[3], 10)
    const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (semis === undefined) return NaN
    const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    return (octave + 1) * 12 + semis + delta
  }

  // ── SOUND ────────────────────────────────────────────────────────
  //
  // Verbs delegate to two backends:
  //   1. The in-process SoundEngine — records the note-on for the media
  //      state (for web IDE + tests that observe scheduled sounds).
  //   2. The system audio driver — actually makes noise via afplay/aplay/
  //      powershell. Fire-and-forget so the REPL stays responsive.

  // (tone freq dur) — a sine wave at freq Hz for dur seconds. Plays.
  def('tone', (freq, dur) => {
    const f = +freq
    const d = dur === undefined ? 0.25 : +dur
    // Fire the real audio driver in the background.
    import('./audio-driver.js').then(m => m.playTone(f, d)).catch(() => {})
    return getMediaState().audio.tone(f, d)
  })

  // (note pitch [dur] [velocity]) — pitch is a symbol like 'A4 or 'C#4
  // or an integer MIDI number. Plays through the system audio driver.
  def('note', (pitch, dur, vel) => {
    const st = getMediaState()
    const p = nameOf(pitch) ?? String(pitch)
    const d = dur === undefined ? 0.25 : +dur
    const v = vel === undefined ? 0.8 : +vel
    const midi = typeof pitch === 'number' ? pitch : nameToMidi(p)
    // Fire the driver — a MIDI number is enough. Fire-and-forget.
    if (Number.isFinite(midi)) {
      import('./audio-driver.js').then(m => m.playNote(midi, d, v)).catch(() => {})
    }
    // Delegate to in-process engine for the media-state record. Numeric
    // pitches don't parse there today; skip the engine call in that case
    // rather than throw. The driver already played.
    if (typeof pitch === 'number') return undefined
    return st.audio.note(p, d, v)
  })

  // (chord notes [dur] [velocity]) — mix up to 16 voices into one WAV and
  // play them as a single sample-accurate sound. `notes` is a list of MIDI
  // numbers OR note-name symbols. Beats firing N (note ...) calls in a
  // row (each has 30-50ms process-spawn latency; mixed chord attacks
  // together, drift-free).
  def('chord', (notes, dur, vel) => {
    const d = dur === undefined ? 0.4 : +dur
    const v = vel === undefined ? 0.5 : +vel
    const listArr = Array.isArray(notes) ? notes : []
    const midis = listArr
      .map(x => typeof x === 'number' ? x : nameToMidi(nameOf(x) ?? String(x)))
      .filter(m => Number.isFinite(m))
    if (midis.length === 0) return undefined
    import('./audio-driver.js').then(m => m.playChord(midis, d, v)).catch(() => {})
    return undefined
  })

  // (melody notes [dur] [velocity]) — a sequence of notes played back to
  // back at the given per-note duration. `notes` is a list of MIDI numbers
  // OR note-name symbols. Mixed into one WAV for smooth playback.
  def('melody', (notes, dur, vel) => {
    const d = dur === undefined ? 0.2 : +dur
    const v = vel === undefined ? 0.5 : +vel
    const listArr = Array.isArray(notes) ? notes : []
    const midis = listArr
      .map(x => typeof x === 'number' ? x : nameToMidi(nameOf(x) ?? String(x)))
      .filter(m => Number.isFinite(m))
    if (midis.length === 0) return undefined
    import('./audio-driver.js').then(m => m.playSequence(midis, d, v)).catch(() => {})
    return undefined
  })

  // (sfx kind freq dur . opts) — a synthesized sound effect.
  def('sfx', (kind, freq, dur, ...opts) => {
    const st = getMediaState()
    const k = nameOf(kind) ?? 'pulse'
    // opts arrive as flat (:key val :key val ...) pairs. Bundle them.
    const spec = { attack: 0.01, decay: 0, sustain: 1, release: 0.05 }
    for (let i = 0; i < opts.length - 1; i += 2) {
      const key = nameOf(opts[i])
      if (key) spec[key.replace(/^:/, '')] = opts[i + 1]
    }
    return st.audio.sfx(k, +freq, dur === undefined ? 0.25 : +dur, spec)
  })

  // (music track) — schedule a named track. Empty string = silence.
  def('music', (track) => {
    return getMediaState().audio.music(nameOf(track) ?? String(track ?? ''))
  })

  // (silence dur) — reserve dur seconds of quiet on the timeline.
  def('silence', (dur) => {
    return getMediaState().audio.silence(dur === undefined ? 0.25 : +dur)
  })

  // (stop-sound) — cancel any scheduled audio.
  def('stop-sound', () => {
    getMediaState().audio.stop()
    return undefined
  })

  // ── ANIMATION + INPUT ───────────────────────────────────────────

  // (on-frame handler) — install a frame handler. Handler is called
  // with the current frame number.
  //
  // Reference (SAKURA-SCHEME-REFERENCE.slat, on-frame): "Single callback;
  // no chaining or multiple listeners." So we REPLACE the handler on
  // each call — later calls override earlier ones — matching the
  // documented shape. Users who want multiplex can compose in Scheme.
  def('on-frame', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-frame: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.frame = [fn]
    st.loop.ensureRunning()
    return undefined
  })

  // (on-key handler) — handler receives the key name (a symbol).
  // Single-slot per the reference; later calls override earlier ones.
  def('on-key', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-key: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.key = [fn]
    return undefined
  })

  // (on-mouse handler) — handler receives (x y button).
  def('on-mouse', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-mouse: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.mouse = [fn]
    return undefined
  })

  // (on-gamepad handler) — handler receives (pad-index button pressed?).
  def('on-gamepad', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-gamepad: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.gamepad = [fn]
    return undefined
  })

  // (sync) — explicit yield. In Node it's a microtask; in the browser
  // it's a raf.
  def('sync', () => {
    // The interpreter is synchronous; sync just returns the frame
    // number, giving the caller a chance to snapshot state.
    return getMediaState().fb.frame
  })

  // (sleep sec) — busy-wait for at most `sec` seconds. In a real
  // animation loop this is short (<0.1s); longer values throw so we
  // don't hang a REPL by accident.
  def('sleep', (sec) => {
    const seconds = +sec
    if (!(seconds >= 0)) throw new Error('sleep: expected non-negative seconds')
    if (seconds > 5) throw new Error('sleep: refusing to hang more than 5s')
    const start = Date.now()
    const target = start + seconds * 1000
    // Deliberately spin — this is the terminal REPL, and busy-loop is
    // fine at short durations. Browser and animation loops use rAF.
    while (Date.now() < target) { /* spin */ }
    return undefined
  })

  // (frame-rate) — return the target frame rate the loop is running at.
  def('frame-rate', () => getMediaState().loop.fps)

  // (set-frame-rate n) — change the target FPS (1..120).
  def('set-frame-rate', (n) => {
    const st = getMediaState()
    st.loop.fps = Math.max(1, Math.min(120, n | 0))
    return st.loop.fps
  })

  // (stop) — halt the animation loop.
  def('stop', () => {
    getMediaState().loop.stop()
    return undefined
  })

  // (tick-frame) — manually advance the animation loop by one frame.
  // Useful in scripts and tests where you want a deterministic
  // step-by-step run instead of the wall-clock setInterval.
  def('tick-frame', () => {
    const st = getMediaState()
    st.loop.tick()
    return st.fb.frame
  })

  // (fire-key name) — synthesize a key event. Wraps on-key handlers.
  def('fire-key', (name) => {
    getMediaState().loop.fireKey(nameOf(name) ?? String(name))
    return undefined
  })

  // (fire-mouse x y button) — synthesize a mouse event.
  def('fire-mouse', (x, y, button) => {
    getMediaState().loop.fireMouse(+x, +y, button === undefined ? 0 : (button | 0))
    return undefined
  })

  // (fire-gamepad pad button pressed?) — synthesize a gamepad event.
  def('fire-gamepad', (pad, button, pressed) => {
    getMediaState().loop.fireGamepad(pad | 0, button | 0, !!pressed)
    return undefined
  })

  // ── SAVE / LOAD CART ────────────────────────────────────────────

  // (save-cart path) — bundle the current framebuffer + audio state +
  // source code (from the REPL's history) into a .sks-shaped file.
  def('save-cart', (path) => {
    const st = getMediaState()
    const cart = {
      version: 1,
      created: new Date().toISOString(),
      framebuffer: st.fb.toObject(),
      audio: st.audio.snapshot(),
    }
    const p = String(path)
    // Emit as a SLAT record — same reader as the language uses.
    const slat = cartToSlat(cart)
    const fs = tryLoadFs()
    if (!fs) throw new Error('save-cart: filesystem not available in this environment')
    fs.writeFileSync(p, slat, 'utf-8')
    return p
  })

  // (load-cart path) — restore state from a .sks cart.
  def('load-cart', (path) => {
    const p = String(path)
    const fs = tryLoadFs()
    if (!fs) throw new Error('load-cart: filesystem not available in this environment')
    const raw = fs.readFileSync(p, 'utf-8')
    const cart = slatToCart(raw)
    const st = getMediaState()
    st.fb = Framebuffer.fromObject(cart.framebuffer)
    st.loop.attachFramebuffer(st.fb)
    st.audio.restore(cart.audio || {})
    return p
  })
}

// ── cart serialization ──────────────────────────────────────────────

// Cart serialization uses a simple prose-header + JSON-blob shape.
// Human-readable at the top; strict JSON for the state so we can
// round-trip losslessly without fighting a hand-rolled parser.
//
//   ; sakura scheme cart snapshot
//   ; created 2026-...
//   #!json-blob
//   { ... }
function cartToSlat(cart) {
  const header = [
    '; sakura scheme cart snapshot',
    `; created ${cart.created}`,
    `; version ${cart.version}`,
    '#!json-blob',
  ].join('\n')
  return header + '\n' + JSON.stringify(cart, null, 0) + '\n'
}

function slatToCart(raw) {
  const marker = raw.indexOf('#!json-blob')
  if (marker < 0) throw new Error('load-cart: not a recognized snapshot (missing #!json-blob)')
  // Everything after the marker's newline is the JSON blob.
  const nl = raw.indexOf('\n', marker)
  if (nl < 0) throw new Error('load-cart: truncated snapshot')
  const jsonPart = raw.slice(nl + 1).trim()
  let cart
  try { cart = JSON.parse(jsonPart) }
  catch (e) { throw new Error('load-cart: invalid JSON payload: ' + e.message) }
  if (!cart.framebuffer || !Array.isArray(cart.framebuffer.pixels)) {
    throw new Error('load-cart: cart missing framebuffer')
  }
  return cart
}

// Filesystem access — Node only. In the browser build, the `import`
// line below gets stripped by build.mjs; the runtime skips fs and
// save-cart/load-cart error cleanly at call time.
import * as _nodeFs from 'node:fs'
function tryLoadFs() {
  // eslint-disable-next-line no-undef
  try { return typeof _nodeFs !== 'undefined' ? _nodeFs : null } catch { return null }
}
