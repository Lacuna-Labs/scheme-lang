// tests/ide/global-search.test.mjs — across-file text search.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { search, openGlobalSearch } from '../../src/ide/global-search.js'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function makeTmpProject() {
  const root = mkdtempSync(join(tmpdir(), 'sakura-search-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'a.scm'), '(circle 10 10 5)\n(square 0 0 4)\n')
  writeFileSync(join(root, 'src', 'b.scm'), '(circle 20 20 8)\n; another circle here\n')
  writeFileSync(join(root, 'README.md'),   '# Test project\ncircles galore\n')
  return root
}

test('global-search — finds literal strings across files', () => {
  const root = makeTmpProject()
  const r = search(root, 'circle')
  assert.ok(r.hits.length >= 3)
  assert.ok(r.hits.every(h => h.path && h.line && h.match))
  assert.equal(r.capped, false)
})

test('global-search — regex form /pattern/', () => {
  const root = makeTmpProject()
  const r = search(root, '/circle\\s+\\d+/')
  assert.ok(r.hits.length >= 2)
})

test('global-search — case-insensitive by default', () => {
  const root = makeTmpProject()
  const r = search(root, 'CIRCLE')
  assert.ok(r.hits.length >= 3)
})

test('global-search — empty query returns nothing', () => {
  const root = makeTmpProject()
  const r = search(root, '')
  assert.deepEqual(r.hits, [])
})

test('global-search — openGlobalSearch produces live state', () => {
  const root = makeTmpProject()
  const g = openGlobalSearch(root)
  assert.equal(g.kind, 'global-search')
  assert.equal(g.query, '')
  assert.equal(g.hits.length, 0)
  g.query = 'circle'
  g.runSearch()
  assert.ok(g.hits.length >= 3)
  assert.equal(g.lastQuery, 'circle')
})
