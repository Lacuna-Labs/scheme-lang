// reference-loader.js — parses the Sakura Scheme reference SLAT file.
//
// Reads docs/SAKURA-SCHEME-REFERENCE.slat, a Scheme-shaped catalogue of
// 1,157 verbs + 70 core language forms, and returns a structured JS
// object the REPL uses to (a) register stubs for verbs with no JS impl,
// (b) power `,help <verb>` with the full explanation/examples/caveats,
// (c) drive the auto-generated test suite.
//
// The reference IS the language. Every verb's contract lives here.
//
// Doctrine: parse once at boot, cache in-memory. The file is ~600KB so
// parsing costs ~75ms — small enough that we don't lazy-load; large
// enough that we don't re-parse per query.
//
// The SLAT reads through `src/reader.js` — same reader as Scheme code,
// because SLAT syntactically IS Scheme. Keyword-shaped tokens (`:name`)
// arrive as regular Syms.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from './reader.js'
import { Sym } from './reader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REF_PATH = join(__dirname, '..', 'docs', 'SAKURA-SCHEME-REFERENCE.slat')

// ── module-level cache ──────────────────────────────────────────────
let CACHE = null

// ── helpers ─────────────────────────────────────────────────────────

// A form like `(verb :name "x" :library "y" ...)` reads as an array of
// alternating [Sym(':name'), "x", Sym(':library'), "y", ...] pairs after
// the leading head Sym. Convert that to a plain JS object keyed by the
// bare keyword name (":name" → "name").
function keywordArrayToObject(items) {
  const obj = {}
  for (let i = 0; i < items.length; i++) {
    const k = items[i]
    if (!(k instanceof Sym)) continue
    const name = k.name.startsWith(':') ? k.name.slice(1) : k.name
    const val = items[i + 1]
    obj[name] = normalizeValue(val)
    i++ // skip the value we just consumed
  }
  return obj
}

// Convert reader-produced values into plain JS shapes:
//   Sym → string
//   Array-of-keyword-pairs → object (if it looks like one)
//   Array-of-arrays → recurse
//   scalars → as-is
function normalizeValue(v) {
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) {
    // Does this array look like a keyword-tagged property bag?
    // Heuristic: first element is a Sym starting with ':' AND at least
    // half the even-indexed slots are Syms with ':'.
    if (v.length >= 2 && v[0] instanceof Sym && v[0].name.startsWith(':')) {
      let kwCount = 0
      let kwTotal = 0
      for (let i = 0; i < v.length; i += 2) {
        kwTotal++
        if (v[i] instanceof Sym && v[i].name.startsWith(':')) kwCount++
      }
      if (kwCount === kwTotal) {
        // Full keyword-tagged bag → object.
        return keywordArrayToObject(v)
      }
    }
    return v.map(normalizeValue)
  }
  return v
}

// Parse a single `(verb ...)` or `(core-form ...)` form into a JS object.
function readEntry(form) {
  if (!Array.isArray(form) || form.length === 0) return null
  const head = form[0]
  if (!(head instanceof Sym)) return null
  const kind = head.name
  const body = form.slice(1)
  const obj = keywordArrayToObject(body)
  obj._kind = kind // 'verb' | 'core-form' | 'reference'
  return obj
}

// ── examples helpers ────────────────────────────────────────────────

// Examples in a verb entry look like:
//   :examples ( (:tier "novice" :code "..." :note "...")
//               (:tier "intermediate" :code "..." :note "...")
//               (:tier "expert"       :code "..." :note "...") )
// After normalization they become an array of objects
// `[{tier, code, note}, ...]`. But if the shape sneaks past
// normalizeValue's heuristic (rare), coerce here.
function normalizeExamples(examples) {
  if (!Array.isArray(examples)) return []
  return examples.map((ex) => {
    if (ex && typeof ex === 'object' && !Array.isArray(ex)) return ex
    if (Array.isArray(ex)) return keywordArrayToObject(ex)
    return null
  }).filter(Boolean)
}

// ── main loader ─────────────────────────────────────────────────────

/**
 * loadReference({ path? }) — parse the SLAT reference and return
 *   { verbs: Map<name, verbEntry>,
 *     coreForms: Map<name, coreEntry>,
 *     verbList: verbEntry[],
 *     coreList: coreEntry[],
 *     meta: { name, version, verbCount, coreFormCount, consolidatedAt } }
 *
 * verbEntry: {
 *   name, library, kind, signature, summary, explanation,
 *   examples: [{tier, code, note}], caveats: [], drawbacks: [],
 *   usecases: [], related: [], learn: {concept, prerequisites, progression}
 * }
 *
 * Cached — subsequent calls return the same instance.
 */
export function loadReference({ path, forceReload = false } = {}) {
  if (CACHE && !forceReload && !path) return CACHE
  const src = readFileSync(path || DEFAULT_REF_PATH, 'utf-8')
  const forms = parse(src)

  const verbs = new Map()
  const coreForms = new Map()
  const verbList = []
  const coreList = []
  let meta = { name: 'sakura-scheme', version: 'unknown', verbCount: 0, coreFormCount: 0, consolidatedAt: null }

  for (const form of forms) {
    const entry = readEntry(form)
    if (!entry) continue
    if (entry._kind === 'reference') {
      meta = {
        name: entry.name || meta.name,
        version: entry.version || meta.version,
        verbCount: entry['verb-count'] || meta.verbCount,
        coreFormCount: entry['core-form-count'] || meta.coreFormCount,
        consolidatedAt: entry['consolidated-at'] || meta.consolidatedAt,
      }
    } else if (entry._kind === 'verb') {
      if (Array.isArray(entry.examples)) entry.examples = normalizeExamples(entry.examples)
      if (entry.name) {
        verbs.set(entry.name, entry)
        verbList.push(entry)
      }
    } else if (entry._kind === 'core-form') {
      if (entry.name) {
        coreForms.set(entry.name, entry)
        coreList.push(entry)
      }
    }
  }

  CACHE = { verbs, coreForms, verbList, coreList, meta }
  return CACHE
}

/**
 * Get a single verb's entry by name. Returns null if not in the reference.
 */
export function getVerbEntry(name) {
  const ref = loadReference()
  return ref.verbs.get(name) || null
}

/**
 * Get a single core-form entry by name.
 */
export function getCoreFormEntry(name) {
  const ref = loadReference()
  return ref.coreForms.get(name) || null
}

/**
 * All verb entries as an array (stable order — the SLAT file order).
 */
export function allVerbEntries() {
  return loadReference().verbList
}

/**
 * Reference metadata (name, version, counts, generation timestamp).
 */
export function referenceMeta() {
  return loadReference().meta
}

/**
 * Clear the in-memory cache. Test seam.
 */
export function clearReferenceCache() {
  CACHE = null
}
