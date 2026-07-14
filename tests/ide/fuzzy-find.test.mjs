// tests/ide/fuzzy-find.test.mjs — fuzzy file matcher.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyScore, matchFiles, collectFiles } from '../../src/ide/fuzzy-find.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

test('fuzzy — score prefers consecutive matches', () => {
  const s1 = fuzzyScore('cir', 'circle.js')
  const s2 = fuzzyScore('cir', 'clean-images-radicals.js')
  assert.ok(s1 > s2, `expected ${s1} > ${s2}`)
})

test('fuzzy — score requires all query chars in order', () => {
  assert.equal(fuzzyScore('abc', 'bac'), 0)  // 'a' comes before 'b' in query, and 'a' after 'b' in target
  assert.ok(fuzzyScore('abc', 'aXbYcZ') > 0)
})

test('fuzzy — score boosts segment-start matches', () => {
  const s1 = fuzzyScore('term', 'terminal-ide.js')
  const s2 = fuzzyScore('term', 'xterm-something.js')
  assert.ok(s1 > s2)
})

test('fuzzy — matchFiles returns sorted best-first', () => {
  const files = [
    'src/ide/terminal-ide.js',
    'src/repl/palette.js',
    'src/wired-verbs.js',
    'tests/ide/vim-mode.test.mjs',
  ]
  const m = matchFiles(files, 'term')
  assert.ok(m.length >= 1)
  assert.equal(m[0].path, 'src/ide/terminal-ide.js')
})

test('fuzzy — matchFiles with empty query returns top-N unfiltered', () => {
  const files = ['a', 'b', 'c']
  const m = matchFiles(files, '')
  assert.equal(m.length, 3)
})

test('fuzzy — collectFiles walks the repo root and finds this test', () => {
  const files = collectFiles(REPO_ROOT)
  assert.ok(files.length > 0)
  assert.ok(files.some(p => p.endsWith('fuzzy-find.test.mjs')))
  // Skips node_modules + .git if they exist
  assert.equal(files.some(p => p.startsWith('node_modules/')), false)
  assert.equal(files.some(p => p.startsWith('.git/')), false)
})
