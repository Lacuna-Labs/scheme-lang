// typo-suggest.js — did-you-mean suggestions for unknown verbs.
//
// When the interpreter throws "undefined identifier 'cricle'", the IDE
// asks this module for the closest few verb names. We show up to 3.
//
// Algorithm: normalized-Damerau-Levenshtein distance against every verb
// in the completion index. Under 2 edits = strong candidate, under 3 =
// weak. We also boost matches that share a namespace prefix (before the
// first '/') and demote matches that don't.

/**
 * Compute Damerau-Levenshtein distance (with adjacent transposition).
 * Both strings are lowercased before comparison.
 */
export function editDistance(a, b) {
  const s = String(a).toLowerCase()
  const t = String(b).toLowerCase()
  const m = s.length, n = t.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = new Array(m + 1)
  for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1)
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
      if (i > 1 && j > 1 &&
          s[i - 1] === t[j - 2] &&
          s[i - 2] === t[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1) // transposition
      }
    }
  }
  return dp[m][n]
}

/**
 * Suggest up to `k` closest verbs to `bad`.
 *
 * verbs: array of {name, sig?, summary?} — the same shape verbCompletions()
 *        produces. If a plain string[] is passed we accept that too.
 */
export function suggestVerbs(bad, verbs, k = 3) {
  if (!bad) return []
  const badName = String(bad)
  const badNs = badName.includes('/') ? badName.split('/')[0] : null

  const cands = []
  for (const v of verbs) {
    const name = typeof v === 'string' ? v : (v && v.name)
    if (!name || name === badName) continue
    let d = editDistance(badName, name)
    // Namespace prefix boost — cricle vs geom/circle both share nothing;
    // but circle vs cirlce would.
    const ns = name.includes('/') ? name.split('/')[0] : null
    if (badNs && ns && badNs === ns) d -= 1
    // Length-difference penalty — avoids "x" suggesting "extremely-long-name"
    d += Math.abs(name.length - badName.length) * 0.1
    // Substring boost — if the bad name is contained
    if (name.toLowerCase().includes(badName.toLowerCase())) d -= 0.5
    // Absolute reject threshold — half the length of the bad name, min 2
    const cutoff = Math.max(2, Math.floor(badName.length / 2))
    if (d <= cutoff) cands.push({ name, d })
  }
  cands.sort((a, b) => a.d - b.d)
  return cands.slice(0, k).map(c => c.name)
}

/**
 * Format an error message with suggestions.
 * e.g. "unknown verb 'cricle' — did you mean: circle, curve/circle, geom/circle?"
 *
 * Returns the original message if we can't extract an identifier or find
 * a close match.
 */
export function decorateError(errMsg, verbs) {
  const m = String(errMsg || '').match(/undefined (?:identifier|variable|verb)[:\s]+['"]?([a-zA-Z0-9!?<>=+\-*/_%^&:.]+)['"]?/i)
  if (!m) return errMsg
  const bad = m[1]
  const sugs = suggestVerbs(bad, verbs, 3)
  if (sugs.length === 0) return errMsg
  return `${errMsg} — did you mean: ${sugs.join(', ')}?`
}
