#!/usr/bin/env node
// docs/site/render-ref.mjs — render the reference SLAT to HTML.
//
// Input:  docs/SAKURA-SCHEME-REFERENCE.slat  (consolidated SLAT reference)
// Output: docs/site/dist/reference.html
//
// The reference used to live in a Markdown file (SAKURA-SCHEME-1.0.REF.md);
// on 2026-07-13 it consolidated into a SLAT (~1,157 verbs + 70 core forms)
// as the single source of truth. This renderer reads the SLAT via the same
// loader the REPL uses and emits an HTML page with the same shape the old
// MD renderer produced: heading anchors, syntax-highlighted code blocks
// with Run buttons, a sidebar TOC. No npm deps.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { loadReference } from '../../src/reference-loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const OUT_DIR = join(__dirname, 'dist')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const ref = loadReference()

// ── Scheme highlighter (mirrors src/repl/highlight.js) ───────────────
const SPECIAL_FORMS = new Set([
  'define', 'define-syntax', 'define-record-type',
  'lambda', 'if', 'cond', 'case', 'when', 'unless',
  'let', 'let*', 'letrec', 'letrec*', 'let-values',
  'begin', 'set!', 'and', 'or', 'quote', 'quasiquote',
  'unquote', 'unquote-splicing', 'syntax-rules', 'else',
])
const KNOWN_FNS = new Set([
  '+', '-', '*', '/', 'modulo', 'quotient', 'remainder', 'max', 'min', 'abs',
  '=', '<', '>', '<=', '>=', 'not', '=?', 'eq?', 'equal?',
  'list', 'cons', 'car', 'cdr', 'cadr', 'caddr', 'null?', 'pair?',
  'length', 'range', 'for-each', 'map', 'filter', 'reduce', 'apply',
  'first', 'last', 'take', 'drop', 'nth', 'append', 'reverse', 'sort',
  'display', 'newline', 'string-append', 'string-length', 'sqrt', 'sin', 'cos',
  'floor', 'ceiling', 'round', 'expt', 'pi', 'circle', 'disc', 'line', 'rect',
])

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightScheme(source) {
  const out = []
  const n = source.length
  let i = 0, depth = 0
  while (i < n) {
    const c = source[i]
    if (c === ';') {
      let j = i
      while (j < n && source[j] !== '\n') j++
      out.push('<span class="c-comment">' + esc(source.slice(i, j)) + '</span>')
      i = j
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n) {
        if (source[j] === '\\' && j + 1 < n) { j += 2; continue }
        if (source[j] === '"') { j++; break }
        j++
      }
      out.push('<span class="c-string">' + esc(source.slice(i, j)) + '</span>')
      i = j
      continue
    }
    if (c === '#' && i + 1 < n && (source[i + 1] === 't' || source[i + 1] === 'f')) {
      let j = i + 2
      while (j < n && /[a-z]/.test(source[j])) j++
      out.push('<span class="c-number">' + esc(source.slice(i, j)) + '</span>')
      i = j
      continue
    }
    if (/[0-9]/.test(c) ||
      ((c === '-' || c === '+') && i + 1 < n && /[0-9.]/.test(source[i + 1]) &&
       (i === 0 || /[\s()]/.test(source[i - 1])))) {
      let j = i + 1
      while (j < n && /[0-9.eE+\-]/.test(source[j])) j++
      const tok = source.slice(i, j)
      if (/[0-9]/.test(tok)) {
        out.push('<span class="c-number">' + esc(tok) + '</span>')
        i = j
        continue
      }
    }
    if (c === '(' || c === '[') {
      out.push('<span class="c-paren c-p' + (depth % 6) + '">' + esc(c) + '</span>')
      depth++
      i++
      continue
    }
    if (c === ')' || c === ']') {
      depth = Math.max(0, depth - 1)
      out.push('<span class="c-paren c-p' + (depth % 6) + '">' + esc(c) + '</span>')
      i++
      continue
    }
    if (c === "'" || c === '`' || c === ',') {
      out.push('<span class="c-quote">' + esc(c) + '</span>')
      i++
      continue
    }
    if (/[^\s()[\]"';`,]/.test(c)) {
      let j = i
      while (j < n && /[^\s()[\]"';`,]/.test(source[j])) j++
      const tok = source.slice(i, j)
      if (SPECIAL_FORMS.has(tok)) out.push('<span class="c-keyword">' + esc(tok) + '</span>')
      else if (KNOWN_FNS.has(tok)) out.push('<span class="c-fn">' + esc(tok) + '</span>')
      else if (tok.endsWith(':') || tok.startsWith(':')) out.push('<span class="c-meta">' + esc(tok) + '</span>')
      else out.push('<span class="c-sym">' + esc(tok) + '</span>')
      i = j
      continue
    }
    out.push(esc(c))
    i++
  }
  return out.join('')
}

// ── inline rendering (limited MD subset for prose fields) ────────────
function renderInline(s) {
  const parts = []
  let last = 0
  const CODE_RE = /`([^`]+)`/g
  let m
  while ((m = CODE_RE.exec(s)) !== null) {
    parts.push({ kind: 'text', v: s.slice(last, m.index) })
    parts.push({ kind: 'code', v: m[1] })
    last = m.index + m[0].length
  }
  parts.push({ kind: 'text', v: s.slice(last) })

  return parts.map(p => {
    if (p.kind === 'code') return '<code>' + esc(p.v) + '</code>'
    let t = esc(p.v)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
      const safe = /^(https?:|mailto:|#|\.?\/|[a-z0-9_./-]+$)/i.test(url) ? url : '#'
      return '<a href="' + esc(safe) + '">' + txt + '</a>'
    })
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    return t
  }).join('')
}

// Render a code sample: highlighted <pre> + Run button.
function renderCodeBlock(code) {
  return '<pre class="code scheme"><button class="run-btn" data-run="' +
    esc(code) + '" title="Send to REPL">Run</button><code>' +
    highlightScheme(code) + '</code></pre>'
}

// Render a doc-body blob (used for core-forms, which carry MD subset).
// Handles: fenced ```scheme blocks (with Run buttons), plain paragraphs,
// #### sub-headings, --- horizontal rules, inline `code`.
function renderDocBody(body) {
  const out = []
  const lines = String(body).split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || 'text'
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++
      const code = buf.join('\n')
      if (lang === 'scheme' || lang === 'scm') {
        out.push(renderCodeBlock(code))
      } else {
        out.push('<pre class="code ' + esc(lang) + '"><code>' + esc(code) + '</code></pre>')
      }
      continue
    }
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = Math.min(6, h[1].length + 2) // #### in doc body → h6
      out.push('<h' + level + '>' + renderInline(h[2]) + '</h' + level + '>')
      i++
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    const para = []
    while (i < lines.length && !/^\s*$/.test(lines[i])
      && !/^```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i])
      && !/^---\s*$/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    out.push('<p>' + renderInline(para.join(' ')) + '</p>')
  }
  return out.join('\n')
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── build the page ───────────────────────────────────────────────────

const out = []
const anchors = []
let anchorCounter = 0
function anchor(text, level) {
  const id = 'h-' + slugify(text) + '-' + (anchorCounter++)
  anchors.push({ level, text: String(text), id })
  return id
}

// Page title.
out.push('<h1 id="' + anchor('Sakura Scheme Reference', 1) + '">Sakura Scheme Reference</h1>')
out.push('<p><em>Version ' + esc(ref.meta.version || '1.0') + ' — consolidated ' +
  esc(ref.meta.consolidatedAt || '') + '. ' +
  ref.verbList.length + ' verbs + ' + ref.coreList.length +
  ' core language forms.</em></p>')
out.push('<p>The reference IS the language. Every verb is defined here with a summary, ' +
  'explanation, three-tier examples (novice / intermediate / expert), caveats, drawbacks, ' +
  'use-cases, related verbs, and a learning progression.</p>')

// ── Core language forms ─────────────────────────────────────────────
out.push('<h2 id="' + anchor('Core language forms', 2) + '">Core language forms</h2>')
for (const cf of ref.coreList) {
  const id = anchor(cf.name, 3)
  out.push('<h3 id="' + id + '"><code>' + esc(cf.name) + '</code></h3>')
  if (cf.signature) {
    out.push('<p><strong>Signature:</strong> <code>' + esc(cf.signature) + '</code></p>')
  }
  if (cf['doc-body']) {
    out.push(renderDocBody(cf['doc-body']))
  }
}

// ── Verbs, grouped by library ───────────────────────────────────────
out.push('<h2 id="' + anchor('Verbs by library', 2) + '">Verbs by library</h2>')

// Group verbs.
const byLibrary = new Map()
for (const v of ref.verbList) {
  const lib = v.library || 'misc'
  if (!byLibrary.has(lib)) byLibrary.set(lib, [])
  byLibrary.get(lib).push(v)
}
const libraries = Array.from(byLibrary.keys()).sort()

for (const lib of libraries) {
  const verbs = byLibrary.get(lib)
  const libId = anchor('library-' + lib, 3)
  out.push('<h3 id="' + libId + '">Library <code>' + esc(lib) + '</code> <small>(' +
    verbs.length + ' verbs)</small></h3>')
  for (const v of verbs) {
    const id = anchor(v.name, 4)
    out.push('<div class="verb">')
    out.push('<h4 id="' + id + '"><code>' + esc(v.name) + '</code>' +
      (v.kind ? ' <small class="kind">[' + esc(v.kind) + ']</small>' : '') +
      '</h4>')
    if (v.signature) {
      out.push('<p><strong>Signature:</strong> <code>' + esc(v.signature) + '</code></p>')
    }
    if (v.summary) {
      out.push('<p class="summary">' + renderInline(v.summary) + '</p>')
    }
    if (v.explanation) {
      out.push('<p>' + renderInline(v.explanation) + '</p>')
    }
    if (Array.isArray(v.examples) && v.examples.length > 0) {
      out.push('<div class="examples">')
      for (const ex of v.examples) {
        const tier = ex.tier || ''
        if (tier) out.push('<p class="tier"><strong>' + esc(tier) + '</strong></p>')
        if (ex.code) out.push(renderCodeBlock(ex.code))
        if (ex.note) out.push('<p class="note"><em>' + renderInline(ex.note) + '</em></p>')
      }
      out.push('</div>')
    }
    if (Array.isArray(v.caveats) && v.caveats.length > 0) {
      out.push('<p><strong>Caveats:</strong></p><ul>' +
        v.caveats.map(c => '<li>' + renderInline(c) + '</li>').join('') + '</ul>')
    }
    if (Array.isArray(v.drawbacks) && v.drawbacks.length > 0) {
      out.push('<p><strong>Drawbacks:</strong></p><ul>' +
        v.drawbacks.map(c => '<li>' + renderInline(c) + '</li>').join('') + '</ul>')
    }
    if (Array.isArray(v.usecases) && v.usecases.length > 0) {
      out.push('<p><strong>Use cases:</strong></p><ul>' +
        v.usecases.map(c => '<li>' + renderInline(c) + '</li>').join('') + '</ul>')
    }
    if (Array.isArray(v.related) && v.related.length > 0) {
      out.push('<p><strong>Related:</strong> ' +
        v.related.map(r => '<code>' + esc(r) + '</code>').join(', ') + '</p>')
    }
    if (v.learn && typeof v.learn === 'object') {
      const l = v.learn
      if (l.concept) out.push('<p><strong>Learn:</strong> ' + renderInline(l.concept) + '</p>')
      if (Array.isArray(l.prerequisites) && l.prerequisites.length > 0) {
        out.push('<p><em>Prerequisites:</em> ' +
          l.prerequisites.map(p => '<code>' + esc(p) + '</code>').join(', ') + '</p>')
      }
      if (l.progression) out.push('<p><em>Progression:</em> ' + renderInline(l.progression) + '</p>')
    }
    out.push('</div>')
  }
}

// ── sidebar TOC ─────────────────────────────────────────────────────
const toc = ['<nav class="ref-toc" aria-label="Reference sidebar">']
toc.push('<h2>Sections</h2>')
toc.push('<ol>')
for (const a of anchors) {
  if (a.level <= 3) {
    toc.push('<li class="toc-l' + a.level + '"><a href="#' + a.id + '">' +
      esc(a.text.replace(/`/g, '')) + '</a></li>')
  }
}
toc.push('</ol>')
toc.push('</nav>')

const html = '<div class="ref-layout">\n' +
  toc.join('\n') + '\n' +
  '<article class="ref-body">\n' +
  out.join('\n') + '\n' +
  '</article>\n' +
  '</div>'

writeFileSync(join(OUT_DIR, 'reference.html'), html, 'utf-8')
process.stdout.write('built ' + join(OUT_DIR, 'reference.html') + '\n')
process.stdout.write('  ' + html.length + ' bytes  (' + (html.length / 1024).toFixed(1) + ' KB)\n')
process.stdout.write('  ' + anchors.length + ' heading anchors\n')
process.stdout.write('  ' + ref.verbList.length + ' verbs, ' + ref.coreList.length + ' core forms\n')
