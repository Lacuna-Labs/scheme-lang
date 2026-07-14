// tests/ide/book-viewer.test.mjs — parse + render a .book.slatl file.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBook, isBookPath, renderBookText } from '../../src/ide/book-viewer.js'

const SAMPLE = `
(book
  :title    "A Small Book"
  :author   "Sakura"
  :subtitle "for testing"
  :epigraph "Hello little reader."
  :chapters (
    (chapter
      :title    "1. The First Thing"
      :epigraph "In the beginning was the word."
      :prose ("This chapter has some prose."
              "And it has a second paragraph too.")
      :examples (
        (:tier "novice" :code "(display \\"hi\\")" :note "smallest program")))
    (chapter
      :title "2. Onward"
      :prose ("A shorter chapter."))))
`

test('book-viewer — parseBook returns structured object', () => {
  const b = parseBook(SAMPLE)
  assert.equal(b.title, 'A Small Book')
  assert.equal(b.author, 'Sakura')
  assert.equal(b.subtitle, 'for testing')
  assert.equal(b.epigraph, 'Hello little reader.')
  assert.equal(b.chapters.length, 2)
})

test('book-viewer — chapter shape', () => {
  const b = parseBook(SAMPLE)
  const ch = b.chapters[0]
  assert.equal(ch.title, '1. The First Thing')
  assert.equal(ch.prose.length, 2)
  assert.ok(ch.prose[0].includes('prose'))
  assert.equal(ch.examples.length, 1)
  assert.equal(ch.examples[0].tier, 'novice')
  assert.ok(ch.examples[0].code.includes('display'))
})

test('book-viewer — isBookPath detects the extension', () => {
  assert.equal(isBookPath('foo.book.slatl'), true)
  assert.equal(isBookPath('foo.book.slat'), true)
  assert.equal(isBookPath('foo.scm'), false)
  assert.equal(isBookPath('foo.slat'), false)
  assert.equal(isBookPath(''), false)
})

test('book-viewer — renderBookText produces line array with title header', () => {
  const b = parseBook(SAMPLE)
  const lines = renderBookText(b, 60)
  assert.ok(Array.isArray(lines))
  assert.ok(lines.length > 5)
  assert.ok(lines.some(l => l.includes('A Small Book')))
  assert.ok(lines.some(l => l.includes('The First Thing')))
  assert.ok(lines.some(l => l.includes('display')))
})

test('book-viewer — throws when no (book ...) form present', () => {
  assert.throws(() => parseBook('(not-a-book :title "x")'), /no \(book /)
})
