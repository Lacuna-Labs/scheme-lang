// global-search.js — Ctrl-Shift-F across-file search.
//
// A simple grep-alike: given a query string, walk the project tree,
// read every file, and return hits with { path, line, col, text }.
// Case-insensitive by default; wrap the query in / … / for regex.
//
// Caps mirror fuzzy-find:
//   MAX_FILES   5000
//   MAX_HITS    500     — enough for the biggest search a human will read
//   MAX_LINE    500 chars — truncate long lines for the preview
//
// Binary detection is done crudely (first 512 bytes: if any \x00 is
// present, treat as binary and skip). This catches images, archives,
// and the SLAT is text so it stays scanned.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectFiles as fuzzyCollect } from './fuzzy-find.js'

const MAX_HITS = 500
const MAX_LINE = 500

/**
 * Search all files under `root` for `query`. Query is a literal string
 * unless it is wrapped in /…/  in which case it is compiled as a regex
 * (with the flags after the closing slash — /foo/i, /foo/gi).
 *
 * Returns { hits, capped, filesScanned }.
 */
export function search(root, query) {
  const raw = String(query || '')
  if (!raw) return { hits: [], capped: false, filesScanned: 0 }
  const re = compileQuery(raw)
  const files = fuzzyCollect(root)
  const hits = []
  let filesScanned = 0
  let capped = false
  for (const relPath of files) {
    if (hits.length >= MAX_HITS) { capped = true; break }
    const full = join(root, relPath)
    let src
    try { src = readFileSync(full) } catch { continue }
    if (isBinary(src)) continue
    const text = src.toString('utf-8')
    filesScanned++
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (hits.length >= MAX_HITS) { capped = true; break }
      const line = lines[i]
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        hits.push({
          path: relPath,
          line: i + 1,
          col: m.index + 1,
          match: m[0],
          preview: truncate(line, MAX_LINE),
        })
        if (hits.length >= MAX_HITS) { capped = true; break }
        if (!re.global) break
        if (m[0].length === 0) re.lastIndex++
      }
    }
  }
  return { hits, capped, filesScanned }
}

function compileQuery(q) {
  // /pattern/flags — a regex
  const m = q.match(/^\/(.+)\/([gimsuy]*)$/)
  if (m) {
    let flags = m[2]
    if (!flags.includes('g')) flags += 'g'
    if (!flags.includes('i')) flags += 'i'  // default case-insensitive
    try { return new RegExp(m[1], flags) } catch {
      return new RegExp(escapeRegex(q), 'gi')
    }
  }
  return new RegExp(escapeRegex(q), 'gi')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isBinary(buf) {
  const n = Math.min(512, buf.length)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

function truncate(s, w) {
  return s.length <= w ? s : s.slice(0, w - 1) + '…'
}

/**
 * Open a global-search modal state.
 */
export function openGlobalSearch(root) {
  return {
    kind: 'global-search',
    root,
    query: '',
    selected: 0,
    hits: [],
    capped: false,
    filesScanned: 0,
    lastQuery: null,
    // Search-on-Enter, not per-keystroke (grep is O(filesize))
    runSearch() {
      const r = search(this.root, this.query)
      this.hits = r.hits
      this.capped = r.capped
      this.filesScanned = r.filesScanned
      this.lastQuery = this.query
      this.selected = 0
    },
  }
}
