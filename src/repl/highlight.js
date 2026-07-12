// highlight.js — Scheme syntax highlighter.
//
// Small language, easy to color. Runs on every keystroke, so the tokenizer
// stays streaming + allocation-light. Returns an ANSI-decorated copy of the
// input string. Rainbow parens ride the same pass — depth counter increments
// on '(' and decrements on ')'; color picked from RAINBOW[depth % 6].
//
// Not a full parser. It's a token colorizer that respects strings + comments
// so we don't paint the middle of a string as a keyword. Unclosed strings /
// comments are colored optimistically (as if the terminator were coming).

import { PALETTE, fg, role, RAINBOW, isColorEnabled } from './nordic.js'

// Sakura-Scheme special forms. Kept small — only the syntax-level names.
const SPECIAL_FORMS = new Set([
  'define', 'define-syntax', 'define-record-type',
  'lambda', 'if', 'cond', 'case', 'when', 'unless',
  'let', 'let*', 'letrec', 'letrec*', 'let-values',
  'begin', 'set!', 'and', 'or', 'quote', 'quasiquote',
  'unquote', 'unquote-splicing', 'syntax-rules', 'else',
  '=>', '...', '_',
])

// Common built-ins from base.js — dim-highlighted as functions.
// This list is inline here so highlighting doesn't depend on env warmup.
// (Autocomplete uses the live env — this is just for coloring.)
const KNOWN_FNS = new Set([
  '+', '-', '*', '/', 'modulo', 'quotient', 'remainder', 'max', 'min', 'abs',
  '=', '<', '>', '<=', '>=', 'not', '=?', 'eq?', 'equal?',
  'list', 'cons', 'car', 'cdr', 'cadr', 'caddr', 'null?', 'pair?',
  'length', 'range', 'for-each', 'map', 'filter', 'reduce', 'apply',
  'first', 'last', 'take', 'drop', 'nth', 'append', 'reverse', 'sort',
  'member', 'assoc', 'zip', 'sum', 'mean', 'count', 'any', 'every',
  'inspect', 'display', 'newline', 'string-append', 'string-length',
  'string->number', 'number->string', 'substring', 'string?', 'number?',
  'boolean?', 'symbol?', 'procedure?', 'sin', 'cos', 'tan', 'sqrt',
  'floor', 'ceiling', 'round', 'expt', 'pi', 'random-int', 'random-range',
])

/**
 * highlight(src) → ANSI-colored copy of `src`.
 *
 * Streaming char-by-char scan. State: 'code' | 'string' | 'comment' | 'char'.
 * Parens track depth so rainbow coloring is per-nesting-level.
 */
export function highlight(src) {
  if (!isColorEnabled() || !src) return src

  const out = []
  const n = src.length
  let i = 0
  let depth = 0
  let state = 'code'

  const push = (t) => out.push(t)

  while (i < n) {
    const c = src[i]
    // ── comment ──────────────────────────────────────────────
    if (state === 'code' && c === ';') {
      // Consume until newline.
      let j = i
      while (j < n && src[j] !== '\n') j++
      push(role.comment(src.slice(i, j)))
      i = j
      continue
    }
    // ── string ───────────────────────────────────────────────
    if (state === 'code' && c === '"') {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\' && j + 1 < n) { j += 2; continue }
        if (src[j] === '"') { j++; break }
        j++
      }
      push(role.string(src.slice(i, j)))
      i = j
      continue
    }
    // ── character literal (#\a) ──────────────────────────────
    if (state === 'code' && c === '#' && i + 1 < n && src[i + 1] === '\\') {
      // #\<char> or #\<named>
      let j = i + 2
      // Read named char run of letters, or just the one char.
      if (j < n && /[A-Za-z]/.test(src[j])) {
        while (j < n && /[A-Za-z]/.test(src[j])) j++
      } else if (j < n) {
        j++
      }
      push(role.string(src.slice(i, j)))
      i = j
      continue
    }
    // ── booleans #t / #f ─────────────────────────────────────
    if (state === 'code' && c === '#' && i + 1 < n && (src[i + 1] === 't' || src[i + 1] === 'f')) {
      // Match '#t' / '#f' / '#true' / '#false'.
      let j = i + 2
      while (j < n && /[a-z]/.test(src[j])) j++
      push(role.number(src.slice(i, j)))
      i = j
      continue
    }
    // ── numbers ──────────────────────────────────────────────
    // A number is a leading sign or digit followed by digit/dot/e.
    if (state === 'code' && (/[0-9]/.test(c) ||
        ((c === '-' || c === '+') && i + 1 < n && /[0-9.]/.test(src[i + 1]) &&
         (i === 0 || /[\s()]/.test(src[i - 1]))))) {
      let j = i + 1
      while (j < n && /[0-9.eE+\-]/.test(src[j])) j++
      // Only treat as number if we consumed at least one digit body.
      const tok = src.slice(i, j)
      if (/[0-9]/.test(tok)) {
        push(role.number(tok))
        i = j
        continue
      }
    }
    // ── parens ───────────────────────────────────────────────
    if (state === 'code' && (c === '(' || c === '[')) {
      push(fg(RAINBOW[depth % RAINBOW.length], c))
      depth++
      i++
      continue
    }
    if (state === 'code' && (c === ')' || c === ']')) {
      depth = Math.max(0, depth - 1)
      push(fg(RAINBOW[depth % RAINBOW.length], c))
      i++
      continue
    }
    // ── quote sugar ──────────────────────────────────────────
    if (state === 'code' && (c === "'" || c === '`' || c === ',')) {
      push(role.meta(c))
      i++
      continue
    }
    // ── symbol / keyword ─────────────────────────────────────
    if (state === 'code' && /[^\s()[\]"';`,]/.test(c)) {
      let j = i
      while (j < n && /[^\s()[\]"';`,]/.test(src[j])) j++
      const tok = src.slice(i, j)
      if (SPECIAL_FORMS.has(tok)) push(role.keyword(tok))
      else if (KNOWN_FNS.has(tok)) push(role.fn(tok))
      else if (tok.endsWith(':') || tok.startsWith(':')) push(role.meta(tok))  // keyword arg
      else push(role.text(tok))
      i = j
      continue
    }
    // Whitespace / stray chars pass through as-is.
    push(c)
    i++
  }

  return out.join('')
}

/**
 * countBalance(src) → { paren, bracket, string, comment }
 *
 * Returns the running balance of parens after scanning `src`. Positive means
 * unclosed. Used to decide when Enter should evaluate vs. add a newline.
 */
export function countBalance(src) {
  let paren = 0, bracket = 0
  let inString = false, escape = false, inComment = false
  const n = src.length
  for (let i = 0; i < n; i++) {
    const c = src[i]
    if (inComment) {
      if (c === '\n') inComment = false
      continue
    }
    if (inString) {
      if (escape) { escape = false; continue }
      if (c === '\\') { escape = true; continue }
      if (c === '"') { inString = false; continue }
      continue
    }
    if (c === ';') { inComment = true; continue }
    if (c === '"') { inString = true; continue }
    if (c === '(') paren++
    else if (c === ')') paren--
    else if (c === '[') bracket++
    else if (c === ']') bracket--
  }
  return { paren, bracket, string: inString, comment: inComment }
}

/**
 * isBalanced(src) → true when parens / brackets close cleanly + no
 * open string. Used by the line editor to decide when Enter is submit.
 */
export function isBalanced(src) {
  const b = countBalance(src)
  return b.paren === 0 && b.bracket === 0 && !b.string
}
