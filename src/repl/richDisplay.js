// richDisplay.js — pretty-print evaluated values.
//
// Numbers and strings get simple coloring. Lists of homogeneous shape
// (all numbers, or all short pairs) render as ASCII tables. Nested lists
// stay in S-expression form because that's the language's native shape.
// Hash-tables (JS plain objects with no `kind` field) render as key/value
// grids. Records with `kind` route to a labeled-fields rendering.
//
// Everything falls back to `schemeFormat` — the same S-expression printer
// the CLI already uses — when no richer form fits.

import { role, PALETTE, fg } from './palette.js'
import { renderGraphic } from './braille.js'
import { Sym } from '../reader.js'

/**
 * schemeFormat(v) → string
 *
 * The universal fallback. Prints Scheme values in read-back-safe form.
 */
export function schemeFormat(v) {
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v === null || v === undefined) return '()'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return '(' + v.map(schemeFormat).join(' ') + ')'
  if (typeof v === 'function') return '#<procedure>'
  if (typeof v === 'object') {
    if (v.name && typeof v.name === 'string' && Object.keys(v).length === 1) return v.name
    return '#<object>'
  }
  return String(v)
}

/**
 * colorFormat(v) → string
 *
 * Like schemeFormat but with color roles applied.
 */
export function colorFormat(v) {
  if (v === true) return role.keyword('#t')
  if (v === false) return role.keyword('#f')
  if (v === null || v === undefined) return role.dim('()')
  if (typeof v === 'number') return role.number(String(v))
  if (typeof v === 'string') return role.string(JSON.stringify(v))
  if (v instanceof Sym) return role.text(v.name)
  if (Array.isArray(v)) {
    const inner = v.map(colorFormat).join(' ')
    return role.dim('(') + inner + role.dim(')')
  }
  if (typeof v === 'function') return role.dim('#<procedure>')
  if (typeof v === 'object') return role.dim(schemeFormat(v))
  return role.text(String(v))
}

// ── shape detection ──────────────────────────────────────────────────

function isFlatNumberList(v) {
  return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number')
}

function isListOfPairs(v) {
  return Array.isArray(v) && v.length > 0 && v.every(x =>
    Array.isArray(x) && x.length === 2 && !Array.isArray(x[0]) && !Array.isArray(x[1])
  )
}

function isAssocRows(v) {
  // List of lists of scalars where every inner list has the same length.
  return Array.isArray(v) && v.length > 1 && v.every(row =>
    Array.isArray(row) && row.length === v[0].length &&
    row.every(cell => typeof cell === 'number' || typeof cell === 'string' || cell === true || cell === false || cell instanceof Sym)
  )
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
}

// ── renderers ────────────────────────────────────────────────────────

function renderNumberList(v) {
  // For a short list, inline. For a long one, a bordered table.
  if (v.length <= 12) return colorFormat(v)
  const cellW = Math.max(...v.map(n => String(n).length))
  const cols = Math.max(1, Math.min(8, Math.floor(72 / (cellW + 2))))
  const lines = []
  lines.push(role.dim('┌' + '─'.repeat(cols * (cellW + 2) - 1) + '┐'))
  for (let i = 0; i < v.length; i += cols) {
    const row = []
    for (let j = 0; j < cols && i + j < v.length; j++) {
      row.push(role.number(String(v[i + j]).padStart(cellW)))
    }
    lines.push(role.dim('│ ') + row.join(role.dim(' │ ')) + role.dim(' │'))
  }
  lines.push(role.dim('└' + '─'.repeat(cols * (cellW + 2) - 1) + '┘'))
  return lines.join('\n')
}

function renderAssocRows(v) {
  const cols = v[0].length
  const widths = new Array(cols).fill(0)
  const cells = v.map(row => row.map(c => {
    const s = schemeFormat(c)
    return s
  }))
  for (const row of cells) {
    for (let c = 0; c < cols; c++) widths[c] = Math.max(widths[c], row[c].length)
  }
  const lines = []
  const top = '┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'
  const mid = '├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'
  const bot = '└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'
  lines.push(role.dim(top))
  cells.forEach((row, i) => {
    const parts = row.map((s, j) => ' ' + s.padEnd(widths[j]) + ' ')
    lines.push(role.dim('│') + parts.map(p => role.text(p)).join(role.dim('│')) + role.dim('│'))
    if (i === 0 && cells.length > 1) lines.push(role.dim(mid))
  })
  lines.push(role.dim(bot))
  return lines.join('\n')
}

function renderKVGrid(obj) {
  const keys = Object.keys(obj)
  if (keys.length === 0) return role.dim('{}')
  const kw = Math.max(...keys.map(k => k.length))
  const lines = []
  lines.push(role.dim('┌' + '─'.repeat(kw + 2) + '┬' + '─'.repeat(40) + '┐'))
  for (const k of keys) {
    const val = schemeFormat(obj[k]).slice(0, 38)
    lines.push(
      role.dim('│ ') + role.meta(k.padEnd(kw)) + role.dim(' │ ') +
      role.text(val.padEnd(38)) + role.dim(' │')
    )
  }
  lines.push(role.dim('└' + '─'.repeat(kw + 2) + '┴' + '─'.repeat(40) + '┘'))
  return lines.join('\n')
}

/**
 * display(v) → string (may contain newlines)
 *
 * The main entry. Chooses the richest form the value fits.
 */
export function display(v) {
  // First check if it's a graphic — that trumps everything.
  const g = renderGraphic(v)
  if (g) return g.join('\n')

  if (v === undefined) return role.dim(';; ()')
  if (v === null) return role.dim('()')
  if (typeof v === 'number') return role.number(String(v))
  if (typeof v === 'string') return role.string(JSON.stringify(v))
  if (typeof v === 'boolean') return role.keyword(v ? '#t' : '#f')
  if (v instanceof Sym) return role.text(v.name)

  if (Array.isArray(v)) {
    if (v.length === 0) return role.dim('()')
    // Table shapes.
    if (isAssocRows(v) && v.length >= 2 && v[0].length >= 2 && v[0].length <= 8) {
      return renderAssocRows(v)
    }
    if (isFlatNumberList(v) && v.length > 12) return renderNumberList(v)
    if (isListOfPairs(v) && v.length > 4) {
      // Render as 2-col table.
      return renderAssocRows(v)
    }
    return colorFormat(v)
  }

  if (typeof v === 'function') return role.dim('#<procedure>')
  if (isPlainObject(v)) return renderKVGrid(v)

  return colorFormat(v)
}
