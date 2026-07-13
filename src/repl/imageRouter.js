// imageRouter.js — detect terminal image capabilities + render a graphic
// as the richest inline form the terminal understands.
//
// Priority (highest to lowest):
//   1. iTerm2 inline image protocol  ($TERM_PROGRAM = 'iTerm.app')
//   2. iTerm2 protocol via WezTerm   ($TERM_PROGRAM = 'WezTerm')
//   3. kitty graphics protocol       ($TERM = 'xterm-kitty' or $KITTY_WINDOW_ID)
//   4. Sixel                         ($COLORTERM includes 'sixel' or probe)
//   5. Braille                       (existing fallback)
//
// The router exposes:
//   detectCapabilities(env = process.env) → { iterm, wezterm, kitty, sixel }
//   pickProtocol(caps) → 'iterm2' | 'kitty' | 'sixel' | 'braille'
//   renderInline(graphic, opts) → escape-sequence string OR null
//
// If the terminal can't do inline images (or the graphic isn't a shape
// we know how to rasterize), we return null and the caller falls back to
// Braille (which is what the REPL does today).

import { encodePng } from './pngEncoder.js'
import { renderGraphic } from './braille.js'
import { Sym } from '../reader.js'

const kindName = (v) => (typeof v === 'string' ? v : v instanceof Sym ? v.name : null)

/**
 * Detect what image protocols the current terminal supports.
 * Pure inspection of env vars — no probing (that would need TTY reads).
 */
export function detectCapabilities(env = process.env) {
  const termProgram = env.TERM_PROGRAM || ''
  const term = env.TERM || ''
  const colorterm = env.COLORTERM || ''
  const isKittyEnv = !!env.KITTY_WINDOW_ID
  return {
    iterm: termProgram === 'iTerm.app',
    wezterm: termProgram === 'WezTerm',
    kitty: term === 'xterm-kitty' || isKittyEnv,
    // We can't probe for sixel without a TTY read, so we rely on a hint.
    // COLORTERM sometimes carries it; some emulators set TERM to a sixel-
    // aware variant. This is conservative — Braille is a safe fallback.
    sixel: /sixel/i.test(colorterm) || /sixel/i.test(term),
  }
}

export function pickProtocol(caps) {
  if (!caps) return 'braille'
  if (caps.iterm) return 'iterm2'
  if (caps.wezterm) return 'iterm2'   // WezTerm implements iTerm2's protocol
  if (caps.kitty) return 'kitty'
  if (caps.sixel) return 'sixel'
  return 'braille'
}

// ── rasterization ────────────────────────────────────────────────────

/**
 * Rasterize a graphic value into a Uint8Array RGBA buffer.
 *
 * Supported shapes (same set as braille.js):
 *   ['circle',cx,cy,r] · ['disc',cx,cy,r] · ['line',x0,y0,x1,y1]
 *   ['rect',x,y,w,h]  · { kind: 'graphic', shapes: […] }
 *   { kind: 'plot', data: [numbers], w?, h? }
 *
 * Returns { pixels, width, height } or null if we don't understand v.
 */
export function rasterize(v, opts = {}) {
  const width = opts.width || 320
  const height = opts.height || 240
  const bg = opts.bg || [255, 255, 255, 255]  // white
  const fgc = opts.fg || [232, 165, 190, 255] // sakura petal-ish

  const buf = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4]     = bg[0]
    buf[i * 4 + 1] = bg[1]
    buf[i * 4 + 2] = bg[2]
    buf[i * 4 + 3] = bg[3]
  }

  const setPixel = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = (y * width + x) * 4
    buf[i] = fgc[0]; buf[i+1] = fgc[1]; buf[i+2] = fgc[2]; buf[i+3] = fgc[3]
  }
  const bresenham = (x0, y0, x1, y1) => {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    let x = x0, y = y0
    while (true) {
      setPixel(x, y)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
    }
  }
  const drawCircle = (cx, cy, r) => {
    let x = r, y = 0, err = 0
    while (x >= y) {
      setPixel(cx + x, cy + y); setPixel(cx + y, cy + x)
      setPixel(cx - y, cy + x); setPixel(cx - x, cy + y)
      setPixel(cx - x, cy - y); setPixel(cx - y, cy - x)
      setPixel(cx + y, cy - x); setPixel(cx + x, cy - y)
      y++
      if (err <= 0) err += 2 * y + 1
      if (err > 0) { x--; err -= 2 * x + 1 }
    }
  }
  const drawDisc = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) setPixel(cx + dx, cy + dy)
      }
    }
  }
  const drawRect = (x, y, w, h) => {
    bresenham(x, y, x + w, y)
    bresenham(x + w, y, x + w, y + h)
    bresenham(x + w, y + h, x, y + h)
    bresenham(x, y + h, x, y)
  }

  // Route the graphic.
  const drawn = drawGraphic(v, { width, height, drawCircle, drawDisc, drawRect, bresenham, setPixel })
  if (!drawn) return null
  return { pixels: buf, width, height }
}

function drawGraphic(v, api) {
  if (!v) return false
  const { width, height, drawCircle, drawDisc, drawRect, bresenham, setPixel } = api

  const drawTagged = (kind, args) => {
    if (kind === 'circle' || kind === 'disc') {
      const [cx, cy, r] = args
      const px = Math.round(cx), py = Math.round(cy)
      const rr = Math.max(1, Math.round(r))
      if (kind === 'disc') drawDisc(px, py, rr); else drawCircle(px, py, rr)
      return true
    }
    if (kind === 'line') {
      const [x0, y0, x1, y1] = args
      bresenham(
        Math.round(x0), Math.round(y0),
        Math.round(x1), Math.round(y1),
      )
      return true
    }
    if (kind === 'rect') {
      const [x, y, w, h] = args
      drawRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
      return true
    }
    return false
  }

  if (Array.isArray(v) && v.length >= 3) {
    const kind = kindName(v[0])
    if (kind) return drawTagged(kind, v.slice(1))
  }
  if (v && typeof v === 'object' && v.kind === 'graphic' && Array.isArray(v.shapes)) {
    let any = false
    for (const s of v.shapes) {
      if (Array.isArray(s) && s.length > 0) {
        const kind = kindName(s[0])
        if (kind && drawTagged(kind, s.slice(1))) any = true
      }
    }
    return any
  }
  if (v && typeof v === 'object' && v.kind === 'plot' && Array.isArray(v.data)) {
    const data = v.data
    if (data.length === 0) return false
    const minV = Math.min(...data), maxV = Math.max(...data)
    const span = Math.max(1e-9, maxV - minV)
    // Axes.
    const marginX = 30, marginY = 20
    const w = width - marginX - 10, h = height - marginY - 10
    bresenham(marginX, marginY, marginX, marginY + h)
    bresenham(marginX, marginY + h, marginX + w, marginY + h)
    // Line.
    let prevX = null, prevY = null
    for (let i = 0; i < data.length; i++) {
      const x = marginX + Math.round((i / Math.max(1, data.length - 1)) * w)
      const y = marginY + Math.round((1 - (data[i] - minV) / span) * h)
      if (prevX !== null) bresenham(prevX, prevY, x, y)
      // Draw a small marker for scatter feel.
      setPixel(x, y)
      setPixel(x + 1, y); setPixel(x - 1, y)
      setPixel(x, y + 1); setPixel(x, y - 1)
      prevX = x; prevY = y
    }
    return true
  }
  return false
}

// ── protocol renderers ────────────────────────────────────────────────

/**
 * iTerm2 inline image protocol:
 *   ESC ] 1337 ; File = inline=1 ; width=Npx ; height=Npx : <base64-png> BEL
 *
 * WezTerm accepts the same protocol.
 */
export function renderITerm(pngBuf, opts = {}) {
  const b64 = pngBuf.toString('base64')
  const w = opts.width ? `;width=${opts.width}px` : ''
  const h = opts.height ? `;height=${opts.height}px` : ''
  return `\x1b]1337;File=inline=1${w}${h}:${b64}\x07`
}

/**
 * kitty graphics protocol:
 *   ESC _G [key=val ...] ; <base64-chunk> ESC \
 *
 * For a PNG we send f=100 (PNG format), a=T (transmit + display),
 * chunked in 4096-char base64 chunks with m=1 (more coming) and m=0
 * on the last one.
 */
export function renderKitty(pngBuf) {
  const b64 = pngBuf.toString('base64')
  const CHUNK = 4096
  const parts = []
  let first = true
  for (let i = 0; i < b64.length; i += CHUNK) {
    const chunk = b64.slice(i, i + CHUNK)
    const more = (i + CHUNK) < b64.length ? 1 : 0
    const key = first
      ? `f=100,a=T,m=${more}`
      : `m=${more}`
    parts.push(`\x1b_G${key};${chunk}\x1b\\`)
    first = false
  }
  return parts.join('')
}

/**
 * Sixel — we ship a very small encoder that renders a 1-bit foreground
 * on a solid background (matches the rasterization above). Sixel groups
 * six rows at a time and encodes them as `?..~` characters plus color
 * setup. Sufficient for our simple shape output; a bigger palette isn't
 * needed given the router's role.
 */
export function renderSixel({ pixels, width, height }) {
  const start = '\x1bPq'
  const end = '\x1b\\'
  // Two-color palette: 0 = background (white), 1 = foreground (petal).
  const setup = '#0;2;100;100;100#1;2;90;65;75'
  const rows = []
  for (let band = 0; band < height; band += 6) {
    const bandHeight = Math.min(6, height - band)
    // Emit color 1 selector, then column data.
    let s = '#1'
    for (let x = 0; x < width; x++) {
      let bits = 0
      for (let dy = 0; dy < bandHeight; dy++) {
        const y = band + dy
        const idx = (y * width + x) * 4
        // Foreground if any channel darker than midpoint.
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]
        if ((r + g + b) < 600) bits |= (1 << dy)
      }
      s += String.fromCharCode(0x3f + bits)
    }
    s += (band + 6 < height) ? '-' : '$'
    rows.push(s)
  }
  return start + setup + rows.join('') + end
}

/**
 * renderInline(graphic, opts) — main entry point.
 *
 * opts:
 *   env    — override for capability detection (tests inject)
 *   caps   — pre-detected caps object (bypass env sniff)
 *   width  — pixel width for rasterization (default 320)
 *   height — pixel height for rasterization (default 240)
 *   forceProtocol — 'iterm2' | 'kitty' | 'sixel' | 'braille' | 'auto'
 *
 * Returns an escape-sequence string ready to write to stdout, or null if
 * no inline protocol is available or the graphic can't be rasterized.
 * Callers fall back to Braille on null.
 */
export function renderInline(graphic, opts = {}) {
  const caps = opts.caps || detectCapabilities(opts.env || process.env)
  const protocol = opts.forceProtocol && opts.forceProtocol !== 'auto'
    ? opts.forceProtocol
    : pickProtocol(caps)
  if (protocol === 'braille') return null
  const raster = rasterize(graphic, { width: opts.width, height: opts.height })
  if (!raster) return null
  if (protocol === 'iterm2') {
    const png = encodePng(raster.pixels, raster.width, raster.height)
    return renderITerm(Buffer.from(png), { width: raster.width, height: raster.height })
  }
  if (protocol === 'kitty') {
    const png = encodePng(raster.pixels, raster.width, raster.height)
    return renderKitty(Buffer.from(png))
  }
  if (protocol === 'sixel') {
    return renderSixel(raster)
  }
  return null
}
