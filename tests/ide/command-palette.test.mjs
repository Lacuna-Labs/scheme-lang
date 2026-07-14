// tests/ide/command-palette.test.mjs — palette build + filter.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPalette, matchCommands, openPalette } from '../../src/ide/command-palette.js'

test('palette — build includes core commands', () => {
  const cmds = buildPalette({})
  const ids = cmds.map(c => c.id)
  assert.ok(ids.includes('save'))
  assert.ok(ids.includes('open'))
  assert.ok(ids.includes('run-buffer'))
  assert.ok(ids.includes('ask-sakura'))
  assert.ok(ids.includes('quit'))
  assert.ok(ids.includes('toggle-zen'))
  assert.ok(ids.includes('toggle-line-numbers'))
  assert.ok(ids.includes('font-inc'))
  assert.ok(ids.includes('find-file'))
  assert.ok(ids.includes('global-search'))
})

test('palette — build includes theme + mode + snippet commands', () => {
  const cmds = buildPalette({})
  assert.ok(cmds.some(c => c.id === 'theme:sakura-dark'))
  assert.ok(cmds.some(c => c.id === 'theme:paper'))
  assert.ok(cmds.some(c => c.id === 'mode-vim'))
  assert.ok(cmds.some(c => c.id === 'mode-emacs'))
  assert.ok(cmds.some(c => c.id.startsWith('snippet:')))
})

test('palette — filter by exact prefix', () => {
  const cmds = buildPalette({})
  const hits = matchCommands(cmds, 'save')
  assert.ok(hits.length >= 1)
  assert.ok(hits.some(c => c.id === 'save'))
})

test('palette — filter by subsequence', () => {
  const cmds = buildPalette({})
  const hits = matchCommands(cmds, 'thm')  // "theme" subsequence
  assert.ok(hits.length >= 1)
  assert.ok(hits.some(c => c.id.startsWith('theme:')))
})

test('palette — empty query returns everything (capped)', () => {
  const cmds = buildPalette({})
  const hits = matchCommands(cmds, '')
  assert.ok(hits.length <= 50)
  assert.ok(hits.length > 0)
})

test('palette — openPalette produces a live modal state', () => {
  const p = openPalette({})
  assert.equal(p.kind, 'palette')
  assert.equal(p.query, '')
  assert.equal(p.selected, 0)
  p.refresh()
  assert.ok(p.matches.length > 0)
})
