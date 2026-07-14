// tests/ide/web-ide.test.mjs — smoke tests for the web IDE HTML shell.
//
// We can't run Monaco in Node — but we CAN verify the HTML the server
// hands to the browser has the TV-set chrome, the LED "Run" button,
// the ✿ flower, the knob, and the theme picker. If any of these drift
// out, the aesthetic breaks. So we pin them.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startWebIde } from '../../src/web-ide/serve.js'

async function withServer(fn) {
  const srv = startWebIde({ port: 3777 })
  try {
    // Give the server a beat to bind — startWebIde returns before listen resolves.
    await new Promise(r => setTimeout(r, 50))
    return await fn()
  } finally {
    srv.close()
  }
}

test('web-ide — HTML has the TV-set chrome + flower + LED', async () => {
  await withServer(async () => {
    const res = await fetch('http://127.0.0.1:3777/')
    const html = await res.text()
    assert.ok(html.includes('id="chrome"'), 'expected TV-set chrome wrapper')
    assert.ok(html.includes('id="topbar"'), 'expected topbar')
    assert.ok(html.includes('id="run-led"'), 'expected LED Run button')
    assert.ok(html.includes('id="save-btn"'), 'expected Save button')
    assert.ok(html.includes('id="knob"'), 'expected knob (settings gear)')
    // The lone flowers — one in the brand, one in the status bar.
    const flowers = (html.match(/✿/g) || []).length
    assert.ok(flowers >= 2, `expected >= 2 ✿ in the shell, got ${flowers}`)
  })
})

test('web-ide — app.js persists theme + toggles scanlines', async () => {
  await withServer(async () => {
    const res = await fetch('http://127.0.0.1:3777/app.js')
    const js = await res.text()
    assert.ok(js.includes('pickInitialTheme'), 'expected theme-picker init')
    assert.ok(js.includes('sakura-theme'), 'expected localStorage key for theme')
    assert.ok(js.includes('sakura-no-scan'), 'expected localStorage key for scanline toggle')
    assert.ok(js.includes('setFocusedPane'), 'expected pane focus tracker for TV-flash')
    assert.ok(js.includes('classList.add(\'tv-flash\')') || js.includes("classList.add('tv-flash')"),
      'expected tv-flash class to be added on pane focus')
  })
})

test('web-ide — theme picker + worker are served', async () => {
  await withServer(async () => {
    const themes = await fetch('http://127.0.0.1:3777/themes.json').then(r => r.json())
    assert.ok(themes['sakura-dark'], 'themes.json served')
    // The prompt glyphs made it in — this pins the aesthetic across
    // both the terminal IDE and the browser theme picker.
    for (const t of Object.values(themes)) {
      assert.ok(t.promptGlyph, `${t.name}.promptGlyph missing`)
    }
    const worker = await fetch('http://127.0.0.1:3777/worker.js').then(r => r.text())
    assert.ok(worker.includes('loadReference'), 'worker.js references loader')
  })
})
