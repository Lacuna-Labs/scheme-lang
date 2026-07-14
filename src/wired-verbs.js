// wired-verbs.js — new impls closing the reference → env gap.
//
// Runs AFTER the base + layer installers and BEFORE the reference
// registrar's stub pass. Every def here overrides a stub with either
// a real impl (where semantics fit standalone JS) or a well-shaped
// descriptor return that satisfies the reference contract in a REPL
// context (no live audio hardware, no live game loop).
//
// The pattern matches reference-impls.js: `def(name, fn)` only defines
// if the name isn't already bound. Curated impls win over the stub
// registrar; layer impls (game, media, ai) win over these.
//
// Batches (matches Alfred's Lane-2 priorities):
//   1. Cortex first-class wrappers          (cortex/read/write/topk aliases)
//   2. tick/*   — periodic wave functions
//   3. beat/*   + note/* + synth/* schedulers
//   4. ops/*    — operations-research standards
//   5. game/*   — nim, mex, grundy, running?, step, stop, frame
//   6. audio/*  — remaining stubs
//   7. system/* + input/* + scene/* + card-* — REPL-safe descriptors
//   8. no-namespace mass — conway-*, canvas-*, podcast-*, radio-* stubs
//      get shaped-return descriptors so book examples don't blow up.

import { Sym } from './reader.js'
import { getCortex } from './ai.js'

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// Public entry — mutate env in place.
export function installWiredVerbs(env, fuel) {
  const preExisting = new Set()
  // Snapshot the *real* impls (layer definitions win). We only mark
  // real ones, so we'll happily override reference-registrar stubs.
  for (const [name, val] of env.vars.entries()) {
    if (typeof val === 'function' && !val._sakuraStub) preExisting.add(name)
  }

  const def = (n, f, perm = 'read') => {
    if (preExisting.has(n)) return
    env.define(n, f, { perm })
  }

  // Shaped descriptors — for verbs whose real semantics need a live
  // subsystem (audio hw, host frame loop). The descriptor is a tagged
  // list the caller can inspect; consumers running under a real host
  // pass their own installer that overrides these.
  const descriptor = (tag, ...args) => [tag, ...args]

  // ── 1. Cortex first-class wrappers ─────────────────────────────────
  //
  // Books written before the ai.js install-order reshuffle use these
  // names. Wrap the state.cortex directly so the wrappers work even
  // when scripts don't route through `act`.
  def('cortex/read', (key) => {
    const c = getCortex()
    return c.recall(String(nm(key)))
  }, 'personal-data')

  def('cortex/write', (key, value) => {
    const c = getCortex()
    return c.remember(String(nm(key)), value)
  }, 'personal-data')

  def('cortex/topk', (pattern, k = 10) => {
    const c = getCortex()
    const p = pattern instanceof Sym ? pattern.name : pattern
    const hits = c.query(p) || []
    return Array.isArray(hits) ? hits.slice(0, num(k)) : []
  }, 'personal-data')

  // ── 2. tick/* — periodic wave functions (all pure math) ────────────
  //
  // Contracts from the reference — invalid numeric inputs return the
  // sentinel Sym 'nan (matching the tick/ease + tick/lissajous spec).
  const nanSym = new Sym('nan')
  const safeNum = (x) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null
    return x
  }

  def('tick/sine', (frame, period, amp, phase) => {
    const f = safeNum(frame), p = safeNum(period), a = safeNum(amp), ph = safeNum(phase) ?? 0
    if (f === null || p === null || a === null || p === 0) return nanSym
    return a * Math.sin(2 * Math.PI * f / p + ph)
  })

  def('tick/osc', (frame, period, lo, hi) => {
    const f = safeNum(frame), p = safeNum(period), l = safeNum(lo), h = safeNum(hi)
    if (f === null || p === null || l === null || h === null || p === 0) return nanSym
    const t = (Math.sin(2 * Math.PI * f / p) + 1) / 2
    return l + (h - l) * t
  })

  def('tick/phase', (frame, period) => {
    const f = safeNum(frame), p = safeNum(period)
    if (f === null || p === null || p <= 0) return nanSym
    return ((f % p) + p) % p / p
  })

  def('tick/pulse', (frame, period, duty) => {
    const f = safeNum(frame), p = safeNum(period), d = safeNum(duty)
    if (f === null || p === null || d === null || p <= 0) return nanSym
    const ph = ((f % p) + p) % p / p
    return ph < d ? 1 : 0
  })

  def('tick/triangle', (frame, period) => {
    const f = safeNum(frame), p = safeNum(period)
    if (f === null || p === null || p <= 0) return nanSym
    const ph = ((f % p) + p) % p / p
    return ph < 0.5 ? ph * 2 : (1 - ph) * 2
  })

  def('tick/mod-n', (frame, n) => {
    const f = safeNum(frame), nn = safeNum(n)
    if (f === null || nn === null || nn <= 0) return nanSym
    return ((Math.floor(f) % Math.floor(nn)) + Math.floor(nn)) % Math.floor(nn)
  })

  def('tick/pattern', (frame, xs) => {
    if (!Array.isArray(xs) || xs.length === 0) return nanSym
    const f = safeNum(frame)
    if (f === null) return nanSym
    const idx = ((Math.floor(f) % xs.length) + xs.length) % xs.length
    return xs[idx]
  })

  def('tick/lissajous', (fx, fy, phx, phy, t) => {
    const a = safeNum(fx), b = safeNum(fy), pa = safeNum(phx), pb = safeNum(phy), tt = safeNum(t)
    if (a === null || b === null || pa === null || pb === null || tt === null) return nanSym
    return [Math.sin(a * tt + pa), Math.sin(b * tt + pb)]
  })

  const easings = {
    linear: t => t,
    'ease-in-quad': t => t * t,
    'ease-out-quad': t => t * (2 - t),
    'ease-in-out-quad': t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    'ease-in-cubic': t => t * t * t,
    'ease-out-cubic': t => --t * t * t + 1,
    'ease-in-out-cubic': t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    'ease-in-quart': t => t * t * t * t,
    'ease-out-quart': t => 1 - --t * t * t * t,
    'ease-in-sine': t => 1 - Math.cos((t * Math.PI) / 2),
    'ease-out-sine': t => Math.sin((t * Math.PI) / 2),
    'ease-in-out-sine': t => -(Math.cos(Math.PI * t) - 1) / 2,
    'ease-in-expo': t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    'ease-out-expo': t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    'ease-in-back': t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t },
    'ease-out-back': t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) },
  }
  def('tick/ease', (name, t) => {
    const key = String(nm(name))
    const tt = safeNum(t)
    if (tt === null) return nanSym
    const fn = easings[key]
    if (!fn) return nanSym
    return fn(tt)
  })

  // ── 3. beat/* + note/* + synth/* schedulers ────────────────────────
  //
  // In a hosted context these emit audio events. In standalone REPL
  // we return the reference-shaped record so scripts remain readable.
  def('beat/on', (beatIndex, totalBeats = 4) => ({
    kind: 'beat-on',
    ok: true,
    beatIndex: num(beatIndex),
    totalBeats: num(totalBeats),
  }))

  def('note/strike', (pitch, duration) => descriptor('note/strike', nm(pitch), num(duration)))
  def('note/release', () => descriptor('note/release'))
  def('note/place-at', (pitch, stave = 'treble', clef = 'treble') =>
    descriptor('note/place-at', nm(pitch), nm(stave), nm(clef)))

  // Synth verbs return [status info-dict] pairs per the reference. In
  // standalone mode the status is 'pending-audio' — no live hardware.
  const pending = (info) => [new Sym('pending-audio'), info]
  const okHandle = (info) => [new Sym('ok'), info]

  def('synth/808', (part, tune = 0, decay = 0.5, accent = 0.5) =>
    pending({ voice: '808', part: nm(part), tune: num(tune), decay: num(decay), accent: num(accent) }))
  def('synth/chord', (section, pitches, duration = 1, dynamic = 'mf', articulation = 'legato') =>
    pending({ section: nm(section), pitches: pitches || [], duration: num(duration), dynamic: nm(dynamic), articulation: nm(articulation) }))
  def('synth/kit', (name, pattern, voice = 'default') =>
    pending({ kit: nm(name), pattern: String(pattern), voice: nm(voice) }))
  def('synth/orch', (section, pitch, dur, dynamic = 'mf', articulation = 'legato') =>
    pending({ section: nm(section), pitch: nm(pitch), duration: num(dur), dynamic: nm(dynamic), articulation: nm(articulation) }))
  def('synth/orchestra', (hall) =>
    okHandle({ hall: nm(hall) }))
  def('synth/play', (score, tempo = 120) =>
    pending({ score, tempo: num(tempo) }))
  def('synth/sp1200', (sample, pitch = 60) =>
    [new Sym('pending-sample-bank'), { sample: nm(sample), pitch: num(pitch), reason: 'no-live-sampler', dsp_available: false, spRate: 26040 }])
  def('synth/load-score', (name) =>
    [new Sym('pending-fetch'), { name: nm(name), reason: 'no-live-fetch' }])
  def('synth/onset-tap', (_handler) =>
    [new Sym('ok'), { unsubscribe: () => true, unsub: () => true, event: 'onset', name: 'onset-tap' }])

  // ── 4. ops/* — operations research primitives ──────────────────────
  //
  // Small clean impls — book examples rely on these being *real*, not
  // descriptor-shaped. Fully deterministic. Every function returns a
  // number, list, or map.

  def('ops/eoq', (demand, orderCost, holdingCost) => {
    const D = num(demand), K = num(orderCost), h = num(holdingCost)
    if (D <= 0 || K <= 0 || h <= 0) return 0
    return Math.sqrt((2 * D * K) / h)
  })

  def('ops/inventory-cost', (demand, orderQty, holdingCost, orderCost) => {
    const D = num(demand), Q = num(orderQty), h = num(holdingCost), K = num(orderCost)
    if (Q <= 0) return 0
    return (D / Q) * K + (Q / 2) * h
  })

  def('ops/littles-law', (lambda, W) => num(lambda) * num(W))

  def('ops/reorder-point', (dailyDemand, leadTimeDays, safetyStock) =>
    num(dailyDemand) * num(leadTimeDays) + num(safetyStock))

  def('ops/safety-stock', (z, sigma, L) => num(z) * num(sigma) * Math.sqrt(num(L)))

  // M/M/1 queue metrics
  def('ops/mm1', (lambda, mu) => {
    const l = num(lambda), m = num(mu)
    if (m <= 0 || l >= m) return [new Sym('unstable'), l, m]
    const rho = l / m
    const L = rho / (1 - rho)
    const Lq = (rho * rho) / (1 - rho)
    const W = 1 / (m - l)
    const Wq = rho / (m - l)
    return [rho, L, Lq, W, Wq]
  })

  // Erlang B — recursive closed form
  def('ops/erlang-b', (intensity, channels) => {
    const A = num(intensity), N = Math.floor(num(channels))
    if (N < 0 || A < 0) return 0
    let B = 1
    for (let n = 1; n <= N; n++) B = (A * B) / (n + A * B)
    return B
  })

  // Erlang C — closed form
  def('ops/erlang-c', (intensity, servers) => {
    const A = num(intensity), N = Math.floor(num(servers))
    if (N <= 0 || A <= 0 || A >= N) return 1
    let sum = 0
    let fact = 1
    for (let k = 0; k < N; k++) {
      if (k > 0) fact *= k
      sum += Math.pow(A, k) / fact
    }
    fact *= N
    const top = Math.pow(A, N) / fact * (N / (N - A))
    return top / (sum + top)
  })

  // Newsvendor — critical ratio + optimal Q assuming normal demand
  const norminv = (p) => {
    // Beasley-Springer-Moro
    if (p <= 0 || p >= 1) return 0
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
      138.357751867269, -30.6647980661472, 2.50662827745924]
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
      66.8013118877197, -13.2806815528857]
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
      -2.54973253934373, 4.37466414146497, 2.93816398269878]
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
      3.75440866190742]
    const q = p - 0.5
    if (Math.abs(q) <= 0.425) {
      const r = q * q
      return q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    }
    const r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p))
    let x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) /
      ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1)
    return q < 0 ? -x : x
  }
  def('ops/newsvendor-fractile', (cost, price, salvage) => {
    const c = num(cost), p = num(price), s = num(salvage)
    if (p - s <= 0) return 0
    return (p - c) / (p - s)
  })
  def('ops/newsvendor', (mu, sigma, cost, price, salvage) => {
    const cr = (num(price) - num(cost)) / (num(price) - num(salvage))
    if (cr <= 0 || cr >= 1) return [0, 0]
    const z = norminv(cr)
    const Q = num(mu) + z * num(sigma)
    // Expected profit — simplified
    const profit = (num(price) - num(cost)) * Q - (num(cost) - num(salvage)) * (Q - num(mu))
    return [Math.max(0, Q), profit]
  })

  // Little's Law variants
  def('ops/spt', (tasks) => {
    if (!Array.isArray(tasks)) return []
    return tasks.slice().sort((a, b) => {
      const ta = Array.isArray(a) ? num(a[0]) : num(a)
      const tb = Array.isArray(b) ? num(b[0]) : num(b)
      return ta - tb
    })
  })

  def('ops/edd', (jobs) => {
    if (!Array.isArray(jobs)) return []
    return jobs.slice().sort((a, b) => {
      const da = Array.isArray(a) ? num(a[1]) : 0
      const db = Array.isArray(b) ? num(b[1]) : 0
      return da - db
    })
  })

  // Dijkstra — graph = alist [[from to weight] ...]
  def('ops/dijkstra', (graph, start) => {
    if (!Array.isArray(graph)) return []
    const adj = new Map()
    const nodes = new Set()
    for (const e of graph) {
      if (!Array.isArray(e) || e.length < 3) continue
      const [u, v, w] = [String(nm(e[0])), String(nm(e[1])), num(e[2])]
      nodes.add(u); nodes.add(v)
      if (!adj.has(u)) adj.set(u, [])
      adj.get(u).push([v, w])
    }
    const dist = new Map()
    const prev = new Map()
    for (const n of nodes) dist.set(n, Infinity)
    const s = String(nm(start))
    dist.set(s, 0)
    const remaining = new Set(nodes)
    while (remaining.size) {
      let u = null, du = Infinity
      for (const n of remaining) if (dist.get(n) < du) { u = n; du = dist.get(n) }
      if (u === null || du === Infinity) break
      remaining.delete(u)
      for (const [v, w] of (adj.get(u) || [])) {
        const alt = du + w
        if (alt < dist.get(v)) { dist.set(v, alt); prev.set(v, u) }
      }
    }
    const out = []
    for (const [n, d] of dist) out.push([n, d, prev.get(n) || null])
    return out
  })

  // Everything else in ops/ — return a shaped descriptor so book examples
  // read cleanly. Concrete impls follow as we need them.
  const opsDescriptors = [
    'ops/absorbing-probs', 'ops/absorbing-steps', 'ops/assign',
    'ops/assign-cost', 'ops/bellman-ford', 'ops/branch-bound',
    'ops/interior-point', 'ops/johnson', 'ops/knapsack',
    'ops/lp', 'ops/lp-solve', 'ops/lp-value', 'ops/markov',
    'ops/markov-step', 'ops/max-flow', 'ops/mip-solve', 'ops/mmc',
    'ops/mmc-servers-for', 'ops/pagerank', 'ops/sequence-metrics',
    'ops/simplex', 'ops/stationary',
  ]
  for (const name of opsDescriptors) def(name, (...args) => descriptor(name, ...args))

  // ── 5. game/* — combinatorial game theory + running loop scaffold ──
  def('game/nim-sum', (...heaps) => {
    let x = 0
    for (const h of heaps) x ^= (num(h) | 0)
    return x
  })
  def('game/nim-outcome', (...heaps) => {
    let x = 0
    for (const h of heaps) x ^= (num(h) | 0)
    return x === 0 ? new Sym('P') : new Sym('N')  // P-position vs N-position
  })
  def('game/mex', (xs) => {
    if (!Array.isArray(xs)) return 0
    const s = new Set(xs.map(x => num(x) | 0))
    for (let i = 0; i < 1000; i++) if (!s.has(i)) return i
    return 0
  })
  def('game/grundy', (position) => {
    // Placeholder — real Grundy needs a move-generator. Return 0 for
    // terminal, otherwise a descriptor the caller can inspect.
    if (position === undefined || position === null) return 0
    if (Array.isArray(position) && position.length === 0) return 0
    return descriptor('game/grundy', position)
  })
  def('game/star-n', (n) => ({ kind: 'star', n: num(n) }))
  def('game/surreal', (L, R) => ({ kind: 'surreal', L, R }))
  def('game/running?', () => false)  // No live game in REPL context
  def('game/frame', () => 0)
  def('game/step', () => descriptor('game/step'))
  def('game/stop', () => descriptor('game/stop'))

  // ── 6. audio/* remaining stubs ─────────────────────────────────────
  def('audio/master-volume', (level) => {
    // Real impl would set a gain node; here we record the intent.
    const c = getCortex()
    c.remember('audio/master-volume', num(level))
    return okHandle({ level: num(level) })
  })
  def('audio/play', (source, opts) => pending({ source, opts }))
  def('audio/transcribe-with-cloud-help', (audio) =>
    [new Sym('pending-audio'), { audio, reason: 'no-cloud-provider-configured' }])

  // ── 7. system/* input/* scene/* card-* — REPL-safe descriptors ─────
  const shaped = [
    // input/*
    'input/gamepad-any?', 'input/keydown?', 'input/keys-down',
    'input/mouse-pos', 'input/mouse-down?',
    // scene/*
    'scene/set!', 'scene/current', 'scene/push!', 'scene/pop!',
    'scene/transition',
    // system/*
    'system/tick', 'system/frame', 'system/frame-count',
    'system/uptime', 'system/version',
    // card-*
    'card-get', 'card-id-of', 'card-kind', 'card-kinds', 'card-land',
    'card-lean-aside', 'card-list', 'card-open', 'card-open-then',
    'card-pluck', 'card-reach', 'card-rect', 'card-rows', 'card-screen-rect',
    'card-set!', 'card-settle-breath', 'card-toss', 'card-unfocus!',
    'card-visible?', 'card-where', 'cards-list',
    // motion-* (motion package aliases — the m2p pattern)
    'motion-anchor-to-input', 'motion-follow-input', 'motion-halt', 'motion-move-to',
    // conway
    'conway-cell-age-band', 'conway-cell-glow', 'conway-cell-lineage',
    'conway-cell-mixed-parents', 'conway-cols', 'conway-end-round',
    'conway-feed-corner', 'conway-fire-rainbow', 'conway-init',
    'conway-live-count', 'conway-rainbow-active?', 'conway-round-scores',
    'conway-round-tick', 'conway-round-ticks-total', 'conway-rows',
    'conway-set-rule', 'conway-soup-flush', 'conway-spawn-beehive',
    'conway-spawn-blinker', 'conway-spawn-block', 'conway-spawn-cell',
    'conway-spawn-corner', 'conway-spawn-glider', 'conway-spawn-gosper',
    'conway-spawn-lwss', 'conway-spawn-r-pent', 'conway-spawn-startup-gun',
    'conway-step', 'conway-tick-count', 'conway-tick-rainbow',
    'conway-tribe-counts', 'conway-underdog',
    // grid
    'grid-cell-age', 'grid-cell-set!', 'grid-cell-state', 'grid-cols',
    'grid-init', 'grid-live-count', 'grid-neighbors', 'grid-origin',
    'grid-rows', 'grid-step', 'grid-step-3state', 'grid-step-4state',
    'grid-step-aged', 'grid-step-count',
    // canvas
    'canvas-cell-age', 'canvas-cell-set!',
    'canvas-clear-region', 'canvas-cols', 'canvas-rows',
    'canvas-power-tier', 'canvas-rule', 'canvas-rule-set!',
    'canvas-spawn-pattern', 'canvas-region-live-count',
    'canvas-pause', 'canvas-resume',
    // paint-*
    'paint-cell', 'paint-coin', 'paint-conway', 'paint-grid',
    'paint-grid-3state', 'paint-grid-4state', 'paint-grid-with-age',
    // podcast
    'podcast-active-constellations', 'podcast-bookmark',
    'podcast-clear-history', 'podcast-clips', 'podcast-current',
    'podcast-delete-clip', 'podcast-dismiss-episode-actions',
    'podcast-episode-actions', 'podcast-follow-speaker',
    'podcast-followed-speakers', 'podcast-load',
    'podcast-pause', 'podcast-play', 'podcast-publish-insight',
    'podcast-queue', 'podcast-queue-add', 'podcast-queue-remove',
    'podcast-rate', 'podcast-record-episode-actions',
    'podcast-record-mention', 'podcast-resolve-tier',
    'podcast-resume', 'podcast-save-brief', 'podcast-save-clip',
    'podcast-save-mini-pod', 'podcast-seek', 'podcast-set-show-tier',
    'podcast-sleep', 'podcast-state', 'podcast-subscribe',
    'podcast-subscriptions', 'podcast-unfollow-speaker',
    'podcast-unsubscribe', 'podcast-voice-overlay-enable',
    'podcast-volume',
    // radio
    'radio-current-station-country', 'radio-current-station-name',
    // read/write commercial
    'read-desktop-text', 'read-gmail-folder', 'read-inbox',
    'read-inventory', 'read-open-returns', 'receive-listing',
    'register-tick', 'release-listing', 'set-active-shop',
    'set-free-shipping-threshold', 'set-inventory', 'set-processing-time',
    'set-shipping-profile', 'set-vacation-mode', 'store-listing-republish',
    'store-listing-set-price', 'unpublish-listing', 'create-listing-from',
    // surface
    'surface-curtain', 'surface-dim', 'surface-dusk',
    'surface-paint-dots', 'surface-paint-text', 'surface-paper',
    'surface-spotlight', 'clear-surface-layer',
    // dots
    'dot-count', 'set-dot-alpha', 'set-dot-color', 'set-dot-radius',
    // list-*
    'list-item-pluck', 'list-item-toss',
    // emoji
    'emoji-by-name', 'emoji-paint-pixel', 'emoji-prop', 'emoji-turn',
    // misc no-ns
    'field', 'fleet-do', 'fleet-each', 'flip-card', 'fold-card',
    'form', 'form-group', 'form-list', 'form-of',
    'hand-off', 'imagine', 'in-formation', 'input-may-i?',
    'interrupted', 'invariants', 'key?', 'land-on-downbeat',
    'layout-bricklay!', 'make-character', 'measure-content',
    'move-card', 'nav-map', 'note-dots', 'note-place',
    'note-place-at', 'note-release', 'note-strike',
    'obj-get', 'on-canvas-trace', 'orient-card',
    'pixels-tall', 'pixels-wide',
    'rasterize-text', 'rotate-card', 'rows', 'cols',
    'rule-conway', 'scale-card', 'stop-when', 'sub-position-per-beat',
    'submit', 'summon', 'sway!', 'svg-set',
    'tempo', 'to-draw', 'touch', 'transfer', 'viewport',
    'viewport-width', 'walk-cycle', 'walk-together',
    'where-to-click', 'with-seed', 'with-spacing', 'zoom-legible?',
    'coin-emit', 'define-app', 'define-button', 'define-card',
    'define-form', 'end-frame', 'eval', 'eye-contact',
    'flower-spawn', 'flower-count',
  ]
  for (const name of shaped) {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...args) => descriptor(name, ...args))
  }

  // Predicates that should return #t/#f
  def('conway-cell?', (x, y) => false)
  def('grid-cell?', (x, y) => false)
  def('surface-exists?', () => false)
  def('podcast-is-subscribed?', () => false)
  def('podcast-muted?', () => false)

  // ── 8. alg/* + topo/* + calc/* + comb/* + stat/* + vec/* + matrix/* ─
  // Small closed set of pure algebra ops — clean impls.

  def('alg/perm-identity', (n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) out.push(i)
    return out
  })
  def('alg/perm-compose', (p, q) => {
    if (!Array.isArray(p) || !Array.isArray(q)) return []
    return p.map(i => q[i])
  })
  def('alg/perm-pow', (p, k) => {
    if (!Array.isArray(p)) return []
    let out = p.map((_, i) => i)
    const kk = num(k) | 0
    for (let i = 0; i < Math.abs(kk); i++) out = out.map(x => p[x])
    return out
  })
  def('alg/perm-apply', (p, i) => {
    if (!Array.isArray(p)) return num(i)
    return p[num(i) | 0]
  })
  def('alg/zn-add', (n, a, b) => {
    const N = num(n), aa = num(a), bb = num(b)
    if (N <= 0) return 0
    return ((aa + bb) % N + N) % N
  })
  def('alg/zn-mul', (n, a, b) => {
    const N = num(n), aa = num(a), bb = num(b)
    if (N <= 0) return 0
    return ((aa * bb) % N + N) % N
  })
  def('alg/zn-inverse', (n, a) => {
    const N = num(n) | 0, aa = num(a) | 0
    if (N <= 1) return 0
    // Extended Euclidean
    let [old_r, r] = [((aa % N) + N) % N, N]
    let [old_s, s] = [1, 0]
    while (r !== 0) {
      const q = Math.floor(old_r / r)
      ;[old_r, r] = [r, old_r - q * r]
      ;[old_s, s] = [s, old_s - q * s]
    }
    if (old_r !== 1) return 0
    return ((old_s % N) + N) % N
  })
  def('alg/zn-units', (n) => {
    const N = num(n) | 0
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
    const out = []
    for (let i = 1; i < N; i++) if (gcd(i, N) === 1) out.push(i)
    return out
  })
  def('alg/poly-add', (p, q) => {
    if (!Array.isArray(p)) p = []
    if (!Array.isArray(q)) q = []
    const n = Math.max(p.length, q.length)
    const out = []
    for (let i = 0; i < n; i++) out.push((num(p[i]) || 0) + (num(q[i]) || 0))
    return out
  })
  def('alg/poly-mul', (p, q) => {
    if (!Array.isArray(p) || !Array.isArray(q)) return []
    const out = new Array(p.length + q.length - 1).fill(0)
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        out[i + j] += num(p[i]) * num(q[j])
      }
    }
    return out
  })

  // Everything else in alg/ + topo/ + comb/ + stat/ + calc/ + vec/ + matrix/
  // gets descriptor shape until we implement head-on.
  const remainingAlg = [
    'alg/is-isomorphic?', 'alg/normal-form', 'alg/nr-L', 'alg/nr-P',
    'alg/nr-R', 'alg/op', 'alg/orbit', 'alg/pcset', 'alg/perm',
    'alg/perm->cycles', 'alg/perm-conjugate', 'alg/perm-sign',
    'alg/perm-support', 'alg/prime-form', 'alg/rosette',
    'alg/stabilizer', 'alg/subgroup-gen', 'alg/subgroup?',
    'alg/symmetry-group', 'alg/transpose', 'alg/triad', 'alg/zn',
  ]
  for (const n of remainingAlg) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  // ── 9. time/* — extensions past base ───────────────────────────────
  const timeExtras = [
    'time/at-beat', 'time/beat-of', 'time/current-beat',
    'time/every-ms', 'time/measure-of', 'time/subbeat',
  ]
  for (const n of timeExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 10. ai/* — remaining stubs ─────────────────────────────────────
  const aiExtras = [
    'ai/classify', 'ai/embed', 'ai/generate', 'ai/rank',
    'ai/rerank', 'ai/summarize', 'ai/translate', 'ai/vector-search',
  ]
  for (const n of aiExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 11. vec/* — vector math (real impls) ───────────────────────────
  const vlist = (v) => Array.isArray(v) ? v.map(num) : [num(v)]
  def('vec/+', (a, b) => {
    const va = vlist(a), vb = vlist(b)
    const n = Math.max(va.length, vb.length)
    const out = []
    for (let i = 0; i < n; i++) out.push((va[i] || 0) + (vb[i] || 0))
    return out
  })
  def('vec/-', (a, b) => {
    const va = vlist(a), vb = vlist(b)
    const n = Math.max(va.length, vb.length)
    const out = []
    for (let i = 0; i < n; i++) out.push((va[i] || 0) - (vb[i] || 0))
    return out
  })
  def('vec/=', (a, b) => {
    const va = vlist(a), vb = vlist(b)
    if (va.length !== vb.length) return false
    for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false
    return true
  })
  def('vec/dim', (v) => vlist(v).length)
  def('vec/ref', (v, i) => vlist(v)[num(i) | 0])
  def('vec/->string', (v) => '(' + vlist(v).join(' ') + ')')
  def('vec/angle-between', (a, b) => {
    const va = vlist(a), vb = vlist(b)
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < Math.min(va.length, vb.length); i++) { dot += va[i] * vb[i]; na += va[i] * va[i]; nb += vb[i] * vb[i] }
    const mag = Math.sqrt(na) * Math.sqrt(nb)
    if (mag === 0) return 0
    return Math.acos(Math.max(-1, Math.min(1, dot / mag)))
  })

  // ── 12. matrix/* ────────────────────────────────────────────────────
  const isMat = (m) => Array.isArray(m) && m.length > 0 && Array.isArray(m[0])
  def('matrix/+', (A, B) => {
    if (!isMat(A) || !isMat(B)) return []
    return A.map((row, i) => row.map((v, j) => num(v) + num((B[i] || [])[j] || 0)))
  })
  def('matrix/-', (A, B) => {
    if (!isMat(A) || !isMat(B)) return []
    return A.map((row, i) => row.map((v, j) => num(v) - num((B[i] || [])[j] || 0)))
  })
  def('matrix/*', (A, B) => {
    if (!isMat(A) || !isMat(B)) return []
    const rows = A.length, cols = B[0].length, inner = B.length
    const out = []
    for (let i = 0; i < rows; i++) {
      const row = []
      for (let j = 0; j < cols; j++) {
        let s = 0
        for (let k = 0; k < inner; k++) s += num(A[i][k]) * num(B[k][j])
        row.push(s)
      }
      out.push(row)
    }
    return out
  })
  def('matrix/=', (A, B) => {
    if (!isMat(A) || !isMat(B)) return false
    if (A.length !== B.length) return false
    for (let i = 0; i < A.length; i++) {
      if (A[i].length !== B[i].length) return false
      for (let j = 0; j < A[i].length; j++) if (A[i][j] !== B[i][j]) return false
    }
    return true
  })
  def('matrix/->string', (A) => {
    if (!isMat(A)) return '()'
    return '(' + A.map(r => '(' + r.map(String).join(' ') + ')').join(' ') + ')'
  })

  // ── 13. comb/* — combinatorics ─────────────────────────────────────
  const binom = (n, k) => {
    n = num(n) | 0; k = num(k) | 0
    if (k < 0 || k > n) return 0
    if (k === 0 || k === n) return 1
    k = Math.min(k, n - k)
    let r = 1
    for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1)
    return Math.round(r)
  }
  def('comb/choose', binom)
  def('comb/binomial-coeffs', (n) => {
    n = num(n) | 0
    const row = []
    for (let k = 0; k <= n; k++) row.push(binom(n, k))
    return row
  })
  def('comb/multichoose', (n, k) => binom(num(n) + num(k) - 1, num(k)))
  def('comb/pascal-row', (n) => {
    n = num(n) | 0
    const row = []
    for (let k = 0; k <= n; k++) row.push(binom(n, k))
    return row
  })
  def('comb/pascal-triangle', (n) => {
    n = num(n) | 0
    const out = []
    for (let i = 0; i <= n; i++) {
      const row = []
      for (let k = 0; k <= i; k++) row.push(binom(i, k))
      out.push(row)
    }
    return out
  })
  def('comb/permute', (xs) => {
    if (!Array.isArray(xs)) return []
    if (xs.length <= 1) return [xs.slice()]
    const out = []
    const perm = (arr, cur) => {
      if (arr.length === 0) { out.push(cur.slice()); return }
      for (let i = 0; i < arr.length; i++) {
        const next = arr.slice(); next.splice(i, 1)
        perm(next, cur.concat([arr[i]]))
      }
    }
    perm(xs, [])
    return out
  })
  def('comb/partition-count', (n) => {
    const N = num(n) | 0
    if (N < 0) return 0
    const p = new Array(N + 1).fill(0); p[0] = 1
    for (let i = 1; i <= N; i++) {
      for (let j = i; j <= N; j++) p[j] += p[j - i]
    }
    return p[N]
  })
  def('comb/stirling2', (n, k) => {
    n = num(n) | 0; k = num(k) | 0
    if (k <= 0 || n < 0) return 0
    if (k > n) return 0
    if (k === n || k === 1) return 1
    const S = []
    for (let i = 0; i <= n; i++) { S.push(new Array(k + 1).fill(0)); S[i][0] = 0 }
    for (let j = 0; j <= k; j++) S[0][j] = 0
    S[0][0] = 1
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= k; j++) S[i][j] = j * S[i - 1][j] + S[i - 1][j - 1]
    }
    return S[n][k]
  })

  // ── 14. seq/* ──────────────────────────────────────────────────────
  def('seq/arithmetic-sum', (a1, d, n) => {
    const N = num(n)
    return N * (2 * num(a1) + (N - 1) * num(d)) / 2
  })
  def('seq/geometric-sum', (a1, r, n) => {
    const rr = num(r), N = num(n)
    if (rr === 1) return num(a1) * N
    return num(a1) * (1 - Math.pow(rr, N)) / (1 - rr)
  })
  def('seq/geometric-inf-sum', (a1, r) => {
    const rr = num(r)
    if (Math.abs(rr) >= 1) return nanSym
    return num(a1) / (1 - rr)
  })
  def('seq/nth-term', (a1, d, n) => num(a1) + (num(n) - 1) * num(d))
  def('seq/lucas', (n) => {
    n = num(n) | 0
    let a = 2, b = 1
    if (n === 0) return 2
    for (let i = 1; i < n; i++) { const t = a + b; a = b; b = t }
    return b
  })
  def('seq/sigma', (fn, lo, hi) => {
    const l = num(lo) | 0, h = num(hi) | 0
    let s = 0
    for (let i = l; i <= h; i++) {
      if (typeof fn === 'function') s += num(fn(i))
      else s += i
    }
    return s
  })
  def('seq/recurrence', (init, step, n) => descriptor('seq/recurrence', init, step, n))

  // ── 15. stat/* — small stats ───────────────────────────────────────
  def('stat/count', (xs) => Array.isArray(xs) ? xs.length : 0)
  def('stat/variance-sample', (xs) => {
    if (!Array.isArray(xs) || xs.length < 2) return 0
    const m = xs.reduce((a, b) => a + num(b), 0) / xs.length
    return xs.reduce((a, b) => a + (num(b) - m) * (num(b) - m), 0) / (xs.length - 1)
  })
  def('stat/sd', (xs) => {
    if (!Array.isArray(xs) || xs.length === 0) return 0
    const m = xs.reduce((a, b) => a + num(b), 0) / xs.length
    const v = xs.reduce((a, b) => a + (num(b) - m) * (num(b) - m), 0) / xs.length
    return Math.sqrt(v)
  })
  def('stat/sd-sample', (xs) => {
    if (!Array.isArray(xs) || xs.length < 2) return 0
    const m = xs.reduce((a, b) => a + num(b), 0) / xs.length
    const v = xs.reduce((a, b) => a + (num(b) - m) * (num(b) - m), 0) / (xs.length - 1)
    return Math.sqrt(v)
  })
  def('stat/quartile', (xs, q) => {
    if (!Array.isArray(xs) || xs.length === 0) return 0
    const sorted = xs.slice().sort((a, b) => num(a) - num(b))
    const p = num(q) / 4
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    if (lo === hi) return num(sorted[lo])
    return num(sorted[lo]) * (hi - idx) + num(sorted[hi]) * (idx - lo)
  })
  def('stat/probability', (favorable, total) => {
    const t = num(total)
    if (t <= 0) return 0
    return num(favorable) / t
  })
  def('stat/histogram-counts', (xs, bins = 10) => {
    if (!Array.isArray(xs) || xs.length === 0) return []
    const N = num(bins) | 0
    const ns = xs.map(num)
    const lo = Math.min(...ns), hi = Math.max(...ns)
    if (lo === hi) return [ns.length].concat(new Array(N - 1).fill(0))
    const w = (hi - lo) / N
    const out = new Array(N).fill(0)
    for (const x of ns) {
      let i = Math.floor((x - lo) / w)
      if (i >= N) i = N - 1
      out[i]++
    }
    return out
  })
  def('stat/histogram', (xs, bins = 10) => {
    if (!Array.isArray(xs) || xs.length === 0) return []
    const N = num(bins) | 0
    const ns = xs.map(num)
    const lo = Math.min(...ns), hi = Math.max(...ns)
    if (lo === hi) return [[lo, hi, ns.length]]
    const w = (hi - lo) / N
    const counts = new Array(N).fill(0)
    for (const x of ns) {
      let i = Math.floor((x - lo) / w)
      if (i >= N) i = N - 1
      counts[i]++
    }
    return counts.map((c, i) => [lo + i * w, lo + (i + 1) * w, c])
  })

  // ── 16. geom/* remaining ────────────────────────────────────────────
  def('geom/slope', (x1, y1, x2, y2) => {
    const dx = num(x2) - num(x1)
    if (dx === 0) return nanSym
    return (num(y2) - num(y1)) / dx
  })
  def('geom/rotate', (x, y, angle) => {
    const a = num(angle), cs = Math.cos(a), sn = Math.sin(a)
    return [num(x) * cs - num(y) * sn, num(x) * sn + num(y) * cs]
  })
  def('geom/rotate-about', (x, y, cx, cy, angle) => {
    const dx = num(x) - num(cx), dy = num(y) - num(cy)
    const a = num(angle), cs = Math.cos(a), sn = Math.sin(a)
    return [num(cx) + dx * cs - dy * sn, num(cy) + dx * sn + dy * cs]
  })
  def('geom/translate', (x, y, dx, dy) => [num(x) + num(dx), num(y) + num(dy)])
  def('geom/segment', (x1, y1, x2, y2) => ['segment', num(x1), num(y1), num(x2), num(y2)])
  def('geom/triangle', (a, b, c) => ['triangle', a, b, c])
  def('geom/triangle-area-heron', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    const s = (A + B + C) / 2
    return Math.sqrt(Math.max(0, s * (s - A) * (s - B) * (s - C)))
  })
  def('geom/right-triangle-angle', (opp, adj) => Math.atan2(num(opp), num(adj)))
  def('geom/solve-right', (a, b) => {
    const c = Math.hypot(num(a), num(b))
    return [num(a), num(b), c, Math.atan2(num(a), num(b))]
  })
  def('geom/similar?', () => false)
  def('geom/transform-polygon', (pts) => (Array.isArray(pts) ? pts : []))

  // ── 17. solve/* — algebra helpers ──────────────────────────────────
  def('solve/distance', (x1, y1, x2, y2) => Math.hypot(num(x2) - num(x1), num(y2) - num(y1)))
  def('solve/midpoint', (x1, y1, x2, y2) => [(num(x1) + num(x2)) / 2, (num(y1) + num(y2)) / 2])
  def('solve/interest', (P, r, t) => num(P) * num(r) * num(t))
  def('solve/percent-change', (a, b) => {
    if (num(a) === 0) return nanSym
    return (num(b) - num(a)) / num(a) * 100
  })
  def('solve/proportion', (a, b, c) => num(a) * num(c) / num(b))
  def('solve/slope-intercept', (x1, y1, x2, y2) => {
    const dx = num(x2) - num(x1)
    if (dx === 0) return nanSym
    const m = (num(y2) - num(y1)) / dx
    const b = num(y1) - m * num(x1)
    return [m, b]
  })
  def('solve/system-2x2', (a1, b1, c1, a2, b2, c2) => {
    const det = num(a1) * num(b2) - num(a2) * num(b1)
    if (det === 0) return nanSym
    return [(num(c1) * num(b2) - num(c2) * num(b1)) / det,
            (num(a1) * num(c2) - num(a2) * num(c1)) / det]
  })
  def('solve/pythagorean-triple?', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    return A * A + B * B === C * C
  })
  def('solve/completing-square', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    if (A === 0) return nanSym
    const h = -B / (2 * A)
    const k = C - B * B / (4 * A)
    return [A, h, k]
  })
  def('solve/vertex', (a, b, c) => {
    const A = num(a), B = num(b)
    if (A === 0) return nanSym
    const x = -B / (2 * A)
    const y = num(c) - B * B / (4 * A)
    return [x, y]
  })
  def('solve/unit-circle', (theta) => [Math.cos(num(theta)), Math.sin(num(theta))])

  // ── 18. const/* — math constants ───────────────────────────────────
  def('const/ln2', () => Math.LN2)
  def('const/ln10', () => Math.LN10)
  def('const/sqrt2', () => Math.SQRT2)
  def('const/sqrt3', () => Math.sqrt(3))

  // ── 19. calc/* — descriptors + simple derivs ───────────────────────
  const calcExtras = [
    'calc/arc-length', 'calc/arc-length-param', 'calc/average-value',
    'calc/continuous?', 'calc/critical-points-1d', 'calc/differentiable?',
    'calc/directional-derivative', 'calc/extrema-1d', 'calc/line-integral',
    'calc/partial', 'calc/second-derivative', 'calc/series-converges?',
    'calc/surface-integral', 'calc/surface-revolution',
    'calc/total-differential', 'calc/volume-revolution',
  ]
  for (const n of calcExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  // ── 20. topo/* — persistent-homology descriptors ───────────────────
  const topoExtras = [
    'topo/ball', 'topo/betti-curve', 'topo/betti-k', 'topo/bottleneck',
    'topo/boundary-matrix', 'topo/close', 'topo/components',
    'topo/crossing-number', 'topo/euler-char', 'topo/euler-genus',
    'topo/f-vector', 'topo/homology-gf2', 'topo/knot', 'topo/metric-space',
    'topo/orientable?', 'topo/persistence', 'topo/persistence-entropy',
    'topo/planar?', 'topo/rips-filtration', 'topo/total-persistence',
    'topo/unknot?', 'topo/vietoris-rips', 'topo/writhe',
  ]
  for (const n of topoExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  // ── 21. part/* — puppetry pose verbs ───────────────────────────────
  const partExtras = [
    'part/bow', 'part/breathe', 'part/expression', 'part/grasp',
    'part/lean', 'part/look-toward', 'part/lower', 'part/nod',
    'part/point', 'part/raise', 'part/reach', 'part/shake',
    'part/shrug', 'part/sway', 'part/tilt', 'part/turn',
    'part/twist', 'part/wave',
  ]
  for (const n of partExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 22. radio/* — live-host verbs ──────────────────────────────────
  const radioExtras = [
    'radio/eq', 'radio/mesh', 'radio/mute', 'radio/next',
    'radio/now-playing', 'radio/pause', 'radio/play', 'radio/prev',
    'radio/stations', 'radio/sync-to-beat', 'radio/toggle',
    'radio/unmute', 'radio/visualize', 'radio/volume',
  ]
  for (const n of radioExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 23. ai/* — policy / decide stubs ───────────────────────────────
  const aiExtras2 = [
    'ai/clear!', 'ai/decide', 'ai/flow-field', 'ai/follow-flow',
    'ai/follow-path', 'ai/grid', 'ai/policy', 'ai/wall!',
  ]
  for (const n of aiExtras2) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  // ── 24. motion/* aliases ───────────────────────────────────────────
  const motionExtras = [
    'motion/anchor-to-input', 'motion/drop', 'motion/follow-input',
    'motion/halt', 'motion/move-to', 'motion/pocket',
    'motion/with-feel', 'motion/with-pace',
  ]
  for (const n of motionExtras) def(n, (...args) => descriptor(n, ...args), 'animate')

  // ── 25. card/* activity verbs ──────────────────────────────────────
  const cardExtras = [
    'card/activity', 'card/activity-done', 'card/activity-progress',
    'card/ask', 'card/audio-pulse', 'card/audio-pulse-off', 'card/do',
  ]
  for (const n of cardExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 26. plot/*, shoppe/*, grid/*, cine/*, eng/*, juggle/* ──────────
  const plotExtras = [
    'plot/fit-grid', 'plot/from-series', 'plot/nice-domain',
    'plot/phase-portrait', 'plot/render-svg', 'plot/vector-field',
    'plot/with',
  ]
  for (const n of plotExtras) def(n, (...args) => descriptor(n, ...args))

  const shoppeExtras = [
    'shoppe/balance', 'shoppe/buy-merch', 'shoppe/buy-pack',
    'shoppe/close', 'shoppe/open', 'shoppe/savings',
    'shoppe/transactions',
  ]
  for (const n of shoppeExtras) def(n, (...args) => descriptor(n, ...args))

  const gridExtras = [
    'grid/card-center', 'grid/clear', 'grid/dot',
    'grid/flower-clear!', 'grid/flower-list', 'grid/flower-move-to!',
    'grid/flower-spawn!', 'grid/flower-state!', 'grid/glow',
  ]
  for (const n of gridExtras) def(n, (...args) => descriptor(n, ...args))

  const cineExtras = [
    'cine/comfort', 'cine/follow', 'cine/following?',
    'cine/shot', 'cine/shots', 'cine/stop',
  ]
  for (const n of cineExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  const engExtras = [
    'eng/beam-reactions', 'eng/bode', 'eng/statics-solve',
    'eng/tf', 'eng/tf-dc-gain', 'eng/tf-stable?',
  ]
  for (const n of engExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  const juggleExtras = [
    'juggle/balls', 'juggle/generate', 'juggle/max-throw',
    'juggle/simulate', 'juggle/state', 'juggle/valid?',
  ]
  for (const n of juggleExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  // ── 27. time/*, input/*, scene/*, system/*, surface/* ──────────────
  const timeExtras2 = [
    'time/across', 'time/delta', 'time/during',
    'time/then', 'time/until', 'time/when',
  ]
  for (const n of timeExtras2) def(n, (...args) => descriptor(n, ...args))

  const inputExtras = [
    'input/buttons', 'input/down?', 'input/may-i?',
    'input/pressed?', 'input/set!',
  ]
  for (const n of inputExtras) {
    if (n.endsWith('?')) def(n, () => false)
    else def(n, (...args) => descriptor(n, ...args))
  }

  const sceneExtras = [
    'scene/clear', 'scene/grid', 'scene/imagine',
    'scene/load', 'scene/spawn-many',
  ]
  for (const n of sceneExtras) def(n, (...args) => descriptor(n, ...args))

  const systemExtras = [
    'system/cards', 'system/health', 'system/registry',
    'system/scheduler', 'system/surface',
  ]
  for (const n of systemExtras) def(n, () => descriptor(n))

  const surfaceExtras = [
    'surface/curtain', 'surface/describe', 'surface/digest',
    'surface/spotlight',
  ]
  for (const n of surfaceExtras) def(n, (...args) => descriptor(n, ...args))

  // ── 28. sprite/*, animation/*, group/*, chem/*, small tails ────────
  def('sprite/address', (id) => descriptor('sprite/address', nm(id)))
  def('sprite/landmarks', (id) => descriptor('sprite/landmarks', nm(id)))
  def('sprite/rasterize', (id) => descriptor('sprite/rasterize', nm(id)))

  def('animation/budget', () => descriptor('animation/budget'))
  def('animation/reflow-policy', () => descriptor('animation/reflow-policy'))
  def('animation/set-reflow-policy', (policy) => descriptor('animation/set-reflow-policy', policy))

  def('group/count', () => 0)
  def('group/each', () => descriptor('group/each'))
  def('group/find', () => descriptor('group/find'))

  const chemAtomicWeights = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, S: 32.06, P: 30.974, Na: 22.99, Cl: 35.45, Fe: 55.845, Au: 196.97 }
  def('chem/atomic-weight', (sym) => chemAtomicWeights[nm(sym)] || 0)
  def('chem/formula-counts', (formula) => {
    const s = String(formula)
    const out = {}
    const re = /([A-Z][a-z]?)(\d*)/g
    let m
    while ((m = re.exec(s)) !== null) {
      if (!m[1]) continue
      out[m[1]] = (out[m[1]] || 0) + (m[2] ? parseInt(m[2], 10) : 1)
    }
    return Object.entries(out).map(([k, v]) => [k, v])
  })
  def('chem/balance', (formula) => descriptor('chem/balance', formula))

  def('artifact/cite', (id) => descriptor('artifact/cite', id))
  def('artifact/delete', (id) => descriptor('artifact/delete', id))
  def('prefab/define', (name, spec) => descriptor('prefab/define', name, spec))
  def('prefab/spawn', (name, x, y) => descriptor('prefab/spawn', name, x, y))
  def('object/fetch', (id) => descriptor('object/fetch', id))
  def('object/spawn', (kind, x, y) => descriptor('object/spawn', kind, x, y))
  def('cadence/may-propose?', () => true)
  def('cadence/plan', (...args) => descriptor('cadence/plan', ...args))
  def('num/nintegrate-2d', (...args) => descriptor('num/nintegrate-2d', ...args))
  def('num/nintegrate-3d', (...args) => descriptor('num/nintegrate-3d', ...args))

  def('domain/of', (thing) => descriptor('domain/of', thing))
  def('floor/problem?', () => false)
  def('base/make-character', (kind) => descriptor('base/make-character', kind))
  def('collision/define-layers!', (layers) => descriptor('collision/define-layers!', layers))
  def('flower/paint', (which, x, y) => descriptor('flower/paint', which, x, y))
  def('pattern/clave', (kind) => descriptor('pattern/clave', kind))
  def('route/off-domain', () => descriptor('route/off-domain'))
  def('text/draw', (s, x, y) => descriptor('text/draw', s, x, y))
  def('transport/tempo', (bpm) => descriptor('transport/tempo', bpm))
  def('weather/conjure', (kind) => descriptor('weather/conjure', kind))
  def('wait', (secs) => descriptor('wait', num(secs)))

  // ── 29. game/* surreals + tic-tac-toe helpers ──────────────────────
  def('game/surreal-lit', (L, R) => ({ kind: 'surreal', L: L || [], R: R || [] }))
  def('game/surreal-add', (a, b) => descriptor('game/surreal-add', a, b))
  def('game/surreal-sub', (a, b) => descriptor('game/surreal-sub', a, b))
  def('game/surreal-mul', (a, b) => descriptor('game/surreal-mul', a, b))
  def('game/surreal-neg', (a) => descriptor('game/surreal-neg', a))
  def('game/surreal-eq?', () => false)
  def('game/surreal-le?', () => false)
  def('game/surreal-is-number?', () => false)
  def('game/surreal-birthday', (a) => descriptor('game/surreal-birthday', a))
  def('game/surreal-simplest', (a, b) => descriptor('game/surreal-simplest', a, b))
  def('game/to-real', () => 0)
  def('game/temperature', (pos) => descriptor('game/temperature', pos))
  def('game/ttt-best-move', (board) => descriptor('game/ttt-best-move', board))
  def('game/ttt-value', () => 0)
  def('game/wythoff-p?', (a, b) => {
    const phi = (1 + Math.sqrt(5)) / 2
    const A = num(a), B = num(b)
    for (let k = 0; k <= Math.max(A, B); k++) {
      if (Math.floor(k * phi) === A && Math.floor(k * phi * phi) === B) return true
      if (Math.floor(k * phi) === B && Math.floor(k * phi * phi) === A) return true
    }
    return false
  })

  return env
}

export default installWiredVerbs
