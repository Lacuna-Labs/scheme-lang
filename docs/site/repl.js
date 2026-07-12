// docs/site/repl.js — the browser REPL widget.
//
// Imports the bundled interpreter from ./dist/scheme-lang.mjs and wires
// it to a live textarea + output pane inside the page.
//
// Features (v1.1 target):
//   • Line editor with Enter/Shift-Enter multi-line
//   • Syntax highlighting on output
//   • Tab-complete against the live env (verbs + core docs)
//   • Meta commands: ,help ,type ,doc ,namespace ,apropos ,time ,expand,
//                    ,save ,load ,clear ,reset ,keys
//   • Named results _ _1 _2 … up to _9
//   • Session save/load as .slat file download/upload
//   • Braille rendering for (circle …) etc.
//   • "Run" buttons in the reference paste code and evaluate
//
// No animation. No spinners. Warm center, muted periphery.

import {
  parse, evaluate, expandProgram, makeBaseEnv,
  Sym, Env, Closure, CORE_DOCS,
} from './dist/scheme-lang.mjs'

const DEFAULT_FUEL = 200000

// ── highlighter (matches render-ref.mjs) ────────────────────────────
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
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlight(src) {
  const out = []
  const n = src.length
  let i = 0, depth = 0
  while (i < n) {
    const c = src[i]
    if (c === ';') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      out.push('<span class="c-comment">' + esc(src.slice(i, j)) + '</span>')
      i = j; continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\' && j + 1 < n) { j += 2; continue }
        if (src[j] === '"') { j++; break }
        j++
      }
      out.push('<span class="c-string">' + esc(src.slice(i, j)) + '</span>')
      i = j; continue
    }
    if (c === '#' && i + 1 < n && (src[i + 1] === 't' || src[i + 1] === 'f')) {
      let j = i + 2
      while (j < n && /[a-z]/.test(src[j])) j++
      out.push('<span class="c-number">' + esc(src.slice(i, j)) + '</span>')
      i = j; continue
    }
    if (/[0-9]/.test(c) ||
      ((c === '-' || c === '+') && i + 1 < n && /[0-9.]/.test(src[i + 1]) &&
       (i === 0 || /[\s()]/.test(src[i - 1])))) {
      let j = i + 1
      while (j < n && /[0-9.eE+\-]/.test(src[j])) j++
      const tok = src.slice(i, j)
      if (/[0-9]/.test(tok)) {
        out.push('<span class="c-number">' + esc(tok) + '</span>')
        i = j; continue
      }
    }
    if (c === '(' || c === '[') {
      out.push('<span class="c-paren c-p' + (depth % 6) + '">' + esc(c) + '</span>')
      depth++; i++; continue
    }
    if (c === ')' || c === ']') {
      depth = Math.max(0, depth - 1)
      out.push('<span class="c-paren c-p' + (depth % 6) + '">' + esc(c) + '</span>')
      i++; continue
    }
    if (c === "'" || c === '`' || c === ',') {
      out.push('<span class="c-quote">' + esc(c) + '</span>')
      i++; continue
    }
    if (/[^\s()[\]"';`,]/.test(c)) {
      let j = i
      while (j < n && /[^\s()[\]"';`,]/.test(src[j])) j++
      const tok = src.slice(i, j)
      if (SPECIAL_FORMS.has(tok)) out.push('<span class="c-keyword">' + esc(tok) + '</span>')
      else if (KNOWN_FNS.has(tok)) out.push('<span class="c-fn">' + esc(tok) + '</span>')
      else if (tok.endsWith(':') || tok.startsWith(':')) out.push('<span class="c-meta">' + esc(tok) + '</span>')
      else out.push('<span class="c-sym">' + esc(tok) + '</span>')
      i = j; continue
    }
    out.push(esc(c))
    i++
  }
  return out.join('')
}

function isBalanced(src) {
  let paren = 0, bracket = 0, inStr = false, escaped = false, inCom = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inCom) { if (c === '\n') inCom = false; continue }
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (c === '\\') { escaped = true; continue }
      if (c === '"') { inStr = false; continue }
      continue
    }
    if (c === ';') { inCom = true; continue }
    if (c === '"') { inStr = true; continue }
    if (c === '(') paren++
    else if (c === ')') paren--
    else if (c === '[') bracket++
    else if (c === ']') bracket--
  }
  return paren === 0 && bracket === 0 && !inStr
}

function schemeFormat(v) {
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v === null || v === undefined) return '()'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return '(' + v.map(schemeFormat).join(' ') + ')'
  if (typeof v === 'function') return '#<procedure>'
  if (v instanceof Closure) return '#<closure>'
  if (typeof v === 'object') return '#<object>'
  return String(v)
}

function displayHTML(v) {
  if (v === undefined) return '<span class="repl-dim">;; ()</span>'
  if (v === null) return '<span class="repl-dim">()</span>'
  const s = schemeFormat(v)
  return highlight(s)
}

function renderBraille(v) {
  if (!Array.isArray(v) || v.length < 1) return null
  const head = v[0]
  if (!(head instanceof Sym)) return null
  const kind = head.name
  const W = 40, H = 20
  const px = 2 * W, py = 4 * H
  const grid = new Uint8Array(px * py)
  function put(x, y) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= px || y >= py) return
    grid[y * px + x] = 1
  }
  function scaleX(x) { return (x / 100) * px }
  function scaleY(y) { return (y / 100) * py }
  if (kind === 'circle' && v.length >= 4) {
    const cx = scaleX(v[1]), cy = scaleY(v[2]), r = (v[3] / 100) * Math.min(px, py)
    for (let a = 0; a < 360; a += 2) {
      const t = a * Math.PI / 180
      put(cx + r * Math.cos(t), cy + r * Math.sin(t))
    }
  } else if (kind === 'disc' && v.length >= 4) {
    const cx = scaleX(v[1]), cy = scaleY(v[2]), r = (v[3] / 100) * Math.min(px, py)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) put(cx + dx, cy + dy)
      }
    }
  } else if (kind === 'line' && v.length >= 5) {
    const x0 = scaleX(v[1]), y0 = scaleY(v[2]), x1 = scaleX(v[3]), y1 = scaleY(v[4])
    const dx = x1 - x0, dy = y1 - y0
    const steps = Math.max(Math.abs(dx), Math.abs(dy))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      put(x0 + dx * t, y0 + dy * t)
    }
  } else if (kind === 'rect' && v.length >= 5) {
    const x = scaleX(v[1]), y = scaleY(v[2]), w = scaleX(v[3]), h = scaleY(v[4])
    for (let i = 0; i <= w; i++) { put(x + i, y); put(x + i, y + h) }
    for (let j = 0; j <= h; j++) { put(x, y + j); put(x + w, y + j) }
  } else {
    return null
  }
  const bits = [
    [0, 0, 0x1], [0, 1, 0x2], [0, 2, 0x4], [0, 3, 0x40],
    [1, 0, 0x8], [1, 1, 0x10], [1, 2, 0x20], [1, 3, 0x80],
  ]
  const out = []
  for (let cy = 0; cy < H; cy++) {
    let row = ''
    for (let cx = 0; cx < W; cx++) {
      let byte = 0
      for (const [ox, oy, mask] of bits) {
        const gx = cx * 2 + ox, gy = cy * 4 + oy
        if (grid[gy * px + gx]) byte |= mask
      }
      row += byte === 0 ? ' ' : String.fromCharCode(0x2800 + byte)
    }
    out.push(row)
  }
  return out.join('\n')
}

class BrowserRepl {
  constructor(root) {
    this.root = root
    this.fuel = { n: DEFAULT_FUEL }
    this.env = makeBaseEnv(this.fuel)
    this.results = { last: undefined, list: [] }
    this.history = []
    this.historyIndex = -1
    this.sessionLines = []
    this.buffer = ''
    this.mount()
  }

  mount() {
    this.root.innerHTML = ''
      + '<div class="repl">'
      + '  <div class="repl-head">'
      + '    <span class="dot"></span>'
      + '    <span>sakura-scheme &middot; browser</span>'
      + '    <span class="head-actions">'
      + '      <button data-action="save" title="Save session (.slat)">save</button>'
      + '      <button data-action="load" title="Load .slat session">load</button>'
      + '      <button data-action="clear" title="Clear output">clear</button>'
      + '      <button data-action="reset" title="Reset environment">reset</button>'
      + '    </span>'
      + '  </div>'
      + '  <div class="repl-body" id="repl-out" role="log" aria-live="polite"></div>'
      + '  <div class="repl-input-row">'
      + '    <span class="repl-input-prompt" id="repl-prompt-glyph">sakura&gt;&nbsp;</span>'
      + '    <textarea class="repl-input" id="repl-input" rows="1"'
      + '      spellcheck="false" autocomplete="off" autocapitalize="off"'
      + '      autocorrect="off" aria-label="REPL input"></textarea>'
      + '  </div>'
      + '  <div class="repl-hint" id="repl-hint">'
      + '    Type an expression and press Enter. Tab completes. '
      + '    <span style="opacity:0.7">,help</span> for commands.'
      + '  </div>'
      + '</div>'
      + '<input type="file" id="repl-file-input" accept=".slat,.scm,.snb" style="display:none">'
    this.out = this.root.querySelector('#repl-out')
    this.input = this.root.querySelector('#repl-input')
    this.hint = this.root.querySelector('#repl-hint')
    this.promptGlyph = this.root.querySelector('#repl-prompt-glyph')
    this.fileInput = this.root.querySelector('#repl-file-input')

    this.input.addEventListener('keydown', (e) => this.onKey(e))
    this.input.addEventListener('input', () => this.autosize())

    this.root.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.action))
    })
    this.fileInput.addEventListener('change', (e) => this.handleFile(e))

    this.writeBanner()
    this.rebindResults()
  }

  autosize() {
    const el = this.input
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
    this.updateHint()
    if (el.value && !isBalanced(el.value)) {
      this.promptGlyph.innerHTML = '&nbsp;&nbsp;&nbsp;~&gt;&nbsp;'
    } else {
      this.promptGlyph.innerHTML = 'sakura&gt;&nbsp;'
    }
  }

  updateHint() {
    const val = this.input.value
    const cursor = this.input.selectionStart
    let depth = 0
    let openAt = -1
    for (let i = cursor - 1; i >= 0; i--) {
      const c = val[i]
      if (c === ')') depth++
      else if (c === '(') {
        if (depth === 0) { openAt = i; break }
        depth--
      }
    }
    if (openAt < 0) {
      this.hint.innerHTML = 'Type an expression and press Enter. Tab completes. <span style="opacity:0.7">,help</span> for commands.'
      return
    }
    let j = openAt + 1
    while (j < val.length && /\s/.test(val[j])) j++
    const start = j
    while (j < val.length && !/[\s()[\]"'`,]/.test(val[j])) j++
    const head = val.slice(start, j)
    if (head && CORE_DOCS[head]) {
      const info = CORE_DOCS[head]
      this.hint.innerHTML = highlight(info.sig) + '  <span style="opacity:0.7">&mdash; ' + esc(info.doc) + '</span>'
      return
    }
    this.hint.innerHTML = '&nbsp;'
  }

  writeBanner() {
    const version = this.root.dataset.version || '1.0'
    const lines = [
      '',
      '  <span style="color:var(--petal)">&#10047; &#10047; &middot;</span>   <strong>Sakura Scheme</strong> <span class="repl-dim">v' + esc(version) + '</span>',
      '  <span style="color:var(--bloom)">&#10047; &#10047; &#10047;</span>   <span class="repl-dim">a language for humans and AI</span>',
      '  <span style="color:var(--petal)">&middot; &#10047; &middot;</span>   <span class="repl-dim">to program together</span>',
      '     <span style="color:var(--moss)">&#9474;</span>',
      '   <span style="color:var(--sage)">~~~~~</span>',
      '',
      '  <span class="repl-dim">,help &middot; ,keys &middot; ,ask sakura &middot; ,save</span>',
      '',
    ]
    for (const l of lines) this.writeRawLine(l)
  }

  writeRawLine(html) {
    const div = document.createElement('div')
    div.className = 'repl-line'
    div.innerHTML = html
    this.out.appendChild(div)
    this.out.scrollTop = this.out.scrollHeight
  }

  writeLine(text, cls) {
    const div = document.createElement('div')
    div.className = 'repl-line ' + (cls || 'repl-out')
    div.textContent = text
    this.out.appendChild(div)
    this.out.scrollTop = this.out.scrollHeight
  }

  writeInputEcho(text) {
    const div = document.createElement('div')
    div.className = 'repl-line'
    const lines = text.split('\n')
    div.innerHTML = lines.map((l, i) =>
      '<span class="' + (i === 0 ? 'repl-prompt' : 'repl-cont') + '">' +
      (i === 0 ? 'sakura&gt; ' : '   ~&gt; ') + '</span>' +
      highlight(l)
    ).join('\n')
    this.out.appendChild(div)
    this.out.scrollTop = this.out.scrollHeight
  }

  onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const val = this.input.value
      if (val && isBalanced(val)) {
        e.preventDefault()
        this.submit(val)
        return
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      this.complete()
      return
    }
    if (e.key === 'ArrowUp' && !this.input.value.includes('\n')) {
      if (this.history.length === 0) return
      e.preventDefault()
      if (this.historyIndex === -1) this.historyIndex = this.history.length - 1
      else if (this.historyIndex > 0) this.historyIndex--
      this.input.value = this.history[this.historyIndex] || ''
      this.autosize()
      return
    }
    if (e.key === 'ArrowDown' && !this.input.value.includes('\n')) {
      if (this.historyIndex === -1) return
      e.preventDefault()
      this.historyIndex++
      if (this.historyIndex >= this.history.length) {
        this.historyIndex = -1
        this.input.value = ''
      } else {
        this.input.value = this.history[this.historyIndex] || ''
      }
      this.autosize()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault()
      this.handleAction('clear')
      return
    }
  }

  complete() {
    const val = this.input.value
    const cursor = this.input.selectionStart
    let start = cursor
    while (start > 0 && !/[\s()[\]"'`,]/.test(val[start - 1])) start--
    const query = val.slice(start, cursor)
    if (!query) return
    if (val.slice(0, cursor).startsWith(',') && !/\s/.test(val.slice(0, cursor))) {
      const q = val.slice(1, cursor)
      const cmds = ['help', 'type', 'doc', 'arity', 'examples', 'source',
                    'apropos', 'namespace', 'search', 'time', 'expand',
                    'clear', 'reset', 'keys', 'save', 'load', 'ask',
                    'exit', 'quit'].filter(n => n.startsWith(q))
      if (cmds.length === 1) {
        this.input.value = ',' + cmds[0] + ' ' + val.slice(cursor)
        this.input.selectionStart = this.input.selectionEnd = cmds[0].length + 2
        this.autosize()
      } else if (cmds.length > 1) {
        this.writeLine('  ' + cmds.join('   '), 'repl-dim')
      }
      return
    }
    const names = new Set(Object.keys(CORE_DOCS))
    this.walkEnv((k) => names.add(k))
    const q = query.toLowerCase()
    const prefix = [...names].filter(n => n.toLowerCase().startsWith(q))
    let matches = prefix
    if (prefix.length === 0) {
      matches = [...names].filter(n => n.toLowerCase().includes(q))
    }
    matches.sort()
    if (matches.length === 1) {
      const insert = matches[0]
      this.input.value = val.slice(0, start) + insert + val.slice(cursor)
      const newPos = start + insert.length
      this.input.selectionStart = this.input.selectionEnd = newPos
      this.autosize()
    } else if (matches.length > 1) {
      const lcp = matches.reduce((a, b) => {
        let i = 0
        while (i < a.length && i < b.length && a[i] === b[i]) i++
        return a.slice(0, i)
      })
      if (lcp.length > query.length) {
        this.input.value = val.slice(0, start) + lcp + val.slice(cursor)
        this.input.selectionStart = this.input.selectionEnd = start + lcp.length
        this.autosize()
      }
      const head = matches.slice(0, 12).join('   ')
      this.writeLine('  ' + head + (matches.length > 12 ? '   … +' + (matches.length - 12) + ' more' : ''), 'repl-dim')
    }
  }

  walkEnv(cb) {
    let e = this.env
    while (e) {
      if (e.vars && e.vars.forEach) e.vars.forEach((_, k) => cb(k))
      e = e.parent
    }
  }

  hasBinding(name) {
    let e = this.env
    while (e) {
      if (e.vars && e.vars.has && e.vars.has(name)) return true
      e = e.parent
    }
    return false
  }

  submit(src) {
    this.writeInputEcho(src)
    this.input.value = ''
    this.autosize()
    this.history.push(src)
    this.historyIndex = -1

    if (src.startsWith(',')) {
      this.dispatchMeta(src)
      return
    }
    this.sessionLines.push(src)
    try {
      const forms = parse(src)
      const { forms: expanded } = expandProgram(forms)
      let last
      for (const f of expanded) last = this.evalReplForm(f)
      this.results.last = last
      this.results.list.push(last)
      if (this.results.list.length > 20) this.results.list.shift()
      this.rebindResults()

      const braille = renderBraille(last)
      if (braille) {
        this.writeLine(braille, 'repl-out')
      } else {
        this.writeRawLine(displayHTML(last))
      }
    } catch (err) {
      this.writeLine('error: ' + (err && err.message ? err.message : String(err)), 'repl-err')
    }
    this.fuel.n = DEFAULT_FUEL
  }

  evalReplForm(form) {
    const AUTO_QUOTE = new Set(['circle', 'disc', 'line', 'rect', 'shapes', 'plot'])
    if (Array.isArray(form) && form.length >= 2
        && form[0] && form[0].name === 'open'
        && !this.hasBinding('open')) {
      const arg = form[1]
      const argName = arg && arg.name ? arg.name
        : (Array.isArray(arg) && arg[0] && arg[0].name === 'quote' && arg[1] && arg[1].name)
        ? arg[1].name : null
      if (argName === 'pod-bay-doors' || argName === 'the-pod-bay-doors') {
        return "I'm sorry Dave. I'm afraid I can't do that."
      }
    }
    if (Array.isArray(form) && form.length >= 1
        && form[0] && form[0].name
        && AUTO_QUOTE.has(form[0].name)
        && !this.hasBinding(form[0].name)) {
      return form
    }
    return evaluate(form, this.env, this.fuel)
  }

  rebindResults() {
    try {
      this.env.define('_', this.results.last, { perm: 'read' })
      for (let i = 1; i <= 9 && i <= this.results.list.length; i++) {
        this.env.define('_' + i, this.results.list[this.results.list.length - i], { perm: 'read' })
      }
    } catch { /* ignore */ }
  }

  handleAction(action) {
    if (action === 'clear') {
      this.out.innerHTML = ''
      this.writeBanner()
    } else if (action === 'reset') {
      this.fuel = { n: DEFAULT_FUEL }
      this.env = makeBaseEnv(this.fuel)
      this.results = { last: undefined, list: [] }
      this.sessionLines = []
      this.out.innerHTML = ''
      this.writeBanner()
      this.writeLine('  env reset.', 'repl-dim')
    } else if (action === 'save') {
      this.saveSession()
    } else if (action === 'load') {
      this.fileInput.click()
    }
  }

  handleFile(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      this.loadSession(String(reader.result))
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  saveSession() {
    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const payload = [
      '# scheme-lang session — ' + now,
      '# dialect: sakura',
      '# version: ' + (this.root.dataset.version || '1.0'),
      '',
      ...this.sessionLines,
      '',
    ].join('\n')
    const blob = new Blob([payload], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'session-' + now + '.slat'
    a.click()
    URL.revokeObjectURL(url)
    this.writeLine('  saved ' + this.sessionLines.length + ' lines', 'repl-dim')
  }

  loadSession(text) {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
    this.writeLine('  loading ' + lines.length + ' lines…', 'repl-dim')
    let acc = ''
    for (const l of lines) {
      acc += (acc ? '\n' : '') + l
      if (isBalanced(acc)) {
        this.submit(acc)
        acc = ''
      }
    }
    if (acc.trim()) {
      this.writeLine('  (dropped trailing unbalanced fragment)', 'repl-dim')
    }
  }

  dispatchMeta(line) {
    const rest = line.slice(1).trim()
    if (!rest) return this.cmdHelp([])
    const parts = rest.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)
    switch (cmd) {
      case 'help': case 'h': case '?': return this.cmdHelp(args)
      case 'type': case 't': return this.cmdType(args)
      case 'doc': return this.cmdDoc(args)
      case 'arity': return this.cmdArity(args)
      case 'examples': case 'ex': return this.cmdExamples(args)
      case 'apropos': case 'ap': return this.cmdApropos(args)
      case 'namespace': case 'ns': return this.cmdNamespace(args)
      case 'search': return this.cmdSearch(args)
      case 'time': return this.cmdTime(args)
      case 'expand': case 'expand-1': return this.cmdExpand(args)
      case 'clear': case 'cls': return this.handleAction('clear')
      case 'reset': return this.handleAction('reset')
      case 'keys': case 'keybindings': return this.cmdKeys()
      case 'save': return this.saveSession()
      case 'load': return this.fileInput.click()
      case 'ask': return this.cmdAsk(args)
      case 'exit': case 'quit': case 'q':
        this.writeLine('  goodbye ✿', 'repl-dim')
        return
      default:
        this.writeLine('  unknown command: ,' + cmd + '  ·  try ,help', 'repl-err')
    }
  }

  cmdHelp(args) {
    if (args[0]) return this.cmdVerbHelp(args[0])
    const rows = [
      [',help [verb]',    'this help, or verb-specific help'],
      [',type <sym>',     'type / signature'],
      [',doc <sym>',      'docstring only'],
      [',arity <sym>',    'arity only'],
      [',examples <sym>', 'three tiered examples'],
      [',apropos <re>',   'matching symbols'],
      [',namespace <ns>', 'verbs in namespace'],
      [',search <re>',    'search docs + examples'],
      [',time <expr>',    'wall + fuel for expr'],
      [',expand <form>',  'macro-expand'],
      [',save',           'download session as .slat'],
      [',load',           'load a .slat session'],
      [',clear',          'clear the screen'],
      [',reset',          'reset environment'],
      [',keys',           'key bindings'],
      [',ask sakura <q>', 'ask Sakura (offline stub)'],
      [',exit',           'leave (or close the tab)'],
    ]
    this.writeLine('')
    this.writeLine('REPL commands', 'repl-info')
    this.writeLine('')
    for (const [c, d] of rows) {
      this.writeLine('  ' + c.padEnd(20) + '  ' + d, 'repl-dim')
    }
    this.writeLine('')
    this.writeLine('  Named results: _  = last   _1 = previous   _2 = before   … up to _9', 'repl-dim')
    this.writeLine('  Balanced Enter evaluates; unbalanced Enter adds a newline.', 'repl-dim')
    this.writeLine('')
  }

  cmdVerbHelp(name) {
    const info = CORE_DOCS[name]
    if (!info) {
      const bound = this.envLookup(name)
      if (bound !== null) {
        this.writeLine('')
        this.writeLine(name + '  · ' + (typeof bound === 'function' ? 'primitive' : 'value'), 'repl-out')
        return
      }
      return this.writeLine('  no info for \'' + name + '\'  ·  try ,apropos ' + name, 'repl-err')
    }
    this.writeLine('')
    this.writeRawLine('<strong>' + esc(name) + '</strong>')
    if (info.sig) this.writeRawLine('  ' + highlight(info.sig))
    if (info.doc) this.writeLine('  ' + info.doc)
    if (info.examples && info.examples.filter(Boolean).length) {
      this.writeLine('')
      this.writeLine('  examples:', 'repl-dim')
      for (const ex of info.examples) if (ex) this.writeRawLine('    ' + highlight(ex))
    }
    this.writeLine('')
  }

  cmdType(args) {
    const info = CORE_DOCS[args[0]]
    if (!info) return this.writeLine('  no info for \'' + args[0] + '\'', 'repl-err')
    this.writeLine(info.sig)
  }

  cmdDoc(args) {
    const info = CORE_DOCS[args[0]]
    if (!info) return this.writeLine('  no doc for \'' + args[0] + '\'', 'repl-err')
    this.writeLine(info.doc || '(no docstring)')
  }

  cmdArity(args) {
    const name = args[0]
    const info = CORE_DOCS[name]
    if (info) return this.writeLine(info.sig)
    const bound = this.envLookup(name)
    if (bound !== null && typeof bound === 'function') {
      return this.writeLine(name + ': ' + bound.length + ' required argument(s)')
    }
    this.writeLine('  no info for \'' + name + '\'', 'repl-err')
  }

  cmdExamples(args) {
    const info = CORE_DOCS[args[0]]
    if (!info || !info.examples) return this.writeLine('  no examples for \'' + args[0] + '\'', 'repl-err')
    const labels = ['novice', 'intermediate', 'expert']
    info.examples.forEach((ex, i) => {
      if (!ex) return
      this.writeRawLine('  <span class="repl-dim">' + labels[i] + ':</span>  ' + highlight(ex))
    })
  }

  cmdApropos(args) {
    const q = args.join(' ')
    if (!q) return this.writeLine('  usage: ,apropos <regex>', 'repl-err')
    let re
    try { re = new RegExp(q, 'i') } catch (e) { return this.writeLine('  bad regex: ' + e.message, 'repl-err') }
    const names = new Set(Object.keys(CORE_DOCS))
    this.walkEnv((k) => names.add(k))
    const hits = [...names].filter(n => re.test(n)).sort()
    if (!hits.length) return this.writeLine('  (no matches)', 'repl-dim')
    const cellW = Math.max(...hits.map(n => n.length)) + 2
    const cols = Math.max(1, Math.floor(60 / cellW))
    for (let i = 0; i < hits.length; i += cols) {
      const row = hits.slice(i, i + cols).map(n => n.padEnd(cellW)).join('')
      this.writeLine('  ' + row)
    }
  }

  cmdNamespace(args) {
    const ns = args[0]
    if (!ns) return this.writeLine('  usage: ,namespace <prefix>', 'repl-err')
    const names = new Set(Object.keys(CORE_DOCS))
    this.walkEnv((k) => names.add(k))
    const hits = [...names].filter(n => n.startsWith(ns + '/') || n.startsWith(ns + '-')).sort()
    if (!hits.length) return this.writeLine('  (no verbs in namespace \'' + ns + '\')', 'repl-dim')
    this.writeLine(ns + '/  (' + hits.length + ' verbs)', 'repl-info')
    for (const n of hits) this.writeLine('  ' + n)
  }

  cmdSearch(args) {
    const q = args.join(' ')
    if (!q) return this.writeLine('  usage: ,search <regex>', 'repl-err')
    let re
    try { re = new RegExp(q, 'i') } catch (e) { return this.writeLine('  bad regex: ' + e.message, 'repl-err') }
    const hits = []
    for (const [name, doc] of Object.entries(CORE_DOCS)) {
      if (re.test(name) || re.test(doc.doc || '') || (doc.examples || []).some(e => re.test(e))) {
        hits.push({ name, sig: doc.sig, doc: doc.doc })
      }
    }
    if (!hits.length) return this.writeLine('  (no matches)', 'repl-dim')
    for (const h of hits) {
      this.writeRawLine('<strong>' + esc(h.name) + '</strong>  ' + highlight(h.sig || ''))
      if (h.doc) this.writeLine('  ' + h.doc, 'repl-dim')
    }
  }

  cmdTime(args) {
    const src = args.join(' ')
    if (!src) return this.writeLine('  usage: ,time <expr>', 'repl-err')
    const startFuel = this.fuel.n
    const t0 = performance.now()
    try {
      const forms = parse(src)
      const { forms: expanded } = expandProgram(forms)
      let result
      for (const f of expanded) result = this.evalReplForm(f)
      const t1 = performance.now()
      this.writeRawLine(displayHTML(result))
      this.writeLine('  time: ' + (t1 - t0).toFixed(3) + 'ms   fuel: ' + (startFuel - this.fuel.n), 'repl-dim')
    } catch (e) {
      this.writeLine('  error: ' + e.message, 'repl-err')
    }
  }

  cmdExpand(args) {
    const src = args.join(' ')
    if (!src) return this.writeLine('  usage: ,expand <form>', 'repl-err')
    try {
      const forms = parse(src)
      const { forms: expanded } = expandProgram(forms)
      for (const f of expanded) this.writeRawLine(displayHTML(f))
    } catch (e) {
      this.writeLine('  expand error: ' + e.message, 'repl-err')
    }
  }

  cmdKeys() {
    const rows = [
      ['Enter',           'evaluate (if balanced) OR add a newline'],
      ['Shift-Enter',     'force newline'],
      ['Tab',             'complete symbol / meta command'],
      ['Up / Down',       'history (on single-line inputs)'],
      ['Ctrl-L',          'clear screen'],
    ]
    this.writeLine('')
    this.writeLine('key bindings', 'repl-info')
    this.writeLine('')
    for (const [k, d] of rows) {
      this.writeLine('  ' + k.padEnd(18) + '  ' + d, 'repl-dim')
    }
    this.writeLine('')
  }

  cmdAsk(args) {
    if (args[0] !== 'sakura') {
      return this.writeLine('  usage: ,ask sakura "<question>"', 'repl-err')
    }
    this.writeLine('')
    this.writeLine('  She hasn\'t arrived here yet — waiting for her.', 'repl-dim')
    this.writeLine('  This is the browser REPL. Her endpoint isn\'t wired.', 'repl-dim')
    this.writeLine('  Terminal REPL supports the same command — see ,ask sakura', 'repl-dim')
    this.writeLine('  in the local install for the current stub.', 'repl-dim')
    this.writeLine('')
  }

  envLookup(name) {
    let e = this.env
    while (e) {
      if (e.vars && e.vars.has && e.vars.has(name)) return e.vars.get(name)
      e = e.parent
    }
    return null
  }
}

export function mountRepl(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector
  if (!el) throw new Error('mountRepl: no element for ' + selector)
  return new BrowserRepl(el)
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('repl')
    if (!root) return
    const repl = new BrowserRepl(root)
    setTimeout(() => repl.input && repl.input.focus(), 30)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.run-btn')
      if (!btn) return
      const code = btn.dataset.run || ''
      repl.input.value = code
      repl.autosize()
      const section = document.getElementById('try-it')
      if (section) section.scrollIntoView({ behavior: 'auto', block: 'start' })
      repl.input.focus()
      if (isBalanced(code)) repl.submit(code)
    })
    const tryLink = document.querySelector('[data-try-it]')
    if (tryLink) {
      tryLink.addEventListener('click', (e) => {
        e.preventDefault()
        const section = document.getElementById('try-it')
        if (section) section.scrollIntoView({ behavior: 'auto', block: 'start' })
        setTimeout(() => repl.input.focus(), 50)
      })
    }
  })
}
