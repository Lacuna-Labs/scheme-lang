// session.js — session save + full replay for `,save` / `,load`.
//
// Save captures:
//   • every `(define …)` and `(define-syntax …)` issued this session,
//     in the order they were issued, so replay produces the same bindings
//   • the full history array (line + result rendering)
//   • the named results `_` through `_9` — as literal Scheme values
//
// Load re-executes the defines against the current env (confirming
// per-name if a name is already bound, unless `--yes-all`), restores the
// history, and rebinds the named results.
//
// The on-disk format is SLAT-lite: comment header, then blank-line
// separated sections. Every section is machine + human legible.
//
//   #slat scheme-lang-session 2
//   ;; session recorded 2026-07-12T12:34:56Z
//
//   ## defines
//   (define x 10)
//   (define (double y) (* y 2))
//
//   ## history
//   ;; each line is one input, base64 to survive newlines
//   KGRlZmluZSB4IDEwKQ==
//   KGRvdWJsZSB4KQ==
//
//   ## results
//   0 := 10
//   1 := 20
//
// We chose blank-line-plus-heading over JSON because a SLAT is meant to
// be readable + hand-editable. If a load fails partway, the caller sees
// exactly where.

import { writeFileSync, readFileSync } from 'node:fs'
import { parse, Sym } from '../reader.js'
import { expandProgram } from '../macro.js'
import { evaluate } from '../interp.js'
import { schemeFormat } from './richDisplay.js'
import { role } from './palette.js'

/**
 * Record a top-level input on the ctx. Called by repl.js after every
 * successful line evaluation (before we discard the source). This is
 * the ONLY way session tracking gets defines — we don't inspect env
 * afterwards because we can't distinguish user defines from built-ins
 * without a snapshot at REPL start.
 */
export function recordSessionLine(ctx, line, result) {
  ctx.sessionLines = ctx.sessionLines || []
  ctx.sessionLines.push(line)
  ctx.sessionResults = ctx.sessionResults || []
  ctx.sessionResults.push(result)
  if (ctx.sessionResults.length > 100) ctx.sessionResults.shift()
  if (ctx.sessionLines.length > 500) ctx.sessionLines.shift()
}

/**
 * Extract every top-level define / define-syntax expression from the
 * recorded lines. We re-parse each line and only keep the ones whose
 * head is a defining form. Order preserved.
 */
export function extractDefines(lines) {
  const out = []
  for (const l of lines || []) {
    let forms
    try { forms = parse(l) } catch { continue }
    for (const f of forms) {
      if (Array.isArray(f) && f[0] instanceof Sym &&
          (f[0].name === 'define' || f[0].name === 'define-syntax')) {
        out.push(schemeFormat(f))
      }
    }
  }
  return out
}

/**
 * saveSession(ctx, path) → { ok, message }.
 */
export function saveSession(ctx, path) {
  const defines = extractDefines(ctx.sessionLines || [])
  const historyBase64 = (ctx.sessionLines || []).map(l => Buffer.from(l, 'utf-8').toString('base64'))
  const results = (ctx.results && ctx.results.list) || []

  const lines = []
  lines.push('#slat scheme-lang-session 2')
  lines.push(`;; session recorded ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## defines')
  for (const d of defines) lines.push(d)
  if (defines.length === 0) lines.push(';; (none)')
  lines.push('')
  lines.push('## history')
  for (const h of historyBase64) lines.push(h)
  if (historyBase64.length === 0) lines.push(';; (none)')
  lines.push('')
  lines.push('## results')
  results.forEach((v, i) => {
    lines.push(`${i} := ${schemeFormat(v)}`)
  })
  if (results.length === 0) lines.push(';; (none)')
  lines.push('')

  try {
    writeFileSync(path, lines.join('\n'), 'utf-8')
    return { ok: true, message: `saved ${defines.length} define(s), ${historyBase64.length} line(s), ${results.length} result(s) → ${path}` }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}

/**
 * loadSession(ctx, path, opts) → { ok, message, counts }.
 *
 * Executes each define against ctx.env, confirming (via ctx.confirm) if
 * a name is already bound unless opts.yesAll. Restores history. Restores
 * named results.
 */
export function loadSession(ctx, path, opts = {}) {
  let raw
  try { raw = readFileSync(path, 'utf-8') } catch (e) {
    return { ok: false, message: e.message }
  }
  const parsed = parseSlatSession(raw)
  if (!parsed.ok) return parsed

  const yesAll = !!opts.yesAll

  // 1) Execute defines.
  let ranDefines = 0, skipped = 0, errors = 0
  for (const src of parsed.defines) {
    let forms
    try { forms = parse(src) } catch (e) { errors++; continue }
    let expanded
    try { expanded = expandProgram(forms).forms } catch (e) { errors++; continue }
    for (const f of expanded) {
      const name = defineNameOf(f)
      if (name && envHas(ctx.env, name) && !yesAll) {
        if (!ctx.confirm || !ctx.confirm(`overwrite ${name}? (--yes-all to skip)`)) {
          skipped++
          continue
        }
      }
      try { evaluate(f, ctx.env, ctx.fuel); ranDefines++ } catch (e) { errors++ }
    }
  }

  // 2) Restore history array.
  ctx.history = ctx.history || null
  if (ctx.history && ctx.history.add) {
    for (const h of parsed.history) {
      ctx.history.add(h)
    }
  }
  // Also restore into sessionLines so a subsequent `,save` round-trips.
  ctx.sessionLines = ctx.sessionLines || []
  for (const h of parsed.history) ctx.sessionLines.push(h)

  // 3) Restore named results.
  ctx.results = ctx.results || { last: undefined, list: [] }
  for (const v of parsed.results) ctx.results.list.push(v)
  if (ctx.results.list.length > 20) ctx.results.list = ctx.results.list.slice(-20)
  ctx.results.last = ctx.results.list[ctx.results.list.length - 1]
  if (typeof ctx.rebindResults === 'function') ctx.rebindResults()

  return {
    ok: true,
    counts: { defines: ranDefines, skipped, errors, history: parsed.history.length, results: parsed.results.length },
    message: `loaded ${ranDefines} define(s) (${skipped} skipped, ${errors} errored), ${parsed.history.length} history line(s), ${parsed.results.length} result(s)`,
  }
}

// ── SLAT parsing ─────────────────────────────────────────────────────

function parseSlatSession(raw) {
  const lines = raw.split('\n')
  if (!lines[0] || !lines[0].startsWith('#slat scheme-lang-session')) {
    return { ok: false, message: 'not a scheme-lang session SLAT (bad header)' }
  }
  let section = null
  const defines = []
  const history = []
  const results = []
  for (const line of lines.slice(1)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('##')) {
      section = trimmed.slice(2).trim()
      continue
    }
    if (!trimmed) continue
    if (trimmed.startsWith(';;')) continue
    if (section === 'defines') defines.push(line)
    else if (section === 'history') {
      try { history.push(Buffer.from(trimmed, 'base64').toString('utf-8')) }
      catch { /* skip bad line */ }
    }
    else if (section === 'results') {
      const m = trimmed.match(/^(\d+)\s*:=\s*(.*)$/)
      if (m) {
        try {
          const forms = parse(m[2])
          results.push(forms.length ? evaluateLiteral(forms[0]) : undefined)
        } catch {
          results.push(undefined)
        }
      }
    }
  }
  return { ok: true, defines, history, results }
}

// evaluateLiteral: turn a parsed form back into a JS value WITHOUT running
// it in the interpreter. Handles the value shapes richDisplay uses:
// numbers, strings, booleans, `()`, arrays, symbols. Everything else
// falls through to the form itself.
function evaluateLiteral(form) {
  if (form === null || form === undefined) return form
  if (typeof form === 'number' || typeof form === 'boolean' || typeof form === 'string') return form
  if (form instanceof Sym) {
    // A bare symbol re-read as literal — treat as its name.
    if (form.name === '#t') return true
    if (form.name === '#f') return false
    return form
  }
  if (Array.isArray(form)) {
    // If it's a (quote x) form, unwrap.
    if (form.length === 2 && form[0] instanceof Sym && form[0].name === 'quote') {
      return evaluateLiteral(form[1])
    }
    return form.map(evaluateLiteral)
  }
  return form
}

function defineNameOf(form) {
  if (!Array.isArray(form)) return null
  if (!(form[0] instanceof Sym)) return null
  if (form[0].name !== 'define' && form[0].name !== 'define-syntax') return null
  if (Array.isArray(form[1])) return form[1][0]?.name || null
  return form[1]?.name || null
}

function envHas(env, name) {
  let e = env
  while (e) {
    if (e.vars && e.vars.has && e.vars.has(name)) return true
    e = e.parent
  }
  return false
}
