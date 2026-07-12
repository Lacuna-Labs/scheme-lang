// complete.js — fuzzy tab completion for the REPL input line.
//
// Given the buffer + cursor position, extract the current "token" (the
// symbol under the cursor) and return a ranked list of completions drawn
// from the live env, verb registry, and meta-command list. Fuzzy — a
// subsequence match with distance-scaled scoring, so `crv` matches `cadr`
// via c-a-d-r → c-(skip)-r matches only 'c','r' → no.  A better example:
// `mp` → `map`. `filt` → `filter`. `cadr` → `cadr` (exact wins).
//
// Ranking (higher is better):
//   * exact match: 1000
//   * prefix match: 500 - (len(candidate) - len(query))
//   * subsequence: 100 - (candidate_len - query_len) - avg_gap
//   * substring (any position): 50 - position
//   * everything else: 0 (filtered out)
//
// The prefix bonus keeps `car` above `cadr` above `caddr` when the user
// types 'ca'. The exact-match dominates so a full name never gets shoved
// down by a shorter fuzzy hit.

/**
 * fuzzyScore(query, candidate) → number
 *
 * All-lowercase comparison. Returns 0 if candidate cannot match query
 * as a subsequence.
 */
export function fuzzyScore(query, candidate) {
  if (!query) return 1  // empty query matches everything at the floor
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  if (q === c) return 1000
  if (c.startsWith(q)) return 500 - (c.length - q.length)
  // Substring — anywhere.
  const idx = c.indexOf(q)
  if (idx >= 0) return 200 - idx - (c.length - q.length) * 0.5
  // Subsequence — every char of q appears in c in order.
  let qi = 0
  let lastMatch = -1
  let gaps = 0
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      if (lastMatch >= 0) gaps += ci - lastMatch - 1
      lastMatch = ci
      qi++
    }
  }
  if (qi < q.length) return 0
  const gapPenalty = gaps * 0.5
  const lenPenalty = (c.length - q.length) * 0.25
  return 100 - gapPenalty - lenPenalty
}

/**
 * currentToken(buffer, cursor) → { start, end, text }
 *
 * Walk backwards from cursor while chars look symbol-y. Return the token
 * span so the completion can replace it in place.
 */
export function currentToken(buffer, cursor) {
  const symChar = (c) => c && /[^\s()[\]"';`,]/.test(c)
  let s = cursor
  while (s > 0 && symChar(buffer[s - 1])) s--
  let e = cursor
  while (e < buffer.length && symChar(buffer[e])) e++
  return { start: s, end: e, text: buffer.slice(s, e) }
}

/**
 * completeSymbol(query, sources) → ranked list of candidates
 *
 * `sources` is `{ names: Iterable<string>, meta?: (name) => any }`
 * where `meta(name)` optionally returns the associated verb metadata
 * (used for tie-break — verbs with docstrings rank slightly higher).
 */
export function completeSymbol(query, sources, { limit = 20 } = {}) {
  const seen = new Map()
  for (const name of sources.names) {
    if (seen.has(name)) continue
    const score = fuzzyScore(query, name)
    if (score > 0) seen.set(name, score)
  }
  const ranked = [...seen.entries()]
    .sort((a, b) => {
      // Tie-break: shorter names win; then alphabetical.
      if (b[1] !== a[1]) return b[1] - a[1]
      if (a[0].length !== b[0].length) return a[0].length - b[0].length
      return a[0] < b[0] ? -1 : 1
    })
    .slice(0, limit)
  return ranked.map(([name, score]) => ({ name, score }))
}

/**
 * commonPrefix(candidates) → string
 *
 * The longest shared prefix across all candidates. Used to advance the
 * buffer on Tab when multiple candidates share a prefix beyond the
 * current query.
 */
export function commonPrefix(candidates) {
  if (candidates.length === 0) return ''
  if (candidates.length === 1) return candidates[0]
  let p = candidates[0]
  for (let i = 1; i < candidates.length && p; i++) {
    const c = candidates[i]
    let j = 0
    while (j < p.length && j < c.length && p[j] === c[j]) j++
    p = p.slice(0, j)
  }
  return p
}
