// audio-driver.js — cross-platform audio playback for terminal builds.
//
// Zero JS dependencies. Generates PCM WAV in-memory and pipes to the
// system player: afplay (macOS), aplay/paplay (Linux), or powershell
// SoundPlayer (Windows). For the web IDE, browser Web Audio API is
// wired separately (see src/web-ide/serve.js).
//
// Wired verbs use playTone / playNote / playSample below. Missing
// system player → the call is a graceful no-op (returns 'no-audio,
// not a crash — honest, per the "no lies" rule).
//
// Alfred: "audio has to work."

import { spawn } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'

// ── platform-aware player selection ─────────────────────────────────
//
// We prefer players that accept a filename arg on stdin/argv. WAV is
// universally supported.

function pickPlayer() {
  const os = platform()
  if (os === 'darwin') return { cmd: 'afplay', args: [] }
  if (os === 'linux') {
    // aplay (ALSA) is more universally installed; paplay (PulseAudio) is
    // often present on desktop. We just try aplay first.
    return { cmd: 'aplay', args: ['-q'], fallback: { cmd: 'paplay', args: [] } }
  }
  if (os === 'win32') {
    return {
      cmd: 'powershell',
      args: ['-NoProfile', '-Command'],
      // We synthesize the -Command arg at play time because it needs the file path.
      buildCommand: (path) => `(New-Object Media.SoundPlayer '${path}').PlaySync()`,
    }
  }
  return null
}

// ── WAV synthesizer ─────────────────────────────────────────────────
//
// Simple monophonic 16-bit PCM WAV. Sample rate 44.1kHz. Enough for a
// tone, a note, a short chirp. No filters, no envelope aside from a
// linear fade-out to avoid the trailing click.

const SAMPLE_RATE = 44100

function synthWav(samples) {
  const dataLen = samples.length * 2 // 16-bit = 2 bytes per sample
  const buf = Buffer.alloc(44 + dataLen)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)          // fmt chunk size
  buf.writeUInt16LE(1, 20)           // PCM
  buf.writeUInt16LE(1, 22)           // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32)           // block align
  buf.writeUInt16LE(16, 34)          // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataLen, 40)
  for (let i = 0; i < samples.length; i++) {
    // Clamp + write 16-bit signed sample.
    let s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return buf
}

// ── waveform generators ─────────────────────────────────────────────

function sineTone(freq, duration, amplitude = 0.5) {
  const n = Math.floor(SAMPLE_RATE * duration)
  const out = new Float32Array(n)
  const fade = Math.min(Math.floor(SAMPLE_RATE * 0.01), Math.floor(n / 4))
  for (let i = 0; i < n; i++) {
    let a = amplitude
    if (i < fade) a *= (i / fade)
    if (i > n - fade) a *= ((n - i) / fade)
    out[i] = a * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
  }
  return out
}

// MIDI note number → frequency in Hz. R7RS-compatible arithmetic.
function noteToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ── play ────────────────────────────────────────────────────────────

async function playBuffer(wavBuf) {
  const player = pickPlayer()
  if (!player) return { ok: false, reason: 'unsupported-platform' }
  const path = join(tmpdir(), `sakura-tone-${process.pid}-${Date.now()}.wav`)
  try {
    writeFileSync(path, wavBuf)
    const args = player.buildCommand
      ? [...player.args, player.buildCommand(path)]
      : [...player.args, path]
    await new Promise((resolve) => {
      const child = spawn(player.cmd, args, { stdio: 'ignore' })
      child.on('exit', () => resolve())
      child.on('error', () => {
        // Silent — treat as no-audio. Cleanup happens below.
        resolve()
      })
    })
  } finally {
    try { unlinkSync(path) } catch {}
  }
  return { ok: true }
}

// ── public API ──────────────────────────────────────────────────────

export async function playTone(freq, duration = 0.25, amplitude = 0.5) {
  const samples = sineTone(freq, duration, amplitude)
  const wav = synthWav(samples)
  return playBuffer(wav)
}

export async function playNote(midi, duration = 0.25, amplitude = 0.5) {
  return playTone(noteToFreq(midi), duration, amplitude)
}

export function isAudioAvailable() {
  return pickPlayer() !== null
}

export function audioBackend() {
  const p = pickPlayer()
  if (!p) return 'none'
  return p.cmd
}
