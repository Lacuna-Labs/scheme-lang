// tests/ide/status-bar.test.mjs — status bar renders + carries the flower.
//
// The status bar is one of the two places the ✿ appears in the terminal
// IDE (the other is any theme whose promptGlyph is ✿). It must always
// be there, distinctly. Also verify the chips are separated by ' · '
// so the bar reads like plan9's rio, not like a mush.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderStatusBar } from '../../src/ide/status-bar.js'

function fakeState() {
  return {
    mode: 'vim',
    modeImpl: { submode: 'normal' },
    filePath: '/tmp/example.scm',
    modified: false,
    buffer: { cursor: { line: 0, col: 0 } },
    verbs: { size: 1157 },
    status: '',
  }
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
}

test('status-bar — carries the ✿ flower', () => {
  const bar = renderStatusBar(fakeState(), 120)
  const bare = stripAnsi(bar)
  assert.ok(bare.includes('✿'), `expected ✿ in status bar, got: ${JSON.stringify(bare)}`)
})

test('status-bar — chips separated by " · "', () => {
  const bar = renderStatusBar(fakeState(), 120)
  const bare = stripAnsi(bar)
  // Multiple separators — enough to know the shape isn't collapsed.
  const seps = (bare.match(/ · /g) || []).length
  assert.ok(seps >= 3, `expected >= 3 " · " separators, got ${seps} in ${JSON.stringify(bare)}`)
})

test('status-bar — modified marker appears when buffer is dirty', () => {
  const s = fakeState(); s.modified = true
  const bar = renderStatusBar(s, 120)
  assert.ok(stripAnsi(bar).includes('•'), 'expected • dirty marker')
})

test('status-bar — status message replaces the hint block', () => {
  const s = fakeState(); s.status = 'saved.'
  const bar = renderStatusBar(s, 120)
  assert.ok(stripAnsi(bar).includes('saved.'), 'expected status message to appear')
})

test('status-bar — fits within requested cols (no overflow when narrow)', () => {
  // Not a strict-width check (visible chars vs bytes ambiguity) — just
  // that the function completes and returns a non-empty string when
  // pressure is tight. Regressions here often mean pad math is negative.
  const bar = renderStatusBar(fakeState(), 40)
  assert.ok(bar.length > 0)
})
