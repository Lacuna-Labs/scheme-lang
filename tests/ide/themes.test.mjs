// tests/ide/themes.test.mjs — theme table sanity.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { THEMES, getTheme, setTheme, themeList, DEFAULT_THEME, promptGlyph } from '../../src/ide/themes.js'

test('themes — required set is present', () => {
  const list = themeList()
  assert.ok(list.includes('sakura-light'))
  assert.ok(list.includes('sakura-dark'))
  assert.ok(list.includes('high-contrast'))
  assert.ok(list.includes('paper'))
})

test('themes — each theme has terminal + web palettes', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    assert.equal(t.name, name)
    // terminal 256-color indexes
    for (const k of ['bg', 'text', 'accent', 'ok', 'err']) {
      assert.equal(typeof t[k], 'number', `${name}.${k} must be a number`)
    }
    // web CSS
    for (const k of ['bg', 'text', 'accent', 'font']) {
      assert.equal(typeof t.web[k], 'string', `${name}.web.${k} must be a string`)
    }
  }
})

test('themes — setTheme swaps active', () => {
  assert.equal(setTheme('sakura-light'), true)
  assert.equal(getTheme().name, 'sakura-light')
  assert.equal(setTheme('nonexistent'), false)
  assert.equal(getTheme().name, 'sakura-light')
  setTheme(DEFAULT_THEME)
})

test('themes — every theme has a prompt glyph (2 chars, tail-space)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    assert.equal(typeof t.promptGlyph, 'string',
      `${name}.promptGlyph must be a string`)
    // "grapheme + space" — one visible glyph then a padding space so
    // cursor arithmetic in the REPL stays honest.
    assert.ok(t.promptGlyph.endsWith(' '),
      `${name}.promptGlyph should end with a space (got ${JSON.stringify(t.promptGlyph)})`)
    assert.ok(t.promptGlyph.length >= 2 && t.promptGlyph.length <= 4,
      `${name}.promptGlyph should be short (got ${t.promptGlyph.length} chars)`)
  }
})

test('themes — prompt glyphs are distinct per theme', () => {
  const glyphs = new Set(themeList().map(n => THEMES[n].promptGlyph))
  assert.equal(glyphs.size, themeList().length,
    'each theme should have its own prompt glyph — variety is the point')
})

test('themes — promptGlyph() follows the active theme', () => {
  setTheme('sakura-light')
  assert.equal(promptGlyph(), THEMES['sakura-light'].promptGlyph)
  setTheme('sakura-dark')
  assert.equal(promptGlyph(), THEMES['sakura-dark'].promptGlyph)
  setTheme(DEFAULT_THEME)
})

test('themes — promptGlyph() falls back for unknown theme name', () => {
  // Explicit unknown → still returns *something* (default's glyph).
  const g = promptGlyph('does-not-exist')
  assert.equal(typeof g, 'string')
  assert.ok(g.length >= 2)
})
