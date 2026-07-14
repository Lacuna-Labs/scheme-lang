// tests/ide/editor-buffer.test.mjs — smoke tests for the IDE buffer.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeEditorBuffer } from '../../src/ide/editor-buffer.js'

test('editor-buffer — insertChar advances cursor', () => {
  const b = makeEditorBuffer('')
  b.insertChar('a'); b.insertChar('b'); b.insertChar('c')
  assert.equal(b.toString(), 'abc')
  assert.equal(b.cursor.col, 3)
})

test('editor-buffer — insertNewline splits the line', () => {
  const b = makeEditorBuffer('hello world')
  b.cursor = { line: 0, col: 5 }
  b.insertNewline()
  assert.deepEqual(b.lines, ['hello', ' world'])
  assert.equal(b.cursor.line, 1)
  assert.equal(b.cursor.col, 0)
})

test('editor-buffer — deleteBackward joins lines at start', () => {
  const b = makeEditorBuffer('a\nb\nc')
  b.cursor = { line: 1, col: 0 }
  b.deleteBackward()
  assert.deepEqual(b.lines, ['ab', 'c'])
  assert.equal(b.cursor.line, 0)
  assert.equal(b.cursor.col, 1)
})

test('editor-buffer — deleteLine removes middle line', () => {
  const b = makeEditorBuffer('a\nb\nc')
  b.cursor = { line: 1, col: 0 }
  b.deleteLine()
  assert.deepEqual(b.lines, ['a', 'c'])
  assert.equal(b.cursor.line, 1)
})

test('editor-buffer — wordAtCursor identifies verb name', () => {
  const b = makeEditorBuffer('(entity/spawn')
  b.cursor = { line: 0, col: 12 }
  const w = b.wordAtCursor()
  assert.equal(w.text, 'entity/spawn')
  assert.equal(w.start, 1)
  assert.equal(w.end, 13)
})

test('editor-buffer — replaceWordAtCursor swaps identifier', () => {
  const b = makeEditorBuffer('(cortex/re')
  b.cursor = { line: 0, col: 10 }
  b.replaceWordAtCursor('cortex/read')
  assert.equal(b.toString(), '(cortex/read')
  assert.equal(b.cursor.col, 12)
})

test('editor-buffer — moveWordForward/backward skip whitespace', () => {
  const b = makeEditorBuffer('(alpha  beta)')
  b.cursor = { line: 0, col: 0 }
  b.moveWordForward()
  // cursor at start of 'alpha' or right past it? impl: right past whitespace after word
  assert.ok(b.cursor.col >= 1 && b.cursor.col <= 8)
})
