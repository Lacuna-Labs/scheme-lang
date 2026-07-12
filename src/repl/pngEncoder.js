// pngEncoder.js — a minimal PNG encoder for the image router.
//
// We only need enough PNG to hand off to iTerm2/kitty/WezTerm inline
// image protocols. Those protocols base64 a real PNG and let the
// terminal decode it. So: a real PNG, no dependencies.
//
// Grayscale + alpha is overkill; we ship RGBA (8-bit per channel) at
// arbitrary width/height. The stream is:
//   1. PNG signature (8 bytes)
//   2. IHDR chunk (width/height/bit-depth/color-type/etc.)
//   3. IDAT chunk (filter byte + row bytes, wrapped in a zlib stream)
//   4. IEND chunk
//
// The zlib we ship is uncompressed (BTYPE=00 blocks). PNG mandates zlib
// framing — 2 bytes header (0x78 0x01), payload, 4 bytes Adler-32 —
// but the DEFLATE data inside can be uncompressed blocks that the
// decoder still handles correctly. This keeps us dep-free and the code
// short. Terminals decompress the payload as part of their image path.

import { deflateSync } from 'node:zlib'

// CRC-32 table (RFC 1952).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  // A PNG chunk = length (4B) + type (4B) + data (nB) + crc (4B).
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/**
 * encodePng(pixels, width, height) → Buffer
 *
 * `pixels`: a Uint8Array of length width * height * 4 (RGBA, top-down).
 * Returns a real PNG that browsers + terminals + node fs can consume.
 */
export function encodePng(pixels, width, height) {
  if (pixels.length !== width * height * 4) {
    throw new Error(`pngEncoder: pixels length ${pixels.length} != ${width}*${height}*4`)
  }
  // PNG signature.
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  // IHDR.
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8]  = 8                // bit depth
  ihdr[9]  = 6                // color type: RGBA
  ihdr[10] = 0                // compression method (deflate)
  ihdr[11] = 0                // filter method (adaptive)
  ihdr[12] = 0                // interlace method (none)
  const ihdrChunk = chunk('IHDR', ihdr)
  // IDAT — a filter byte per row, then the row bytes.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0  // filter: None
    const rowStart = y * stride
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = pixels[rowStart + x]
    }
  }
  const compressed = deflateSync(raw)
  const idatChunk = chunk('IDAT', compressed)
  // IEND.
  const iendChunk = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}
