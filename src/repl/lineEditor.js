// lineEditor.js — the raw-mode TTY line editor at the heart of the REPL.
//
// We manage input entirely ourselves rather than through node:readline
// because readline can't:
//   - render syntax highlighting on every keystroke
//   - show ghost hints / signatures above the input
//   - do multi-line balanced-paren editing cleanly
//   - handle vim mode
//   - do fuzzy Ctrl-R with our history semantics
//
// The rendering approach is "clear-and-repaint": on every state change,
// we compute a full multi-line display, diff against the previous frame,
// and write only what changed. This keeps redraws under 1KB/keystroke on
// typical input and stays crisp under 60Hz keystroke rate.
//
// Key sequences are decoded from stdin raw bytes. `parseKey(buf)` recognizes
// arrow keys, function keys, alt-combos, and the common control chars.
// Anything unrecognized is treated as a printable char if in the printable
// range, else dropped.
//
// Vim mode toggle: when `vim` is on, `Esc` enters normal mode, `i` returns
// to insert mode. Normal mode understands h/j/k/l/w/b/0/$/x/d/y/p/./u — a
// small vim subset. `Ctrl-O` opens the full buffer in $EDITOR at any time.

import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { highlight, isBalanced } from './highlight.js'
import { currentToken, completeSymbol, commonPrefix } from './complete.js'
import { role, PALETTE, fg, dim, CTRL } from './palette.js'
import { verbInfo, allKnownVerbs, CORE_DOCS } from './verbInfo.js'
import { metaCommandNames } from './metaCommands.js'
import { slurpForward, barfForward, slurpBackward, killForm } from './paredit.js'

// ── key decoder ──────────────────────────────────────────────────────

/** Map raw input bytes → normalized key event. */
function parseKey(buf) {
  const s = buf.toString('utf-8')
  const b = buf[0]

  // Single-byte controls
  if (s === '\r' || s === '\n') return { key: 'enter' }
  if (s === '\t') return { key: 'tab' }
  if (s === '\x7f' || s === '\b') return { key: 'backspace' }
  if (s === '\x03') return { key: 'ctrl-c' }
  if (s === '\x04') return { key: 'ctrl-d' }
  if (s === '\x0c') return { key: 'ctrl-l' }
  if (s === '\x01') return { key: 'ctrl-a' }
  if (s === '\x05') return { key: 'ctrl-e' }
  if (s === '\x0b') return { key: 'ctrl-k' }
  if (s === '\x15') return { key: 'ctrl-u' }
  if (s === '\x17') return { key: 'ctrl-w' }
  if (s === '\x12') return { key: 'ctrl-r' }
  if (s === '\x0f') return { key: 'ctrl-o' }
  if (s === '\x02') return { key: 'ctrl-b' }
  if (s === '\x06') return { key: 'ctrl-f' }
  if (s === '\x10') return { key: 'ctrl-p' }
  if (s === '\x0e') return { key: 'ctrl-n' }
  if (s === '\x1a') return { key: 'ctrl-z' }
  if (s === '\x14') return { key: 'ctrl-t' }
  if (s === '\x19') return { key: 'ctrl-y' }
  if (s === '\x11') return { key: 'ctrl-q' }
  if (s === '\x16') return { key: 'ctrl-v' }
  if (s === '\x18') return { key: 'ctrl-x' }
  // Paredit keys — Ctrl-] (0x1D) is splurge/barf-forward,
  // Ctrl-\ (0x1C) is slurp-forward. Ctrl-[ collides with Esc so we
  // reserve Alt-[ for slurp-backward and Alt-k for kill-form.
  if (s === '\x1d') return { key: 'ctrl-]' }
  if (s === '\x1c') return { key: 'ctrl-\\' }

  // ESC-based sequences
  if (b === 0x1b) {
    if (s === '\x1b') return { key: 'escape' }
    // Alt-<char>
    if (s.length === 2 && s[1] >= ' ' && s[1] <= '~') {
      return { key: 'alt-' + s[1] }
    }
    // Function / arrow / etc. sequences: ESC [ ... or ESC O ...
    if (s.startsWith('\x1b[')) {
      const seq = s.slice(2)
      if (seq === 'A') return { key: 'up' }
      if (seq === 'B') return { key: 'down' }
      if (seq === 'C') return { key: 'right' }
      if (seq === 'D') return { key: 'left' }
      if (seq === 'H' || seq === '1~') return { key: 'home' }
      if (seq === 'F' || seq === '4~') return { key: 'end' }
      if (seq === '3~') return { key: 'delete' }
      if (seq === '5~') return { key: 'pageup' }
      if (seq === '6~') return { key: 'pagedown' }
      if (seq === 'Z') return { key: 'shift-tab' }
      // ESC [ 1 ; 2 A  → shift-up etc.
      if (seq === '1;2A') return { key: 'shift-up' }
      if (seq === '1;2B') return { key: 'shift-down' }
      if (seq === '1;3A') return { key: 'alt-up' }
      if (seq === '1;3B') return { key: 'alt-down' }
      if (seq === '1;5C') return { key: 'ctrl-right' }
      if (seq === '1;5D') return { key: 'ctrl-left' }
      // Shift-Enter is terminal-dependent; some send ESC [ 13 ;2u or ESC [ 1 3 ; 2 ~
      if (seq === '13;2u' || seq === '13;2~') return { key: 'shift-enter' }
    }
    if (s.startsWith('\x1bO')) {
      const seq = s.slice(2)
      if (seq === 'A') return { key: 'up' }
      if (seq === 'B') return { key: 'down' }
      if (seq === 'C') return { key: 'right' }
      if (seq === 'D') return { key: 'left' }
      if (seq === 'H') return { key: 'home' }
      if (seq === 'F') return { key: 'end' }
      if (seq === 'P') return { key: 'f1' }
      if (seq === 'Q') return { key: 'f2' }
      if (seq === 'R') return { key: 'f3' }
      if (seq === 'S') return { key: 'f4' }
    }
    // ESC + <char> is often macOS Terminal's Alt-<char>.
    return { key: 'escape', tail: s.slice(1) }
  }

  // Printable
  if (s.length === 1 && s >= ' ' && s <= '~') return { key: 'char', ch: s }
  if (s.length > 1 && !s.startsWith('\x1b')) {
    // Pasted or multi-byte UTF-8. Treat as printable insert.
    return { key: 'text', text: s }
  }
  return { key: 'unknown', raw: s }
}

// ── line-editor class ────────────────────────────────────────────────

export class LineEditor {
  constructor({ prompt, promptCont, history, complete, sigHint, config, output }) {
    this.prompt = prompt || 'sakura> '
    this.promptCont = promptCont || '     ~> '
    this.history = history
    this.complete = complete    // function(query) → [{ name, score }]
    this.sigHint = sigHint      // function(buffer, cursor) → string | null
    this.config = config
    this.out = output || process.stdout

    this.buffer = ''
    this.cursor = 0
    this.rowsLastFrame = 0
    this.mode = (config && config.keybindings === 'vim') ? 'insert' : 'insert'
    this.vim = config && config.keybindings === 'vim'
    this.vimMode = 'insert' // toggled by Esc/i in vim mode
    this.searching = null   // Ctrl-R state: { query, hits, index }
    this.tabCandidates = null  // last tab-cycle state
    this.killRing = []
    this.dot = null // last vim action (for `.`)
  }

  /**
   * Read one full input event. Returns a promise resolving to a string
   * (the finalized input) or a special object like `{ command: 'exit' }`
   * for outside signals.
   */
  read() {
    return new Promise((resolve) => {
      this._resolve = resolve
      this.buffer = ''
      this.cursor = 0
      this.tabCandidates = null
      this.searching = null
      // rowsLastFrame is per-prompt — evaluate output shifted the
      // cursor, so we don't want _clearFrame to try to move above the
      // just-printed result.
      this.rowsLastFrame = 0
      if (this.history) this.history.resetCursor()
      this._render()
      this._onData = (buf) => this._handleData(buf)
      process.stdin.on('data', this._onData)
      if (process.stdin.setRawMode) process.stdin.setRawMode(true)
      process.stdin.resume()
    })
  }

  _finish(result) {
    if (this._onData) {
      process.stdin.off('data', this._onData)
      this._onData = null
    }
    if (process.stdin.setRawMode) process.stdin.setRawMode(false)
    process.stdin.pause()
    this._resolve && this._resolve(result)
    this._resolve = null
  }

  _handleData(buf) {
    // Split multi-key sequences that arrive together (e.g., paste + ESC codes).
    // Simple approach: parse repeatedly, consuming the longest recognized prefix.
    let i = 0
    while (i < buf.length) {
      // Try longer prefixes first (ESC sequences can be up to 8 bytes).
      let advanced = false
      for (let len = Math.min(8, buf.length - i); len >= 1; len--) {
        const slice = buf.slice(i, i + len)
        const k = parseKey(slice)
        if (k.key !== 'unknown' || len === 1) {
          this._onKey(k)
          i += len
          advanced = true
          break
        }
      }
      if (!advanced) i++
      if (!this._resolve) return  // read() resolved mid-buffer
    }
  }

  _onKey(k) {
    if (this.searching) return this._onKeyInSearch(k)
    if (this.vim && this.vimMode === 'normal') return this._onKeyInVimNormal(k)
    return this._onKeyInInsert(k)
  }

  // ── insert mode (default) ────────────────────────────────────────

  _onKeyInInsert(k) {
    const K = k.key
    if (K === 'enter') {
      // Balanced → submit. Unbalanced → newline.
      if (isBalanced(this.buffer) && this.buffer.trim().length > 0) {
        return this._submit()
      }
      // Empty balanced → treat as no-op (skip a blank prompt).
      if (this.buffer.trim().length === 0) return this._submit()
      this._insert('\n')
      return
    }
    if (K === 'shift-enter' || K === 'alt-enter') { this._insert('\n'); return }

    if (K === 'tab') return this._onTab()
    if (K === 'shift-tab') return this._onTab({ back: true })
    if (K === 'backspace') return this._delChar(-1)
    if (K === 'delete') return this._delChar(+1)
    if (K === 'ctrl-c') { this.out.write(role.warn('  ^C\n')); this._finish(''); return }
    if (K === 'ctrl-d') {
      if (this.buffer.length === 0) { this._finish({ command: 'exit' }); return }
      return this._delChar(+1)
    }
    if (K === 'ctrl-l') { this.out.write('\x1b[2J\x1b[H'); this._render({ fresh: true }); return }
    if (K === 'ctrl-a' || K === 'home') return this._toLineStart()
    if (K === 'ctrl-e' || K === 'end')  return this._toLineEnd()
    if (K === 'ctrl-u') return this._killToStart()
    if (K === 'ctrl-k') return this._killToEnd()
    if (K === 'ctrl-w') return this._killPrevWord()
    if (K === 'ctrl-r') return this._enterSearch()
    if (K === 'ctrl-o') return this._openInEditor()
    if (K === 'ctrl-y') return this._yank()
    if (K === 'left') return this._moveCursor(-1)
    if (K === 'right') return this._moveCursor(+1)
    if (K === 'up') return this._prevHistory()
    if (K === 'down') return this._nextHistory()
    if (K === 'alt-b' || K === 'ctrl-left') return this._wordLeft()
    if (K === 'alt-f' || K === 'ctrl-right') return this._wordRight()
    // Paredit — parse-tree edits over the input buffer.
    if (K === 'ctrl-]' || K === 'alt-]') return this._pareditBarfForward()
    if (K === 'ctrl-\\' || K === 'alt-s') return this._pareditSlurpForward()
    if (K === 'alt-[') return this._pareditSlurpBackward()
    if (K === 'alt-k') return this._pareditKillForm()
    if (K === 'f1') return this._insertHelpForToken()
    if (K === 'escape') {
      if (this.vim) { this.vimMode = 'normal'; this._render(); return }
      return
    }
    if (K === 'char') return this._insertChar(k.ch)
    if (K === 'text') return this._insert(k.text)
  }

  // ── vim normal mode ──────────────────────────────────────────────

  _onKeyInVimNormal(k) {
    const K = k.key
    if (K === 'char') {
      const c = k.ch
      if (c === 'i') { this.vimMode = 'insert'; this._render(); return }
      if (c === 'a') { this._moveCursor(+1); this.vimMode = 'insert'; this._render(); return }
      if (c === 'A') { this._toLineEnd(); this.vimMode = 'insert'; this._render(); return }
      if (c === 'I') { this._toLineStart(); this.vimMode = 'insert'; this._render(); return }
      if (c === 'o') { this._toLineEnd(); this._insert('\n'); this.vimMode = 'insert'; return }
      if (c === 'h') return this._moveCursor(-1)
      if (c === 'l') return this._moveCursor(+1)
      if (c === 'j') return this._nextHistory()
      if (c === 'k') return this._prevHistory()
      if (c === 'w') return this._wordRight()
      if (c === 'b') return this._wordLeft()
      if (c === '0') return this._toLineStart()
      if (c === '$') return this._toLineEnd()
      if (c === 'x') return this._delChar(+1)
      if (c === 'u') { this.buffer = ''; this.cursor = 0; this._render(); return }
      if (c === ':') {
        // Simple ex-mode stub: only :q / :wq.
        this._exMode()
        return
      }
    }
    if (K === 'enter') return this._submit()
    if (K === 'escape') { this._render(); return }
    if (K === 'ctrl-c') { this.out.write(role.warn('  ^C\n')); this._finish(''); return }
  }

  _exMode() {
    // Very tiny ex-mode: read one char, act on :q/:x.
    this.out.write(':')
    process.stdin.once('data', (buf) => {
      const s = buf.toString()
      if (s.startsWith('q') || s.startsWith('x')) { this._finish({ command: 'exit' }); return }
      this._render()
    })
  }

  // ── Ctrl-R history search ────────────────────────────────────────

  _enterSearch() {
    this.searching = { query: '', hits: [], index: 0 }
    this._renderSearch()
  }

  _onKeyInSearch(k) {
    const K = k.key
    if (K === 'ctrl-c' || K === 'escape') {
      this.searching = null
      this._render()
      return
    }
    if (K === 'enter') {
      const hit = this.searching.hits[this.searching.index]
      this.searching = null
      if (hit) { this.buffer = hit; this.cursor = hit.length }
      this._render()
      return
    }
    if (K === 'ctrl-r') {
      this.searching.index = Math.min(this.searching.index + 1, this.searching.hits.length - 1)
      this._renderSearch()
      return
    }
    if (K === 'backspace') {
      this.searching.query = this.searching.query.slice(0, -1)
      this._recomputeSearch()
      this._renderSearch()
      return
    }
    if (K === 'char') {
      this.searching.query += k.ch
      this._recomputeSearch()
      this._renderSearch()
      return
    }
  }

  _recomputeSearch() {
    this.searching.hits = this.history ? this.history.search(this.searching.query) : []
    this.searching.index = 0
  }

  _renderSearch() {
    this._clearFrame()
    const q = this.searching.query
    const hit = this.searching.hits[this.searching.index] || ''
    const label = role.dim('(r-search) `') + role.text(q) + role.dim('`: ')
    this.out.write(label + role.text(hit.replace(/\n/g, role.dim(' ⏎ '))) + '\n')
    if (this.searching.hits.length > 1) {
      this.out.write(role.dim(`   [${this.searching.index + 1}/${this.searching.hits.length}]  Ctrl-R: next  Enter: accept  Esc: cancel`) + '\n')
      this.rowsLastFrame = 2
    } else if (this.searching.hits.length === 0 && q) {
      this.out.write(role.dim('   (no matches)') + '\n')
      this.rowsLastFrame = 2
    } else {
      this.rowsLastFrame = 1
    }
  }

  // ── editing primitives ───────────────────────────────────────────

  _insert(text) {
    this.buffer = this.buffer.slice(0, this.cursor) + text + this.buffer.slice(this.cursor)
    this.cursor += text.length
    this.tabCandidates = null
    this._render()
  }

  _insertChar(ch) {
    // Auto-close parens if enabled.
    const autoClose = this.config && this.config['auto-close-parens'] !== '#f'
    if (autoClose && (ch === '(' || ch === '[' || ch === '"')) {
      const close = ch === '(' ? ')' : ch === '[' ? ']' : '"'
      this.buffer = this.buffer.slice(0, this.cursor) + ch + close + this.buffer.slice(this.cursor)
      this.cursor += 1
      this.tabCandidates = null
      this._render()
      return
    }
    // Skip-over closing paren if it matches.
    if (autoClose && (ch === ')' || ch === ']' || ch === '"')) {
      if (this.buffer[this.cursor] === ch) {
        this.cursor += 1
        this._render()
        return
      }
    }
    this._insert(ch)
  }

  _delChar(dir) {
    if (dir < 0) {
      if (this.cursor === 0) return
      // Auto-delete matching close paren if right after autoclose.
      const before = this.buffer[this.cursor - 1]
      const after = this.buffer[this.cursor]
      const pair = { '(': ')', '[': ']', '"': '"' }
      if (pair[before] && pair[before] === after) {
        this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor + 1)
        this.cursor -= 1
      } else {
        this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor)
        this.cursor -= 1
      }
    } else {
      if (this.cursor >= this.buffer.length) return
      this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1)
    }
    this.tabCandidates = null
    this._render()
  }

  _moveCursor(delta) {
    this.cursor = Math.max(0, Math.min(this.buffer.length, this.cursor + delta))
    this.tabCandidates = null
    this._render()
  }

  _toLineStart() {
    // Beginning of the CURRENT visual line (after last '\n' in buffer[..cursor]).
    const nl = this.buffer.lastIndexOf('\n', Math.max(0, this.cursor - 1))
    this.cursor = nl < 0 ? 0 : nl + 1
    this._render()
  }

  _toLineEnd() {
    const nl = this.buffer.indexOf('\n', this.cursor)
    this.cursor = nl < 0 ? this.buffer.length : nl
    this._render()
  }

  _killToStart() {
    const nl = this.buffer.lastIndexOf('\n', Math.max(0, this.cursor - 1))
    const start = nl < 0 ? 0 : nl + 1
    const killed = this.buffer.slice(start, this.cursor)
    this.killRing.push(killed)
    this.buffer = this.buffer.slice(0, start) + this.buffer.slice(this.cursor)
    this.cursor = start
    this._render()
  }

  _killToEnd() {
    const nl = this.buffer.indexOf('\n', this.cursor)
    const end = nl < 0 ? this.buffer.length : nl
    const killed = this.buffer.slice(this.cursor, end)
    this.killRing.push(killed)
    this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(end)
    this._render()
  }

  _killPrevWord() {
    if (this.cursor === 0) return
    let j = this.cursor - 1
    while (j > 0 && /\s/.test(this.buffer[j])) j--
    while (j > 0 && !/[\s()[\]"'`,]/.test(this.buffer[j - 1])) j--
    const killed = this.buffer.slice(j, this.cursor)
    this.killRing.push(killed)
    this.buffer = this.buffer.slice(0, j) + this.buffer.slice(this.cursor)
    this.cursor = j
    this._render()
  }

  _yank() {
    const y = this.killRing[this.killRing.length - 1]
    if (y) this._insert(y)
  }

  _wordLeft() {
    let c = this.cursor
    while (c > 0 && /\s/.test(this.buffer[c - 1])) c--
    while (c > 0 && !/[\s()[\]"'`,]/.test(this.buffer[c - 1])) c--
    this.cursor = c
    this._render()
  }

  _wordRight() {
    let c = this.cursor
    while (c < this.buffer.length && /\s/.test(this.buffer[c])) c++
    while (c < this.buffer.length && !/[\s()[\]"'`,]/.test(this.buffer[c])) c++
    this.cursor = c
    this._render()
  }

  // ── history navigation ───────────────────────────────────────────

  _prevHistory() {
    if (!this.history) return
    const e = this.history.prev()
    if (e == null) return
    this.buffer = e
    this.cursor = e.length
    this._render()
  }

  _nextHistory() {
    if (!this.history) return
    const e = this.history.next()
    this.buffer = e || ''
    this.cursor = this.buffer.length
    this._render()
  }

  // ── tab completion ───────────────────────────────────────────────

  _onTab({ back = false } = {}) {
    const tok = currentToken(this.buffer, this.cursor)
    if (!this.tabCandidates || this.tabCandidates.tokenStart !== tok.start) {
      // Fresh: gather candidates.
      const candidates = this.complete ? this.complete(tok.text) : []
      if (candidates.length === 0) return
      this.tabCandidates = {
        tokenStart: tok.start,
        tokenEnd: tok.end,
        original: tok.text,
        list: candidates,
        index: 0,
      }
      // If a single candidate → accept immediately.
      if (candidates.length === 1) {
        this._acceptCompletion(candidates[0].name)
        this.tabCandidates = null
        return
      }
      // Advance to common prefix first if it's longer than current token.
      const cp = commonPrefix(candidates.map(c => c.name))
      if (cp.length > tok.text.length) {
        this._acceptCompletion(cp)
        // Don't clear candidates — user can press Tab again to cycle.
        return
      }
    } else {
      this.tabCandidates.index = (this.tabCandidates.index + (back ? -1 : 1) + this.tabCandidates.list.length) % this.tabCandidates.list.length
    }
    const pick = this.tabCandidates.list[this.tabCandidates.index]
    this._acceptCompletion(pick.name)
    // Show a candidate strip below the input.
    this._render({ candidateStrip: true })
  }

  _acceptCompletion(name) {
    const { tokenStart, tokenEnd } = this.tabCandidates || currentToken(this.buffer, this.cursor)
    this.buffer = this.buffer.slice(0, tokenStart) + name + this.buffer.slice(tokenEnd)
    this.cursor = tokenStart + name.length
    if (this.tabCandidates) {
      this.tabCandidates.tokenEnd = this.cursor
    }
  }

  // ── paredit ──────────────────────────────────────────────────────

  _pareditSlurpForward() {
    const r = slurpForward(this.buffer, this.cursor)
    this.buffer = r.buffer
    this.cursor = r.cursor
    this._render()
  }

  _pareditBarfForward() {
    const r = barfForward(this.buffer, this.cursor)
    this.buffer = r.buffer
    this.cursor = r.cursor
    this._render()
  }

  _pareditSlurpBackward() {
    const r = slurpBackward(this.buffer, this.cursor)
    this.buffer = r.buffer
    this.cursor = r.cursor
    this._render()
  }

  _pareditKillForm() {
    const r = killForm(this.buffer, this.cursor)
    this.buffer = r.buffer
    this.cursor = r.cursor
    this._render()
  }

  // ── F1 help ──────────────────────────────────────────────────────

  _insertHelpForToken() {
    const tok = currentToken(this.buffer, this.cursor)
    if (!tok.text) return
    const info = CORE_DOCS[tok.text]
    if (!info) return
    this._clearFrame()
    this.out.write('\n' + role.strong(tok.text) + '  ' + role.fn(info.sig) + '\n')
    this.out.write('  ' + role.text(info.doc) + '\n\n')
    this._render({ fresh: true })
  }

  // ── external editor ($EDITOR) ────────────────────────────────────

  _openInEditor() {
    const editor = (this.config && this.config.editor) || process.env.EDITOR || 'vi'
    const path = join(tmpdir(), `scheme-lang-buffer-${process.pid}-${Date.now()}.scm`)
    try {
      writeFileSync(path, this.buffer, 'utf-8')
      this._clearFrame()
      this.out.write(role.dim(`(opening ${editor}…)\n`))
      if (process.stdin.setRawMode) process.stdin.setRawMode(false)
      const r = spawnSync(editor, [path], { stdio: 'inherit' })
      if (process.stdin.setRawMode) process.stdin.setRawMode(true)
      if (r.status === 0) {
        this.buffer = readFileSync(path, 'utf-8').replace(/\n$/, '')
        this.cursor = this.buffer.length
      }
      try { unlinkSync(path) } catch {}
    } catch (e) {
      this.out.write(role.err(`editor failed: ${e.message}\n`))
    }
    this._render({ fresh: true })
  }

  // ── submit ───────────────────────────────────────────────────────

  _submit() {
    // Clear the sig-hint row, then move past the last rendered row.
    this._moveCursorToBottom()
    this.out.write('\n')
    this._finish(this.buffer)
  }

  // ── rendering ────────────────────────────────────────────────────

  /**
   * Repaint the input area. Approach: move up to the top of the current
   * frame, clear everything below, then write the new frame. Cheap and
   * flicker-free for reasonable-sized inputs.
   */
  _render(opts = {}) {
    this._clearFrame()

    // Compute the sig hint line (dim, above input).
    let hintLine = ''
    if (this.config && this.config['ghost-hints'] !== '#f' && this.sigHint) {
      const h = this.sigHint(this.buffer, this.cursor)
      if (h) hintLine = role.dim('  ⤷ ') + role.dim(h)
    }

    // Compute the visible buffer lines with highlighting.
    const highlighted = highlight(this.buffer)
    const lines = highlighted.split('\n')
    // If empty, still show the prompt with a cursor slot.
    const bufLines = lines.length > 0 ? lines : ['']

    let firstRow = ''
    if (hintLine) {
      this.out.write(hintLine + '\n')
    }

    // Vim mode marker on the prompt.
    const vimBadge = this.vim ? role.dim(this.vimMode === 'normal' ? '[N]' : '[I]') + ' ' : ''

    // Write each buffer line with the appropriate prompt.
    for (let i = 0; i < bufLines.length; i++) {
      const p = i === 0 ? role.petal(this.prompt) : role.dim(this.promptCont)
      this.out.write(vimBadge + p + bufLines[i])
      if (i < bufLines.length - 1) this.out.write('\n')
    }

    // Candidate strip if a Tab cycle is active.
    if (opts.candidateStrip && this.tabCandidates && this.tabCandidates.list.length > 1) {
      this.out.write('\n')
      const strip = this._formatCandidateStrip()
      this.out.write(strip)
    }

    // Position the physical cursor at the logical cursor within the buffer.
    // Simplest reliable approach: count the rows we wrote and horizontal offset,
    // then use ANSI to move up + right.
    const rowsWritten = (hintLine ? 1 : 0) + bufLines.length + (opts.candidateStrip && this.tabCandidates && this.tabCandidates.list.length > 1 ? 1 : 0)
    this.rowsLastFrame = rowsWritten

    // Where does the cursor go?
    // Split buffer at this.cursor to find its (row, col) in buffer coords.
    const preCursor = this.buffer.slice(0, this.cursor)
    const preCursorLines = preCursor.split('\n')
    const cursorRow = preCursorLines.length - 1        // 0-based row in buf
    const cursorCol = preCursorLines[preCursorLines.length - 1].length
    // Prompt width for the row the cursor is on:
    const promptCol = (this.vim ? 4 : 0) + (cursorRow === 0 ? this.prompt.length : this.promptCont.length)

    // Rows to move up from where we are (end of last-written row).
    const totalBufRows = bufLines.length
    const bottomRowOfBuf = (hintLine ? 1 : 0) + (totalBufRows - 1)
    // If we wrote a candidate strip, we're one row below the buffer bottom.
    const currentRow = (opts.candidateStrip && this.tabCandidates && this.tabCandidates.list.length > 1)
      ? bottomRowOfBuf + 1
      : bottomRowOfBuf
    // Cursor's actual physical row (0-based) is (hintLine ? 1 : 0) + cursorRow.
    const wantRow = (hintLine ? 1 : 0) + cursorRow
    const upBy = currentRow - wantRow
    if (upBy > 0) this.out.write(CTRL.moveUp(upBy))
    // Move to column 1, then right by promptCol + cursorCol.
    this.out.write('\r')
    if (promptCol + cursorCol > 0) this.out.write(CTRL.moveRight(promptCol + cursorCol))
  }

  _clearFrame() {
    // If we wrote N rows last time, move up (N-1), then clear each row.
    if (this.rowsLastFrame > 0) {
      // Cursor is now at some position inside the frame. Move to the last row,
      // then step up clearing each row.
      this.out.write('\r')
      // Move up to top of last frame.
      const up = this.rowsLastFrame - 1
      // We don't reliably know where the cursor sits mid-render, so we
      // simplify: move up rowsLastFrame-1 lines and clear from there down.
      if (up > 0) this.out.write(CTRL.moveUp(up))
      // Clear from cursor to end of screen.
      this.out.write('\x1b[J')
    }
    this.rowsLastFrame = 0
  }

  _moveCursorToBottom() {
    // Move cursor to the physical bottom of the current frame.
    const rowsBelow = this._rowsBelowCursor()
    if (rowsBelow > 0) this.out.write(CTRL.moveDown(rowsBelow))
    this.out.write('\r')
  }

  _rowsBelowCursor() {
    const preCursor = this.buffer.slice(0, this.cursor)
    const preCursorLines = preCursor.split('\n')
    const cursorRow = preCursorLines.length - 1
    const totalBufRows = this.buffer.split('\n').length
    return (totalBufRows - 1) - cursorRow
  }

  _formatCandidateStrip() {
    const list = this.tabCandidates.list.slice(0, 6)
    const idx = this.tabCandidates.index
    const parts = list.map((c, i) => {
      const s = c.name
      if (i === idx) return role.inverse ? role.inverse(' ' + s + ' ') : role.strong(s)
      return role.dim(s)
    })
    return '  ' + parts.join('   ')
  }
}
