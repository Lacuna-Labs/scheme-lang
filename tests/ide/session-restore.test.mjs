// tests/ide/session-restore.test.mjs — persist + reload IDE session state.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSession, saveSession, sessionFilePath } from '../../src/ide/session-restore.js'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'

test('session-restore — saveSession writes a JSON blob', () => {
  const path = sessionFilePath()
  const ok = saveSession({
    filePath: '/tmp/hello.scm',
    cursor: { line: 3, col: 4 },
    scrollTop: 5,
    mode: 'emacs',
    theme: 'paper',
    replHistory: ['(+ 1 2)', '(list 1 2 3)'],
    lineNumbers: false,
    fontSize: 16,
  })
  assert.equal(ok, true)
  assert.equal(existsSync(path), true)
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  assert.equal(parsed.filePath || parsed.lastFile, '/tmp/hello.scm')
  assert.equal(parsed.mode, 'emacs')
  assert.equal(parsed.theme, 'paper')
  assert.equal(parsed.fontSize, 16)
  assert.equal(parsed.lineNumbers, false)
})

test('session-restore — loadSession reads it back', () => {
  saveSession({
    filePath: '/tmp/hi.scm',
    cursor: { line: 1, col: 2 },
    mode: 'vim',
    theme: 'sakura-dark',
  })
  const s = loadSession()
  assert.ok(s)
  assert.equal(s.lastFile, '/tmp/hi.scm')
  assert.equal(s.cursor.line, 1)
  assert.equal(s.cursor.col, 2)
})

test('session-restore — history is capped at 200 entries', () => {
  const history = []
  for (let i = 0; i < 500; i++) history.push('(+ ' + i + ' 1)')
  saveSession({ replHistory: history })
  const s = loadSession()
  assert.ok(s)
  assert.equal(s.replHistory.length, 200)
})
