// terminal-ide.js — Sakura Scheme Terminal IDE.
//
// A three-pane VSCode-shape layout using raw ANSI (no external deps).
// Panes: file explorer (left, narrow), editor (center, widest), REPL
// (right, medium). Bottom status bar. Tab cycles focus. Ctrl-Enter
// runs the current buffer or selection into the REPL.
//
// Modal editing — vim mode (normal / insert / visual / command) and
// emacs mode (non-modal, C-x prefixed commands). :theme switches
// palette at runtime.
//
// Ask Sakura — Ctrl-K opens a modal prompt. In v0.0 we surface a
// canned "I'd try: (verb args)" response using the reference tab-
// completion set. When the hosted mini-Sakura is wired, this becomes
// a real API call.
//
// Save — vim `:w` or emacs `C-x C-s` writes buffer to disk. New file
// prompts for path via a modal.
//
// This file is the harness. The individual features live in siblings:
//   editor-buffer.js — text buffer + line ops
//   modes/vim.js     — vim modal editor
//   modes/emacs.js   — emacs binding table
//   repl-pane.js     — REPL evaluation + history
//   file-tree.js     — narrow file explorer
//   status-bar.js    — bottom status
//   ask-sakura.js    — the natural-language widget
//
// Boot: startIde({ dialect, version, mode?: 'vim'|'emacs', theme?, cwd? }).

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, basename, dirname, relative } from 'node:path'
import { parse } from '../reader.js'
import { evaluate } from '../interp.js'
import { expandProgram } from '../macro.js'
import { makeSakuraEnv } from '../sakuraEnv.js'
import { schemeFormat } from '../repl/richDisplay.js'
import { role, PALETTE, CTRL, fg, bg, bold, dim, inverse, isColorEnabled } from '../repl/palette.js'
import { getTheme, setTheme, themeList, currentThemeName } from './themes.js'
import { makeEditorBuffer } from './editor-buffer.js'
import { makeVimMode } from './modes/vim.js'
import { makeEmacsMode } from './modes/emacs.js'
import { makeReplPane } from './repl-pane.js'
import { makeFileTree } from './file-tree.js'
import { renderStatusBar } from './status-bar.js'
import { openAskSakura } from './ask-sakura.js'
import { verbCompletions } from './autocomplete.js'

const DEFAULT_FUEL = 200000

// ── layout ───────────────────────────────────────────────────────────
//
// The terminal is divided into vertical columns then bottom status bar.
// Widths adapt to `process.stdout.columns`:
//   file tree:  min 18, max 28, default 22
//   editor:     everything left over
//   REPL:       min 32, max 60, default 40
//   status bar: 1 row bottom
//
// If the terminal is < 80 cols, we collapse to 2 panes (editor + REPL);
// < 60 cols, we collapse to 1 pane (editor) and swap panes with Tab.

function computeLayout(cols, rows) {
  const height = Math.max(rows - 1, 8) // reserve 1 row for status bar
  let treeW = 22, replW = 40
  if (cols < 100) { treeW = 18; replW = 32 }
  if (cols < 80)  { treeW = 0; replW = 30 }   // 2-pane
  if (cols < 60)  { treeW = 0; replW = 0 }    // 1-pane (Tab switches)
  const editorW = cols - treeW - replW - (treeW && replW ? 2 : (treeW || replW ? 1 : 0))
  return {
    cols, rows: height,
    tree: { x: 0, y: 0, w: treeW, h: height },
    editor: { x: treeW + (treeW ? 1 : 0), y: 0, w: editorW, h: height },
    repl: { x: treeW + (treeW ? 1 : 0) + editorW + (replW ? 1 : 0), y: 0, w: replW, h: height },
    status: { x: 0, y: height, w: cols, h: 1 },
  }
}

// ── the IDE controller ───────────────────────────────────────────────

export function startIde({
  dialect = 'sakura',
  version = '1.5.0',
  mode = 'vim',           // 'vim' | 'emacs'
  theme = 'sakura-dark',
  cwd = process.cwd(),
  openFile = null,        // optional file to open at boot
} = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('sakura-scheme ide: needs a TTY (are you piping in/out?)\n')
    process.exit(2)
  }
  setTheme(theme)
  const fuel = { n: DEFAULT_FUEL * 10 }
  const env = makeSakuraEnv(fuel)

  const state = {
    dialect, version,
    mode,                     // 'vim' | 'emacs'
    focus: 'editor',          // 'tree' | 'editor' | 'repl'
    buffer: makeEditorBuffer(''),
    filePath: null,           // current file (null = untitled)
    modified: false,
    tree: makeFileTree(cwd),
    repl: makeReplPane({ env, fuel }),
    completions: null,        // active autocomplete popup (or null)
    verbs: verbCompletions(env),
    status: '',               // transient status message
    layout: computeLayout(process.stdout.columns || 80, process.stdout.rows || 24),
    running: true,
    // vim/emacs mode object (with .handleKey(key, state))
    modeImpl: null,
    // ask-sakura modal state (null when not open)
    askModal: null,
  }

  // Boot mode
  state.modeImpl = mode === 'emacs' ? makeEmacsMode() : makeVimMode()

  if (openFile) {
    try {
      const src = readFileSync(openFile, 'utf-8')
      state.buffer = makeEditorBuffer(src)
      state.filePath = resolve(openFile)
    } catch (e) {
      state.status = `cannot open ${openFile}: ${e.message}`
    }
  }

  // ── raw-mode input ─────────────────────────────────────────────────
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf-8')

  // ── redraw ─────────────────────────────────────────────────────────
  let redrawPending = false
  function scheduleRedraw() {
    if (redrawPending) return
    redrawPending = true
    process.nextTick(() => { redrawPending = false; redraw() })
  }

  function redraw() {
    const cols = process.stdout.columns || 80
    const rows = process.stdout.rows || 24
    state.layout = computeLayout(cols, rows)
    const th = getTheme()
    // Full-screen clear + move to home
    let out = CTRL.clearScreen
    // Draw each pane
    if (state.layout.tree.w > 0) out += drawTree(state, th)
    out += drawEditor(state, th)
    if (state.layout.repl.w > 0) out += drawRepl(state, th)
    out += drawStatus(state, th)
    if (state.askModal) out += drawAskModal(state, th)
    if (state.completions) out += drawCompletions(state, th)
    // Position hardware cursor in the focused pane
    out += positionCursor(state)
    process.stdout.write(out)
  }

  // ── key routing ────────────────────────────────────────────────────
  process.stdin.on('data', (chunk) => {
    const key = String(chunk)

    // Ask-Sakura modal owns keyboard when open
    if (state.askModal) {
      handleAskModal(state, key, scheduleRedraw)
      return
    }

    // Autocomplete popup owns keyboard when open
    if (state.completions) {
      const handled = handleCompletionKey(state, key, scheduleRedraw)
      if (handled) return
    }

    // Global keys — Ctrl-C / Ctrl-Q quit
    if (key === '\x03') { quit(); return }  // Ctrl-C
    if (key === '\x11') { quit(); return }  // Ctrl-Q

    // Tab — cycle focus
    if (key === '\t' && state.focus !== 'editor-cmd') {
      cycleFocus(state)
      scheduleRedraw()
      return
    }

    // Ctrl-K — Ask Sakura
    if (key === '\x0b') {
      state.askModal = openAskSakura(state)
      scheduleRedraw()
      return
    }

    // Ctrl-Enter (Ctrl-J in most terminals) — run current buffer
    if (key === '\n' && state.focus === 'editor') {
      // Only in vim's insert or emacs mode should Enter insert a newline
      // Actual Ctrl-Enter is C-j = 0x0a; some terms send different.
    }
    if (key === '\x0a' && state.focus === 'editor') {
      runBuffer(state, scheduleRedraw)
      return
    }

    // Route to mode impl or REPL pane
    if (state.focus === 'repl') {
      state.repl.handleKey(key, state, scheduleRedraw)
      return
    }

    // Delegated to mode
    const action = state.modeImpl.handleKey(key, state)
    if (action === 'redraw') scheduleRedraw()
    else if (action === 'save') { doSave(state); scheduleRedraw() }
    else if (action === 'run')  { runBuffer(state, scheduleRedraw) }
    else if (action === 'quit') { quit() }
    else if (typeof action === 'object' && action) {
      // Actions can be command envelopes { kind: 'theme', name } etc.
      handleAction(state, action)
      scheduleRedraw()
    }
  })

  process.stdout.on('resize', () => {
    scheduleRedraw()
  })

  function quit() {
    if (state.modified) {
      // Guard-rail: user must accept discard via `:q!` (vim) or C-x C-c (emacs);
      // otherwise flash a status warning and stay open.
      state.status = 'unsaved changes — :q! to force-quit (vim), or save first'
      scheduleRedraw()
      return
    }
    process.stdout.write(CTRL.clearScreen + CTRL.showCursor)
    process.stdin.setRawMode(false)
    process.stdin.pause()
    process.exit(0)
  }

  // ── initial draw ───────────────────────────────────────────────────
  process.stdout.write(CTRL.hideCursor)
  scheduleRedraw()

  // Return API so tests can drive
  return {
    getState: () => state,
    quit,
  }
}

// ── actions ──────────────────────────────────────────────────────────

function handleAction(state, action) {
  switch (action.kind) {
    case 'save':      return doSave(state)
    case 'save-as':   return doSaveAs(state, action.path)
    case 'open':      return doOpen(state, action.path)
    case 'theme':     setTheme(action.name); state.status = `theme: ${action.name}`; return
    case 'mode':      state.mode = action.name; state.modeImpl = action.name === 'emacs' ? makeEmacsMode() : makeVimMode(); state.status = `mode: ${action.name}`; return
    case 'quit':      return  // handled inline by controller
    case 'ask':       state.askModal = openAskSakura(state); return
    case 'complete':  state.completions = state.verbs.match(state.buffer.wordAtCursor()); return
    case 'status':    state.status = action.msg; return
    default: break
  }
}

function doSave(state) {
  if (!state.filePath) { state.status = "use ':w <path>' to save a new file"; return }
  writeFileSync(state.filePath, state.buffer.toString(), 'utf-8')
  state.modified = false
  state.status = `wrote ${basename(state.filePath)}`
}

function doSaveAs(state, path) {
  const resolved = resolve(state.tree.cwd, path)
  writeFileSync(resolved, state.buffer.toString(), 'utf-8')
  state.filePath = resolved
  state.modified = false
  state.status = `wrote ${basename(resolved)}`
}

function doOpen(state, path) {
  const resolved = resolve(state.tree.cwd, path)
  try {
    const src = readFileSync(resolved, 'utf-8')
    state.buffer = makeEditorBuffer(src)
    state.filePath = resolved
    state.modified = false
    state.status = `opened ${basename(resolved)}`
  } catch (e) {
    state.status = `open failed: ${e.message}`
  }
}

function cycleFocus(state) {
  const order = ['editor', 'repl', 'tree']
  const filtered = order.filter(k => {
    if (k === 'tree') return state.layout.tree.w > 0
    if (k === 'repl') return state.layout.repl.w > 0
    return true
  })
  const i = filtered.indexOf(state.focus)
  state.focus = filtered[(i + 1) % filtered.length]
}

function runBuffer(state, scheduleRedraw) {
  const src = state.buffer.toString()
  try {
    const forms = parse(src)
    const { forms: expanded } = expandProgram(forms)
    const fuel = { n: DEFAULT_FUEL * 10 }
    let last
    for (const f of expanded) last = evaluate(f, state.repl.env, fuel)
    state.repl.pushInput('; run buffer')
    state.repl.pushResult(last)
    state.status = `ran ${forms.length} form(s)`
  } catch (err) {
    state.repl.pushInput('; run buffer')
    state.repl.pushError(err && err.message ? err.message : String(err))
    state.status = 'error — see REPL'
  }
  scheduleRedraw()
}

// ── ask-sakura modal ────────────────────────────────────────────────

function handleAskModal(state, key, scheduleRedraw) {
  const m = state.askModal
  if (key === '\x1b' || key === '\x03') { state.askModal = null; scheduleRedraw(); return }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    // Submit — resolve to a suggestion + insert at cursor
    const suggestion = m.resolve(state.verbs)
    if (suggestion) state.buffer.insertString(suggestion)
    state.askModal = null
    scheduleRedraw()
    return
  }
  if (key === '\x7f' || key === '\b') {
    m.query = m.query.slice(0, -1)
  } else if (key >= ' ' && key <= '~') {
    m.query += key
  }
  scheduleRedraw()
}

// ── completion popup ─────────────────────────────────────────────────

function handleCompletionKey(state, key, scheduleRedraw) {
  const c = state.completions
  if (key === '\x1b') { state.completions = null; scheduleRedraw(); return true }
  if (key === '\t') {
    c.selected = (c.selected + 1) % c.items.length
    scheduleRedraw()
    return true
  }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    // Insert selected verb
    const chosen = c.items[c.selected]
    if (chosen) {
      state.buffer.replaceWordAtCursor(chosen.name)
      state.modified = true
    }
    state.completions = null
    scheduleRedraw()
    return true
  }
  return false
}

// ── pane rendering ───────────────────────────────────────────────────

function drawTree(state, th) {
  const box = state.layout.tree
  const items = state.tree.list()
  const focused = state.focus === 'tree'
  let out = ''
  const headerColor = focused ? PALETTE.petal : PALETTE.rose
  out += moveTo(box.x, box.y) + bold(fg(headerColor, padRight(' files', box.w)))
  const start = 1
  const maxRows = box.h - 1
  for (let i = 0; i < maxRows; i++) {
    const item = items[i + state.tree.scroll]
    out += moveTo(box.x, box.y + start + i)
    if (!item) { out += padRight('', box.w); continue }
    const marker = item.isDir ? '▸ ' : '  '
    const label = truncate(marker + item.name, box.w)
    const line = padRight(label, box.w)
    if (i + state.tree.scroll === state.tree.cursor && focused) {
      out += inverse(fg(PALETTE.cream, line))
    } else if (item.isDir) {
      out += fg(PALETTE.frost, line)
    } else {
      out += fg(PALETTE.cream, line)
    }
  }
  // Vertical separator
  for (let i = 0; i < box.h; i++) {
    out += moveTo(box.x + box.w, box.y + i) + fg(PALETTE.ash, '│')
  }
  return out
}

function drawEditor(state, th) {
  const box = state.layout.editor
  const focused = state.focus === 'editor'
  const buf = state.buffer
  const header = state.filePath
    ? basename(state.filePath) + (state.modified ? ' •' : '')
    : '[untitled]' + (state.modified ? ' •' : '')
  const headerColor = focused ? PALETTE.petal : PALETTE.rose
  let out = ''
  out += moveTo(box.x, box.y) + bold(fg(headerColor, padRight(' ' + header, box.w)))
  const start = 1
  const maxRows = box.h - 1
  const scrollTop = buf.scrollTop || 0
  for (let i = 0; i < maxRows; i++) {
    const lineIdx = i + scrollTop
    const line = buf.lines[lineIdx]
    out += moveTo(box.x, box.y + start + i)
    if (line === undefined) {
      out += fg(PALETTE.ash, padRight(' ~', box.w))
      continue
    }
    const num = String(lineIdx + 1).padStart(4, ' ')
    const rendered = highlightScheme(line, box.w - 6)
    out += fg(PALETTE.ash, num + ' ') + padRight(rendered, box.w - 6)
  }
  return out
}

function drawRepl(state, th) {
  const box = state.layout.repl
  const focused = state.focus === 'repl'
  const headerColor = focused ? PALETTE.petal : PALETTE.rose
  let out = ''
  out += moveTo(box.x, box.y) + bold(fg(headerColor, padRight(' repl', box.w)))
  const start = 1
  const maxRows = box.h - 2 // leave a row for the prompt
  const lines = state.repl.lines
  const startIdx = Math.max(0, lines.length - maxRows)
  for (let i = 0; i < maxRows; i++) {
    const line = lines[startIdx + i]
    out += moveTo(box.x, box.y + start + i)
    if (line === undefined) { out += padRight('', box.w); continue }
    out += padRight(truncate(line, box.w), box.w)
  }
  // Prompt line
  out += moveTo(box.x, box.y + box.h - 1)
  const promptText = fg(PALETTE.petal, '❯ ') + state.repl.input
  out += padRight(promptText, box.w)
  // Left separator
  for (let i = 0; i < box.h; i++) {
    out += moveTo(box.x - 1, box.y + i) + fg(PALETTE.ash, '│')
  }
  return out
}

function drawStatus(state, th) {
  const box = state.layout.status
  const bar = renderStatusBar(state, box.w)
  return moveTo(box.x, box.y) + bar
}

function drawAskModal(state, th) {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const w = Math.min(70, cols - 4)
  const h = 6
  const x = Math.floor((cols - w) / 2)
  const y = Math.floor((rows - h) / 2)
  let out = ''
  // Border
  const borderColor = PALETTE.petal
  for (let i = 0; i < h; i++) {
    out += moveTo(x, y + i) + fg(borderColor, '│' + ' '.repeat(w - 2) + '│')
  }
  out += moveTo(x, y) + fg(borderColor, '┌' + '─'.repeat(w - 2) + '┐')
  out += moveTo(x, y + h - 1) + fg(borderColor, '└' + '─'.repeat(w - 2) + '┘')
  // Contents
  out += moveTo(x + 2, y + 1) + bold(fg(PALETTE.paper, 'Ask Sakura'))
  out += moveTo(x + 2, y + 2) + fg(PALETTE.mist, 'natural language → suggested code (Enter to insert, Esc to cancel)')
  out += moveTo(x + 2, y + 4) + fg(PALETTE.petal, '❯ ') + fg(PALETTE.cream, state.askModal.query)
  return out
}

function drawCompletions(state, th) {
  const c = state.completions
  if (!c || !c.items || c.items.length === 0) return ''
  const cursor = state.buffer.cursor
  // Popup below the cursor line
  const box = state.layout.editor
  const y = Math.min(box.y + 1 + (cursor.line - (state.buffer.scrollTop || 0)) + 1, box.y + box.h - c.items.length - 1)
  const x = box.x + 6 + cursor.col
  const maxW = Math.min(50, box.w - cursor.col - 6)
  let out = ''
  const visible = c.items.slice(0, Math.min(8, c.items.length))
  for (let i = 0; i < visible.length; i++) {
    out += moveTo(x, y + i)
    const it = visible[i]
    const label = truncate(it.name + ' ' + (it.sig || ''), maxW)
    if (i === c.selected) out += inverse(fg(PALETTE.cream, padRight(label, maxW)))
    else out += bg(PALETTE.ink, fg(PALETTE.cream, padRight(label, maxW)))
  }
  return out
}

function positionCursor(state) {
  if (state.askModal) {
    // Cursor inside the modal
    return CTRL.showCursor + moveTo(0, 0)
  }
  if (state.focus === 'editor') {
    const box = state.layout.editor
    const scrollTop = state.buffer.scrollTop || 0
    const y = box.y + 1 + (state.buffer.cursor.line - scrollTop)
    const x = box.x + 6 + state.buffer.cursor.col
    return CTRL.showCursor + moveTo(x, y)
  }
  if (state.focus === 'repl') {
    const box = state.layout.repl
    const y = box.y + box.h - 1
    const x = box.x + 2 + state.repl.input.length
    return CTRL.showCursor + moveTo(x, y)
  }
  return CTRL.hideCursor
}

// ── little helpers ───────────────────────────────────────────────────

function moveTo(x, y) {
  return `\x1b[${(y | 0) + 1};${(x | 0) + 1}H`
}

function padRight(s, w) {
  const visible = stripAnsi(s)
  if (visible.length >= w) return truncate(s, w)
  return s + ' '.repeat(w - visible.length)
}

function truncate(s, w) {
  const bare = stripAnsi(s)
  if (bare.length <= w) return s
  // simple visible-truncation — ANSI escapes are preserved but no
  // guarantee of pretty behavior with color spanning the cut. Ok for v0.
  return bare.slice(0, Math.max(0, w - 1)) + '…'
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
}

// Minimal Scheme highlighter — colors keywords, strings, numbers, comments.
const KEYWORDS = new Set([
  'define', 'lambda', 'if', 'when', 'unless', 'cond', 'case', 'let',
  'let*', 'letrec', 'set!', 'quote', 'quasiquote', 'unquote', 'begin',
  'and', 'or', 'do', 'named-lambda', 'define-syntax', 'syntax-rules',
])

export function highlightScheme(line, maxW) {
  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === ';') {
      // comment to end of line
      out += fg(PALETTE.ash, line.slice(i))
      break
    }
    if (ch === '"') {
      const start = i
      i++
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) i++
        i++
      }
      const s = line.slice(start, i + 1)
      out += fg(PALETTE.moss, s)
      i++
      continue
    }
    if (ch === '(' || ch === ')' || ch === '[' || ch === ']') {
      out += fg(PALETTE.mist, ch)
      i++
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(line[i + 1] || ''))) {
      const start = i
      while (i < line.length && /[-0-9.eE]/.test(line[i])) i++
      out += fg(PALETTE.amber, line.slice(start, i))
      continue
    }
    if (/[a-zA-Z!?<>=+\-*/_%^&:]/.test(ch)) {
      const start = i
      while (i < line.length && /[a-zA-Z0-9!?<>=+\-*/_%^&:.]/.test(line[i])) i++
      const word = line.slice(start, i)
      if (KEYWORDS.has(word)) out += bold(fg(PALETTE.ice, word))
      else out += fg(PALETTE.cream, word)
      continue
    }
    out += ch
    i++
  }
  return out
}

export default startIde
