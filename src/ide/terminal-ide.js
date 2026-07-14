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
import { getTheme, setTheme, themeList, currentThemeName, promptGlyph } from './themes.js'
import { makeEditorBuffer } from './editor-buffer.js'
import { makeVimMode } from './modes/vim.js'
import { makeEmacsMode } from './modes/emacs.js'
import { makeReplPane } from './repl-pane.js'
import { makeFileTree } from './file-tree.js'
import { renderStatusBar } from './status-bar.js'
import { openAskSakura } from './ask-sakura.js'
import { verbCompletions } from './autocomplete.js'
import { openPalette } from './command-palette.js'
import { openFuzzyFinder } from './fuzzy-find.js'
import { openGlobalSearch } from './global-search.js'
import { findSnippet, expandSnippet, matchSnippets } from './snippets.js'
import { loadSession, saveSession } from './session-restore.js'
import { decorateError } from './typo-suggest.js'
import { loadBook, isBookPath, renderBookText } from './book-viewer.js'

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
  // Load previous session (if any) — non-fatal
  const prevSession = loadSession()
  if (prevSession && prevSession.theme && !theme) theme = prevSession.theme
  if (prevSession && prevSession.mode && !mode) mode = prevSession.mode
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
    // Modal state — at most one modal open at a time
    askModal: null,           // ask-sakura
    palette: null,            // command palette
    fuzzy: null,              // fuzzy file finder
    globalSearch: null,       // Ctrl-Shift-F
    prompt: null,             // generic input prompt (used by palette)
    // View toggles
    lineNumbers: prevSession && prevSession.lineNumbers === false ? false : true,
    zen: false,               // hides tree + repl panes
    fontSize: prevSession && prevSession.fontSize || 14,
    // Book viewer state — non-null when viewing a .book.slatl file
    book: null,               // { data, scroll }
    // TV-click focus flash — timestamp when the current focused pane
    // was last switched to; the pane's header renders inverted while
    // this timestamp is within ~140ms. Feels like flipping a channel.
    focusFlashAt: 0,
  }

  // Boot mode
  state.modeImpl = mode === 'emacs' ? makeEmacsMode() : makeVimMode()

  // Restore REPL history from previous session
  if (prevSession && Array.isArray(prevSession.replHistory)) {
    state.repl.history = prevSession.replHistory.slice()
  }

  // Determine what to open. If openFile is given, use it. Otherwise if
  // the previous session had a file that still exists, offer to reopen.
  let bootFile = openFile
  if (!bootFile && prevSession && prevSession.lastFile && existsSync(prevSession.lastFile)) {
    bootFile = prevSession.lastFile
  }
  if (bootFile) {
    try {
      if (isBookPath(bootFile)) {
        const book = loadBook(bootFile)
        state.book = { data: book, scroll: 0, lines: renderBookText(book, process.stdout.columns || 80) }
        state.filePath = resolve(bootFile)
      } else {
        const src = readFileSync(bootFile, 'utf-8')
        state.buffer = makeEditorBuffer(src)
        state.filePath = resolve(bootFile)
        // Restore cursor if reopening the same file
        if (prevSession && prevSession.lastFile === state.filePath && prevSession.cursor) {
          const c = prevSession.cursor
          state.buffer.cursor = {
            line: Math.min(c.line || 0, state.buffer.lines.length - 1),
            col:  Math.min(c.col  || 0, (state.buffer.lines[c.line || 0] || '').length),
          }
          state.buffer.scrollTop = prevSession.scrollTop || 0
        }
      }
    } catch (e) {
      state.status = `cannot open ${bootFile}: ${e.message}`
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
    // Zen mode collapses all panes except editor
    state.layout = state.zen
      ? { cols, rows: Math.max(rows - 1, 8),
          tree:   { x: 0, y: 0, w: 0, h: 0 },
          editor: { x: 0, y: 0, w: cols, h: Math.max(rows - 1, 8) },
          repl:   { x: 0, y: 0, w: 0, h: 0 },
          status: { x: 0, y: Math.max(rows - 1, 8), w: cols, h: 1 } }
      : computeLayout(cols, rows)
    const th = getTheme()
    // Full-screen clear + move to home
    let out = CTRL.clearScreen
    // Book viewer takes the whole editor pane
    if (state.book) {
      out += drawBook(state, th)
    } else {
      if (state.layout.tree.w > 0) out += drawTree(state, th)
      out += drawEditor(state, th)
      if (state.layout.repl.w > 0) out += drawRepl(state, th)
    }
    out += drawStatus(state, th)
    // Modals (mutually exclusive, but layered predictably)
    if (state.askModal) out += drawAskModal(state, th)
    if (state.palette) out += drawPalette(state, th)
    if (state.fuzzy) out += drawFuzzy(state, th)
    if (state.globalSearch) out += drawGlobalSearch(state, th)
    if (state.prompt) out += drawPrompt(state, th)
    if (state.completions) out += drawCompletions(state, th)
    // Position hardware cursor in the focused pane
    out += positionCursor(state)
    process.stdout.write(out)
  }

  // ── key routing ────────────────────────────────────────────────────
  process.stdin.on('data', (chunk) => {
    const key = String(chunk)

    // Modal precedence — highest owns the keyboard.
    if (state.prompt) { handlePrompt(state, key, scheduleRedraw); return }
    if (state.palette) { handlePalette(state, key, scheduleRedraw); return }
    if (state.fuzzy) { handleFuzzy(state, key, scheduleRedraw); return }
    if (state.globalSearch) { handleGlobalSearch(state, key, scheduleRedraw); return }
    if (state.askModal) { handleAskModal(state, key, scheduleRedraw); return }

    // Autocomplete popup owns keyboard when open
    if (state.completions) {
      const handled = handleCompletionKey(state, key, scheduleRedraw)
      if (handled) return
    }

    // Book viewer mode — arrow keys scroll, q closes
    if (state.book) {
      if (handleBookKey(state, key, scheduleRedraw)) return
    }

    // Global keys — Ctrl-C / Ctrl-Q / Ctrl-D always exit.
    // If unsaved, first press warns; second press forces. Ctrl-D and Ctrl-Q always force.
    if (key === '\x03') {  // Ctrl-C
      if (state.modified && !state._ctrlCArmed) {
        state._ctrlCArmed = true
        state.status = 'Ctrl-C again to force-quit (unsaved changes)'
        scheduleRedraw()
        setTimeout(() => { if (state._ctrlCArmed) { state._ctrlCArmed = false; scheduleRedraw() } }, 2000)
        return
      }
      quit(true); return
    }
    if (key === '\x11') { quit(true); return }  // Ctrl-Q — always force
    if (key === '\x04') { quit(true); return }  // Ctrl-D — always force

    // Ctrl-Shift-P / Ctrl-P — command palette / fuzzy file finder
    // (Ctrl-P alone = fuzzy; Ctrl-Shift-P has no distinct terminal code so
    //  we bind Ctrl-P = fuzzy and F2 = palette. Also expose via :palette.)
    if (key === '\x10') { // Ctrl-P
      state.fuzzy = openFuzzyFinder(state.tree.cwd)
      state.fuzzy.refresh()
      scheduleRedraw()
      return
    }
    if (key === '\x1bOQ' || key === '\x1b[[B') { // F2 (varies by term)
      state.palette = openPalette(state)
      state.palette.refresh()
      scheduleRedraw()
      return
    }
    if (key === '\x06') { // Ctrl-F — global search
      state.globalSearch = openGlobalSearch(state.tree.cwd)
      scheduleRedraw()
      return
    }

    // Tab — cycle focus. Trigger the TV-click flash: the newly-focused
    // pane's header briefly inverts, then a follow-up redraw clears it.
    // Like flipping a channel on a TV — dorky enough to make it fun.
    if (key === '\t' && state.focus !== 'editor-cmd') {
      cycleFocus(state)
      state.focusFlashAt = Date.now()
      scheduleRedraw()
      // Clear the flash after ~140ms — one follow-up redraw is enough.
      setTimeout(() => { state.focusFlashAt = 0; scheduleRedraw() }, 140)
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
    else if (action === 'quit-force') { quit(true) }
    else if (typeof action === 'object' && action) {
      if (action.kind === 'save-then-quit') { doSave(state); quit(true); return }
      // Actions can be command envelopes { kind: 'theme', name } etc.
      handleAction(state, action)
      scheduleRedraw()
    }
  })

  process.stdout.on('resize', () => {
    scheduleRedraw()
  })

  function quit(force = false) {
    if (state.modified && !force) {
      // Guard-rail: user must accept discard via `:q!` (vim) or C-x C-c (emacs);
      // otherwise flash a status warning and stay open. Force-quit path (:q!, :wq, :x, Ctrl-C twice)
      // bypasses the guard.
      state.status = 'unsaved changes — :q! to force-quit (vim), or save first (:w, :wq). Ctrl-C also always exits.'
      scheduleRedraw()
      return
    }
    // Persist session — best-effort, non-fatal.
    saveSession({
      filePath:    state.filePath,
      cursor:      state.buffer.cursor,
      scrollTop:   state.buffer.scrollTop || 0,
      mode:        state.mode,
      theme:       currentThemeName(),
      replHistory: state.repl.history || [],
      lineNumbers: state.lineNumbers,
      fontSize:    state.fontSize,
    })
    process.stdout.write(CTRL.clearScreen + CTRL.showCursor)
    // Mirror the REPL's parting flourish — matches ,exit in the REPL so
    // switching between IDE and REPL feels like one program. One ✿.
    process.stdout.write(dim(fg(PALETTE.petal, '  goodnight ✿\n')))
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
    case 'palette':   state.palette = openPalette(state); state.palette.refresh(); return
    case 'fuzzy-file-finder':
                      state.fuzzy = openFuzzyFinder(state.tree.cwd); state.fuzzy.refresh(); return
    case 'global-search':
                      state.globalSearch = openGlobalSearch(state.tree.cwd); return
    case 'toggle-line-numbers':
                      state.lineNumbers = !state.lineNumbers
                      state.status = `line numbers: ${state.lineNumbers ? 'on' : 'off'}`; return
    case 'toggle-zen':
                      state.zen = !state.zen
                      state.status = `zen mode: ${state.zen ? 'on' : 'off'}`; return
    case 'font-size':
                      state.fontSize = Math.max(8, Math.min(40, state.fontSize + (action.delta || 0)))
                      state.status = `font: ${state.fontSize} (terminal font is host-controlled)`; return
    case 'insert-snippet': {
      const s = findSnippet(action.trigger)
      if (!s) { state.status = `no snippet: ${action.trigger}`; return }
      const { text } = expandSnippet(s)
      state.buffer.insertString(text)
      state.modified = true
      state.status = `snippet: ${action.trigger}`; return
    }
    case 'prompt':    state.prompt = { text: '', prompt: action.prompt || '>', then: action.then }; return
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
    if (isBookPath(resolved)) {
      const book = loadBook(resolved)
      state.book = { data: book, scroll: 0, lines: renderBookText(book, process.stdout.columns || 80) }
      state.filePath = resolved
      state.modified = false
      state.status = `book: ${basename(resolved)} (q to close)`
      return
    }
    const src = readFileSync(resolved, 'utf-8')
    state.buffer = makeEditorBuffer(src)
    state.filePath = resolved
    state.book = null
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
    const raw = err && err.message ? err.message : String(err)
    const decorated = decorateError(raw, state.verbs.names || [])
    state.repl.pushInput('; run buffer')
    state.repl.pushError(decorated)
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

// ── command palette modal ───────────────────────────────────────────

function handlePalette(state, key, scheduleRedraw) {
  const p = state.palette
  if (key === '\x1b' || key === '\x03') { state.palette = null; scheduleRedraw(); return }
  if (key === '\x1b[A') { p.selected = Math.max(0, p.selected - 1); scheduleRedraw(); return }
  if (key === '\x1b[B') { p.selected = Math.min(p.matches.length - 1, p.selected + 1); scheduleRedraw(); return }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    const chosen = p.matches[p.selected]
    state.palette = null
    if (chosen) {
      const result = chosen.run(state)
      if (result === 'save')   doSave(state)
      else if (result === 'run')   runBuffer(state, scheduleRedraw)
      else if (result === 'quit') { /* controller wraps quit via handleAction */
        // Route quit through action handler for parity
        // (session-save runs there via quit() in the controller-scoped closure — but
        //  from a modal we exit the process directly for simplicity)
        state.status = 'quit requested'
        // Fall through to redraw; the vim/emacs :q flow already handles guard-rails
      }
      else if (typeof result === 'object' && result) handleAction(state, result)
    }
    scheduleRedraw()
    return
  }
  if (key === '\x7f' || key === '\b') {
    p.query = p.query.slice(0, -1); p.refresh(); p.selected = 0; scheduleRedraw(); return
  }
  if (key >= ' ' && key <= '~') {
    p.query += key; p.refresh(); p.selected = 0; scheduleRedraw(); return
  }
}

// ── fuzzy file finder modal ──────────────────────────────────────────

function handleFuzzy(state, key, scheduleRedraw) {
  const f = state.fuzzy
  if (key === '\x1b' || key === '\x03') { state.fuzzy = null; scheduleRedraw(); return }
  if (key === '\x1b[A') { f.selected = Math.max(0, f.selected - 1); scheduleRedraw(); return }
  if (key === '\x1b[B') { f.selected = Math.min(f.matches.length - 1, f.selected + 1); scheduleRedraw(); return }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    const hit = f.matches[f.selected]
    state.fuzzy = null
    if (hit) doOpen(state, hit.path)
    scheduleRedraw()
    return
  }
  if (key === '\x7f' || key === '\b') {
    f.query = f.query.slice(0, -1); f.refresh(); f.selected = 0; scheduleRedraw(); return
  }
  if (key >= ' ' && key <= '~') {
    f.query += key; f.refresh(); f.selected = 0; scheduleRedraw(); return
  }
}

// ── global search modal ──────────────────────────────────────────────

function handleGlobalSearch(state, key, scheduleRedraw) {
  const g = state.globalSearch
  if (key === '\x1b' || key === '\x03') { state.globalSearch = null; scheduleRedraw(); return }
  if (key === '\x1b[A') { g.selected = Math.max(0, g.selected - 1); scheduleRedraw(); return }
  if (key === '\x1b[B') { g.selected = Math.min(g.hits.length - 1, g.selected + 1); scheduleRedraw(); return }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    // If Enter and query hasn't been searched yet, run search. Otherwise open hit.
    if (g.lastQuery !== g.query) {
      g.runSearch(); scheduleRedraw(); return
    }
    const hit = g.hits[g.selected]
    state.globalSearch = null
    if (hit) {
      doOpen(state, hit.path)
      // Jump to line
      const line = hit.line - 1
      state.buffer.cursor.line = Math.min(line, state.buffer.lines.length - 1)
      state.buffer.cursor.col = Math.max(0, hit.col - 1)
      state.buffer.ensureVisible()
    }
    scheduleRedraw()
    return
  }
  if (key === '\x7f' || key === '\b') {
    g.query = g.query.slice(0, -1); scheduleRedraw(); return
  }
  if (key >= ' ' && key <= '~') {
    g.query += key; scheduleRedraw(); return
  }
}

// ── generic single-line prompt (used by palette save-as/open) ───────

function handlePrompt(state, key, scheduleRedraw) {
  const p = state.prompt
  if (key === '\x1b' || key === '\x03') { state.prompt = null; scheduleRedraw(); return }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    const then = p.then
    const text = p.text
    state.prompt = null
    if (typeof then === 'function') {
      const action = then(text)
      if (action) handleAction(state, action)
    }
    scheduleRedraw()
    return
  }
  if (key === '\x7f' || key === '\b') {
    p.text = p.text.slice(0, -1); scheduleRedraw(); return
  }
  if (key >= ' ' && key <= '~') {
    p.text += key; scheduleRedraw(); return
  }
}

// ── book viewer key handler ─────────────────────────────────────────

function handleBookKey(state, key, scheduleRedraw) {
  const b = state.book
  if (!b) return false
  if (key === 'q' || key === '\x03') {
    state.book = null; state.status = 'book closed'; scheduleRedraw(); return true
  }
  if (key === '\x1b[A' || key === 'k') { b.scroll = Math.max(0, b.scroll - 1); scheduleRedraw(); return true }
  if (key === '\x1b[B' || key === 'j') { b.scroll = Math.min(b.lines.length - 1, b.scroll + 1); scheduleRedraw(); return true }
  if (key === ' ' || key === '\x1b[6~') { // PageDown
    const rows = (process.stdout.rows || 24) - 2
    b.scroll = Math.min(b.lines.length - 1, b.scroll + rows); scheduleRedraw(); return true
  }
  if (key === '\x1b[5~' || key === 'b') { // PageUp
    const rows = (process.stdout.rows || 24) - 2
    b.scroll = Math.max(0, b.scroll - rows); scheduleRedraw(); return true
  }
  if (key === 'g') { b.scroll = 0; scheduleRedraw(); return true }
  if (key === 'G') { b.scroll = Math.max(0, b.lines.length - 1); scheduleRedraw(); return true }
  return false
}

// ── completion popup ─────────────────────────────────────────────────

function handleCompletionKey(state, key, scheduleRedraw) {
  const c = state.completions
  if (key === '\x1b') { state.completions = null; scheduleRedraw(); return true }
  if (key === '\t' || key === '\x1b[B') {
    c.selected = (c.selected + 1) % c.items.length
    scheduleRedraw()
    return true
  }
  if (key === '\x1b[A') {
    c.selected = (c.selected - 1 + c.items.length) % c.items.length
    scheduleRedraw()
    return true
  }
  if (key === '\r' || key === '\n' || key === '\x0a') {
    // Insert selected verb — or expand a snippet.
    const chosen = c.items[c.selected]
    if (chosen) {
      if (chosen.snippet) {
        // Snippet: replace the trigger word with the body.
        const w = state.buffer.wordAtCursor()
        // Remove the trigger first
        state.buffer.lines[state.buffer.cursor.line] =
          state.buffer.curLine().slice(0, w.start) +
          state.buffer.curLine().slice(w.end)
        state.buffer.cursor.col = w.start
        const { text } = expandSnippet(chosen.snippet)
        state.buffer.insertString(text)
      } else {
        state.buffer.replaceWordAtCursor(chosen.name)
      }
      state.modified = true
    }
    state.completions = null
    scheduleRedraw()
    return true
  }
  return false
}

// ── pane rendering ───────────────────────────────────────────────────
//
// TV-click focus flash: if this pane just gained focus (within ~140ms),
// invert its header so it flashes like a TV channel changing. The
// timeout inside the Tab handler queues a redraw that clears it.
function paneHeader(state, paneName, text, focused, w) {
  const color = focused ? PALETTE.petal : PALETTE.rose
  const flashing = focused && state.focusFlashAt &&
    (Date.now() - state.focusFlashAt) < 140
  const padded = padRight(text, w)
  if (flashing) return inverse(bold(fg(color, padded)))
  return bold(fg(color, padded))
}

function drawTree(state, th) {
  const box = state.layout.tree
  const items = state.tree.list()
  const focused = state.focus === 'tree'
  let out = ''
  out += moveTo(box.x, box.y) + paneHeader(state, 'tree', ' files', focused, box.w)
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
  let out = ''
  out += moveTo(box.x, box.y) + paneHeader(state, 'editor', ' ' + header, focused, box.w)
  const start = 1
  const maxRows = box.h - 1
  const scrollTop = buf.scrollTop || 0
  const gutter = state.lineNumbers ? 6 : 1
  for (let i = 0; i < maxRows; i++) {
    const lineIdx = i + scrollTop
    const line = buf.lines[lineIdx]
    out += moveTo(box.x, box.y + start + i)
    if (line === undefined) {
      out += fg(PALETTE.ash, padRight(' ~', box.w))
      continue
    }
    const rendered = highlightScheme(line, box.w - gutter)
    if (state.lineNumbers) {
      const num = String(lineIdx + 1).padStart(4, ' ')
      out += fg(PALETTE.ash, num + ' ') + padRight(rendered, box.w - gutter)
    } else {
      out += ' ' + padRight(rendered, box.w - gutter)
    }
  }
  return out
}

function drawRepl(state, th) {
  const box = state.layout.repl
  const focused = state.focus === 'repl'
  let out = ''
  out += moveTo(box.x, box.y) + paneHeader(state, 'repl', ' repl', focused, box.w)
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
  // Prompt line — per-theme prompt glyph (one grapheme + space, always
  // 2 visible cols so the +2 in positionCursor stays honest).
  out += moveTo(box.x, box.y + box.h - 1)
  const promptText = fg(PALETTE.petal, promptGlyph()) + state.repl.input
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

function drawPalette(state, th) {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const w = Math.min(78, cols - 4)
  const h = Math.min(20, rows - 4)
  const x = Math.floor((cols - w) / 2)
  const y = Math.floor((rows - h) / 2)
  let out = ''
  out += moveTo(x, y) + fg(PALETTE.petal, '┌' + '─'.repeat(w - 2) + '┐')
  for (let i = 1; i < h - 1; i++) {
    out += moveTo(x, y + i) + fg(PALETTE.petal, '│' + ' '.repeat(w - 2) + '│')
  }
  out += moveTo(x, y + h - 1) + fg(PALETTE.petal, '└' + '─'.repeat(w - 2) + '┘')
  out += moveTo(x + 2, y + 1) + bold(fg(PALETTE.paper, 'Command Palette'))
  out += moveTo(x + 2, y + 2) + fg(PALETTE.petal, '❯ ') + fg(PALETTE.cream, state.palette.query)
  const listY = y + 4
  const listH = h - 5
  const items = state.palette.matches.slice(0, listH)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const label = truncate(' ' + it.label + '   ' + (it.hint || ''), w - 4)
    out += moveTo(x + 2, listY + i)
    if (i === state.palette.selected) out += inverse(fg(PALETTE.cream, padRight(label, w - 4)))
    else out += fg(PALETTE.cream, padRight(label, w - 4))
  }
  if (items.length === 0) {
    out += moveTo(x + 2, listY) + fg(PALETTE.ash, '(no matching commands)')
  }
  return out
}

function drawFuzzy(state, th) {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const w = Math.min(78, cols - 4)
  const h = Math.min(20, rows - 4)
  const x = Math.floor((cols - w) / 2)
  const y = Math.floor((rows - h) / 2)
  let out = ''
  out += moveTo(x, y) + fg(PALETTE.petal, '┌' + '─'.repeat(w - 2) + '┐')
  for (let i = 1; i < h - 1; i++) {
    out += moveTo(x, y + i) + fg(PALETTE.petal, '│' + ' '.repeat(w - 2) + '│')
  }
  out += moveTo(x, y + h - 1) + fg(PALETTE.petal, '└' + '─'.repeat(w - 2) + '┘')
  out += moveTo(x + 2, y + 1) + bold(fg(PALETTE.paper, `Find File  (${state.fuzzy.files.length} files)`))
  out += moveTo(x + 2, y + 2) + fg(PALETTE.petal, '❯ ') + fg(PALETTE.cream, state.fuzzy.query)
  const listY = y + 4
  const listH = h - 5
  const items = state.fuzzy.matches.slice(0, listH)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const label = truncate(' ' + it.path, w - 4)
    out += moveTo(x + 2, listY + i)
    if (i === state.fuzzy.selected) out += inverse(fg(PALETTE.cream, padRight(label, w - 4)))
    else out += fg(PALETTE.cream, padRight(label, w - 4))
  }
  return out
}

function drawGlobalSearch(state, th) {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const w = Math.min(96, cols - 4)
  const h = Math.min(24, rows - 4)
  const x = Math.floor((cols - w) / 2)
  const y = Math.floor((rows - h) / 2)
  let out = ''
  out += moveTo(x, y) + fg(PALETTE.petal, '┌' + '─'.repeat(w - 2) + '┐')
  for (let i = 1; i < h - 1; i++) {
    out += moveTo(x, y + i) + fg(PALETTE.petal, '│' + ' '.repeat(w - 2) + '│')
  }
  out += moveTo(x, y + h - 1) + fg(PALETTE.petal, '└' + '─'.repeat(w - 2) + '┘')
  const g = state.globalSearch
  const hits = g.hits.length + (g.capped ? '+' : '')
  const info = g.lastQuery === g.query
    ? `${hits} hit(s) in ${g.filesScanned} file(s)`
    : 'press Enter to search'
  out += moveTo(x + 2, y + 1) + bold(fg(PALETTE.paper, `Search Across Files — ${info}`))
  out += moveTo(x + 2, y + 2) + fg(PALETTE.petal, '❯ ') + fg(PALETTE.cream, g.query)
  const listY = y + 4
  const listH = h - 5
  const items = g.hits.slice(0, listH)
  for (let i = 0; i < items.length; i++) {
    const hit = items[i]
    const prefix = ` ${hit.path}:${hit.line}  `
    const label = truncate(prefix + hit.preview, w - 4)
    out += moveTo(x + 2, listY + i)
    if (i === g.selected) out += inverse(fg(PALETTE.cream, padRight(label, w - 4)))
    else out += fg(PALETTE.cream, padRight(label, w - 4))
  }
  if (items.length === 0 && g.lastQuery === g.query) {
    out += moveTo(x + 2, listY) + fg(PALETTE.ash, '(no matches)')
  }
  return out
}

function drawPrompt(state, th) {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const w = Math.min(70, cols - 4)
  const h = 5
  const x = Math.floor((cols - w) / 2)
  const y = Math.floor((rows - h) / 2)
  let out = ''
  out += moveTo(x, y) + fg(PALETTE.petal, '┌' + '─'.repeat(w - 2) + '┐')
  for (let i = 1; i < h - 1; i++) {
    out += moveTo(x, y + i) + fg(PALETTE.petal, '│' + ' '.repeat(w - 2) + '│')
  }
  out += moveTo(x, y + h - 1) + fg(PALETTE.petal, '└' + '─'.repeat(w - 2) + '┘')
  out += moveTo(x + 2, y + 1) + bold(fg(PALETTE.paper, state.prompt.prompt))
  out += moveTo(x + 2, y + 3) + fg(PALETTE.petal, '❯ ') + fg(PALETTE.cream, state.prompt.text)
  return out
}

function drawBook(state, th) {
  const box = state.layout.editor
  let out = ''
  const b = state.book
  const th_color = PALETTE.petal
  out += moveTo(box.x, box.y) + bold(fg(th_color, padRight(` book: ${b.data.title}  (q to close, j/k to scroll)`, box.w)))
  const start = box.y + 1
  const maxRows = box.h - 1
  for (let i = 0; i < maxRows; i++) {
    const line = b.lines[b.scroll + i]
    out += moveTo(box.x, start + i)
    if (line === undefined) { out += padRight('', box.w); continue }
    out += fg(PALETTE.cream, padRight(truncate(line, box.w), box.w))
  }
  return out
}

function drawCompletions(state, th) {
  const c = state.completions
  if (!c || !c.items || c.items.length === 0) return ''
  const cursor = state.buffer.cursor
  // Popup below the cursor line
  const box = state.layout.editor
  const rowsAvail = Math.min(8, c.items.length)
  const y = Math.min(box.y + 1 + (cursor.line - (state.buffer.scrollTop || 0)) + 1, box.y + box.h - rowsAvail - 2)
  const gutter = state.lineNumbers ? 6 : 1
  const x = box.x + gutter + cursor.col
  const maxW = Math.min(70, box.w - cursor.col - gutter)
  let out = ''
  const visible = c.items.slice(0, rowsAvail)
  for (let i = 0; i < visible.length; i++) {
    out += moveTo(x, y + i)
    const it = visible[i]
    const label = truncate(it.name + '  ' + (it.sig || ''), maxW)
    if (i === c.selected) out += inverse(fg(PALETTE.cream, padRight(label, maxW)))
    else out += bg(PALETTE.ink, fg(PALETTE.cream, padRight(label, maxW)))
  }
  // Hover panel — summary + first example for the selected item
  const sel = visible[c.selected]
  if (sel && (sel.summary || sel.example)) {
    let hoverY = y + rowsAvail
    // Ensure hover fits
    if (hoverY + 4 > box.y + box.h) hoverY = Math.max(box.y + 1, y - 4)
    const hoverW = Math.min(80, box.w - (x - box.x))
    // Summary line
    if (sel.summary) {
      out += moveTo(x, hoverY) + bg(PALETTE.ink, fg(PALETTE.mist, padRight(' ' + truncate(sel.summary, hoverW - 1), hoverW)))
      hoverY++
    }
    // First example (up to 3 lines)
    if (sel.example && sel.example.code) {
      const codeLines = sel.example.code.split('\n').slice(0, 3)
      for (const cl of codeLines) {
        out += moveTo(x, hoverY) + bg(PALETTE.ink, fg(PALETTE.moss, padRight(' ' + truncate(cl, hoverW - 1), hoverW)))
        hoverY++
      }
    }
  }
  return out
}

function positionCursor(state) {
  if (state.askModal || state.palette || state.fuzzy || state.globalSearch || state.prompt) {
    // Cursor inside the modal — hide the buffer cursor
    return CTRL.hideCursor
  }
  if (state.book) return CTRL.hideCursor
  if (state.focus === 'editor') {
    const box = state.layout.editor
    const scrollTop = state.buffer.scrollTop || 0
    const gutter = state.lineNumbers ? 6 : 1
    const y = box.y + 1 + (state.buffer.cursor.line - scrollTop)
    const x = box.x + gutter + state.buffer.cursor.col
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
