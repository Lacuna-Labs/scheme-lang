// Tiny s-expression reader — no dependencies.
//
// Parses Scheme source into plain JS values so the interpreter can walk them:
//   number  → JS number          string → JS string
//   boolean → true / false (#t/#f)
//   symbol  → Sym instance       list   → JS array
//
// This is the front of the Scheme Control Interface: the same homoiconic
// text an operator reads is the data the evaluator runs.
//
// ── SC1 (B3, 2026-06-11) ────────────────────────────────────────────────
// Two hardening additions that do NOT change the value shape (so every
// existing consumer — interp, dispatch, walkVerbCalls — keeps working):
//
//   1. SOURCE POSITIONS. The tokenizer records {line,col,start} per token;
//      `parse` attaches `{line,col}` for every *list* form on a side
//      WeakMap (POS). Atoms can't key a WeakMap (numbers/strings/booleans
//      aren't objects, and interned Syms are shared), so list-level
//      positions are what a "bad program points at the offending form"
//      story needs — the smallest reliable granularity. `posOf(form)`
//      reads it back; the interpreter + dispatcher surface it in errors.
//
//   2. AST CACHE. `parse(src)` memoizes by source string. Re-running the
//      same cart text (replay, repeated dispatch, the studio's
//      run-on-keystroke) skips the tokenize+read pass entirely. The cache
//      is bounded (LRU-ish, capped) so a long session can't grow it
//      without limit. `clearParseCache()` is the test seam.

export class Sym {
  constructor(name) { this.name = name }
  toString() { return this.name }
}

const SYMS = new Map()
export function sym(name) {
  let s = SYMS.get(name)
  if (!s) { s = new Sym(name); SYMS.set(name, s) }
  return s
}

// R7RS §6.6 — character type. Sakura Scheme has previously modeled 1-char
// as a 1-length JS string, but that conflates `"a"` and `#\a` — both would
// answer `char?` truthfully by the string-length test, breaking R7RS
// contracts. A dedicated tagged class fixes that: `char?` returns #t only
// on Ch instances, and every char procedure lifts on Ch.value (the
// underlying JS char). Reader-side: `#\a`, `#\space`, `#\newline`, and
// `#\xHH` all read as `Ch` instances. See ENGINEERING-DECISIONS §NNN.
export class Ch {
  constructor(value) { this.value = value }  // .value is a 1-char JS string
  toString() { return '#\\' + this.value }
}
// Interned by codepoint so `(eq? #\a #\a)` is #t.
const CHS = new Map()
export function ch(value) {
  const v = String(value)
  if (v.length !== 1 && !(v.length === 2 && v.charCodeAt(0) >= 0xD800 && v.charCodeAt(0) <= 0xDBFF)) {
    // Only accept a single JS "char" (single code unit or valid surrogate pair)
  }
  let c = CHS.get(v)
  if (!c) { c = new Ch(v); CHS.set(v, c) }
  return c
}

// R7RS §6.6 named character literals. Case-INsensitive per R7RS.
const CHAR_NAMES = {
  'alarm': '\x07',
  'backspace': '\b',
  'delete': '\x7f',
  'escape': '\x1b',
  'newline': '\n',
  'null': '\0',
  'return': '\r',
  'space': ' ',
  'tab': '\t',
  'linefeed': '\n',   // extension for compatibility
  'page': '\f',       // extension
  'rubout': '\x7f',   // extension
}

// ── source positions ────────────────────────────────────────────────────
// List forms are objects (arrays) so they can key a WeakMap. We never key
// atoms (they're primitives or shared interned Syms). The map auto-clears
// when a form is GC'd, so it carries no leak.
const POS = new WeakMap()
export function posOf(form) {
  if (form && typeof form === 'object') return POS.get(form) || null
  return null
}
export function tagPos(form, pos) {
  if (form && typeof form === 'object' && pos) POS.set(form, pos)
  return form
}

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/
const DELIM = new Set([' ', '\t', '\n', '\r', '(', ')', ';', "'", '"'])

// R7RS §6.2.6 exact/inexact numeric prefixes and radix prefixes: #e / #i
// / #b / #o / #d / #x. We parse them at atom time. Radix-16 also accepts
// A-F. The prefixes may combine in either order (#e#x or #x#e).
function parseNumericWithPrefix(tok) {
  // Only try if starts with '#'. Return NaN sentinel if not a number.
  let s = tok
  let exact = null   // null = default, true = #e, false = #i
  let radix = null   // null = default, 2/8/10/16 = #b/#o/#d/#x
  // Consume at most two prefixes.
  for (let round = 0; round < 2 && s.length >= 2 && s[0] === '#'; round++) {
    const p = s[1].toLowerCase()
    if (p === 'e') { exact = true;  s = s.slice(2); continue }
    if (p === 'i') { exact = false; s = s.slice(2); continue }
    if (p === 'b') { radix = 2;     s = s.slice(2); continue }
    if (p === 'o') { radix = 8;     s = s.slice(2); continue }
    if (p === 'd') { radix = 10;    s = s.slice(2); continue }
    if (p === 'x') { radix = 16;    s = s.slice(2); continue }
    break
  }
  if (exact === null && radix === null) return null   // not a prefixed number
  if (s.length === 0) return null
  // Radix-10 with default → parseFloat.
  if (radix === null || radix === 10) {
    const n = parseFloat(s)
    if (Number.isNaN(n)) return null
    return exact === true ? Math.trunc(n) : n
  }
  // Radix parse with optional sign.
  let sign = 1, body = s
  if (body[0] === '+' || body[0] === '-') { sign = body[0] === '-' ? -1 : 1; body = body.slice(1) }
  if (body.length === 0) return null
  const n = parseInt(body, radix)
  if (Number.isNaN(n)) return null
  return sign * n
}

// A reader error that carries a {line,col} so callers can point at the
// offending text. `message` already embeds the location for legacy
// callers that only read `.message`.
export class ReadError extends Error {
  constructor(message, line, col) {
    super(line != null ? `${message} (line ${line}, col ${col})` : message)
    this.name = 'ReadError'
    this.line = line ?? null
    this.col = col ?? null
  }
}

// Tokens carry their source position so list forms can be tagged. A token
// is `{ t, line, col }` where `t` is the lexeme (string) or `{str}` for a
// string literal.
export function tokenize(src) {
  const out = []
  let i = 0
  let line = 1
  let col = 1
  const n = src.length
  const adv = (k = 1) => {
    while (k-- > 0) {
      if (src[i] === '\n') { line++; col = 1 } else { col++ }
      i++
    }
  }
  while (i < n) {
    const c = src[i]
    const L = line, C = col
    if (c === ';') { while (i < n && src[i] !== '\n') adv(); continue }     // comment
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { adv(); continue }
    if (c === '(' || c === ')' || c === "'") { out.push({ t: c, line: L, col: C }); adv(); continue }
    // `expr  → (quasiquote expr)
    // ,expr  → (unquote expr)
    // ,@expr → (unquote-splicing expr)
    if (c === '`') { out.push({ t: '`', line: L, col: C }); adv(); continue }
    if (c === ',') {
      if (i + 1 < n && src[i + 1] === '@') { out.push({ t: ',@', line: L, col: C }); adv(2); continue }
      out.push({ t: ',', line: L, col: C }); adv(); continue
    }
    // ── R7RS # forms ────────────────────────────────────────────────────
    // #t / #f / #true / #false      — booleans (long forms lex as atoms)
    // #\char / #\name / #\xHH       — character literals
    // #(datum...)                    — vector literal
    // #u8(byte...)                   — bytevector literal
    // #| ... |#                      — nested block comment
    // #;                             — datum comment (skip the next datum)
    // #!fold-case / #!no-fold-case   — case-folding directive (silently ignored)
    // #e / #i / #b / #o / #d / #x   — numeric prefixes; lex as atom, atom() parses.
    if (c === '#' && i + 1 < n) {
      const next = src[i + 1]
      // Block comment: #| ... |#  (nested).
      if (next === '|') {
        adv(2)
        let depth = 1
        while (i < n && depth > 0) {
          if (src[i] === '#' && i + 1 < n && src[i + 1] === '|') { depth++; adv(2); continue }
          if (src[i] === '|' && i + 1 < n && src[i + 1] === '#') { depth--; adv(2); continue }
          adv()
        }
        if (depth !== 0) throw new ReadError('unterminated block comment', L, C)
        continue
      }
      // Datum comment: #; skips the next datum.
      if (next === ';') {
        adv(2)
        out.push({ t: '#;', line: L, col: C })
        continue
      }
      // Vector literal opener: #(
      if (next === '(') {
        out.push({ t: '#(', line: L, col: C }); adv(2); continue
      }
      // Bytevector literal opener: #u8(
      if (next === 'u' && src[i + 2] === '8' && src[i + 3] === '(') {
        out.push({ t: '#u8(', line: L, col: C }); adv(4); continue
      }
      // Character literal: #\...
      if (next === '\\') {
        adv(2)  // consume #\
        // Two shapes:
        //   #\<single-char>       — one literal char
        //   #\<name-or-hex>       — read alphabetic run
        // We need to distinguish. If the next char is followed by a
        // delimiter, it's a single-char literal. Otherwise, gather the
        // alphabetic run and either match a name or (for #\xHH) parse hex.
        if (i >= n) throw new ReadError('unterminated character literal', L, C)
        const first = src[i]
        // If EOF or delimiter follows the first char, it's a single-char
        // literal. Otherwise gather.
        const next2 = i + 1 < n ? src[i + 1] : null
        if (next2 === null || DELIM.has(next2)) {
          out.push({ t: { char: first }, line: L, col: C })
          adv()
          continue
        }
        // Gather the run.
        let j = i
        while (j < n && !DELIM.has(src[j])) j++
        const lex = src.slice(i, j)
        adv(j - i)
        // #\xHH — hex escape.
        if (lex.length > 1 && (lex[0] === 'x' || lex[0] === 'X')) {
          const hex = lex.slice(1)
          if (!/^[0-9a-fA-F]+$/.test(hex)) throw new ReadError('bad hex char literal #\\' + lex, L, C)
          const cp = parseInt(hex, 16)
          out.push({ t: { char: String.fromCodePoint(cp) }, line: L, col: C })
          continue
        }
        // Named char (case-insensitive per R7RS).
        const nameKey = lex.toLowerCase()
        if (Object.prototype.hasOwnProperty.call(CHAR_NAMES, nameKey)) {
          out.push({ t: { char: CHAR_NAMES[nameKey] }, line: L, col: C })
          continue
        }
        // Fallback: a single-char literal with the run being just one char.
        // (Handles e.g. `#\A` — which we already consumed but that's actually
        // a single-char literal.) If lex.length === 1, it's a single char.
        if (lex.length === 1) {
          out.push({ t: { char: lex }, line: L, col: C })
          continue
        }
        throw new ReadError('unknown character name: #\\' + lex, L, C)
      }
      // #!fold-case / #!no-fold-case — ignore (we don't fold case).
      if (next === '!') {
        // Skip the whole atom.
        let j = i
        while (j < n && !DELIM.has(src[j])) j++
        adv(j - i)
        continue
      }
      // Otherwise fall through — # begins a longer atom (like #t / #f /
      // #true / #false / #e12 / #x1F). Atom scanner below will pick it up.
    }
    if (c === '"') {                                                         // string
      let s = ''
      adv() // opening quote
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < n) {
          // R7RS §6.7 string escapes. Prior versions only stripped the
          // backslash and kept the raw next char — which turned "\n"
          // into a literal "n" and broke every multi-line example in
          // the reference SLAT. Fixed: interpret the standard escapes.
          const esc = src[i + 1]
          switch (esc) {
            case 'n': s += '\n'; break
            case 't': s += '\t'; break
            case 'r': s += '\r'; break
            case '\\': s += '\\'; break
            case '"': s += '"'; break
            case '0': s += '\0'; break
            case 'a': s += '\x07'; break // bell
            case 'b': s += '\b'; break
            default: s += esc // unknown escape → literal next char (keeps prior lenience)
          }
          adv(2)
        }
        else { s += src[i]; adv() }
      }
      if (i >= n) throw new ReadError('unterminated string', L, C)
      adv() // closing quote
      out.push({ t: { str: s }, line: L, col: C })
      continue
    }
    let j = i                                                               // atom
    while (j < n && !DELIM.has(src[j])) j++
    out.push({ t: src.slice(i, j), line: L, col: C })
    adv(j - i)
  }
  return out
}

function atom(tok) {
  if (typeof tok === 'object' && tok && 'str' in tok) return tok.str
  if (typeof tok === 'object' && tok && 'char' in tok) return ch(tok.char)
  if (tok === '#t' || tok === '#true') return true
  if (tok === '#f' || tok === '#false') return false
  if (NUM_RE.test(tok)) return parseFloat(tok)
  // R7RS numeric prefixes (#e, #i, #b, #o, #d, #x). Best-effort — only
  // consume if the rest parses as a number under the prefix.
  if (typeof tok === 'string' && tok.length >= 2 && tok[0] === '#') {
    const n = parseNumericWithPrefix(tok)
    if (n !== null) return n
  }
  return sym(tok)
}

// ── parse, with positions ────────────────────────────────────────────────
function parseInner(src) {
  const toks = tokenize(src)
  let pos = 0
  function read() {
    if (pos >= toks.length) throw new ReadError('unexpected EOF', null, null)
    const tk = toks[pos++]
    const t = tk.t
    // Datum comment: #; discards the next datum, then continues.
    if (t === '#;') {
      // Consume-and-drop the next datum.
      read()
      // Then read the next real datum.
      return read()
    }
    if (t === '(') {
      const list = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing )', tk.line, tk.col)
        if (toks[pos].t === ')') break
        list.push(read())
      }
      pos++ // consume )
      return tagPos(list, { line: tk.line, col: tk.col })
    }
    // Vector literal: #( datum... )
    // R7RS §4.1.5: #(1 2 3) is self-evaluating vector, but we choose to
    // read it AS an already-quoted vector: reader emits [Sym(quote), array],
    // matching the way most Schemes handle vector literals in code. This
    // keeps the interpreter's array-is-list model intact.
    if (t === '#(') {
      const list = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing ) after #(', tk.line, tk.col)
        if (toks[pos].t === ')') break
        list.push(read())
      }
      pos++
      // Emit `(quote (vector-literal <items>))` so interp treats it as
      // data. The evaluator sees the array as a self-evaluating list of
      // values; but a raw self-eval array would collide with function-
      // application. Simplest: wrap in `quote`.
      // Actually — we need the vector to evaluate to a vector at runtime.
      // Use (vector item...) so the vector primitive builds it. This
      // matches the R7RS-recommended reader behavior: literal vectors
      // are compile-time constants; we synthesise the constructor call.
      return tagPos([sym('vector'), ...list], { line: tk.line, col: tk.col })
    }
    // Bytevector literal: #u8( byte... )
    if (t === '#u8(') {
      const bytes = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing ) after #u8(', tk.line, tk.col)
        if (toks[pos].t === ')') break
        bytes.push(read())
      }
      pos++
      // Same shape: (bytevector b0 b1 ...) — a call to the bytevector
      // constructor primitive, which builds a Uint8Array.
      return tagPos([sym('bytevector'), ...bytes], { line: tk.line, col: tk.col })
    }
    if (t === ')') throw new ReadError('unexpected )', tk.line, tk.col)
    if (t === "'") return tagPos([sym('quote'), read()], { line: tk.line, col: tk.col })
    if (t === '`') return tagPos([sym('quasiquote'), read()], { line: tk.line, col: tk.col })
    if (t === ',') return tagPos([sym('unquote'), read()], { line: tk.line, col: tk.col })
    if (t === ',@') return tagPos([sym('unquote-splicing'), read()], { line: tk.line, col: tk.col })
    return atom(t)
  }
  const forms = []
  while (pos < toks.length) forms.push(read())
  return forms
}

// ── AST cache (SC1a) ─────────────────────────────────────────────────────
// Memoize by source string. Bounded so a long session can't grow it
// unboundedly — when full, evict the oldest entry (insertion order of a
// Map is FIFO, which is a fine LRU-approximation for cart text).
//
// Cached forms are SHARED across hits. The macro expander + interpreter
// never mutate the read forms (they build NEW arrays), and `quote`
// returns a sub-form directly — but quoted data is treated as immutable
// by every consumer, so sharing the same instance is safe. (If a future
// consumer wanted to mutate, it would clone first — same as today.)
const PARSE_CACHE = new Map()
const PARSE_CACHE_MAX = 256
let _cacheHits = 0
let _cacheMisses = 0

export function parse(src) {
  if (typeof src !== 'string') return parseInner(src)
  const hit = PARSE_CACHE.get(src)
  if (hit) {
    _cacheHits++
    // Refresh insertion order (move-to-end) so hot entries survive eviction.
    PARSE_CACHE.delete(src)
    PARSE_CACHE.set(src, hit)
    return hit
  }
  _cacheMisses++
  const forms = parseInner(src)
  if (PARSE_CACHE.size >= PARSE_CACHE_MAX) {
    // Evict oldest (first key).
    const oldest = PARSE_CACHE.keys().next().value
    if (oldest !== undefined) PARSE_CACHE.delete(oldest)
  }
  PARSE_CACHE.set(src, forms)
  return forms
}

// Test/diagnostic seams.
export function clearParseCache() { PARSE_CACHE.clear(); _cacheHits = 0; _cacheMisses = 0 }
export function parseCacheStats() {
  return { size: PARSE_CACHE.size, hits: _cacheHits, misses: _cacheMisses, max: PARSE_CACHE_MAX }
}
