// wired-verbs-hana-math.js — Hana's lane for the wire-596 push.
//
// Scope: solve/* + plot/* + seq/* + calc/* — 69 reference verbs.
//
// This module runs AFTER installWiredVerbs so it can override
// shaped-descriptor placeholders with real, honest impls. Every
// impl in this file is a real math operation — no descriptor lies.
// Alfred: "We can't lie to people. They trust us."
//
// Layout:
//   1. helpers (apply-callback, safe-num, framebuffer accessor)
//   2. seq/*  — 1 impl (recurrence; the rest are already real)
//   3. calc/* — 26 impls (gradient hessian jacobian divergence curl
//               laplacian partial directional-derivative
//               second-derivative taylor tangent-line
//               critical-points-1d extrema-1d continuous?
//               differentiable? radius-of-convergence riemann-sum
//               series-converges? arc-length arc-length-param
//               average-value line-integral surface-integral
//               surface-revolution total-differential
//               volume-revolution)
//   4. plot/* — 14 impls
//        drawing verbs (rasterize into shared framebuffer):
//          line scatter bar histogram function parametric contour
//          vector-field phase-portrait
//        pure helpers:
//          fit-grid from-series nice-domain render-svg with

import { Sym } from './reader.js'
import { apply } from './interp.js'
import { getMediaState } from './media.js'

const nm  = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// Small default step for finite differences. Two-sided central
// difference: f'(x) ≈ (f(x+h) - f(x-h)) / (2h). At h=1e-5 the
// truncation and rounding errors balance for well-behaved functions.
const DEFAULT_H = 1e-5

// Call a Scheme fn with real args and return a JS number.
function callNum(fn, args, fuel) {
  if (typeof fn === 'function') {
    const out = fn(...args)
    return typeof out === 'number' ? out : Number(out) || 0
  }
  const out = apply(fn, args, fuel)
  return typeof out === 'number' ? out : Number(out) || 0
}

// Call fn returning whatever it returned (list, number, etc).
function callAny(fn, args, fuel) {
  if (typeof fn === 'function') return fn(...args)
  return apply(fn, args, fuel)
}

// Numeric partial derivative of a multi-var fn w.r.t. the i-th arg.
function partialAt(fn, args, i, fuel, h = DEFAULT_H) {
  const plus  = args.slice(); plus[i]  = args[i] + h
  const minus = args.slice(); minus[i] = args[i] - h
  return (callNum(fn, plus, fuel) - callNum(fn, minus, fuel)) / (2 * h)
}

// Second derivative w.r.t. one arg: (f(x+h) - 2f(x) + f(x-h)) / h^2.
function secondPartialAt(fn, args, i, fuel, h = DEFAULT_H) {
  const plus  = args.slice(); plus[i]  = args[i] + h
  const minus = args.slice(); minus[i] = args[i] - h
  return (callNum(fn, plus, fuel) - 2 * callNum(fn, args, fuel) + callNum(fn, minus, fuel)) / (h * h)
}

// Mixed partial: d²f / dx_i dx_j.
function mixedPartialAt(fn, args, i, j, fuel, h = DEFAULT_H) {
  if (i === j) return secondPartialAt(fn, args, i, fuel, h)
  const pp = args.slice(); pp[i] += h; pp[j] += h
  const pm = args.slice(); pm[i] += h; pm[j] -= h
  const mp = args.slice(); mp[i] -= h; mp[j] += h
  const mm = args.slice(); mm[i] -= h; mm[j] -= h
  return (callNum(fn, pp, fuel) - callNum(fn, pm, fuel) - callNum(fn, mp, fuel) + callNum(fn, mm, fuel)) / (4 * h * h)
}

// Numerical integration — composite Simpson's rule, n even.
function simpson(fn, a, b, n, fuel) {
  if (n < 2) n = 2
  if (n % 2 !== 0) n++
  const h = (b - a) / n
  let s = callNum(fn, [a], fuel) + callNum(fn, [b], fuel)
  for (let i = 1; i < n; i++) {
    const x = a + i * h
    s += (i % 2 === 0 ? 2 : 4) * callNum(fn, [x], fuel)
  }
  return (h / 3) * s
}

// ── plot helpers ────────────────────────────────────────────────────
// The framebuffer lives in the shared media state. It uses the
// PICO-8 palette (see framebuffer.js). Colors 8 (red), 9 (orange),
// 11 (green), 12 (blue), 14 (pink) are our defaults.

function getFB() {
  return getMediaState().fb
}

// World coordinates → pixel coordinates. domain [x0,x1] maps to
// [0, w-1], range [y0,y1] maps to [h-1, 0] (y flip so up is up).
function makeTransform(fb, x0, x1, y0, y1) {
  const W = fb.w - 1, H = fb.h - 1
  const dx = Math.max(1e-12, x1 - x0)
  const dy = Math.max(1e-12, y1 - y0)
  return (x, y) => [Math.round((x - x0) / dx * W),
                    Math.round(H - (y - y0) / dy * H)]
}

// Compute [min, max] over a numeric array. Empty → [0, 1].
function dataRange(vs) {
  if (!Array.isArray(vs) || vs.length === 0) return [0, 1]
  let lo = Infinity, hi = -Infinity
  for (const v of vs) {
    const n = num(v)
    if (n < lo) lo = n
    if (n > hi) hi = n
  }
  if (lo === hi) { lo -= 1; hi += 1 }
  return [lo, hi]
}

// Nice-numbers algorithm (Heckbert 1990) — snap a raw range to a
// step that produces round tick labels.
function niceNumbers(lo, hi, ticks = 5) {
  const range = niceStep(hi - lo, false)
  const step  = niceStep(range / (ticks - 1), true)
  const niceLo = Math.floor(lo / step) * step
  const niceHi = Math.ceil(hi / step) * step
  return [niceLo, niceHi, step]
}
function niceStep(x, round) {
  if (x <= 0) return 1
  const expv = Math.floor(Math.log10(x))
  const frac = x / Math.pow(10, expv)
  let nf
  if (round) {
    if      (frac < 1.5) nf = 1
    else if (frac < 3)   nf = 2
    else if (frac < 7)   nf = 5
    else                 nf = 10
  } else {
    if      (frac <= 1) nf = 1
    else if (frac <= 2) nf = 2
    else if (frac <= 5) nf = 5
    else                nf = 10
  }
  return nf * Math.pow(10, expv)
}

// ── public entry ────────────────────────────────────────────────────
export function installWiredVerbsHanaMath(env, fuel) {
  // Override any prior binding (descriptor stub, error stub, or bare
  // partial impl). We're intentionally aggressive here — this lane is
  // the source of truth for these verbs.
  const def = (n, f, perm = 'read') => {
    env.define(n, f, { perm })
  }

  // ═════════════════════════════════════════════════════════════════
  // 1. seq/* — real impl for the one stub in the lane.
  // ═════════════════════════════════════════════════════════════════

  // Linear recurrence: coeffs c_1..c_k, initial values a_0..a_{k-1}.
  // a_i = c_1*a_{i-1} + c_2*a_{i-2} + ... + c_k*a_{i-k}.
  // The first coefficient multiplies the MOST RECENT term.
  def('seq/recurrence', (coeffs, init, n) => {
    if (!Array.isArray(coeffs) || !Array.isArray(init)) return NaN
    const k = coeffs.length
    if (init.length < k || k === 0) return NaN
    const N = num(n) | 0
    if (N < 0) return NaN
    if (N < init.length) return num(init[N])
    const window = init.slice(-k).map(num)
    const c = coeffs.map(num)
    for (let i = init.length; i <= N; i++) {
      let next = 0
      for (let j = 0; j < k; j++) next += c[j] * window[k - 1 - j]
      window.shift()
      window.push(next)
    }
    return window[k - 1]
  })

  // ═════════════════════════════════════════════════════════════════
  // 2. calc/* — real impls for the 26 stubs in the lane.
  // ═════════════════════════════════════════════════════════════════

  // ── first-order calculus ───────────────────────────────────────

  // Partial derivative of a multi-var fn w.r.t. the i-th variable
  // (0-indexed). args is the point of evaluation as a list.
  def('calc/partial', (fn, i, args) => {
    if (!Array.isArray(args)) return NaN
    const idx = num(i) | 0
    return partialAt(fn, args.map(num), idx, fuel)
  })

  // Gradient — vector of partial derivatives. Returns a list.
  def('calc/gradient', (fn, args) => {
    if (!Array.isArray(args)) return []
    const pt = args.map(num)
    const out = []
    for (let i = 0; i < pt.length; i++) out.push(partialAt(fn, pt, i, fuel))
    return out
  })

  // Directional derivative: gradient · unit(v).
  // gradient · v / |v|.
  def('calc/directional-derivative', (fn, args, v) => {
    if (!Array.isArray(args) || !Array.isArray(v)) return NaN
    const pt = args.map(num)
    const dir = v.map(num)
    let normSq = 0
    for (const d of dir) normSq += d * d
    const norm = Math.sqrt(normSq)
    if (norm === 0) return NaN
    let dot = 0
    for (let i = 0; i < pt.length; i++) {
      dot += partialAt(fn, pt, i, fuel) * dir[i]
    }
    return dot / norm
  })

  // Jacobian: matrix (list of lists) of first partials for a
  // vector-valued fn. fn takes point, returns list of same length as
  // the output dimension.
  def('calc/jacobian', (fn, args) => {
    if (!Array.isArray(args)) return []
    const pt = args.map(num)
    // Probe the output dimension.
    const y0 = callAny(fn, pt, fuel)
    if (!Array.isArray(y0)) return []
    const m = y0.length
    const nvars = pt.length
    const J = []
    for (let r = 0; r < m; r++) J.push(new Array(nvars).fill(0))
    for (let c = 0; c < nvars; c++) {
      const plus  = pt.slice(); plus[c]  = pt[c] + DEFAULT_H
      const minus = pt.slice(); minus[c] = pt[c] - DEFAULT_H
      const yp = callAny(fn, plus, fuel)
      const ym = callAny(fn, minus, fuel)
      for (let r = 0; r < m; r++) {
        J[r][c] = (num(yp[r]) - num(ym[r])) / (2 * DEFAULT_H)
      }
    }
    return J
  })

  // Divergence: sum of partial derivatives of a vector field's
  // i-th component w.r.t. its i-th input.
  def('calc/divergence', (fn, args) => {
    if (!Array.isArray(args)) return NaN
    const pt = args.map(num)
    let s = 0
    for (let i = 0; i < pt.length; i++) {
      const plus  = pt.slice(); plus[i]  = pt[i] + DEFAULT_H
      const minus = pt.slice(); minus[i] = pt[i] - DEFAULT_H
      const yp = callAny(fn, plus, fuel)
      const ym = callAny(fn, minus, fuel)
      if (Array.isArray(yp) && Array.isArray(ym)) {
        s += (num(yp[i]) - num(ym[i])) / (2 * DEFAULT_H)
      }
    }
    return s
  })

  // Curl. For 2D scalar curl of a 2D field: dQ/dx - dP/dy.
  // For 3D vector curl of a 3D field: standard formula.
  def('calc/curl', (fn, args) => {
    if (!Array.isArray(args)) return NaN
    const pt = args.map(num)
    // Probe to determine dimension.
    const y0 = callAny(fn, pt, fuel)
    if (!Array.isArray(y0)) return NaN
    if (y0.length === 2 && pt.length === 2) {
      // 2D scalar curl.
      const dQdx = partialAt(
        (x, y) => num(callAny(fn, [x, y], fuel)[1]),
        pt, 0, fuel,
      )
      const dPdy = partialAt(
        (x, y) => num(callAny(fn, [x, y], fuel)[0]),
        pt, 1, fuel,
      )
      return dQdx - dPdy
    }
    if (y0.length === 3 && pt.length === 3) {
      const comp = (idx) => (x, y, z) => num(callAny(fn, [x, y, z], fuel)[idx])
      const P = comp(0), Q = comp(1), R = comp(2)
      const dRdy = partialAt(R, pt, 1, fuel)
      const dQdz = partialAt(Q, pt, 2, fuel)
      const dPdz = partialAt(P, pt, 2, fuel)
      const dRdx = partialAt(R, pt, 0, fuel)
      const dQdx = partialAt(Q, pt, 0, fuel)
      const dPdy = partialAt(P, pt, 1, fuel)
      return [dRdy - dQdz, dPdz - dRdx, dQdx - dPdy]
    }
    return NaN
  })

  // ── second-order + Hessian ─────────────────────────────────────

  // Second derivative of a single-var fn at x.
  def('calc/second-derivative', (fn, x, h) => {
    const xx = num(x)
    const hh = h === undefined ? DEFAULT_H : num(h)
    return (callNum(fn, [xx + hh], fuel) - 2 * callNum(fn, [xx], fuel) + callNum(fn, [xx - hh], fuel)) / (hh * hh)
  })

  // Hessian: matrix of second partials.
  def('calc/hessian', (fn, args) => {
    if (!Array.isArray(args)) return []
    const pt = args.map(num)
    const nvars = pt.length
    const H = []
    for (let i = 0; i < nvars; i++) {
      H.push(new Array(nvars).fill(0))
    }
    for (let i = 0; i < nvars; i++) {
      for (let j = i; j < nvars; j++) {
        const v = mixedPartialAt(fn, pt, i, j, fuel)
        H[i][j] = v
        H[j][i] = v
      }
    }
    return H
  })

  // Laplacian: trace of Hessian; sum of unmixed second partials.
  def('calc/laplacian', (fn, args) => {
    if (!Array.isArray(args)) return NaN
    const pt = args.map(num)
    let s = 0
    for (let i = 0; i < pt.length; i++) s += secondPartialAt(fn, pt, i, fuel)
    return s
  })

  // Total differential at a point given a delta vector. Returns
  // sum(df/dx_i * delta_i).
  def('calc/total-differential', (fn, args, deltas) => {
    if (!Array.isArray(args) || !Array.isArray(deltas)) return NaN
    const pt = args.map(num)
    const dv = deltas.map(num)
    let s = 0
    for (let i = 0; i < pt.length && i < dv.length; i++) {
      s += partialAt(fn, pt, i, fuel) * dv[i]
    }
    return s
  })

  // ── one-dim analysis ───────────────────────────────────────────

  // Numeric continuity test at x. Approximates left and right limits
  // by evaluating near x from each side; declares continuous if both
  // agree with f(x) within tol.
  def('calc/continuous?', (fn, x, tol) => {
    const xx = num(x)
    const tt = tol === undefined ? 1e-4 : num(tol)
    try {
      const fx = callNum(fn, [xx], fuel)
      const fL = callNum(fn, [xx - DEFAULT_H], fuel)
      const fR = callNum(fn, [xx + DEFAULT_H], fuel)
      if (!Number.isFinite(fx) || !Number.isFinite(fL) || !Number.isFinite(fR)) return false
      return Math.abs(fL - fx) < tt && Math.abs(fR - fx) < tt
    } catch { return false }
  })

  // Differentiability: left and right slopes must agree.
  def('calc/differentiable?', (fn, x, tol) => {
    const xx = num(x)
    const tt = tol === undefined ? 1e-3 : num(tol)
    try {
      const slopeL = (callNum(fn, [xx], fuel) - callNum(fn, [xx - DEFAULT_H], fuel)) / DEFAULT_H
      const slopeR = (callNum(fn, [xx + DEFAULT_H], fuel) - callNum(fn, [xx], fuel)) / DEFAULT_H
      if (!Number.isFinite(slopeL) || !Number.isFinite(slopeR)) return false
      return Math.abs(slopeL - slopeR) < tt
    } catch { return false }
  })

  // Critical points of a 1D fn on [a,b] — sample f' and detect sign
  // changes; refine each candidate via bisection.
  def('calc/critical-points-1d', (fn, a, b, samples) => {
    const A = num(a), B = num(b)
    const N = samples === undefined ? 200 : Math.max(4, num(samples) | 0)
    const h = DEFAULT_H
    const fp = (x) => (callNum(fn, [x + h], fuel) - callNum(fn, [x - h], fuel)) / (2 * h)
    const zeroTol = 1e-8
    const points = []
    let prevX = A, prevD = fp(A)
    // Handle A itself as a critical point if derivative is ~0.
    if (Number.isFinite(prevD) && Math.abs(prevD) < zeroTol) points.push(A)
    for (let i = 1; i <= N; i++) {
      const x = A + (B - A) * i / N
      const d = fp(x)
      if (!Number.isFinite(prevD) || !Number.isFinite(d)) {
        prevX = x; prevD = d; continue
      }
      // If d is (nearly) zero, x itself is a critical point.
      if (Math.abs(d) < zeroTol) {
        points.push(x)
      } else if (prevD * d < 0) {
        // Sign change strictly across the interval — bisect refine.
        let lo = prevX, hi = x, dLo = prevD
        for (let k = 0; k < 40; k++) {
          const mid = 0.5 * (lo + hi)
          const dm = fp(mid)
          if (dLo * dm <= 0) { hi = mid } else { lo = mid; dLo = dm }
        }
        points.push(0.5 * (lo + hi))
      }
      prevX = x; prevD = d
    }
    return points
  })

  // Classify critical points: (list (list x kind) ...) where kind ∈
  // {'min, 'max, 'saddle}. Uses the second-derivative test.
  def('calc/extrema-1d', (fn, a, b, samples) => {
    const A = num(a), B = num(b)
    const N = samples === undefined ? 200 : Math.max(4, num(samples) | 0)
    const h = DEFAULT_H
    const fp  = (x) => (callNum(fn, [x + h], fuel) - callNum(fn, [x - h], fuel)) / (2 * h)
    const fpp = (x) => (callNum(fn, [x + h], fuel) - 2 * callNum(fn, [x], fuel) + callNum(fn, [x - h], fuel)) / (h * h)
    const zeroTol = 1e-8
    // First find critical points (inlined bisection).
    const crit = []
    let prevX = A, prevD = fp(A)
    if (Number.isFinite(prevD) && Math.abs(prevD) < zeroTol) crit.push(A)
    for (let i = 1; i <= N; i++) {
      const x = A + (B - A) * i / N
      const d = fp(x)
      if (!Number.isFinite(prevD) || !Number.isFinite(d)) {
        prevX = x; prevD = d; continue
      }
      if (Math.abs(d) < zeroTol) {
        crit.push(x)
      } else if (prevD * d < 0) {
        let lo = prevX, hi = x, dLo = prevD
        for (let k = 0; k < 40; k++) {
          const mid = 0.5 * (lo + hi)
          const dm = fp(mid)
          if (dLo * dm <= 0) { hi = mid } else { lo = mid; dLo = dm }
        }
        crit.push(0.5 * (lo + hi))
      }
      prevX = x; prevD = d
    }
    return crit.map((xc) => {
      const s = fpp(xc)
      let kind
      if (s > 1e-6) kind = new Sym('min')
      else if (s < -1e-6) kind = new Sym('max')
      else kind = new Sym('inflection')
      return [xc, kind]
    })
  })

  // ── Taylor + convergence ───────────────────────────────────────

  // Return (a_0 a_1 a_2 ... a_degree) — Taylor coefficients around
  // `center` up to given degree. a_k = f^(k)(center) / k!.
  def('calc/taylor', (fn, center, degree) => {
    const c = num(center)
    const d = num(degree) | 0
    const coeffs = new Array(d + 1)
    // Repeatedly numerically differentiate. Use a wider stencil for
    // higher orders; accuracy degrades past ~degree 5 with h=1e-3.
    const h = 1e-3
    const evalAt = (x) => callNum(fn, [x], fuel)
    for (let k = 0; k <= d; k++) {
      // k-th derivative via central finite difference of order k.
      // Sum_{j=0..k} (-1)^(k-j) * C(k,j) * f(c + (j - k/2)*h) / h^k
      let sum = 0
      for (let j = 0; j <= k; j++) {
        const bin = binomial(k, j)
        const sign = ((k - j) & 1) ? -1 : 1
        sum += sign * bin * evalAt(c + (j - k / 2) * h)
      }
      const deriv = sum / Math.pow(h, k)
      coeffs[k] = deriv / factorial(k)
    }
    return coeffs
  })

  // Tangent line to y = f(x) at x = x0. Returns (m b) so line is
  // y = m*x + b.
  def('calc/tangent-line', (fn, x0) => {
    const xx = num(x0)
    const slope = (callNum(fn, [xx + DEFAULT_H], fuel) - callNum(fn, [xx - DEFAULT_H], fuel)) / (2 * DEFAULT_H)
    const y = callNum(fn, [xx], fuel)
    const b = y - slope * xx
    return [slope, b]
  })

  // Radius of convergence via the ratio test on a coefficient list.
  // R = lim sup |a_n / a_{n+1}|. Returns +Infinity when the series
  // is entire, 0 when it diverges everywhere non-zero.
  def('calc/radius-of-convergence', (coeffs) => {
    if (!Array.isArray(coeffs) || coeffs.length < 2) return NaN
    // Look at the tail — asymptotic behavior matters more than head.
    let best = 0, count = 0
    for (let i = coeffs.length - 2; i >= 0; i--) {
      const a = num(coeffs[i]), b = num(coeffs[i + 1])
      if (b === 0) continue
      const r = Math.abs(a / b)
      if (Number.isFinite(r)) { best += r; count++ }
      if (count >= 5) break
    }
    if (count === 0) return Infinity
    return best / count
  })

  // Series convergence test. Alfred: "We can't lie to people."
  // Numeric convergence is undecidable in general; we return a
  // best-effort heuristic based on (a) partial-sum plateau against
  // an octave-earlier partial sum and (b) ratio-test threshold.
  // We report #t when strong evidence of convergence is present,
  // #f otherwise. Ambiguous cases return #f rather than guessing.
  def('calc/series-converges?', (termFn, N) => {
    const NN = N === undefined ? 2000 : num(N) | 0
    // Sample partial sums at n = NN/4, NN/2, NN. If the tail from
    // NN/2 to NN adds a fraction of what NN/4 to NN/2 added, the
    // series is stabilizing — a signature of convergence.
    let s = 0
    let s_quarter = null, s_half = null
    const q = Math.max(4, Math.floor(NN / 4))
    const h = Math.max(8, Math.floor(NN / 2))
    for (let n = 0; n <= NN; n++) {
      const t = callNum(termFn, [n], fuel)
      if (!Number.isFinite(t)) return false
      s += t
      if (!Number.isFinite(s)) return false
      if (n === q) s_quarter = s
      if (n === h) s_half = s
    }
    if (s_quarter === null || s_half === null) return false
    // Compare tail contributions.
    const tailMid   = Math.abs(s_half    - s_quarter)   // from q to h
    const tailFinal = Math.abs(s         - s_half)      // from h to NN
    // Convergent: tail contribution shrinks octave-over-octave.
    //   1/n (harmonic, divergent): tailFinal/tailMid → 1.
    //   1/n^2 (convergent):        tailFinal/tailMid → 1/2.
    //   1/n^3 (convergent):        tailFinal/tailMid → 1/4.
    //   geometric r^n:             tailFinal/tailMid → 0.
    //   constant (divergent):      tailFinal/tailMid → 1.
    // Threshold 0.7 draws a clean line: 1/n^p converges iff p>1,
    // and 1/n^{1.5} gives ~1/sqrt(2) ≈ 0.707 (borderline — we bias
    // false, honest about the numerical limit).
    if (tailMid < 1e-12) return true  // early plateau
    return tailFinal < tailMid * 0.7
  })

  // ── integration ────────────────────────────────────────────────

  // Riemann sum. rule ∈ {'left 'right 'midpoint}. n subintervals.
  def('calc/riemann-sum', (fn, a, b, n, rule) => {
    const A = num(a), B = num(b)
    const N = Math.max(1, num(n) | 0)
    const r = nm(rule) || 'midpoint'
    const dx = (B - A) / N
    let s = 0
    for (let i = 0; i < N; i++) {
      let x
      if (r === 'left') x = A + i * dx
      else if (r === 'right') x = A + (i + 1) * dx
      else x = A + (i + 0.5) * dx
      s += callNum(fn, [x], fuel)
    }
    return s * dx
  })

  // Average value: (1/(b-a)) * integral(f, a, b).
  def('calc/average-value', (fn, a, b) => {
    const A = num(a), B = num(b)
    if (A === B) return NaN
    return simpson(fn, A, B, 100, fuel) / (B - A)
  })

  // Arc length of y = f(x) over [a,b]: integral of sqrt(1 + f'(x)^2).
  def('calc/arc-length', (fn, a, b) => {
    const A = num(a), B = num(b)
    const integrand = (x) => {
      const fp = (callNum(fn, [x + DEFAULT_H], fuel) - callNum(fn, [x - DEFAULT_H], fuel)) / (2 * DEFAULT_H)
      return Math.sqrt(1 + fp * fp)
    }
    return simpson(integrand, A, B, 100, fuel)
  })

  // Arc length of a parametric curve r(t) = (x(t), y(t), ...) over
  // [t0, t1]. r is a fn t -> list.
  def('calc/arc-length-param', (r, t0, t1) => {
    const T0 = num(t0), T1 = num(t1)
    const integrand = (t) => {
      const plus  = callAny(r, [t + DEFAULT_H], fuel)
      const minus = callAny(r, [t - DEFAULT_H], fuel)
      if (!Array.isArray(plus) || !Array.isArray(minus)) return 0
      let s = 0
      for (let i = 0; i < plus.length; i++) {
        const d = (num(plus[i]) - num(minus[i])) / (2 * DEFAULT_H)
        s += d * d
      }
      return Math.sqrt(s)
    }
    return simpson(integrand, T0, T1, 100, fuel)
  })

  // Line integral: integral of F(r(t)) · r'(t) dt over [t0, t1].
  // F is a fn (x y z? ...) -> list; r is a fn t -> list.
  def('calc/line-integral', (F, r, t0, t1) => {
    const T0 = num(t0), T1 = num(t1)
    const integrand = (t) => {
      const rt = callAny(r, [t], fuel)
      if (!Array.isArray(rt)) return 0
      const plus  = callAny(r, [t + DEFAULT_H], fuel)
      const minus = callAny(r, [t - DEFAULT_H], fuel)
      const Fv    = callAny(F, rt.map(num), fuel)
      if (!Array.isArray(Fv) || !Array.isArray(plus) || !Array.isArray(minus)) return 0
      let s = 0
      for (let i = 0; i < rt.length && i < Fv.length; i++) {
        const rp = (num(plus[i]) - num(minus[i])) / (2 * DEFAULT_H)
        s += num(Fv[i]) * rp
      }
      return s
    }
    return simpson(integrand, T0, T1, 100, fuel)
  })

  // Surface integral over a parametric surface r(u,v) of f(x,y,z).
  // Double Simpson over the (u,v) rectangle.
  def('calc/surface-integral', (f, r, u0, u1, v0, v1) => {
    const U0 = num(u0), U1 = num(u1), V0 = num(v0), V1 = num(v1)
    // Compute ||r_u × r_v|| * f(r(u,v)) and double-integrate.
    const integrand = (u, v) => {
      const p  = callAny(r, [u, v], fuel)
      if (!Array.isArray(p)) return 0
      const ru_plus  = callAny(r, [u + DEFAULT_H, v], fuel)
      const ru_minus = callAny(r, [u - DEFAULT_H, v], fuel)
      const rv_plus  = callAny(r, [u, v + DEFAULT_H], fuel)
      const rv_minus = callAny(r, [u, v - DEFAULT_H], fuel)
      const ru = [
        (num(ru_plus[0]) - num(ru_minus[0])) / (2 * DEFAULT_H),
        (num(ru_plus[1]) - num(ru_minus[1])) / (2 * DEFAULT_H),
        (num(ru_plus[2]) - num(ru_minus[2])) / (2 * DEFAULT_H),
      ]
      const rv = [
        (num(rv_plus[0]) - num(rv_minus[0])) / (2 * DEFAULT_H),
        (num(rv_plus[1]) - num(rv_minus[1])) / (2 * DEFAULT_H),
        (num(rv_plus[2]) - num(rv_minus[2])) / (2 * DEFAULT_H),
      ]
      // r_u × r_v
      const cx = ru[1] * rv[2] - ru[2] * rv[1]
      const cy = ru[2] * rv[0] - ru[0] * rv[2]
      const cz = ru[0] * rv[1] - ru[1] * rv[0]
      const nrm = Math.sqrt(cx * cx + cy * cy + cz * cz)
      const fval = callNum(f, p.map(num), fuel)
      return fval * nrm
    }
    // Double Simpson: integrate over u, integrated result over v.
    const inner = (u) => simpson((v) => integrand(u, v), V0, V1, 40, fuel)
    return simpson(inner, U0, U1, 40, fuel)
  })

  // Surface of revolution around x-axis of y = f(x) over [a,b].
  // S = 2*pi * integral of |f(x)| * sqrt(1 + f'(x)^2) dx.
  def('calc/surface-revolution', (fn, a, b) => {
    const A = num(a), B = num(b)
    const integrand = (x) => {
      const y = callNum(fn, [x], fuel)
      const fp = (callNum(fn, [x + DEFAULT_H], fuel) - callNum(fn, [x - DEFAULT_H], fuel)) / (2 * DEFAULT_H)
      return Math.abs(y) * Math.sqrt(1 + fp * fp)
    }
    return 2 * Math.PI * simpson(integrand, A, B, 100, fuel)
  })

  // Volume of revolution around x-axis of y = f(x) over [a,b]
  // via disk method. V = pi * integral of f(x)^2 dx.
  def('calc/volume-revolution', (fn, a, b) => {
    const A = num(a), B = num(b)
    const integrand = (x) => {
      const y = callNum(fn, [x], fuel)
      return y * y
    }
    return Math.PI * simpson(integrand, A, B, 100, fuel)
  })

  // ═════════════════════════════════════════════════════════════════
  // 3. plot/* — real impls. Drawing verbs write into the shared
  //    framebuffer (getMediaState().fb) AND return a plot record
  //    the caller can inspect. Pure helpers return records only.
  // ═════════════════════════════════════════════════════════════════

  // ── plot/line — connect points as segments ──────────────────────
  //
  // data may be either a list of numbers (y-values; x = index) or a
  // list of (x y) pairs. Auto-scales to fill the buffer. Optional
  // opts is a plist / property alist with :color and :domain / :range.
  def('plot/line', (data, opts) => {
    const fb = getFB()
    const pts = normalizePoints(data)
    if (pts.length < 2) return { kind: 'plot/line', data: pts, note: 'need at least 2 points' }
    const color = optColor(opts, 12)  // default blue
    const [xs, ys] = separateXY(pts)
    const [x0, x1] = optOrRange(opts, ':domain', xs)
    const [y0, y1] = optOrRange(opts, ':range',  ys)
    const t = makeTransform(fb, x0, x1, y0, y1)
    let prev = t(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) {
      const cur = t(pts[i][0], pts[i][1])
      fb.line(prev[0], prev[1], cur[0], cur[1], color)
      prev = cur
    }
    return {
      kind: 'plot/line', data: pts, color,
      domain: [x0, x1], range: [y0, y1],
    }
  })

  // ── plot/scatter — one dot per point ────────────────────────────
  def('plot/scatter', (data, opts) => {
    const fb = getFB()
    const pts = normalizePoints(data)
    if (pts.length === 0) return { kind: 'plot/scatter', data: [] }
    const color = optColor(opts, 14)  // default pink
    const [xs, ys] = separateXY(pts)
    const [x0, x1] = optOrRange(opts, ':domain', xs)
    const [y0, y1] = optOrRange(opts, ':range',  ys)
    const t = makeTransform(fb, x0, x1, y0, y1)
    for (const [x, y] of pts) {
      const [px, py] = t(x, y)
      fb.disc(px, py, 1, color)
    }
    return {
      kind: 'plot/scatter', data: pts, color,
      domain: [x0, x1], range: [y0, y1],
    }
  })

  // ── plot/bar — vertical bars over evenly-spaced x ───────────────
  def('plot/bar', (data, opts) => {
    const fb = getFB()
    const ys = extractYs(data)
    if (ys.length === 0) return { kind: 'plot/bar', data: [] }
    const color = optColor(opts, 9)  // default orange
    const [y0raw, y1raw] = dataRange(ys)
    const y0 = Math.min(0, y0raw)
    const y1 = y1raw
    const barW = Math.max(1, Math.floor((fb.w - 2) / ys.length))
    const zero = Math.round(fb.h - 1 - (0 - y0) / Math.max(1e-12, y1 - y0) * (fb.h - 1))
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i]
      const top = Math.round(fb.h - 1 - (y - y0) / Math.max(1e-12, y1 - y0) * (fb.h - 1))
      const px  = 1 + i * barW
      if (y >= 0) {
        fb.rectFill(px, top, barW - 1, Math.max(1, zero - top), color)
      } else {
        fb.rectFill(px, zero, barW - 1, Math.max(1, top - zero), color)
      }
    }
    return { kind: 'plot/bar', data: ys, color, range: [y0, y1] }
  })

  // ── plot/histogram — bin data + draw bars ──────────────────────
  def('plot/histogram', (data, opts) => {
    const ys = extractYs(data)
    if (ys.length === 0) return { kind: 'plot/histogram', data: [] }
    const bins = optInt(opts, ':bins', Math.min(20, Math.max(4, Math.round(Math.sqrt(ys.length)))))
    const [lo, hi] = dataRange(ys)
    const step = (hi - lo) / bins
    const counts = new Array(bins).fill(0)
    for (const v of ys) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / Math.max(1e-12, step))))
      counts[idx]++
    }
    const fb = getFB()
    const color = optColor(opts, 11)  // green
    const maxc = Math.max(1, ...counts)
    const barW = Math.max(1, Math.floor((fb.w - 2) / bins))
    for (let i = 0; i < bins; i++) {
      const h = Math.round(counts[i] / maxc * (fb.h - 2))
      const top = fb.h - 1 - h
      fb.rectFill(1 + i * barW, top, barW - 1, Math.max(1, h), color)
    }
    return {
      kind: 'plot/histogram', bins, counts,
      domain: [lo, hi], color,
    }
  })

  // ── plot/function — sample fn over [x0,x1] and connect ─────────
  def('plot/function', (fn, x0, x1, opts) => {
    const X0 = num(x0), X1 = num(x1)
    const samples = optInt(opts, ':samples', 200)
    const pts = []
    for (let i = 0; i <= samples; i++) {
      const x = X0 + (X1 - X0) * i / samples
      const y = callNum(fn, [x], fuel)
      if (Number.isFinite(y)) pts.push([x, y])
    }
    const fb = getFB()
    if (pts.length < 2) return { kind: 'plot/function', domain: [X0, X1], data: pts }
    const color = optColor(opts, 8)  // red
    const ys = pts.map((p) => p[1])
    const [y0, y1] = optOrRange(opts, ':range', ys)
    const t = makeTransform(fb, X0, X1, y0, y1)
    let prev = t(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) {
      const cur = t(pts[i][0], pts[i][1])
      fb.line(prev[0], prev[1], cur[0], cur[1], color)
      prev = cur
    }
    return {
      kind: 'plot/function', domain: [X0, X1], range: [y0, y1],
      samples: pts.length, color,
    }
  })

  // ── plot/parametric — (x(t), y(t)) over [t0, t1] ────────────────
  def('plot/parametric', (fn, t0, t1, opts) => {
    const T0 = num(t0), T1 = num(t1)
    const samples = optInt(opts, ':samples', 300)
    const pts = []
    for (let i = 0; i <= samples; i++) {
      const t = T0 + (T1 - T0) * i / samples
      const r = callAny(fn, [t], fuel)
      if (Array.isArray(r) && r.length >= 2) {
        const x = num(r[0]), y = num(r[1])
        if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
      }
    }
    const fb = getFB()
    if (pts.length < 2) return { kind: 'plot/parametric', data: pts }
    const color = optColor(opts, 13)  // lavender
    const [xs, ys] = separateXY(pts)
    const [xLo, xHi] = optOrRange(opts, ':domain', xs)
    const [yLo, yHi] = optOrRange(opts, ':range',  ys)
    const tr = makeTransform(fb, xLo, xHi, yLo, yHi)
    let prev = tr(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) {
      const cur = tr(pts[i][0], pts[i][1])
      fb.line(prev[0], prev[1], cur[0], cur[1], color)
      prev = cur
    }
    return {
      kind: 'plot/parametric', trange: [T0, T1],
      samples: pts.length, domain: [xLo, xHi], range: [yLo, yHi], color,
    }
  })

  // ── plot/contour — level sets of f(x,y) via marching squares ────
  //
  // f is a fn (x y) -> number. Bounds are (:domain (x0 x1) :range
  // (y0 y1)). :levels is a list of level values (default 5 evenly
  // spaced levels between min and max).
  def('plot/contour', (fn, opts) => {
    const [x0, x1] = optOrRange(opts, ':domain', null) || [-1, 1]
    const [y0, y1] = optOrRange(opts, ':range',  null) || [-1, 1]
    const grid = optInt(opts, ':grid', 32)
    const fb = getFB()
    // Sample grid.
    const G = []
    for (let j = 0; j <= grid; j++) {
      const row = []
      for (let i = 0; i <= grid; i++) {
        const x = x0 + (x1 - x0) * i / grid
        const y = y0 + (y1 - y0) * j / grid
        row.push(callNum(fn, [x, y], fuel))
      }
      G.push(row)
    }
    let gmin = Infinity, gmax = -Infinity
    for (const row of G) for (const v of row) {
      if (Number.isFinite(v)) { if (v < gmin) gmin = v; if (v > gmax) gmax = v }
    }
    const levelsOpt = optList(opts, ':levels')
    let levels
    if (levelsOpt) levels = levelsOpt.map(num)
    else {
      levels = []
      for (let k = 1; k <= 5; k++) levels.push(gmin + (gmax - gmin) * k / 6)
    }
    const color = optColor(opts, 3)  // dark-green
    const tr = makeTransform(fb, x0, x1, y0, y1)
    // Marching squares for each level.
    for (const L of levels) {
      for (let j = 0; j < grid; j++) {
        for (let i = 0; i < grid; i++) {
          const bl = G[j][i],     br = G[j][i + 1]
          const tl = G[j + 1][i], tr2 = G[j + 1][i + 1]
          // 4-bit code: TR TL BR BL.
          let code = 0
          if (bl > L) code |= 1
          if (br > L) code |= 2
          if (tl > L) code |= 4
          if (tr2 > L) code |= 8
          if (code === 0 || code === 15) continue
          const xL = x0 + (x1 - x0) * i / grid
          const xR = x0 + (x1 - x0) * (i + 1) / grid
          const yB = y0 + (y1 - y0) * j / grid
          const yT = y0 + (y1 - y0) * (j + 1) / grid
          const interpX = (a, b, va, vb) => a + (b - a) * (L - va) / (vb - va)
          const eB = () => [interpX(xL, xR, bl, br), yB]  // bottom edge
          const eT = () => [interpX(xL, xR, tl, tr2), yT] // top edge
          const eL = () => [xL, interpX(yB, yT, bl, tl)]  // left edge
          const eR = () => [xR, interpX(yB, yT, br, tr2)] // right edge
          const drawSeg = (p, q) => {
            const P = tr(p[0], p[1]), Q = tr(q[0], q[1])
            fb.line(P[0], P[1], Q[0], Q[1], color)
          }
          // Case table — simplified, ignoring saddle disambiguation.
          switch (code) {
            case 1:  case 14: drawSeg(eL(), eB()); break
            case 2:  case 13: drawSeg(eB(), eR()); break
            case 3:  case 12: drawSeg(eL(), eR()); break
            case 4:  case 11: drawSeg(eL(), eT()); break
            case 5:           drawSeg(eB(), eT()); break
            case 6:           drawSeg(eL(), eB()); drawSeg(eT(), eR()); break
            case 7:  case 8:  drawSeg(eT(), eR()); break
            case 9:           drawSeg(eL(), eT()); drawSeg(eB(), eR()); break
            case 10:          drawSeg(eL(), eR()); break
          }
        }
      }
    }
    return {
      kind: 'plot/contour', domain: [x0, x1], range: [y0, y1],
      levels, grid, color,
    }
  })

  // ── plot/vector-field — arrow at each grid point ────────────────
  def('plot/vector-field', (F, opts) => {
    const [x0, x1] = optOrRange(opts, ':domain', null) || [-1, 1]
    const [y0, y1] = optOrRange(opts, ':range',  null) || [-1, 1]
    const grid = optInt(opts, ':grid', 12)
    const fb = getFB()
    const color = optColor(opts, 12)  // blue
    // Collect samples first to find max magnitude for scaling.
    const samples = []
    let maxMag = 1e-12
    for (let j = 0; j <= grid; j++) {
      for (let i = 0; i <= grid; i++) {
        const x = x0 + (x1 - x0) * i / grid
        const y = y0 + (y1 - y0) * j / grid
        const v = callAny(F, [x, y], fuel)
        if (Array.isArray(v) && v.length >= 2) {
          const vx = num(v[0]), vy = num(v[1])
          const mag = Math.sqrt(vx * vx + vy * vy)
          if (mag > maxMag) maxMag = mag
          samples.push([x, y, vx, vy])
        }
      }
    }
    const tr = makeTransform(fb, x0, x1, y0, y1)
    // Length of an arrow in pixels: half a grid cell.
    const cellPx = Math.min(fb.w, fb.h) / (grid + 1) * 0.5
    for (const [x, y, vx, vy] of samples) {
      const [px, py] = tr(x, y)
      const scale = cellPx / maxMag
      const ex = px + Math.round(vx * scale)
      // Framebuffer y flip: dy inverted.
      const ey = py - Math.round(vy * scale)
      fb.line(px, py, ex, ey, color)
      fb.plot(ex, ey, color + 1)  // subtle head
    }
    return {
      kind: 'plot/vector-field', domain: [x0, x1], range: [y0, y1],
      grid, samples: samples.length, color,
    }
  })

  // ── plot/phase-portrait — 2D vector field of an ODE system ──────
  // F is a 2D vector field. Additional streamline seeds are drawn.
  def('plot/phase-portrait', (F, opts) => {
    // Reuse vector-field for the arrows, then trace a few streamlines.
    const [x0, x1] = optOrRange(opts, ':domain', null) || [-1, 1]
    const [y0, y1] = optOrRange(opts, ':range',  null) || [-1, 1]
    const grid = optInt(opts, ':grid', 10)
    const fb = getFB()
    const color = optColor(opts, 13)   // lavender arrows
    const stream = optInt(opts, ':streams', 6)
    // Arrows first.
    let maxMag = 1e-12
    const samples = []
    for (let j = 0; j <= grid; j++) {
      for (let i = 0; i <= grid; i++) {
        const x = x0 + (x1 - x0) * i / grid
        const y = y0 + (y1 - y0) * j / grid
        const v = callAny(F, [x, y], fuel)
        if (Array.isArray(v) && v.length >= 2) {
          const vx = num(v[0]), vy = num(v[1])
          const mag = Math.sqrt(vx * vx + vy * vy)
          if (mag > maxMag) maxMag = mag
          samples.push([x, y, vx, vy])
        }
      }
    }
    const tr = makeTransform(fb, x0, x1, y0, y1)
    const cellPx = Math.min(fb.w, fb.h) / (grid + 1) * 0.45
    for (const [x, y, vx, vy] of samples) {
      const [px, py] = tr(x, y)
      const scale = cellPx / maxMag
      const ex = px + Math.round(vx * scale)
      const ey = py - Math.round(vy * scale)
      fb.line(px, py, ex, ey, color)
    }
    // Streamlines — a few seeds, forward-Euler integration.
    const streamColor = optColor(opts, 8)  // red streamlines
    const dt = 0.02
    const steps = 200
    for (let s = 0; s < stream; s++) {
      let x = x0 + (x1 - x0) * (s + 0.5) / stream
      let y = y0 + (y1 - y0) * 0.5
      let prev = tr(x, y)
      for (let k = 0; k < steps; k++) {
        const v = callAny(F, [x, y], fuel)
        if (!Array.isArray(v)) break
        x += num(v[0]) * dt
        y += num(v[1]) * dt
        if (x < x0 || x > x1 || y < y0 || y > y1) break
        const cur = tr(x, y)
        fb.line(prev[0], prev[1], cur[0], cur[1], streamColor)
        prev = cur
      }
    }
    return {
      kind: 'plot/phase-portrait', domain: [x0, x1], range: [y0, y1],
      grid, streams: stream, arrows: samples.length,
    }
  })

  // ── plot/fit-grid — return (rows cols) that best fit N charts ───
  def('plot/fit-grid', (n) => {
    const N = Math.max(1, num(n) | 0)
    const cols = Math.ceil(Math.sqrt(N))
    const rows = Math.ceil(N / cols)
    return [rows, cols]
  })

  // ── plot/from-series — turn a sequence into a plot record ───────
  def('plot/from-series', (data) => {
    const ys = extractYs(data)
    return {
      kind: 'plot/from-series',
      data: ys.map((y, i) => [i, y]),
      count: ys.length,
    }
  })

  // ── plot/nice-domain — (nice-lo nice-hi step) for round ticks ───
  def('plot/nice-domain', (lo, hi, ticks) => {
    const L = num(lo), H = num(hi)
    const T = ticks === undefined ? 5 : Math.max(2, num(ticks) | 0)
    return niceNumbers(L, H, T)
  })

  // ── plot/render-svg — take a plot record → SVG string ───────────
  def('plot/render-svg', (record, opts) => {
    const w = optInt(opts, ':width',  320)
    const h = optInt(opts, ':height', 240)
    // Minimal but real: axes box + points/lines from the record.
    const kind = record && (record.kind || (Array.isArray(record) ? nm(record[0]) : null))
    let body = ''
    if (record && Array.isArray(record.data)) {
      const pts = record.data
      const [xs, ys] = separateXY(pts)
      const [xLo, xHi] = dataRange(xs)
      const [yLo, yHi] = dataRange(ys)
      const px = (x) => (x - xLo) / Math.max(1e-12, xHi - xLo) * (w - 20) + 10
      const py = (y) => h - ((y - yLo) / Math.max(1e-12, yHi - yLo) * (h - 20) + 10)
      if (kind === 'plot/line' || kind === 'plot/function' || kind === 'plot/parametric') {
        const points = pts.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')
        body = `<polyline fill="none" stroke="#08c" stroke-width="1.5" points="${points}"/>`
      } else {
        body = pts.map(([x, y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="2" fill="#e08"/>`).join('')
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff" stroke="#ccc"/>` +
      body +
      `</svg>`
  })

  // ── plot/with — thread options into a plot builder ──────────────
  // Merges an option plist (as a list of alternating keys+values)
  // into the record. Returns a plain record — the caller can then
  // pass it to any plot/* verb by threading through the opts list.
  def('plot/with', (base, ...pairs) => {
    const out = base && typeof base === 'object' ? { ...base } : { kind: 'plot/with', base }
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      const k = nm(pairs[i])
      out[k.startsWith(':') ? k.slice(1) : k] = pairs[i + 1]
    }
    return out
  })

  // ═════════════════════════════════════════════════════════════════
  // Descriptor-shape sweep additions (2026-07-14). REAL-IMPL bucket
  // from docs/reports/descriptor-shape-sweep-2026-07-14.slat — verbs
  // that were previously returning descriptor lies from
  // reference-impls.js and topo.js. Every impl below is a real
  // numerical algorithm following the same conventions as the calc/*
  // block above.
  // ═════════════════════════════════════════════════════════════════

  // calc/partial-derivative — alias for calc/partial with a 1-based
  // index for readability. Kept 0-indexed to match calc/partial.
  def('calc/partial-derivative', (fn, i, args) => {
    if (!Array.isArray(args)) return NaN
    return partialAt(fn, args.map(num), num(i) | 0, fuel)
  })

  // calc/critical-points — same as calc/critical-points-1d.
  // Convenience alias without the -1d suffix.
  def('calc/critical-points', (fn, a, b, samples) => {
    // Delegate to already-defined critical-points-1d via env.
    const target = env.vars.get('calc/critical-points-1d')
    if (typeof target === 'function') return target(fn, a, b, samples)
    return []
  })

  // calc/local-extrema — return only min/max (not saddles/inflections).
  def('calc/local-extrema', (fn, a, b, samples) => {
    const target = env.vars.get('calc/extrema-1d')
    if (typeof target !== 'function') return []
    const all = target(fn, a, b, samples)
    if (!Array.isArray(all)) return []
    return all.filter(pair => {
      const kind = pair[1]
      const kn = kind instanceof Sym ? kind.name : kind
      return kn === 'min' || kn === 'max'
    })
  })

  // calc/global-extrema — scan [a,b] and return the argmin/argmax.
  def('calc/global-extrema', (fn, a, b, samples) => {
    const A = num(a), B = num(b)
    const N = samples === undefined ? 200 : Math.max(4, num(samples) | 0)
    let xMin = A, yMin = callNum(fn, [A], fuel)
    let xMax = A, yMax = yMin
    for (let i = 1; i <= N; i++) {
      const x = A + (B - A) * i / N
      const y = callNum(fn, [x], fuel)
      if (Number.isFinite(y)) {
        if (y < yMin) { xMin = x; yMin = y }
        if (y > yMax) { xMax = x; yMax = y }
      }
    }
    return [[xMin, yMin, new Sym('min')], [xMax, yMax, new Sym('max')]]
  })

  // calc/inflection — find x where f'' changes sign.
  def('calc/inflection', (fn, a, b, samples) => {
    const A = num(a), B = num(b)
    const N = samples === undefined ? 200 : Math.max(4, num(samples) | 0)
    const h = DEFAULT_H
    const fpp = (x) => (callNum(fn, [x + h], fuel) - 2 * callNum(fn, [x], fuel) + callNum(fn, [x - h], fuel)) / (h * h)
    const points = []
    let prevX = A, prevS = fpp(A)
    for (let i = 1; i <= N; i++) {
      const x = A + (B - A) * i / N
      const s = fpp(x)
      if (Number.isFinite(prevS) && Number.isFinite(s) && prevS * s < 0) {
        // Bisect to refine.
        let lo = prevX, hi = x, sLo = prevS
        for (let k = 0; k < 30; k++) {
          const mid = 0.5 * (lo + hi)
          const sm = fpp(mid)
          if (sLo * sm <= 0) { hi = mid } else { lo = mid; sLo = sm }
        }
        points.push(0.5 * (lo + hi))
      }
      prevX = x; prevS = s
    }
    return points
  })

  // calc/integrate2 — Simpson's rule on 2D rectangle [a1,b1] x [a2,b2].
  // fn takes a 2-element list [x,y]. Composite Simpson with N subs.
  def('calc/integrate2', (fn, a1, b1, a2, b2, N) => {
    const NN = Math.max(2, (num(N) | 0) || 20)
    const NX = NN + (NN % 2), NY = NN + (NN % 2)   // even required for Simpson
    const A1 = num(a1), B1 = num(b1), A2 = num(a2), B2 = num(b2)
    const hx = (B1 - A1) / NX, hy = (B2 - A2) / NY
    const wx = (i) => (i === 0 || i === NX ? 1 : (i % 2 ? 4 : 2))
    const wy = (j) => (j === 0 || j === NY ? 1 : (j % 2 ? 4 : 2))
    let s = 0
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j <= NY; j++) {
        s += wx(i) * wy(j) * callNum(fn, [[A1 + i * hx, A2 + j * hy]], fuel)
      }
    }
    return s * hx * hy / 9
  })

  // calc/integrate3 — Simpson's rule on 3D box.
  def('calc/integrate3', (fn, a1, b1, a2, b2, a3, b3, N) => {
    const NN = Math.max(2, (num(N) | 0) || 12)
    const NX = NN + (NN % 2), NY = NN + (NN % 2), NZ = NN + (NN % 2)
    const A1 = num(a1), B1 = num(b1), A2 = num(a2), B2 = num(b2), A3 = num(a3), B3 = num(b3)
    const hx = (B1 - A1) / NX, hy = (B2 - A2) / NY, hz = (B3 - A3) / NZ
    const w = (i, N) => (i === 0 || i === N ? 1 : (i % 2 ? 4 : 2))
    let s = 0
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j <= NY; j++) {
        for (let k = 0; k <= NZ; k++) {
          s += w(i, NX) * w(j, NY) * w(k, NZ)
             * callNum(fn, [[A1 + i * hx, A2 + j * hy, A3 + k * hz]], fuel)
        }
      }
    }
    return s * hx * hy * hz / 27
  })

  // calc/midpoint-rule — midpoint quadrature.
  def('calc/midpoint-rule', (fn, a, b, n) => {
    const N = Math.max(1, (num(n) | 0) || 10)
    const A = num(a), B = num(b)
    const h = (B - A) / N
    let s = 0
    for (let i = 0; i < N; i++) s += callNum(fn, [A + (i + 0.5) * h], fuel)
    return s * h
  })

  // calc/normal-line — line perpendicular to y=f(x) at x=x0.
  // Returns [slope, y-intercept]. When f'(x0)=0 the normal is vertical
  // and we return the special symbol 'vertical with the x-coordinate.
  def('calc/normal-line', (fn, x0) => {
    const xx = num(x0)
    const slope = (callNum(fn, [xx + DEFAULT_H], fuel) - callNum(fn, [xx - DEFAULT_H], fuel)) / (2 * DEFAULT_H)
    const y = callNum(fn, [xx], fuel)
    if (Math.abs(slope) < 1e-12) {
      return [new Sym('vertical'), xx]
    }
    const m = -1 / slope
    const b = y - m * xx
    return [m, b]
  })

  // calc/maclaurin — Taylor series around 0.
  def('calc/maclaurin', (fn, degree) => {
    const target = env.vars.get('calc/taylor')
    if (typeof target === 'function') return target(fn, 0, degree)
    return []
  })

  // calc/series-sum — sum a_n from n=0 to N-1 (partial sum).
  //   termFn takes n and returns the n-th term.
  def('calc/series-sum', (termFn, N) => {
    const NN = Math.max(0, (num(N) | 0))
    let s = 0
    for (let n = 0; n < NN; n++) s += callNum(termFn, [n], fuel)
    return s
  })

  // calc/interval-of-convergence — from a coefficient list, use
  // radius-of-convergence R and return [-R, R] as the naive interval.
  // Endpoint behavior needs individual convergence tests; we return
  // the open interval and note the endpoints separately.
  def('calc/interval-of-convergence', (coeffs) => {
    const target = env.vars.get('calc/radius-of-convergence')
    if (typeof target !== 'function') return []
    const R = target(coeffs)
    if (!Number.isFinite(R)) return [new Sym('all-reals')]
    if (R === 0) return [0]
    return [-R, R, new Sym('endpoints-not-checked')]
  })

  // ── curve/* — differential geometry basics ────────────────────────
  //
  // curve verbs treat a parametric curve r(t) → R^n as a Scheme fn
  // taking t and returning a list of coordinates. Finite-difference
  // derivatives; symbolic diff-geometry is out of scope for this
  // substrate. Every verb here is honest — real numerical computation
  // with documented precision limits.

  const curveEval = (curve, t) => {
    const y = callAny(curve, [num(t)], fuel)
    if (Array.isArray(y)) return y.map(num)
    return [num(y)]
  }
  const curveDeriv = (curve, t, h = 1e-4) => {
    const yp = curveEval(curve, t + h)
    const ym = curveEval(curve, t - h)
    const out = new Array(yp.length)
    for (let i = 0; i < yp.length; i++) out[i] = (yp[i] - ym[i]) / (2 * h)
    return out
  }
  const curveDeriv2 = (curve, t, h = 1e-4) => {
    const yp = curveEval(curve, t + h)
    const y0 = curveEval(curve, t)
    const ym = curveEval(curve, t - h)
    const out = new Array(yp.length)
    for (let i = 0; i < yp.length; i++) out[i] = (yp[i] - 2 * y0[i] + ym[i]) / (h * h)
    return out
  }
  const vecNorm = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  const vecScale = (v, s) => v.map(x => x * s)
  const vecSub = (a, b) => a.map((x, i) => x - b[i])
  const vecDot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
  const vecCross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]

  // curve/velocity — first derivative r'(t) (tangent vector).
  def('curve/velocity', (curve, t) => curveDeriv(curve, t))

  // curve/accel — second derivative r''(t).
  def('curve/accel', (curve, t) => curveDeriv2(curve, t))

  // curve/speed — |r'(t)|.
  def('curve/speed', (curve, t) => vecNorm(curveDeriv(curve, t)))

  // curve/unit-tangent — r'/|r'|.
  def('curve/unit-tangent', (curve, t) => {
    const v = curveDeriv(curve, t)
    const s = vecNorm(v)
    if (s < 1e-12) return v.map(() => 0)
    return vecScale(v, 1 / s)
  })

  // curve/arc-length — Simpson's rule on |r'(t)| over [a, b].
  def('curve/arc-length', (curve, a, b, N) => {
    const NN = Math.max(2, (num(N) | 0) || 32)
    const NX = NN + (NN % 2)  // even for Simpson
    const A = num(a), B = num(b)
    const h = (B - A) / NX
    const w = (i) => (i === 0 || i === NX ? 1 : (i % 2 ? 4 : 2))
    let s = 0
    for (let i = 0; i <= NX; i++) {
      const v = curveDeriv(curve, A + i * h)
      s += w(i) * vecNorm(v)
    }
    return s * h / 3
  })

  // curve/curvature-2d — signed curvature of a 2D parametric curve.
  //   kappa = (x' y'' - y' x'') / (x'^2 + y'^2)^(3/2).
  def('curve/curvature-2d', (curve, t) => {
    const v = curveDeriv(curve, t)
    const a = curveDeriv2(curve, t)
    if (v.length < 2 || a.length < 2) return NaN
    const denom = Math.pow(v[0] * v[0] + v[1] * v[1], 1.5)
    if (denom < 1e-12) return NaN
    return (v[0] * a[1] - v[1] * a[0]) / denom
  })

  // curve/curvature — for 3D: |r' x r''| / |r'|^3.
  // For 2D falls back to |curvature-2d|.
  def('curve/curvature', (curve, t) => {
    const v = curveDeriv(curve, t)
    const a = curveDeriv2(curve, t)
    if (v.length >= 3 && a.length >= 3) {
      const c = vecCross3(v, a)
      const denom = Math.pow(vecNorm(v), 3)
      if (denom < 1e-12) return NaN
      return vecNorm(c) / denom
    }
    if (v.length >= 2 && a.length >= 2) {
      const denom = Math.pow(v[0] * v[0] + v[1] * v[1], 1.5)
      if (denom < 1e-12) return NaN
      return Math.abs(v[0] * a[1] - v[1] * a[0]) / denom
    }
    return NaN
  })

  // curve/normal — principal normal N = (dT/dt) / |dT/dt|.
  def('curve/normal', (curve, t) => {
    const h = 1e-4
    const Tp = env.vars.get('curve/unit-tangent')(curve, t + h)
    const Tm = env.vars.get('curve/unit-tangent')(curve, t - h)
    const dT = Tp.map((x, i) => (x - Tm[i]) / (2 * h))
    const n = vecNorm(dT)
    if (n < 1e-12) return dT.map(() => 0)
    return vecScale(dT, 1 / n)
  })

  // curve/binormal — B = T x N (3D only).
  def('curve/binormal', (curve, t) => {
    const T = env.vars.get('curve/unit-tangent')(curve, t)
    const N = env.vars.get('curve/normal')(curve, t)
    if (T.length < 3 || N.length < 3) return {
      __sakuraError: true,
      kind: 'domain-error',
      verb: 'curve/binormal',
      message: 'binormal requires a 3D curve; got dim ' + T.length,
    }
    return vecCross3(T, N)
  })

  // curve/torsion — tau = (r' x r'') · r''' / |r' x r''|^2.
  def('curve/torsion', (curve, t) => {
    const h = 1e-3
    const v = curveDeriv(curve, t)
    const a = curveDeriv2(curve, t)
    // 3rd derivative via central difference of 2nd derivatives.
    const ap = curveDeriv2(curve, t + h)
    const am = curveDeriv2(curve, t - h)
    const j = ap.map((x, i) => (x - am[i]) / (2 * h))
    if (v.length < 3 || a.length < 3 || j.length < 3) return NaN
    const c = vecCross3(v, a)
    const denom = vecDot(c, c)
    if (denom < 1e-12) return NaN
    return vecDot(c, j) / denom
  })

  // curve/frenet-frame — (T N B) as a list of vectors.
  def('curve/frenet-frame', (curve, t) => {
    const T = env.vars.get('curve/unit-tangent')(curve, t)
    const N = env.vars.get('curve/normal')(curve, t)
    if (T.length >= 3) {
      const B = vecCross3(T, N)
      return [T, N, B]
    }
    return [T, N]
  })

  // curve/osculating-circle — center + radius = 1/kappa in normal
  // direction. Returns (list center-point radius).
  def('curve/osculating-circle', (curve, t) => {
    const p = curveEval(curve, t)
    const kappa = env.vars.get('curve/curvature')(curve, t)
    if (!Number.isFinite(kappa) || kappa < 1e-12) return [p, Infinity]
    const N = env.vars.get('curve/normal')(curve, t)
    const r = 1 / kappa
    const center = p.map((x, i) => x + r * (N[i] || 0))
    return [center, r]
  })

  // curve/slope-angle — atan of dy/dx (2D).
  def('curve/slope-angle', (curve, t) => {
    const v = curveDeriv(curve, t)
    if (v.length < 2) return 0
    return Math.atan2(v[1], v[0])
  })

  // curve/gradient — for a scalar field f: R^n -> R, ∇f at a point.
  // Argument shape: (curve/gradient f point) with point a list.
  def('curve/gradient', (fn, point) => {
    if (!Array.isArray(point)) return []
    const pt = point.map(num)
    const out = new Array(pt.length)
    for (let i = 0; i < pt.length; i++) {
      const plus = pt.slice(); plus[i] = pt[i] + DEFAULT_H
      const minus = pt.slice(); minus[i] = pt[i] - DEFAULT_H
      out[i] = (callNum(fn, plus, fuel) - callNum(fn, minus, fuel)) / (2 * DEFAULT_H)
    }
    return out
  })

  // curve/cycloid — parametric cycloid: r(t) = (a(t - sin t), a(1 - cos t)).
  // Returns a fresh curve fn (a JS callable that Scheme treats as a
  // proc).
  def('curve/cycloid', (a) => {
    const A = num(a)
    return (t) => [A * (t - Math.sin(t)), A * (1 - Math.cos(t))]
  })

  // curve/spline-length — arc length of a piecewise-linear polyline.
  def('curve/spline-length', (points) => {
    if (!Array.isArray(points) || points.length < 2) return 0
    let s = 0
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i]
      s += vecNorm(vecSub(q.map(num), p.map(num)))
    }
    return s
  })

  // curve/spline-resample — resample a polyline to N equally-spaced
  // points along its arc-length.
  def('curve/spline-resample', (points, N) => {
    if (!Array.isArray(points) || points.length < 2) return []
    const NN = Math.max(2, (num(N) | 0))
    const pts = points.map(p => p.map(num))
    const segLens = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const L = vecNorm(vecSub(pts[i], pts[i - 1]))
      segLens.push(L); total += L
    }
    if (total < 1e-12) return pts.slice(0, 1)
    const out = [pts[0]]
    for (let k = 1; k < NN - 1; k++) {
      const target = (k / (NN - 1)) * total
      let acc = 0
      for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= target) {
          const t = (target - acc) / segLens[i]
          const p = pts[i], q = pts[i + 1]
          out.push(p.map((x, j) => x + t * (q[j] - x)))
          break
        }
        acc += segLens[i]
      }
    }
    out.push(pts[pts.length - 1])
    return out
  })

  // curve/fall-line — 2D: negative-gradient direction at a point on
  // a scalar height field. Returns unit vector.
  def('curve/fall-line', (field, point) => {
    const g = env.vars.get('curve/gradient')(field, point)
    if (!Array.isArray(g) || g.length === 0) return []
    const n = vecNorm(g)
    if (n < 1e-12) return g.map(() => 0)
    return vecScale(g, -1 / n)
  })

  // curve/surface-normal — for a scalar field f(x, y) = z, the outward
  // unit normal at (x, y) is proportional to (-∂z/∂x, -∂z/∂y, 1).
  def('curve/surface-normal', (field, point) => {
    if (!Array.isArray(point) || point.length < 2) return []
    const grad = env.vars.get('curve/gradient')(field, point)
    const n = [-grad[0], -grad[1], 1]
    const mag = vecNorm(n)
    return vecScale(n, 1 / mag)
  })

  // curve/first-form — first fundamental form matrix [[E,F],[F,G]] for
  // a parameterized surface r(u,v) = (x, y, z). Input: fn returning
  // 3-vec, point (u,v).
  def('curve/first-form', (surf, point) => {
    if (!Array.isArray(point) || point.length < 2) return null
    const h = 1e-4
    const [u, v] = point.map(num)
    const rP = (uu, vv) => {
      const y = callAny(surf, [[uu, vv]], fuel)
      return Array.isArray(y) ? y.map(num) : [num(y)]
    }
    const ru = rP(u + h, v).map((x, i) => (x - rP(u - h, v)[i]) / (2 * h))
    const rv = rP(u, v + h).map((x, i) => (x - rP(u, v - h)[i]) / (2 * h))
    return [[vecDot(ru, ru), vecDot(ru, rv)], [vecDot(ru, rv), vecDot(rv, rv)]]
  })

  // curve/surface-graph — turn a scalar field f(x,y) into a
  // parameterized surface (x, y, f(x,y)).
  def('curve/surface-graph', (field) => {
    return (uv) => {
      const [x, y] = uv.map(num)
      const z = num(callAny(field, [[x, y]], fuel))
      return [x, y, z]
    }
  })
}

// ── small utility helpers used by plot impls ───────────────────────

function normalizePoints(data) {
  if (!Array.isArray(data) || data.length === 0) return []
  // If every element is a 2-element list, treat as [x,y] pairs.
  const looksPaired = data.every((d) => Array.isArray(d) && d.length >= 2)
  if (looksPaired) return data.map((d) => [num(d[0]), num(d[1])])
  return data.map((d, i) => [i, num(d)])
}

function extractYs(data) {
  if (!Array.isArray(data)) return []
  if (data.length === 0) return []
  if (Array.isArray(data[0])) return data.map((d) => num(d[1]))
  return data.map(num)
}

function separateXY(pts) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return [xs, ys]
}

// Read a keyword-plist option. opts is either a list [:key val :key val ...]
// or null/undefined/empty.
function readOpt(opts, key) {
  if (!Array.isArray(opts) || opts.length === 0) return undefined
  for (let i = 0; i + 1 < opts.length; i += 2) {
    const k = nm(opts[i])
    if (k === key || k === key.replace(/^:/, '')) return opts[i + 1]
  }
  return undefined
}

function optColor(opts, def) {
  const c = readOpt(opts, ':color')
  if (c === undefined) return def
  if (typeof c === 'number') return c | 0
  if (typeof c === 'string' || c instanceof Sym) {
    const s = nm(c)
    // Simple named lookup — mirrors framebuffer's NAMED_COLORS.
    const map = { black: 0, red: 8, orange: 9, yellow: 10, green: 11, blue: 12, pink: 14, petal: 14 }
    if (map[s] !== undefined) return map[s]
  }
  return def
}

function optInt(opts, key, def) {
  const v = readOpt(opts, key)
  if (v === undefined) return def
  return num(v) | 0
}

function optList(opts, key) {
  const v = readOpt(opts, key)
  if (Array.isArray(v)) return v
  return null
}

// Return either the user's range OR compute one from the data.
function optOrRange(opts, key, values) {
  const v = readOpt(opts, key)
  if (Array.isArray(v) && v.length >= 2) return [num(v[0]), num(v[1])]
  if (values === null || values === undefined) return null
  return dataRange(values)
}

// Binomial coefficient — small integer inputs only.
function binomial(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let c = 1
  for (let i = 1; i <= k; i++) c = c * (n - i + 1) / i
  return c
}

// Factorial — small integer inputs only.
function factorial(n) {
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

export default installWiredVerbsHanaMath
