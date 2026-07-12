// config.js — read + parse ~/.scheme-lang/config.slat.
//
// SLAT-lite: `key: value` per line. Comments start with ;;. Blank lines
// ignored. Values are strings; the caller coerces. Unknown keys are
// preserved so we don't drop tomorrow's settings today.
//
// Known keys as of v1.0:
//   keybindings         'emacs | 'vim | 'default    (default: 'emacs')
//   theme               'sakura | 'neutral          (default: 'sakura' when dialect=sakura)
//   sakura-endpoint     URL for ,ask sakura         (default: unset — stub message)
//   sakura-token        bearer token                (default: unset)
//   history-max         integer                     (default: 5000)
//   editor              command name                (default: $EDITOR)
//   prompt              prompt string               (default: dialect default)
//   auto-close-parens   #t | #f                     (default: #t)
//   show-signature      #t | #f                     (default: #t)
//   ghost-hints         #t | #f                     (default: #t)

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULTS = Object.freeze({
  'keybindings':       'emacs',
  'theme':             'sakura',
  'history-max':       '5000',
  'auto-close-parens': '#t',
  'show-signature':    '#t',
  'ghost-hints':       '#t',
  'editor':            process.env.EDITOR || process.env.VISUAL || 'vi',
})

function defaultPath() {
  const xdg = process.env.XDG_CONFIG_HOME
  const dir = xdg ? join(xdg, 'scheme-lang') : join(homedir(), '.scheme-lang')
  return join(dir, 'config.slat')
}

/** Parse SLAT-lite text into a plain object. */
export function parseSlat(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;;.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    out[key] = val
  }
  return out
}

/** Load config, merging over defaults. Never throws. */
export function loadConfig(path = defaultPath()) {
  const config = { ...DEFAULTS }
  try {
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf-8')
      Object.assign(config, parseSlat(text))
    }
  } catch { /* ignore */ }
  return config
}

/** Truthy check for #t / true / 1 / yes. Anything else is false. */
export function truthy(v) {
  if (v === true) return true
  if (typeof v !== 'string') return false
  const s = v.toLowerCase().trim()
  return s === '#t' || s === 'true' || s === '1' || s === 'yes' || s === 'on'
}
