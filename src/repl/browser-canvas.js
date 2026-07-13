// browser-canvas.js — canvas 2D adapter for the browser REPL.
//
// This is the sibling of the terminal adapters. It accepts a
// Framebuffer and paints palette-indexed pixels onto a supplied
// CanvasRenderingContext2D. Only usable in a browser environment.

import { Framebuffer } from '../framebuffer.js'

/**
 * Paint the given framebuffer to a 2D canvas context.
 *
 * ctx      — CanvasRenderingContext2D. Its canvas is resized to
 *            fb.w×fb.h×scale.
 * opts:
 *   scale  — integer upscale (default 4).
 */
export function renderFramebuffer(fb, ctx, opts = {}) {
  if (!(fb instanceof Framebuffer)) throw new Error('browser-canvas/renderFramebuffer: expected Framebuffer')
  if (!ctx || typeof ctx.putImageData !== 'function') {
    throw new Error('browser-canvas/renderFramebuffer: expected a CanvasRenderingContext2D')
  }
  const scale = Math.max(1, opts.scale || 4)
  const w = fb.w * scale
  const h = fb.h * scale
  if (ctx.canvas.width !== w)  ctx.canvas.width  = w
  if (ctx.canvas.height !== h) ctx.canvas.height = h
  const img = ctx.createImageData(w, h)
  const buf = img.data
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      const p = fb.pixels[y * fb.w + x]
      const [r, g, b, a] = fb.palette[p] || [0, 0, 0, 255]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * w + (x * scale + dx)) * 4
          buf[i]     = r
          buf[i + 1] = g
          buf[i + 2] = b
          buf[i + 3] = a
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}
