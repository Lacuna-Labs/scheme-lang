// iterm2.js — iTerm2 inline-image adapter.
//
// iTerm2 (and WezTerm, which implements the same protocol) accept a
// base64-encoded PNG inside a special OSC 1337 escape:
//
//   ESC ] 1337 ; File = ... : <base64-png> BEL
//
// This module owns the encoding side of that pipeline. The image itself
// is produced by rasterizing the framebuffer to RGBA and wrapping it
// in a minimal PNG (see pngEncoder.js).

import { encodePng } from './pngEncoder.js'
import { Framebuffer } from '../framebuffer.js'

/**
 * Render the given framebuffer as an iTerm2-friendly escape sequence.
 *
 * opts:
 *   scale — integer upscale (default 4). Small buffers look tiny in a
 *           real terminal at 1×; 4× is a good default for 80×80 art.
 *   preserveAspectRatio — passed to iTerm2.
 *   width, height — cell dimensions ("Nch" / "Npx" / "N%"). Optional.
 */
export function renderFramebuffer(fb, opts = {}) {
  if (!(fb instanceof Framebuffer)) throw new Error('iterm2/renderFramebuffer: expected Framebuffer')
  const scale = Math.max(1, opts.scale || 4)
  const rgba = rasterize(fb, scale)
  const png = encodePng(rgba, fb.w * scale, fb.h * scale)
  const b64 = bufferToBase64(png)
  const params = []
  params.push('inline=1')
  if (opts.preserveAspectRatio !== false) params.push('preserveAspectRatio=1')
  if (opts.width)  params.push(`width=${opts.width}`)
  if (opts.height) params.push(`height=${opts.height}`)
  // OSC 1337 with BEL terminator, per iTerm2 docs.
  return `\x1b]1337;File=${params.join(';')}:${b64}\x07`
}

/** Rasterize framebuffer palette-indexed pixels → RGBA Uint8Array. */
function rasterize(fb, scale) {
  const out = new Uint8Array(fb.w * scale * fb.h * scale * 4)
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      const p = fb.pixels[y * fb.w + x]
      const [r, g, b, a] = fb.palette[p] || [0, 0, 0, 255]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * fb.w * scale + (x * scale + dx)) * 4
          out[i]     = r
          out[i + 1] = g
          out[i + 2] = b
          out[i + 3] = a
        }
      }
    }
  }
  return out
}

// Portable base64 — works in Node (Buffer) and browsers (btoa).
function bufferToBase64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64')
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}
