// editor-buffer.js — the mutable text buffer for the IDE editor.
//
// Owns:
//   · lines: string[]
//   · cursor: { line, col }
//   · scrollTop: number
//   · selection: { anchor: {line, col}, head: {line, col} } | null
//
// This is a plain object with methods, not a class — matches the rest
// of the codebase's flat-JS style. All ops mutate in place and return
// the buffer for chaining.

export function makeEditorBuffer(text = '') {
  const buf = {
    lines: text.split('\n'),
    cursor: { line: 0, col: 0 },
    scrollTop: 0,
    selection: null,

    // ── core ──────────────────────────────────────────────────────────
    toString() { return this.lines.join('\n') },

    lineCount() { return this.lines.length },

    curLine() { return this.lines[this.cursor.line] || '' },

    // ── movement ──────────────────────────────────────────────────────
    moveLeft(n = 1) {
      this.cursor.col = Math.max(0, this.cursor.col - n)
    },
    moveRight(n = 1) {
      this.cursor.col = Math.min(this.curLine().length, this.cursor.col + n)
    },
    moveUp(n = 1) {
      this.cursor.line = Math.max(0, this.cursor.line - n)
      this.cursor.col = Math.min(this.curLine().length, this.cursor.col)
      this.ensureVisible()
    },
    moveDown(n = 1) {
      this.cursor.line = Math.min(this.lines.length - 1, this.cursor.line + n)
      this.cursor.col = Math.min(this.curLine().length, this.cursor.col)
      this.ensureVisible()
    },
    moveHome() { this.cursor.col = 0 },
    moveEnd() { this.cursor.col = this.curLine().length },
    moveBufStart() { this.cursor.line = 0; this.cursor.col = 0; this.scrollTop = 0 },
    moveBufEnd() {
      this.cursor.line = Math.max(0, this.lines.length - 1)
      this.cursor.col = this.curLine().length
      this.ensureVisible()
    },
    moveWordForward() {
      const line = this.curLine()
      let c = this.cursor.col
      while (c < line.length && !/\s/.test(line[c])) c++
      while (c < line.length && /\s/.test(line[c])) c++
      this.cursor.col = c
    },
    moveWordBackward() {
      let c = this.cursor.col
      const line = this.curLine()
      while (c > 0 && /\s/.test(line[c - 1])) c--
      while (c > 0 && !/\s/.test(line[c - 1])) c--
      this.cursor.col = c
    },

    // ── editing ──────────────────────────────────────────────────────
    insertChar(ch) {
      const l = this.cursor.line
      const c = this.cursor.col
      const line = this.lines[l] || ''
      this.lines[l] = line.slice(0, c) + ch + line.slice(c)
      this.cursor.col++
    },
    insertString(s) {
      for (const ch of s) {
        if (ch === '\n') this.insertNewline()
        else this.insertChar(ch)
      }
    },
    insertNewline() {
      const l = this.cursor.line
      const c = this.cursor.col
      const line = this.lines[l] || ''
      this.lines.splice(l, 1, line.slice(0, c), line.slice(c))
      this.cursor.line++
      this.cursor.col = 0
      this.ensureVisible()
    },
    deleteBackward() {
      if (this.cursor.col > 0) {
        const l = this.cursor.line
        const line = this.lines[l]
        this.lines[l] = line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col)
        this.cursor.col--
        return
      }
      if (this.cursor.line > 0) {
        const prev = this.lines[this.cursor.line - 1]
        const cur = this.lines[this.cursor.line]
        this.lines.splice(this.cursor.line - 1, 2, prev + cur)
        this.cursor.line--
        this.cursor.col = prev.length
        this.ensureVisible()
      }
    },
    deleteForward() {
      const line = this.curLine()
      if (this.cursor.col < line.length) {
        this.lines[this.cursor.line] = line.slice(0, this.cursor.col) + line.slice(this.cursor.col + 1)
      } else if (this.cursor.line < this.lines.length - 1) {
        const next = this.lines[this.cursor.line + 1]
        this.lines.splice(this.cursor.line, 2, line + next)
      }
    },
    deleteLine() {
      if (this.lines.length <= 1) { this.lines[0] = ''; this.cursor.col = 0; return }
      this.lines.splice(this.cursor.line, 1)
      this.cursor.line = Math.min(this.cursor.line, this.lines.length - 1)
      this.cursor.col = Math.min(this.cursor.col, this.curLine().length)
    },

    // ── word ops (for autocomplete) ──────────────────────────────────
    wordAtCursor() {
      const line = this.curLine()
      let s = this.cursor.col
      let e = this.cursor.col
      while (s > 0 && /[a-zA-Z0-9\-!?/*+_.]/.test(line[s - 1])) s--
      while (e < line.length && /[a-zA-Z0-9\-!?/*+_.]/.test(line[e])) e++
      return { start: s, end: e, text: line.slice(s, e) }
    },
    replaceWordAtCursor(text) {
      const w = this.wordAtCursor()
      const line = this.curLine()
      this.lines[this.cursor.line] = line.slice(0, w.start) + text + line.slice(w.end)
      this.cursor.col = w.start + text.length
    },

    // ── scroll ───────────────────────────────────────────────────────
    ensureVisible(viewportRows = 20) {
      if (this.cursor.line < this.scrollTop) this.scrollTop = this.cursor.line
      if (this.cursor.line >= this.scrollTop + viewportRows) {
        this.scrollTop = this.cursor.line - viewportRows + 1
      }
    },
  }
  return buf
}
