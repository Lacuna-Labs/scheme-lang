// autocomplete.js — the verb completion index.
//
// Built once at IDE boot from the env + the reference SLAT. Supplies
// fuzzy match + a small "contract line" for the completion popup.

import { loadReference } from '../reference-loader.js'

export function verbCompletions(env) {
  const ref = loadReference()
  // Build combined name list from env + reference.
  const seen = new Set()
  const names = []
  for (const name of env.vars.keys()) {
    if (seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  for (const v of ref.verbList) {
    if (seen.has(v.name)) continue
    seen.add(v.name)
    names.push(v.name)
  }
  const refIndex = new Map()
  for (const v of ref.verbList) refIndex.set(v.name, v)

  return {
    names,
    size: names.length,
    match(prefix) {
      if (!prefix) return []
      const p = prefix.toLowerCase()
      const out = []
      for (const name of names) {
        const l = name.toLowerCase()
        if (l.startsWith(p)) {
          const meta = refIndex.get(name)
          out.push({
            name,
            sig: meta?.signature || null,
            kind: meta?.kind || null,
            summary: meta?.summary || null,
            score: 100 - (l.length - p.length),
          })
        }
      }
      // Also add substring-match with a lower score
      if (out.length < 20) {
        for (const name of names) {
          const l = name.toLowerCase()
          if (l.startsWith(p)) continue
          if (l.includes(p)) {
            const meta = refIndex.get(name)
            out.push({
              name,
              sig: meta?.signature || null,
              kind: meta?.kind || null,
              summary: meta?.summary || null,
              score: 50,
            })
          }
        }
      }
      out.sort((a, b) => b.score - a.score || a.name.length - b.name.length)
      return out.slice(0, 30)
    },
  }
}
