#!/usr/bin/env node
// docs/site/render-ref.mjs — render the reference manual to HTML.
//
// Input:  docs/SAKURA-SCHEME-1.0.REF.md
// Output: docs/site/dist/reference.html
//
// Hand-rolled Markdown-subset renderer tailored to the reference's regular
// shape. No npm deps. Each fenced ```scheme block gets a Run button that
// pastes the code into the REPL widget and evaluates it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const REF_PATH = join(REPO_ROOT, 'docs', 'SAKURA-SCHEME-1.0.REF.md')
const OUT_DIR = join(__dirname, 'dist')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const src = readFileSync(REF_PATH, 'utf-8')

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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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

// ── inline rendering (bold, italic, code, links) ─────────────────────
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

// ── block rendering ──────────────────────────────────────────────────

const lines = src.split('\n')
const out = []
let i = 0
const anchors = []
let anchorCounter = 0

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

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
      out.push('<pre class="code scheme"><button class="run-btn" data-run="' + esc(code) + '" title="Send to REPL">Run</button><code>' + highlightScheme(code) + '</code></pre>')
    } else {
      out.push('<pre class="code ' + esc(lang) + '"><code>' + esc(code) + '</code></pre>')
    }
    continue
  }

  if (/^---\s*$/.test(line)) {
    out.push('<hr>')
    i++
    continue
  }

  const h = line.match(/^(#{1,6})\s+(.*)$/)
  if (h) {
    const level = h[1].length
    const raw = h[2].replace(/`/g, '')
    const id = 'h-' + slugify(raw) + '-' + (anchorCounter++)
    anchors.push({ level, text: raw, id })
    out.push('<h' + level + ' id="' + id + '">' + renderInline(h[2]) + '</h' + level + '>')
    i++
    continue
  }

  if (/^>\s?/.test(line)) {
    const buf = []
    while (i < lines.length && /^>\s?/.test(lines[i])) {
      buf.push(lines[i].replace(/^>\s?/, ''))
      i++
    }
    const inner = buf.join('\n').split(/\n\n+/).filter(Boolean).map(p =>
      '<p>' + renderInline(p.replace(/\n/g, ' ')) + '</p>'
    ).join('')
    out.push('<blockquote>' + inner + '</blockquote>')
    continue
  }

  if (/^\s*[-*]\s+/.test(line)) {
    const buf = []
    while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
      buf.push(lines[i].replace(/^\s*[-*]\s+/, ''))
      i++
    }
    out.push('<ul>' + buf.map(l => '<li>' + renderInline(l) + '</li>').join('') + '</ul>')
    continue
  }
  if (/^\s*\d+\.\s+/.test(line)) {
    const buf = []
    while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
      buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
      i++
    }
    out.push('<ol>' + buf.map(l => '<li>' + renderInline(l) + '</li>').join('') + '</ol>')
    continue
  }

  if (/^\s*$/.test(line)) {
    i++
    continue
  }

  const para = []
  while (i < lines.length && !/^\s*$/.test(lines[i])
    && !/^```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i])
    && !/^---\s*$/.test(lines[i]) && !/^>\s?/.test(lines[i])
    && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
    para.push(lines[i])
    i++
  }
  out.push('<p>' + renderInline(para.join(' ')) + '</p>')
}

const toc = ['<nav class="ref-toc" aria-label="Reference sidebar">']
toc.push('<h2>Sections</h2>')
toc.push('<ol>')
for (const a of anchors) {
  if (a.level <= 3) {
    toc.push('<li class="toc-l' + a.level + '"><a href="#' + a.id + '">' + esc(a.text.replace(/`/g, '')) + '</a></li>')
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
