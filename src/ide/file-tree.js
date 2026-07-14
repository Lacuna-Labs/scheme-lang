// file-tree.js — the narrow file explorer pane.
//
// Lists the cwd (and optionally expanded dirs). No navigation into
// arbitrary dirs in v0.0 — you cd via `:e path`. This is a launchpad
// for the current project.

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function makeFileTree(cwd) {
  return {
    cwd,
    cursor: 0,
    scroll: 0,
    // Cache the dir listing; call refresh() to reread.
    _entries: null,

    refresh() {
      this._entries = readTree(this.cwd)
      this.cursor = Math.min(this.cursor, Math.max(0, this._entries.length - 1))
    },

    list() {
      if (!this._entries) this.refresh()
      return this._entries
    },

    selected() {
      const items = this.list()
      return items[this.cursor] || null
    },

    moveDown(n = 1) {
      const items = this.list()
      this.cursor = Math.min(items.length - 1, this.cursor + n)
    },
    moveUp(n = 1) {
      this.cursor = Math.max(0, this.cursor - n)
    },
  }
}

function readTree(dir) {
  try {
    const names = readdirSync(dir)
    const items = []
    for (const name of names) {
      if (name.startsWith('.')) continue // hide dotfiles v0.0
      const full = join(dir, name)
      try {
        const st = statSync(full)
        items.push({ name, isDir: st.isDirectory(), size: st.size, path: full })
      } catch { /* skip */ }
    }
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return items
  } catch {
    return []
  }
}
