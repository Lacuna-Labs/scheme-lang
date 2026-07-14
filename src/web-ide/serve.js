// serve.js — the local Web IDE dev server.
//
// Zero-dependency HTTP server (node:http). Serves:
//   /           → index.html (Monaco + 3-pane UI)
//   /app.js     → the frontend controller
//   /worker.js  → the WebWorker that runs Scheme (uses a bundled
//                 copy of the reader + interp + macro modules)
//   /reference.slat → the reference SLAT file
//   /themes.json → the theme table
//
// The Web IDE loads Monaco from a public CDN (unpkg). No network calls
// for anything else at runtime — the interpreter runs in-page.
//
// This is intentionally node:http not Express. We don't want the dep.

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { THEMES, DEFAULT_THEME } from '../ide/themes.js'
import { collectFiles } from '../ide/fuzzy-find.js'
import { search as gsearch } from '../ide/global-search.js'
import { SNIPPETS } from '../ide/snippets.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

export function startWebIde({ port = 3737 } = {}) {
  const server = createServer((req, res) => {
    try { handle(req, res) }
    catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('web-ide: ' + e.message)
    }
  })
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      process.stderr.write(`sakura-scheme --web: port ${port} in use. try --port <n>\n`)
      process.exit(1)
    }
    throw e
  })
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`sakura-scheme web IDE\n`)
    process.stdout.write(`  → open http://localhost:${port} in your browser\n`)
    process.stdout.write(`  → Ctrl-C to stop\n\n`)
  })
  return server
}

function handle(req, res) {
  const url = req.url.split('?')[0]

  if (url === '/' || url === '/index.html') {
    return sendText(res, 'text/html; charset=utf-8', renderIndex())
  }
  if (url === '/app.js') {
    return sendText(res, 'application/javascript; charset=utf-8', renderAppJs())
  }
  if (url === '/worker.js') {
    return sendText(res, 'application/javascript; charset=utf-8', renderWorkerJs())
  }
  if (url === '/themes.json') {
    return sendText(res, 'application/json; charset=utf-8', JSON.stringify(THEMES, null, 2))
  }
  if (url === '/reference.slat') {
    const f = join(ROOT, 'docs', 'SAKURA-SCHEME-REFERENCE.slat')
    if (existsSync(f)) {
      return sendText(res, 'text/plain; charset=utf-8', readFileSync(f, 'utf-8'))
    }
    res.writeHead(404); res.end('reference.slat not found'); return
  }
  if (url === '/snippets.json') {
    return sendText(res, 'application/json; charset=utf-8', JSON.stringify(SNIPPETS))
  }
  // Project file listing — used by the Ctrl-P fuzzy finder.
  if (url === '/api/files') {
    const files = collectFiles(ROOT)
    return sendText(res, 'application/json; charset=utf-8', JSON.stringify(files))
  }
  // Read a project file — used when the fuzzy finder picks one.
  if (url.startsWith('/api/file')) {
    const q = new URL(req.url, 'http://localhost').searchParams.get('path') || ''
    const safe = resolve(ROOT, q)
    if (!safe.startsWith(ROOT + '/') && safe !== ROOT) {
      res.writeHead(403); res.end('forbidden'); return
    }
    if (!existsSync(safe)) { res.writeHead(404); res.end('not found'); return }
    return sendText(res, 'text/plain; charset=utf-8', readFileSync(safe, 'utf-8'))
  }
  // Global search endpoint — Ctrl-Shift-F in the web IDE.
  if (url.startsWith('/api/grep')) {
    const q = new URL(req.url, 'http://localhost').searchParams.get('q') || ''
    const r = gsearch(ROOT, q)
    return sendText(res, 'application/json; charset=utf-8', JSON.stringify(r))
  }
  // Serve /src/* for the worker to import modules
  if (url.startsWith('/src/')) {
    const f = join(ROOT, url.slice(1))
    if (existsSync(f) && f.startsWith(join(ROOT, 'src'))) {
      return sendText(res, 'application/javascript; charset=utf-8', readFileSync(f, 'utf-8'))
    }
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(404); res.end('not found')
}

function sendText(res, ctype, body) {
  res.writeHead(200, {
    'Content-Type': ctype,
    'Cache-Control': 'no-cache',
  })
  res.end(body)
}

// ── the HTML shell ───────────────────────────────────────────────────

function renderIndex() {
  const themeJson = JSON.stringify(THEMES)
  const default_ = DEFAULT_THEME
  const themeOptions = Object.keys(THEMES).map(k =>
    `<option value="${k}"${k === default_ ? ' selected' : ''}>${k}</option>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sakura Scheme — Web IDE</title>
  <style>
    :root {
      --bg: #1a1424;
      --text: #f0e6dc;
      --dim: #8b8896;
      --accent: #f7b6c8;
      --accent2: #d47c92;
      --keyword: #9ab6c8;
      --fn: #7ab5db;
      --string: #8ec080;
      --number: #e5b06e;
      --comment: #7a7a8a;
      --ok: #8ec080;
      --warn: #e5b06e;
      --err: #e07474;
      --border: #2e2842;
      --selection: #3d2e52;
      --font: 'JetBrains Mono', Menlo, ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; padding: 0; overflow: hidden;
      font-family: var(--font); background: var(--bg); color: var(--text); }
    /* The TV-set chrome — slim header up top with brand + green LED
       "Run" button, three-pane middle, status bar at the bottom.
       Bezels are 1px accent borders, restrained. Dorky, not saccharine.
       The ✿ sits in the header (one per screen). LED lights during
       eval. Scanline overlay is the finishing touch. */
    #chrome { display: grid; grid-template-rows: 34px 1fr 28px; height: 100vh; }
    #topbar { display: flex; align-items: center; gap: 12px;
      background: var(--bg); border-bottom: 1px solid var(--border);
      padding: 0 12px; font-size: 12px; color: var(--dim); user-select: none; }
    #topbar .brand { color: var(--accent); font-weight: 600; letter-spacing: 0.2px; }
    #topbar .brand .flower { color: var(--accent2); margin-right: 6px; }
    #topbar .spacer { flex: 1; }
    #run-led { display: inline-flex; align-items: center; gap: 6px;
      background: transparent; color: var(--text); font-family: var(--font);
      font-size: 12px; border: 1px solid var(--border); border-radius: 12px;
      padding: 3px 10px 3px 8px; cursor: pointer; }
    #run-led:hover { border-color: var(--accent); }
    #run-led .dot { width: 8px; height: 8px; border-radius: 50%;
      background: var(--dim); box-shadow: none;
      transition: box-shadow 100ms ease-out, background 100ms ease-out; }
    #run-led.on .dot { background: var(--ok);
      box-shadow: 0 0 6px var(--ok), 0 0 12px color-mix(in srgb, var(--ok) 60%, transparent); }
    #save-btn { background: transparent; color: var(--text);
      border: 1px solid var(--border); border-radius: 4px;
      padding: 3px 8px; font-family: var(--font); font-size: 12px; cursor: pointer; }
    #save-btn:hover { border-color: var(--accent); color: var(--accent); }
    #save-btn::before { content: '\\1F4BE'; margin-right: 4px; opacity: 0.7; }
    #app { display: grid; grid-template-columns: 220px 1fr 380px;
      grid-row: 2; height: 100%; overflow: hidden; }
    .pane { border-right: 1px solid var(--border); overflow: hidden; position: relative; }
    .pane:last-of-type { border-right: none; }
    /* Pane header — bezel line. When a pane is focused, the underline
       thickens to var(--accent). Feels like a tuned channel. */
    .pane-header { padding: 8px 12px; font-size: 12px; color: var(--dim);
      border-bottom: 1px solid var(--border); background: var(--bg);
      display: flex; align-items: center; gap: 8px; user-select: none;
      transition: border-color 120ms ease-out; }
    .pane.focused > .pane-header { border-bottom-color: var(--accent); }
    .pane-header .title { color: var(--accent); font-weight: 600; }
    /* Channel-flip flash — briefly invert the header on focus. */
    .pane.tv-flash > .pane-header { background: var(--accent);
      color: var(--bg); border-bottom-color: var(--accent); }
    .pane.tv-flash > .pane-header .title { color: var(--bg); }
    #tree { grid-column: 1; }
    #editor-pane { grid-column: 2; display: flex; flex-direction: column; }
    #editor { flex: 1; position: relative; }
    /* TV scanline overlay — barely-visible horizontal lines on the
       editor. Fixed intensity, no animation, no shimmer. Toggle off
       via the .no-scan class on #chrome (knob toggles). */
    #editor::after { content: ''; position: absolute; inset: 0; pointer-events: none;
      background: repeating-linear-gradient(0deg,
        rgba(255,255,255,0.014) 0 1px,
        transparent 1px 3px);
      z-index: 5; opacity: 0.6; }
    #chrome.no-scan #editor::after { display: none; }
    #repl-pane { grid-column: 3; display: flex; flex-direction: column; }
    #repl { flex: 1; padding: 8px 12px; font-size: 13px; overflow-y: auto;
      white-space: pre-wrap; word-break: break-word; }
    #repl-input { padding: 8px 12px; background: var(--bg); color: var(--text);
      font-family: var(--font); font-size: 13px; border: none;
      border-top: 1px solid var(--border); outline: none; }
    #repl-input:focus { border-top-color: var(--accent); }
    #status { grid-row: 3;
      background: var(--accent2); color: var(--bg); padding: 4px 12px;
      font-size: 12px; display: flex; justify-content: space-between;
      user-select: none; }
    #status .flower { margin-right: 6px; }
    #tree ul { list-style: none; padding: 0; margin: 0; font-size: 12px; }
    #tree li { padding: 4px 12px; cursor: pointer; }
    #tree li:hover { background: var(--selection); }
    #tree li.dir { color: var(--fn); }
    #tree li.selected { background: var(--selection); color: var(--accent); }
    .repl-line { margin-bottom: 4px; }
    .repl-prompt { color: var(--accent); }
    .repl-error { color: var(--err); }
    .repl-info { color: var(--comment); }
    .repl-value { color: var(--text); }
    /* Preview canvas sits inside a small "TV" — rounded frame with a
       hairline border + tiny brand tag. */
    #preview { padding: 10px 12px; border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 90%, black 10%); }
    #preview .frame { border: 1px solid var(--border); border-radius: 6px;
      padding: 6px; background: #000; box-shadow: 0 2px 12px rgba(0,0,0,0.4); }
    #preview canvas { display: block; max-width: 100%; image-rendering: pixelated;
      border-radius: 3px; }
    #preview .label { color: var(--dim); font-size: 10px; margin-bottom: 6px;
      display: flex; justify-content: space-between; align-items: center;
      text-transform: uppercase; letter-spacing: 0.08em; }
    .modal { position: fixed; top: 30%; left: 50%; transform: translate(-50%, -30%);
      width: 560px; max-width: 90vw; background: var(--bg);
      border: 1px solid var(--accent); border-radius: 6px; padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 100; }
    .modal h3 { margin: 0 0 8px 0; color: var(--accent); }
    .modal input { width: 100%; background: transparent; color: var(--text);
      border: 1px solid var(--border); padding: 8px; font-family: var(--font);
      outline: none; font-size: 14px; }
    .modal input:focus { border-color: var(--accent); }
    .modal .hint { color: var(--dim); font-size: 12px; margin-top: 8px; }
    #theme-picker select { background: transparent; color: var(--text);
      border: 1px solid var(--border); padding: 3px 8px; font-family: var(--font);
      font-size: 12px; border-radius: 4px; }
    #theme-picker select:focus { border-color: var(--accent); outline: none; }
    /* Knob gear — clickable, toggles scanline for now. */
    #knob { background: transparent; border: 1px solid var(--border);
      border-radius: 50%; width: 22px; height: 22px; cursor: pointer;
      color: var(--dim); font-size: 12px; line-height: 1; display: flex;
      align-items: center; justify-content: center; }
    #knob:hover { border-color: var(--accent); color: var(--accent); }
    /* Inline REPL result — ghost text after the last form's closing paren
       when Ctrl-Enter succeeded. Small, dim, italic; unobtrusive. */
    .inline-result { color: var(--dim); font-style: italic;
      padding-left: 8px; opacity: 0.85; }
    /* Fuzzy / palette / grep result list — a common shape. */
    .pick-list { max-height: 60vh; overflow-y: auto; margin-top: 12px;
      border-top: 1px solid var(--border); padding-top: 8px; }
    .pick-item { padding: 6px 8px; cursor: pointer; font-size: 13px;
      color: var(--text); border-radius: 4px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .pick-item .hint { color: var(--dim); font-size: 11px; margin-left: 12px; }
    .pick-item.sel, .pick-item:hover { background: var(--selection); }
    .pick-modal { width: 640px; max-width: 92vw; }
  </style>
  <link rel="stylesheet" data-name="vs/editor/editor.main"
        href="https://unpkg.com/monaco-editor@0.44.0/min/vs/editor/editor.main.css">
</head>
<body>
  <!--
    The TV-set aesthetic: a slim header with brand + LED "Run" +
    "Save" + a knob + theme picker. Three panes below. Status bar
    under. One ✿ per screen — one in the header brand, one in the
    status bar. Dorky, deliberate, not saccharine.
  -->
  <div id="chrome">
    <div id="topbar">
      <span class="brand"><span class="flower">✿</span> sakura-scheme</span>
      <button id="run-led" title="Run buffer (Ctrl-Enter)">
        <span class="dot"></span><span>run</span>
      </button>
      <button id="save-btn" title="Save (Ctrl-S)">save</button>
      <span class="spacer"></span>
      <span id="knob" title="settings — toggle scanlines">⚙</span>
      <span id="theme-picker">
        <select id="theme-select" title="theme">
          ${themeOptions}
        </select>
      </span>
    </div>
    <div id="app">
      <div id="tree" class="pane">
        <div class="pane-header"><span class="title">files</span></div>
        <ul id="tree-list"></ul>
      </div>
      <div id="editor-pane" class="pane focused">
        <div class="pane-header">
          <span class="title" id="file-name">[untitled]</span>
          <span id="modified-marker" style="color: var(--accent);"></span>
        </div>
        <div id="editor"></div>
        <div id="preview" style="display:none">
          <div class="frame">
            <div class="label"><span>preview</span><span>tv-01</span></div>
            <canvas id="preview-canvas" width="256" height="256"></canvas>
          </div>
        </div>
      </div>
      <div id="repl-pane" class="pane">
        <div class="pane-header"><span class="title">repl</span></div>
        <div id="repl"></div>
        <input id="repl-input" type="text" placeholder="expr, Enter to run" spellcheck="false">
      </div>
    </div>
    <div id="status">
      <span id="status-left"><span class="flower">✿</span> web · ${default_} · verbs: — · loading…</span>
      <span id="status-right">Tab: focus · Ctrl-Enter: run · Ctrl-K: ask · Ctrl-S: save</span>
    </div>
  </div>
  <script>window.__THEMES__ = ${themeJson};</script>
  <script>window.__DEFAULT_THEME__ = ${JSON.stringify(default_)};</script>
  <script src="https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js"></script>
  <script type="module" src="/app.js"></script>
</body>
</html>`
}

// ── the app.js frontend ──────────────────────────────────────────────

function renderAppJs() {
  return APP_JS
}
function renderWorkerJs() {
  return WORKER_JS
}

const APP_JS = `// app.js — Sakura Scheme Web IDE frontend.
const THEMES = window.__THEMES__;
const DEFAULT_THEME = window.__DEFAULT_THEME__;

// Theme persistence — remember last picked theme in localStorage, but
// let a ?theme= query param override for one-off links. Small nicety;
// no cookies, no server round-trip.
function pickInitialTheme() {
  try {
    const u = new URL(window.location.href);
    const qp = u.searchParams.get('theme');
    if (qp && THEMES[qp]) return qp;
  } catch {}
  try {
    const saved = localStorage.getItem('sakura-theme');
    if (saved && THEMES[saved]) return saved;
  } catch {}
  return DEFAULT_THEME;
}

function applyTheme(name) {
  const t = THEMES[name] || THEMES[DEFAULT_THEME];
  if (!t) return;
  const web = t.web;
  for (const [k, v] of Object.entries(web)) {
    document.documentElement.style.setProperty('--' + k, v);
  }
  if (window.monaco && window.__EDITOR__) {
    monaco.editor.setTheme((name === 'sakura-dark' || name === 'high-contrast') ? 'sakura-dark' : 'sakura-light');
  }
  try { localStorage.setItem('sakura-theme', name); } catch {}
}
const INITIAL_THEME = pickInitialTheme();
applyTheme(INITIAL_THEME);
{
  const sel = document.getElementById('theme-select');
  sel.value = INITIAL_THEME;
  sel.addEventListener('change', e => applyTheme(e.target.value));
}

// TV-set knob — toggle scanline overlay on/off. Persisted so a
// hacker who hates crt-effects can turn it off and it stays off.
{
  const knob = document.getElementById('knob');
  const chrome = document.getElementById('chrome');
  const noScan = (() => { try { return localStorage.getItem('sakura-no-scan') === '1'; } catch { return false; } })();
  if (noScan) chrome.classList.add('no-scan');
  knob.addEventListener('click', () => {
    chrome.classList.toggle('no-scan');
    try { localStorage.setItem('sakura-no-scan', chrome.classList.contains('no-scan') ? '1' : '0'); } catch {}
  });
}

// Pane focus tracking + TV-click flash. Clicking a pane (or focusing
// its input) marks it .focused and briefly .tv-flash for the channel-
// change feel. All three panes participate.
function setFocusedPane(paneEl) {
  const panes = document.querySelectorAll('.pane');
  panes.forEach(p => p.classList.remove('focused'));
  paneEl.classList.add('focused');
  paneEl.classList.add('tv-flash');
  setTimeout(() => paneEl.classList.remove('tv-flash'), 140);
}
document.querySelectorAll('.pane').forEach(p => {
  p.addEventListener('mousedown', () => setFocusedPane(p));
});

const worker = new Worker('/worker.js', { type: 'module' });
const pending = new Map();
let nextId = 1;
function askWorker(kind, payload) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, kind, payload });
  });
}
worker.onmessage = (e) => {
  const { id, ok, value, error, event } = e.data;
  if (event === 'ready') {
    // Keep the ✿ in the status line — it was already there from the
    // server-rendered HTML; we replace the text content so the flower
    // needs to be re-injected.
    const el = document.getElementById('status-left');
    el.innerHTML = '<span class="flower">✿</span> web · ' + INITIAL_THEME + ' · verbs: ' + e.data.verbCount + ' · ready';
    return;
  }
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (ok) p.resolve(value); else p.reject(new Error(error));
};

require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  monaco.languages.register({ id: 'sakura-scheme' });
  monaco.languages.setMonarchTokensProvider('sakura-scheme', {
    tokenizer: {
      root: [
        [/;.*$/, 'comment'],
        [/"(?:\\\\.|[^"\\\\])*"/, 'string'],
        [/-?\\b[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?\\b/, 'number'],
        [/\\b(define|lambda|if|when|unless|cond|case|let|let\\*|letrec|set!|quote|quasiquote|unquote|begin|and|or|do|define-syntax|syntax-rules)\\b/, 'keyword'],
        [/[a-zA-Z!?<>=+\\-*/_%^&:][a-zA-Z0-9!?<>=+\\-*/_%^&:.]*/, 'identifier'],
        [/[\\(\\)\\[\\]]/, 'delimiter.bracket'],
      ],
    },
  });
  monaco.editor.defineTheme('sakura-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment',   foreground: '7a7a8a', fontStyle: 'italic' },
      { token: 'string',    foreground: '8ec080' },
      { token: 'number',    foreground: 'e5b06e' },
      { token: 'keyword',   foreground: '9ab6c8', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'f0e6dc' },
    ],
    colors: {
      'editor.background': '#1a1424',
      'editor.foreground': '#f0e6dc',
      'editorCursor.foreground': '#f7b6c8',
      'editorLineNumber.foreground': '#5e5a70',
    },
  });
  monaco.editor.defineTheme('sakura-light', {
    base: 'vs', inherit: true,
    rules: [
      { token: 'comment',   foreground: 'b5b5b5', fontStyle: 'italic' },
      { token: 'string',    foreground: '5e8b5e' },
      { token: 'number',    foreground: 'c07a3e' },
      { token: 'keyword',   foreground: '6b7ea8', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#faf7f4',
      'editor.foreground': '#1a1a1a',
      'editorCursor.foreground': '#d47c92',
    },
  });

  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: [
      '; Sakura Scheme — Web IDE',
      '; Ctrl-Enter to run · Ctrl-S to save · Ctrl-K to ask Sakura',
      '',
      '(define (greet name)',
      '  (display "Hello, ")',
      '  (display name)',
      '  (newline))',
      '',
      '(greet "world")',
      '',
      '(list',
      '  (tick/sine 30 60 1 0)',
      '  (ops/eoq 1000 50 2)',
      '  (game/nim-sum 3 5 7))',
      '',
    ].join('\\n'),
    language: 'sakura-scheme',
    theme: 'sakura-dark',
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Menlo, ui-monospace, monospace',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    lineNumbers: 'on',
    renderWhitespace: 'boundary',
    bracketPairColorization: { enabled: true },
    matchBrackets: 'always',
  });
  window.__EDITOR__ = editor;

  askWorker('list-verbs').then((verbs) => {
    monaco.languages.registerCompletionItemProvider('sakura-scheme', {
      triggerCharacters: ['(', ' ', ':', '/', '-'],
      provideCompletionItems: (model, pos) => {
        const word = model.getWordUntilPosition(pos);
        return {
          suggestions: verbs.filter(v => v.name.toLowerCase().startsWith(word.word.toLowerCase())).slice(0, 100).map(v => ({
            label: v.name,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: v.sig || '',
            documentation: v.summary || '',
            insertText: v.name,
            range: {
              startLineNumber: pos.lineNumber,
              endLineNumber: pos.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
          })),
        };
      },
    });
    document.getElementById('status-left').innerHTML =
      '<span class="flower">✿</span> web · ' + INITIAL_THEME + ' · verbs: ' + verbs.length + ' · ready';
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runBuffer());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveFile());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => openAsk());

  const runLed = document.getElementById('run-led');
  async function runBuffer() {
    const src = editor.getValue();
    runLed.classList.add('on');
    try {
      const result = await askWorker('eval', { source: src });
      pushRepl('; run buffer', 'info');
      pushRepl(result === undefined ? '' : String(result), 'value');
    } catch (e) {
      pushRepl('; run buffer', 'info');
      pushRepl('!! ' + e.message, 'error');
    } finally {
      // Small hold on the LED so a fast eval still visibly blinks.
      setTimeout(() => runLed.classList.remove('on'), 120);
    }
  }
  runLed.addEventListener('click', () => runBuffer());
  document.getElementById('save-btn').addEventListener('click', () => saveFile());

  let fileHandle = null;
  async function saveFile() {
    const contents = editor.getValue();
    if ('showSaveFilePicker' in window && !fileHandle) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: 'buffer.scm',
          types: [{ description: 'Scheme', accept: { 'text/plain': ['.scm', '.sks', '.slat'] } }],
        });
      } catch { return; }
    }
    if (fileHandle) {
      const w = await fileHandle.createWritable();
      await w.write(contents);
      await w.close();
      document.getElementById('file-name').textContent = fileHandle.name;
      document.getElementById('modified-marker').textContent = '';
    } else {
      const blob = new Blob([contents], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'buffer.scm';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  editor.onDidChangeModelContent(() => {
    document.getElementById('modified-marker').textContent = ' •';
  });

  const replInput = document.getElementById('repl-input');
  const replHistory = [];
  let histIdx = null;
  replInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const line = replInput.value;
      if (!line.trim()) return;
      replInput.value = '';
      histIdx = null;
      replHistory.push(line);
      pushRepl('> ' + line, 'prompt');
      try {
        const result = await askWorker('eval', { source: line });
        pushRepl(result === undefined ? '' : String(result), 'value');
      } catch (err) {
        pushRepl('!! ' + err.message, 'error');
      }
    } else if (e.key === 'ArrowUp') {
      if (replHistory.length === 0) return;
      histIdx = histIdx === null ? replHistory.length - 1 : Math.max(0, histIdx - 1);
      replInput.value = replHistory[histIdx];
    } else if (e.key === 'ArrowDown') {
      if (histIdx === null) return;
      histIdx += 1;
      if (histIdx >= replHistory.length) { histIdx = null; replInput.value = ''; }
      else replInput.value = replHistory[histIdx];
    }
  });

  function pushRepl(text, kind) {
    const el = document.getElementById('repl');
    const div = document.createElement('div');
    div.className = 'repl-line repl-' + (kind || 'value');
    div.textContent = text;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function openAsk() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const h = document.createElement('h3'); h.textContent = 'Ask Sakura';
    const input = document.createElement('input');
    input.id = 'ask-input';
    input.placeholder = 'natural language → suggested code';
    input.autofocus = true;
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Enter to insert · Esc to cancel';
    modal.appendChild(h);
    modal.appendChild(input);
    modal.appendChild(hint);
    document.body.appendChild(modal);
    input.focus();
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') { modal.remove(); return; }
      if (e.key === 'Enter') {
        const q = input.value;
        modal.remove();
        const suggestion = await askWorker('ask', { query: q });
        if (suggestion) editor.trigger('keyboard', 'type', { text: suggestion });
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.ctrlKey === false && document.activeElement === document.getElementById('repl-input')) {
      editor.focus();
      e.preventDefault();
    }
  });

  document.getElementById('theme-select').addEventListener('change', e => {
    const name = e.target.value;
    const dark = name === 'sakura-dark' || name === 'high-contrast';
    monaco.editor.setTheme(dark ? 'sakura-dark' : 'sakura-light');
  });

  pushRepl('; Sakura Scheme Web IDE ready', 'info');
  pushRepl('; Ctrl-Enter runs the editor buffer', 'info');
});
`

// ── the worker.js — bundles the Scheme runtime ───────────────────────

const WORKER_JS = `// worker.js — the WebWorker running Scheme in the browser.
import { parse } from '/src/reader.js';
import { evaluate } from '/src/interp.js';
import { expandProgram } from '/src/macro.js';
import { makeSakuraEnv } from '/src/sakuraEnv.js';
import { loadReference } from '/src/reference-loader.js';

const fuel = { n: 2000000 };
let env;
try {
  env = makeSakuraEnv(fuel);
} catch (e) {
  postMessage({ event: 'error', error: 'boot failed: ' + e.message });
  throw e;
}

const ref = loadReference();
postMessage({ event: 'ready', verbCount: ref.verbList.length });

function schemeToString(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? '#t' : '#f';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return '(' + v.map(schemeToString).join(' ') + ')';
  if (v && typeof v === 'object' && v.name) return v.name;
  try { return JSON.stringify(v); } catch { return String(v); }
}

const KEYWORD_MAP = [
  [/hello|greet|hi/i,           '(display "Hello, world!\\\\n")'],
  [/random|dice|roll/i,         '(random-integer 1 6)'],
  [/list|collection|series/i,   '(list 1 2 3)'],
  [/circle|draw|paint/i,        '(circle 50 50 20)'],
  [/rectangle|square/i,         '(rectangle 10 10 40 30)'],
  [/count|length|size/i,        '(length (list 1 2 3))'],
  [/sum|add|total/i,            '(+ 1 2 3)'],
  [/sin|sine|wave/i,            '(tick/sine 30 60 1 0)'],
  [/matrix/i,                   '(matrix/* (list (list 1 2)(list 3 4)) (list (list 5 6)(list 7 8)))'],
  [/permutation|choose|combinatoric/i, '(comb/choose 5 2)'],
  [/stats?|standard deviation/i, '(stat/sd (list 1 2 3 4 5))'],
  [/queue|little/i,             '(ops/mm1 5 10)'],
  [/eoq|inventory/i,            '(ops/eoq 1000 50 2)'],
  [/entity|sprite|character/i,  '(entity/make (quote hero) 40 40)'],
  [/beat|drum/i,                '(beat/on 1 4)'],
  [/note|pitch/i,               '(note/strike "C4" 0.5)'],
  [/nim|game/i,                 '(game/nim-sum 3 5 7)'],
  [/cortex|memory|remember/i,   '(cortex/write "key" "value")'],
  [/recall|lookup/i,            '(cortex/read "key")'],
];

onmessage = (e) => {
  const { id, kind, payload } = e.data;
  try {
    if (kind === 'eval') {
      const forms = parse(payload.source);
      const { forms: expanded } = expandProgram(forms);
      const localFuel = { n: 2000000 };
      let last;
      for (const f of expanded) last = evaluate(f, env, localFuel);
      postMessage({ id, ok: true, value: schemeToString(last) });
      return;
    }
    if (kind === 'list-verbs') {
      const out = [];
      const seen = new Set();
      for (const v of ref.verbList) {
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        out.push({ name: v.name, sig: v.signature, summary: v.summary, kind: v.kind });
      }
      postMessage({ id, ok: true, value: out });
      return;
    }
    if (kind === 'ask') {
      const q = String(payload.query || '').trim();
      let suggestion = null;
      const p = q.toLowerCase();
      for (const v of ref.verbList) {
        if (v.name.toLowerCase().startsWith(p)) {
          const argMatch = (v.signature || '').match(/^\\(\\S+\\s*(.*?)\\)/);
          const args = argMatch ? argMatch[1].split(/\\s+/).filter(Boolean).map(() => '_').join(' ') : '';
          suggestion = '(' + v.name + (args ? ' ' + args : '') + ')';
          break;
        }
      }
      if (!suggestion) {
        for (const [re, tpl] of KEYWORD_MAP) {
          if (re.test(q)) { suggestion = tpl; break; }
        }
      }
      if (!suggestion) suggestion = '; ask: ' + q + '\\n';
      postMessage({ id, ok: true, value: suggestion });
      return;
    }
    postMessage({ id, ok: false, error: 'unknown message kind: ' + kind });
  } catch (err) {
    postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};
`

export default startWebIde
