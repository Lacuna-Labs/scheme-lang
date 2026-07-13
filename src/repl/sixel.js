// sixel.js — Sixel graphics adapter.
//
// Sixel is a DEC-era graphics protocol still supported by xterm,
// mlterm, WezTerm, foot, and (with a flag) iTerm2. Each "sixel" is a
// column of 6 pixels encoded as a byte with bit 0 = top pixel.
//
// This implementation is small and correct for palette-indexed sources
// like our framebuffer. It emits color definitions up-front, then
// walks the buffer six rows at a time.
//
// Reference: https://www.vt100.net/docs/vt3xx-gp/chapter14.html

import { Framebuffer } from '../framebuffer.js'

const SIXEL_START = '\x1bPq'
const SIXEL_END   = '\x1b\\'

export function renderFramebuffer(fb, opts = {}) {
  if (!(fb instanceof Framebuffer)) throw new Error('sixel/renderFramebuffer: expected Framebuffer')
  const scale = Math.max(1, opts.scale || 2)
  const w = fb.w * scale
  const h = fb.h * scale
  const pixels = upscale(fb, scale)   // Uint8Array of palette indices

  const parts = [SIXEL_START]
  // Aspect ratio + background hint (defaults are fine).
  parts.push('"1;1;', w, ';', h)
  // Color registers — one per palette entry we actually use.
  for (let i = 0; i < fb.palette.length; i++) {
    const [r, g, b] = fb.palette[i]
    // Sixel colors are 0..100 scale.
    const R = Math.round((r / 255) * 100)
    const G = Math.round((g / 255) * 100)
    const B = Math.round((b / 255) * 100)
    parts.push(`#${i};2;${R};${G};${B}`)
  }
  // Walk rows in bands of 6.
  for (let by = 0; by < h; by += 6) {
    for (let ci = 0; ci < fb.palette.length; ci++) {
      let hasColor = false
      let out = ''
      let last = -1
      let runLen = 0
      for (let x = 0; x < w; x++) {
        let bits = 0
        for (let dy = 0; dy < 6; dy++) {
          const y = by + dy
          if (y >= h) break
          if (pixels[y * w + x] === ci) bits |= (1 << dy)
        }
        if (bits !== 0) hasColor = true
        const ch = String.fromCharCode(0x3f + bits)
        if (last === ch) runLen++
        else {
          if (runLen === 1) out += String.fromCharCode(0x3f + (last.charCodeAt(0) - 0x3f))
          else if (runLen > 1) out += `!${runLen}${last}`
          last = ch
          runLen = 1
        }
      }
      if (runLen === 1) out += last === -1 ? '' : String.fromCharCode(0x3f)
      else if (runLen > 1 && last !== -1) out += `!${runLen}${last}`
      if (hasColor) parts.push(`#${ci}${out}$`)
    }
    parts.push('-')
  }
  parts.push(SIXEL_END)
  return parts.join('')
}

function upscale(fb, scale) {
  if (scale === 1) return fb.pixels
  const w = fb.w * scale
  const out = new Uint8Array(w * fb.h * scale)
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      const c = fb.pixels[y * fb.w + x]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          out[(y * scale + dy) * w + (x * scale + dx)] = c
        }
      }
    }
  }
  return out
}
