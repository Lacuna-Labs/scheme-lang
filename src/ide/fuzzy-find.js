// fuzzy-find.js — Ctrl-P style file finder.
//
// Walks the project tree (rooted at state.tree.cwd) up to a depth
// cap and file-count cap, then applies fuzzy subsequence matching to
// the user's query. Returns ranked hits.
//
// Caps:
//   MAX_DEPTH  4   — avoid runaway recursion in monorepos
//   MAX_FILES  5000 — big enough for the sakura-scheme repo (~300 files)
//                     and every reasonable scheme project.
//   SKIP_DIRS  node_modules, .git, dist, build, .cache — hard-coded
//                     because we don't have a .gitignore parser yet.

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const MAX_DEPTH = 4
const MAX_FILES = 5000
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache',
  '.next', '.nuxt', 'out', 'coverage', '.venv', '__pycache__',
])

/**
 * Walk `root` and return every file's relative path.
 */
export function collectFiles(root) {
  const out = []
  walk(root, root, 0, out)
  return out
}

function walk(root, dir, depth, out) {
  if (depth > MAX_DEPTH) return
  if (out.length >= MAX_FILES) return
  let names
  try { names = readdirSync(dir) } catch { return }
  for (const name of names) {
    if (name.startsWith('.') && name !== '.slat') continue  // hide dotfiles
    if (SKIP_DIRS.has(name)) continue
    if (out.length >= MAX_FILES) return
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      walk(root, full, depth + 1, out)
    } else if (st.isFile()) {
      out.push(relative(root, full))
    }
  }
}

/**
 * Fuzzy subsequence score. Higher = better. 0 = no match.
 *
 * Rules:
 *   · every char of query must appear in order in the candidate
 *   · a run of consecutive matches boosts score heavily (quadratic)
 *   · matches at start-of-segment (after / or _ or -) boost score
 *   · case-insensitive
 *   · shorter candidates win ties
 *
 * The consecutive-run bonus is more important than segment-start
 * bonuses so 'cir' in 'circle.js' beats 'cir' as 'c'lean-'i'mages-
 * 'r'adicals.js (three isolated segment starts).
 */
export function fuzzyScore(query, candidate) {
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  if (!q) return 0
  let qi = 0
  let score = 0
  let run = 0
  let lastMatch = -2
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      // consecutive? quadratic bonus favors long runs
      if (ci === lastMatch + 1) { run++; score += 15 + 10 * run }
      else { run = 1; score += 10 }
      // segment start?
      const prev = c[ci - 1]
      if (ci === 0 || prev === '/' || prev === '_' || prev === '-' || prev === '.') score += 15
      lastMatch = ci
      qi++
    }
  }
  if (qi < q.length) return 0   // not all query chars found in order
  // Big bonus if the entire query matched as a single contiguous run
  if (run === q.length) score += 40
  // Penalty for long candidate (slight)
  score -= Math.floor(c.length / 20)
  return score
}

/**
 * Match query against file list. Returns array of { path, score }
 * sorted best-first, capped at 30.
 */
export function matchFiles(files, query) {
  if (!query) return files.slice(0, 30).map(p => ({ path: p, score: 0 }))
  const scored = []
  for (const p of files) {
    const s = fuzzyScore(query, p)
    if (s > 0) scored.push({ path: p, score: s })
  }
  scored.sort((a, b) => b.score - a.score || a.path.length - b.path.length)
  return scored.slice(0, 30)
}

/**
 * Open the fuzzy finder modal state.
 */
export function openFuzzyFinder(root) {
  return {
    kind: 'fuzzy-file-finder',
    root,
    query: '',
    selected: 0,
    files: collectFiles(root),
    matches: [],
    refresh() { this.matches = matchFiles(this.files, this.query) },
  }
}
