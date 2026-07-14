// settings.js — mutable runtime settings modifiable from within the REPL.
//
// Complements config.js (static, read-at-boot). This module holds
// user-changeable settings surfaced via `,settings` / `,set` / `,theme`.
// Persisted to $XDG_CONFIG_HOME/sakura-scheme/settings.slat.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

function settingsPath() {
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) return join(xdg, 'sakura-scheme', 'settings.slat')
  return join(homedir(), '.config', 'sakura-scheme', 'settings.slat')
}

// Schema — every user-modifiable setting the REPL surfaces via ,set.
export const SCHEMA = Object.freeze({
  theme: {
    default: 'sakura',
    kind: 'string',
    valid: ['sakura', 'hacker', 'sakura-dark', 'sakura-light', 'high-contrast', 'paper'],
    doc: 'color theme (,theme <name> is a shortcut)',
  },
  banner: {
    default: true,
    kind: 'bool',
    doc: 'show the cherry-blossom banner at REPL startup',
  },
  fortune: {
    default: false,
    kind: 'bool',
    doc: 'print a small pedagogy quote at startup',
  },
  'goodnight': {
    default: true,
    kind: 'bool',
    doc: 'print "goodnight ✿" on exit',
  },
  'history-size': {
    default: 500,
    kind: 'number',
    doc: 'how many REPL entries to keep in history',
  },
  'fuel': {
    default: 200000,
    kind: 'number',
    doc: 'default fuel budget per expression',
  },
  'auto-help': {
    default: true,
    kind: 'bool',
    doc: 'show verb-signature on autocomplete popup',
  },
  'inline-eval': {
    default: true,
    kind: 'bool',
    doc: 'show evaluation result inline in the IDE',
  },
  'ask-sakura': {
    default: true,
    kind: 'bool',
    doc: 'Ctrl-K opens the Ask-Sakura widget in the IDE',
  },
  'prompt': {
    default: '',
    kind: 'string',
    doc: 'override REPL prompt (empty = theme default)',
  },
})

let SETTINGS = null

function defaults() {
  const d = {}
  for (const k of Object.keys(SCHEMA)) d[k] = SCHEMA[k].default
  return d
}

function ensureLoaded() {
  if (SETTINGS) return SETTINGS
  SETTINGS = defaults()
  const path = settingsPath()
  if (existsSync(path)) {
    try {
      const text = readFileSync(path, 'utf-8')
      Object.assign(SETTINGS, parse(text))
    } catch (e) { /* fall through to defaults */ }
  }
  return SETTINGS
}

function parse(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith(';')) continue
    const m = line.match(/^:([\w-]+)\s+(.+?)(?:\s*;.*)?$/)
    if (!m) continue
    const key = m[1]
    const value = m[2].trim()
    if (!(key in SCHEMA)) continue
    const kind = SCHEMA[key].kind
    if (kind === 'string') {
      const sm = value.match(/^"((?:\\.|[^"\\])*)"$/)
      if (sm) out[key] = unesc(sm[1])
    } else if (kind === 'bool') {
      out[key] = value === '#t' || value === 'true'
    } else if (kind === 'number') {
      const n = Number(value)
      if (!Number.isNaN(n)) out[key] = n
    }
  }
  return out
}

function unesc(s) { return s.replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\') }
function esc(s)   { return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n') }

function serialize(s) {
  const lines = [';; sakura-scheme user settings — human-editable, auto-saved on ,set', '']
  for (const k of Object.keys(SCHEMA)) {
    const v = s[k]
    if (v === undefined) continue
    const kind = SCHEMA[k].kind
    let out
    if (kind === 'string') out = '"' + esc(v) + '"'
    else if (kind === 'bool') out = v ? '#t' : '#f'
    else out = String(v)
    lines.push(':' + k + ' ' + out + '   ; ' + SCHEMA[k].doc)
  }
  return lines.join('\n') + '\n'
}

export function get(key) {
  ensureLoaded()
  return SETTINGS[key]
}

export function set(key, value) {
  ensureLoaded()
  const spec = SCHEMA[key]
  if (!spec) return { ok: false, error: 'unknown setting "' + key + '"' }
  let parsed = value
  if (spec.kind === 'bool') {
    if (value === true || ['#t','true','on','1','yes'].includes(String(value))) parsed = true
    else if (value === false || ['#f','false','off','0','no'].includes(String(value))) parsed = false
    else return { ok: false, error: 'expected boolean (#t/#f), got: ' + value }
  } else if (spec.kind === 'number') {
    const n = Number(value)
    if (Number.isNaN(n)) return { ok: false, error: 'expected number, got: ' + value }
    parsed = n
  } else if (spec.kind === 'string') {
    parsed = String(value)
    if (spec.valid && !spec.valid.includes(parsed)) {
      return { ok: false, error: 'expected one of: ' + spec.valid.join(', ') }
    }
  }
  SETTINGS[key] = parsed
  save()
  return { ok: true, value: parsed }
}

export function all() { ensureLoaded(); return { ...SETTINGS } }

export function reset(key) {
  ensureLoaded()
  const spec = SCHEMA[key]
  if (!spec) return { ok: false, error: 'unknown setting: ' + key }
  SETTINGS[key] = spec.default
  save()
  return { ok: true, value: SETTINGS[key] }
}

function save() {
  const path = settingsPath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, serialize(SETTINGS), 'utf-8')
  } catch (e) { /* in-session only */ }
}

export function filePath() { return settingsPath() }
