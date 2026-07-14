// status-bar.js — the bottom status line.
//
// Shape:  ✿ · mode · file · cursor · verb-count · coverage% · theme · hint | status
// Left half is stable info; right half is the transient status message.
//
// One ✿ per screen — the only decoration. The rest is data-dense but
// quiet, chips joined by ' · '. Dorky. Cute. Not saccharine.

import { fg, bg, dim, PALETTE } from '../repl/palette.js'
import { currentThemeName } from './themes.js'

export function renderStatusBar(state, cols) {
  const mode = state.mode === 'vim'
    ? `vim:${state.modeImpl?.submode || 'normal'}`
    : `emacs`
  const file = state.filePath ? state.filePath.split('/').pop() : '[untitled]'
  const cursor = `${state.buffer.cursor.line + 1}:${state.buffer.cursor.col + 1}`
  const verbCount = state.verbs.counts
    ? `${state.verbs.counts.total} verbs (${state.verbs.coverage}% wired)`
    : `${state.verbs.size} verbs`
  const theme = `θ ${currentThemeName()}`
  const extra = []
  if (state.book) extra.push('book')
  if (state.zen) extra.push('zen')
  if (state.lineNumbers === false) extra.push('no-lines')

  // The lone flower — one per screen, always in the same spot. Signals
  // "this is Sakura Scheme" without shouting.
  const left = ` ✿ · ${mode} · ${file}${state.modified ? ' •' : ''} · ${cursor} · ${verbCount} · ${theme}${extra.length ? ' · ' + extra.join(',') : ''}`
  const right = state.status
    ? state.status + ' '
    : ' Ctrl-P: find · Ctrl-F: grep · F2: palette · Ctrl-K: ask · Ctrl-Enter: run · Ctrl-Q: quit '

  // The flower occupies 2 visible columns in most emoji-capable
  // terminals; add 1 to the left visible length when computing pad.
  const leftVis = stripLen(left) + (left.includes('✿') ? 1 : 0)
  const pad = Math.max(1, cols - leftVis - stripLen(right))
  const line = left + ' '.repeat(pad) + right

  return bg(PALETTE.rose, fg(PALETTE.paper, truncateVisible(line, cols)))
}

function stripLen(s) { return String(s).length }
function truncateVisible(s, w) {
  if (s.length <= w) return s
  return s.slice(0, w)
}
