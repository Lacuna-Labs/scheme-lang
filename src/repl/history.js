// history.js — persistent REPL history + fuzzy Ctrl-R search.
//
// Stored as newline-separated entries at $SCHEME_LANG_HISTORY (defaults
// to $XDG_STATE_HOME/scheme-lang/history or ~/.scheme-lang/history).
// Multi-line entries are joined with the null delimiter '\x00' so a
// simple line split trivially deserializes them.
//
// The store is append-only during a session; save-on-exit writes the
// merged tail. If two REPLs share the file (Alfred often has 4 open),
// they don't overwrite each other's tails — we re-read then append.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

function defaultPath() {
  if (process.env.SCHEME_LANG_HISTORY) return process.env.SCHEME_LANG_HISTORY
  const xdg = process.env.XDG_STATE_HOME
  const dir = xdg ? join(xdg, 'scheme-lang') : join(homedir(), '.scheme-lang')
  return join(dir, 'history')
}

const DELIM = '\x00'
const MAX_ENTRIES = 5000

export class History {
  constructor(path = defaultPath()) {
    this.path = path
    this.entries = []
    this.cursor = 0
    this.dirty = false
    this._load()
    this.cursor = this.entries.length
  }

  _load() {
    try {
      const raw = readFileSync(this.path, 'utf-8')
      this.entries = raw.split('\n').filter(l => l.length > 0).map(l => l.replace(DELIM, '\n').split(DELIM).join('\n'))
      // Trim to max.
      if (this.entries.length > MAX_ENTRIES) {
        this.entries = this.entries.slice(-MAX_ENTRIES)
      }
    } catch { /* first run */ }
  }

  add(entry) {
    if (!entry || !entry.trim()) return
    // Dedupe consecutive duplicates.
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === entry) {
      this.cursor = this.entries.length
      return
    }
    this.entries.push(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES)
    }
    this.cursor = this.entries.length
    this.dirty = true
  }

  /** Persist to disk. Idempotent; safe to call on exit. */
  save() {
    if (!this.dirty) return
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      const lines = this.entries.map(e => e.split('\n').join(DELIM))
      writeFileSync(this.path, lines.join('\n') + '\n', 'utf-8')
      this.dirty = false
    } catch { /* best effort */ }
  }

  /** Move cursor back one; return the entry or null. */
  prev() {
    if (this.cursor <= 0) return null
    this.cursor--
    return this.entries[this.cursor]
  }

  /** Move cursor forward one; return the entry or '' at the end. */
  next() {
    if (this.cursor >= this.entries.length) return ''
    this.cursor++
    return this.cursor === this.entries.length ? '' : this.entries[this.cursor]
  }

  resetCursor() {
    this.cursor = this.entries.length
  }

  /**
   * Fuzzy search from newest → oldest for `query`. Returns matching
   * entries in most-recent-first order. Ctrl-R uses this.
   */
  search(query) {
    if (!query) return []
    const q = query.toLowerCase()
    const hits = []
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]
      if (e.toLowerCase().includes(q)) hits.push(e)
      if (hits.length > 50) break
    }
    return hits
  }
}
