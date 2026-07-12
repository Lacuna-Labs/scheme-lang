// braille.js — 2×4 subpixel Braille graphics rendering for the terminal.
//
// Unicode Braille block (U+2800..U+28FF) encodes 8 dots as bits of an 8-bit
// value. Each glyph is 2 dots wide × 4 dots tall — so one character covers
// a 2×4 pixel grid at the terminal's char granularity. Rendering a graphic
// = rasterizing to a boolean grid, then chunking 2×4 tiles into Braille.
//
// Dot bit layout (per U+2800 spec):
//   1 4          bit 0 = top-left,     bit 3 = top-right
//   2 5          bit 1 = row-1-left,   bit 4 = row-1-right
//   3 6          bit 2 = row-2-left,   bit 5 = row-2-right
//   7 8          bit 6 = bottom-left,  bit 7 = bottom-right
//
// (The "1/2/3/4/5/6/7/8" numbering above is the historical Braille dot
// numbering; the code below uses bit indices 0..7 which map to it via
// the DOT_BITS table.)
//
// Not a full plot library. It's a "render this shape at approximately the
// right size + color for the terminal" pass. Perfect for `(circle ...)`,
// `(line ...)`, small plots. For anything richer we defer to sixel or the
// inline-image protocol (see graphicsRouter.js when written).

import { fg, PALETTE } from './nordic.js'
import { Sym } from '../reader.js'

// Kind can be either a JS string OR a Scheme Sym (the reader creates
// Sym instances for quoted identifiers). Normalize.
function kindName(v) {
  if (typeof v === 'string') return v
  if (v instanceof Sym) return v.name
  return null
}

// Bit position for the (col-in-tile, row-in-tile) pair.
//   col ∈ {0,1}, row ∈ {0,1,2,3}
//   → col 0 rows 0..2 use bits 0..2; row 3 uses bit 6
//   → col 1 rows 0..2 use bits 3..5; row 3 uses bit 7
export function dotBit(col, row) {
  if (row < 3) return col * 3 + row
  return col + 6
}

/**
 * Grid — a boolean 2D bitmap the render pass consumes.
 *
 * width + height are in DOT units (not chars). setDot(x, y) sets a dot.
 * toBraille() returns an array of lines (strings of Braille chars).
 */
export class Grid {
  constructor(width, height) {
    this.w = width
    this.h = height
    // Row-major boolean array. width×height booleans.
    this.dots = new Uint8Array(width * height)
    // Optional per-tile color index (character granularity, so w/2 × h/4).
    this.tileColor = null
  }

  setDot(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.dots[y * this.w + x] = 1
  }

  setTileColor(cx, cy, colorCode) {
    if (!this.tileColor) {
      this.tileColor = new Int16Array(Math.ceil(this.w / 2) * Math.ceil(this.h / 4))
      this.tileColor.fill(-1)
    }
    const tw = Math.ceil(this.w / 2)
    if (cx < 0 || cy < 0 || cx >= tw) return
    this.tileColor[cy * tw + cx] = colorCode
  }

  /** Render to lines of Braille characters, optionally colored. */
  toBraille({ color = null } = {}) {
    const tw = Math.ceil(this.w / 2)
    const th = Math.ceil(this.h / 4)
    const lines = []
    for (let ty = 0; ty < th; ty++) {
      const row = []
      for (let tx = 0; tx < tw; tx++) {
        let bits = 0
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = tx * 2 + dx
            const py = ty * 4 + dy
            if (px < this.w && py < this.h && this.dots[py * this.w + px]) {
              bits |= (1 << dotBit(dx, dy))
            }
          }
        }
        const ch = bits === 0 ? ' ' : String.fromCharCode(0x2800 + bits)
        const tileC = this.tileColor ? this.tileColor[ty * tw + tx] : -1
        if (tileC >= 0) row.push(fg(tileC, ch))
        else if (color != null && bits !== 0) row.push(fg(color, ch))
        else row.push(ch)
      }
      lines.push(row.join(''))
    }
    return lines
  }
}

// ── shape rasterizers ────────────────────────────────────────────────

/** Bresenham line rasterization. */
export function line(grid, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0, y = y0
  while (true) {
    grid.setDot(x, y)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}

/** Midpoint circle outline. */
export function circle(grid, cx, cy, r) {
  let x = r
  let y = 0
  let err = 0
  while (x >= y) {
    grid.setDot(cx + x, cy + y)
    grid.setDot(cx + y, cy + x)
    grid.setDot(cx - y, cy + x)
    grid.setDot(cx - x, cy + y)
    grid.setDot(cx - x, cy - y)
    grid.setDot(cx - y, cy - x)
    grid.setDot(cx + y, cy - x)
    grid.setDot(cx + x, cy - y)
    y++
    if (err <= 0) err += 2 * y + 1
    if (err > 0) { x--; err -= 2 * x + 1 }
  }
}

/** Filled disc. */
export function disc(grid, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) grid.setDot(cx + x, cy + y)
    }
  }
}

/** Rectangle outline. */
export function rect(grid, x, y, w, h) {
  line(grid, x, y, x + w - 1, y)
  line(grid, x + w - 1, y, x + w - 1, y + h - 1)
  line(grid, x + w - 1, y + h - 1, x, y + h - 1)
  line(grid, x, y + h - 1, x, y)
}

// ── high-level renders ───────────────────────────────────────────────

/**
 * renderGraphic(spec) → array of lines OR null if `spec` doesn't look
 * like a graphic.
 *
 * `spec` is a Scheme value returned from evaluate(). Right now we accept:
 *   • ['circle', cx, cy, r]                          → outline circle
 *   • ['disc',   cx, cy, r]                          → filled disc
 *   • ['line',   x0, y0, x1, y1]                     → line
 *   • ['rect',   x, y, w, h]                         → rectangle outline
 *   • { kind: 'graphic', shapes: [...] }             → composite
 *   • { kind: 'plot', data: [numbers], w?, h? }      → sparkline plot
 *
 * We accept Scheme-style tagged lists AND JS-object shapes so the runtime
 * can shape either as convenient. Color hints come from a `:fill` /
 * `:stroke` metadata property when present; default is sakura petal.
 */
export function renderGraphic(value, opts = {}) {
  if (value == null) return null

  // Tagged-list form: ['circle', ...] etc. Head may be a JS string or a
  // reader Sym (which is the shape returned by quoting an identifier).
  if (Array.isArray(value) && value.length >= 3) {
    const kind = kindName(value[0])
    const KNOWN = new Set(['circle', 'disc', 'line', 'rect'])
    if (kind && KNOWN.has(kind)) {
      const args = value.slice(1)
      return renderTagged(kind, args, opts)
    }
  }

  // JS object form.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.kind === 'graphic') {
      return renderComposite(value.shapes || [], opts)
    }
    if (value.kind === 'plot') {
      return renderPlot(value.data || [], value.w || 40, value.h || 10, opts)
    }
  }

  return null
}

function renderTagged(kind, args, opts) {
  const color = opts.color || PALETTE.petal
  // Scale factor — args are in "world" units; we render to a grid roughly
  // 40 chars wide × 20 tall by default (80 dots × 80 dots).
  const maxW = opts.width || 80
  const maxH = opts.height || 80

  if (kind === 'circle' || kind === 'disc') {
    const [cx, cy, r] = args
    const g = new Grid(maxW, maxH)
    // Center the shape in the grid; scale so 2*r ≈ 0.9 * maxW.
    const scale = (0.9 * Math.min(maxW, maxH)) / (2 * r)
    const rr = Math.max(1, Math.round(r * scale))
    const px = Math.round(maxW / 2)
    const py = Math.round(maxH / 2)
    if (kind === 'disc') disc(g, px, py, rr)
    else circle(g, px, py, rr)
    return g.toBraille({ color })
  }

  if (kind === 'line') {
    const [x0, y0, x1, y1] = args
    const g = new Grid(maxW, maxH)
    // Rescale span to fill grid.
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const span = Math.max(dx, dy, 1)
    const sx = (0.9 * maxW) / span
    const sy = (0.9 * maxH) / span
    const ox = maxW * 0.05
    const oy = maxH * 0.05
    line(g,
      Math.round(ox + x0 * sx), Math.round(oy + y0 * sy),
      Math.round(ox + x1 * sx), Math.round(oy + y1 * sy),
    )
    return g.toBraille({ color })
  }

  if (kind === 'rect') {
    const [x, y, w, h] = args
    const g = new Grid(maxW, maxH)
    const scale = Math.min((0.9 * maxW) / w, (0.9 * maxH) / h)
    const ox = Math.round((maxW - w * scale) / 2)
    const oy = Math.round((maxH - h * scale) / 2)
    rect(g, ox, oy, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)))
    return g.toBraille({ color })
  }

  return null
}

function renderComposite(shapes, opts) {
  const maxW = opts.width || 80
  const maxH = opts.height || 80
  const g = new Grid(maxW, maxH)
  for (const s of shapes) {
    if (!Array.isArray(s) || typeof s[0] !== 'string') continue
    const [kind, ...args] = s
    if (kind === 'circle') circle(g, args[0], args[1], args[2])
    else if (kind === 'disc') disc(g, args[0], args[1], args[2])
    else if (kind === 'line') line(g, args[0], args[1], args[2], args[3])
    else if (kind === 'rect') rect(g, args[0], args[1], args[2], args[3])
  }
  return g.toBraille({ color: opts.color || PALETTE.petal })
}

function renderPlot(data, w, h, opts) {
  if (!Array.isArray(data) || data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1e-9, max - min)
  const dotsW = w * 2
  const dotsH = h * 4
  const g = new Grid(dotsW, dotsH)
  for (let i = 0; i < data.length; i++) {
    const x = Math.round((i / Math.max(1, data.length - 1)) * (dotsW - 1))
    const y = Math.round((1 - (data[i] - min) / span) * (dotsH - 1))
    g.setDot(x, y)
    // Connect to previous point with a line for a legible curve.
    if (i > 0) {
      const px = Math.round(((i - 1) / Math.max(1, data.length - 1)) * (dotsW - 1))
      const py = Math.round((1 - (data[i - 1] - min) / span) * (dotsH - 1))
      line(g, px, py, x, y)
    }
  }
  return g.toBraille({ color: opts.color || PALETTE.petal })
}
