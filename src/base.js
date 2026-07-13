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
import { registerMedia } from './media.js'

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

  // ── string comparison + make-string + string as constructor ─────────
  def('string<?',    (a, b) => String(a) < String(b))
  def('string>?',    (a, b) => String(a) > String(b))
  def('string<=?',   (a, b) => String(a) <= String(b))
  def('string>=?',   (a, b) => String(a) >= String(b))
  def('string-copy', (s, start, end) =>
    String(s).substring(start ?? 0, end ?? String(s).length))
  def('make-string', (n, fill = ' ') =>
    String(typeof fill === 'string' ? fill : ' ').charAt(0).repeat(Math.max(0, n | 0)))
  // (string a b c ...) → concatenation. Standard R7RS behavior on chars,
  // and works as a friendly (string a b c) constructor when you have
  // pieces you want joined without a separator.
  def('string', (...parts) => parts.map(String).join(''))

  // ── symbol ops ──────────────────────────────────────────────────────
  def('symbol?',        (a) => a instanceof Sym)
  def('symbol->string', (s) => (s instanceof Sym ? s.name : String(s)))
  def('string->symbol', (s) => new Sym(String(s)))
  def('symbol=?',       (a, b) =>
    a instanceof Sym && b instanceof Sym ? a.name === b.name : false)

  // ── number predicates + more math ───────────────────────────────────
  def('integer?',  (x) => typeof x === 'number' && Number.isInteger(x))
  def('real?',     (x) => typeof x === 'number' && Number.isFinite(x))
  def('rational?', (x) => typeof x === 'number' && Number.isFinite(x))
  def('exact?',    (x) => typeof x === 'number' && Number.isInteger(x))
  def('inexact?',  (x) => typeof x === 'number' && !Number.isInteger(x))
  def('exact',     (x) => Math.trunc(x))
  def('inexact',   (x) => Number(x) + 0.0)
  def('exact->inexact', (x) => Number(x) + 0.0)
  def('inexact->exact', (x) => Math.trunc(x))
  def('truncate',  (x) => Math.trunc(x))
  def('exp',       (x) => Math.exp(x))
  def('log',       (x, base) => (typeof base === 'number' ? Math.log(x) / Math.log(base) : Math.log(x)))
  def('gcd',       (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    return a.length === 0 ? 0 : a.reduce((acc, n) => g(acc, n | 0), a[0] | 0)
  })
  def('lcm',       (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    return a.length === 0 ? 1 : a.reduce((acc, n) => Math.abs(acc * n) / g(acc, n) || 0, a[0] | 0)
  })
  def('square',    (x) => x * x)
  def('cube',      (x) => x * x * x)

  // ── list-building + list-navigation ─────────────────────────────────
  //
  // (iota n)         → 0 .. n-1
  // (iota n start)   → start .. start+n-1
  // (iota n start step) → start, start+step, ...
  def('iota', (n, start = 0, step = 1) => {
    const r = []
    for (let i = 0; i < (n | 0); i++) r.push(start + i * step)
    return r
  })
  def('list-tail', (lst, k) => Array.isArray(lst) ? lst.slice(k | 0) : [])
  def('list-copy', (lst) => Array.isArray(lst) ? lst.slice() : [])
  def('last-pair', (lst) => Array.isArray(lst) && lst.length ? [lst[lst.length - 1]] : [])
  // Deep car/cdr — the R7RS four-deep chain. Standard names; the
  // interpreter treats a list as an array, so we can express these as
  // slice + index chains straight into JavaScript.
  const _c = (lst, ops) => {
    let x = lst
    for (const op of ops) {
      if (!Array.isArray(x)) return undefined
      if (op === 'a') x = x[0]
      else x = x.slice(1)
    }
    return x
  }
  def('caar',   (l) => _c(l, ['a','a']))
  def('cadr',   (l) => _c(l, ['d','a']))       // second element
  def('cdar',   (l) => _c(l, ['a','d']))
  def('cddr',   (l) => _c(l, ['d','d']))
  def('caaar',  (l) => _c(l, ['a','a','a']))
  def('caadr',  (l) => _c(l, ['d','a','a']))
  def('cadar',  (l) => _c(l, ['a','d','a']))
  def('caddr',  (l) => _c(l, ['d','d','a']))   // third element
  def('cdaar',  (l) => _c(l, ['a','a','d']))
  def('cdadr',  (l) => _c(l, ['d','a','d']))
  def('cddar',  (l) => _c(l, ['a','d','d']))
  def('cdddr',  (l) => _c(l, ['d','d','d']))
  def('cadddr', (l) => _c(l, ['d','d','d','a'])) // fourth element
  def('cddddr', (l) => _c(l, ['d','d','d','d']))

  // ── vectors — arrays underneath, same as lists, but the API name  ───
  //     is what people reach for from other Schemes. Aliased where it
  //     doesn't matter (an array IS a vector in our runtime).
  def('vector',        (...a) => a)
  def('vector?',       (v) => Array.isArray(v))
  def('make-vector',   (n, fill = 0) => Array.from({ length: Math.max(0, n | 0) }, () => fill))
  def('vector-length', (v) => Array.isArray(v) ? v.length : 0)
  def('vector->list',  (v) => Array.isArray(v) ? v.slice() : [])
  def('list->vector',  (l) => Array.isArray(l) ? l.slice() : [])
  def('vector-map',    (fn, v) => v.map((x) => apply(fn, [x], fuel)))
  def('vector-for-each', (fn, v) => { for (const x of v) apply(fn, [x], fuel); return undefined })

  // ── misc predicates + equality aliases + void ───────────────────────
  def('eqv?',      (a, b) => a === b || deepEqual(a, b))
  def('boolean=?', (a, b) => a === b && (a === true || a === false))
  def('void',      () => undefined)
  // (identity x) — sometimes convenient as a placeholder function
  def('identity',  (x) => x)
  def('nan?',      (x) => typeof x === 'number' && Number.isNaN(x))
  def('finite?',   (x) => typeof x === 'number' && Number.isFinite(x))
  def('infinite?', (x) => x === Infinity || x === -Infinity)
  def('empty?',    (x) => (Array.isArray(x) ? x.length === 0 : x === '' || x == null))
  def('non-empty?',(x) => !(Array.isArray(x) ? x.length === 0 : x === '' || x == null))
  def('blank?',    (x) => x == null || (typeof x === 'string' && x.trim() === ''))
  def('singleton?',(x) => Array.isArray(x) && x.length === 1)
  def('nil?',      (x) => x === undefined || x === null)

  // ── more math — bit ops, trig, useful integer things ────────────────
  def('bit-and',   (...a) => a.reduce((x, y) => x & y, ~0))
  def('bit-or',    (...a) => a.reduce((x, y) => x | y, 0))
  def('bit-xor',   (...a) => a.reduce((x, y) => x ^ y, 0))
  def('bit-not',   (a) => ~a)
  def('bit-shift-left',  (a, n) => a << n)
  def('bit-shift-right', (a, n) => a >> n)
  def('bit-shift-right-logical', (a, n) => a >>> n)
  def('sinh',      (x) => Math.sinh(x))
  def('cosh',      (x) => Math.cosh(x))
  def('tanh',      (x) => Math.tanh(x))
  def('asin',      (x) => Math.asin(x))
  def('acos',      (x) => Math.acos(x))
  def('atan',      (x) => Math.atan(x))
  def('hypot',     (x, y) => Math.hypot(x, y))
  def('log2',      (x) => Math.log2(x))
  def('log10',     (x) => Math.log10(x))
  def('deg->rad',  (x) => x * Math.PI / 180)
  def('rad->deg',  (x) => x * 180 / Math.PI)
  def('divides?',  (n, d) => (d !== 0 && n % d === 0))
  def('prime?', (n) => {
    n = n | 0
    if (n < 2) return false
    if (n % 2 === 0) return n === 2
    for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false
    return true
  })
  def('factorial', (n) => {
    let r = 1
    for (let i = 2; i <= (n | 0); i++) r *= i
    return r
  })
  def('fib', (n) => {
    if (n < 2) return n
    let a = 0, b = 1
    for (let i = 2; i <= (n | 0); i++) { const t = a + b; a = b; b = t }
    return b
  })
  def('is-power-of-2?', (n) => (n | 0) > 0 && ((n | 0) & ((n | 0) - 1)) === 0)
  def('next-power-of-2', (n) => {
    let p = 1
    while (p < (n | 0)) p <<= 1
    return p
  })
  def('percentage', (part, whole) => (whole === 0 ? 0 : (part / whole) * 100))
  def('within?', (v, lo, hi) => v >= lo && v <= hi)

  // ── more list ops — the huge SRFI-1-flavored kit programmers reach for ─
  def('flatten',   (lst) => {
    const out = []
    const walk = (x) => Array.isArray(x) ? x.forEach(walk) : out.push(x)
    walk(lst)
    return out
  })
  def('flatten-1', (lst) => [].concat(...lst))
  def('chunk',     (lst, size) => {
    const out = [], n = Math.max(1, size | 0)
    for (let i = 0; i < lst.length; i += n) out.push(lst.slice(i, i + n))
    return out
  })
  def('partition', (pred, lst) => {
    const yes = [], no = []
    for (const x of lst) (apply(pred, [x], fuel) !== false ? yes : no).push(x)
    return [yes, no]
  })
  def('remove',    (pred, lst) => lst.filter((x) => apply(pred, [x], fuel) === false))
  def('distinct',  (lst) => {
    const out = [], seen = new Set()
    for (const x of lst) {
      const k = JSON.stringify(x)
      if (!seen.has(k)) { seen.add(k); out.push(x) }
    }
    return out
  })
  def('unique',    (lst) => {
    const out = [], seen = new Set()
    for (const x of lst) {
      const k = JSON.stringify(x)
      if (!seen.has(k)) { seen.add(k); out.push(x) }
    }
    return out
  })
  def('interleave',(a, b) => {
    const out = [], n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]) }
    return out
  })
  def('interpose', (sep, lst) => {
    const out = []
    for (let i = 0; i < lst.length; i++) { if (i) out.push(sep); out.push(lst[i]) }
    return out
  })
  def('intersection', (a, b) => a.filter((x) => b.some((y) => deepEqual(x, y))))
  def('union',        (a, b) => {
    const out = a.slice(), seen = new Set(a.map(JSON.stringify))
    for (const x of b) { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x) } }
    return out
  })
  def('difference',   (a, b) => a.filter((x) => !b.some((y) => deepEqual(x, y))))
  def('find',         (pred, lst) => { for (const x of lst) if (apply(pred, [x], fuel) !== false) return x; return false })
  def('find-index',   (pred, lst) => { for (let i = 0; i < lst.length; i++) if (apply(pred, [lst[i]], fuel) !== false) return i; return -1 })
  def('index-of',     (x, lst) => lst.findIndex((y) => deepEqual(x, y)))
  def('sort-by',      (fn, lst) => lst.slice().sort((a, b) => {
    const ka = apply(fn, [a], fuel), kb = apply(fn, [b], fuel)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  }))
  def('sort-desc',    (lst) => lst.slice().sort((a, b) => a < b ? 1 : a > b ? -1 : 0))
  def('min-of',       (lst) => lst.length ? lst.reduce((a, b) => a < b ? a : b) : Infinity)
  def('max-of',       (lst) => lst.length ? lst.reduce((a, b) => a > b ? a : b) : -Infinity)
  def('windowed',     (lst, n) => {
    const out = [], w = Math.max(1, n | 0)
    for (let i = 0; i + w <= lst.length; i++) out.push(lst.slice(i, i + w))
    return out
  })
  def('repeat',       (v, n) => Array.from({ length: Math.max(0, n | 0) }, () => v))
  def('take-while',   (pred, lst) => {
    const out = []
    for (const x of lst) { if (apply(pred, [x], fuel) === false) break; out.push(x) }
    return out
  })
  def('drop-while',   (pred, lst) => {
    let i = 0
    while (i < lst.length && apply(pred, [lst[i]], fuel) !== false) i++
    return lst.slice(i)
  })
  def('span',         (pred, lst) => {
    let i = 0
    while (i < lst.length && apply(pred, [lst[i]], fuel) !== false) i++
    return [lst.slice(0, i), lst.slice(i)]
  })
  def('group-by',     (fn, lst) => {
    const out = new Map()
    for (const x of lst) {
      const k = apply(fn, [x], fuel)
      const key = JSON.stringify(k)
      if (!out.has(key)) out.set(key, [k, []])
      out.get(key)[1].push(x)
    }
    return Array.from(out.values())
  })
  def('head',   (lst) => lst[0])
  def('tail',   (lst) => Array.isArray(lst) ? lst.slice(1) : [])
  def('init',   (lst) => Array.isArray(lst) ? lst.slice(0, -1) : [])
  def('unzip',  (pairs) => {
    const a = [], b = []
    for (const p of pairs) { a.push(p[0]); b.push(p[1]) }
    return [a, b]
  })
  def('shuffle', (lst) => {
    const out = lst.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = out[i]; out[i] = out[j]; out[j] = t
    }
    return out
  })

  // ── more string ops — text handling for people who type text ────────
  def('capitalize', (s) => { const t = String(s); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() })
  def('title-case', (s) => String(s).split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
  def('snake-case', (s) => String(s).trim().replace(/[\s-]+/g, '_').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase())
  def('kebab-case', (s) => String(s).trim().replace(/[\s_]+/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase())
  def('camel-case', (s) => {
    const parts = String(s).trim().split(/[\s_-]+/)
    return parts[0].toLowerCase() + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')
  })
  def('pascal-case', (s) => String(s).trim().split(/[\s_-]+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(''))
  def('pad-left',   (s, n, ch = ' ') => String(s).padStart(n | 0, String(ch)))
  def('pad-right',  (s, n, ch = ' ') => String(s).padEnd(n | 0, String(ch)))
  def('center',     (s, n, ch = ' ') => {
    const t = String(s), w = n | 0
    if (t.length >= w) return t
    const total = w - t.length, left = (total >> 1), right = total - left
    return String(ch).repeat(left) + t + String(ch).repeat(right)
  })
  def('slug',       (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
  def('escape-html',(s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'))
  def('unescape-html',(s) => String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"))
  def('word-count', (s) => (String(s).trim().match(/\S+/g) || []).length)
  def('line-count', (s) => String(s).split('\n').length)
  def('words',      (s) => (String(s).trim().match(/\S+/g) || []))
  def('lines',      (s) => String(s).split('\n'))
  def('truncate-string', (s, n, suffix = '…') => {
    const t = String(s), w = n | 0
    return t.length <= w ? t : t.slice(0, Math.max(0, w - String(suffix).length)) + String(suffix)
  })
  def('indent',     (s, n = 2, ch = ' ') => String(s).split('\n').map((l) => String(ch).repeat(n | 0) + l).join('\n'))
  def('dedent',     (s) => {
    const lines = String(s).split('\n')
    const nonBlank = lines.filter((l) => l.trim().length)
    const min = nonBlank.length ? Math.min(...nonBlank.map((l) => l.match(/^ */)[0].length)) : 0
    return lines.map((l) => l.slice(min)).join('\n')
  })
  def('string-eq-i?', (a, b) => String(a).toLowerCase() === String(b).toLowerCase())
  def('char-at',    (s, i) => String(s).charAt(i | 0))
  def('first-char', (s) => String(s).charAt(0))
  def('last-char',  (s) => String(s).charAt(String(s).length - 1))
  def('starts-with?',(s, prefix) => String(s).startsWith(String(prefix)))
  def('ends-with?', (s, suffix) => String(s).endsWith(String(suffix)))
  def('contains?',  (haystack, needle) => String(haystack).includes(String(needle)))
  def('repeat-string', (s, n) => String(s).repeat(Math.max(0, n | 0)))
  def('reverse-string', (s) => String(s).split('').reverse().join(''))

  // ── hash tables — dict/map by any other name ────────────────────────
  def('hash',           (...pairs) => {
    const h = new Map()
    for (let i = 0; i + 1 < pairs.length; i += 2) h.set(JSON.stringify(pairs[i]), pairs[i + 1])
    return h
  })
  def('make-hash',      () => new Map())
  def('hash?',          (h) => h instanceof Map)
  def('hash-set!',      (h, k, v) => { h.set(JSON.stringify(k), v); return h })
  def('hash-ref',       (h, k, dflt = undefined) => {
    const key = JSON.stringify(k)
    return h.has(key) ? h.get(key) : dflt
  })
  def('hash-remove!',   (h, k) => { h.delete(JSON.stringify(k)); return h })
  def('hash-has-key?',  (h, k) => h.has(JSON.stringify(k)))
  def('hash-count',     (h) => h.size)
  def('hash-keys',      (h) => Array.from(h.keys()).map((k) => JSON.parse(k)))
  def('hash-values',    (h) => Array.from(h.values()))
  def('hash-entries',   (h) => Array.from(h.entries()).map(([k, v]) => [JSON.parse(k), v]))
  def('hash->list',     (h) => Array.from(h.entries()).map(([k, v]) => [JSON.parse(k), v]))
  def('list->hash',     (lst) => {
    const h = new Map()
    for (const p of lst) if (Array.isArray(p) && p.length >= 2) h.set(JSON.stringify(p[0]), p[1])
    return h
  })
  def('hash-map',       (fn, h) => Array.from(h.entries()).map(([k, v]) => apply(fn, [JSON.parse(k), v], fuel)))
  def('hash-for-each',  (fn, h) => { for (const [k, v] of h.entries()) apply(fn, [JSON.parse(k), v], fuel); return undefined })
  def('hash-merge',     (a, b) => { const out = new Map(a); for (const [k, v] of b) out.set(k, v); return out })

  // ── JSON — every network-touching program wants this ────────────────
  def('json-parse',     (s) => {
    const clone = (x) => {
      if (Array.isArray(x)) return x.map(clone)
      if (x && typeof x === 'object') {
        const h = new Map()
        for (const [k, v] of Object.entries(x)) h.set(JSON.stringify(k), clone(v))
        return h
      }
      return x
    }
    try { return clone(JSON.parse(String(s))) } catch { return false }
  })
  def('json-stringify', (v, indent = 0) => {
    const clone = (x) => {
      if (x instanceof Map) {
        const out = {}
        for (const [k, val] of x.entries()) {
          const key = (() => { try { return JSON.parse(k) } catch { return k } })()
          out[String(key)] = clone(val)
        }
        return out
      }
      if (Array.isArray(x)) return x.map(clone)
      if (x instanceof Sym) return x.name
      return x
    }
    return JSON.stringify(clone(v), null, indent | 0)
  })
  def('json?',          (v) => {
    try { JSON.parse(typeof v === 'string' ? v : JSON.stringify(v)); return true }
    catch { return false }
  })

  // ── regex — pragmatic subset that maps to JS regex ──────────────────
  def('regex',          (pattern, flags = '') => new RegExp(String(pattern), String(flags)))
  def('regex?',         (r) => r instanceof RegExp)
  def('regex-match',    (re, s) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re))
    const m = String(s).match(r)
    return m ? Array.from(m) : false
  })
  def('regex-match-all',(re, s) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re), 'g')
    return Array.from(String(s).matchAll(r.global ? r : new RegExp(r.source, r.flags + 'g'))).map((m) => Array.from(m))
  })
  def('regex-replace',  (re, s, replacement) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re))
    return String(s).replace(r, String(replacement))
  })
  def('regex-replace-all',(re, s, replacement) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re), 'g')
    return String(s).replace(r.global ? r : new RegExp(r.source, r.flags + 'g'), String(replacement))
  })
  def('regex-split',    (re, s) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re))
    return String(s).split(r)
  })
  def('regex-test?',    (re, s) => {
    const r = re instanceof RegExp ? re : new RegExp(String(re))
    return r.test(String(s))
  })

  // ── date/time — practical, not calendar-anthropology-complete ───────
  def('now',            () => Date.now())
  def('now-iso',        () => new Date().toISOString())
  def('today',          () => new Date().toISOString().slice(0, 10))
  def('year',           (ms = Date.now()) => new Date(ms).getUTCFullYear())
  def('month',          (ms = Date.now()) => new Date(ms).getUTCMonth() + 1)
  def('day',            (ms = Date.now()) => new Date(ms).getUTCDate())
  def('weekday',        (ms = Date.now()) => new Date(ms).getUTCDay())
  def('hour',           (ms = Date.now()) => new Date(ms).getUTCHours())
  def('minute',         (ms = Date.now()) => new Date(ms).getUTCMinutes())
  def('second',         (ms = Date.now()) => new Date(ms).getUTCSeconds())
  def('parse-date',     (s) => { const d = new Date(String(s)); return isNaN(d.getTime()) ? false : d.getTime() })
  def('format-iso',     (ms) => new Date(ms).toISOString())
  def('date-string',    (ms) => new Date(ms).toISOString().slice(0, 10))
  def('time-string',    (ms) => new Date(ms).toISOString().slice(11, 19))
  def('days-between',   (a, b) => Math.round((b - a) / (24 * 3600 * 1000)))
  def('hours-between',  (a, b) => Math.round((b - a) / (3600 * 1000)))
  def('minutes-between',(a, b) => Math.round((b - a) / (60 * 1000)))
  def('seconds-between',(a, b) => Math.round((b - a) / 1000))
  def('add-days',       (ms, d) => ms + d * 24 * 3600 * 1000)
  def('add-hours',      (ms, h) => ms + h * 3600 * 1000)
  def('add-minutes',    (ms, m) => ms + m * 60 * 1000)
  def('add-seconds',    (ms, s) => ms + s * 1000)
  def('is-before?',     (a, b) => a < b)
  def('is-after?',      (a, b) => a > b)
  def('is-same-day?',   (a, b) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10))
  def('epoch',          (ms = Date.now()) => Math.floor(ms / 1000))
  def('from-epoch',     (s) => (s | 0) * 1000)

  // ── encoding — base64, hex, URL-friendly ────────────────────────────
  def('base64-encode',  (s) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(String(s), 'utf-8').toString('base64')
    if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(String(s))))
    return String(s)
  })
  def('base64-decode',  (s) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(String(s), 'base64').toString('utf-8')
    if (typeof atob !== 'undefined') return decodeURIComponent(escape(atob(String(s))))
    return String(s)
  })
  def('hex-encode',     (s) => Array.from(String(s)).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
  def('hex-decode',     (s) => { let out = ''; for (let i = 0; i < s.length; i += 2) out += String.fromCharCode(parseInt(s.substr(i, 2), 16)); return out })
  def('url-encode',     (s) => encodeURIComponent(String(s)))
  def('url-decode',     (s) => { try { return decodeURIComponent(String(s)) } catch { return String(s) } })

  // ── URL parsing (best-effort, using URL constructor) ────────────────
  def('url-parse',      (s) => {
    try {
      const u = new URL(String(s))
      const h = new Map()
      h.set(JSON.stringify('protocol'), u.protocol.replace(':', ''))
      h.set(JSON.stringify('host'),     u.host)
      h.set(JSON.stringify('hostname'), u.hostname)
      h.set(JSON.stringify('port'),     u.port)
      h.set(JSON.stringify('path'),     u.pathname)
      h.set(JSON.stringify('query'),    u.search.replace(/^\?/, ''))
      h.set(JSON.stringify('hash'),     u.hash.replace(/^#/, ''))
      return h
    } catch { return false }
  })
  def('query-params',   (s) => {
    const q = String(s).replace(/^\?/, '')
    const h = new Map()
    if (q) {
      for (const kv of q.split('&')) {
        const [k, v = ''] = kv.split('=')
        h.set(JSON.stringify(decodeURIComponent(k)), decodeURIComponent(v))
      }
    }
    return h
  })

  // ── UUID (v4) + random helpers ──────────────────────────────────────
  def('uuid', () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    // fallback: build v4 by hand
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  })
  def('uuid?', (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
  def('random',       () => Math.random())
  def('random-bool',  () => Math.random() < 0.5)
  def('random-normal',() => { // Box-Muller
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  })
  def('sample', (lst, n) => {
    const s = lst.slice(), out = []
    for (let i = 0; i < Math.min(n | 0, s.length); i++) {
      const j = Math.floor(Math.random() * s.length)
      out.push(s.splice(j, 1)[0])
    }
    return out
  })

  // ── environment (safe subset — no network, no filesystem) ───────────
  def('env-get',    (key) => {
    if (typeof process !== 'undefined' && process.env) return process.env[String(key)] ?? false
    return false
  })
  def('env-has?',   (key) => {
    if (typeof process !== 'undefined' && process.env) return String(key) in process.env
    return false
  })
  def('env-keys',   () => {
    if (typeof process !== 'undefined' && process.env) return Object.keys(process.env)
    return []
  })
  def('platform',   () => {
    if (typeof process !== 'undefined' && process.platform) return process.platform
    if (typeof navigator !== 'undefined' && navigator.platform) return navigator.platform
    return 'unknown'
  })
  def('hostname',   () => {
    if (typeof process !== 'undefined' && process.env && process.env.HOSTNAME) return process.env.HOSTNAME
    return 'localhost'
  })

  // ── structural — pack/unpack, keys/values, get-in/assoc-in on hashes ─
  def('keys',    (obj) => obj instanceof Map ? Array.from(obj.keys()).map((k) => JSON.parse(k)) : (obj ? Object.keys(obj) : []))
  def('vals',    (obj) => obj instanceof Map ? Array.from(obj.values()) : (obj ? Object.values(obj) : []))
  def('entries', (obj) => obj instanceof Map ? Array.from(obj.entries()).map(([k, v]) => [JSON.parse(k), v]) : (obj ? Object.entries(obj) : []))
  def('get-in',  (obj, path) => {
    let cur = obj
    for (const k of (Array.isArray(path) ? path : [path])) {
      if (cur instanceof Map) cur = cur.get(JSON.stringify(k))
      else if (Array.isArray(cur)) cur = cur[k | 0]
      else if (cur && typeof cur === 'object') cur = cur[k]
      else return undefined
      if (cur === undefined) return undefined
    }
    return cur
  })
  def('has-key?', (obj, k) => {
    if (obj instanceof Map) return obj.has(JSON.stringify(k))
    if (Array.isArray(obj)) return (k | 0) >= 0 && (k | 0) < obj.length
    if (obj && typeof obj === 'object') return k in obj
    return false
  })
  def('merge', (a, b) => {
    if (a instanceof Map && b instanceof Map) {
      const out = new Map(a); for (const [k, v] of b.entries()) out.set(k, v); return out
    }
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b)
    return { ...(a || {}), ...(b || {}) }
  })

  // ── file I/O — Node only; browser bundle returns friendly errors ────
  const _hasFs = () => typeof process !== 'undefined' && typeof require !== 'undefined'
  const _fs = () => { try { return require('fs') } catch { return null } }
  const _path = () => { try { return require('path') } catch { return null } }
  def('read-file',    (path) => { const fs = _fs(); if (!fs) return false; try { return fs.readFileSync(String(path), 'utf-8') } catch { return false } })
  def('write-file',   (path, content) => { const fs = _fs(); if (!fs) return false; try { fs.writeFileSync(String(path), String(content)); return true } catch { return false } })
  def('append-file',  (path, content) => { const fs = _fs(); if (!fs) return false; try { fs.appendFileSync(String(path), String(content)); return true } catch { return false } })
  def('file-exists?', (path) => { const fs = _fs(); if (!fs) return false; try { return fs.existsSync(String(path)) } catch { return false } })
  def('read-lines',   (path) => { const fs = _fs(); if (!fs) return false; try { return fs.readFileSync(String(path), 'utf-8').split('\n') } catch { return false } })
  def('list-dir',     (path = '.') => { const fs = _fs(); if (!fs) return []; try { return fs.readdirSync(String(path)) } catch { return [] } })
  def('cwd',          () => (typeof process !== 'undefined' && process.cwd ? process.cwd() : '/'))
  def('home-dir',     () => {
    if (typeof process !== 'undefined' && process.env) return process.env.HOME || process.env.USERPROFILE || '/'
    return '/'
  })
  def('path-join',    (...parts) => {
    const p = _path()
    if (p) return p.join(...parts.map(String))
    return parts.map(String).join('/').replace(/\/+/g, '/')
  })
  def('path-basename',(p) => { const P = _path(); return P ? P.basename(String(p)) : String(p).split('/').pop() })
  def('path-dirname', (p) => { const P = _path(); return P ? P.dirname(String(p)) : String(p).split('/').slice(0, -1).join('/') || '.' })
  def('path-extname', (p) => { const P = _path(); return P ? P.extname(String(p)) : (String(p).match(/\.[^.\/]+$/) || [''])[0] })

  // ── small conversion helpers people always want ─────────────────────
  def('str',        (v) => (typeof v === 'string' ? v : _show(v)))
  def('num',        (v) => Number(v))
  def('int',        (v) => v | 0)
  def('bool',       (v) => v !== false && v !== 0 && v !== '' && v != null && !(Array.isArray(v) && v.length === 0))
  def('->list',     (v) => Array.isArray(v) ? v.slice() : (v instanceof Map ? Array.from(v.entries()).map(([k, val]) => [JSON.parse(k), val]) : [v]))
  def('->string',   (v) => (typeof v === 'string' ? v : _show(v)))
  def('->number',   (v) => Number(v))
  def('->bool',     (v) => v !== false && v !== 0 && v !== '' && v != null)

  // ── console helpers — the kind of thing tutorials reach for ─────────
  def('println*',   (...args) => { _write(args.map((v) => typeof v === 'string' ? v : _show(v)).join(' ') + '\n'); return undefined })
  def('print*',     (...args) => { _write(args.map((v) => typeof v === 'string' ? v : _show(v)).join(' ')); return undefined })
  def('debug',      (v) => { _write(_show(v) + '\n'); return v })    // print AND return
  def('tap',        (v) => { _write(_show(v) + '\n'); return v })    // same, alternate name

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

  // ── L1 MEDIA — framebuffer + drawing + sound + animation + input ─
  // Loaded here so every scheme-lang consumer picks them up. Verbs are
  // additive; they don't conflict with the pure-math base above.
  registerMedia(e, fuel)

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
