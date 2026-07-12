// valueInspector.js — arrow-key walker for `,inspect <val>`.
//
// A minimal terminal UI: a bordered pane with a breadcrumb at the top,
// the current focus rendered inside, and a status line at the bottom
// showing the keys.
//
//   ↑ / ↓      move to the previous / next sibling
//   → / Enter  descend into the focused child
//   ←          ascend one level
//   Enter      also binds the current focus to `_` and exits (feature 2)
//   q / Esc    quit without binding
//
// Non-compound values print inline and offer only ← and q.
//
// The inspector runs the raw-mode input loop itself — we borrow the same
// stdin state juggling the LineEditor uses. When we return, the caller
// restores the prompt.

import { role, CTRL } from './palette.js'
import { schemeFormat } from './richDisplay.js'
import { Sym } from '../reader.js'

/**
 * inspect(ctx, rootValue) → Promise<result>
 *
 *   result = { kind: 'quit' } | { kind: 'bind', value }
 *
 * Ctx must supply `.out(str)` for writing and expose stdin — we use
 * process.stdin directly for the raw-mode read (same as LineEditor).
 */
export function inspect(ctx, rootValue) {
  return new Promise((resolve) => {
    const out = (s) => ctx.out(s)

    // The walk state = a path from root to the current focus.
    // Each entry: { parent, key, value }
    // The last entry is the current focus.
    const path = [{ parent: null, key: null, value: rootValue }]
    // Sibling index inside the parent (for ↑ / ↓ nav) — computed on demand.

    function focus() { return path[path.length - 1] }

    // What kind of container is v? Returns:
    //   { kind: 'list', items: [...] }
    //   { kind: 'object', keys: [...], values: {...} }
    //   { kind: 'scalar' }
    function shape(v) {
      if (Array.isArray(v)) {
        return { kind: 'list', items: v }
      }
      if (v && typeof v === 'object' && !(v instanceof Sym) && typeof v !== 'function') {
        const keys = Object.keys(v)
        if (keys.length > 0) return { kind: 'object', keys, obj: v }
        return { kind: 'scalar' }
      }
      return { kind: 'scalar' }
    }

    function siblings() {
      const f = focus()
      if (!f.parent) return { list: [f], idx: 0 }
      const s = shape(f.parent)
      if (s.kind === 'list') {
        return { list: s.items.map((v, i) => ({ parent: f.parent, key: i, value: v })), idx: f.key }
      }
      if (s.kind === 'object') {
        return { list: s.keys.map((k) => ({ parent: f.parent, key: k, value: s.obj[k] })), idx: s.keys.indexOf(f.key) }
      }
      return { list: [f], idx: 0 }
    }

    // ── rendering ─────────────────────────────────────────────────
    let rowsWritten = 0
    function clearFrame() {
      if (rowsWritten === 0) return
      // Move to column 0, up rowsWritten-1 lines, clear to end of screen.
      out('\r')
      if (rowsWritten > 1) out(CTRL.moveUp(rowsWritten - 1))
      out('\x1b[J')
      rowsWritten = 0
    }

    function breadcrumb() {
      const parts = ['root']
      for (let i = 1; i < path.length; i++) {
        const k = path[i].key
        parts.push(typeof k === 'number' ? `[${k}]` : `.${k}`)
      }
      return parts.join(' ')
    }

    function render() {
      clearFrame()
      const bc = breadcrumb()
      const width = 68
      const bar = '─'.repeat(width)
      out(role.dim('┌' + bar + '┐') + '\n')
      out(role.dim('│ ') + role.strong(pad(bc, width - 2)) + role.dim(' │') + '\n')
      out(role.dim('├' + bar + '┤') + '\n')
      const f = focus()
      const s = shape(f.value)
      const sibs = siblings()
      let lines = []
      if (s.kind === 'scalar') {
        lines.push(role.text(schemeFormat(f.value)))
      } else if (s.kind === 'list') {
        s.items.forEach((v, i) => {
          const marker = (i === sibs.idx && path.length > 1 && f.parent === path[path.length - 2]?.value)
            ? role.petal('▶ ')
            : (path.length === 1 && i === 0 ? '  ' : '  ')
          lines.push(marker + role.dim(String(i).padStart(3) + ':  ') + role.text(previewValue(v)))
        })
        if (s.items.length === 0) lines.push(role.dim('  (empty list)'))
      } else if (s.kind === 'object') {
        s.keys.forEach((k) => {
          const marker = k === sibs.idx || k === focus().key ? role.petal('▶ ') : '  '
          lines.push(marker + role.meta(k) + role.dim(':  ') + role.text(previewValue(s.obj[k])))
        })
        if (s.keys.length === 0) lines.push(role.dim('  (empty object)'))
      }
      // If focus is a child inside its parent, we want a highlight arrow
      // on the currently-focused sibling. Redo the arrows against sibs.
      if (path.length > 1 && shape(f.parent).kind !== 'scalar') {
        lines = []
        const parentShape = shape(f.parent)
        if (parentShape.kind === 'list') {
          parentShape.items.forEach((v, i) => {
            const marker = (i === f.key) ? role.petal('▶ ') : '  '
            lines.push(marker + role.dim(String(i).padStart(3) + ':  ') + role.text(previewValue(v)))
          })
        } else if (parentShape.kind === 'object') {
          parentShape.keys.forEach((k) => {
            const marker = (k === f.key) ? role.petal('▶ ') : '  '
            lines.push(marker + role.meta(k) + role.dim(':  ') + role.text(previewValue(parentShape.obj[k])))
          })
        }
      }
      // Truncate for pane height.
      const MAX_LINES = 16
      const visible = lines.slice(0, MAX_LINES)
      for (const line of visible) {
        // strip ANSI for width measurement
        const w = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length
        const padN = Math.max(0, width - 2 - w)
        out(role.dim('│ ') + line + ' '.repeat(padN) + role.dim(' │') + '\n')
      }
      if (lines.length > MAX_LINES) {
        out(role.dim('│ ') + role.dim(`… ${lines.length - MAX_LINES} more`).padEnd(width - 2 + 10) + role.dim(' │') + '\n')
      }
      out(role.dim('├' + bar + '┤') + '\n')
      const status = statusLine(s.kind, path.length > 1)
      out(role.dim('│ ') + role.dim(pad(status, width - 2)) + role.dim(' │') + '\n')
      out(role.dim('└' + bar + '┘') + '\n')
      rowsWritten = 4 + visible.length + (lines.length > MAX_LINES ? 1 : 0) + 2
    }

    function pad(s, w) {
      // Strip ANSI for width count.
      const clean = s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      if (clean.length >= w) return s.slice(0, w)
      return s + ' '.repeat(w - clean.length)
    }

    function statusLine(kind, hasParent) {
      const keys = []
      if (hasParent) keys.push('← ascend')
      if (kind !== 'scalar') keys.push('↑ ↓ move', '→ Enter descend + bind')
      else keys.push('Enter bind')
      keys.push('q Esc quit')
      return keys.join('   ')
    }

    function previewValue(v) {
      if (v === undefined) return '()'
      if (v === null) return '()'
      if (typeof v === 'number' || typeof v === 'boolean') return schemeFormat(v)
      if (typeof v === 'string') {
        const s = schemeFormat(v)
        return s.length > 40 ? s.slice(0, 37) + '…"' : s
      }
      if (v instanceof Sym) return v.name
      if (Array.isArray(v)) return `(list, ${v.length})`
      if (typeof v === 'function') return '#<procedure>'
      if (v && typeof v === 'object') return `{object, ${Object.keys(v).length}}`
      return schemeFormat(v)
    }

    // ── key handling ──────────────────────────────────────────────
    function finish(result) {
      clearFrame()
      if (process.stdin.setRawMode) process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.off('data', handler)
      resolve(result)
    }

    function handler(buf) {
      const s = buf.toString('utf-8')
      const b = buf[0]
      // Parse a single event. Similar shape to lineEditor.parseKey but
      // trimmed to just the keys we care about.
      let key
      if (s === '\r' || s === '\n') key = 'enter'
      else if (s === 'q') key = 'quit'
      else if (s === '\x1b') key = 'escape'
      else if (s === '\x03') key = 'quit'  // Ctrl-C
      else if (s.startsWith('\x1b[')) {
        const seq = s.slice(2)
        if (seq === 'A') key = 'up'
        else if (seq === 'B') key = 'down'
        else if (seq === 'C') key = 'right'
        else if (seq === 'D') key = 'left'
      }
      if (!key) return

      const f = focus()

      if (key === 'quit' || key === 'escape') { finish({ kind: 'quit' }); return }

      if (key === 'left') {
        if (path.length > 1) {
          path.pop()
          render()
        }
        return
      }

      if (key === 'up' || key === 'down') {
        // Move within siblings — requires a parent.
        if (path.length <= 1) return
        const parent = path[path.length - 2]
        const s = shape(parent.value)
        let keys
        if (s.kind === 'list') keys = s.items.map((_, i) => i)
        else if (s.kind === 'object') keys = s.keys
        else return
        const curIdx = keys.indexOf(f.key)
        if (curIdx < 0) return
        const nextIdx = key === 'up' ? (curIdx - 1 + keys.length) % keys.length : (curIdx + 1) % keys.length
        const nextKey = keys[nextIdx]
        const nextVal = s.kind === 'list' ? s.items[nextKey] : s.obj[nextKey]
        path[path.length - 1] = { parent: parent.value, key: nextKey, value: nextVal }
        render()
        return
      }

      if (key === 'right') {
        // Descend into the first child if compound.
        const s = shape(f.value)
        if (s.kind === 'list' && s.items.length > 0) {
          path.push({ parent: f.value, key: 0, value: s.items[0] })
          render()
        } else if (s.kind === 'object' && s.keys.length > 0) {
          const k = s.keys[0]
          path.push({ parent: f.value, key: k, value: s.obj[k] })
          render()
        }
        return
      }

      if (key === 'enter') {
        // Bind focus to `_` and quit.
        finish({ kind: 'bind', value: f.value })
        return
      }
    }

    // Start.
    if (process.stdin.setRawMode) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', handler)
    render()
  })
}
