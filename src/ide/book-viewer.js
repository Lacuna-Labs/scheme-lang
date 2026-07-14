// book-viewer.js — read-only structured renderer for .book.slatl files.
//
// A .book.slatl file is Sakura's canonical authored-book format. It's
// Scheme-shaped (readable by src/reader.js), organized as:
//
//   (book
//     :title       "Book of Words"
//     :author      "Sakura + Alfred"
//     :chapters (
//       (chapter
//         :title "1. What a Sweater Is"
//         :epigraph "..."
//         :prose ("paragraph one" "paragraph two")
//         :examples (
//           (:code "(display \"hi\")" :note "smallest program")
//           …))
//       …))
//
// The viewer parses one of these files and returns a structured object
// the terminal + web can render as a scrollable reader. Examples get a
// "Run" affordance — the editor+REPL can evaluate them in place.
//
// v0.0: parse + structured render + example extraction. Editing is
// Phase 2. Books flagged .book.slatl open in viewer; .slat or .scm
// open in the plain editor.

import { readFileSync } from 'node:fs'
import { parse, Sym } from '../reader.js'

/**
 * Load a .book.slatl file and return a structured book.
 * Throws on parse error.
 */
export function loadBook(path) {
  const src = readFileSync(path, 'utf-8')
  return parseBook(src, path)
}

/**
 * Parse the book source. Split out for tests + web.
 */
export function parseBook(src, sourceHint = '<book>') {
  const forms = parse(src)
  let book = null
  for (const form of forms) {
    if (!Array.isArray(form) || form.length === 0) continue
    const head = form[0]
    if (head instanceof Sym && head.name === 'book') {
      book = normalizeBook(form.slice(1))
      break
    }
  }
  if (!book) {
    throw new Error(`book-viewer: no (book ...) form found in ${sourceHint}`)
  }
  return book
}

function normalizeBook(body) {
  const bag = kwBag(body)
  const chapters = Array.isArray(bag.chapters) ? bag.chapters.map(normalizeChapter).filter(Boolean) : []
  return {
    title:    scalar(bag.title) || '(untitled book)',
    author:   scalar(bag.author) || '',
    subtitle: scalar(bag.subtitle) || '',
    epigraph: scalar(bag.epigraph) || '',
    chapters,
  }
}

function normalizeChapter(form) {
  if (!Array.isArray(form) || form.length === 0) return null
  const head = form[0]
  // Chapters look like (chapter :title "..." :prose (...) :examples (...))
  const body = head instanceof Sym && head.name === 'chapter' ? form.slice(1) : form
  const bag = kwBag(body)
  const prose = arrayify(bag.prose).map(scalar).filter(Boolean)
  const examples = arrayify(bag.examples).map(normalizeExample).filter(Boolean)
  return {
    title:    scalar(bag.title) || '(untitled chapter)',
    epigraph: scalar(bag.epigraph) || '',
    prose,
    examples,
  }
}

function normalizeExample(form) {
  if (!Array.isArray(form)) return null
  const bag = kwBag(form)
  const code = scalar(bag.code)
  if (!code) return null
  return {
    code,
    note:  scalar(bag.note) || '',
    tier:  scalar(bag.tier) || 'novice',
  }
}

// ── little scheme→JS helpers ───────────────────────────────────────

function scalar(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Sym) return v.name
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(scalar).join(' ')
  return ''
}

function arrayify(v) {
  if (v === null || v === undefined) return []
  if (Array.isArray(v)) return v
  return [v]
}

function kwBag(items) {
  const out = {}
  for (let i = 0; i < items.length; i++) {
    const k = items[i]
    if (k instanceof Sym && k.name.startsWith(':')) {
      out[k.name.slice(1)] = items[i + 1]
      i++
    }
  }
  return out
}

/**
 * Check whether a given path should open in the book viewer.
 */
export function isBookPath(path) {
  return typeof path === 'string' && /\.book\.slatl?$/i.test(path)
}

/**
 * Render a book as plain text (for terminal display).
 * Returns a string of lines, ready to be paginated.
 */
export function renderBookText(book, cols = 80) {
  const out = []
  out.push('╔' + '═'.repeat(Math.max(0, cols - 2)) + '╗')
  out.push('║ ' + pad(book.title, cols - 4) + ' ║')
  if (book.subtitle) out.push('║ ' + pad(book.subtitle, cols - 4) + ' ║')
  if (book.author) out.push('║ ' + pad('— ' + book.author, cols - 4) + ' ║')
  out.push('╚' + '═'.repeat(Math.max(0, cols - 2)) + '╝')
  out.push('')
  if (book.epigraph) {
    for (const line of wrap(book.epigraph, cols - 4)) out.push('   ' + line)
    out.push('')
  }
  for (let ci = 0; ci < book.chapters.length; ci++) {
    const ch = book.chapters[ci]
    out.push('── ' + ch.title + ' ' + '─'.repeat(Math.max(0, cols - ch.title.length - 4)))
    if (ch.epigraph) {
      out.push('')
      for (const line of wrap(ch.epigraph, cols - 4)) out.push('   ' + line)
    }
    for (const p of ch.prose) {
      out.push('')
      for (const line of wrap(p, cols - 2)) out.push(line)
    }
    for (let ei = 0; ei < ch.examples.length; ei++) {
      const ex = ch.examples[ei]
      out.push('')
      out.push('  ┌─ example ' + (ei + 1) + (ex.tier ? ' (' + ex.tier + ')' : '') + ' ' + '─'.repeat(Math.max(0, cols - 20)))
      for (const l of ex.code.split('\n')) out.push('  │ ' + l)
      out.push('  └' + '─'.repeat(Math.max(0, cols - 4)))
      if (ex.note) {
        for (const line of wrap(ex.note, cols - 6)) out.push('    ' + line)
      }
    }
    out.push('')
  }
  return out
}

function pad(s, w) {
  if (s.length >= w) return s.slice(0, w)
  return s + ' '.repeat(w - s.length)
}

function wrap(s, w) {
  const words = String(s || '').split(/\s+/)
  const lines = []
  let cur = ''
  for (const word of words) {
    if (!word) continue
    if (cur.length + word.length + 1 > w) {
      if (cur) lines.push(cur)
      cur = word
    } else {
      cur = cur ? cur + ' ' + word : word
    }
  }
  if (cur) lines.push(cur)
  return lines
}
