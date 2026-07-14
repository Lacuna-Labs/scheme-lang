// game.js — Layer 3 (L3): the fantasy-console game kit.
//
// Small, standalone, no external deps. Ships with the base engine so a
// script that says (sprite 'ball 40 40) or (entity/make 'hero 10 10)
// just works out of the box.
//
// What's here:
//   · Simple entity system   — id → { x, y, vx, vy, w, h, tags }
//   · AABB collision         — rectangle-vs-rectangle overlap test
//   · Basic verlet physics   — gravity + friction + integration
//   · Sprite specs           — plain data pushed onto an accumulator
//   · Tile maps              — 2D grid of characters/numbers
//
// Adapter pattern:
//   The `game` object passed in acts as a seam. Curator's fancier engine
//   (HelloSurface, with real rendering + physics) can pass its own game
//   object with the same shape and swap the impl. Standalone REPL uses
//   the default one below.
//
// Kid-readable comment: this is the "moving things around" part of the
// language — where balls bounce, characters walk, and rectangles bump
// into each other.

import { Sym, sym } from './reader.js'
import { getMediaState } from './media.js'

// Turn a Sym into a plain string; passthrough otherwise. Handy for
// (entity/make 'ball ...) where 'ball arrives as a Sym.
const nm = (x) => (x instanceof Sym ? x.name : x)

// ── default game state ────────────────────────────────────────────────
//
// The controller — the runtime object that holds live game state across
// frames. Standalone REPL constructs one at startup; adapter callers
// pass in their own (Curator does).
export function makeGameState() {
  return {
    // Sprite specs pushed by (sprite …). Consumed by the renderer each
    // frame. Plain data; no side effects on push.
    sprites: [],
    // Entities are the moving/colliding things. Keyed by id (string
    // name from a Sym). Each entity has { x, y, vx, vy, w, h, tags }.
    entities: new Map(),
    // Gravity + friction — tuneable via (physics/gravity!) etc.
    gravity: 0.5,
    friction: 0.98,
    // Frame counter + stop signal. Real loop drivers own these; the
    // standalone REPL just reads them.
    frameNo: 0,
    stopped: false,
    // Tile map — 2D array; null when no map is set. See tilemap/set!.
    tilemap: null,
    tileW: 16,
    tileH: 16,
  }
}

// ── AABB collision ─────────────────────────────────────────────────────
//
// The workhorse. Two rectangles overlap when they overlap on BOTH axes.
// Strict — touching edges don't count as overlap (a.x + a.w === b.x is
// a "touch," not a "collision"). Matches the language's built-in
// `overlap?` predicate already in base.js.
export function aabbOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1
}

// ── verlet physics step ────────────────────────────────────────────────
//
// One integration step per entity. Position += velocity, velocity *=
// friction, velocity.y += gravity. Simple, stable, PICO-8-shaped. No
// forces — impulses only. Callers use (entity/move …) or set vx/vy
// directly.
function integrateVerlet(entity, game) {
  entity.vy += game.gravity
  entity.vx *= game.friction
  entity.vy *= game.friction
  entity.x += entity.vx
  entity.y += entity.vy
}

// ── install game verbs into a Scheme env ───────────────────────────────
//
// The Scheme side sees only verbs; the JS side owns the mutable game
// state. Curator overrides by passing its own `game` object (same shape).
export function installGame(env, game) {
  // Small helper — set perm on every def. Most game verbs are
  // state-change (they mutate the entity table or the sprite accumulator).
  const def = (n, f, perm = 'state-change') => env.define(n, f, { perm })

  // ── sprites ─────────────────────────────────────────────────────────
  //
  // (sprite name x y [color]) — push a sprite spec onto the accumulator.
  // A sprite is just data: the renderer decides how to paint it. Kids
  // can read this: "put a ball at 40 40."
  def('sprite', (name, x, y, color = 'blossom') => {
    game.sprites.push({
      type: 'sprite',
      name: String(nm(name)),
      x: Number(x) || 0,
      y: Number(y) || 0,
      color: String(nm(color)),
    })
    return undefined
  }, 'paint')

  // (sprites) — return the current sprite list (for tests + inspection).
  def('sprites', () => game.sprites.slice(), 'read')

  // (sprites/clear) — wipe the accumulator. Called each frame by the
  // driver before re-emitting sprites.
  def('sprites/clear', () => { game.sprites.length = 0; return undefined })

  // ── entities ────────────────────────────────────────────────────────
  //
  // The entity system is a simple id → data map. IDs are strings (from
  // Syms). Every entity has position, velocity, size, and tags.

  // (entity/make id x y [w h]) — create an entity. Returns the id (so a
  // caller can chain calls that need it).
  def('entity/make', (id, x, y, w = 16, h = 16) => {
    const key = String(nm(id))
    game.entities.set(key, {
      id: key,
      x: Number(x) || 0,
      y: Number(y) || 0,
      vx: 0,
      vy: 0,
      w: Number(w) || 16,
      h: Number(h) || 16,
      tags: [],
      // Static entities are excluded from physics — walls, floors,
      // platforms. Set with (entity/pin! id).
      static: false,
    })
    return key
  })

  // (entity/pin! id) — mark an entity as static: physics skips it.
  // Perfect for floors, walls, and any level geometry that shouldn't
  // move under gravity.
  def('entity/pin!', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.static = true
    e.vx = 0
    e.vy = 0
    return true
  })

  // (entity/unpin! id) — reverse of pin!. Physics acts on it again.
  def('entity/unpin!', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.static = false
    return true
  })

  // (entity/static? id) — is this entity pinned?
  def('entity/static?', (id) => {
    const e = game.entities.get(String(nm(id)))
    return !!(e && e.static)
  }, 'read')

  // (entity/state id) — read the entity's current physics state. Returns
  // a plain list for Scheme: (id x y vx vy w h). Nil when the id is
  // unknown. Renamed from entity/get per decision-017 (name collided
  // with the scratch-map accessor documented in the reference).
  def('entity/state', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    return [e.id, e.x, e.y, e.vx, e.vy, e.w, e.h]
  }, 'read')

  // (entity/ref id key) — read a per-entity scratch value by key.
  // Returns the special symbol 'nan when the key does not exist.
  // Companion accessor to entity/set!; mirrors hash-ref shape.
  // Decision-017: replaces the ambiguous entity/get name.
  const NAN_SYM = sym('nan')
  def('entity/ref', (id, key) => {
    const e = game.entities.get(String(nm(id)))
    if (!e || !e.scratch) return NAN_SYM
    const k = String(nm(key))
    return e.scratch.has(k) ? e.scratch.get(k) : NAN_SYM
  }, 'read')

  // (entity/set! id key val) — write a per-entity scratch value.
  // Returns val. Mirrors hash-set! shape.
  // Decision-017: replaces entity/get-set! (dual-verb name).
  def('entity/set!', (id, key, val) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return val
    if (!e.scratch) e.scratch = new Map()
    const k = typeof key === 'object' && key && key.__sym ? key.__sym : String(nm(key))
    e.scratch.set(k, val)
    return val
  })

  // (entity/move id dx dy) — nudge the entity's position directly. Bypasses
  // physics; useful for direct control (a keyboard-driven hero).
  def('entity/move', (id, dx, dy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.x += Number(dx) || 0
    e.y += Number(dy) || 0
    return true
  })

  // (entity/set-velocity! id vx vy) — set the velocity for physics-driven
  // motion. Gravity + friction will act on it next frame.
  def('entity/set-velocity!', (id, vx, vy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.vx = Number(vx) || 0
    e.vy = Number(vy) || 0
    return true
  })

  // (entity/turn id angle) — rotate the entity's velocity vector by angle
  // degrees. Sprite turns to match. Speed stays the same.
  def('entity/turn', (id, angle) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    const rad = (Number(angle) || 0) * Math.PI / 180
    const cs = Math.cos(rad)
    const sn = Math.sin(rad)
    const nvx = e.vx * cs - e.vy * sn
    const nvy = e.vx * sn + e.vy * cs
    e.vx = nvx
    e.vy = nvy
    return true
  })

  // (entity/tag! id tag) — add a tag to an entity. Tags are for grouping
  // (e.g. tag every enemy 'enemy, then collide them as a group).
  def('entity/tag!', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    const t = String(nm(tag))
    if (!e.tags.includes(t)) e.tags.push(t)
    return true
  })

  // (entity/has-tag? id tag) — predicate.
  def('entity/has-tag?', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    return e.tags.includes(String(nm(tag)))
  }, 'read')

  // (entity/all) — the full entity list, as a list of ids. Read-only.
  def('entity/all', () => Array.from(game.entities.keys()), 'read')

  // (entity/remove! id) — take it off the map.
  def('entity/remove!', (id) => {
    return game.entities.delete(String(nm(id)))
  })

  // (entity/count) — how many entities exist.
  def('entity/count', () => game.entities.size, 'read')

  // ── collision ───────────────────────────────────────────────────────
  //
  // The engine-side collision uses the entity table; the pure predicate
  // `overlap?` (already in base.js) works on raw rectangles too.

  // (entity/collides? a b) — do these two entities overlap right now?
  def('entity/collides?', (aId, bId) => {
    const a = game.entities.get(String(nm(aId)))
    const b = game.entities.get(String(nm(bId)))
    if (!a || !b) return false
    return aabbOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)
  }, 'read')

  // (entity/hits-tag id tag) — return the list of entity ids that share
  // `tag` AND overlap with `id`. Handy for "did the hero touch any coin?"
  def('entity/hits-tag', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return []
    const t = String(nm(tag))
    const hits = []
    for (const [k, other] of game.entities) {
      if (k === e.id) continue
      if (!other.tags.includes(t)) continue
      if (aabbOverlap(e.x, e.y, e.w, e.h, other.x, other.y, other.w, other.h)) {
        hits.push(k)
      }
    }
    return hits
  }, 'read')

  // ── physics ─────────────────────────────────────────────────────────

  // (physics/step) — advance every non-static entity one frame. Gravity
  // + friction + integration. Called each frame by the driver.
  // Static entities (walls, floors, pinned platforms) are skipped.
  def('physics/step', () => {
    for (const e of game.entities.values()) {
      if (!e.static) integrateVerlet(e, game)
    }
    game.frameNo += 1
    return undefined
  })

  // (physics/gravity! g) — set the gravity constant. Zero = space.
  def('physics/gravity!', (g) => { game.gravity = Number(g) || 0; return undefined })

  // (physics/friction! f) — friction is a multiplier on velocity each
  // frame. 1.0 = no friction, 0.98 = slow decay, 0.0 = instant stop.
  def('physics/friction!', (f) => {
    const v = Number(f)
    game.friction = (Number.isFinite(v) ? v : 0.98)
    return undefined
  })

  // (physics/gravity) — read the current gravity value.
  def('physics/gravity', () => game.gravity, 'read')

  // (physics/friction) — read the current friction value.
  def('physics/friction', () => game.friction, 'read')

  // ── tile maps ───────────────────────────────────────────────────────
  //
  // A tile map is a 2D array of tile-ids (numbers or symbols). Used for
  // walls, floors, background terrain. The renderer paints each tile in
  // its cell; game logic queries tiles for collision with entities.

  // (tilemap/set! rows) — install a tile map from a list of lists.
  //   (tilemap/set! '((0 0 0) (0 1 0) (0 0 0)))
  def('tilemap/set!', (rows) => {
    if (!Array.isArray(rows)) return false
    // Copy to a plain 2D array we own.
    game.tilemap = rows.map((r) => Array.isArray(r) ? r.slice() : [])
    return true
  })

  // (tilemap/get x y) — read the tile at column x, row y. Nil if
  // out-of-bounds or no map.
  def('tilemap/get', (x, y) => {
    if (!game.tilemap) return undefined
    const row = game.tilemap[y | 0]
    if (!row) return undefined
    return row[x | 0]
  }, 'read')

  // (tilemap/put! x y tile) — write a tile at (x, y).
  def('tilemap/put!', (x, y, tile) => {
    if (!game.tilemap) return false
    const row = game.tilemap[y | 0]
    if (!row) return false
    row[x | 0] = nm(tile)
    return true
  })

  // (tilemap/rows) / (tilemap/cols) — dimensions. Zero when no map.
  def('tilemap/rows', () => (game.tilemap ? game.tilemap.length : 0), 'read')
  def('tilemap/cols', () => (game.tilemap && game.tilemap[0] ? game.tilemap[0].length : 0), 'read')

  // (tilemap/tile-size! w h) — set the size of each tile in pixels. The
  // renderer uses this to place tiles on the framebuffer.
  def('tilemap/tile-size!', (w, h) => {
    game.tileW = Number(w) || 16
    game.tileH = Number(h) || 16
    return undefined
  })

  // (tilemap/tile-at-pixel px py) — reverse lookup: which tile lives at
  // this pixel? Useful for "did the ball hit a wall?" collision.
  def('tilemap/tile-at-pixel', (px, py) => {
    if (!game.tilemap) return undefined
    const tx = Math.floor(px / game.tileW)
    const ty = Math.floor(py / game.tileH)
    return env.get('tilemap/get')(tx, ty)
  }, 'read')

  // ── frame loop ──────────────────────────────────────────────────────
  //
  // Same shape as Curator's gameKit. The on-frame handler gets called
  // once per tick by the driver. (frame) reads the current tick number.
  //
  // L1 MEDIA (media.js) already registers on-frame + frame + stop. We
  // rebind them here to ALSO keep the legacy game.js single-handler
  // slot in sync — Curator's driver still reads game.onFrame + game
  // .frameNo, so we bridge those two worlds instead of picking one.
  const media = getMediaState()
  def('on-frame', (fn) => {
    // Old: assign to game.onFrame. Preserve so Curator's tickFrame
    // routine (which pulls game.onFrame) keeps working.
    game.onFrame = fn
    // New: also install into the L1 media loop's handler slot so the
    // scheme-lang animation loop invokes it on setInterval ticks.
    // Single-slot semantics per the reference — replace, don't push.
    media.events.frame = [fn]
    media.loop.ensureRunning()
    return undefined
  })
  // (frame) → current tick number. Preserves the L1 media semantics:
  // zero args → counter; with numeric w+h → composite shape record.
  // Syncs game.frameNo alongside so Curator's consumers still see the
  // right value directly.
  def('frame', (...args) => {
    game.frameNo = media.fb.frame
    if (args.length === 0) return media.fb.frame
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      const [w, h, ...shapes] = args
      return { kind: 'graphic', w, h, shapes }
    }
    return { kind: 'graphic', shapes: args }
  }, 'read')
  def('stop', () => {
    game.stopped = true
    media.loop.stop()
    return undefined
  })

  return env
}

// Adapter interface: consumers can swap the whole game module by
// providing their own installer. Default installer is `installGame`
// above; Curator will pass its own to override.
export default installGame
