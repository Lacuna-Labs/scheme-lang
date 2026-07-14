// modes/vim.js — modal editing for the terminal IDE.
//
// Small vim: normal, insert, visual, command. Covers the core motion
// + edit vocab a scheme-lang author needs. Not a full vim clone —
// nested modes, macros, marks, jump-lists deliberately out of scope.
//
// Contract: handleKey(key, state) returns:
//   'redraw'                 — redraw the frame
//   'save' / 'run' / 'quit'  — controller-level action
//   { kind: 'theme', name }  — action envelope
//   null | undefined         — no-op (still redraw, safe default)

export function makeVimMode() {
  return {
    kind: 'vim',
    submode: 'normal', // 'normal' | 'insert' | 'visual' | 'command'
    command: '',       // command-line buffer when submode === 'command'
    pendingCount: '',  // e.g. '10' before 'dd'
    handleKey(key, state) {
      const b = state.buffer
      if (this.submode === 'command') {
        return this.handleCommand(key, state)
      }
      if (this.submode === 'insert') {
        return this.handleInsert(key, state)
      }
      if (this.submode === 'visual') {
        return this.handleVisual(key, state)
      }
      return this.handleNormal(key, state)
    },

    handleNormal(key, state) {
      const b = state.buffer
      // digit — accumulate numeric count prefix (not while waiting on a pair)
      if (/^[0-9]$/.test(key) && !(key === '0' && this.pendingCount === '') &&
          this.pendingCount !== 'd' && this.pendingCount !== 'g') {
        this.pendingCount += key
        return 'redraw'
      }
      // Pending-pair handling BEFORE we clobber pendingCount.
      if (key === 'g' && this.pendingCount === 'g') {
        b.moveBufStart(); this.pendingCount = ''; return 'redraw'
      }
      if (key === 'd' && this.pendingCount === 'd') {
        b.deleteLine()
        this.pendingCount = ''
        state.modified = true
        return 'redraw'
      }
      const count = Math.max(1, parseInt(this.pendingCount, 10) || 1)
      const wasNumeric = /^[0-9]+$/.test(this.pendingCount)
      if (wasNumeric) this.pendingCount = ''

      switch (key) {
        case 'h': b.moveLeft(count); return 'redraw'
        case 'j': b.moveDown(count); return 'redraw'
        case 'k': b.moveUp(count); return 'redraw'
        case 'l': b.moveRight(count); return 'redraw'
        case 'w': for (let i = 0; i < count; i++) b.moveWordForward(); return 'redraw'
        case 'b': for (let i = 0; i < count; i++) b.moveWordBackward(); return 'redraw'
        case '0': b.moveHome(); return 'redraw'
        case '$': b.moveEnd(); return 'redraw'
        case 'i': this.submode = 'insert'; return 'redraw'
        case 'a': b.moveRight(); this.submode = 'insert'; return 'redraw'
        case 'A': b.moveEnd(); this.submode = 'insert'; return 'redraw'
        case 'I': b.moveHome(); this.submode = 'insert'; return 'redraw'
        case 'o': b.moveEnd(); b.insertNewline(); this.submode = 'insert'; state.modified = true; return 'redraw'
        case 'O': b.moveHome(); b.insertNewline(); b.moveUp(); this.submode = 'insert'; state.modified = true; return 'redraw'
        case 'x': for (let i = 0; i < count; i++) b.deleteForward(); state.modified = true; return 'redraw'
        case 'X': for (let i = 0; i < count; i++) b.deleteBackward(); state.modified = true; return 'redraw'
        case 'v': this.submode = 'visual'; b.selection = { anchor: { ...b.cursor }, head: { ...b.cursor } }; return 'redraw'
        case ':': this.submode = 'command'; this.command = ''; return 'redraw'
        case 'G': b.moveBufEnd(); return 'redraw'
        case 'g': this.pendingCount = 'g'; return 'redraw' // wait for another g
      }
      if (key === 'd') { this.pendingCount = 'd'; return 'redraw' }
      // Ctrl-Space — trigger autocomplete
      if (key === '\x00') return { kind: 'complete' }
      return 'redraw'
    },

    handleInsert(key, state) {
      const b = state.buffer
      if (key === '\x1b') { this.submode = 'normal'; return 'redraw' }
      if (key === '\x7f' || key === '\b') { b.deleteBackward(); state.modified = true; return 'redraw' }
      if (key === '\r' || key === '\n') { b.insertNewline(); state.modified = true; return 'redraw' }
      if (key === '\t') {
        // Tab in insert = autocomplete if a word is at cursor, else insert spaces
        const w = b.wordAtCursor()
        if (w.text.length >= 2) {
          const matches = state.verbs.match(w.text)
          if (matches.length > 0) {
            state.completions = { items: matches.slice(0, 20), selected: 0, word: w.text }
            return 'redraw'
          }
        }
        b.insertString('  ')
        state.modified = true
        return 'redraw'
      }
      // Ordinary printable
      if (key >= ' ' && key.length === 1) { b.insertChar(key); state.modified = true; return 'redraw' }
      // Multi-char sequence like arrow keys
      if (key === '\x1b[A') { b.moveUp(); return 'redraw' }
      if (key === '\x1b[B') { b.moveDown(); return 'redraw' }
      if (key === '\x1b[C') { b.moveRight(); return 'redraw' }
      if (key === '\x1b[D') { b.moveLeft(); return 'redraw' }
      return 'redraw'
    },

    handleVisual(key, state) {
      const b = state.buffer
      if (key === '\x1b') { this.submode = 'normal'; b.selection = null; return 'redraw' }
      // Movement extends the selection head
      const before = { ...b.cursor }
      let handled = true
      switch (key) {
        case 'h': b.moveLeft(); break
        case 'j': b.moveDown(); break
        case 'k': b.moveUp(); break
        case 'l': b.moveRight(); break
        case 'w': b.moveWordForward(); break
        case 'b': b.moveWordBackward(); break
        case '0': b.moveHome(); break
        case '$': b.moveEnd(); break
        case 'd':
          // Delete selection (best-effort: same line only for v0.0)
          if (b.selection && b.selection.anchor.line === b.cursor.line) {
            const l = b.cursor.line
            const [s, e] = [
              Math.min(b.selection.anchor.col, b.cursor.col),
              Math.max(b.selection.anchor.col, b.cursor.col) + 1,
            ]
            const line = b.lines[l]
            b.lines[l] = line.slice(0, s) + line.slice(e)
            b.cursor.col = s
            state.modified = true
          }
          this.submode = 'normal'
          b.selection = null
          return 'redraw'
        default: handled = false
      }
      if (b.selection) b.selection.head = { ...b.cursor }
      return 'redraw'
    },

    handleCommand(key, state) {
      if (key === '\x1b') { this.submode = 'normal'; this.command = ''; return 'redraw' }
      if (key === '\r' || key === '\n') {
        const cmd = this.command
        this.submode = 'normal'
        this.command = ''
        return this.execCommand(cmd, state)
      }
      if (key === '\x7f' || key === '\b') { this.command = this.command.slice(0, -1); return 'redraw' }
      if (key >= ' ' && key.length === 1) { this.command += key; return 'redraw' }
      return 'redraw'
    },

    execCommand(cmd, state) {
      const trimmed = cmd.trim()
      if (!trimmed) return 'redraw'
      const [head, ...rest] = trimmed.split(/\s+/)
      switch (head) {
        case 'w':
        case 'write':
          if (rest[0]) return { kind: 'save-as', path: rest[0] }
          return 'save'
        case 'q':
        case 'quit':
        case 'exit':
          return state.modified ? { kind: 'status', msg: 'unsaved — use :q! or :wq (also try Ctrl-C anytime)' } : 'quit'
        case 'q!':
        case 'quit!':
        case 'exit!':
          return 'quit-force'
        case 'wq':
        case 'x':
        case 'wq!':
        case 'x!':
          return { kind: 'save-then-quit' }
        case 'theme':
          if (rest[0]) return { kind: 'theme', name: rest[0] }
          return { kind: 'status', msg: 'usage: :theme <name>' }
        case 'mode':
          if (rest[0]) return { kind: 'mode', name: rest[0] }
          return { kind: 'status', msg: 'usage: :mode vim | emacs' }
        case 'e':
        case 'edit':
          if (rest[0]) return { kind: 'open', path: rest[0] }
          return { kind: 'status', msg: 'usage: :e <path>' }
        case 'run':
          return 'run'
        case 'ask':
          return { kind: 'ask' }
        // Round 2 commands
        case 'palette':
          return { kind: 'palette' }
        case 'find':
        case 'files':
          return { kind: 'fuzzy-file-finder' }
        case 'grep':
        case 'search':
          return { kind: 'global-search' }
        case 'zen':
          return { kind: 'toggle-zen' }
        case 'nl':
        case 'lines':
        case 'linenumbers':
          return { kind: 'toggle-line-numbers' }
        case 'snip':
        case 'snippet':
          if (rest[0]) return { kind: 'insert-snippet', trigger: rest[0] }
          return { kind: 'status', msg: 'usage: :snip <trigger>' }
        case 'help':
          return { kind: 'status', msg: 'commands: w q e theme mode run ask palette find grep zen nl snip' }
        default:
          return { kind: 'status', msg: `unknown command: ${head}` }
      }
    },
  }
}
