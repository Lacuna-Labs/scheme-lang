// The base vocabulary — the only "library" the interpreter gets.
//
// Pure, total, side-effect-free functions over numbers and lists. Anything
// that touches the world (sprites, the shop) is injected separately and
// gated. Higher-order prims (for-each, map) re-enter the evaluator through
// `apply`, so they share the same fuel budget — no way to escape the cap.

import { Env, apply, Closure } from './interp.js'
import { Sym } from './reader.js'
// Adapter interface — dialect layers can override via setAdapters().
// Base ships no-op stubs so standalone REPL works out of the box.
import {
  bricklayCacheKey,
  bricklayCacheGet,
  bricklayCacheSet,
} from './adapters.js'

export function makeBaseEnv(fuel) {
  const e = new Env()
  // The base vocabulary is the language layer — math, predicates, list
  // ops, string ops. Every binding is a pure value transform with no
  // app-state side effects; perm `read` per CARD-MANIFEST-CONTRACT §3.2.
  // The third arg is now mandatory at the audit level (the warming
  // wrapper at interp.js logs a warn otherwise); the `def` helper
  // defaults the perm so we don't repeat it at every line.
  const def = (n, f, perm = 'read') => e.define(n, f, { perm })

  def('+', (...a) => a.reduce((x, y) => x + y, 0))
  def('-', (...a) => (a.length === 1 ? -a[0] : a.reduce((x, y) => x - y)))
  def('*', (...a) => a.reduce((x, y) => x * y, 1))
  def('/', (...a) => (a.length === 1 ? 1 / a[0] : a.reduce((x, y) => x / y)))
  def('modulo', (x, y) => ((x % y) + y) % y)
  def('quotient', (x, y) => Math.trunc(x / y))   // integer division — standard Scheme
  def('remainder', (x, y) => x - Math.trunc(x / y) * y)
  def('max', (...a) => Math.max(...a))
  def('min', (...a) => Math.min(...a))
  def('abs', (x) => Math.abs(x))

  def('=', (a, b) => a === b)
  def('<', (a, b) => a < b)
  def('>', (a, b) => a > b)
  def('<=', (a, b) => a <= b)
  def('>=', (a, b) => a >= b)
  def('not', (a) => a === false)

  def('list', (...a) => a)
  def('cons', (a, b) => [a, ...(Array.isArray(b) ? b : [b])])
  def('car', (a) => a[0])
  def('cdr', (a) => a.slice(1))
  // Standard Scheme convenience accessors — second + third elements.
  // Saves the conway.sks additive-blend code from repeated `(car (cdr ...))`.
  def('cadr', (a) => a[1])
  def('caddr', (a) => a[2])
  def('null?', (a) => Array.isArray(a) && a.length === 0)
  // R7RS §6.4 / §6.3 / §6.5 — the load-bearing type predicates the spec
  // expects every Scheme to bind. `pair?` is true on a NON-empty list
  // (Curator represents cons cells as JS arrays, so a pair is any array
  // with at least one element). `symbol?` is true on a `Sym` reader
  // token. `procedure?` is true on anything callable — JS functions
  // (primitives) or `Closure` instances (user lambdas).
  def('pair?', (a) => Array.isArray(a) && a.length > 0)
  def('symbol?', (a) => a instanceof Sym)
  def('procedure?', (a) => typeof a === 'function' || a instanceof Closure)
  def('length', (a) => a.length)
  def('range', (a, b) => { const r = []; for (let i = a; i < b; i++) r.push(i); return r })

  def('for-each', (fn, lst) => { for (const x of lst) apply(fn, [x], fuel); return undefined })
  def('map', (fn, lst) => lst.map((x) => apply(fn, [x], fuel)))
  def('filter', (fn, lst) => lst.filter((x) => apply(fn, [x], fuel) !== false))
  def('reduce', (fn, init, lst) => lst.reduce((acc, x) => apply(fn, [acc, x], fuel), init))
  def('fold', (fn, init, lst) => lst.reduce((acc, x) => apply(fn, [acc, x], fuel), init))
  def('fold-left', (fn, init, lst) => lst.reduce((acc, x) => apply(fn, [acc, x], fuel), init))
  def('foldl', (fn, init, lst) => lst.reduce((acc, x) => apply(fn, [acc, x], fuel), init))
  def('fold-right', (fn, init, lst) => lst.reduceRight((acc, x) => apply(fn, [x, acc], fuel), init))
  def('foldr', (fn, init, lst) => lst.reduceRight((acc, x) => apply(fn, [x, acc], fuel), init))
  // (apply fn args) — invoke `fn` with the list `args` as the argument
  // list. Same fuel budget as a direct call.
  def('apply', (fn, args) => apply(fn, Array.isArray(args) ? args : [args], fuel))

  // (=? a b) — smart equality. The PICO-8-style "do what I mean" verb:
  //   * numbers compare by value (===)
  //   * strings compare by value (===)
  //   * lists compare structurally (deep, length-aware)
  //   * symbols compare by name
  //   * everything else falls through to reference equality
  // Replaces the long-running confusion between eq? / eqv? / equal? in
  // the canon Schemes (per Dr. Imani's PICO-8 research pass —
  // beginners cite this as the #1 surprise). Use `=?` everywhere and
  // it just works; the verbose forms stay for the few cases that need
  // them.
  function _eqQ(a, b) {
    if (a === b) return true
    if (a == null || b == null) return false
    // Sym comparison by .name (reader interns these consistently).
    if (a && b && typeof a === 'object'
        && 'name' in a && 'name' in b
        && Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
        && typeof a.name === 'string') {
      return a.name === b.name
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (!_eqQ(a[i], b[i])) return false
      return true
    }
    return false
  }
  def('=?', _eqQ)
  // Legacy spellings — Scheme tradition; same behaviour as `=?` so
  // operators coming from Racket/Chez/Chicken aren't surprised.
  def('equal?', _eqQ)
  def('eq?', _eqQ)

  // (inspect x) — walk any value and return a flat, readable string
  // suitable for `(text ...)` or `(display)`. The runtime
  // inspector PICO-8 authors keep asking for; pretty-prints lists,
  // truncates strings, marks closures as `<fn>`.
  function _show(v, depth = 0) {
    if (v === undefined) return 'nil'
    if (v === false) return '#f'
    if (v === true) return '#t'
    if (v === null) return 'null'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') {
      return v.length > 80 ? JSON.stringify(v.slice(0, 80)) + '…' : JSON.stringify(v)
    }
    if (typeof v === 'function') return '<fn>'
    if (v instanceof Closure) return '<fn>'
    if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
        && Object.keys(v).length === 1) return v.name
    if (Array.isArray(v)) {
      if (depth > 4) return '(…)'
      const inner = v.slice(0, 12).map((x) => _show(x, depth + 1)).join(' ')
      const tail = v.length > 12 ? ' …' : ''
      return '(' + inner + tail + ')'
    }
    if (typeof v === 'object') {
      if (depth > 3) return '{…}'
      const entries = Object.entries(v).slice(0, 8)
        .map(([k, vv]) => `${k}: ${_show(vv, depth + 1)}`)
      return '{' + entries.join(', ')
        + (Object.keys(v).length > 8 ? ', …' : '') + '}'
    }
    return String(v)
  }
  def('inspect', (v) => _show(v))

  // ── SRFI 1 essentials (per Dr. Imani's research — what every Scheme
  // author reaches for first; we already have map/filter/reduce/append/
  // reverse/first/last/nth; add the remainder so a cart authored in
  // any other Scheme runs here without a port).
  def('any', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (const x of lst) if (apply(pred, [x], fuel) !== false) return true
    return false
  })
  def('every', (pred, lst) => {
    if (!Array.isArray(lst)) return true
    for (const x of lst) if (apply(pred, [x], fuel) === false) return false
    return true
  })
  def('count', (pred, lst) => {
    if (!Array.isArray(lst)) return 0
    let n = 0
    for (const x of lst) if (apply(pred, [x], fuel) !== false) n++
    return n
  })
  def('take', (lst, n) => Array.isArray(lst) ? lst.slice(0, Math.max(0, n|0)) : [])
  def('drop', (lst, n) => Array.isArray(lst) ? lst.slice(Math.max(0, n|0)) : [])
  def('zip', (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return []
    const n = Math.min(a.length, b.length)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = [a[i], b[i]]
    return out
  })
  def('append', (...ls) => [].concat(...ls))
  def('reverse', (a) => a.slice().reverse())
  def('first', (a) => a[0])
  def('last', (a) => a[a.length - 1])
  def('nth', (a, i) => a[i])

  // ── more math ───────────────────────────────────────────────────────
  def('sqrt', (x) => Math.sqrt(x))
  def('cos', (x) => Math.cos(x))
  def('sin', (x) => Math.sin(x))
  def('tan', (x) => Math.tan(x))
  def('atan2', (y, x) => Math.atan2(y, x))
  def('pi', Math.PI)                            // (pi) → 3.14159…
  def('expt', (b, p) => Math.pow(b, p))
  def('floor', (x) => Math.floor(x))
  def('ceil', (x) => Math.ceil(x))
  // R7RS §6.2.6 spells it `ceiling`. We keep `ceil` as the short-form
  // alias the cart authors learned first; both point to the same impl.
  def('ceiling', (x) => Math.ceil(x))
  def('round', (x) => Math.round(x))
  def('round2', (x) => Math.round(x * 100) / 100)   // money-friendly
  def('sign', (x) => Math.sign(x))
  def('clamp', (x, lo, hi) => Math.min(hi, Math.max(lo, x)))
  def('lerp', (a, b, t) => a + (b - a) * t)
  // `rng-uniform` is the BASE, non-deterministic uniform in [0,1). It is
  // intentionally NOT named `random`: the cards runtime (runWithCards)
  // binds a SEEDED `random` on top so cart replay is byte-identical.
  // run()/runSurface() don't install the seeded rng, so they reach the
  // uniform under this name. See [[curator-publish-architecture]] /
  // cartReplayer determinism note. (A1 fix, 2026-06-11)
  def('rng-uniform', () => Math.random())
  def('randint', (a, b) => a + Math.floor(Math.random() * (b - a)))
  // Racket-style aliases — friendlier names that Scheme-ers reach for.
  // `(random-int n)` → 0..n-1.  `(random-range lo hi)` → uniform float
  // in [lo, hi).  `(random-pick lst)` → an element of the list.
  def('random-int', (n) => Math.floor(Math.random() * Math.max(1, n | 0)))
  def('random-range', (lo, hi) => lo + Math.random() * (hi - lo))
  def('random-pick', (lst) => (lst && lst.length ? lst[Math.floor(Math.random() * lst.length)] : null))
  def('sum', (lst) => lst.reduce((x, y) => x + y, 0))
  def('mean', (lst) => (lst.length ? lst.reduce((x, y) => x + y, 0) / lst.length : 0))

  // ── finance ─────────────────────────────────────────────────────────
  def('pct', (a, b) => (b === 0 ? 0 : (a / b) * 100))                 // a as % of b
  def('pct-change', (oldV, newV) => (oldV === 0 ? 0 : ((newV - oldV) / oldV) * 100))
  def('margin', (price, cost) => (price === 0 ? 0 : ((price - cost) / price) * 100))
  def('markup', (cost, pctUp) => cost * (1 + pctUp / 100))
  def('markdown', (price, pctOff) => price * (1 - pctOff / 100))
  def('profit', (revenue, cost) => revenue - cost)
  def('fee', (amount, ratePct) => amount * (ratePct / 100))
  def('net', (gross, ...fees) => gross - fees.reduce((x, y) => x + y, 0))
  def('cagr', (begin, end, years) => (begin <= 0 || years <= 0 ? 0 : (Math.pow(end / begin, 1 / years) - 1) * 100))
  def('sma', (lst, n) => {            // simple moving average → array
    const out = []
    for (let i = n - 1; i < lst.length; i++) {
      let s = 0
      for (let j = i - n + 1; j <= i; j++) s += lst[j]
      out.push(s / n)
    }
    return out
  })

  // ── thresholds (over values/series the host provides) ───────────────
  def('above?', (x, t) => x > t)
  def('below?', (x, t) => x < t)
  def('crossed?', (prev, now, t) => (prev <= t && now > t) || (prev >= t && now < t))

  // ── collisions (the game kit) ───────────────────────────────────────
  def('dist', (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1))
  def('near?', (x1, y1, x2, y2, r) => Math.hypot(x2 - x1, y2 - y1) <= r)
  def('in-rect?', (px, py, x, y, w, h) => px >= x && px < x + w && py >= y && py < y + h)
  def('overlap?', (x1, y1, w1, h1, x2, y2, w2, h2) =>
    x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1)

  // ── equality, predicates, strings, lookup ───────────────────────────
  def('eq?', (a, b) => a === b)
  def('equal?', (a, b) => deepEqual(a, b))
  def('zero?', (x) => x === 0)
  def('positive?', (x) => x > 0)
  def('negative?', (x) => x < 0)
  def('even?', (x) => x % 2 === 0)
  def('odd?', (x) => Math.abs(x % 2) === 1)
  def('number?', (x) => typeof x === 'number')
  def('string?', (x) => typeof x === 'string')
  def('boolean?', (x) => x === true || x === false)
  def('string-append', (...a) => a.map(String).join(''))
  def('string-length', (s) => String(s).length)
  def('string-ref', (s, i) => String(s).charAt(i))   // → single-char string
  def('string-eq?', (a, b) => String(a) === String(b))
  def('string=?', (a, b) => String(a) === String(b))
  def('vector-ref', (v, i) => (Array.isArray(v) ? v[i] : null))
  def('substring', (s, a, b = undefined) => String(s).substring(a, b))
  def('number->string', (n, radix) => {
    // Standard Scheme: (number->string n [radix]). Default radix 10.
    // Radix 16 emits lowercase hex (matches the `"#rrggbb"` convention).
    const r = (typeof radix === 'number') ? (radix | 0) : 10
    return Number(n).toString(r)
  })
  def('string->number', (s, radix) => {
    // Standard Scheme: (string->number s [radix]). Default radix 10.
    // Hex parsing supports both bare "ff" and "0xff" forms.
    const r = (typeof radix === 'number') ? (radix | 0) : 10
    if (r === 10) {
      const n = parseFloat(s)
      return Number.isNaN(n) ? false : n
    }
    const str = String(s).trim()
    const n = parseInt(str.startsWith('0x') || str.startsWith('0X') ? str.slice(2) : str, r)
    return Number.isNaN(n) ? false : n
  })
  // (hex-byte "#rrggbb" i) → 0..255. Convenience for the conway.sks
  // additive-blend code — reads 2 hex chars at offset i without forcing
  // operators to remember the radix argument to string->number.
  def('hex-byte', (s, i) => {
    const n = parseInt(String(s).substr(i, 2), 16)
    return Number.isNaN(n) ? 0 : n
  })
  // (byte->hex n) → 2-char lowercase hex string. Pads single digits.
  def('byte->hex', (n) => {
    const v = Math.max(0, Math.min(255, n | 0)).toString(16)
    return v.length === 1 ? '0' + v : v
  })
  def('list-ref', (a, i) => a[i])
  def('member', (x, lst) => { const i = lst.findIndex((y) => deepEqual(x, y)); return i < 0 ? false : lst.slice(i) })
  def('assoc', (key, alist) => alist.find((pair) => Array.isArray(pair) && deepEqual(pair[0], key)) || false)
  def('list?', (a) => Array.isArray(a))

  // ── I/O — display / newline / write / print / println / error / exit ─
  //
  // Node uses process.stdout.write; browser bundle falls back to
  // console.log (which adds its own newline, but the browser REPL
  // captures results separately so this is acceptable).
  const _write = (s) => {
    if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
      process.stdout.write(s)
    } else if (typeof console !== 'undefined' && console.log) {
      console.log(s)
    }
  }
  def('display', (v) => {
    _write(typeof v === 'string' ? v : _show(v))
    return undefined
  })
  def('newline', () => { _write('\n'); return undefined })
  def('write', (v) => { _write(_show(v)); return undefined })
  def('print',   (v) => { _write((typeof v === 'string' ? v : _show(v)) + '\n'); return undefined })
  def('println', (v) => { _write((typeof v === 'string' ? v : _show(v)) + '\n'); return undefined })
  def('error', (msg, ...rest) => {
    const parts = [String(msg ?? ''), ...rest.map((v) => _show(v))]
    throw new Error(parts.join(' '))
  })
  def('exit', (code = 0) => {
    if (typeof process !== 'undefined' && process.exit) process.exit(code | 0)
    return undefined
  })

  // ── extra string ops — the things anyone touching text reaches for ──
  def('string-upcase',      (s) => String(s).toUpperCase())
  def('string-downcase',    (s) => String(s).toLowerCase())
  def('string-trim',        (s) => String(s).trim())
  def('string-contains?',   (haystack, needle) => String(haystack).includes(String(needle)))
  def('string-starts-with?',(s, prefix) => String(s).startsWith(String(prefix)))
  def('string-ends-with?',  (s, suffix) => String(s).endsWith(String(suffix)))
  def('string-replace',     (s, from, to) => String(s).split(String(from)).join(String(to)))
  def('string-split',       (s, sep) => String(s).split(String(sep)))
  def('string-join',        (lst, sep = '') => lst.map(String).join(String(sep)))
  def('string->list',       (s) => String(s).split(''))
  def('list->string',       (lst) => lst.join(''))
  def('string-reverse',     (s) => String(s).split('').reverse().join(''))

  // ── list-builders the layout carts reach for ────────────────────────
  //
  // bricklay tracks a vector of column bottoms and updates it as cards
  // land. We expose the SRFI-1-friendly trio that makes that ergonomic:
  //
  //   (make-list n value)    → a fresh list of length n filled with value
  //   (list-set lst i value) → a NEW list with element i replaced (pure;
  //                            the source list is not mutated — matches
  //                            the immutable shape Scheme code is already
  //                            written in here)
  //   (list-index pred lst)  → index of the first element where (pred x)
  //                            is true, or #f. SRFI-1 standard.
  //   (argmin lst)           → index of the smallest number in lst
  //                            (ties: leftmost wins). The bricklay packer
  //                            uses this to pick the shortest column.
  //   (sort lst less?)       → a NEW list sorted ascending under the
  //                            two-arg less? predicate. Stable.
  def('make-list', (n, value) => {
    const k = Math.max(0, n | 0)
    const out = new Array(k)
    for (let i = 0; i < k; i++) out[i] = value
    return out
  })
  def('list-set', (lst, i, value) => {
    if (!Array.isArray(lst)) return lst
    const out = lst.slice()
    if (i >= 0 && i < out.length) out[i] = value
    return out
  })
  def('list-index', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (let i = 0; i < lst.length; i++) {
      if (apply(pred, [lst[i]], fuel) !== false) return i
    }
    return false
  })
  def('argmin', (lst) => {
    if (!Array.isArray(lst) || lst.length === 0) return false
    let best = 0
    let bestV = lst[0]
    for (let i = 1; i < lst.length; i++) {
      if (lst[i] < bestV) { bestV = lst[i]; best = i }
    }
    return best
  })
  def('sort', (lst, less) => {
    if (!Array.isArray(lst)) return lst
    // Decorate-sort-undecorate so JS Array.sort can be stable on the
    // shared key while honouring the user's less? predicate.
    const indexed = lst.map((v, i) => [v, i])
    indexed.sort((a, b) => {
      const ab = apply(less, [a[0], b[0]], fuel) !== false
      const ba = apply(less, [b[0], a[0]], fuel) !== false
      if (ab && !ba) return -1
      if (ba && !ab) return 1
      return a[1] - b[1]   // stable
    })
    return indexed.map((p) => p[0])
  })

  // ── bricklay-pack-native — JS-backed bottom-left bin-pack (#414) ─────
  //
  // The Scheme cart `carts/layout/bricklay.sks` used to run a pure-Scheme
  // FFD bottom-left fill — O(N³)-in-Scheme-primitives because every
  // (cdr ...) sliced a fresh list, every (cons …) reallocated, and the
  // overlap walk and candidate regeneration each cost O(N) per card.
  // The 22-card production roster needed 4M fuel to land.
  //
  // This primitive lifts the *algorithm* into JS so the per-step cost
  // collapses to native array ops. The cart calls this once with its
  // sorted card list (sort is already JS) and dispatches `move-card`
  // for each (id x y) the primitive returns. Output is byte-identical
  // to the prior Scheme implementation on every existing fixture; only
  // the cost changes.
  //
  // Algorithm — preserved exactly so tests pass byte-for-byte:
  //   1. Iterate cards in input order (caller sorts via FFD).
  //   2. Build candidate anchors: origin at the head, then
  //      `right-of-P` and `below-of-P` for each placed P in reverse
  //      placement order (newest first — matches the cart's cons-onto-
  //      head ordering exactly).
  //   3. Valid: x≥MARGIN, y≥MARGIN, x+w ≤ vw-MARGIN, no rect overlap.
  //   4. Best: first valid candidate becomes best; replace only on
  //      strict (cy<by) || (cy==by && cx<bx). First-in-order wins ties.
  //   5. Fallback: (MARGIN, max-bottom + GAP-Y).
  //
  // Inputs:
  //   cards    — list of (id w h) triples; caller pre-sorts.
  //   vw       — viewport width (effective, after canvas-min clamp).
  //   marginX  — left/right margin (BRICKLAY-MARGIN).
  //   marginY  — top margin (BRICKLAY-MARGIN).
  //   gapX     — horizontal gap (BRICKLAY-GAP-X).
  //   gapY     — vertical gap   (BRICKLAY-GAP-Y).
  //
  // Output: list of (id x y) triples in placement order.
  //
  // Complexity: O(N²). Each placement adds 2 anchors (total 2N+1), each
  // selection scans those anchors and tests each against placed cards
  // (O(N) anchors × O(N) overlap = O(N²) per card → O(N³) WORST-CASE
  // but the JS overhead is two orders of magnitude smaller than the
  // Scheme equivalent — see bricklay.test.js benchmark notes).
  def('bricklay-pack-native', (cards, vw, marginX, marginY, gapX, gapY) => {
    if (!Array.isArray(cards) || cards.length === 0) return []
    // ── Memoization (#415) ───────────────────────────────────────────
    // The packer is deterministic — same input, same output. Cache by a
    // 32-bit FNV hash over the canonical (rows, vw, margins, gaps) key.
    // A hit returns the placement list straight from the cache; a miss
    // computes + stores. The cache is bounded (32 entries, LRU) and is
    // invalidated by `bricklayCacheClear()` whenever the host detects a
    // size/priority change. See bricklayCache.js.
    const cacheKey = bricklayCacheKey(cards, vw, marginX, marginY, gapX, gapY)
    if (cacheKey != null) {
      const cached = bricklayCacheGet(cacheKey)
      if (cached) return cached
    }
    // Parallel arrays for placed-card geometry. Avoids tuple allocation
    // per placement and keeps the overlap walk on flat number arrays.
    const px = new Array(cards.length)
    const py = new Array(cards.length)
    const pw = new Array(cards.length)
    const ph = new Array(cards.length)
    let placedCount = 0
    // Anchor buffer. Two new anchors per placement = 2N capacity, plus
    // the origin seed. We never remove entries — the validity check
    // prunes per-iteration.
    const ax = new Array(cards.length * 2 + 1)
    const ay = new Array(cards.length * 2 + 1)
    let anchorCount = 0
    const out = []

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      if (!Array.isArray(c)) continue
      const id = c[0]
      const w = +c[1]
      const h = +c[2]
      if (!isFinite(w) || !isFinite(h)) continue

      // ── Build the candidate list in the cart's iteration order. ────
      // The cart visits anchors in the order [origin, right(newest),
      // below(newest), right(2nd-newest), below(2nd-newest), …]. We
      // mirror that by walking placed in reverse-placement order.
      // For performance we don't materialise the candidate list — we
      // scan and pick the best inline.
      let bestX = 0, bestY = 0, haveBest = false

      // (a) origin anchor.
      {
        const cx = marginX, cy = marginY
        if (cx + w <= vw - marginX && !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
          bestX = cx; bestY = cy; haveBest = true
        }
      }
      // (b) per-placed anchors, walking newest→oldest (cart's order).
      for (let j = placedCount - 1; j >= 0; j--) {
        // right-of-P
        {
          const cx = px[j] + pw[j] + gapX
          const cy = py[j]
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
        // below-of-P
        {
          const cx = px[j]
          const cy = py[j] + ph[j] + gapY
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
      }

      // (c) Fallback row when no candidate fits — wide card on narrow
      // viewport. (MARGIN, max-bottom + GAP-Y). max-bottom seeded with
      // marginY so a first-card-too-wide still lands at (M, M + gapY).
      if (!haveBest) {
        let maxBottom = marginY
        for (let j = 0; j < placedCount; j++) {
          const b = py[j] + ph[j]
          if (b > maxBottom) maxBottom = b
        }
        bestX = marginX
        bestY = maxBottom + gapY
      }

      // Commit.
      px[placedCount] = bestX
      py[placedCount] = bestY
      pw[placedCount] = w
      ph[placedCount] = h
      placedCount += 1
      // anchor buffer maintenance (kept for completeness even though we
      // don't read it — keeps the API surface honest if a future caller
      // wants the anchor history).
      ax[anchorCount] = bestX + w + gapX; ay[anchorCount] = bestY; anchorCount += 1
      ax[anchorCount] = bestX;            ay[anchorCount] = bestY + h + gapY; anchorCount += 1
      out.push([id, bestX, bestY])
    }
    if (cacheKey != null) bricklayCacheSet(cacheKey, out)
    return out
  })

  return e
}

// rectOverlapsAny — strict overlap against the parallel placed-rect
// arrays. Strict because two cards touching at edges (a.x + a.w === b.x)
// are NOT overlapping — the GAP lives between them.
function rectOverlapsAny(x, y, w, h, px, py, pw, ph, n) {
  const xr = x + w
  const yb = y + h
  for (let i = 0; i < n; i++) {
    if (x < px[i] + pw[i] && px[i] < xr &&
        y < py[i] + ph[i] && py[i] < yb) return true
  }
  return false
}

function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  return false
}
