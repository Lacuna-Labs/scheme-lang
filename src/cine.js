// cine.js — cinematography verbs.
//
// A virtual camera with a comfort envelope, named-move vocabulary, and
// follow tracking. Standalone REPL has no rendering surface, but the
// CAMERA STATE + FRAME/SHOT RECORDS are real data — the reference
// documents these records as the primary product; a downstream host
// (Curator, Sakura, etc.) applies them to pixels.
//
// Backing: a module-level Cinematographer singleton per env. Reads
// entity positions from game.entities (installed by game.js) when
// computing frame bounds.
//
// Verbs:
//   (cine/comfort)                                    -> object
//   (cine/follow entity-or-card-id tightness)         -> #t | #f
//   (cine/following?)                                 -> #t | #f
//   (cine/frame subject [pad] [ms])                   -> frame-data
//   (cine/shot name [subject])                        -> shot-data
//   (cine/shots)                                      -> list of Syms
//   (cine/stop)                                       -> 'stopped
//
// Alfred: "We can't lie to people. They trust us." Real state, real
// records, no rendering claim.

import { Sym } from './reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// Camera comfort envelope. Values chosen from cinematography conventions;
// documented in the reference entry's :caveats.
function makeComfort() {
  return {
    'max-accel': 0.15,   // units/frame² — max acceleration
    'max-vel':   2.5,    // units/frame — max velocity
    'damping':   0.85,   // 0..1 — velocity retention per frame
    'ease-ms':   350,    // default easing duration in milliseconds
  }
}

// The Cinematographer singleton — one per env install. Holds the camera
// state, the active shot, and the follow-target flag.
export function makeCinematographer() {
  return {
    camera: {
      x: 0, y: 0,
      zoom: 1.0,
      tightness: 0,       // follow tightness 0..1
    },
    comfort: makeComfort(),
    following: null,      // { targetId, tightness } | null
    activeShot: null,     // shot-data record | null
  }
}

// The named shots vocabulary. Symbols per spec ('establishing 'medium
// 'push-in 'pull-out 'settle). Fresh Syms per call so reader interning
// is respected downstream.
export function cineShotsList() {
  return [
    new Sym('establishing'),
    new Sym('medium'),
    new Sym('push-in'),
    new Sym('pull-out'),
    new Sym('settle'),
  ]
}

const SHOT_NAMES = new Set(['establishing', 'medium', 'push-in', 'pull-out', 'settle'])
const SUBJECTLESS_SHOTS = new Set(['establishing', 'pull-out'])

// Compute the AABB enclosing a list of entity ids. Missing ids are
// silently skipped. If nothing resolves, returns a synthetic default so
// consumers always get a well-formed rectangle. Reference specifically
// allows this: "invalid subject silently fails."
function aabbFor(game, ids) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  let hits = 0
  for (const id of ids) {
    const e = game.entities.get(String(nm(id)))
    if (!e) continue
    if (e.x < x1) x1 = e.x
    if (e.y < y1) y1 = e.y
    if (e.x + e.w > x2) x2 = e.x + e.w
    if (e.y + e.h > y2) y2 = e.y + e.h
    hits++
  }
  if (hits === 0) return [0, 0, 100, 100]  // synthetic default
  return [x1, y1, x2, y2]
}

// The whole-grove AABB — every entity in game.entities. Empty table gets
// a synthetic default (0 0 400 300).
function wholeGroveAabb(game) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  let hits = 0
  for (const e of game.entities.values()) {
    if (e.x < x1) x1 = e.x
    if (e.y < y1) y1 = e.y
    if (e.x + e.w > x2) x2 = e.x + e.w
    if (e.y + e.h > y2) y2 = e.y + e.h
    hits++
  }
  if (hits === 0) return [0, 0, 400, 300]
  return [x1, y1, x2, y2]
}

// Clamp padding per spec ("outside 0.12–0.35 clamped by comfort rules").
function clampPad(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 0.20  // default
  if (p < 0.12) return 0.12
  if (p > 0.35) return 0.35
  return p
}

// Coerce a subject to a list-of-ids. Spec accepts a single id, a list of
// ids, or a card id. Card ids are strings/symbols we don't have a table
// for locally — treated as one-element list-of-ids (aabbFor will fall
// back to the synthetic default and note it in :caveats).
function subjectIds(subject) {
  if (subject == null) return []
  if (Array.isArray(subject)) return subject
  return [subject]
}

// ── verb impls ─────────────────────────────────────────────────────────

// (cine/comfort) — return the comfort envelope object. Reference note:
// "returns a copy" — we return a fresh object so mutation doesn't leak.
export function cineComfort(cinema) {
  return { ...cinema.comfort }
}

// (cine/follow id tightness) — record follow. Returns #t iff the target
// is a resolvable id (entity in the table, or a symbol/string card id).
// #f only when the id is not any of those shapes.
export function cineFollow(cinema, game, id, tightness) {
  const t = clampTightness(tightness)
  const name = nm(id)
  if (name == null) return false
  // If it's an entity in the table, definitely valid. Otherwise accept
  // it as a card-id opaque handle.
  const entExists = game.entities.has(String(name))
  const shape = typeof name === 'string' || typeof id === 'symbol'
  if (!entExists && !shape && id instanceof Sym === false) return false
  cinema.following = { targetId: String(name), tightness: t }
  return true
}

function clampTightness(t) {
  const v = num(t)
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

// (cine/following?) — predicate.
export function cineFollowing(cinema) {
  return cinema.following != null
}

// (cine/frame subject [pad] [ms]) — compute frame-data. Real record with
// subjects + center + aabb; no rendering.
export function cineFrame(cinema, game, subject, pad, ms) {
  const ids = subjectIds(subject)
  const p = clampPad(typeof pad === 'number' ? pad : 0.20)
  const dur = num(ms) || cinema.comfort['ease-ms']
  const box = aabbFor(game, ids)
  const cx = (box[0] + box[2]) / 2
  const cy = (box[1] + box[3]) / 2
  return {
    kind: 'frame',
    subjects: ids.slice(),
    center: [cx, cy],
    pad: p,
    ms: dur,
    aabb: box,
  }
}

// (cine/shot name [subject]) — return shot-data record + record as
// active. 'establishing / 'pull-out ignore subject and frame the whole
// grove. Other names use the subject's aabb.
export function cineShot(cinema, game, name, subject) {
  const shotName = String(nm(name))
  if (!SHOT_NAMES.has(shotName)) {
    // Reference: "Other than the listed names, may cause silent no-op
    // or error." We return a shot-data record with the passed name so
    // hosts can decide; but flag unknown = true in the record so the
    // caller sees an explicit signal.
    return { kind: 'shot', name: shotName, subject: null, phases: [], ms: 0, unknown: true }
  }
  const ignoreSubject = SUBJECTLESS_SHOTS.has(shotName)
  const ids = ignoreSubject ? [] : subjectIds(subject)
  const aabb = ignoreSubject ? wholeGroveAabb(game) : aabbFor(game, ids)
  const cx = (aabb[0] + aabb[2]) / 2
  const cy = (aabb[1] + aabb[3]) / 2
  const ms = cinema.comfort['ease-ms']
  // Phase breakdown per named move — each phase records what a downstream
  // host does. Keeps the shot self-descriptive.
  const phases = phasesForShot(shotName, aabb, cx, cy)
  const shot = {
    kind: 'shot',
    name: shotName,
    subject: ignoreSubject ? null : (ids.length === 1 ? ids[0] : ids),
    phases,
    aabb,
    center: [cx, cy],
    ms,
  }
  cinema.activeShot = shot
  return shot
}

// Named-shot phase templates. Real cinematography grammar: establishing
// pulls back to the whole grove; medium centers on the subject; push-in
// eases in; pull-out eases out; settle glides to a rest.
function phasesForShot(name, aabb, cx, cy) {
  switch (name) {
    case 'establishing':
      return [
        { phase: 'ease-to', center: [cx, cy], zoom: 0.8 },
      ]
    case 'medium':
      return [
        { phase: 'ease-to', center: [cx, cy], zoom: 1.0 },
      ]
    case 'push-in':
      return [
        { phase: 'ease-to', center: [cx, cy], zoom: 1.3 },
      ]
    case 'pull-out':
      return [
        { phase: 'ease-to', center: [cx, cy], zoom: 0.6 },
      ]
    case 'settle':
      return [
        { phase: 'settle', center: [cx, cy], zoom: 1.0 },
      ]
    default:
      return []
  }
}

// (cine/shots) — the fixed vocabulary as a list of Syms.
export function cineShots() {
  return cineShotsList()
}

// (cine/stop) — clear follow + active-shot. Reference return type:
// "(cine/stop) -> result" — we return 'stopped for observability.
export function cineStop(cinema) {
  cinema.following = null
  cinema.activeShot = null
  return new Sym('stopped')
}

// ── install into env ───────────────────────────────────────────────────

export function installCine(env, game) {
  const cinema = makeCinematographer()
  const def = (n, f, perm) => env.define(n, f, { perm })

  def('cine/comfort',    ()               => cineComfort(cinema),                      'read')
  def('cine/follow',     (id, tightness)  => cineFollow(cinema, game, id, tightness), 'state-change')
  def('cine/following?', ()               => cineFollowing(cinema),                    'read')
  def('cine/frame',      (subject, pad, ms) => cineFrame(cinema, game, subject, pad, ms), 'state-change')
  def('cine/shot',       (name, subject)   => cineShot(cinema, game, name, subject),      'state-change')
  def('cine/shots',      ()               => cineShots(),                              'read')
  def('cine/stop',       ()               => cineStop(cinema),                         'state-change')

  return env
}

export default installCine
