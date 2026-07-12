// repl.js — the interactive Read-Eval-Print-Loop.
//
// Public entry: `startRepl({ dialect })`. Loads config, builds the base
// env, prints the banner (if dialect is 'sakura'), then reads-evaluates-
// prints until Ctrl-D or ,exit.
//
// This module glues:
//   • base engine  (reader → macro → interp → base env)
//   • line editor  (raw-mode TTY loop with autocomplete + highlight)
//   • meta commands (,help / ,type / …)
//   • rich display (tables, Braille graphics)
//   • history + config

import { parse } from '../reader.js'
import { evaluate, apply as applyFn, Env } from '../interp.js'
import { expandProgram } from '../macro.js'
import { makeBaseEnv } from '../base.js'
import { LineEditor } from './lineEditor.js'
import { History } from './history.js'
import { loadConfig } from './config.js'
import { sakuraBanner, neutralBanner, printBanner } from './banner.js'
import { dispatchMeta, metaCommandNames } from './metaCommands.js'
import { verbInfo, allKnownVerbs, CORE_DOCS } from './verbInfo.js'
import { completeSymbol, currentToken } from './complete.js'
import { display } from './richDisplay.js'
import { role } from './palette.js'
import { recordSessionLine } from './session.js'
import { Sym } from '../reader.js'

const DEFAULT_FUEL = 200000

/**
 * startRepl({ dialect, banner, prompt, version, tagline })
 *
 * dialect  — 'sakura' | 'neutral'
 * banner   — override the default banner lines (array of strings)
 * prompt   — override the prompt (default 'sakura> ' / 'scheme> ')
 * version  — printed in banner
 * tagline  — printed under banner for non-Sakura dialects
 */
export async function startRepl(options = {}) {
  const dialect = options.dialect || 'sakura'
  const version = options.version || '1.0.0'
  const config = loadConfig()
  const prompt = options.prompt || (dialect === 'sakura' ? 'sakura> ' : 'scheme> ')
  const promptCont = options.promptCont || (dialect === 'sakura' ? '     ~> ' : '    ~> ')

  // Banner (only when we have a TTY — no banner for piped/scripted use).
  if (process.stdin.isTTY) {
    if (options.banner) {
      printBanner(options.banner)
    } else if (dialect === 'sakura') {
      printBanner(sakuraBanner({ version }))
    } else {
      printBanner(neutralBanner({ name: options.name || 'Scheme', version, tagline: options.tagline }))
    }
  }

  // Engine.
  const fuel = { n: DEFAULT_FUEL }
  const env = makeBaseEnv(fuel)

  // Results.
  const results = { last: undefined, list: [] }

  // Rebind `_`, `_1`, … after each evaluation.
  function rebindResults() {
    env.define('_', results.last, { perm: 'read' })
    for (let i = 1; i <= 9 && i <= results.list.length; i++) {
      env.define(`_${i}`, results.list[results.list.length - i], { perm: 'read' })
    }
  }
  rebindResults()

  // History.
  const history = new History()

  // REPL context passed into meta-commands.
  const ctx = {
    env, fuel, history, results,
    out: (s) => process.stdout.write(s),
    writeLine: (s) => process.stdout.write((s || '') + '\n'),
    exit: (code = 0) => {
      history.save()
      process.stdout.write('\n' + role.dim('  goodbye  ✿\n'))
      process.exit(code)
    },
    evaluate: (src) => runSource(src, env, fuel),
    applyFn: (fn, args) => applyFn(fn, args, fuel),
    rebindResults,
    // Piped/non-TTY confirm — default to false so we don't lose data;
    // TTY mode lets the user pass --yes-all explicitly. A future hook
    // could wire an interactive prompt here.
    confirm: () => false,
    watchExpr: null,
    traces: null,
    traceOriginals: null,
    fileWatchers: null,
    sessionLines: [],
    sessionResults: [],
  }

  // Sig hint — the ghost row above the cursor. Given the buffer, walk
  // backwards to find the innermost open '(' and the symbol after it;
  // if that symbol has doc, render "(name sig-args)   — doc".
  function sigHint(buffer, cursor) {
    // Walk backwards, find the nearest unmatched '(' before cursor.
    let depth = 0
    let openAt = -1
    for (let i = cursor - 1; i >= 0; i--) {
      const c = buffer[i]
      if (c === ')') depth++
      else if (c === '(') {
        if (depth === 0) { openAt = i; break }
        depth--
      }
    }
    if (openAt < 0) return null
    // Read the head symbol after openAt.
    let j = openAt + 1
    // Skip whitespace.
    while (j < buffer.length && /\s/.test(buffer[j])) j++
    const start = j
    while (j < buffer.length && !/[\s()[\]"'`,]/.test(buffer[j])) j++
    const head = buffer.slice(start, j)
    if (!head) return null
    const info = CORE_DOCS[head]
    if (info) return `${info.sig}   ${info.doc}`
    // Fall back to bound-value inspection.
    const bound = envLookup(env, head)
    if (bound && typeof bound === 'function') return `(${head} …)   [primitive — ${bound.length} required arg(s)]`
    if (bound && bound.params) return `(${head} ${bound.params.join(' ')}${bound.restParam ? ' . ' + bound.restParam : ''})`
    return null
  }

  // Autocomplete source.
  function completeFn(query) {
    // If the cursor is at start of a comma-command word, offer meta commands.
    const meta = metaCommandNames()
    const buffer = editor.buffer || ''
    const cursor = editor.cursor || 0
    if (buffer.startsWith(',') && !/\s/.test(buffer.slice(0, cursor))) {
      // Completing a ,command.
      const q = buffer.slice(1)
      const names = [...meta].sort()
      return completeSymbol(q, { names }, { limit: 20 })
    }
    return completeSymbol(query, { names: allKnownVerbs(env) }, { limit: 20 })
  }

  // If stdin is not a TTY (piped input / test harness), use a plain
  // line-buffered loop. No raw mode, no editor UI — just prompt / read
  // line / print. Enough for automated smoke tests and Unix pipes.
  if (!process.stdin.isTTY) {
    return runPipedRepl({ ctx, env, fuel, results, rebindResults, prompt })
  }

  // Build the editor.
  const editor = new LineEditor({
    prompt, promptCont, history,
    complete: completeFn,
    sigHint,
    config,
    output: process.stdout,
  })

  // Main loop.
  while (true) {
    // Watch expression: reprint on every prompt.
    if (ctx.watchExpr) {
      try {
        const v = runSource(ctx.watchExpr, env, fuel)
        process.stdout.write(role.dim('  watch: ') + display(v) + '\n')
      } catch { /* silent */ }
    }

    let input
    try {
      input = await editor.read()
    } catch (e) {
      process.stdout.write(role.err('input error: ' + e.message) + '\n')
      continue
    }

    // Exit on Ctrl-D from empty line.
    if (input && typeof input === 'object' && input.command === 'exit') {
      ctx.exit(0)
      return
    }

    const line = (typeof input === 'string') ? input : ''
    if (!line.trim()) continue

    history.add(line)

    // Meta command shortcut.
    if (line.startsWith(',')) {
      dispatchMeta(ctx, line)
      continue
    }

    // Otherwise: parse + expand + evaluate.
    try {
      const value = runSource(line, env, fuel)
      results.last = value
      results.list.push(value)
      if (results.list.length > 20) results.list.shift()
      rebindResults()
      recordSessionLine(ctx, line, value)
      process.stdout.write(display(value) + '\n')
    } catch (e) {
      process.stdout.write(role.err('error: ' + (e && e.message ? e.message : String(e))) + '\n')
    }

    // Give fuel a top-up between prompts so long sessions don't exhaust it.
    fuel.n = DEFAULT_FUEL
  }
}

/**
 * Non-TTY REPL loop — reads from stdin one line at a time (accumulating
 * across balanced parens), no editor UI, minimal color. Used for piped
 * input and test harnesses.
 */
async function runPipedRepl({ ctx, env, fuel, results, rebindResults, prompt }) {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false })

  const { isBalanced } = await import('./highlight.js')
  const { dispatchMeta } = await import('./metaCommands.js')

  let acc = ''
  process.stdout.write(prompt)
  for await (const line of rl) {
    acc += (acc ? '\n' : '') + line
    if (!acc.trim()) { acc = ''; process.stdout.write(prompt); continue }
    if (acc.trim().startsWith(',')) {
      dispatchMeta(ctx, acc.trim())
      acc = ''
      process.stdout.write(prompt)
      continue
    }
    if (!isBalanced(acc)) {
      process.stdout.write('  ~> ')
      continue
    }
    ctx.history.add(acc)
    try {
      const value = runSource(acc, env, fuel)
      results.last = value
      results.list.push(value)
      if (results.list.length > 20) results.list.shift()
      rebindResults()
      recordSessionLine(ctx, acc, value)
      process.stdout.write(display(value) + '\n')
    } catch (e) {
      process.stdout.write(role.err('error: ' + (e && e.message ? e.message : String(e))) + '\n')
    }
    fuel.n = 200000
    acc = ''
    process.stdout.write(prompt)
  }
  ctx.exit(0)
}

function envLookup(env, name) {
  let e = env
  while (e) {
    if (e.vars && e.vars.has && e.vars.has(name)) return e.vars.get(name)
    e = e.parent
  }
  return null
}

function runSource(src, env, fuel) {
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms)
  let last
  for (const f of expanded) last = evalReplForm(f, env, fuel)
  return last
}

// REPL-layer eval — normal Scheme, with a small friendlier intercept for
// unbound "obviously data" forms so a beginner can type
//
//     sakura> (circle 40 40 15)
//
// and see the picture without needing to know about quotes yet.
// Real Scheme semantics for anything the user has actually bound.
const AUTO_QUOTE_HEADS = new Set(['circle', 'disc', 'line', 'rect', 'shapes', 'plot'])
function evalReplForm(form, env, fuel) {
  // (open pod-bay-doors) → HAL. Only fires if `open` is unbound.
  if (Array.isArray(form) && form.length >= 2
      && form[0] && form[0].name === 'open'
      && !hasBinding(env, 'open')) {
    const arg = form[1]
    const argName = arg && arg.name ? arg.name
                  : Array.isArray(arg) && arg[0] && arg[0].name === 'quote'
                    && arg[1] && arg[1].name ? arg[1].name
                  : null
    if (argName === 'pod-bay-doors' || argName === 'the-pod-bay-doors') {
      return "I'm sorry Dave. I'm afraid I can't do that."
    }
  }
  // (circle 40 40 15) etc. → treat as data if head is unbound.
  if (Array.isArray(form) && form.length >= 1
      && form[0] && form[0].name
      && AUTO_QUOTE_HEADS.has(form[0].name)
      && !hasBinding(env, form[0].name)) {
    // Return the list literally — the rich display recognises the
    // tagged-list shape and renders it as a graphic.
    return form
  }
  return evaluate(form, env, fuel)
}

function hasBinding(env, name) {
  let e = env
  while (e) {
    if (e.vars && e.vars.has(name)) return true
    e = e.parent
  }
  return false
}
