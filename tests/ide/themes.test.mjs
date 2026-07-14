// tests/ide/themes.test.mjs — theme table sanity.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { THEMES, getTheme, setTheme, themeList, DEFAULT_THEME } from '../../src/ide/themes.js'

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
