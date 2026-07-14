#!/usr/bin/env node
// convention-sweep.mjs — one-shot audit of docs/SAKURA-SCHEME-REFERENCE.slat
// against R7RS-small conventions. Writes findings to
// docs/reports/convention-sweep-2026-07-14.slat.
//
// Dispatched 2026-07-14 by Alfred. Sees, doesn't touch.
//
// Doctrine: Sakura Scheme IS Scheme (R7RS-small flavored). Where we
// deviate, log it. Adjustments happen in a later lane.

import { readFileSync, writeFileSync } from 'node:fs'
import { allVerbEntries } from '../src/reference-loader.js'

const REPORT_PATH = new URL('../docs/reports/convention-sweep-2026-07-14.slat', import.meta.url).pathname
const REFERENCE_PATH = new URL('../docs/SAKURA-SCHEME-REFERENCE.slat', import.meta.url).pathname

// ── build a line-index of verb entries for :location back-refs ─────
const refText = readFileSync(REFERENCE_PATH, 'utf-8')
const refLines = refText.split('\n')
const verbLineByName = new Map()
{
  const nameRe = /:name\s+"([^"]+)"/
  for (let i = 0; i < refLines.length; i++) {
    if (/^\(verb\b/.test(refLines[i])) {
      for (let j = i; j < Math.min(i + 3, refLines.length); j++) {
        const m = nameRe.exec(refLines[j])
        if (m) {
          if (!verbLineByName.has(m[1])) verbLineByName.set(m[1], i + 1)
          break
        }
      }
    }
  }
}

function locFor(name) {
  const ln = verbLineByName.get(name) || 0
  return `docs/SAKURA-SCHEME-REFERENCE.slat:${ln}`
}

// ── pattern detectors ──────────────────────────────────────────────
function joinCode(v) {
  return (v.examples || []).map((e) => e.code || '').join('\n---\n')
}
function firstMatch(text, re) {
  const m = re.exec(text)
  return m ? m[0] : null
}

// 1. Keyword-arg syntax :key value in call position (decision-001)
function detectKeywordArgSyntax(v) {
  const sig = v.signature || ''
  const code = joinCode(v)
  const findings = []

  const sigHasBracketKw = /\[:[a-z][-a-z0-9?!]*/i.test(sig)
  const sigHasBareKw = /\s:[a-z][-a-z0-9?!]*\s+[a-z\'\(\[]/i.test(sig)

  const kwCallHits = []
  const kwRe = /(\s|\()(:[a-z][-a-z0-9?!]*)\s+([^\s)])/gi
  let m
  while ((m = kwRe.exec(code)) != null) {
    const before = code.slice(Math.max(0, m.index - 6), m.index + 1)
    if (before.endsWith('{')) continue
    if (before.endsWith("'(")) continue
    kwCallHits.push(m[2])
  }

  if (sigHasBracketKw || sigHasBareKw || kwCallHits.length > 0) {
    const argCount = ((sig.match(/[a-z][-a-z0-9?!]*/gi) || []).length)
    const positional = argCount <= 6
    findings.push({
      patternKind: 'keyword-arg-syntax',
      example: (sigHasBracketKw || sigHasBareKw) ? sig : `example uses ${kwCallHits.slice(0, 3).join(', ')}`,
      severity: 'high',
      proposedFix: positional
        ? 'positional args (<= 5 params); reorder signature so required args come first, optional last'
        : 'property-list: pass options as a single alist last arg — (list (cons \'key val) ...)',
      alternative: positional
        ? 'property-list: pass options as (list (cons \'key val) ...)'
        : 'thunk-and-set!: split into a builder verb + one setter per option',
      recommendation: positional ? 'positional (<=5 args)' : 'property-list (>5 args)',
      requiresDecisionEntry: false,
      decisionRef: '001',
    })
  }
  return findings
}

// 2. Polymorphic (get x 'field) (decision-002)
function detectPolymorphicGet(v) {
  const code = joinCode(v)
  const re = /\(get\s+[^\s()]+\s+['"][^)]+/g
  const hits = code.match(re)
  if (!hits) return []
  return [{
    patternKind: 'get-verb',
    example: hits[0],
    severity: 'high',
    proposedFix: 'shape-specific accessor: (hash-ref h k) | (assq k alist) | (vector-ref v i) | (record-accessor v)',
    alternative: 'if x can be any shape, wrap in a helper the caller names for their data (still shape-specific inside)',
    recommendation: 'shape-specific accessor',
    requiresDecisionEntry: false,
    decisionRef: '002',
    note: `${hits.length} occurrence(s)`,
  }]
}

// 3. Non-R7RS list primitives — first, rest, last, second, third; SRFI-1 filter, find
function detectNonR7rsListPrimitives(v) {
  const code = joinCode(v)
  const primitives = {
    first: 'car',
    second: 'cadr',
    third: 'caddr',
    rest: 'cdr',
    last: '(car (list-tail lst (- (length lst) 1)))',
    filter: 'SRFI-1 filter (adopt with decision entry) or manual (fold cons)',
    find: 'SRFI-1 find (adopt with decision entry) or manual member+predicate',
  }
  const findings = []
  for (const [name, r7rs] of Object.entries(primitives)) {
    // Only match (name followed by whitespace — not (name-thing or (name?)
    const re = new RegExp(`\\(${name}(?=\\s)\\s+[^)]`, 'g')
    const hits = code.match(re)
    if (!hits) continue
    const isSrfi1 = name === 'filter' || name === 'find'
    findings.push({
      patternKind: isSrfi1 ? 'srfi-1-primitive' : 'non-r7rs-primitive',
      example: hits[0],
      severity: isSrfi1 ? 'low' : 'medium',
      proposedFix: isSrfi1
        ? `adopt SRFI-1 explicitly (new decision entry) OR replace: ${r7rs}`
        : `replace with R7RS-small: ${r7rs}`,
      alternative: isSrfi1
        ? 'inline the loop; SRFI-1 becomes a hard dependency if we do not bundle it'
        : `keep as Sakura extension (log new decision entry); document as sugar for ${r7rs}`,
      recommendation: isSrfi1 ? 'adopt SRFI-1 with decision-entry' : `rewrite to ${r7rs}`,
      requiresDecisionEntry: isSrfi1,
      note: `verb=${name}, ${hits.length} occurrence(s)`,
    })
  }
  return findings
}

// 4. Clojure map literal { :k v :k v }
function detectClojureMapLit(v) {
  const code = joinCode(v)
  const hits = code.match(/\{:[a-z][^}]*\}/gi)
  if (!hits) return []
  return [{
    patternKind: 'clojure-map-literal',
    example: hits[0],
    severity: 'high',
    proposedFix: '(list (cons \'k v) (cons \'k v) ...) as alist OR (make-hash-table) + (hash-set!) — per decision-009',
    alternative: 'SRFI-146 imm-map — not adopted; adds surface',
    recommendation: 'alist for small; hash-table (SRFI-69) for large — decision-009',
    requiresDecisionEntry: false,
    note: `${hits.length} map literal(s) in examples`,
  }]
}

// 5. Racket #:keyword syntax
function detectRacketKeyword(v) {
  const code = joinCode(v)
  const hits = code.match(/#:[a-z][-a-z0-9?!]*/gi)
  if (!hits) return []
  return [{
    patternKind: 'racket-keyword-syntax',
    example: hits[0],
    severity: 'high',
    proposedFix: 'same fix as keyword-arg-syntax: positional or property-list (decision-001)',
    alternative: 'none — #:kw is Racket-only, not portable',
    recommendation: 'positional (<=5) or property-list (>5)',
    requiresDecisionEntry: false,
    decisionRef: '001',
    note: hits.slice(0, 4).join(', '),
  }]
}

// 6. Racket-style match with [pattern body]
function detectMatchForm(v) {
  const code = joinCode(v)
  // (match followed by whitespace — not (match? or (match-thing
  if (!/\(match(?=\s)\s+[^)]/.test(code)) return []
  return [{
    patternKind: 'match-form',
    example: (code.match(/\(match\s[^\n]{0,60}/) || [''])[0],
    severity: 'medium',
    proposedFix: '(cond ((equal? ...) ...) (else ...)) or nested (case ...) — both R7RS-small',
    alternative: 'adopt SRFI-200 / SRFI-241 pattern matching with new decision entry',
    recommendation: 'rewrite to cond/case; match is not R7RS',
    requiresDecisionEntry: false,
    note: 'match is Racket/Chez idiom, not R7RS-small',
  }]
}

// 7. Square-bracket data literal `[a b c]` inside code (not doc [optional])
function detectSquareBracketLiteral(v) {
  const code = joinCode(v)
  const bracketRe = /\[[^\]\n]{0,60}\]/g
  const hits = code.match(bracketRe) || []
  const dataHits = hits.filter((h) => {
    if (/^\[[a-z][-a-z0-9?!]*\]$/i.test(h)) return false
    return true
  })
  if (dataHits.length === 0) return []
  return [{
    patternKind: 'square-bracket-literal',
    example: dataHits[0],
    severity: 'medium',
    proposedFix: 'use #(a b c) for vector literals (R7RS §6.8) or (list a b c) for lists',
    alternative: 'if these are cond/match brackets, use () and rewrite the form',
    recommendation: '#( ... ) for vectors, ( ... ) for lists',
    requiresDecisionEntry: false,
    note: `${dataHits.length} occurrence(s), sample: ${dataHits.slice(0, 2).join(' | ')}`,
  }]
}

// 8. Naming style — kebab-case is Scheme (decision-013)
function detectNamingDrift(v) {
  const findings = []
  if (/_/.test(v.name)) {
    findings.push({
      patternKind: 'naming-underscore',
      example: v.name,
      severity: 'high',
      proposedFix: `rename to kebab-case: ${v.name.replace(/_/g, '-')}`,
      alternative: 'keep as-is if the underscore mirrors an external API name (log new decision)',
      recommendation: 'kebab-case (decision-013)',
      requiresDecisionEntry: false,
      decisionRef: '013',
    })
  }
  if (/[a-z][A-Z]/.test(v.name)) {
    findings.push({
      patternKind: 'naming-camelcase',
      example: v.name,
      severity: 'high',
      proposedFix: `rename to kebab-case: ${v.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
      alternative: 'none; camelCase is not Scheme',
      recommendation: 'kebab-case (decision-013)',
      requiresDecisionEntry: false,
      decisionRef: '013',
    })
  }
  const code = joinCode(v)
  const codeNoStrings = code.replace(/"[^"]*"/g, '""').replace(/;[^\n]*/g, '')
  const snakeMatches = codeNoStrings.match(/\b[a-z]+_[a-z][a-z_0-9]*\b/g)
  if (snakeMatches && snakeMatches.length > 0) {
    const uniq = [...new Set(snakeMatches)].slice(0, 5)
    findings.push({
      patternKind: 'naming-snake-in-examples',
      example: uniq.join(', '),
      severity: 'medium',
      proposedFix: `rename tokens to kebab-case in example bodies: ${uniq.map((u) => u.replace(/_/g, '-')).join(', ')}`,
      alternative: 'if the token is a foreign field name (Google API, JSON key), wrap in a string',
      recommendation: 'kebab-case (decision-013)',
      requiresDecisionEntry: false,
      decisionRef: '013',
      note: `${uniq.length} distinct snake_case token(s)`,
    })
  }
  return findings
}

// 9. Common-Lisp idioms: nil, setq, setf, defun, defvar, progn
function detectCommonLisp(v) {
  const code = joinCode(v)
  const codeNoStrings = code.replace(/"[^"]*"/g, '""').replace(/;[^\n]*/g, '')
  const findings = []
  const clKws = {
    setq: 'set!',
    setf: 'set!/hash-set!/etc.',
    defun: 'define',
    defvar: 'define',
    progn: 'begin',
  }
  for (const [kw, r7rs] of Object.entries(clKws)) {
    const re = new RegExp(`\\(${kw}(?=[\\s)])`, 'g')
    const hits = codeNoStrings.match(re)
    if (!hits) continue
    findings.push({
      patternKind: 'common-lisp-idiom',
      example: `(${kw} ...)`,
      severity: 'high',
      proposedFix: `replace with R7RS: ${r7rs}`,
      alternative: 'none',
      recommendation: r7rs,
      requiresDecisionEntry: false,
      note: `${hits.length} occurrence(s) of "(${kw} ...)"`,
    })
  }
  // 'nil' as bare token in call position is CL — but 'null' is R7RS-ish
  const bareNil = codeNoStrings.match(/(?<![-a-z?!])nil(?![-a-z?!])/gi)
  if (bareNil && bareNil.length > 0) {
    findings.push({
      patternKind: 'common-lisp-idiom',
      example: 'bare `nil` token',
      severity: 'high',
      proposedFix: "R7RS: use '() (empty list) or #f (false), never bare `nil`",
      alternative: 'none',
      recommendation: "'() for empty list, #f for false",
      requiresDecisionEntry: false,
      note: `${bareNil.length} occurrence(s)`,
    })
  }
  return findings
}

// 10. define-record vs R7RS define-record-type (decision-009)
function detectDefineRecord(v) {
  const code = joinCode(v)
  if (!/\bdefine-record\b(?!-type)/.test(code)) return []
  return [{
    patternKind: 'non-r7rs-record-form',
    example: (code.match(/define-record[^\n]{0,80}/) || [''])[0],
    severity: 'medium',
    proposedFix: 'use R7RS/SRFI-9 (define-record-type name (ctor fields...) pred? accessors)',
    alternative: 'SRFI-99 extended records',
    recommendation: 'define-record-type (decision-009)',
    requiresDecisionEntry: false,
    decisionRef: '009',
  }]
}

// 11. call/cc, eval, set-car!, set-cdr! (decisions 004/005/006)
function detectForbiddenPrimitives(v) {
  const code = joinCode(v)
  const findings = []
  const forbid = {
    'call/cc': { d: '004', fix: 'use raise + guard for non-local exit' },
    'call-with-current-continuation': { d: '004', fix: 'use raise + guard' },
    'eval': { d: '005', fix: 'pre-compile at author time; pass values through apply, not source' },
    'set-car!': { d: '006', fix: '(set! xs (cons new-head (cdr xs)))' },
    'set-cdr!': { d: '006', fix: 'build a new list via cons/append' },
  }
  for (const [kw, info] of Object.entries(forbid)) {
    const escaped = kw.replace(/[/!]/g, '\\$&')
    // Match (kw followed by whitespace or ) — NOT (kw-something (like eval-policy)
    const re = new RegExp(`\\(${escaped}(?=[\\s)])`, 'g')
    const hits = code.match(re)
    if (!hits) continue
    findings.push({
      patternKind: 'forbidden-primitive',
      example: `(${kw} ...)`,
      severity: 'high',
      proposedFix: info.fix,
      alternative: 'none — decision-' + info.d + ' forbids this',
      recommendation: info.fix,
      requiresDecisionEntry: false,
      decisionRef: info.d,
      note: `${hits.length} occurrence(s); forbidden by decision-${info.d}`,
    })
  }
  return findings
}

// 12. Signature/return-type contract check (decision-014 driver)
// Look for :signature "(foo ...) -> TYPE" and see if the novice example
// suggests a returned shape that doesn't match TYPE. This is a rough,
// cheap heuristic — flag obvious cases:
//   sig says -> symbol, but example shows (list 'ok ...) as return
//   sig says -> null/void, but example uses the result
function detectSignatureReturnMismatch(v) {
  const sig = v.signature || ''
  // Find return type after `->` or `→`
  const m = sig.match(/(?:->|→)\s*([^)\n]+?)\s*$/)
  if (!m) return []
  const retType = m[1].trim().toLowerCase()
  const findings = []

  // Case A: sig says -> null/void but examples use (result ...) meaningfully
  if (/^(null|void|unspecified)$/.test(retType)) {
    // Look for (let ((x (verb ...))) ...) in examples where x is used
    const code = joinCode(v)
    const usePattern = new RegExp(`\\(let\\s*\\(\\([a-z][-a-z0-9?!]*\\s+\\(${v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (usePattern.test(code)) {
      findings.push({
        patternKind: 'sig-return-null-but-used',
        example: `signature says -> ${retType}; example binds the result and uses it`,
        severity: 'medium',
        proposedFix: 'widen :signature to describe the real return shape (e.g. -> descriptor / -> symbol / -> pair)',
        alternative: 'if the return is truly discarded, remove the (let ...) capture from the example',
        recommendation: 'match signature to reality — decision-014',
        requiresDecisionEntry: false,
        decisionRef: '014',
      })
    }
  }
  return findings
}

// ── run detectors ─────────────────────────────────────────────────
const detectors = [
  detectKeywordArgSyntax,
  detectPolymorphicGet,
  detectNonR7rsListPrimitives,
  detectClojureMapLit,
  detectRacketKeyword,
  detectMatchForm,
  detectSquareBracketLiteral,
  detectNamingDrift,
  detectCommonLisp,
  detectDefineRecord,
  detectForbiddenPrimitives,
  detectSignatureReturnMismatch,
]

const verbs = allVerbEntries()
console.error(`sweeping ${verbs.length} verbs…`)

const findings = []
for (const v of verbs) {
  for (const det of detectors) {
    try {
      const results = det(v)
      for (const r of results) {
        findings.push({ verb: v.name, location: locFor(v.name), ...r })
      }
    } catch (e) {
      console.error(`detector ${det.name} failed on ${v.name}: ${e.message}`)
    }
  }
}

console.error(`total findings: ${findings.length}`)

// ── group + summarize ─────────────────────────────────────────────
const byKind = {}
for (const f of findings) {
  byKind[f.patternKind] = (byKind[f.patternKind] || 0) + 1
}
const verbFindingCount = {}
for (const f of findings) {
  verbFindingCount[f.verb] = (verbFindingCount[f.verb] || 0) + 1
}
const topVerbs = Object.entries(verbFindingCount).sort((a, b) => b[1] - a[1]).slice(0, 15)

console.error('\nby pattern-kind:')
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.error(`  ${k.padEnd(30)} ${n}`)
}
console.error('\ntop verbs by finding count:')
for (const [n, c] of topVerbs) {
  console.error(`  ${n.padEnd(40)} ${c}`)
}

// ── write report SLAT ─────────────────────────────────────────────
function escStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

const lines = []
lines.push(';; ═══════════════════════════════════════════════════════════════')
lines.push(';; SAKURA SCHEME — CONVENTION SWEEP')
lines.push(';;')
lines.push(';; Every non-R7RS pattern found in docs/SAKURA-SCHEME-REFERENCE.slat.')
lines.push(';; One (convention-finding …) record per finding.')
lines.push(';;')
lines.push(';; Dispatched 2026-07-14 by Alfred. Doctrine:')
lines.push(';;   "They\'ve tried things and talked about it longer than I have, so')
lines.push(';;    I trust their judgment." — stay close to R7RS-small unless a')
lines.push(';;    real reason justifies a break. Where we break, log a decision')
lines.push(';;    in docs/ENGINEERING-DECISIONS.slat.')
lines.push(';;')
lines.push(';; Pattern kinds → decision-ref (where the policy lives):')
lines.push(';;   keyword-arg-syntax        → decision-001 (no interp kw-args)')
lines.push(';;   racket-keyword-syntax     → decision-001')
lines.push(';;   get-verb                  → decision-002 (no polymorphic get)')
lines.push(';;   forbidden-primitive       → decision-004/005/006')
lines.push(';;   clojure-map-literal       → decision-009 (alist / hash-table)')
lines.push(';;   non-r7rs-record-form      → decision-009')
lines.push(';;   naming-underscore         → decision-013 (kebab-case)')
lines.push(';;   naming-camelcase          → decision-013')
lines.push(';;   naming-snake-in-examples  → decision-013')
lines.push(';;   sig-return-null-but-used  → decision-014 (sig matches reality)')
lines.push(';;   non-r7rs-primitive        → no decision yet (first/rest/last)')
lines.push(';;   srfi-1-primitive          → no decision yet (filter/find)')
lines.push(';;   match-form                → no decision yet')
lines.push(';;   square-bracket-literal    → no decision yet')
lines.push(';;   common-lisp-idiom         → no decision yet')
lines.push(';; ═══════════════════════════════════════════════════════════════')
lines.push('')
lines.push('(sweep-header')
lines.push('  :name "convention-sweep-2026-07-14"')
lines.push('  :date "2026-07-14"')
lines.push('  :author "convention-sweep lane"')
lines.push(`  :verbs-scanned ${verbs.length}`)
lines.push(`  :findings-total ${findings.length}`)
lines.push(`  :companion "docs/ENGINEERING-DECISIONS.slat"`)
lines.push(')')
lines.push('')
lines.push('; ── summary by pattern kind ──')
lines.push('(sweep-summary-by-kind')
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  lines.push(`  :${k} ${n}`)
}
lines.push(')')
lines.push('')
lines.push('; ── top verbs by finding count ──')
lines.push('(sweep-top-verbs')
for (const [n, c] of topVerbs) {
  lines.push(`  ("${escStr(n)}" ${c})`)
}
lines.push(')')
lines.push('')
lines.push('; ── findings ──')
lines.push('')

for (const f of findings) {
  lines.push('(convention-finding')
  lines.push(`  :verb "${escStr(f.verb)}"`)
  lines.push(`  :location "${escStr(f.location)}"`)
  lines.push(`  :pattern-kind "${escStr(f.patternKind)}"`)
  lines.push(`  :example "${escStr(f.example)}"`)
  lines.push(`  :severity "${escStr(f.severity)}"`)
  lines.push(`  :proposed-fix "${escStr(f.proposedFix)}"`)
  lines.push(`  :alternative "${escStr(f.alternative)}"`)
  lines.push(`  :recommendation "${escStr(f.recommendation)}"`)
  lines.push(`  :requires-decision-entry ${f.requiresDecisionEntry ? '#t' : '#f'}`)
  if (f.decisionRef) lines.push(`  :decision-ref "${escStr(f.decisionRef)}"`)
  if (f.note) lines.push(`  :note "${escStr(f.note)}"`)
  lines.push(')')
  lines.push('')
}

writeFileSync(REPORT_PATH, lines.join('\n'))
console.error(`\nwrote report: ${REPORT_PATH}`)
console.error(`total lines: ${lines.length}`)
