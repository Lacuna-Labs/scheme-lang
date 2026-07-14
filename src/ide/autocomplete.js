// autocomplete.js — the verb completion index.
//
// Built once at IDE boot from the env + the reference SLAT. Supplies
// fuzzy match + a small "contract line" for the completion popup, and
// full hover info (signature + summary + first novice example) when the
// UI has room for it.
//
// Also produces "wired coverage" — a percentage of verbs in the SLAT
// that are actually bound to real (non-stub) implementations in the env.
// This is what the status bar shows.

import { loadReference } from '../reference-loader.js'
import { SNIPPETS } from './snippets.js'

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

  // Compute wired coverage — for each verb in the reference, is it
  // bound to a non-stub implementation?
  let wired = 0
  let stubbed = 0
  let unknown = 0
  for (const v of ref.verbList) {
    const val = env.vars.get(v.name)
    if (typeof val === 'function') {
      if (val._sakuraStub) stubbed++
      else wired++
    } else if (val !== undefined) {
      wired++  // e.g. const/pi is a bound number
    } else {
      unknown++
    }
  }
  const coverage = ref.verbList.length > 0
    ? Math.round(100 * wired / ref.verbList.length)
    : 100

  const firstExample = (meta) => {
    if (!meta || !Array.isArray(meta.examples)) return null
    for (const ex of meta.examples) {
      if (ex && ex.code) return { code: ex.code, note: ex.note || '' }
    }
    return null
  }

  return {
    names,
    size: names.length,
    coverage,
    counts: { total: ref.verbList.length, wired, stubbed, unknown, env: env.vars.size },
    // Return meta for a single verb (used for hover + first-example)
    lookup(name) {
      const meta = refIndex.get(name)
      if (!meta) return null
      return {
        name,
        sig: meta.signature || null,
        kind: meta.kind || null,
        summary: meta.summary || null,
        example: firstExample(meta),
        library: meta.library || null,
      }
    },
    match(prefix) {
      if (!prefix) return []
      const p = prefix.toLowerCase()
      const out = []
      // Snippets first — they're rare and share the popup
      for (const s of SNIPPETS) {
        if (s.trigger.toLowerCase().startsWith(p)) {
          out.push({
            name: s.trigger,
            sig: `[snippet] ${s.label}`,
            kind: 'snippet',
            summary: s.label,
            snippet: s,
            score: 120,
          })
        }
      }
      for (const name of names) {
        const l = name.toLowerCase()
        if (l.startsWith(p)) {
          const meta = refIndex.get(name)
          out.push({
            name,
            sig: meta?.signature || null,
            kind: meta?.kind || null,
            summary: meta?.summary || null,
            example: firstExample(meta),
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
              example: firstExample(meta),
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
