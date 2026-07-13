// dots.js — the DOTS terminal adapter.
//
// Alfred's "dots" directive (2026-07-13): the terminal image adapter
// is called `dots` (not "braille"). Same Unicode Braille block under
// the hood (U+2800..U+28FF, 2×4 dots per character), same math. Just a
// clearer name — "dots" is what people see and say.
//
// This module is the NEW canonical name. `braille.js` is retained as
// a legacy alias so existing REPL code + tests keep working while the
// codebase migrates.
//
// This adapter reads a Framebuffer and produces a colored ANSI string
// suitable for direct stdout write.

import { Framebuffer } from '../framebuffer.js'
import { fg } from './palette.js'

// Bit position for the (col-in-tile, row-in-tile) pair. See the Braille
// block spec (U+2800..U+28FF) — bits 0..2 are top-to-mid on the left
// column, bits 3..5 are the same on the right, bits 6/7 are the bottom.
export function dotBit(col, row) {
  if (row < 3) return col * 3 + row
  return col + 6
}

/**
 * Render the framebuffer as an array of colored dot-lines.
 * Each Braille char covers a 2×4 patch of the framebuffer.
 *
 * A patch is "on" wherever any pixel in it has a non-zero palette index.
 * Color is chosen from the dominant non-zero index in the patch — with
 * ties broken by the top-left pixel — so 16-color art renders with its
 * intended hues.
 */
export function renderFramebuffer(fb, opts = {}) {
  if (!(fb instanceof Framebuffer)) throw new Error('renderFramebuffer: expected Framebuffer')
  const tw = Math.ceil(fb.w / 2)
  const th = Math.ceil(fb.h / 4)
  const lines = new Array(th)
  const useColor = opts.color !== false
  for (let ty = 0; ty < th; ty++) {
    let row = ''
    for (let tx = 0; tx < tw; tx++) {
      let bits = 0
      const seen = new Uint16Array(fb.palette.length)
      let firstColor = -1
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = tx * 2 + dx
          const py = ty * 4 + dy
          if (px < fb.w && py < fb.h) {
            const c = fb.pixels[py * fb.w + px]
            if (c !== 0) {
              bits |= (1 << dotBit(dx, dy))
              if (firstColor < 0) firstColor = c
              seen[c]++
            }
          }
        }
      }
      if (bits === 0) { row += ' '; continue }
      const ch = String.fromCharCode(0x2800 + bits)
      if (!useColor) { row += ch; continue }
      // Pick the plurality color, tiebreak → first-seen.
      let best = firstColor, bestN = -1
      for (let i = 1; i < seen.length; i++) if (seen[i] > bestN) { bestN = seen[i]; best = i }
      row += fg(paletteToPaletteColor(fb, best), ch)
    }
    lines[ty] = row
  }
  return lines
}

/**
 * Convert framebuffer palette index → the palette code the `fg()` helper
 * uses. The palette.js `PALETTE` table exports named indices; we map
 * the framebuffer's 16-color palette onto the closest named entry so
 * colored rendering "just works" in a stock terminal.
 *
 * For MVP we forward the index directly — palette.js uses the same
 * 16-color ANSI range internally.
 */
function paletteToPaletteColor(fb, idx) {
  // Terminal `fg()` accepts a small palette. Map framebuffer index 0..15
  // to ANSI extended color codes 30..37 (dark) + 90..97 (bright).
  // We forward as an integer ANSI color code. See palette.js for the
  // `fg(code, str)` shape.
  const rgba = fb.palette[idx] || [255, 255, 255, 255]
  const ansi = rgbToAnsi(rgba[0], rgba[1], rgba[2])
  return ansi
}

// Nearest-of-256 lookup — the standard xterm 256-color mapping.
function rgbToAnsi(r, g, b) {
  // xterm-256 has a 6×6×6 color cube starting at 16.
  const q = (v) => Math.min(5, Math.max(0, Math.round(v / 51)))
  return 16 + 36 * q(r) + 6 * q(g) + q(b)
}
