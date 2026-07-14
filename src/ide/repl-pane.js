// repl-pane.js — the REPL pane inside the IDE.
//
// A minimal REPL that shares the interpreter with the runBuffer path.
// Owns:
//   · lines: string[] (scrollback)
//   · input: string   (current line)
//   · history: string[] (previous inputs; Up/Down cycles)
//
// Delegates key handling; the controller invokes handleKey when focus
// is on the REPL.

import { parse } from '../reader.js'
import { evaluate } from '../interp.js'
import { expandProgram } from '../macro.js'
import { schemeFormat } from '../repl/richDisplay.js'

const HISTORY_MAX = 1000

export function makeReplPane({ env, fuel }) {
  return {
    env,
    fuel,
    lines: [ '; Sakura Scheme REPL (Ctrl-Enter in editor to run buffer)' ],
    input: '',
    history: [],
    histIdx: null,

    pushInput(s) { this.lines.push('> ' + s) },
    pushResult(v) {
      if (v === undefined) return
      const s = schemeFormat(v)
      for (const line of String(s).split('\n')) this.lines.push(line)
    },
    pushError(msg) { this.lines.push('!! ' + msg) },
    pushInfo(msg) { this.lines.push('; ' + msg) },

    handleKey(key, state, scheduleRedraw) {
      // Enter — submit
      if (key === '\r' || key === '\n' || key === '\x0a') {
        const line = this.input
        this.input = ''
        this.histIdx = null
        this.pushInput(line)
        if (this.history[this.history.length - 1] !== line && line.trim()) {
          this.history.push(line)
          if (this.history.length > HISTORY_MAX) this.history.shift()
        }
        try {
          const forms = parse(line)
          const { forms: expanded } = expandProgram(forms)
          const localFuel = { n: 200000 }
          let last
          for (const f of expanded) last = evaluate(f, this.env, localFuel)
          this.pushResult(last)
        } catch (err) {
          this.pushError(err && err.message ? err.message : String(err))
        }
        scheduleRedraw()
        return
      }
      // Backspace
      if (key === '\x7f' || key === '\b') { this.input = this.input.slice(0, -1); scheduleRedraw(); return }
      // Up/Down — history
      if (key === '\x1b[A') {
        if (this.history.length === 0) return
        this.histIdx = this.histIdx === null ? this.history.length - 1 : Math.max(0, this.histIdx - 1)
        this.input = this.history[this.histIdx]
        scheduleRedraw()
        return
      }
      if (key === '\x1b[B') {
        if (this.histIdx === null) return
        this.histIdx += 1
        if (this.histIdx >= this.history.length) { this.histIdx = null; this.input = '' }
        else this.input = this.history[this.histIdx]
        scheduleRedraw()
        return
      }
      // Tab — insert 2 spaces (no completion in REPL for now)
      if (key === '\t') return  // controller consumes tab for focus-cycle
      // Ctrl-A/E — begin/end of line (single-line only, so cursor is always at end)
      // Printable
      if (key >= ' ' && key.length === 1) { this.input += key; scheduleRedraw(); return }
    },
  }
}
