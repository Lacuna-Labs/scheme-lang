// wired-verbs-priya-i-p.js — real impls for the no-namespace i-p lane.
//
// This is Priya's lane for the wire-596 push (2026-07-14). It runs
// AFTER installWiredVerbs so it can override the shaped-descriptor
// placeholders with real, honest impls.
//
// Doctrine (Alfred): reference IS the language. If a kid types
//   (paint-cell 'world 5 3 'red)
// they deserve a REAL behavior — either the true semantics (when the
// REPL can offer it) or a well-shaped descriptor that a real host
// dispatches, WITH the reference entry clearly marked deferred so the
// kid understands what would happen under the full host.
//
// Scope (77 verbs total, first letter i-p, no namespace):
//   - 7 already-real   — no impl work here
//   - 14 cheap tier    — real REPL-safe impls installed below
//   - 56 deferred      — shaped descriptor from wired-verbs.js stands;
//                        the ENTRY (in docs/staging/verbs-priya-math-b.slat)
//                        marks :impl-status "deferred" with honest notes
//
// The "podcast" cluster (32 verbs) is a browser-side subsystem in the
// full host. Here we ship an in-memory podcast-state model so the
// verbs read and write a consistent shape. That's honest — the state
// is real, the audio playback is deferred to the host. Predicates
// return real booleans; mutators update the model and return sensible
// values; queries read the model.

import { Sym, sym } from './reader.js'
import { getMediaState } from './media.js'

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// ── in-memory podcast state ────────────────────────────────────────
// A single podcast model shared by all podcast-* verbs. In the full
// host this state lives inside a JS podcast player; here we ship a
// plain object with the same shape so the verbs are cohesive.

const podcast = {
  current:          null,      // currently loaded episode alist
  queue:            [],        // list of episode alists
  clips:            [],        // saved clip descriptors
  bookmarks:        [],        // list of guid strings
  subscriptions:    [],        // list of feed-url strings
  followed:         [],        // list of speaker id strings
  mentions:         [],        // recorded mentions
  history:          [],        // guids of episodes played
  briefs:           [],        // saved briefs
  mini_pods:        [],        // saved mini-pod descriptors
  active_constellations: [],   // active listening constellations
  playing:          false,     // playback state
  volume:           0.8,       // 0..1
  muted:            false,
  seek_position:    0,         // seconds
  sleep_timer:      null,      // seconds until sleep, or null
  voice_overlay:    false,
  show_tiers:       {},        // show-id → tier
  episode_actions:  {},        // episode-guid → action list
  rates:            {},        // guid → rating
}

// Reset for tests / initialization
export function resetPodcastState() {
  podcast.current = null
  podcast.queue = []
  podcast.clips = []
  podcast.bookmarks = []
  podcast.subscriptions = []
  podcast.followed = []
  podcast.mentions = []
  podcast.history = []
  podcast.briefs = []
  podcast.mini_pods = []
  podcast.active_constellations = []
  podcast.playing = false
  podcast.volume = 0.8
  podcast.muted = false
  podcast.seek_position = 0
  podcast.sleep_timer = null
  podcast.voice_overlay = false
  podcast.show_tiers = {}
  podcast.episode_actions = {}
  podcast.rates = {}
}

// Read a value out of a keyword alist. Episodes come in shapes like
//   (list :audio-url "..." :guid "..." :title "...")
// so we scan for the keyword and return the following value.
function alistGet(al, key) {
  if (!Array.isArray(al)) return null
  const kName = key instanceof Sym ? key.name : String(key)
  const wantColon = kName.startsWith(':') ? kName : ':' + kName
  const wantBare  = kName.startsWith(':') ? kName.slice(1) : kName
  // Handle both (:key val) pairs and flat keyword-value sequences.
  for (let i = 0; i < al.length - 1; i++) {
    const k = al[i]
    const kStr = k instanceof Sym ? k.name : (typeof k === 'string' ? k : null)
    if (kStr === wantColon || kStr === wantBare) return al[i + 1]
  }
  // Also try the (assoc key alist) shape — list of (key val) pairs.
  for (const item of al) {
    if (Array.isArray(item) && item.length >= 2) {
      const kStr = item[0] instanceof Sym ? item[0].name : (typeof item[0] === 'string' ? item[0] : null)
      if (kStr === wantColon || kStr === wantBare) return item[1]
    }
  }
  return null
}

function guidOf(episode) {
  const g = alistGet(episode, 'guid') || alistGet(episode, ':guid')
  return g ? String(g) : (alistGet(episode, 'audio-url') || alistGet(episode, ':audio-url') || 'unknown')
}

// Standard error triple used by the reference for verbs that document
// (guid | error-triple) as their return.
function errorTriple(kind, msg) { return [sym('error'), sym(kind), String(msg)] }

// ────────────────────────────────────────────────────────────────────
// installWiredVerbsIP(env, fuel) — mutate env in place; run AFTER
// installWiredVerbs so the shaped-descriptor placeholders can be
// overridden with real impls where they exist.
// ────────────────────────────────────────────────────────────────────

export function installWiredVerbsIP(env, _fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── invariants — declaration verb, no runtime effect ─────────────
  // Signature: (invariants rule ...) -> null
  // Documented as consumed by lint/simulator only. Real semantics =
  // return null; no other effect. That's a real, honest impl.
  def('invariants', (..._rules) => null)

  // ── obj-get — safe JS obj property access ────────────────────────
  // Signature: (obj-get object key) -> value | false
  // Symbols coerce to their name; nulls / non-objects return false.
  def('obj-get', (obj, key) => {
    if (obj === null || obj === undefined) return false
    if (typeof obj !== 'object') return false
    const k = key instanceof Sym ? key.name : String(key)
    // Array-of-pairs (Scheme alist) fallback.
    if (Array.isArray(obj)) {
      // Try flat keyword-value shape first.
      for (let i = 0; i < obj.length - 1; i++) {
        const kk = obj[i]
        const kkStr = kk instanceof Sym ? kk.name : (typeof kk === 'string' ? kk : null)
        if (kkStr === k || kkStr === ':' + k) {
          const v = obj[i + 1]
          return (v === undefined || v === null) ? false : v
        }
      }
      // Then (key val) pair shape.
      for (const item of obj) {
        if (Array.isArray(item) && item.length >= 2) {
          const kk = item[0]
          const kkStr = kk instanceof Sym ? kk.name : (typeof kk === 'string' ? kk : null)
          if (kkStr === k) return (item[1] === undefined || item[1] === null) ? false : item[1]
        }
      }
      return false
    }
    // Plain JS object.
    if (!Object.prototype.hasOwnProperty.call(obj, k)) return false
    const v = obj[k]
    return (v === undefined || v === null) ? false : v
  })

  // ── pixels-wide / pixels-tall — framebuffer dimensions ───────────
  // The reference documents these as constants; here they are 0-arg
  // procedures that read the current framebuffer. Called as (pixels-wide)
  // or, per the reference example, referenced by name (via wired-verbs
  // it was a descriptor factory; here it becomes an accessor).
  def('pixels-wide', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.w : 0
  })
  def('pixels-tall', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.h : 0
  })

  // ── list-item-pluck — remove item from a list by id ──────────────
  // The reference documents this as a mutation verb with id-based
  // lookup. In a pure-REPL context there is no ambient "backing list"
  // to mutate. Priya ships a functional variant that works on an
  // explicit list argument: (list-item-pluck lst id) → shorter list.
  // The 1-arg form (id only) used to return a descriptor lie — post
  // the descriptor-shape sweep (2026-07-14) it returns an honest
  // substrate-required error record, matching R7RS §6.11.
  def('list-item-pluck', (...args) => {
    if (args.length === 1) {
      return {
        __sakuraError: true,
        kind: 'substrate-required',
        verb: 'list-item-pluck',
        message: 'ambient list-store host not wired; call (list-item-pluck lst id) with an explicit list',
      }
    }
    if (args.length >= 2 && Array.isArray(args[0])) {
      const [lst, id] = args
      const target = id instanceof Sym ? id.name : String(id)
      return lst.filter(item => {
        // Item id may be a bare symbol or an alist with :id.
        if (item instanceof Sym) return item.name !== target
        if (Array.isArray(item)) {
          const iid = alistGet(item, 'id') || alistGet(item, ':id')
          if (iid) return String(iid instanceof Sym ? iid.name : iid) !== target
        }
        return true
      })
    }
    return Array.isArray(args[0]) ? args[0] : []
  })

  // ── list-item-toss — reorder item within a list ──────────────────
  // Same story as pluck: pure form (lst id from to) or an honest
  // substrate-required error for the ambient-store host case.
  def('list-item-toss', (...args) => {
    if (args.length === 3) {
      return {
        __sakuraError: true,
        kind: 'substrate-required',
        verb: 'list-item-toss',
        message: 'ambient list-store host not wired; call (list-item-toss lst id from to) with an explicit list',
      }
    }
    if (args.length >= 4 && Array.isArray(args[0])) {
      const [lst, _id, fromI, toI] = args
      const from = num(fromI) | 0, to = num(toI) | 0
      if (from < 0 || from >= lst.length) return lst
      if (to < 0 || to >= lst.length) return lst
      const copy = lst.slice()
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    }
    return Array.isArray(args[0]) ? args[0] : []
  })

  // ── note-dots — parse a dotted-note duration → base duration ─────
  // Music-theory helper. Given a note duration symbol like 'quarter or
  // 'quarter-dot or 'quarter-dot-dot, return a numeric multiplier
  // relative to a whole note. This is pure math and safe in REPL.
  //
  // 'whole -> 1, 'half -> 1/2, 'quarter -> 1/4, ...
  // A single dot adds 50%; two dots add 75%; three add 87.5%.
  def('note-dots', (durationSym) => {
    const name = String(nm(durationSym) || 'quarter')
    // Peel off trailing "-dot" or "." markers.
    let base = name, dots = 0
    while (base.endsWith('-dot')) { dots++; base = base.slice(0, -4) }
    while (base.endsWith('.')) { dots++; base = base.slice(0, -1) }
    const baseMap = {
      'whole': 1, 'half': 1/2, 'quarter': 1/4, 'eighth': 1/8,
      'sixteenth': 1/16, 'thirty-second': 1/32, 'sixty-fourth': 1/64,
    }
    const b = baseMap[base] != null ? baseMap[base] : 1/4
    // Each dot adds half the previous value.
    let mult = 1, add = 0.5
    for (let i = 0; i < dots; i++) { mult += add; add /= 2 }
    return b * mult
  })

  // ── land-on-downbeat — quantize a beat offset to next downbeat ───
  // Music-theory helper. Given a beat offset (fractional) and a bar
  // length (default 4 beats), return the next integer beat that is a
  // multiple of the bar length. Pure math, REPL-safe.
  def('land-on-downbeat', (offset, barLen = 4) => {
    const o = num(offset), b = num(barLen) || 4
    if (o <= 0) return 0
    return Math.ceil(o / b) * b
  })

  // ── interrupted — predicate, honest #f in headless REPL ──────────
  // Reference documents this as a predicate over the current input /
  // event queue. In headless REPL nothing is ever interrupted; return
  // #f honestly.
  def('interrupted', () => false)

  // ── in-formation — predicate for character formation state ───────
  // Same story: headless REPL has no live formation; honest #f.
  def('in-formation', () => false)

  // ── podcast-* (state-model impls) ────────────────────────────────
  // Real state operations. Playback is a flag; the host wires audio.
  // Every predicate returns a real boolean read from the model.
  // Every mutator updates the model and returns a sensible value.

  def('podcast-load', (episode) => {
    if (!Array.isArray(episode)) return errorTriple('bad-episode', 'expected an alist')
    const url = alistGet(episode, 'audio-url') || alistGet(episode, ':audio-url')
    if (!url) return errorTriple('missing-audio-url', 'episode alist requires :audio-url')
    podcast.current = episode
    podcast.playing = false
    podcast.seek_position = 0
    const g = guidOf(episode)
    if (!podcast.history.includes(g)) podcast.history.push(g)
    return g
  })

  def('podcast-play', (episode) => {
    if (episode !== undefined) {
      const r = env.vars.get('podcast-load')(episode)
      if (Array.isArray(r) && r[0] instanceof Sym && r[0].name === 'error') return r
    }
    if (!podcast.current) return errorTriple('nothing-loaded', 'call podcast-load first')
    podcast.playing = true
    return guidOf(podcast.current)
  })

  def('podcast-pause', () => {
    podcast.playing = false
    return podcast.current ? guidOf(podcast.current) : false
  })

  def('podcast-resume', () => {
    if (!podcast.current) return errorTriple('nothing-loaded', 'call podcast-load first')
    podcast.playing = true
    return guidOf(podcast.current)
  })

  def('podcast-seek', (position) => {
    const p = num(position)
    if (p < 0) return errorTriple('bad-position', 'position must be >= 0')
    podcast.seek_position = p
    return p
  })

  def('podcast-volume', (v) => {
    if (v === undefined) return podcast.volume
    const vv = num(v)
    podcast.volume = Math.max(0, Math.min(1, vv))
    return podcast.volume
  })

  def('podcast-muted?', () => podcast.muted)

  def('podcast-current', () => podcast.current || false)

  def('podcast-state', () => [
    [sym('playing'), podcast.playing],
    [sym('muted'), podcast.muted],
    [sym('volume'), podcast.volume],
    [sym('position'), podcast.seek_position],
    [sym('current-guid'), podcast.current ? guidOf(podcast.current) : false],
    [sym('queue-length'), podcast.queue.length],
  ])

  def('podcast-queue', () => podcast.queue.slice())
  def('podcast-queue-add', (episode) => {
    if (!Array.isArray(episode)) return errorTriple('bad-episode', 'expected an alist')
    podcast.queue.push(episode)
    return podcast.queue.length
  })
  def('podcast-queue-remove', (episode) => {
    if (!Array.isArray(episode)) return errorTriple('bad-episode', 'expected an alist')
    const g = guidOf(episode)
    const before = podcast.queue.length
    podcast.queue = podcast.queue.filter(e => guidOf(e) !== g)
    return before - podcast.queue.length
  })

  def('podcast-subscribe', (feedUrl) => {
    const u = String(nm(feedUrl))
    if (!podcast.subscriptions.includes(u)) podcast.subscriptions.push(u)
    return podcast.subscriptions.length
  })
  def('podcast-unsubscribe', (feedUrl) => {
    const u = String(nm(feedUrl))
    const before = podcast.subscriptions.length
    podcast.subscriptions = podcast.subscriptions.filter(s => s !== u)
    return before - podcast.subscriptions.length
  })
  def('podcast-is-subscribed?', (feedUrl) => {
    const u = String(nm(feedUrl))
    return podcast.subscriptions.includes(u)
  })
  def('podcast-subscriptions', () => podcast.subscriptions.slice())

  def('podcast-follow-speaker', (speakerId) => {
    const s = String(nm(speakerId))
    if (!podcast.followed.includes(s)) podcast.followed.push(s)
    return podcast.followed.length
  })
  def('podcast-unfollow-speaker', (speakerId) => {
    const s = String(nm(speakerId))
    const before = podcast.followed.length
    podcast.followed = podcast.followed.filter(f => f !== s)
    return before - podcast.followed.length
  })
  def('podcast-followed-speakers', () => podcast.followed.slice())

  def('podcast-bookmark', (guid) => {
    const g = String(nm(guid))
    if (!podcast.bookmarks.includes(g)) podcast.bookmarks.push(g)
    return podcast.bookmarks.length
  })

  def('podcast-clips', () => podcast.clips.slice())
  def('podcast-save-clip', (clip) => {
    if (!Array.isArray(clip)) return errorTriple('bad-clip', 'expected an alist')
    podcast.clips.push(clip)
    return podcast.clips.length
  })
  def('podcast-delete-clip', (clipId) => {
    const id = String(nm(clipId))
    const before = podcast.clips.length
    podcast.clips = podcast.clips.filter(c => {
      const cid = alistGet(c, 'id') || alistGet(c, ':id') || alistGet(c, 'guid') || alistGet(c, ':guid')
      return cid ? String(cid instanceof Sym ? cid.name : cid) !== id : true
    })
    return before - podcast.clips.length
  })

  def('podcast-rate', (guid, rating) => {
    const g = String(nm(guid))
    const r = num(rating)
    podcast.rates[g] = r
    return r
  })

  def('podcast-save-brief', (brief) => {
    if (!Array.isArray(brief)) return errorTriple('bad-brief', 'expected an alist')
    podcast.briefs.push(brief)
    return podcast.briefs.length
  })

  def('podcast-save-mini-pod', (miniPod) => {
    if (!Array.isArray(miniPod)) return errorTriple('bad-mini-pod', 'expected an alist')
    podcast.mini_pods.push(miniPod)
    return podcast.mini_pods.length
  })

  def('podcast-clear-history', () => {
    const n = podcast.history.length
    podcast.history = []
    return n
  })

  def('podcast-record-mention', (mention) => {
    if (!Array.isArray(mention) && typeof mention !== 'string') {
      return errorTriple('bad-mention', 'expected alist or string')
    }
    podcast.mentions.push(mention)
    return podcast.mentions.length
  })

  def('podcast-episode-actions', (guid) => {
    const g = String(nm(guid))
    return podcast.episode_actions[g] || []
  })

  def('podcast-record-episode-actions', (guid, actions) => {
    const g = String(nm(guid))
    podcast.episode_actions[g] = Array.isArray(actions) ? actions.slice() : []
    return podcast.episode_actions[g].length
  })

  def('podcast-dismiss-episode-actions', (guid) => {
    const g = String(nm(guid))
    const had = !!podcast.episode_actions[g]
    delete podcast.episode_actions[g]
    return had
  })

  def('podcast-set-show-tier', (showId, tier) => {
    const s = String(nm(showId))
    const t = String(nm(tier))
    podcast.show_tiers[s] = t
    return t
  })

  def('podcast-resolve-tier', (showId) => {
    const s = String(nm(showId))
    const t = podcast.show_tiers[s]
    return t ? sym(t) : sym('free')
  })

  def('podcast-publish-insight', (insight) => {
    if (!Array.isArray(insight) && typeof insight !== 'string') {
      return errorTriple('bad-insight', 'expected alist or string')
    }
    // In the full host, this posts to the insight feed. Here we track
    // it in mentions since insights are a form of mention.
    podcast.mentions.push([sym('insight'), insight])
    return podcast.mentions.length
  })

  def('podcast-sleep', (seconds) => {
    if (seconds === undefined || seconds === null) {
      podcast.sleep_timer = null
      return false
    }
    const s = num(seconds)
    if (s <= 0) { podcast.sleep_timer = null; return false }
    podcast.sleep_timer = s
    return s
  })

  def('podcast-voice-overlay-enable', (enable) => {
    podcast.voice_overlay = enable !== false
    return podcast.voice_overlay
  })

  def('podcast-active-constellations', () => podcast.active_constellations.slice())

  // ── invariants aside — none of the paint-*, motion-*, on-canvas-*,
  //    move-card, orient-card, layout-bricklay!, make-character,
  //    nav-map, measure-content, imagine, note-strike/release/place*
  //    fit "REPL-safe real semantics" — those all require a live
  //    subsystem (framebuffer surface, input runtime, card runtime,
  //    music engine). The shaped-descriptor from wired-verbs.js is
  //    the honest fallback for those. The entries mark them
  //    :impl-status "deferred" with honest :impl-notes explaining the
  //    host's role.

  // ── measure-content — return honest zero-dimensions alist ────────
  // Documented return: ((w N) (h N)) alist. In headless REPL the card
  // has no rendered content, so honest return is ((w 0) (h 0)).
  def('measure-content', (_id) => [
    [sym('w'), 0],
    [sym('h'), 0],
  ])
}

export default installWiredVerbsIP
