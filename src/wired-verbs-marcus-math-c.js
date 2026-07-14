// wired-verbs-marcus-math-c.js — Marcus's lane: const/*, num/*, and
// no-namespace q-z verbs.
//
// Runs AFTER installWiredVerbs and BEFORE the reference stub registrar.
// Overrides descriptor-shaped defs from wired-verbs.js where the
// reference asks for a REAL value (rule-conway, num/nintegrate-*,
// rasterize-text, rows, zoom-legible?) so a kid opening `(rule-conway
// #t 3)` at the REPL learns the ACTUAL rule, not a shaped descriptor.
//
// Doctrine (Alfred): "We can't lie to people. They trust us."
// Every def here has been REPL-verified against ./bin/sakura-scheme
// eval before commit. See docs/reports/lanes/marcus-math-c-audit-2026-07-14.slat
// for the full audit.

import { Sym } from './reader.js'
import { apply } from './interp.js'

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// Public entry — mutate env in place.
export function installWiredVerbsMarcusMathC(env, fuel) {
  // Override policy: this lane runs AFTER installWiredVerbs which
  // published the shaped descriptors. We want to REPLACE those descriptors
  // with real impls. So we always redefine.
  const perm = 'read'
  const def = (n, f) => env.define(n, f, { perm })

  // ── const/* — number constants (fixes: 4 were wired as thunks) ─────
  //
  // The reference declares these as numbers (const/pi -> 3.14159…).
  // wired-verbs.js line 940-943 had them as thunks: `() => Math.LN2`.
  // That produced `#<procedure>` at the REPL — a lie the kid hit on
  // their first log-base-2 attempt. Bare numbers here fix that.
  //
  // pi/e/tau/phi are already bare numbers in reference-impls.js;
  // this file only touches the four that were wrong.
  def('const/ln2', Math.LN2)
  def('const/ln10', Math.LN10)
  def('const/sqrt2', Math.SQRT2)
  def('const/sqrt3', Math.sqrt(3))

  // ── rule-conway — the actual Conway B3/S23 rule ────────────────────
  //
  // (rule-conway alive n) -> boolean
  //   An alive cell with 2 or 3 live neighbors survives; a dead cell
  //   with exactly 3 live neighbors is born. Everything else dies.
  //   Truthiness: only Scheme #f counts as dead; #t, 1, 'alive, any
  //   non-#f value is treated as alive (matches Scheme convention).
  def('rule-conway', (alive, nNeighbors) => {
    const a = !(alive === false || alive === undefined || alive === null)
    const k = num(nNeighbors) | 0
    if (a) return k === 2 || k === 3
    return k === 3
  })

  // ── rows — surface height in cells ─────────────────────────────────
  //
  // (rows) -> number
  //   Query the current surface's row count. In standalone REPL we
  //   route to `canvas-height` if the framebuffer registered it;
  //   otherwise return 0 (no surface bound). Live hosts (browser IDE,
  //   game shell) override with their real surface height.
  def('rows', () => {
    try {
      const h = env.vars.get('canvas-height')
      if (typeof h === 'function') return num(h())
      if (typeof h === 'number') return h
    } catch { /* no framebuffer bound; report 0 rows */ }
    return 0
  })

  // ── zoom-legible? — readability heuristic ─────────────────────────
  //
  // (zoom-legible? [scale [designPx]]) -> boolean
  //   Threshold: scale * designPx >= 8 device pixels. Alfred's tutorial
  //   uses ~8 px as the "kid can read at normal seating distance" floor.
  //   Default scale=1.0, default designPx=12 (tutorial body size).
  def('zoom-legible?', (scale, designPx) => {
    const s = scale === undefined ? 1.0 : num(scale)
    const d = designPx === undefined ? 12 : num(designPx)
    return (s * d) >= 8
  })

  // ── rasterize-text — text to dot list ─────────────────────────────
  //
  // (rasterize-text text [x] [y] [font] [size] [grid] [supersample] [minAlpha])
  //   -> list of ('dot x y alpha) records
  //
  // Minimal 5x7 uppercase-ASCII pixel font. Lowercase -> uppercase;
  // unknown chars use '?' glyph. Live hosts override with real
  // typography. Font ships inline so REPL examples work with no
  // external resource.
  const FONT_5x7 = {
    ' ': '00000 00000 00000 00000 00000 00000 00000',
    '!': '00100 00100 00100 00100 00000 00100 00000',
    '.': '00000 00000 00000 00000 00000 00100 00000',
    ',': '00000 00000 00000 00000 00100 00100 01000',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    '?': '01110 10001 00010 00100 00000 00100 00000',
    '0': '01110 10001 10011 10101 11001 10001 01110',
    '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11111 00010 00100 00010 00001 10001 01110',
    '4': '00010 00110 01010 10010 11111 00010 00010',
    '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110',
    '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00010 01100',
    'A': '01110 10001 10001 11111 10001 10001 10001',
    'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110',
    'D': '11110 10001 10001 10001 10001 10001 11110',
    'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01110 10001 10000 10111 10001 10001 01111',
    'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '01110 00100 00100 00100 00100 00100 01110',
    'J': '00001 00001 00001 00001 00001 10001 01110',
    'K': '10001 10010 10100 11000 10100 10010 10001',
    'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001',
    'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110',
    'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101',
    'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01110 10001 10000 01110 00001 10001 01110',
    'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110',
    'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10101 10101 10101 01010',
    'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 10001 01010 00100 00100 00100',
    'Z': '11111 00001 00010 00100 01000 10000 11111',
  }
  def('rasterize-text', (text, x, y, _font, _size, grid, _super, minAlpha) => {
    const s = String(text == null ? '' : text)
    const x0 = num(x || 0)
    const y0 = num(y || 0)
    const g = Math.max(1, num(grid == null ? 1 : grid) | 0)
    const thr = minAlpha == null ? 0.5 : num(minAlpha)
    const dots = []
    let cx = x0
    for (const chRaw of s) {
      const ch = chRaw.toUpperCase()
      const bits = FONT_5x7[ch] || FONT_5x7['?']
      const rowsArr = bits.split(' ')
      for (let ry = 0; ry < rowsArr.length; ry++) {
        const row = rowsArr[ry]
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== '1') continue
          for (let dy = 0; dy < g; dy++) {
            for (let dx = 0; dx < g; dx++) {
              const alpha = 1
              if (alpha < thr) continue
              dots.push(['dot', cx + rx * g + dx, y0 + ry * g + dy, alpha])
            }
          }
        }
      }
      cx += 6 * g // 5-wide + 1-space kerning
    }
    return dots
  })

  // ── num/nintegrate-{2d,3d} — Simpson's rule quadrature ────────────
  //
  // (num/nintegrate-2d f x-bounds y-bounds [opts]) -> number
  // (num/nintegrate-3d f x-bounds y-bounds z-bounds [opts]) -> number
  //
  // Composite Simpson's rule. Bounds are 2-lists (lo hi). opts is a
  // keyword-list; :n gives per-axis subdivision count (must be even,
  // default 32 for 2d and 16 for 3d — 3d does n^3 apply calls). f is
  // a Scheme lambda taking positional args (x y) or (x y z).
  //
  // Verified: (num/nintegrate-2d (lambda (x y) (* x y)) '(0 1) '(0 1))
  // returns 0.25 (exact = 1/4). See :examples slice for more.
  const simpsonWeight = (i, n) => {
    if (i === 0 || i === n) return 1
    return (i % 2 === 1) ? 4 : 2
  }
  const getOpt = (opts, key, dflt) => {
    if (!Array.isArray(opts)) return dflt
    for (let i = 0; i < opts.length - 1; i += 2) {
      const k = opts[i]
      const kn = (k instanceof Sym) ? k.name : k
      if (kn === key || kn === ':' + key) return opts[i + 1]
    }
    return dflt
  }
  const readBounds = (b) => {
    if (!Array.isArray(b) || b.length < 2) return [0, 1]
    return [num(b[0]), num(b[1])]
  }
  const localFuel = () => ({ n: (fuel && fuel.n) ? fuel.n : 2000000 })
  def('num/nintegrate-2d', (f, xb, yb, opts) => {
    const [x0, x1] = readBounds(xb)
    const [y0, y1] = readBounds(yb)
    let n = num(getOpt(opts, 'n', 32)) | 0
    if (n < 2) n = 2
    if (n % 2 === 1) n += 1
    const hx = (x1 - x0) / n
    const hy = (y1 - y0) / n
    const F = localFuel()
    let s = 0
    for (let i = 0; i <= n; i++) {
      const wx = simpsonWeight(i, n)
      const x = x0 + i * hx
      for (let j = 0; j <= n; j++) {
        const wy = simpsonWeight(j, n)
        const y = y0 + j * hy
        const v = num(apply(f, [x, y], F))
        s += wx * wy * v
      }
    }
    return s * hx * hy / 9
  })
  def('num/nintegrate-3d', (f, xb, yb, zb, opts) => {
    const [x0, x1] = readBounds(xb)
    const [y0, y1] = readBounds(yb)
    const [z0, z1] = readBounds(zb)
    let n = num(getOpt(opts, 'n', 16)) | 0
    if (n < 2) n = 2
    if (n % 2 === 1) n += 1
    const hx = (x1 - x0) / n
    const hy = (y1 - y0) / n
    const hz = (z1 - z0) / n
    const F = localFuel()
    let s = 0
    for (let i = 0; i <= n; i++) {
      const wx = simpsonWeight(i, n)
      const x = x0 + i * hx
      for (let j = 0; j <= n; j++) {
        const wy = simpsonWeight(j, n)
        const y = y0 + j * hy
        for (let k = 0; k <= n; k++) {
          const wz = simpsonWeight(k, n)
          const z = z0 + k * hz
          const v = num(apply(f, [x, y, z], F))
          s += wx * wy * wz * v
        }
      }
    }
    return s * hx * hy * hz / 27
  })

  return env
}

export default installWiredVerbsMarcusMathC
