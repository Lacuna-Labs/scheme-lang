// modes/emacs.js — non-modal Emacs-style bindings.
//
// The core prefix map:
//   C-x C-s  — save
//   C-x C-c  — quit
//   C-x C-f  — open file
//   M-x      — extended command (:command style)
//   C-space  — set mark
//   C-w      — kill region
//   M-w      — copy region
//   C-y      — yank
//   C-s      — incremental search (v0.0: no-op status)
//   C-a      — beginning of line
//   C-e      — end of line
//   C-f/b/n/p — forward/back/next/prev char/line
//   Arrow    — same
//   Enter    — insert newline
//   Backspace — delete backward
//
// C-x prefix state lives on the mode object.

export function makeEmacsMode() {
  return {
    kind: 'emacs',
    submode: 'normal',
    prefix: null,        // 'C-x' | 'M-x' | null
    exBuffer: '',        // extended command buffer

    handleKey(key, state) {
      const b = state.buffer
      // Extended command line
      if (this.prefix === 'M-x') {
        if (key === '\x1b') { this.prefix = null; this.exBuffer = ''; return 'redraw' }
        if (key === '\r' || key === '\n') {
          const cmd = this.exBuffer
          this.prefix = null
          this.exBuffer = ''
          return execExtended(cmd, state)
        }
        if (key === '\x7f') { this.exBuffer = this.exBuffer.slice(0, -1); return 'redraw' }
        if (key >= ' ' && key.length === 1) { this.exBuffer += key; return 'redraw' }
        return 'redraw'
      }
      // C-x prefix
      if (this.prefix === 'C-x') {
        if (key === '\x13') { this.prefix = null; return 'save' }              // C-x C-s
        if (key === '\x03') { this.prefix = null; return 'quit' }              // C-x C-c
        if (key === '\x06') { this.prefix = null; state.status = 'C-x C-f: type path then Enter'; return { kind: 'status', msg: 'M-x edit <path>' } } // C-x C-f
        if (key === 'k')    { this.prefix = null; return 'quit' }              // C-x k close
        this.prefix = null
        state.status = `C-x ${keyName(key)} — unbound`
        return 'redraw'
      }
      // Meta prefix (Esc + key, or Alt+key)
      if (key === '\x1b') { this.prefix = 'M-x-wait'; return 'redraw' }
      if (this.prefix === 'M-x-wait') {
        if (key === 'x') { this.prefix = 'M-x'; return 'redraw' }
        // Meta-b, meta-f, meta-w for words
        if (key === 'b') { b.moveWordBackward(); this.prefix = null; return 'redraw' }
        if (key === 'f') { b.moveWordForward(); this.prefix = null; return 'redraw' }
        this.prefix = null
        return 'redraw'
      }
      // C-x — set prefix
      if (key === '\x18') { this.prefix = 'C-x'; return 'redraw' }

      // Movement
      if (key === '\x01') { b.moveHome(); return 'redraw' }               // C-a
      if (key === '\x05') { b.moveEnd(); return 'redraw' }                // C-e
      if (key === '\x06') { b.moveRight(); return 'redraw' }              // C-f
      if (key === '\x02') { b.moveLeft(); return 'redraw' }               // C-b
      if (key === '\x0e') { b.moveDown(); return 'redraw' }               // C-n
      if (key === '\x10') { b.moveUp(); return 'redraw' }                 // C-p
      if (key === '\x1b[A') { b.moveUp(); return 'redraw' }
      if (key === '\x1b[B') { b.moveDown(); return 'redraw' }
      if (key === '\x1b[C') { b.moveRight(); return 'redraw' }
      if (key === '\x1b[D') { b.moveLeft(); return 'redraw' }

      // Delete
      if (key === '\x7f' || key === '\b') { b.deleteBackward(); state.modified = true; return 'redraw' }
      if (key === '\x04') { b.deleteForward(); state.modified = true; return 'redraw' }   // C-d
      if (key === '\x0b') { return { kind: 'ask' } }                       // C-k → we repurpose for ask
      // Search (v0.0 placeholder)
      if (key === '\x13') { state.status = 'C-s: search not yet implemented'; return 'redraw' }

      // Enter
      if (key === '\r' || key === '\n') { b.insertNewline(); state.modified = true; return 'redraw' }
      if (key === '\t') {
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

      // Printable
      if (key >= ' ' && key.length === 1) { b.insertChar(key); state.modified = true; return 'redraw' }
      return 'redraw'
    },
  }
}

function execExtended(cmd, state) {
  const trimmed = cmd.trim()
  if (!trimmed) return 'redraw'
  const [head, ...rest] = trimmed.split(/\s+/)
  switch (head) {
    case 'save-buffer': case 'save': return 'save'
    case 'find-file': case 'open': case 'edit':
      if (rest[0]) return { kind: 'open', path: rest[0] }
      return { kind: 'status', msg: 'usage: M-x open <path>' }
    case 'quit': case 'exit': return 'quit'
    case 'theme': case 'load-theme':
      if (rest[0]) return { kind: 'theme', name: rest[0] }
      return { kind: 'status', msg: 'usage: M-x theme <name>' }
    case 'switch-mode': case 'mode':
      if (rest[0]) return { kind: 'mode', name: rest[0] }
      return { kind: 'status', msg: 'usage: M-x mode vim|emacs' }
    case 'run': case 'eval-buffer': return 'run'
    case 'ask': case 'ask-sakura': return { kind: 'ask' }
    default:
      return { kind: 'status', msg: `unknown command: ${head}` }
  }
}

function keyName(k) {
  if (k.length === 1 && k.charCodeAt(0) < 32) {
    return 'C-' + String.fromCharCode(k.charCodeAt(0) + 96)
  }
  return k
}
