// animation.js — the shared animation loop.
//
// One loop, many callbacks. When the user calls `(on-frame handler)` we
// push into a callback list; when a key/mouse/gamepad event fires we
// dispatch to the appropriate list. The framebuffer's `frame` counter
// increments once per tick.
//
// The loop uses `setInterval` at 60Hz by default. In tests we stop
// after a fixed number of ticks (see `runFor()`).

import { apply } from './interp.js'
import { Sym } from './reader.js'

class AnimationLoop {
  constructor(fb) {
    this.fb = fb
    this.fps = 60
    this.running = false
    this.handle = null
    // Reference to media state's events. Set by attachEvents.
    this._events = null
    // Fuel budget cell — the media verbs get their fuel from the base
    // env's fuel object; the loop replenishes fuel each frame so long-
    // running games don't exhaust the fuel counter.
    this._fuel = null
  }

  attachFramebuffer(fb) { this.fb = fb }
  attachEvents(events)  { this._events = events }
  attachFuel(fuel)      { this._fuel = fuel }

  ensureRunning() {
    if (this.running) return
    this.running = true
    // If we don't have fuel we can't call handlers safely. Defer
    // starting until the first frame handler runs.
    const interval = Math.max(1, Math.floor(1000 / this.fps))
    // Node's setInterval isn't perfectly accurate at high FPS, but at
    // 60Hz it's within a couple ms — plenty for animation.
    this.handle = setInterval(() => this.tick(), interval)
    // Unref so tests/REPL can exit without an explicit stop().
    if (this.handle && typeof this.handle.unref === 'function') this.handle.unref()
  }

  stop() {
    if (this.handle) clearInterval(this.handle)
    this.handle = null
    this.running = false
  }

  tick() {
    if (!this._events || !this.fb) return
    this.fb.frame++
    // Replenish fuel each frame so a game can run indefinitely.
    if (this._fuel) this._fuel.n = 200000
    for (const fn of this._events.frame) {
      try {
        // Call with zero args — reference semantics for on-frame.
        callHandler(fn, [], this._fuel)
      } catch (e) {
        // Stop the loop on unhandled error so the REPL surfaces it.
        // eslint-disable-next-line no-console
        console.error('on-frame handler error:', e && e.message ? e.message : e)
        this.stop()
        return
      }
    }
  }

  // Manually advance the loop N frames — useful in tests when we don't
  // want to wait for a real setInterval to fire.
  runFor(nFrames) {
    for (let i = 0; i < nFrames; i++) this.tick()
  }

  // Fire a key event through the registered handlers.
  fireKey(name) {
    if (!this._events) return
    const sym = typeof name === 'string' ? new Sym(name) : name
    for (const fn of this._events.key) {
      try { callHandler(fn, [sym], this._fuel) } catch { /* soft-fail */ }
    }
  }

  fireMouse(x, y, button) {
    if (!this._events) return
    for (const fn of this._events.mouse) {
      try { callHandler(fn, [x, y, button ?? 0], this._fuel) } catch { /* soft-fail */ }
    }
  }

  fireGamepad(pad, button, pressed) {
    if (!this._events) return
    for (const fn of this._events.gamepad) {
      try { callHandler(fn, [pad, button, !!pressed], this._fuel) } catch { /* soft-fail */ }
    }
  }
}

function callHandler(fn, args, fuel) {
  if (typeof fn === 'function') return fn(...args)
  // Closure — go through interp's apply so fuel accounting works.
  if (fn && fn.params) return apply(fn, args, fuel || { n: 200000 })
  throw new Error('handler is not callable')
}

// ── singleton ──────────────────────────────────────────────────────

let _loop = null
export function getAnimationLoop(fb) {
  if (!_loop) _loop = new AnimationLoop(fb)
  else if (fb) _loop.attachFramebuffer(fb)
  return _loop
}
