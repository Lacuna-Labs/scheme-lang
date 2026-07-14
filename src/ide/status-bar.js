// status-bar.js — the bottom status line.
//
// Shape:  mode · file · cursor · verb-count · hint · [transient status]
// Left half is stable info; right half is the transient status message.

import { fg, bg, dim, PALETTE } from '../repl/palette.js'
import { currentThemeName } from './themes.js'

export function renderStatusBar(state, cols) {
  const mode = state.mode === 'vim'
    ? `vim:${state.modeImpl?.submode || 'normal'}`
    : `emacs`
  const file = state.filePath ? state.filePath.split('/').pop() : '[untitled]'
  const cursor = `${state.buffer.cursor.line + 1}:${state.buffer.cursor.col + 1}`
  const verbCount = state.verbs.size + ' verbs'
  const theme = `θ ${currentThemeName()}`

  const left = ` ${mode} · ${file}${state.modified ? ' •' : ''} · ${cursor} · ${verbCount} · ${theme}`
  const right = state.status ? state.status + ' ' : ' Tab: focus · Ctrl-K: ask · Ctrl-Enter: run · Ctrl-Q: quit '

  const pad = Math.max(1, cols - stripLen(left) - stripLen(right))
  const line = left + ' '.repeat(pad) + right

  return bg(PALETTE.rose, fg(PALETTE.paper, truncateVisible(line, cols)))
}

function stripLen(s) { return String(s).length }
function truncateVisible(s, w) {
  if (s.length <= w) return s
  return s.slice(0, w)
}
