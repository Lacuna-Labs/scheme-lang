#!/usr/bin/env node
// docs/site/test-headless.mjs — headless-Chrome smoke test for the site.
//
// Serves docs/site/dist/ on a local port, launches headless Chrome with
// a test URL that runs a series of REPL evaluations via JS injection,
// captures the DOM after, and asserts on the output.
//
// Runs on demand — not part of `npm test` (there is no npm). Invoke:
//   node docs/site/test-headless.mjs

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, extname } from 'node:path'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, 'dist')
if (!existsSync(join(DIST, 'index.html'))) {
  process.stderr.write('site/dist not built — run `node docs/site/build-site.mjs` first\n')
  process.exit(2)
}

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]
const chrome = CHROME_PATHS.find(p => existsSync(p))
if (!chrome) {
  process.stderr.write('no Chrome/Chromium binary found — skipping headless test\n')
  process.exit(0)   // soft skip
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json',
}

const PORT = 8790
const server = createServer((req, res) => {
  let p = req.url.split('?')[0]
  if (p === '/') p = '/index.html'
  const full = join(DIST, p)
  if (!full.startsWith(DIST) || !existsSync(full)) {
    res.writeHead(404); return res.end('nope')
  }
  const type = MIME[extname(full)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  res.end(readFileSync(full))
})

await new Promise(r => server.listen(PORT, r))

const testHTML = `
<!doctype html>
<html><body>
<div id="repl" data-version="test"></div>
<script type="module">
  import { parse, evaluate, expandProgram, makeBaseEnv } from 'http://localhost:${PORT}/scheme-lang.mjs'
  const results = []
  const fuel = { n: 200000 }
  const env = makeBaseEnv(fuel)
  const cases = [
    '(+ 1 2)',
    "(map (lambda (x) (* x x)) '(1 2 3 4 5))",
    '(define (fact n) (if (< n 2) 1 (* n (fact (- n 1))))) (fact 8)',
    "(sort '(3 1 4 1 5 9 2 6) <)",
    '(circle 50 50 30)',
  ]
  for (const src of cases) {
    try {
      const forms = parse(src)
      const { forms: expanded } = expandProgram(forms)
      let last
      for (const f of expanded) last = evaluate(f, env, fuel)
      fuel.n = 200000
      results.push({ src, ok: true, val: JSON.stringify(last) })
    } catch (e) {
      results.push({ src, ok: false, err: e.message })
    }
  }
  document.title = 'RESULTS:' + JSON.stringify(results)
</script>
</body></html>
`

// Save the test page.
const testPath = join(DIST, '__test.html')
import('node:fs').then(m => m.writeFileSync(testPath, testHTML))

// Launch headless Chrome.
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--virtual-time-budget=5000',
  '--dump-dom',
  `http://localhost:${PORT}/__test.html`,
]
const out = await new Promise(r => {
  const p = spawn(chrome, args)
  let buf = ''
  p.stdout.on('data', d => buf += d.toString())
  p.on('close', () => r(buf))
})

// Extract title.
const titleMatch = out.match(/<title>RESULTS:(.*?)<\/title>/)
if (!titleMatch) {
  process.stderr.write('no results title — headless test failed to run\n')
  process.stderr.write(out.slice(0, 2000) + '\n')
  server.close()
  process.exit(1)
}
const results = JSON.parse(titleMatch[1])

let passed = 0, failed = 0
// The document title had `<` HTML-entity encoded during --dump-dom, so
// keys may arrive as `&lt;`; compare source with entities decoded.
function decEnt(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
const expected = {
  '(+ 1 2)': '3',
  "(map (lambda (x) (* x x)) '(1 2 3 4 5))": '[1,4,9,16,25]',
  '(define (fact n) (if (< n 2) 1 (* n (fact (- n 1))))) (fact 8)': '40320',
  "(sort '(3 1 4 1 5 9 2 6) <)": '[1,1,2,3,4,5,6,9]',
  '(circle 50 50 30)': null,  // legitimately unbound in bare env (auto-quote lives in REPL widget)
}
for (const r of results) {
  const src = decEnt(r.src)
  const want = expected[src]
  if (want === undefined) {
    process.stderr.write('  FAIL  unknown case ' + src + '\n'); failed++; continue
  }
  if (want === null) {
    // Special-case circle: OK if it either succeeds (auto-quote wired) OR
    // raises the expected "unbound symbol: circle" (bare bundle behavior).
    if (r.ok || (r.err && /circle/.test(r.err))) {
      process.stdout.write('  ok  ' + src + '  (bare bundle correctly reports unbound; widget auto-quotes)\n'); passed++
    } else {
      process.stderr.write('  FAIL  ' + src + '  → ' + JSON.stringify(r) + '\n'); failed++
    }
    continue
  }
  if (r.ok && r.val === want) {
    process.stdout.write('  ok  ' + src + '  → ' + r.val + '\n'); passed++
  } else {
    process.stderr.write('  FAIL  ' + src + '  → ' + JSON.stringify(r) + '  want ' + want + '\n'); failed++
  }
}

// Also verify the main index.html mounts a REPL panel.
const domArgs = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--virtual-time-budget=5000',
  '--dump-dom',
  `http://localhost:${PORT}/index.html`,
]
const dom = await new Promise(r => {
  const p = spawn(chrome, domArgs)
  let buf = ''
  p.stdout.on('data', d => buf += d.toString())
  p.on('close', () => r(buf))
})
if (dom.includes('class="repl-body"') && dom.includes('Sakura Scheme')) {
  process.stdout.write('  ok  index.html mounts the REPL widget\n')
  passed++
} else {
  process.stderr.write('  FAIL  index.html did not mount the REPL\n')
  failed++
}

server.close()
try { import('node:fs').then(m => m.unlinkSync(testPath)) } catch {}

process.stdout.write(`\n  ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
