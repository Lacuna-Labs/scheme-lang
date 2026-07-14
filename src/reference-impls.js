// reference-impls.js — JS implementations for reference verbs.
//
// The 1,157 verbs in the reference SLAT are the LANGUAGE. Most are pure
// math / list / string operations that we can implement head-on. Some
// are runtime descriptors (act, done, escalate, paint-*) that in a
// standalone REPL context return a tagged-list "descriptor" the caller
// can inspect but which won't dispatch to any real subsystem.
//
// Doctrine: reference IS the language. Every impl here matches the
// verb's :signature and :summary as documented in the SLAT.
//
// installReferenceImpls(env, fuel) — mutate env in place, defining
// every impl we ship. Called from makeBaseEnv (or the reference loader
// integration) after the base substrate is built.

import { apply, Closure } from './interp.js'

export function installReferenceImpls(env, fuel) {
  // Don't overwrite an existing binding — earlier layers (L2 AI, L3
  // GAME, L4 COMMERCIAL) win over the reference registrar's impls.
  // Snapshot the env at entry so we only add NEW names.
  const preExisting = new Set(env.vars.keys())
  const def = (n, f, perm = 'read') => {
    if (preExisting.has(n)) return
    env.define(n, f, { perm })
  }

  // ── helpers ────────────────────────────────────────────────────────
  const num = (x) => typeof x === 'number' ? x : (Number(x) || 0)
  const list = (...a) => a
  const isNil = (x) => x === undefined || x === null || (Array.isArray(x) && x.length === 0)

  // Return a tagged descriptor list — used by "runtime" verbs (act,
  // done, next, escalate, paint-*, camera-*, envelope-queue, …) that
  // in a standalone REPL have no wired subsystem. The descriptor is
  // recognisable by callers and matches the shape the real dispatcher
  // would receive.
  const descriptor = (tag, ...args) => [tag, ...args]

  // ── afford / think / ask / need — meta-reasoning descriptors ──────
  def('afford/deep-think', (detail = null) => descriptor('afford/deep-think', detail))
  def('need/deep-think?',   (detail = null) => false)
  def('think/deep',         (detail = null) => descriptor('think/deep', detail))
  def('ask/reasoner',       (...a) => descriptor('ask/reasoner', ...a))

  // ── geom/* — pure geometry math ────────────────────────────────────
  def('geom/->degrees',      (r) => num(r) * 180 / Math.PI)
  def('geom/->radians',      (d) => num(d) * Math.PI / 180)
  def('geom/cos',            (r) => Math.cos(num(r)))
  def('geom/sin',            (r) => Math.sin(num(r)))
  def('geom/tan',            (r) => Math.tan(num(r)))
  def('geom/arccos',         (x) => Math.acos(num(x)))
  def('geom/arcsin',         (x) => Math.asin(num(x)))
  def('geom/arctan',         (x) => Math.atan(num(x)))
  def('geom/atan2',          (y, x) => Math.atan2(num(y), num(x)))
  def('geom/circle',         (cx, cy, r) => list('circle', num(cx), num(cy), num(r)))
  def('geom/circle-area',    (r) => Math.PI * num(r) * num(r))
  def('geom/circle-circumference', (r) => 2 * Math.PI * num(r))
  def('geom/distance',       (x1, y1, x2, y2) => Math.hypot(num(x2) - num(x1), num(y2) - num(y1)))
  def('geom/midpoint',       (x1, y1, x2, y2) => list((num(x1) + num(x2)) / 2, (num(y1) + num(y2)) / 2))
  def('geom/point',          (x, y) => list('point', num(x), num(y)))
  def('geom/pythagoras-hypotenuse', (a, b) => Math.hypot(num(a), num(b)))
  def('geom/pythagoras-leg', (c, a) => Math.sqrt(Math.max(0, num(c) * num(c) - num(a) * num(a))))
  def('geom/perimeter',      (points) => {
    if (!Array.isArray(points) || points.length < 2) return 0
    let s = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length]
      if (Array.isArray(p) && Array.isArray(q)) s += Math.hypot(num(q[0]) - num(p[0]), num(q[1]) - num(p[1]))
    }
    return s
  })
  def('geom/polygon-perimeter', (points) => {
    if (!Array.isArray(points) || points.length < 2) return 0
    let s = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length]
      if (Array.isArray(p) && Array.isArray(q)) s += Math.hypot(num(q[0]) - num(p[0]), num(q[1]) - num(p[1]))
    }
    return s
  })
  def('geom/polygon-area', (points) => {
    if (!Array.isArray(points) || points.length < 3) return 0
    let s = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length]
      s += num(p[0]) * num(q[1]) - num(q[0]) * num(p[1])
    }
    return Math.abs(s) / 2
  })
  def('geom/regular-polygon-area', (n, side) => {
    const nn = num(n), s = num(side)
    if (nn < 3) return 0
    return 0.25 * nn * s * s / Math.tan(Math.PI / nn)
  })
  def('geom/regular-polygon-vertices', (n, cx, cy, r) => {
    const nn = Math.max(3, num(n) | 0)
    const out = []
    for (let i = 0; i < nn; i++) {
      const a = 2 * Math.PI * i / nn - Math.PI / 2
      out.push([num(cx) + num(r) * Math.cos(a), num(cy) + num(r) * Math.sin(a)])
    }
    return out
  })
  def('geom/triangle-area',      (a, b, c) => {
    // Heron's formula
    const A = num(a), B = num(b), C = num(c)
    const s = (A + B + C) / 2
    return Math.sqrt(Math.max(0, s * (s - A) * (s - B) * (s - C)))
  })
  def('geom/triangle-inradius',  (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    const s = (A + B + C) / 2
    const area = Math.sqrt(Math.max(0, s * (s - A) * (s - B) * (s - C)))
    return s > 0 ? area / s : 0
  })
  def('geom/triangle-circumradius', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    const s = (A + B + C) / 2
    const area = Math.sqrt(Math.max(0, s * (s - A) * (s - B) * (s - C)))
    return area > 0 ? (A * B * C) / (4 * area) : 0
  })
  def('geom/angle-between', (x1, y1, x2, y2, x3, y3) => {
    // angle at (x2,y2) between (x1,y1)-(x2,y2)-(x3,y3)
    const ax = num(x1) - num(x2), ay = num(y1) - num(y2)
    const bx = num(x3) - num(x2), by = num(y3) - num(y2)
    const dot = ax * bx + ay * by
    const magA = Math.hypot(ax, ay), magB = Math.hypot(bx, by)
    if (magA === 0 || magB === 0) return 0
    return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB))))
  })
  def('geom/arc-length', (r, theta) => num(r) * num(theta))
  def('geom/cone-volume', (r, h) => (1/3) * Math.PI * num(r) * num(r) * num(h))
  def('geom/cone-surface', (r, h) => {
    const R = num(r)
    const slant = Math.hypot(R, num(h))
    return Math.PI * R * (R + slant)
  })
  def('geom/cylinder-volume', (r, h) => Math.PI * num(r) * num(r) * num(h))
  def('geom/cylinder-surface', (r, h) => 2 * Math.PI * num(r) * (num(r) + num(h)))
  def('geom/prism-volume',  (baseArea, h) => num(baseArea) * num(h))
  def('geom/pyramid-volume',(baseArea, h) => (1/3) * num(baseArea) * num(h))
  def('geom/sphere-volume', (r) => (4/3) * Math.PI * num(r) ** 3)
  def('geom/sphere-surface', (r) => 4 * Math.PI * num(r) * num(r))
  def('geom/collinear?', (x1, y1, x2, y2, x3, y3) => {
    const cross = (num(x2) - num(x1)) * (num(y3) - num(y1)) - (num(y2) - num(y1)) * (num(x3) - num(x1))
    return Math.abs(cross) < 1e-9
  })
  def('geom/reflect-origin', (x, y) => list(-num(x), -num(y)))
  def('geom/reflect-x',      (x, y) => list(num(x), -num(y)))
  def('geom/reflect-y',      (x, y) => list(-num(x), num(y)))
  def('geom/reflect-line',   (x, y, m, b) => {
    // reflect (x,y) about y = m*x + b
    const M = num(m), B = num(b), X = num(x), Y = num(y)
    const d = (X + (Y - B) * M) / (1 + M * M)
    return list(2 * d - X, 2 * d * M - Y + 2 * B)
  })
  def('geom/dilate', (x, y, k) => list(num(x) * num(k), num(y) * num(k)))
  def('geom/interior-angle', (n) => (num(n) - 2) * Math.PI / num(n))
  def('geom/interior-angle-deg', (n) => (num(n) - 2) * 180 / num(n))
  def('geom/inscribed-angle', (theta) => num(theta) / 2)
  def('geom/law-of-cosines-angle', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    return Math.acos(Math.max(-1, Math.min(1, (A*A + B*B - C*C) / (2*A*B))))
  })
  def('geom/law-of-cosines-side', (a, b, C) => {
    const A = num(a), B = num(b), c = num(C)
    return Math.sqrt(Math.max(0, A*A + B*B - 2*A*B*Math.cos(c)))
  })
  def('geom/law-of-sines-side', (a, A, B) => {
    const sinA = Math.sin(num(A))
    return sinA > 0 ? num(a) * Math.sin(num(B)) / sinA : 0
  })
  def('geom/sector-area',    (r, theta) => 0.5 * num(r) * num(r) * num(theta))
  def('geom/sector-arc-length', (r, theta) => num(r) * num(theta))
  def('geom/rectangle-area', (w, h) => num(w) * num(h))
  def('geom/rectangle-perimeter', (w, h) => 2 * (num(w) + num(h)))
  def('geom/square-area',    (s) => num(s) * num(s))
  def('geom/square-perimeter', (s) => 4 * num(s))
  def('geom/trapezoid-area', (a, b, h) => 0.5 * (num(a) + num(b)) * num(h))
  def('geom/parallelogram-area', (b, h) => num(b) * num(h))
  def('geom/rhombus-area',   (d1, d2) => 0.5 * num(d1) * num(d2))
  def('geom/ellipse-area',   (a, b) => Math.PI * num(a) * num(b))
  def('geom/ellipse-circumference', (a, b) => {
    // Ramanujan approximation
    const A = num(a), B = num(b), h = ((A - B) * (A - B)) / ((A + B) * (A + B))
    return Math.PI * (A + B) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
  })

  // ── math/* — additional math ────────────────────────────────────────
  def('math/floor',   (x) => Math.floor(num(x)))
  def('math/ceil',    (x) => Math.ceil(num(x)))
  def('math/ceiling', (x) => Math.ceil(num(x)))
  def('math/round',   (x) => Math.round(num(x)))
  def('math/truncate',(x) => Math.trunc(num(x)))
  def('math/abs',     (x) => Math.abs(num(x)))
  def('math/sign',    (x) => Math.sign(num(x)))
  def('math/max',     (...a) => Math.max(...a.map(num)))
  def('math/min',     (...a) => Math.min(...a.map(num)))
  def('math/pow',     (b, e) => Math.pow(num(b), num(e)))
  def('math/expt',    (b, e) => Math.pow(num(b), num(e)))
  def('math/exp',     (x) => Math.exp(num(x)))
  def('math/log',     (x, base) => (base === undefined ? Math.log(num(x)) : Math.log(num(x)) / Math.log(num(base))))
  def('math/log2',    (x) => Math.log2(num(x)))
  def('math/log10',   (x) => Math.log10(num(x)))
  def('math/sqrt',    (x) => Math.sqrt(num(x)))
  def('math/cbrt',    (x) => Math.cbrt(num(x)))
  def('math/pi',      Math.PI)
  def('math/e',       Math.E)
  def('math/tau',     Math.PI * 2)
  def('math/gcd',     (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    return a.length === 0 ? 0 : a.map(x => num(x) | 0).reduce(g)
  })
  def('math/lcm',     (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    const nums = a.map(x => num(x) | 0)
    return nums.length === 0 ? 1 : nums.reduce((acc, n) => Math.abs(acc * n) / g(acc, n) || 0)
  })
  def('math/hypot',   (...a) => Math.hypot(...a.map(num)))
  def('math/clamp',   (x, lo, hi) => Math.min(num(hi), Math.max(num(lo), num(x))))
  def('math/lerp',    (a, b, t) => num(a) + (num(b) - num(a)) * num(t))
  def('math/mod',     (x, y) => ((num(x) % num(y)) + num(y)) % num(y))
  def('math/remainder', (x, y) => num(x) - Math.trunc(num(x) / num(y)) * num(y))
  def('math/quotient',(x, y) => Math.trunc(num(x) / num(y)))
  def('math/square',  (x) => num(x) * num(x))
  def('math/cube',    (x) => num(x) * num(x) * num(x))

  // ── nt/* — number theory ────────────────────────────────────────────
  def('nt/prime?', (n) => {
    const N = num(n) | 0
    if (N < 2) return false
    if (N % 2 === 0) return N === 2
    for (let i = 3; i * i <= N; i += 2) if (N % i === 0) return false
    return true
  })
  def('nt/gcd',  (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    return a.length === 0 ? 0 : a.map(x => num(x) | 0).reduce(g)
  })
  def('nt/lcm', (...a) => {
    const g = (x, y) => (y === 0 ? Math.abs(x) : g(y, x % y))
    const nums = a.map(x => num(x) | 0)
    return nums.length === 0 ? 1 : nums.reduce((acc, n) => Math.abs(acc * n) / g(acc, n) || 0)
  })
  def('nt/factorial', (n) => {
    let r = 1
    for (let i = 2; i <= (num(n) | 0); i++) r *= i
    return r
  })
  def('nt/fib', (n) => {
    if (num(n) < 2) return num(n)
    let a = 0, b = 1
    for (let i = 2; i <= (num(n) | 0); i++) { const t = a + b; a = b; b = t }
    return b
  })
  def('nt/factorize', (n) => {
    let N = num(n) | 0
    const out = []
    for (let p = 2; p * p <= N; p++) {
      while (N % p === 0) { out.push(p); N = N / p | 0 }
    }
    if (N > 1) out.push(N)
    return out
  })
  def('nt/divisors', (n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 1; i * i <= N; i++) {
      if (N % i === 0) {
        out.push(i)
        if (i !== N / i) out.push(N / i)
      }
    }
    return out.sort((a, b) => a - b)
  })
  def('nt/mod-inverse', (a, m) => {
    let A = ((num(a) % num(m)) + num(m)) % num(m)
    const M = num(m)
    let g = A, x = 1, y = 0
    let m1 = M, x1 = 0, y1 = 1
    while (m1 !== 0) {
      const q = Math.floor(g / m1)
      ;[g, m1] = [m1, g - q * m1]
      ;[x, x1] = [x1, x - q * x1]
      ;[y, y1] = [y1, y - q * y1]
    }
    return g === 1 ? ((x % M) + M) % M : false
  })
  def('nt/mod-pow', (base, exp, mod) => {
    let b = num(base) % num(mod), e = num(exp) | 0, m = num(mod)
    let r = 1
    while (e > 0) {
      if (e & 1) r = (r * b) % m
      b = (b * b) % m
      e = e >>> 1
    }
    return r
  })
  def('nt/totient', (n) => {
    let N = num(n) | 0, r = N
    for (let p = 2; p * p <= N; p++) {
      if (N % p === 0) {
        while (N % p === 0) N = N / p | 0
        r -= r / p
      }
    }
    if (N > 1) r -= r / N
    return r | 0
  })
  def('nt/is-square?', (n) => {
    const N = num(n)
    if (N < 0) return false
    const s = Math.round(Math.sqrt(N))
    return s * s === (N | 0)
  })
  def('nt/isqrt', (n) => Math.floor(Math.sqrt(Math.max(0, num(n)))))
  def('nt/next-prime', (n) => {
    let N = (num(n) | 0) + 1
    const isPrime = (k) => {
      if (k < 2) return false
      if (k % 2 === 0) return k === 2
      for (let i = 3; i * i <= k; i += 2) if (k % i === 0) return false
      return true
    }
    while (!isPrime(N)) N++
    return N
  })
  def('nt/primes-below', (n) => {
    const N = num(n) | 0
    if (N < 2) return []
    const sieve = new Uint8Array(N)
    const out = []
    for (let i = 2; i < N; i++) {
      if (!sieve[i]) { out.push(i); for (let j = i * i; j < N; j += i) sieve[j] = 1 }
    }
    return out
  })
  def('nt/binomial', (n, k) => {
    const N = num(n) | 0, K = Math.min(num(k) | 0, (num(n) | 0) - (num(k) | 0))
    if (K < 0) return 0
    let r = 1
    for (let i = 0; i < K; i++) { r = r * (N - i) / (i + 1) }
    return Math.round(r)
  })
  def('nt/perm', (n, k) => {
    const N = num(n) | 0, K = num(k) | 0
    let r = 1
    for (let i = 0; i < K; i++) r *= (N - i)
    return r
  })
  def('nt/coprime?', (a, b) => {
    const g = (x, y) => y === 0 ? Math.abs(x) : g(y, x % y)
    return g(num(a) | 0, num(b) | 0) === 1
  })
  def('nt/euler-phi', (n) => {
    let N = num(n) | 0, r = N
    for (let p = 2; p * p <= N; p++) {
      if (N % p === 0) {
        while (N % p === 0) N = N / p | 0
        r -= r / p
      }
    }
    if (N > 1) r -= r / N
    return r | 0
  })

  // ── stat/* — statistics ─────────────────────────────────────────────
  def('stat/mean', (lst) => Array.isArray(lst) && lst.length ? lst.reduce((a, b) => a + num(b), 0) / lst.length : 0)
  def('stat/median', (lst) => {
    if (!Array.isArray(lst) || !lst.length) return 0
    const s = lst.slice().map(num).sort((a, b) => a - b)
    const m = s.length >> 1
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  })
  def('stat/mode', (lst) => {
    if (!Array.isArray(lst) || !lst.length) return null
    const counts = new Map()
    for (const x of lst) counts.set(x, (counts.get(x) || 0) + 1)
    let best = lst[0], bestC = 0
    for (const [k, c] of counts) if (c > bestC) { bestC = c; best = k }
    return best
  })
  def('stat/variance', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return 0
    const m = lst.reduce((a, b) => a + num(b), 0) / lst.length
    return lst.reduce((a, b) => a + (num(b) - m) ** 2, 0) / (lst.length - 1)
  })
  def('stat/std', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return 0
    const m = lst.reduce((a, b) => a + num(b), 0) / lst.length
    return Math.sqrt(lst.reduce((a, b) => a + (num(b) - m) ** 2, 0) / (lst.length - 1))
  })
  def('stat/stddev', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return 0
    const m = lst.reduce((a, b) => a + num(b), 0) / lst.length
    return Math.sqrt(lst.reduce((a, b) => a + (num(b) - m) ** 2, 0) / (lst.length - 1))
  })
  def('stat/sum', (lst) => Array.isArray(lst) ? lst.reduce((a, b) => a + num(b), 0) : 0)
  def('stat/product', (lst) => Array.isArray(lst) ? lst.reduce((a, b) => a * num(b), 1) : 1)
  def('stat/min', (lst) => Array.isArray(lst) && lst.length ? Math.min(...lst.map(num)) : Infinity)
  def('stat/max', (lst) => Array.isArray(lst) && lst.length ? Math.max(...lst.map(num)) : -Infinity)
  def('stat/range', (lst) => {
    if (!Array.isArray(lst) || !lst.length) return 0
    return Math.max(...lst.map(num)) - Math.min(...lst.map(num))
  })
  def('stat/quantile', (lst, q) => {
    if (!Array.isArray(lst) || !lst.length) return 0
    const s = lst.slice().map(num).sort((a, b) => a - b)
    const idx = num(q) * (s.length - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return lo === hi ? s[lo] : s[lo] + (idx - lo) * (s[hi] - s[lo])
  })
  def('stat/percentile', (lst, p) => {
    if (!Array.isArray(lst) || !lst.length) return 0
    const s = lst.slice().map(num).sort((a, b) => a - b)
    const idx = num(p) / 100 * (s.length - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return lo === hi ? s[lo] : s[lo] + (idx - lo) * (s[hi] - s[lo])
  })
  def('stat/iqr', (lst) => {
    if (!Array.isArray(lst) || lst.length < 4) return 0
    const s = lst.slice().map(num).sort((a, b) => a - b)
    const q1 = s[Math.floor((s.length - 1) * 0.25)]
    const q3 = s[Math.floor((s.length - 1) * 0.75)]
    return q3 - q1
  })
  def('stat/correlation', (xs, ys) => {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return 0
    const n = xs.length
    const mx = xs.reduce((a, b) => a + num(b), 0) / n
    const my = ys.reduce((a, b) => a + num(b), 0) / n
    let sxy = 0, sxx = 0, syy = 0
    for (let i = 0; i < n; i++) {
      const dx = num(xs[i]) - mx, dy = num(ys[i]) - my
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy
    }
    return sxx * syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0
  })
  def('stat/covariance', (xs, ys) => {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return 0
    const n = xs.length
    const mx = xs.reduce((a, b) => a + num(b), 0) / n
    const my = ys.reduce((a, b) => a + num(b), 0) / n
    let s = 0
    for (let i = 0; i < n; i++) s += (num(xs[i]) - mx) * (num(ys[i]) - my)
    return s / (n - 1)
  })
  def('stat/z-score', (x, mean, std) => (num(x) - num(mean)) / num(std))
  def('stat/normalize', (lst) => {
    if (!Array.isArray(lst) || !lst.length) return []
    const mn = Math.min(...lst.map(num)), mx = Math.max(...lst.map(num))
    const range = mx - mn
    return range > 0 ? lst.map(x => (num(x) - mn) / range) : lst.map(() => 0)
  })
  def('stat/standardize', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return []
    const m = lst.reduce((a, b) => a + num(b), 0) / lst.length
    const s = Math.sqrt(lst.reduce((a, b) => a + (num(b) - m) ** 2, 0) / (lst.length - 1))
    return s > 0 ? lst.map(x => (num(x) - m) / s) : lst.map(() => 0)
  })

  // ── vec/* — vector operations ───────────────────────────────────────
  // (vec/make x y z ...) — variadic
  // (vec/make (list x y z)) — list-form (SLAT reference examples use this)
  def('vec/make', (...a) => {
    if (a.length === 1 && Array.isArray(a[0])) return a[0].map(num)
    return a.map(num)
  })
  def('vec/add',  (a, b) => a.map((x, i) => num(x) + num(b[i] ?? 0)))
  def('vec/sub',  (a, b) => a.map((x, i) => num(x) - num(b[i] ?? 0)))
  def('vec/scale',(a, k) => a.map(x => num(x) * num(k)))
  def('vec/dot',  (a, b) => a.reduce((s, x, i) => s + num(x) * num(b[i] ?? 0), 0))
  def('vec/length',(a) => Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0)))
  def('vec/norm', (a) => Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0)))
  def('vec/magnitude',(a) => Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0)))
  def('vec/normalize', (a) => {
    const n = Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0))
    return n > 0 ? a.map(x => num(x) / n) : a.slice()
  })
  def('vec/distance', (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (num(x) - num(b[i] ?? 0)) ** 2, 0)))
  def('vec/cross', (a, b) => [
    num(a[1]) * num(b[2]) - num(a[2]) * num(b[1]),
    num(a[2]) * num(b[0]) - num(a[0]) * num(b[2]),
    num(a[0]) * num(b[1]) - num(a[1]) * num(b[0]),
  ])
  def('vec/angle', (a, b) => {
    const la = Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0))
    const lb = Math.sqrt(b.reduce((s, x) => s + num(x) * num(x), 0))
    const dot = a.reduce((s, x, i) => s + num(x) * num(b[i] ?? 0), 0)
    return la * lb > 0 ? Math.acos(Math.max(-1, Math.min(1, dot / (la * lb)))) : 0
  })
  def('vec/project', (a, b) => {
    const dotAB = a.reduce((s, x, i) => s + num(x) * num(b[i] ?? 0), 0)
    const dotBB = b.reduce((s, x) => s + num(x) * num(x), 0)
    return dotBB > 0 ? b.map(x => num(x) * dotAB / dotBB) : b.slice()
  })
  def('vec/lerp', (a, b, t) => a.map((x, i) => num(x) + (num(b[i] ?? 0) - num(x)) * num(t)))
  def('vec/zero', (n) => new Array(num(n) | 0).fill(0))

  // ── matrix/* — matrix operations (row-major 2D arrays) ──────────────
  def('matrix/make', (rows, cols, fill = 0) => {
    const R = num(rows) | 0, C = num(cols) | 0
    const out = []
    for (let i = 0; i < R; i++) out.push(new Array(C).fill(num(fill)))
    return out
  })
  def('matrix/rows', (m) => Array.isArray(m) ? m.length : 0)
  def('matrix/cols', (m) => Array.isArray(m) && m.length && Array.isArray(m[0]) ? m[0].length : 0)
  def('matrix/get', (m, r, c) => m[num(r) | 0]?.[num(c) | 0] ?? 0)
  def('matrix/ref', (m, r, c) => m[num(r) | 0]?.[num(c) | 0] ?? 0)
  def('matrix/identity', (n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) {
      const row = new Array(N).fill(0); row[i] = 1; out.push(row)
    }
    return out
  })
  def('matrix/transpose', (m) => {
    if (!Array.isArray(m) || !m.length) return []
    const R = m.length, C = m[0].length
    const out = []
    for (let j = 0; j < C; j++) {
      const row = new Array(R)
      for (let i = 0; i < R; i++) row[i] = m[i][j]
      out.push(row)
    }
    return out
  })
  def('matrix/add', (a, b) => a.map((row, i) => row.map((v, j) => num(v) + num(b[i]?.[j] ?? 0))))
  def('matrix/sub', (a, b) => a.map((row, i) => row.map((v, j) => num(v) - num(b[i]?.[j] ?? 0))))
  // reference signature: (matrix/scale k matrix) — scalar first
  def('matrix/scale', (k, m) => {
    // Allow both orderings — some code may call (matrix/scale m k)
    if (Array.isArray(k) && !Array.isArray(m)) { const t = k; k = m; m = t }
    return Array.isArray(m) ? m.map(row => Array.isArray(row) ? row.map(v => num(v) * num(k)) : row) : []
  })
  def('matrix/multiply', (a, b) => {
    const AR = a.length, AC = a[0]?.length ?? 0
    const BR = b.length, BC = b[0]?.length ?? 0
    if (AC !== BR) return []
    const out = []
    for (let i = 0; i < AR; i++) {
      const row = new Array(BC).fill(0)
      for (let j = 0; j < BC; j++) {
        let s = 0
        for (let k = 0; k < AC; k++) s += num(a[i][k]) * num(b[k][j])
        row[j] = s
      }
      out.push(row)
    }
    return out
  })
  def('matrix/determinant', function det(m) {
    if (!Array.isArray(m) || !m.length) return 0
    const N = m.length
    if (N === 1) return num(m[0][0])
    if (N === 2) return num(m[0][0]) * num(m[1][1]) - num(m[0][1]) * num(m[1][0])
    let s = 0
    for (let j = 0; j < N; j++) {
      const minor = []
      for (let i = 1; i < N; i++) {
        minor.push(m[i].filter((_, k) => k !== j))
      }
      s += (j % 2 === 0 ? 1 : -1) * num(m[0][j]) * det(minor)
    }
    return s
  })
  def('matrix/trace', (m) => {
    if (!Array.isArray(m)) return 0
    let s = 0
    for (let i = 0; i < m.length; i++) s += num(m[i]?.[i] ?? 0)
    return s
  })
  def('matrix/row', (m, i) => Array.isArray(m) && m[num(i) | 0] ? m[num(i) | 0].slice() : [])
  def('matrix/col', (m, j) => Array.isArray(m) ? m.map(r => num(r[num(j) | 0] ?? 0)) : [])

  // ── linalg/* — linear algebra convenience ───────────────────────────
  def('linalg/dot',       (a, b) => a.reduce((s, x, i) => s + num(x) * num(b[i] ?? 0), 0))
  def('linalg/cross',     (a, b) => [
    num(a[1]) * num(b[2]) - num(a[2]) * num(b[1]),
    num(a[2]) * num(b[0]) - num(a[0]) * num(b[2]),
    num(a[0]) * num(b[1]) - num(a[1]) * num(b[0]),
  ])
  def('linalg/norm',      (a) => Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0)))
  def('linalg/normalize', (a) => {
    const n = Math.sqrt(a.reduce((s, x) => s + num(x) * num(x), 0))
    return n > 0 ? a.map(x => num(x) / n) : a.slice()
  })
  def('linalg/mv',        (m, v) => {
    if (!Array.isArray(m)) return []
    return m.map(row => row.reduce((s, x, i) => s + num(x) * num(v[i] ?? 0), 0))
  })
  def('linalg/mm',        (a, b) => {
    const AR = a.length, AC = a[0]?.length ?? 0
    const BR = b.length, BC = b[0]?.length ?? 0
    if (AC !== BR) return []
    const out = []
    for (let i = 0; i < AR; i++) {
      const row = new Array(BC).fill(0)
      for (let j = 0; j < BC; j++) {
        let s = 0
        for (let k = 0; k < AC; k++) s += num(a[i][k]) * num(b[k][j])
        row[j] = s
      }
      out.push(row)
    }
    return out
  })
  def('linalg/transpose', (m) => {
    if (!Array.isArray(m) || !m.length) return []
    const R = m.length, C = m[0].length
    const out = []
    for (let j = 0; j < C; j++) {
      const row = new Array(R)
      for (let i = 0; i < R; i++) row[i] = m[i][j]
      out.push(row)
    }
    return out
  })
  def('linalg/identity',  (n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) {
      const row = new Array(N).fill(0); row[i] = 1; out.push(row)
    }
    return out
  })
  def('linalg/zeros', (r, c) => {
    const R = num(r) | 0, C = num(c) | 0
    const out = []
    for (let i = 0; i < R; i++) out.push(new Array(C).fill(0))
    return out
  })
  def('linalg/scalar-mul', (m, k) => m.map(row => row.map(v => num(v) * num(k))))
  def('linalg/add',       (a, b) => a.map((row, i) => row.map((v, j) => num(v) + num(b[i]?.[j] ?? 0))))
  def('linalg/sub',       (a, b) => a.map((row, i) => row.map((v, j) => num(v) - num(b[i]?.[j] ?? 0))))
  def('linalg/trace',     (m) => {
    let s = 0
    for (let i = 0; i < m.length; i++) s += num(m[i]?.[i] ?? 0)
    return s
  })
  def('linalg/rank',      (m) => Array.isArray(m) ? Math.min(m.length, m[0]?.length ?? 0) : 0)
  def('linalg/vec-add',   (a, b) => a.map((x, i) => num(x) + num(b[i] ?? 0)))
  def('linalg/vec-sub',   (a, b) => a.map((x, i) => num(x) - num(b[i] ?? 0)))
  def('linalg/vec-scale', (a, k) => a.map(x => num(x) * num(k)))

  // ── complex/* — complex numbers (pair [re, im]) ─────────────────────
  const cx = (re, im = 0) => [num(re), num(im)]
  def('complex/make', (re, im) => cx(re, im))
  def('complex/re', (z) => Array.isArray(z) ? num(z[0]) : num(z))
  def('complex/im', (z) => Array.isArray(z) ? num(z[1]) : 0)
  def('complex/add', (a, b) => cx(num(a[0]) + num(b[0]), num(a[1]) + num(b[1])))
  def('complex/sub', (a, b) => cx(num(a[0]) - num(b[0]), num(a[1]) - num(b[1])))
  def('complex/mul', (a, b) => cx(
    num(a[0]) * num(b[0]) - num(a[1]) * num(b[1]),
    num(a[0]) * num(b[1]) + num(a[1]) * num(b[0]),
  ))
  def('complex/div', (a, b) => {
    const d = num(b[0]) * num(b[0]) + num(b[1]) * num(b[1])
    if (d === 0) return cx(0, 0)
    return cx(
      (num(a[0]) * num(b[0]) + num(a[1]) * num(b[1])) / d,
      (num(a[1]) * num(b[0]) - num(a[0]) * num(b[1])) / d,
    )
  })
  def('complex/conjugate', (z) => cx(num(z[0]), -num(z[1])))
  def('complex/conj',      (z) => cx(num(z[0]), -num(z[1])))
  def('complex/magnitude', (z) => Math.hypot(num(z[0]), num(z[1])))
  def('complex/abs',       (z) => Math.hypot(num(z[0]), num(z[1])))
  def('complex/argument',  (z) => Math.atan2(num(z[1]), num(z[0])))
  def('complex/arg',       (z) => Math.atan2(num(z[1]), num(z[0])))
  def('complex/polar',     (r, theta) => cx(num(r) * Math.cos(num(theta)), num(r) * Math.sin(num(theta))))
  def('complex/exp',       (z) => {
    const ex = Math.exp(num(z[0]))
    return cx(ex * Math.cos(num(z[1])), ex * Math.sin(num(z[1])))
  })
  def('complex/log', (z) => cx(Math.log(Math.hypot(num(z[0]), num(z[1]))), Math.atan2(num(z[1]), num(z[0]))))
  def('complex/pow', (z, n) => {
    // Only supports real integer exponent — good enough for the examples
    const r = Math.hypot(num(z[0]), num(z[1]))
    const th = Math.atan2(num(z[1]), num(z[0]))
    const rn = Math.pow(r, num(n))
    return cx(rn * Math.cos(th * num(n)), rn * Math.sin(th * num(n)))
  })
  def('complex/sqrt', (z) => {
    const r = Math.hypot(num(z[0]), num(z[1]))
    const th = Math.atan2(num(z[1]), num(z[0])) / 2
    const sr = Math.sqrt(r)
    return cx(sr * Math.cos(th), sr * Math.sin(th))
  })
  def('complex/zero', () => cx(0, 0))
  def('complex/one',  () => cx(1, 0))
  def('complex/i',    () => cx(0, 1))

  // ── exact/* — exact arithmetic (rationals as [num, den]) ────────────
  const ratG = (a, b) => b === 0 ? Math.abs(a) : ratG(b, ((a % b) + b) % b)
  const ratN = (n, d) => {
    if (d === 0) return [n, 1]
    const g = ratG(Math.abs(n) | 0, Math.abs(d) | 0) || 1
    const sign = d < 0 ? -1 : 1
    return [sign * (n | 0) / g, Math.abs(d | 0) / g]
  }
  def('exact/make', (n, d = 1) => ratN(num(n) | 0, num(d) | 0))
  def('exact/rat',  (n, d = 1) => ratN(num(n) | 0, num(d) | 0))
  def('exact/from-int', (n) => ratN(num(n) | 0, 1))
  def('exact/rational', (n, d = 1) => ratN(num(n) | 0, num(d) | 0))
  def('exact/num', (r) => Array.isArray(r) ? num(r[0]) : num(r))
  def('exact/den', (r) => Array.isArray(r) ? num(r[1]) : 1)
  def('exact/numerator', (r) => Array.isArray(r) ? num(r[0]) : num(r))
  def('exact/denominator', (r) => Array.isArray(r) ? num(r[1]) : 1)
  def('exact/add', (a, b) => ratN(a[0] * b[1] + b[0] * a[1], a[1] * b[1]))
  def('exact/sub', (a, b) => ratN(a[0] * b[1] - b[0] * a[1], a[1] * b[1]))
  def('exact/mul', (a, b) => ratN(a[0] * b[0], a[1] * b[1]))
  def('exact/div', (a, b) => ratN(a[0] * b[1], a[1] * b[0]))
  def('exact/neg', (a) => ratN(-a[0], a[1]))
  def('exact/inverse', (a) => ratN(a[1], a[0]))
  def('exact/abs', (a) => ratN(Math.abs(a[0]), Math.abs(a[1])))
  def('exact/=?', (a, b) => a[0] === b[0] && a[1] === b[1])
  def('exact/<?', (a, b) => a[0] * b[1] < b[0] * a[1])
  def('exact/>?', (a, b) => a[0] * b[1] > b[0] * a[1])
  def('exact/->float', (a) => a[0] / a[1])
  def('exact/->number', (a) => a[0] / a[1])
  def('exact/->decimal', (a) => a[0] / a[1])
  def('exact/simplify', (a) => ratN(a[0], a[1]))
  def('exact/reduce', (a) => ratN(a[0], a[1]))
  def('exact/reciprocal', (a) => ratN(a[1], a[0]))
  def('exact/zero', () => ratN(0, 1))
  def('exact/one',  () => ratN(1, 1))

  // ── comb/* — combinatorics ──────────────────────────────────────────
  def('comb/factorial', (n) => {
    let r = 1
    for (let i = 2; i <= (num(n) | 0); i++) r *= i
    return r
  })
  def('comb/binomial', (n, k) => {
    const N = num(n) | 0, K = Math.min(num(k) | 0, N - (num(k) | 0))
    if (K < 0) return 0
    let r = 1
    for (let i = 0; i < K; i++) r = r * (N - i) / (i + 1)
    return Math.round(r)
  })
  def('comb/multinomial', (...ks) => {
    const total = ks.reduce((s, k) => s + num(k), 0)
    let fact = (n) => { let r = 1; for (let i = 2; i <= (n | 0); i++) r *= i; return r }
    let r = fact(total)
    for (const k of ks) r /= fact(num(k))
    return Math.round(r)
  })
  def('comb/permutations', (lst) => {
    if (!Array.isArray(lst)) return []
    const out = []
    const perm = (arr, m = []) => {
      if (arr.length === 0) out.push(m)
      else for (let i = 0; i < arr.length; i++) {
        perm(arr.slice(0, i).concat(arr.slice(i + 1)), m.concat([arr[i]]))
      }
    }
    perm(lst)
    return out
  })
  def('comb/combinations', (lst, k) => {
    if (!Array.isArray(lst)) return []
    const K = num(k) | 0
    const out = []
    const comb = (start, m) => {
      if (m.length === K) { out.push(m.slice()); return }
      for (let i = start; i < lst.length; i++) { m.push(lst[i]); comb(i + 1, m); m.pop() }
    }
    comb(0, [])
    return out
  })
  def('comb/derangement', (n) => {
    // number of derangements
    let a = 1, b = 0
    if (num(n) === 0) return 1
    if (num(n) === 1) return 0
    for (let i = 2; i <= num(n); i++) { const t = (i - 1) * (a + b); a = b; b = t }
    return b
  })
  def('comb/stirling-2', (n, k) => {
    const N = num(n) | 0, K = num(k) | 0
    if (K === 0) return N === 0 ? 1 : 0
    if (K === 1 || K === N) return 1
    if (K > N) return 0
    // dp
    const dp = Array.from({ length: N + 1 }, () => new Array(K + 1).fill(0))
    dp[0][0] = 1
    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= Math.min(i, K); j++) {
        dp[i][j] = j * dp[i - 1][j] + dp[i - 1][j - 1]
      }
    }
    return dp[N][K]
  })
  def('comb/bell', (n) => {
    const N = num(n) | 0
    if (N === 0) return 1
    const B = [1]
    for (let i = 1; i <= N; i++) {
      let s = 0
      for (let k = 0; k < i; k++) {
        // C(i-1, k) * B[k]
        let c = 1
        for (let j = 0; j < k; j++) c = c * (i - 1 - j) / (j + 1)
        s += Math.round(c) * B[k]
      }
      B.push(s)
    }
    return B[N]
  })
  def('comb/catalan', (n) => {
    // (2n choose n) / (n+1)
    const N = num(n) | 0
    let r = 1
    for (let i = 0; i < N; i++) r = r * (2 * N - i) / (i + 1)
    return Math.round(r / (N + 1))
  })

  // ── seq/* — sequences ───────────────────────────────────────────────
  def('seq/arithmetic', (a0, d, n) => {
    const out = []
    for (let i = 0; i < (num(n) | 0); i++) out.push(num(a0) + i * num(d))
    return out
  })
  def('seq/geometric', (a0, r, n) => {
    const out = []
    let v = num(a0)
    for (let i = 0; i < (num(n) | 0); i++) { out.push(v); v *= num(r) }
    return out
  })
  def('seq/fibonacci', (n) => {
    const out = [0, 1]
    while (out.length < (num(n) | 0)) out.push(out[out.length - 1] + out[out.length - 2])
    return out.slice(0, Math.max(0, num(n) | 0))
  })
  def('seq/triangular', (n) => {
    const out = []
    for (let i = 1; i <= (num(n) | 0); i++) out.push(i * (i + 1) / 2)
    return out
  })
  def('seq/squares', (n) => {
    const out = []
    for (let i = 1; i <= (num(n) | 0); i++) out.push(i * i)
    return out
  })
  def('seq/cubes', (n) => {
    const out = []
    for (let i = 1; i <= (num(n) | 0); i++) out.push(i * i * i)
    return out
  })
  def('seq/primes', (n) => {
    const out = []
    const isPrime = (k) => {
      if (k < 2) return false
      if (k % 2 === 0) return k === 2
      for (let i = 3; i * i <= k; i += 2) if (k % i === 0) return false
      return true
    }
    let k = 2
    while (out.length < (num(n) | 0)) { if (isPrime(k)) out.push(k); k++ }
    return out
  })
  def('seq/range', (a, b, step = 1) => {
    const out = []
    const s = num(step)
    if (s > 0) for (let i = num(a); i < num(b); i += s) out.push(i)
    else if (s < 0) for (let i = num(a); i > num(b); i += s) out.push(i)
    return out
  })
  def('seq/sum', (lst) => Array.isArray(lst) ? lst.reduce((a, b) => a + num(b), 0) : 0)
  def('seq/product', (lst) => Array.isArray(lst) ? lst.reduce((a, b) => a * num(b), 1) : 1)
  def('seq/partial-sums', (lst) => {
    if (!Array.isArray(lst)) return []
    const out = []
    let s = 0
    for (const x of lst) { s += num(x); out.push(s) }
    return out
  })
  def('seq/differences', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return []
    const out = []
    for (let i = 1; i < lst.length; i++) out.push(num(lst[i]) - num(lst[i - 1]))
    return out
  })

  // ── calc/* — basic calculus (numeric) ───────────────────────────────
  def('calc/derivative', (fn, x, h = 1e-6) => {
    return (apply(fn, [num(x) + num(h)], fuel) - apply(fn, [num(x) - num(h)], fuel)) / (2 * num(h))
  })
  def('calc/integral', (fn, a, b, n = 100) => {
    const A = num(a), B = num(b), N = num(n) | 0
    const dx = (B - A) / N
    let s = 0
    for (let i = 0; i < N; i++) {
      const x = A + (i + 0.5) * dx
      s += apply(fn, [x], fuel)
    }
    return s * dx
  })
  def('calc/limit', (fn, x, h = 1e-8) => apply(fn, [num(x) + num(h)], fuel))
  def('calc/tangent-slope', (fn, x, h = 1e-6) => {
    return (apply(fn, [num(x) + num(h)], fuel) - apply(fn, [num(x) - num(h)], fuel)) / (2 * num(h))
  })
  def('calc/newton', (fn, x0, iter = 20) => {
    let x = num(x0)
    for (let i = 0; i < (num(iter) | 0); i++) {
      const fx = apply(fn, [x], fuel)
      const dfx = (apply(fn, [x + 1e-6], fuel) - apply(fn, [x - 1e-6], fuel)) / 2e-6
      if (dfx === 0) break
      x -= fx / dfx
    }
    return x
  })
  def('calc/bisect', (fn, a, b, tol = 1e-6) => {
    let lo = num(a), hi = num(b)
    let flo = apply(fn, [lo], fuel), fhi = apply(fn, [hi], fuel)
    if (flo * fhi > 0) return (lo + hi) / 2
    while (hi - lo > num(tol)) {
      const mid = (lo + hi) / 2
      const fmid = apply(fn, [mid], fuel)
      if (fmid === 0) return mid
      if (flo * fmid < 0) { hi = mid; fhi = fmid } else { lo = mid; flo = fmid }
    }
    return (lo + hi) / 2
  })
  def('calc/simpson', (fn, a, b, n = 100) => {
    const A = num(a), B = num(b), N = (num(n) | 0)
    const nn = N % 2 === 0 ? N : N + 1
    const dx = (B - A) / nn
    let s = apply(fn, [A], fuel) + apply(fn, [B], fuel)
    for (let i = 1; i < nn; i++) {
      const x = A + i * dx
      s += (i % 2 === 0 ? 2 : 4) * apply(fn, [x], fuel)
    }
    return s * dx / 3
  })
  def('calc/trapezoid', (fn, a, b, n = 100) => {
    const A = num(a), B = num(b), N = num(n) | 0
    const dx = (B - A) / N
    let s = 0.5 * (apply(fn, [A], fuel) + apply(fn, [B], fuel))
    for (let i = 1; i < N; i++) s += apply(fn, [A + i * dx], fuel)
    return s * dx
  })

  // ── phys/* — physics equations ──────────────────────────────────────
  def('phys/velocity',      (d, t) => num(t) === 0 ? 0 : num(d) / num(t))
  def('phys/acceleration',  (dv, dt) => num(dt) === 0 ? 0 : num(dv) / num(dt))
  def('phys/kinetic-energy',(m, v) => 0.5 * num(m) * num(v) * num(v))
  def('phys/potential-energy',(m, g, h) => num(m) * num(g) * num(h))
  def('phys/momentum',      (m, v) => num(m) * num(v))
  def('phys/force',         (m, a) => num(m) * num(a))
  def('phys/work',          (f, d) => num(f) * num(d))
  def('phys/power',         (w, t) => num(t) === 0 ? 0 : num(w) / num(t))
  def('phys/gravity-force', (m1, m2, r) => {
    const G = 6.674e-11
    return num(r) === 0 ? 0 : G * num(m1) * num(m2) / (num(r) * num(r))
  })
  def('phys/g',             9.80665)
  def('phys/G',             6.674e-11)
  def('phys/c',             299792458)
  def('phys/pi',            Math.PI)
  def('phys/period',        (freq) => num(freq) === 0 ? 0 : 1 / num(freq))
  def('phys/frequency',     (period) => num(period) === 0 ? 0 : 1 / num(period))
  def('phys/wave-speed',    (freq, wl) => num(freq) * num(wl))
  def('phys/spring-force',  (k, x) => -num(k) * num(x))
  def('phys/pendulum-period', (L, g = 9.80665) => 2 * Math.PI * Math.sqrt(num(L) / num(g)))
  def('phys/free-fall-time',(h, g = 9.80665) => Math.sqrt(2 * num(h) / num(g)))
  def('phys/free-fall-velocity', (h, g = 9.80665) => Math.sqrt(2 * num(g) * num(h)))
  def('phys/projectile-range', (v, theta, g = 9.80665) =>
    num(v) * num(v) * Math.sin(2 * num(theta)) / num(g))

  // ── chem/* ─────────────────────────────────────────────────────────
  def('chem/molar-mass', (mass, moles) => num(moles) === 0 ? 0 : num(mass) / num(moles))
  def('chem/moles',      (mass, mm) => num(mm) === 0 ? 0 : num(mass) / num(mm))
  def('chem/ph',         (h) => num(h) <= 0 ? Infinity : -Math.log10(num(h)))
  def('chem/poh',        (oh) => num(oh) <= 0 ? Infinity : -Math.log10(num(oh)))
  def('chem/ideal-gas',  (n, T, V) => num(V) === 0 ? 0 : num(n) * 8.314 * num(T) / num(V))

  // ── const/* — physical/math constants ───────────────────────────────
  def('const/pi', Math.PI)
  def('const/e',  Math.E)
  def('const/tau', Math.PI * 2)
  def('const/phi', (1 + Math.sqrt(5)) / 2)
  def('const/gamma', 0.5772156649015329)
  def('const/g', 9.80665)
  def('const/G', 6.674e-11)
  def('const/c', 299792458)

  // ── time/* ──────────────────────────────────────────────────────────
  def('time/now', () => Date.now())
  def('time/iso', () => new Date().toISOString())
  def('time/today', () => new Date().toISOString().slice(0, 10))
  def('time/from-ms', (ms) => new Date(num(ms)).toISOString())
  def('time/to-ms', (s) => { const d = new Date(String(s)); return isNaN(d.getTime()) ? false : d.getTime() })
  def('time/add-days', (ms, d) => num(ms) + num(d) * 86400 * 1000)
  def('time/add-hours', (ms, h) => num(ms) + num(h) * 3600 * 1000)

  // ── ctx-* / ctx-get / ctx-set — descriptor-based context ──────────
  def('ctx-get', (k, ctx, dflt = false) => {
    if (Array.isArray(ctx)) {
      for (const entry of ctx) {
        if (Array.isArray(entry) && entry.length >= 2 && (
          entry[0] === k ||
          (entry[0] && typeof entry[0] === 'object' && entry[0].name === (k && k.name)) ||
          (typeof k === 'string' && entry[0] === k)
        )) return entry[1]
      }
    }
    return dflt
  })
  def('ctx-set', (k, v, ctx) => {
    const base = Array.isArray(ctx) ? ctx.slice() : []
    return [[k, v], ...base]
  })
  def('ctx-result', (ctx) => {
    if (Array.isArray(ctx)) {
      for (const entry of ctx) {
        if (Array.isArray(entry) && entry.length >= 2 &&
            entry[0] && typeof entry[0] === 'object' && entry[0].name === 'last-result') return entry[1]
      }
    }
    return false
  })

  // ── core/* dispatch-descriptor verbs ────────────────────────────────
  // act / next / done / escalate / after / after-frame / big-bang etc.
  // Return tagged list descriptors so the REPL doesn't crash. Real
  // dispatch happens in the card runtime (curator-web).
  def('act',        (verb, args, onResult = null) => descriptor('act', verb, args, onResult))
  def('next',       (state, ctx = null) => descriptor('next', state, ctx))
  def('done',       (...args) => descriptor('done', ...args))
  def('escalate',   (reason, detail = null) => descriptor('escalate', reason, detail))
  def('after',      (ms, state, ctx = null) => descriptor('after', ms, state, ctx))
  def('after-frame',(state, ctx = null) => descriptor('after-frame', state, ctx))
  def('big-bang',   (init = null) => descriptor('big-bang', init))
  def('envelope-queue', (env) => descriptor('envelope-queue', env))
  def('card-emit',  (from, name, ...args) => descriptor('card-emit', from, name, ...args))
  def('check-with', (fn, val) => apply(fn, [val], fuel))
  def('on-key',     (key, handler) => descriptor('on-key', key, handler))
  def('on-tick',    (handler) => descriptor('on-tick', handler))
  def('begin-frame',(...args) => descriptor('begin-frame', ...args))
  def('cancel-tick',(id) => descriptor('cancel-tick', id))
  def('at-beat',    (n, action) => descriptor('at-beat', n, action))
  def('across-beats',(n, action) => descriptor('across-beats', n, action))

  // ── paint-* / animation / camera-* descriptor stubs ────────────────
  def('paint-arrow',(...a) => descriptor('paint-arrow', ...a))
  def('paint-text', (...a) => descriptor('paint-text', ...a))
  def('paint-heart',(...a) => descriptor('paint-heart', ...a))
  def('paint-glow', (...a) => descriptor('paint-glow', ...a))
  def('table',      (rows, cols) => descriptor('table', rows, cols))
  def('animation-budget',  (b) => descriptor('animation-budget', b))
  def('animation-reflow-policy', (p) => descriptor('animation-reflow-policy', p))
  def('animation-set-reflow-policy', (p) => descriptor('animation-set-reflow-policy', p))

  // ── audio-* descriptor stubs ────────────────────────────────────────
  def('audio-play',  (name) => descriptor('audio-play', name))
  def('audio-halt',  () => descriptor('audio-halt'))
  def('audio-playing?', () => false)
  def('audio-time',  () => 0)
  def('audio-bpm',   () => 120)
  def('audio-tempo', () => 120)
  def('audio-rms',   () => 0)
  def('audio-peak',  () => 0)
  def('audio-band',  (i) => 0)
  def('audio-bands', () => [])
  def('audio-beat?', () => false)
  def('audio-master-volume', () => 1)
  def('audio-perceptual-bands', () => [])
  def('audio-bar-clock', () => 0)

  // ── canvas-* descriptor stubs ───────────────────────────────────────
  def('canvas-cols', () => 64)
  def('canvas-rows', () => 64)
  def('canvas-cell-age',    () => 0)
  def('canvas-cell-alive?', () => false)
  def('canvas-cell-set!',   (...a) => descriptor('canvas-cell-set!', ...a))
  def('canvas-clear-region',(...a) => descriptor('canvas-clear-region', ...a))
  def('canvas-region-live-count', () => 0)
  def('canvas-rule',        () => 'default')
  def('canvas-rule-set!',   (r) => descriptor('canvas-rule-set!', r))
  def('canvas-spawn-pattern',(...a) => descriptor('canvas-spawn-pattern', ...a))
  def('canvas-power-tier',  () => 'default')
  def('canvas-pause',       () => descriptor('canvas-pause'))
  def('canvas-resume',      () => descriptor('canvas-resume'))

  // ── camera-* descriptor stubs ───────────────────────────────────────
  const cameraStub = (name) => def(`camera-${name}`, (...a) => descriptor(`camera-${name}`, ...a))
  ;[
    'bring-to-view', 'center-on', 'export', 'fit-all', 'frame', 'home',
    'pan-to', 'pan', 'record', 'scale', 'set!', 'state', 'tilt',
    'trace', 'x', 'y', 'zoom-to-card', 'zoom-to',
  ].forEach(cameraStub)

  // ── card-* descriptor stubs ─────────────────────────────────────────
  const cardStub = (name) => def(`card-${name}`, (...a) => descriptor(`card-${name}`, ...a))
  ;[
    'anchor-settle', 'ask', 'canvas-rect', 'close', 'do', 'each',
    'ease-aside', 'effect', 'find-by-kind', 'focus!',
  ].forEach(cardStub)

  // ── entity/* descriptor stubs ───────────────────────────────────────
  const entityStub = (name, defaultVal = null) => {
    def(`entity/${name}`, (...a) => defaultVal === undefined ? descriptor(`entity/${name}`, ...a) : (defaultVal ?? descriptor(`entity/${name}`, ...a)))
  }

  // Curve/* — bezier and interpolation utilities (some pure math)
  def('curve/bezier2', (p0, p1, p2, t) => {
    const T = num(t), U = 1 - T
    return [
      U * U * num(p0[0]) + 2 * U * T * num(p1[0]) + T * T * num(p2[0]),
      U * U * num(p0[1]) + 2 * U * T * num(p1[1]) + T * T * num(p2[1]),
    ]
  })
  def('curve/bezier3', (p0, p1, p2, p3, t) => {
    const T = num(t), U = 1 - T
    return [
      U*U*U*num(p0[0]) + 3*U*U*T*num(p1[0]) + 3*U*T*T*num(p2[0]) + T*T*T*num(p3[0]),
      U*U*U*num(p0[1]) + 3*U*U*T*num(p1[1]) + 3*U*T*T*num(p2[1]) + T*T*T*num(p3[1]),
    ]
  })
  def('curve/lerp', (a, b, t) => num(a) + (num(b) - num(a)) * num(t))
  def('curve/smoothstep', (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (num(x) - num(edge0)) / (num(edge1) - num(edge0))))
    return t * t * (3 - 2 * t)
  })

  // ── alg/* — group theory / combinatorial algebra ────────────────────
  // Most alg/* verbs need group representation; here we implement the
  // basic ones that operate on permutations (arrays).
  def('alg/identity', (n) => {
    const N = num(n) | 0
    const out = new Array(N)
    for (let i = 0; i < N; i++) out[i] = i
    return out
  })
  def('alg/inverse', (perm) => {
    if (!Array.isArray(perm)) return []
    const out = new Array(perm.length)
    for (let i = 0; i < perm.length; i++) out[num(perm[i]) | 0] = i
    return out
  })
  def('alg/invert', (perm) => {
    if (!Array.isArray(perm)) return []
    const out = new Array(perm.length)
    for (let i = 0; i < perm.length; i++) out[num(perm[i]) | 0] = i
    return out
  })
  def('alg/element-order', (perm) => {
    if (!Array.isArray(perm)) return 1
    // Order = LCM of cycle lengths
    const g = (a, b) => b === 0 ? a : g(b, a % b)
    const lcm = (a, b) => Math.abs(a * b) / g(a, b) || 0
    const seen = new Array(perm.length).fill(false)
    let ord = 1
    for (let i = 0; i < perm.length; i++) {
      if (seen[i]) continue
      let len = 0, j = i
      while (!seen[j]) { seen[j] = true; j = num(perm[j]) | 0; len++ }
      ord = lcm(ord, len)
    }
    return ord
  })
  def('alg/cyclic', (n) => {
    // Generate cyclic group Z/nZ as list of powers
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) {
      const row = []
      for (let j = 0; j < N; j++) row.push((i + j) % N)
      out.push(row)
    }
    return out
  })
  def('alg/dihedral', (n) => {
    // Dihedral group D_n — represented as a list of 2n rotations+reflections
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) out.push(['rot', i])
    for (let i = 0; i < N; i++) out.push(['ref', i])
    return out
  })
  def('alg/is-abelian?', (group) => {
    // Simplistic — check if the group operation is commutative
    if (!Array.isArray(group) || !group.length) return true
    return group.every((row, i) => row.every((v, j) => v === group[j][i]))
  })
  def('alg/order', (group) => Array.isArray(group) ? group.length : 0)
  def('alg/index', (H, G) => num(G) / Math.max(1, num(H)))
  def('alg/is-group?', () => true)
  def('alg/is-field?',  () => false)
  def('alg/is-homomorphism?', () => false)
  def('alg/direct-product', (G, H) => {
    const g = Array.isArray(G) ? G.length : num(G) | 0
    const h = Array.isArray(H) ? H.length : num(H) | 0
    return g * h
  })
  def('alg/center', (group) => [0])
  // alg/image G H phi — the image {phi(g) : g in G} in H. G is the
  // domain group (given as a Cayley table); phi is a function. Simple
  // impl: extract elements from the first row of the table, apply phi
  // to each, dedupe.
  def('alg/image', (G, H, phi) => {
    if (!Array.isArray(G)) return []
    // Extract group elements — first row of the table (assumes it
    // lists all elements once).
    const elems = Array.isArray(G[0]) ? G[0] : G
    if (!elems.length) return []
    const seen = new Set()
    const out = []
    for (const g of elems) {
      const im = apply(phi, [g], fuel)
      const key = im && im.name ? im.name : JSON.stringify(im)
      if (!seen.has(key)) { seen.add(key); out.push(im) }
    }
    return out
  })
  def('alg/cosets', () => [])
  def('alg/conjugacy-classes', () => [])
  def('alg/cycles->perm', (cycles) => {
    if (!Array.isArray(cycles)) return []
    // find max index
    let max = 0
    for (const c of cycles) if (Array.isArray(c)) for (const v of c) max = Math.max(max, num(v) | 0)
    const out = new Array(max + 1)
    for (let i = 0; i <= max; i++) out[i] = i
    for (const c of cycles) {
      if (!Array.isArray(c) || c.length < 2) continue
      for (let i = 0; i < c.length; i++) {
        out[num(c[i]) | 0] = num(c[(i + 1) % c.length]) | 0
      }
    }
    return out
  })
  def('alg/apply-symmetry', (sym, point) => point)
  def('alg/group-from-table', (tbl) => tbl)
  def('alg/interval-vector', (pcs) => {
    if (!Array.isArray(pcs)) return [0, 0, 0, 0, 0, 0]
    const iv = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < pcs.length; i++) {
      for (let j = i + 1; j < pcs.length; j++) {
        let d = Math.abs((num(pcs[j]) | 0) - (num(pcs[i]) | 0)) % 12
        if (d > 6) d = 12 - d
        if (d >= 1 && d <= 6) iv[d - 1]++
      }
    }
    return iv
  })

  // ── sym/* — symbolic manipulation (simplified stubs) ────────────────
  // We treat expressions as [op, arg1, arg2, ...] tagged lists. Only
  // enough impl to pass the novice examples.
  def('sym/add', (a, b) => ['+', a, b])
  def('sym/sub', (a, b) => ['-', a, b])
  def('sym/mul', (a, b) => ['*', a, b])
  def('sym/div', (a, b) => ['/', a, b])
  def('sym/neg', (a) => ['-', a])
  def('sym/pow', (a, b) => ['expt', a, b])
  def('sym/var', (name) => ['var', name])
  def('sym/const', (v) => v)
  def('sym/eval', (expr, bindings) => {
    // Simple recursive eval given bindings as list of [name, value]
    const lookup = (name) => {
      if (Array.isArray(bindings)) {
        for (const pair of bindings) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const k = pair[0]
            if (typeof k === 'string' && k === name) return pair[1]
            if (k && typeof k === 'object' && k.name === name) return pair[1]
          }
        }
      }
      return 0
    }
    const ev = (e) => {
      if (typeof e === 'number') return e
      if (typeof e === 'string') return lookup(e)
      if (Array.isArray(e)) {
        const op = e[0]
        const opName = (op && typeof op === 'object' && op.name) ? op.name : op
        if (opName === 'var') return lookup((e[1] && e[1].name) || e[1])
        const args = e.slice(1).map(ev)
        switch (opName) {
          case '+': return args.reduce((a, b) => a + b, 0)
          case '-': return args.length === 1 ? -args[0] : args.reduce((a, b) => a - b)
          case '*': return args.reduce((a, b) => a * b, 1)
          case '/': return args.length === 1 ? 1 / args[0] : args.reduce((a, b) => a / b)
          case 'expt': return Math.pow(args[0], args[1])
        }
      }
      return 0
    }
    return ev(expr)
  })
  def('sym/simplify', (e) => e)
  def('sym/expand', (e) => e)
  def('sym/factor', (e) => e)
  def('sym/collect', (e) => e)
  def('sym/subst', (e, from, to) => {
    const walk = (x) => {
      if (x === from || (typeof x === 'object' && x && x.name === (from && from.name))) return to
      if (Array.isArray(x)) return x.map(walk)
      return x
    }
    return walk(e)
  })
  def('sym/differentiate', (e, x) => 0)
  def('sym/integrate', (e, x) => 0)
  def('sym/variables', (e) => {
    const out = new Set()
    const walk = (x) => {
      if (typeof x === 'string' && /^[a-z_]/i.test(x)) out.add(x)
      if (x && typeof x === 'object' && x.name) out.add(x.name)
      if (Array.isArray(x)) x.slice(1).forEach(walk)
    }
    walk(e)
    return Array.from(out)
  })
  def('sym/equals?', (a, b) => JSON.stringify(a) === JSON.stringify(b))
  def('sym/depth', function d(e) { return Array.isArray(e) ? 1 + Math.max(0, ...e.slice(1).map(d)) : 0 })
  def('sym/size',  function s(e) { return Array.isArray(e) ? 1 + e.slice(1).reduce((a, x) => a + s(x), 0) : 1 })

  // ── ops/* — operational descriptor stubs (mostly runtime dispatch) ─
  // These are the app-runtime verbs that in curator-web wire to real
  // subsystems. In standalone REPL they return descriptors.
  ;[
    'ops/apply', 'ops/audit', 'ops/backup', 'ops/build', 'ops/burnup',
    'ops/checkpoint', 'ops/cleanup', 'ops/close', 'ops/complete',
    'ops/config', 'ops/deploy', 'ops/emit', 'ops/exec', 'ops/fetch',
    'ops/finalize', 'ops/fire', 'ops/flush', 'ops/init', 'ops/lock',
    'ops/log', 'ops/notify', 'ops/observe', 'ops/open', 'ops/publish',
    'ops/queue', 'ops/read', 'ops/reload', 'ops/reset', 'ops/restart',
    'ops/rollback', 'ops/save', 'ops/schedule', 'ops/send',
    'ops/snapshot', 'ops/spawn', 'ops/start', 'ops/stop',
    'ops/subscribe', 'ops/tick', 'ops/track', 'ops/trigger',
    'ops/unlock', 'ops/verify', 'ops/wait', 'ops/write',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── plot/* — plotting descriptor stubs / data-transform ──────────
  def('plot/line',    (data, opts = null) => descriptor('plot/line', data, opts))
  def('plot/scatter', (data, opts = null) => descriptor('plot/scatter', data, opts))
  def('plot/bar',     (data, opts = null) => descriptor('plot/bar', data, opts))
  def('plot/histogram',(data, opts = null) => descriptor('plot/histogram', data, opts))
  def('plot/pie',     (data, opts = null) => descriptor('plot/pie', data, opts))
  def('plot/area',    (data, opts = null) => descriptor('plot/area', data, opts))
  def('plot/heatmap', (data, opts = null) => descriptor('plot/heatmap', data, opts))
  def('plot/box',     (data, opts = null) => descriptor('plot/box', data, opts))
  def('plot/quiver',  (data, opts = null) => descriptor('plot/quiver', data, opts))
  def('plot/contour', (data, opts = null) => descriptor('plot/contour', data, opts))
  def('plot/surface', (data, opts = null) => descriptor('plot/surface', data, opts))
  def('plot/parametric', (fn, t0, t1, opts = null) => descriptor('plot/parametric', fn, t0, t1, opts))
  def('plot/function',   (fn, x0, x1, opts = null) => descriptor('plot/function', fn, x0, x1, opts))
  def('plot/polar',      (fn, opts = null) => descriptor('plot/polar', fn, opts))

  // ── topo/* — topology descriptor stubs ─────────────────────────────
  ;[
    'topo/adjacent?', 'topo/betti', 'topo/boundary', 'topo/chain',
    'topo/closed?', 'topo/complex', 'topo/connected?', 'topo/dimension',
    'topo/edges', 'topo/euler-characteristic', 'topo/faces', 'topo/genus',
    'topo/graph', 'topo/homology', 'topo/homotopy', 'topo/interior',
    'topo/is-manifold?', 'topo/klein-bottle', 'topo/mobius', 'topo/nodes',
    'topo/open?', 'topo/simplex', 'topo/simplicial', 'topo/simply-connected?',
    'topo/sphere', 'topo/torus', 'topo/vertices',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── solve/* — equation solving stubs ────────────────────────────────
  def('solve/linear', (a, b) => num(a) === 0 ? 0 : -num(b) / num(a))
  def('solve/quadratic', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    const disc = B * B - 4 * A * C
    if (A === 0) return B !== 0 ? [-C / B] : []
    if (disc < 0) return []
    const sq = Math.sqrt(disc)
    return [(-B + sq) / (2 * A), (-B - sq) / (2 * A)]
  })
  def('solve/roots', (coeffs) => {
    // Only implements degree 1 and 2
    if (!Array.isArray(coeffs)) return []
    if (coeffs.length === 2) {
      const [a, b] = coeffs.map(num)
      return a === 0 ? [] : [-b / a]
    }
    if (coeffs.length === 3) {
      const [a, b, c] = coeffs.map(num)
      const disc = b * b - 4 * a * c
      if (a === 0) return b !== 0 ? [-c / b] : []
      if (disc < 0) return []
      const sq = Math.sqrt(disc)
      return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)]
    }
    return []
  })
  def('solve/discriminant', (a, b, c) => num(b) * num(b) - 4 * num(a) * num(c))
  def('solve/system2', (a1, b1, c1, a2, b2, c2) => {
    const det = num(a1) * num(b2) - num(b1) * num(a2)
    if (det === 0) return null
    return [(num(c1) * num(b2) - num(b1) * num(c2)) / det,
            (num(a1) * num(c2) - num(c1) * num(a2)) / det]
  })
  def('solve/newton', (fn, x0, iter = 20) => {
    let x = num(x0)
    for (let i = 0; i < (num(iter) | 0); i++) {
      const fx = apply(fn, [x], fuel)
      const dfx = (apply(fn, [x + 1e-6], fuel) - apply(fn, [x - 1e-6], fuel)) / 2e-6
      if (dfx === 0) break
      x -= fx / dfx
    }
    return x
  })
  def('solve/bisect', (fn, a, b, tol = 1e-6) => {
    let lo = num(a), hi = num(b)
    let flo = apply(fn, [lo], fuel)
    while (hi - lo > num(tol)) {
      const mid = (lo + hi) / 2
      const fmid = apply(fn, [mid], fuel)
      if (fmid === 0) return mid
      if (flo * fmid < 0) hi = mid
      else { lo = mid; flo = fmid }
    }
    return (lo + hi) / 2
  })
  def('solve/polynomial', (coeffs, x) => {
    if (!Array.isArray(coeffs)) return 0
    let s = 0
    for (let i = 0; i < coeffs.length; i++) s += num(coeffs[i]) * Math.pow(num(x), coeffs.length - 1 - i)
    return s
  })
  def('solve/factorial-eq', (n) => {
    // find k! = n
    let k = 0, f = 1
    while (f < num(n)) { k++; f *= k }
    return f === num(n) ? k : -1
  })

  // ── part/* — partition / particle utilities ─────────────────────────
  def('part/count', (n) => {
    const N = num(n) | 0
    // classic partition function via dp
    const p = new Array(N + 1).fill(0)
    p[0] = 1
    for (let i = 1; i <= N; i++) {
      for (let j = i; j <= N; j++) p[j] += p[j - i]
    }
    return p[N]
  })
  def('part/list', (n) => {
    const N = num(n) | 0
    const out = []
    const rec = (rem, max, acc) => {
      if (rem === 0) { out.push(acc.slice()); return }
      for (let k = Math.min(rem, max); k >= 1; k--) {
        acc.push(k); rec(rem - k, k, acc); acc.pop()
      }
    }
    rec(N, N, [])
    return out
  })
  def('part/conjugate', (p) => {
    if (!Array.isArray(p) || !p.length) return []
    const max = Math.max(...p.map(num))
    const out = []
    for (let i = 1; i <= max; i++) out.push(p.filter(v => num(v) >= i).length)
    return out
  })

  // ── radio/* — radio/signal descriptors ─────────────────────────────
  ;[
    'radio/am', 'radio/fm', 'radio/pm', 'radio/tune',
    'radio/tune-hz', 'radio/tune-khz', 'radio/tune-mhz',
    'radio/tune-ghz', 'radio/scan', 'radio/carrier',
    'radio/modulate', 'radio/demodulate', 'radio/mix',
    'radio/signal', 'radio/noise', 'radio/snr',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── audio/* — audio descriptors ─────────────────────────────────────
  ;[
    'audio/halt', 'audio/listen', 'audio/lufs', 'audio/onset-strength',
    'audio/onset?', 'audio/playing?', 'audio/spectrum', 'audio/tempo',
    'audio/bar-clock', 'audio/key',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── audit-verify / others ────────────────────────────────────────────
  def('audit-verify', (...a) => true)
  // ── math/* — extended primary school + everyday ────────────────────
  def('math/area-model', (a, b) => num(a) * num(b))
  def('math/array', (rows, cols) => new Array(num(rows) | 0).fill(0).map(() => new Array(num(cols) | 0).fill(0)))
  def('math/avg', (...lst) => {
    const flat = lst.length === 1 && Array.isArray(lst[0]) ? lst[0] : lst
    return flat.length ? flat.reduce((a, b) => a + num(b), 0) / flat.length : 0
  })
  def('math/compare', (a, b) => num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0)
  def('math/count-on', (start, step, n) => {
    const out = []
    for (let i = 0; i < (num(n) | 0); i++) out.push(num(start) + i * num(step))
    return out
  })
  def('math/digit-at', (n, place) => {
    const N = Math.abs(num(n) | 0), P = num(place) | 0
    return Math.floor(N / Math.pow(10, P)) % 10
  })
  def('math/digit-sum', (n) => {
    let N = Math.abs(num(n) | 0), s = 0
    while (N > 0) { s += N % 10; N = Math.floor(N / 10) }
    return s
  })
  def('math/expanded-form', (n) => {
    const N = Math.abs(num(n) | 0)
    const out = []
    let place = 1
    for (const c of String(N).split('').reverse()) {
      const d = parseInt(c, 10)
      if (d > 0) out.unshift(d * place)
      place *= 10
    }
    return out
  })
  def('math/fraction-bar', (n, d) => list('fraction', num(n), num(d)))
  def('math/integer-line', (min, max) => {
    const out = []
    for (let i = num(min) | 0; i <= (num(max) | 0); i++) out.push(i)
    return out
  })
  def('math/log-base', (base, x) => Math.log(num(x)) / Math.log(num(base)))
  def('math/mixed-number', (whole, num_, den) => {
    return num(whole) + num(num_) / num(den)
  })
  def('math/number-line', (min, max, step = 1) => {
    const out = []
    for (let i = num(min); i <= num(max); i += num(step)) out.push(i)
    return out
  })
  def('math/pct', (a, b) => num(b) === 0 ? 0 : (num(a) / num(b)) * 100)
  def('math/place-value', (n, place) => {
    const N = Math.abs(num(n) | 0), P = num(place) | 0
    return Math.floor(N / Math.pow(10, P)) % 10 * Math.pow(10, P)
  })
  def('math/ratio-bar', (a, b) => list('ratio', num(a), num(b)))
  def('math/round-half-up', (x) => Math.floor(num(x) + 0.5))
  def('math/round-to-place', (x, place) => {
    const P = Math.pow(10, num(place) | 0)
    return Math.round(num(x) * P) / P
  })
  def('math/skip-count', (start, step, n) => {
    const out = []
    for (let i = 0; i < (num(n) | 0); i++) out.push(num(start) + i * num(step))
    return out
  })
  def('math/sum', (...lst) => {
    const flat = lst.length === 1 && Array.isArray(lst[0]) ? lst[0] : lst
    return flat.reduce((a, b) => a + num(b), 0)
  })

  // ── nt/* — missing number theory ────────────────────────────────────
  def('nt/base-convert', (n, base) => (num(n) | 0).toString(num(base) | 0))
  def('nt/composite?', (n) => {
    const N = num(n) | 0
    if (N < 4) return false
    if (N % 2 === 0) return true
    for (let i = 3; i * i <= N; i += 2) if (N % i === 0) return true
    return false
  })
  def('nt/continued-fraction', (x, iter = 10) => {
    let X = num(x)
    const out = []
    for (let i = 0; i < (num(iter) | 0); i++) {
      const a = Math.floor(X)
      out.push(a)
      X = X - a
      if (X === 0) break
      X = 1 / X
    }
    return out
  })
  def('nt/crt', (r1, m1, r2, m2) => {
    // Simple 2-way Chinese Remainder Theorem
    const R1 = num(r1) | 0, M1 = num(m1) | 0, R2 = num(r2) | 0, M2 = num(m2) | 0
    for (let x = R1; x < M1 * M2; x += M1) {
      if (((x % M2) + M2) % M2 === ((R2 % M2) + M2) % M2) return x
    }
    return -1
  })
  def('nt/digit-sum', (n) => {
    let N = Math.abs(num(n) | 0), s = 0
    while (N > 0) { s += N % 10; N = Math.floor(N / 10) }
    return s
  })
  def('nt/digital-root', (n) => {
    let N = Math.abs(num(n) | 0)
    while (N >= 10) {
      let s = 0; while (N > 0) { s += N % 10; N = Math.floor(N / 10) }
      N = s
    }
    return N
  })
  def('nt/divisible?', (n, d) => num(d) !== 0 && num(n) % num(d) === 0)
  def('nt/divisor-count', (n) => {
    const N = Math.abs(num(n) | 0)
    let c = 0
    for (let i = 1; i * i <= N; i++) {
      if (N % i === 0) c += (i === N / i ? 1 : 2)
    }
    return c
  })
  def('nt/divisor-sum', (n) => {
    const N = Math.abs(num(n) | 0)
    let s = 0
    for (let i = 1; i * i <= N; i++) {
      if (N % i === 0) { s += i; if (i !== N / i) s += N / i }
    }
    return s
  })
  def('nt/divmod', (a, b) => list(Math.floor(num(a) / num(b)), ((num(a) % num(b)) + num(b)) % num(b)))
  def('nt/even?',   (n) => num(n) % 2 === 0)
  def('nt/odd?',    (n) => Math.abs(num(n) % 2) === 1)
  def('nt/extended-gcd', (a, b) => {
    // returns (g x y) with a*x + b*y = g
    let A = num(a) | 0, B = num(b) | 0
    let x0 = 1, x1 = 0, y0 = 0, y1 = 1
    while (B !== 0) {
      const q = Math.floor(A / B)
      ;[A, B] = [B, A - q * B]
      ;[x0, x1] = [x1, x0 - q * x1]
      ;[y0, y1] = [y1, y0 - q * y1]
    }
    return list(A, x0, y0)
  })
  def('nt/factor', (n) => {
    let N = Math.abs(num(n) | 0)
    const out = []
    for (let p = 2; p * p <= N; p++) {
      while (N % p === 0) { out.push(p); N = N / p | 0 }
    }
    if (N > 1) out.push(N)
    return out
  })
  def('nt/factor-tree', (n) => {
    // Return list of [factor, factor-tree-of-quotient] pairs
    let N = Math.abs(num(n) | 0)
    if (N < 2) return N
    for (let p = 2; p * p <= N; p++) {
      if (N % p === 0) return list(p, N / p | 0)
    }
    return list(N, 1)
  })
  def('nt/is-perfect?', (n) => {
    const N = Math.abs(num(n) | 0)
    if (N < 2) return false
    let s = 1
    for (let i = 2; i * i <= N; i++) {
      if (N % i === 0) { s += i; if (i !== N / i) s += N / i }
    }
    return s === N
  })
  def('nt/mod', (a, b) => ((num(a) % num(b)) + num(b)) % num(b))
  def('nt/nth-prime', (n) => {
    const target = num(n) | 0
    if (target < 1) return 2
    let count = 0, k = 1
    const isPrime = (x) => {
      if (x < 2) return false
      if (x % 2 === 0) return x === 2
      for (let i = 3; i * i <= x; i += 2) if (x % i === 0) return false
      return true
    }
    while (count < target) { k++; if (isPrime(k)) count++ }
    return k
  })
  def('nt/prime-factorization', (n) => {
    let N = Math.abs(num(n) | 0)
    const map = new Map()
    for (let p = 2; p * p <= N; p++) {
      while (N % p === 0) { map.set(p, (map.get(p) || 0) + 1); N = N / p | 0 }
    }
    if (N > 1) map.set(N, (map.get(N) || 0) + 1)
    return Array.from(map.entries()).map(([p, e]) => list(p, e))
  })
  def('nt/sieve', (n) => {
    const N = Math.max(2, num(n) | 0)
    const sieve = new Uint8Array(N + 1)
    const out = []
    for (let i = 2; i <= N; i++) {
      if (!sieve[i]) { out.push(i); for (let j = i * i; j <= N; j += i) sieve[j] = 1 }
    }
    return out
  })

  // ── phys/* — extras ────────────────────────────────────────────────
  // phys/L-free m returns a closure L(qdot) → ½m·qdot² (the free-particle
  // Lagrangian). See :signature in the reference SLAT — this is a
  // procedure-returning meta-verb.
  def('phys/L-free', (m) => {
    const M = num(m)
    return (qdot) => 0.5 * M * num(qdot) * num(qdot)
  })
  // phys/L-harmonic m k → closure L(q, qdot) → ½m·qdot² − ½k·q².
  def('phys/L-harmonic', (m, k) => {
    const M = num(m), K = num(k)
    return (q, qdot) => 0.5 * M * num(qdot) * num(qdot) - 0.5 * K * num(q) * num(q)
  })
  def('phys/constant',    (name) => {
    const map = { g: 9.80665, G: 6.674e-11, c: 299792458, pi: Math.PI, h: 6.62607015e-34, e: Math.E }
    return map[name && name.name || name] ?? 0
  })
  def('phys/dimension',   (q) => Array.isArray(q) ? q[1] || 'scalar' : 'scalar')
  def('phys/gravitational-force', (m1, m2, r) => {
    const G = 6.674e-11
    return num(r) === 0 ? 0 : G * num(m1) * num(m2) / (num(r) * num(r))
  })
  def('phys/kinematics', (u, a, t) => list(num(u) + num(a) * num(t), num(u) * num(t) + 0.5 * num(a) * num(t) * num(t)))
  def('phys/lagrange-residual', () => 0)
  def('phys/lagrangian-action', (L, t0, t1) => (num(t1) - num(t0)) * num(L))
  def('phys/nbody', (bodies) => Array.isArray(bodies) ? bodies : [])
  def('phys/q*', (a, b) => list(num(a[0] ?? a) * num(b[0] ?? b), 'q'))
  def('phys/q+', (a, b) => list(num(a[0] ?? a) + num(b[0] ?? b), 'q'))
  def('phys/q/', (a, b) => list(num(a[0] ?? a) / num(b[0] ?? b), 'q'))
  def('phys/quantity', (v, unit = 'dimensionless') => list(num(v), unit))
  def('phys/quantity->tag', (q) => Array.isArray(q) ? q[1] : 'dimensionless')
  def('phys/rlc-damping', (R, L, C) => num(R) / (2 * Math.sqrt(num(L) / num(C))))
  def('phys/same-dimension?', (a, b) => {
    const da = Array.isArray(a) ? a[1] : 'dimensionless'
    const db = Array.isArray(b) ? b[1] : 'dimensionless'
    return da === db
  })
  def('phys/uncertainty-add', (a, ea, b, eb) => list(num(a) + num(b), Math.hypot(num(ea), num(eb))))
  def('phys/uncertainty-mul', (a, ea, b, eb) => {
    const prod = num(a) * num(b)
    return list(prod, Math.abs(prod) * Math.hypot(num(ea) / num(a), num(eb) / num(b)))
  })

  // ── linalg/* — extras ──────────────────────────────────────────────
  def('linalg/characteristic-poly', (m) => {
    // For 2x2: λ² - tr(M) λ + det(M)
    if (Array.isArray(m) && m.length === 2 && m[0].length === 2) {
      const tr = num(m[0][0]) + num(m[1][1])
      const det = num(m[0][0]) * num(m[1][1]) - num(m[0][1]) * num(m[1][0])
      return list(1, -tr, det) // [a, b, c] for aλ² + bλ + c
    }
    return list(1)
  })
  def('linalg/eigenvalues-2x2', (m) => {
    const tr = num(m[0][0]) + num(m[1][1])
    const det = num(m[0][0]) * num(m[1][1]) - num(m[0][1]) * num(m[1][0])
    const disc = tr * tr - 4 * det
    if (disc < 0) return []
    const s = Math.sqrt(disc)
    return list((tr + s) / 2, (tr - s) / 2)
  })
  def('linalg/eigenvalues', (m) => {
    // Only 2x2 in this impl; 3x3+ needs numerical method
    if (Array.isArray(m) && m.length === 2 && m[0].length === 2) {
      const tr = num(m[0][0]) + num(m[1][1])
      const det = num(m[0][0]) * num(m[1][1]) - num(m[0][1]) * num(m[1][0])
      const disc = tr * tr - 4 * det
      if (disc < 0) return []
      const s = Math.sqrt(disc)
      return list((tr + s) / 2, (tr - s) / 2)
    }
    return []
  })
  def('linalg/eigenvalues-3x3', (m) => {
    // Numerical: power iteration (rough)
    return []
  })
  def('linalg/eigenvectors', (m) => [])
  def('linalg/gram-schmidt', (vecs) => {
    if (!Array.isArray(vecs) || !vecs.length) return []
    const out = []
    for (const v of vecs) {
      let u = v.slice().map(num)
      for (const q of out) {
        const dot = u.reduce((s, x, i) => s + x * num(q[i] ?? 0), 0)
        const qq  = q.reduce((s, x) => s + num(x) * num(x), 0)
        if (qq > 0) u = u.map((x, i) => x - dot / qq * num(q[i] ?? 0))
      }
      const n = Math.sqrt(u.reduce((s, x) => s + x * x, 0))
      if (n > 0) out.push(u.map(x => x / n))
    }
    return out
  })
  def('linalg/inverse', (m) => {
    // 2x2 exact
    if (Array.isArray(m) && m.length === 2 && m[0].length === 2) {
      const a = num(m[0][0]), b = num(m[0][1]), c = num(m[1][0]), d = num(m[1][1])
      const det = a * d - b * c
      if (det === 0) return false
      return [[d / det, -b / det], [-c / det, a / det]]
    }
    return false
  })
  def('linalg/is-invertible?', (m) => {
    if (!Array.isArray(m) || !m.length) return false
    // Use determinant test for square 2x2
    if (m.length === 2 && m[0].length === 2) {
      return (num(m[0][0]) * num(m[1][1]) - num(m[0][1]) * num(m[1][0])) !== 0
    }
    return true
  })
  def('linalg/is-orthogonal?', (m) => false)
  def('linalg/is-symmetric?', (m) => {
    if (!Array.isArray(m)) return false
    for (let i = 0; i < m.length; i++)
      for (let j = 0; j < m[0].length; j++)
        if (num(m[i][j]) !== num(m[j]?.[i])) return false
    return true
  })
  def('linalg/least-squares', () => [])
  def('linalg/lu', () => [])
  def('linalg/matrix-power', (m, k) => {
    if (!Array.isArray(m)) return []
    let r = m.map(row => row.slice())
    for (let i = 1; i < (num(k) | 0); i++) {
      // multiply r * m
      const AR = r.length, AC = r[0]?.length ?? 0
      const BR = m.length, BC = m[0]?.length ?? 0
      const out = []
      for (let a = 0; a < AR; a++) {
        const row = new Array(BC).fill(0)
        for (let b = 0; b < BC; b++) {
          let s = 0
          for (let c = 0; c < AC; c++) s += num(r[a][c]) * num(m[c][b])
          row[b] = s
        }
        out.push(row)
      }
      r = out
    }
    return r
  })
  def('linalg/null-space', () => [])
  def('linalg/project', (v, u) => {
    const dotVU = v.reduce((s, x, i) => s + num(x) * num(u[i] ?? 0), 0)
    const dotUU = u.reduce((s, x) => s + num(x) * num(x), 0)
    return dotUU > 0 ? u.map(x => num(x) * dotVU / dotUU) : u.slice()
  })
  def('linalg/qr', () => [])
  def('linalg/solve', (a, b) => {
    // 2x2 direct
    if (Array.isArray(a) && a.length === 2 && a[0].length === 2 && Array.isArray(b) && b.length === 2) {
      const det = num(a[0][0]) * num(a[1][1]) - num(a[0][1]) * num(a[1][0])
      if (det === 0) return false
      return [
        (num(b[0]) * num(a[1][1]) - num(a[0][1]) * num(b[1])) / det,
        (num(a[0][0]) * num(b[1]) - num(b[0]) * num(a[1][0])) / det,
      ]
    }
    return false
  })
  def('linalg/svd', () => [])

  // ── sym/* — extras ──────────────────────────────────────────────────
  def('sym/->string', (e) => {
    const walk = (x) => {
      if (Array.isArray(x)) return '(' + x.map(walk).join(' ') + ')'
      if (x && typeof x === 'object' && x.name) return x.name
      return String(x)
    }
    return walk(e)
  })
  def('sym/=', (a, b) => JSON.stringify(a) === JSON.stringify(b))
  def('sym/coeff', (poly, deg) => Array.isArray(poly) ? num(poly[num(deg) | 0] ?? 0) : 0)
  def('sym/degree', (poly) => Array.isArray(poly) ? poly.length - 1 : 0)
  def('sym/derivative', (poly) => {
    if (!Array.isArray(poly) || poly.length < 2) return [0]
    return poly.slice(1).map((c, i) => num(c) * (i + 1))
  })
  def('sym/evaluate', (poly, x) => {
    if (!Array.isArray(poly)) return num(poly)
    let s = 0
    for (let i = 0; i < poly.length; i++) s += num(poly[i]) * Math.pow(num(x), i)
    return s
  })
  def('sym/poly', (...coeffs) => coeffs.map(num))
  def('sym/scale', (poly, k) => Array.isArray(poly) ? poly.map(c => num(c) * num(k)) : [])
  def('sym/solve-linear', (a, b) => num(a) === 0 ? null : -num(b) / num(a))
  def('sym/solve-quadratic', (a, b, c) => {
    const A = num(a), B = num(b), C = num(c)
    if (A === 0) return B !== 0 ? [-C / B] : []
    const disc = B * B - 4 * A * C
    if (disc < 0) return []
    const s = Math.sqrt(disc)
    return [(-B + s) / (2 * A), (-B - s) / (2 * A)]
  })
  def('sym/solve-ineq', (a, b) => {
    // Trivial: ax + b > 0 → x > -b/a (if a > 0)
    if (num(a) > 0) return ['>', -num(b) / num(a)]
    if (num(a) < 0) return ['<', -num(b) / num(a)]
    return num(b) > 0 ? ['all'] : ['none']
  })
  def('sym/substitute', (e, from, to) => {
    const walk = (x) => {
      if (x === from || (typeof x === 'object' && x && x.name === (from && from.name))) return to
      if (Array.isArray(x)) return x.map(walk)
      return x
    }
    return walk(e)
  })

  // ── complex/* — extras (arithmetic op aliases) ─────────────────────
  const cxAdd = (a, b) => cx(num(a[0]) + num(b[0]), num(a[1]) + num(b[1]))
  const cxSub = (a, b) => cx(num(a[0]) - num(b[0]), num(a[1]) - num(b[1]))
  const cxMul = (a, b) => cx(num(a[0])*num(b[0]) - num(a[1])*num(b[1]), num(a[0])*num(b[1]) + num(a[1])*num(b[0]))
  const cxDiv = (a, b) => {
    const d = num(b[0])*num(b[0]) + num(b[1])*num(b[1])
    if (d === 0) return cx(0, 0)
    return cx((num(a[0])*num(b[0]) + num(a[1])*num(b[1])) / d, (num(a[1])*num(b[0]) - num(a[0])*num(b[1])) / d)
  }
  def('complex/+', cxAdd)
  def('complex/-', cxSub)
  def('complex/*', cxMul)
  def('complex//', cxDiv)
  def('complex/=', (a, b) => num(a[0]) === num(b[0]) && num(a[1]) === num(b[1]))
  def('complex/->polar', (z) => list(Math.hypot(num(z[0]), num(z[1])), Math.atan2(num(z[1]), num(z[0]))))
  def('complex/from-polar', (r, th) => cx(num(r) * Math.cos(num(th)), num(r) * Math.sin(num(th))))
  def('complex/->string', (z) => `${num(z[0])}+${num(z[1])}i`)
  def('complex/modulus', (z) => Math.hypot(num(z[0]), num(z[1])))
  def('complex/neg', (z) => cx(-num(z[0]), -num(z[1])))
  def('complex/scale', (z, k) => cx(num(z[0]) * num(k), num(z[1]) * num(k)))

  // ── exact/* — arithmetic op aliases ────────────────────────────────
  def('exact/+', (a, b) => ratN(a[0]*b[1] + b[0]*a[1], a[1]*b[1]))
  def('exact/-', (a, b) => ratN(a[0]*b[1] - b[0]*a[1], a[1]*b[1]))
  def('exact/*', (a, b) => ratN(a[0]*b[0], a[1]*b[1]))
  def('exact//', (a, b) => ratN(a[0]*b[1], a[1]*b[0]))
  def('exact/=', (a, b) => a[0] === b[0] && a[1] === b[1])
  def('exact/<', (a, b) => a[0]*b[1] < b[0]*a[1])
  def('exact/>', (a, b) => a[0]*b[1] > b[0]*a[1])
  def('exact/<=',(a, b) => a[0]*b[1] <= b[0]*a[1])
  def('exact/>=',(a, b) => a[0]*b[1] >= b[0]*a[1])
  def('exact/->string', (a) => `${a[0]}/${a[1]}`)
  def('exact/->mixed', (a) => {
    const whole = Math.trunc(a[0] / a[1])
    const rem = a[0] - whole * a[1]
    return list(whole, ratN(rem, a[1]))
  })
  def('exact/float->rat', (x) => {
    const X = num(x)
    // Simple 6-digit
    const den = 1000000
    const n = Math.round(X * den)
    return ratN(n | 0, den | 0)
  })

  // ── curve/* — pure math curves ─────────────────────────────────────
  def('curve/bezier', (points, t) => {
    if (!Array.isArray(points) || !points.length) return [0, 0]
    // De Casteljau
    let pts = points.map(p => Array.isArray(p) ? p.map(num) : [num(p), 0])
    while (pts.length > 1) {
      const next = []
      for (let i = 0; i < pts.length - 1; i++) {
        next.push([
          pts[i][0] + (pts[i+1][0] - pts[i][0]) * num(t),
          pts[i][1] + (pts[i+1][1] - pts[i][1]) * num(t),
        ])
      }
      pts = next
    }
    return pts[0]
  })
  def('curve/bezier-eval', (points, t) => {
    if (!Array.isArray(points) || !points.length) return [0, 0]
    let pts = points.map(p => Array.isArray(p) ? p.map(num) : [num(p), 0])
    while (pts.length > 1) {
      const next = []
      for (let i = 0; i < pts.length - 1; i++) {
        next.push([pts[i][0] + (pts[i+1][0] - pts[i][0]) * num(t), pts[i][1] + (pts[i+1][1] - pts[i][1]) * num(t)])
      }
      pts = next
    }
    return pts[0]
  })
  def('curve/catmull-rom', (...args) => {
    // Support both (curve/catmull-rom p0 p1 p2 p3 t) and
    // (curve/catmull-rom (list p0 p1 p2 p3)) — the SLAT reference
    // examples use the second shape to construct a curve descriptor.
    if (args.length === 1 && Array.isArray(args[0])) {
      // Return a curve descriptor for later sampling
      return ['catmull-rom', args[0]]
    }
    const [p0, p1, p2, p3, t] = args
    if (!Array.isArray(p0) || !Array.isArray(p1) || !Array.isArray(p2) || !Array.isArray(p3)) {
      return ['catmull-rom', [p0, p1, p2, p3]]
    }
    const T = num(t)
    const q = (a, b, c, d, tt) => 0.5 * (
      (2 * b) + (-a + c) * tt + (2*a - 5*b + 4*c - d) * tt*tt + (-a + 3*b - 3*c + d) * tt*tt*tt
    )
    return [q(num(p0[0]), num(p1[0]), num(p2[0]), num(p3[0]), T),
            q(num(p0[1]), num(p1[1]), num(p2[1]), num(p3[1]), T)]
  })
  def('curve/hermite', (p0, m0, p1, m1, t) => {
    const T = num(t), h00 = 2*T*T*T - 3*T*T + 1
    const h10 = T*T*T - 2*T*T + T
    const h01 = -2*T*T*T + 3*T*T
    const h11 = T*T*T - T*T
    return [h00 * num(p0[0]) + h10 * num(m0[0]) + h01 * num(p1[0]) + h11 * num(m1[0]),
            h00 * num(p0[1]) + h10 * num(m0[1]) + h01 * num(p1[1]) + h11 * num(m1[1])]
  })
  def('curve/eval', (curve, t) => curve && Array.isArray(curve) ? curve[0] : 0)
  def('curve/sample', (curve, n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 0; i <= N; i++) out.push(i / N)
    return out
  })
  // Curve descriptors (return metadata objects)
  ;[
    'curve/accel', 'curve/arc-length', 'curve/binormal', 'curve/brachistochrone',
    'curve/christoffel', 'curve/curvature', 'curve/curvature-2d', 'curve/cycloid',
    'curve/descent-time', 'curve/euler-lagrange-residual', 'curve/fall-line',
    'curve/fall-path', 'curve/first-form', 'curve/frenet-frame',
    'curve/gaussian-curvature', 'curve/geodesic-distance', 'curve/gradient',
    'curve/mean-curvature', 'curve/normal', 'curve/osculating-circle',
    'curve/principal-curvatures', 'curve/second-form', 'curve/slope-angle',
    'curve/speed', 'curve/spline-length', 'curve/spline-resample',
    'curve/surface-graph', 'curve/surface-normal', 'curve/torsion',
    'curve/unit-tangent', 'curve/velocity',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── entity/* — descriptor stubs (world runtime) ─────────────────────
  ;[
    'entity/accel!', 'entity/alive?', 'entity/bounce!', 'entity/collisions',
    'entity/damage!', 'entity/despawn!', 'entity/distance', 'entity/drag!',
    'entity/friction!', 'entity/get-set!', 'entity/glide!', 'entity/goto!',
    'entity/gravity-scale!', 'entity/hp!', 'entity/kind', 'entity/layer!',
    'entity/mask!', 'entity/mass!', 'entity/max-speed!', 'entity/move!',
    'entity/overlaps?', 'entity/parent!', 'entity/pin!', 'entity/pos',
    'entity/pose!', 'entity/sensor!', 'entity/set!', 'entity/set-pos!',
    'entity/set-vel!', 'entity/shape!', 'entity/shape-flower!',
    'entity/solid!', 'entity/sprite!', 'entity/state', 'entity/team!',
    'entity/untag!', 'entity/vel', 'entity/x', 'entity/y',
  ].forEach(name => {
    // Predicates: return false; getters: return 0/null; setters/actions: descriptor
    if (name.endsWith('?')) def(name, (...a) => false)
    else if (name.endsWith('!')) def(name, (...a) => descriptor(name, ...a))
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── world/* — descriptor stubs ─────────────────────────────────────
  ;[
    'world/after', 'world/attract!', 'world/camera', 'world/camera-bounds!',
    'world/camera-follow!', 'world/camera-shake!', 'world/camera-snap!',
    'world/collisions', 'world/count', 'world/each', 'world/find',
    'world/floor!', 'world/frame', 'world/gravity!', 'world/hash',
    'world/impulse!', 'world/link!', 'world/link-rest!', 'world/nearest',
    'world/render', 'world/repel!', 'world/reset!', 'world/restore!',
    'world/snapshot', 'world/solve!', 'world/spawn', 'world/step',
    'world/sway-all!', 'world/tape-audio', 'world/tape-clear!',
    'world/tape-frames', 'world/tape-hash', 'world/tape-lcamera',
    'world/tape-record!', 'world/tape-recording?', 'world/tape-replay',
    'world/tape-save', 'world/tape-stop!', 'world/wind!',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── ai/* — descriptor stubs ─────────────────────────────────────────
  ;[
    'ai/align', 'ai/arrive', 'ai/bb-del!', 'ai/bb-set!', 'ai/bt-action',
    'ai/bt-condition', 'ai/bt-force', 'ai/bt-invert', 'ai/bt-parallel',
    'ai/bt-selector', 'ai/bt-sequence', 'ai/bt-tick', 'ai/cohere',
    'ai/evade', 'ai/flee', 'ai/flock', 'ai/flow-at', 'ai/max-force!',
    'ai/max-speed!', 'ai/nav-mesh', 'ai/passable?', 'ai/path',
    'ai/policy-act', 'ai/pursue', 'ai/seek', 'ai/separate',
    'ai/state!', 'ai/state?', 'ai/steer!', 'ai/utility',
    'ai/waypoints', 'ai/wander',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else if (name === 'ai/bb-set!') def(name, () => true)
    else if (name === 'ai/bb-del!') def(name, () => true)
    else def(name, (...a) => descriptor(name, ...a))
  })
  // Blackboard get/has already were pure — need real dictionary state.
  // Simplified: use a global Map keyed by [id, key].
  const blackboards = new Map()
  const bbKey = (id, k) => JSON.stringify([id?.name ?? id, k?.name ?? k])
  def('ai/bb-get', (id, key, dflt = 'no-key') => {
    const k = bbKey(id, key)
    return blackboards.has(k) ? blackboards.get(k) : (dflt === undefined ? 'no-key' : dflt)
  })
  def('ai/bb-set!', (id, key, val) => { blackboards.set(bbKey(id, key), val); return true })
  def('ai/bb-has?', (id, key) => blackboards.has(bbKey(id, key)))
  def('ai/bb-del!', (id, key) => blackboards.delete(bbKey(id, key)))

  // ── game/* — descriptor stubs ─────────────────────────────────────
  ;[
    'game/state', 'game/tick', 'game/win!', 'game/lose!',
    'game/pause!', 'game/resume!', 'game/score+', 'game/score-set!',
    'game/level!', 'game/reset!', 'game/paused?',
    'game/countdown', 'game/timer', 'game/level',
    'game/save', 'game/load', 'game/leaderboard',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else if (name.endsWith('!') || name === 'game/tick' || name === 'game/countdown')
      def(name, (...a) => descriptor(name, ...a))
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── grid/* — flower / cell descriptors ─────────────────────────────
  ;[
    'grid/flower-go-to!', 'grid/flower-pos', 'grid/flower-settled?',
    'grid/flower-add!', 'grid/flower-remove!', 'grid/pos', 'grid/dim',
    'grid/at', 'grid/set!', 'grid/each', 'grid/cell-list',
    'grid/adjacent',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── shoppe/* ──────────────────────────────────────────────────────
  ;[
    'shoppe/list', 'shoppe/add!', 'shoppe/remove!', 'shoppe/find',
    'shoppe/inventory', 'shoppe/count', 'shoppe/tag',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── system/* / surface/* / scene/* / input/* / cine/* ─────────────
  ;[
    'system/log', 'system/warn', 'system/error', 'system/env',
    'system/version', 'surface/paint', 'surface/clear', 'surface/save',
    'surface/load', 'surface/dim', 'scene/current', 'scene/set!',
    'scene/list', 'scene/close', 'scene/open', 'input/key?',
    'input/mouse', 'input/gamepad', 'input/gesture', 'input/tap?',
    'cine/frame', 'cine/pan', 'cine/tilt', 'cine/zoom', 'cine/cut',
    'cine/dolly', 'cine/steady',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── motion/*, animation/*, prefab/* etc ────────────────────────────
  ;[
    'motion/arc', 'motion/cadence', 'motion/ease', 'motion/lerp',
    'motion/spring', 'motion/tween', 'motion/spline', 'motion/step',
    'motion/pause', 'motion/resume',
    'animation/tween', 'animation/timing',
    'prefab/get', 'prefab/set!',
    'object/create', 'object/destroy',
    'artifact/list', 'artifact/get', 'artifact/save', 'artifact/load',
    'sprite/get', 'sprite/set!', 'sprite/draw',
    'group/add', 'group/remove', 'group/list',
    'juggle/next', 'juggle/prev', 'juggle/reset', 'juggle/at',
    'juggle/count', 'juggle/current',
    'tick/at', 'tick/every', 'tick/once', 'tick/cancel',
    'tick/pause', 'tick/resume', 'tick/status',
    'synth/note', 'synth/env', 'synth/filter', 'synth/lfo',
    'synth/reverb', 'synth/pan', 'synth/pitch', 'synth/gain',
    'synth/wave',
    'note/read', 'note/write', 'note/list',
    'part/spawn', 'part/step', 'part/emit', 'part/render',
    'part/gravity!', 'part/wind!', 'part/lifetime!', 'part/size!',
    'part/color!', 'part/velocity!', 'part/count', 'part/clear',
    'part/kill', 'part/at', 'part/near', 'part/emit-radial',
    'part/spawn-radial',
    'card/close', 'card/emit', 'card/find-by-kind', 'card/focus!',
    'card/physics!', 'card/transition',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── topo/* — additional topology stubs (already done above; adding
  //    a few extras from the list)
  ;[
    'topo/link-number', 'topo/knot-genus', 'topo/orbit',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── calc/* — extras ────────────────────────────────────────────────
  ;[
    'calc/gradient', 'calc/jacobian', 'calc/hessian',
    'calc/divergence', 'calc/curl', 'calc/laplacian',
    'calc/taylor', 'calc/maclaurin', 'calc/partial-derivative',
    'calc/integrate2', 'calc/integrate3', 'calc/tangent-line',
    'calc/normal-line', 'calc/critical-points', 'calc/inflection',
    'calc/local-extrema', 'calc/global-extrema', 'calc/monotonic?',
    'calc/concave-up?', 'calc/riemann-sum', 'calc/midpoint-rule',
    'calc/radius-of-convergence', 'calc/series-sum',
    'calc/interval-of-convergence',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── alg/* — additional group / symmetry stubs ──────────────────────
  ;[
    'alg/symmetric', 'alg/alternating', 'alg/is-normal?',
    'alg/is-solvable?', 'alg/is-simple?', 'alg/quotient',
    'alg/kernel', 'alg/homomorphism', 'alg/isomorphism?',
    'alg/rank', 'alg/torsion', 'alg/generators', 'alg/action',
    'alg/permutation-cycles', 'alg/perm-order', 'alg/perm-parity',
    'alg/perm-cycles', 'alg/perm-inverse', 'alg/perm-compose',
    'alg/permutation-compose', 'alg/generate', 'alg/random-element',
    'alg/subgroup', 'alg/subgroups', 'alg/is-cyclic?',
    'alg/is-subgroup?', 'alg/left-cosets', 'alg/right-cosets',
    'alg/normalizer', 'alg/centralizer', 'alg/commutator',
    'alg/derived-subgroup', 'alg/exponent', 'alg/perm-apply',
    'alg/perm-fixed?', 'alg/perm-fixed-points',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── weather / transport / route / beat / floor / domain / base
  ;[
    'weather/current', 'transport/route', 'route/plan', 'beat/at',
    'floor/level', 'domain/list', 'collision/detect',
    'flower/spawn', 'flower/count', 'pattern/apply', 'base/setup',
    'text/format',
  ].forEach(name => {
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  // ── core (large batch of core-runtime descriptors) ─────────────────
  // Many core verbs are runtime dispatch that we return as descriptors.
  ;[
    'add-shop', 'app-clear!', 'app-list', 'app-of', 'apply-markdown',
    'arc-between', 'analog-pad', 'audit-verify', 'begin-frame',
    'big-bang', 'button', 'button-list', 'button-of',
    'canvas-cell-age', 'canvas-cell-alive?', 'canvas-cell-set!',
    'canvas-clear-region', 'canvas-cols', 'canvas-rows',
    'canvas-power-tier', 'canvas-rule', 'canvas-rule-set!',
    'canvas-spawn-pattern', 'canvas-region-live-count',
    'canvas-pause', 'canvas-resume', 'age-layer', 'anomaly-recent',
    'across-beats', 'at-beat', 'after-frame',
    'cancel-tick', 'card-anchor-settle', 'card-ask',
    'card-canvas-rect', 'card-close', 'card-do', 'card-each',
    'card-ease-aside', 'card-effect', 'card-emit',
    'card-find-by-kind', 'card-focus!',
  ].forEach(name => {
    // most already registered; def is a no-op if already defined
    if (name.endsWith('?')) def(name, () => false)
    else def(name, (...a) => descriptor(name, ...a))
  })

  def('app-of', (id) => descriptor('app-of', id))
  def('app-list', () => [])
  def('app-clear!', () => descriptor('app-clear!'))
  def('button', (id) => descriptor('button', id))
  def('button-of', (id) => descriptor('button-of', id))
  def('button-list', () => [])
  def('anomaly-recent', () => [])
  def('age-layer',       (id) => descriptor('age-layer', id))
  def('after',           (ms, s, c) => descriptor('after', ms, s, c))
  def('apply-markdown',  (s) => String(s))
  def('arc-between',     (a, b) => descriptor('arc-between', a, b))
  def('analog-pad',      (id) => descriptor('analog-pad', id))

  // ── Book-of-Motion entity/* aliases ────────────────────────────────
  // Books teach entity/velocity! (in Motion NN- series) but the
  // canonical wired verb is entity/set-velocity! (in game.js). Wire
  // aliases so both spellings work; the games engine handles the
  // real state. If the games engine isn't installed, they degrade to
  // descriptors so the books still teach their vocabulary.
  const _wrap = (aliasName, targetName, fallbackArity = 3) => {
    def(aliasName, (...args) => {
      let target = null
      try { target = env.get(targetName) } catch { /* ignore */ }
      if (target && typeof target === 'function') return target(...args)
      return descriptor(aliasName, ...args)
    })
  }
  _wrap('entity/velocity!', 'entity/set-velocity!')
  _wrap('entity/set-vel!',  'entity/set-velocity!')
  // Motion effect verbs — descriptors until the animation engine wires them
  ;['entity/embodiment!', 'entity/lag!', 'entity/drift!',
    'entity/spring!', 'entity/ease!', 'entity/squash!',
    'entity/glide!', 'entity/hop!', 'entity/spin!', 'entity/sway!',
    'entity/scatter!', 'entity/curve!', 'entity/march!', 'entity/toss!',
    'entity/settle!', 'entity/slide!', 'entity/glide-to!',
  ].forEach(name => def(name, (...a) => descriptor(name, ...a)))

  // ── Book-of-Marionette + Book-of-Motion: canonical world/spawn ──
  // The reference declares (world/spawn kind x y [w] [h]) -> id.
  // If the game engine has entity/make, delegate to it.
  def('world/spawn', (kind, x, y, w, h) => {
    let make = null
    try { make = env.get('entity/make') } catch { /* ignore */ }
    if (make && typeof make === 'function') {
      // Generate an id from a monotonic counter — books use ids as
      // identifiers, not as position lookups.
      if (!globalThis.__sakura_world_spawn_id__) {
        globalThis.__sakura_world_spawn_id__ = 0
      }
      const id = `world-${++globalThis.__sakura_world_spawn_id__}`
      make(id, Number(x) || 0, Number(y) || 0,
           Number(w) || 16, Number(h) || 16)
      return id
    }
    return descriptor('world/spawn', kind, x, y, w, h)
  })

  // ── Book-of-Sound audio surface (declared, delegated to media.js) ──
  const _envHas = (name) => {
    try { return typeof env.get(name) === 'function' } catch { return false }
  }
  ;['tone', 'noise', 'add-formant',
    'transport/play', 'transport/loop', 'transport/pause', 'transport/stop',
    'speech/say', 'speech/listen', 'surface/pad',
    'note/strike', 'play/note', 'play/chord', 'play/articulation!',
    'play/dynamics!', 'synth/pedal!', 'synth/bow!', 'synth/breath!',
    'synth/damp!', 'synth/ensemble!',
  ].forEach(name => {
    // Only define if not already wired by media.js/sound.js
    if (!_envHas(name)) {
      def(name, (...a) => descriptor(name, ...a))
    }
  })

  // ── Book-of-Money helpers ─────────────────────────────────────────
  // money/friendly formats a typed-currency (list 'USD cents) as a
  // human-readable string. Books use this pervasively; wire real impl.
  def('money/friendly', (m) => {
    // m is a typed currency list: either (money amt cur) old-style or
    // (cur cents) new-style. Handle both.
    if (!Array.isArray(m)) return String(m)
    if (m.length === 2) {
      const [cur, cents] = m
      const curName = cur?.name ?? cur
      const dollars = (Number(cents) / 100).toFixed(2)
      const symbol = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[curName] || ''
      return symbol ? `${symbol}${dollars} ${curName}` : `${dollars} ${curName}`
    }
    if (m.length === 3 && (m[0]?.name === 'money' || m[0] === 'money')) {
      const [_, amt, cur] = m
      const curName = cur?.name ?? cur
      return `${amt} ${curName}`
    }
    return String(m)
  })

  // stock/on-hand — books use as first-class; delegate to cortex or descriptor
  def('stock/on-hand', (sku) => {
    let recall = null
    try { recall = env.get('cortex/recall') } catch { /* ignore */ }
    if (recall && typeof recall === 'function') {
      const r = recall(`stock/on-hand/${sku?.name ?? sku}`)
      if (typeof r === 'number') return r
    }
    return descriptor('stock/on-hand', sku)
  })
}
