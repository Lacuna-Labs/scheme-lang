// kitty.js — kitty graphics protocol adapter.
//
// kitty's graphics protocol (`APC G ...ST`) is fundamentally similar to
// iTerm2's but with a different envelope. We produce the framebuffer
// as an RGB stream and split it across as many chunks as needed.
//
// Reference: https://sw.kovidgoyal.net/kitty/graphics-protocol/

import { Framebuffer } from '../framebuffer.js'

/**
 * Render the framebuffer as a kitty-protocol escape sequence.
 *
 * opts:
 *   scale — integer upscale (default 4).
 */
export function renderFramebuffer(fb, opts = {}) {
  if (!(fb instanceof Framebuffer)) throw new Error('kitty/renderFramebuffer: expected Framebuffer')
  const scale = Math.max(1, opts.scale || 4)
  const w = fb.w * scale
  const h = fb.h * scale
  const rgb = rasterizeRgb(fb, scale)
  const b64 = bufferToBase64(rgb)

  // Split into 4096-char chunks per kitty's requirement.
  const CHUNK = 4096
  const chunks = []
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK))

  // Control keys: a=T (transmit + display), f=24 (RGB, no alpha),
  // s = width, v = height.
  let out = ''
  for (let i = 0; i < chunks.length; i++) {
    const isFirst = i === 0
    const isLast  = i === chunks.length - 1
    const parts = []
    if (isFirst) {
      parts.push('a=T', 'f=24', `s=${w}`, `v=${h}`)
    }
    parts.push(`m=${isLast ? 0 : 1}`)
    out += `\x1b_G${parts.join(',')};${chunks[i]}\x1b\\`
  }
  return out
}

/** Rasterize palette-indexed pixels → RGB stream (no alpha). */
function rasterizeRgb(fb, scale) {
  const out = new Uint8Array(fb.w * scale * fb.h * scale * 3)
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      const p = fb.pixels[y * fb.w + x]
      const [r, g, b] = fb.palette[p] || [0, 0, 0, 255]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * fb.w * scale + (x * scale + dx)) * 3
          out[i]     = r
          out[i + 1] = g
          out[i + 2] = b
        }
      }
    }
  }
  return out
}

function bufferToBase64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64')
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}
