// tests/ide/vim-mode.test.mjs — modal editing key routing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeVimMode } from '../../src/ide/modes/vim.js'
import { makeEditorBuffer } from '../../src/ide/editor-buffer.js'

function makeState(text = '') {
  return {
    buffer: makeEditorBuffer(text),
    modified: false,
    verbs: { match: () => [] },
    completions: null,
  }
}

test('vim — hjkl moves cursor', () => {
  const vim = makeVimMode()
  const s = makeState('abc\ndef')
  vim.handleKey('l', s)
  assert.equal(s.buffer.cursor.col, 1)
  vim.handleKey('j', s)
  assert.equal(s.buffer.cursor.line, 1)
  vim.handleKey('h', s)
  assert.equal(s.buffer.cursor.col, 0)
  vim.handleKey('k', s)
  assert.equal(s.buffer.cursor.line, 0)
})

test('vim — i enters insert mode', () => {
  const vim = makeVimMode()
  const s = makeState('')
  vim.handleKey('i', s)
  assert.equal(vim.submode, 'insert')
  vim.handleKey('a', s)
  assert.equal(s.buffer.toString(), 'a')
  assert.equal(s.modified, true)
  vim.handleKey('\x1b', s) // Esc back to normal
  assert.equal(vim.submode, 'normal')
})

test('vim — o opens a new line below and enters insert', () => {
  const vim = makeVimMode()
  const s = makeState('line1')
  vim.handleKey('o', s)
  assert.equal(vim.submode, 'insert')
  assert.equal(s.buffer.lines.length, 2)
})

test('vim — dd deletes the current line', () => {
  const vim = makeVimMode()
  const s = makeState('a\nb\nc')
  s.buffer.cursor = { line: 1, col: 0 }
  vim.handleKey('d', s)
  vim.handleKey('d', s)
  assert.deepEqual(s.buffer.lines, ['a', 'c'])
})

test('vim — :w returns save action', () => {
  const vim = makeVimMode()
  const s = makeState('')
  vim.handleKey(':', s)
  vim.handleKey('w', s)
  const result = vim.handleKey('\r', s)
  assert.equal(result, 'save')
})

test('vim — :theme <name> returns theme action', () => {
  const vim = makeVimMode()
  const s = makeState('')
  vim.handleKey(':', s)
  for (const ch of 'theme paper') vim.handleKey(ch, s)
  const result = vim.handleKey('\r', s)
  assert.deepEqual(result, { kind: 'theme', name: 'paper' })
})

test('vim — G jumps to buffer end', () => {
  const vim = makeVimMode()
  const s = makeState('l1\nl2\nl3')
  vim.handleKey('G', s)
  assert.equal(s.buffer.cursor.line, 2)
})

test('vim — count prefix repeats motion', () => {
  const vim = makeVimMode()
  const s = makeState('abcdefghi')
  vim.handleKey('5', s)
  vim.handleKey('l', s)
  assert.equal(s.buffer.cursor.col, 5)
})
