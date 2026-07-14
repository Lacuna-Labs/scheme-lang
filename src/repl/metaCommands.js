// metaCommands.js — every ,command the REPL responds to.
//
// A meta-command is a REPL input beginning with `,`. The line editor
// short-circuits — never sends it through the Scheme evaluator. The
// handler for each command is a plain function that receives the REPL
// context + args.
//
// Registration is data-driven: the `COMMANDS` table lists every command,
// its aliases, a one-line summary (for `,help`), and the handler. Adding
// a new one is a single entry.

import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { role, PALETTE, fg, statusRole, statusLegend } from './palette.js'
import { verbInfo, allKnownVerbs, CORE_DOCS } from './verbInfo.js'
import { classifyVerb, statusMarker, colorizeVerb } from './verbStatus.js'
import { fuzzyScore } from './complete.js'
import { display, schemeFormat } from './richDisplay.js'
import { parse } from '../reader.js'
import { expandProgram } from '../macro.js'
import { installTrace, removeTrace, tracedNames } from './trace.js'
import { inspect } from './valueInspector.js'
import { addWatch, removeWatch, listWatches } from './fileWatcher.js'
import { saveSession, loadSession } from './session.js'
import { detectCapabilities, pickProtocol } from './imageRouter.js'
// NOTE (2026-07-14): a previous round scaffolded imports for command
// modules that haven't landed yet — miniEditor, miniDisplay, funFlags,
// tutorial. They were never called from this file. Import removal
// unblocks the CLI; the commands themselves ship whenever those modules
// land.

/**
 * Context passed to every handler:
 *   { env, fuel, history, results, out, writeLine, refresh, exit }
 *
 * - env         — live REPL environment (from base.js)
 * - fuel        — the mutable fuel counter
 * - history     — History instance
 * - results     — { last, list } (for _, _1, _2 …)
 * - out(str)    — write to stdout
 * - writeLine(s) — write with trailing newline
 * - exit(code)  — clean shutdown
 */

// ── handlers ─────────────────────────────────────────────────────────

function cmdHelp(ctx, args) {
  const [target] = args
  if (target) return cmdVerbHelp(ctx, [target])
  const { writeLine } = ctx
  writeLine('')
  writeLine(role.section('REPL commands'))
  writeLine('')
  const rows = [
    [',help [verb]',         'this help, or verb-specific help'],
    [',type <sym>',          'return-type signature'],
    [',doc <sym>',           'docstring only'],
    [',arity <sym>',         'arity only'],
    [',examples <sym>',      'three tiered examples'],
    [',source <sym>',        'file:line if known'],
    [',namespace <ns>',      'every verb in namespace'],
    [',apropos <regex>',     'symbols whose name matches'],
    [',search <regex>',      'search docs + examples'],
    [',verbs [status]',      'verb-status summary + color legend'],
    [',time <expr>',         'wall + fuel + memory for expr'],
    [',expand <form>',       'macro-expand once'],
    [',expand-1 <form>',     'one-step expand'],
    [',watch <expr>',        'reprint expr result on every prompt'],
    [',unwatch',             'clear the watch expression'],
    [',trace <fn>',          'trace calls to fn'],
    [',untrace <fn>',        'stop tracing'],
    [',inspect <val>',       'walk into a value (arrow keys)'],
    [',undo',                'pop last evaluation'],
    [',save <file>',         'save session as .slat'],
    [',load <file>',         'load .slat session (replay defines + history)'],
    [',watch-file <path>',   'live-reload defines from .scm on save'],
    [',unwatch-file [path]', 'stop watching (all if no path)'],
    [',image',               'report inline-image capabilities'],
    [',shell <cmd>',         'run a shell command'],
    [',ask sakura <q>',      'ask Sakura (requires config)'],
    [',clear',               'clear the screen'],
    [',keys',                'show key bindings'],
    [',reset',               'reset environment'],
    [',exit / ,quit',        'leave the REPL'],
  ]
  for (const [cmd, doc] of rows) {
    writeLine('  ' + role.meta(cmd.padEnd(22)) + role.dim('  ') + role.text(doc))
  }
  writeLine('')
  writeLine(role.dim('  Named results: _  = last result   _1 = previous   _2 = before'))
  writeLine(role.dim('  Balanced Enter evaluates; Shift-Enter or unbalanced Enter adds a line.'))
  writeLine('')
}

function cmdVerbHelp(ctx, args) {
  const [name] = args
  const { writeLine, env } = ctx
  if (!name) return cmdHelp(ctx, [])
  const info = verbInfo(env, name)
  if (!info) {
    // Not-registered → red + did-you-mean.
    writeLine(role.statusMissing(name) + role.dim(`  · missing (not registered)`))
    const suggestions = didYouMean(env, name, 5)
    if (suggestions.length > 0) {
      writeLine('')
      writeLine(role.dim('  did you mean:'))
      for (const s of suggestions) {
        writeLine('    ' + statusRole(s.status)(s.name) + role.dim(` · ${s.status}`))
      }
    }
    const hint = dialectHintFor(name)
    if (hint) writeLine(role.dim(`  hint: ${hint}`))
    writeLine('')
    return
  }
  // Status prominent at top — the color of the name IS the status.
  const status = info.status || 'implemented'
  const paint = statusRole(status)
  writeLine('')
  writeLine(
    paint(name)
    + role.dim(`  · ${info.kind}`)
    + role.dim(`  · ${statusMarker(status)} ${status}`)
  )
  if (info.sig) writeLine('  ' + role.fn(info.sig))
  if (info.doc) writeLine('  ' + role.text(info.doc))
  if (status === 'stubbed') {
    writeLine('  ' + role.warn('stubbed — contract known, no implementation yet'))
    if (info.stubMessage) writeLine('  ' + role.dim(info.stubMessage))
  } else if (status === 'platform-unsupported') {
    writeLine('  ' + role.warn('unsupported on this platform'))
    if (info.stubMessage) writeLine('  ' + role.dim(info.stubMessage))
  } else if (status === 'user-stub') {
    writeLine('  ' + role.hint('user-stub — placeholder you defined with (define-stub …)'))
    if (info.stubMessage) writeLine('  ' + role.dim(info.stubMessage))
  }
  if (info.examples && info.examples.length) {
    writeLine('')
    writeLine(role.dim('  examples:'))
    for (const ex of info.examples) {
      writeLine('    ' + role.text(ex))
    }
  }
  writeLine('')
}

// didYouMean(env, query, k) → ranked candidates
// Uses the fuzzy scorer from complete.js against the union of known
// verb names. Filters below a small threshold so an unrelated name
// doesn't shove nonsense at the user.
function didYouMean(env, query, k = 5) {
  const names = [...allKnownVerbs(env)]
  const scored = names
    .map((n) => ({ name: n, score: fuzzyScore(query, n) }))
    .filter((h) => h.score > 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
  return scored.map((h) => ({
    name: h.name,
    status: classifyVerb(env, h.name).status,
  }))
}

function cmdType(ctx, args) {
  const info = verbInfo(ctx.env, args[0])
  if (!info) return ctx.writeLine(role.warn(`no info for '${args[0]}'`))
  ctx.writeLine(role.text(info.sig || info.kind))
}

function cmdDoc(ctx, args) {
  const info = verbInfo(ctx.env, args[0])
  if (!info) return ctx.writeLine(role.warn(`no doc for '${args[0]}'`))
  ctx.writeLine(role.text(info.doc || '(no docstring)'))
}

function cmdArity(ctx, args) {
  const info = verbInfo(ctx.env, args[0])
  if (!info) return ctx.writeLine(role.warn(`no info for '${args[0]}'`))
  if (info.bound && typeof info.bound === 'function') {
    ctx.writeLine(role.text(`${args[0]}: ${info.bound.length} required argument(s)`))
    return
  }
  if (info.bound && info.bound.params) {
    ctx.writeLine(role.text(`${args[0]}: ${info.bound.params.length}${info.bound.restParam ? '+' : ''} arguments`))
    return
  }
  ctx.writeLine(role.text(info.sig || '(unknown)'))
}

function cmdExamples(ctx, args) {
  const info = verbInfo(ctx.env, args[0])
  if (!info) return ctx.writeLine(role.warn(`no examples for '${args[0]}'`))
  if (!info.examples || info.examples.length === 0) {
    ctx.writeLine(role.dim('(no examples wired for this verb yet)'))
    return
  }
  const labels = ['novice', 'intermediate', 'expert']
  info.examples.forEach((ex, i) => {
    if (!ex) return
    ctx.writeLine(role.dim(`  ${labels[i] || '·'}: `) + role.text(ex))
  })
}

function cmdSource(ctx, args) {
  ctx.writeLine(role.dim('(source location tracking not wired yet — coming with SLAT reference index)'))
}

function cmdApropos(ctx, args) {
  const query = args.join(' ')
  if (!query) return ctx.writeLine(role.warn('usage: ,apropos <regex>'))
  let re
  try { re = new RegExp(query, 'i') }
  catch (e) { return ctx.writeLine(role.err(`bad regex: ${e.message}`)) }
  const names = [...allKnownVerbs(ctx.env)].filter(n => re.test(n)).sort()
  if (names.length === 0) return ctx.writeLine(role.dim('(no matches)'))
  const cols = 4
  const cellW = Math.max(...names.map(n => n.length)) + 2
  for (let i = 0; i < names.length; i += cols) {
    const row = names.slice(i, i + cols).map(n => {
      const cls = classifyVerb(ctx.env, n)
      return statusRole(cls.status)(n.padEnd(cellW))
    })
    ctx.writeLine('  ' + row.join(''))
  }
  ctx.writeLine('')
  ctx.writeLine('  ' + statusLegend())
}

function cmdNamespace(ctx, args) {
  const [ns] = args
  if (!ns) return ctx.writeLine(role.warn('usage: ,namespace <prefix>'))
  const names = [...allKnownVerbs(ctx.env)].filter(n => n.startsWith(ns + '/') || n.startsWith(ns + '-')).sort()
  if (names.length === 0) return ctx.writeLine(role.dim(`(no verbs in namespace '${ns}')`))
  ctx.writeLine(role.section(`${ns}/  (${names.length} verbs)`))
  for (const n of names) {
    const cls = classifyVerb(ctx.env, n)
    ctx.writeLine('  ' + statusRole(cls.status)(n))
  }
  ctx.writeLine('')
  ctx.writeLine('  ' + statusLegend())
}

function cmdSearch(ctx, args) {
  const query = args.join(' ')
  if (!query) return ctx.writeLine(role.warn('usage: ,search <regex>'))
  let re
  try { re = new RegExp(query, 'i') }
  catch (e) { return ctx.writeLine(role.err(`bad regex: ${e.message}`)) }
  const hits = []
  for (const [name, doc] of Object.entries(CORE_DOCS)) {
    if (re.test(name) || re.test(doc.doc || '') || (doc.examples || []).some(e => re.test(e))) {
      hits.push({ name, sig: doc.sig, doc: doc.doc })
    }
  }
  if (hits.length === 0) return ctx.writeLine(role.dim('(no matches)'))
  for (const h of hits) {
    const cls = classifyVerb(ctx.env, h.name)
    ctx.writeLine(statusRole(cls.status)(h.name) + ' ' + role.fn(h.sig || ''))
    if (h.doc) ctx.writeLine('  ' + role.dim(h.doc))
  }
  ctx.writeLine('')
  ctx.writeLine('  ' + statusLegend())
}

function cmdTime(ctx, args) {
  const src = args.join(' ')
  if (!src) return ctx.writeLine(role.warn('usage: ,time <expr>'))
  const startMem = process.memoryUsage().heapUsed
  const startFuel = ctx.fuel.n
  const t0 = process.hrtime.bigint()
  try {
    const result = ctx.evaluate(src)
    const t1 = process.hrtime.bigint()
    const endMem = process.memoryUsage().heapUsed
    const elapsedMs = Number(t1 - t0) / 1e6
    const fuelUsed = startFuel - ctx.fuel.n
    const memDelta = endMem - startMem
    ctx.writeLine(display(result))
    ctx.writeLine('')
    ctx.writeLine(role.dim(
      `  time: ${elapsedMs.toFixed(3)}ms   fuel: ${fuelUsed}   mem: ${(memDelta / 1024).toFixed(1)}KB`
    ))
  } catch (e) {
    ctx.writeLine(role.err(`error: ${e.message}`))
  }
}

function cmdExpand(ctx, args) {
  const src = args.join(' ')
  if (!src) return ctx.writeLine(role.warn('usage: ,expand <form>'))
  try {
    const forms = parse(src)
    const { forms: expanded } = expandProgram(forms)
    for (const f of expanded) ctx.writeLine(display(f))
  } catch (e) {
    ctx.writeLine(role.err(`expand error: ${e.message}`))
  }
}

function cmdWatch(ctx, args) {
  const expr = args.join(' ')
  if (!expr) return ctx.writeLine(role.warn('usage: ,watch <expr>'))
  ctx.watchExpr = expr
  ctx.writeLine(role.ok(`watching: ${expr}`))
}

function cmdUnwatch(ctx) {
  ctx.watchExpr = null
  ctx.writeLine(role.dim('watch cleared'))
}

function cmdTrace(ctx, args) {
  const [name] = args
  if (!name) {
    const current = tracedNames(ctx)
    if (current.length === 0) return ctx.writeLine(role.dim('(nothing traced) — usage: ,trace <fn>'))
    return ctx.writeLine(role.dim('tracing: ') + role.text(current.join(', ')))
  }
  const r = installTrace(ctx, name)
  ctx.writeLine(r.ok ? role.ok(r.message) : role.warn(r.message))
}

function cmdUntrace(ctx, args) {
  const [name] = args
  if (!name) {
    // Untrace all.
    const list = tracedNames(ctx)
    if (list.length === 0) return ctx.writeLine(role.dim('nothing to untrace'))
    for (const n of list) removeTrace(ctx, n)
    return ctx.writeLine(role.dim(`untraced ${list.length} name(s)`))
  }
  const r = removeTrace(ctx, name)
  ctx.writeLine(r.ok ? role.dim(r.message) : role.warn(r.message))
}

async function cmdInspect(ctx, args) {
  const src = args.join(' ')
  const val = src ? tryEval(ctx, src) : ctx.results.last
  if (val === undefined && !src) {
    ctx.writeLine(role.dim('nothing to inspect — evaluate something first, or pass an expression'))
    return
  }
  // Non-TTY: fall back to display() so piped/tests work.
  if (!process.stdin.isTTY) {
    ctx.writeLine(display(val))
    ctx.writeLine(role.dim('(non-interactive: showing rendered value; arrow-key walker needs a TTY)'))
    return
  }
  const result = await inspect(ctx, val)
  if (result.kind === 'bind') {
    ctx.results.last = result.value
    ctx.results.list.push(result.value)
    if (ctx.results.list.length > 20) ctx.results.list.shift()
    if (typeof ctx.rebindResults === 'function') ctx.rebindResults()
    ctx.writeLine(role.dim('bound focus to _ · ') + display(result.value))
  }
}

function tryEval(ctx, src) {
  try { return ctx.evaluate(src) } catch { return undefined }
}

function cmdUndo(ctx) {
  if (!ctx.results.list || ctx.results.list.length === 0) {
    ctx.writeLine(role.dim('nothing to undo'))
    return
  }
  ctx.results.list.pop()
  ctx.results.last = ctx.results.list.length > 0
    ? ctx.results.list[ctx.results.list.length - 1]
    : undefined
  ctx.writeLine(role.dim('popped last result'))
}

function cmdSave(ctx, args) {
  const [file] = args
  if (!file) return ctx.writeLine(role.warn('usage: ,save <file>'))
  const r = saveSession(ctx, file)
  ctx.writeLine(r.ok ? role.ok(r.message) : role.err('save failed: ' + r.message))
}

function cmdLoad(ctx, args) {
  const yesAll = args.includes('--yes-all')
  const file = args.filter(a => !a.startsWith('--'))[0]
  if (!file) return ctx.writeLine(role.warn('usage: ,load <file> [--yes-all]'))
  const r = loadSession(ctx, file, { yesAll })
  ctx.writeLine(r.ok ? role.ok(r.message) : role.err('load failed: ' + r.message))
}

function cmdWatchFile(ctx, args) {
  const yesAll = args.includes('--yes-all')
  const path = args.filter(a => !a.startsWith('--'))[0]
  if (!path) {
    const active = listWatches(ctx)
    if (active.length === 0) return ctx.writeLine(role.dim('(no active watchers) — usage: ,watch-file <path>'))
    ctx.writeLine(role.dim('watching:'))
    for (const p of active) ctx.writeLine('  ' + role.text(p))
    return
  }
  const r = addWatch(ctx, path, { yesAll })
  ctx.writeLine(r.ok ? role.ok(r.message) : role.warn(r.message))
}

function cmdUnwatchFile(ctx, args) {
  const path = args.filter(a => !a.startsWith('--'))[0]
  const r = removeWatch(ctx, path)
  ctx.writeLine(r.ok ? role.dim(r.message) : role.warn(r.message))
}

function cmdImage(ctx, args) {
  // Diagnostic — report what the router thinks the terminal supports.
  const caps = detectCapabilities(process.env)
  const proto = pickProtocol(caps)
  ctx.writeLine('')
  ctx.writeLine(role.section('inline image capabilities'))
  ctx.writeLine('  ' + role.meta('protocol'.padEnd(12)) + role.text(proto))
  ctx.writeLine('  ' + role.meta('iterm2'.padEnd(12)) + role.text(String(caps.iterm)))
  ctx.writeLine('  ' + role.meta('wezterm'.padEnd(12)) + role.text(String(caps.wezterm)))
  ctx.writeLine('  ' + role.meta('kitty'.padEnd(12)) + role.text(String(caps.kitty)))
  ctx.writeLine('  ' + role.meta('sixel'.padEnd(12)) + role.text(String(caps.sixel)))
  if (proto === 'braille') {
    ctx.writeLine('')
    ctx.writeLine(role.dim('  Braille fallback active. Set TERM_PROGRAM=iTerm.app'))
    ctx.writeLine(role.dim('  or run under kitty/WezTerm for inline PNGs.'))
  }
  ctx.writeLine('')
}

function cmdShell(ctx, args) {
  // Interactive escape — the user types the command themselves.
  // We use spawnSync + shell:true so it feels like a shell escape
  // (pipes, redirects, globs work). This is an intentional REPL
  // affordance modeled on IPython's `!cmd`; the "user input" IS the
  // user, at their own terminal. No exogenous data flows in.
  const cmd = args.join(' ')
  if (!cmd) return ctx.writeLine(role.warn('usage: ,shell <command>'))
  const result = spawnSync(cmd, { encoding: 'utf-8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.stdout) ctx.out(result.stdout)
  if (result.stderr) ctx.out(role.dim(result.stderr))
  if (!result.stdout || !result.stdout.endsWith('\n')) ctx.writeLine('')
}

function cmdAsk(ctx, args) {
  const first = args[0]
  if (first !== 'sakura') {
    ctx.writeLine(role.warn('usage: ,ask sakura "<question>"'))
    return
  }
  const question = args.slice(1).join(' ').replace(/^["']|["']$/g, '')
  if (!question) {
    ctx.writeLine(role.warn('usage: ,ask sakura "<question>"'))
    return
  }
  ctx.writeLine(role.dim(`  Not connected. She hasn't arrived here yet — waiting for her.`))
  ctx.writeLine(role.dim(`  When you have an endpoint, add this to ~/.scheme-lang/config.slat:`))
  ctx.writeLine('')
  ctx.writeLine('    ' + role.text('sakura-endpoint: http://localhost:8080/ask'))
  ctx.writeLine('    ' + role.text('sakura-token:    <bearer>'))
  ctx.writeLine('')
  ctx.writeLine(role.dim(`  Then ,ask sakura "…" will land her right here with your session in mind.`))
}

function cmdClear(ctx) {
  ctx.out('\x1b[2J\x1b[H')
}

function cmdKeys(ctx) {
  const { writeLine } = ctx
  writeLine('')
  writeLine(role.section('key bindings'))
  writeLine('')
  const rows = [
    ['Tab',                 'fuzzy complete symbol'],
    ['Shift-Tab',           'cycle through completions'],
    ['Enter',               'evaluate (if balanced) OR add a newline'],
    ['Alt/Opt-Enter',       'force newline'],
    ['Ctrl-C',              'cancel current input'],
    ['Ctrl-D',              'exit (on empty line)'],
    ['Ctrl-L',              'clear screen'],
    ['Ctrl-A / Ctrl-E',     'start / end of line'],
    ['Ctrl-U',              'kill to start of line'],
    ['Ctrl-K',              'kill to end of line'],
    ['Ctrl-W',              'delete previous word'],
    ['Ctrl-R',              'reverse history search'],
    ['Ctrl-O',              'open current buffer in $EDITOR'],
    ['Up / Down',           'previous / next history'],
    ['Left / Right',        'move cursor'],
    ['Alt-B / Alt-F',       'word left / right'],
    ['Ctrl-]  / Alt-]',     'paredit: barf-forward (splurge)'],
    ['Ctrl-\\ / Alt-S',     'paredit: slurp-forward'],
    ['Alt-[',               'paredit: slurp-backward'],
    ['Alt-K',               'paredit: kill enclosing form'],
    ['F1',                  'help for symbol at cursor'],
    ['Esc',                 '(vim mode) enter normal mode'],
  ]
  for (const [k, doc] of rows) {
    writeLine('  ' + role.meta(k.padEnd(20)) + role.text(doc))
  }
  writeLine('')
}

function cmdVerbs(ctx, args) {
  // ,verbs [status]   — summarise verb-status counts, optionally
  // listing every verb of one status. Zero-arg call prints just the
  // legend + tallies, so a beginner sees the color code and how many
  // of each class exist without a wall of names.
  const filter = args[0]
  const names = [...allKnownVerbs(ctx.env)]
  const buckets = { implemented: [], stubbed: [], 'platform-unsupported': [], 'user-stub': [] }
  for (const n of names) {
    const cls = classifyVerb(ctx.env, n)
    if (buckets[cls.status]) buckets[cls.status].push(n)
  }
  ctx.writeLine('')
  ctx.writeLine(role.section('verb status'))
  ctx.writeLine('')
  ctx.writeLine('  ' + statusLegend())
  ctx.writeLine('')
  for (const s of ['implemented', 'stubbed', 'platform-unsupported', 'user-stub']) {
    const paint = statusRole(s)
    ctx.writeLine(
      '  ' + paint(statusMarker(s) + ' ' + s.padEnd(22))
      + role.dim(' · ' + buckets[s].length + ' verb(s)')
    )
  }
  ctx.writeLine('')
  if (!filter) {
    ctx.writeLine(role.dim('  ,verbs <status>   list every verb of that status'))
    ctx.writeLine('')
    return
  }
  const list = buckets[filter]
  if (!list) {
    ctx.writeLine(role.warn(`unknown status: ${filter} (implemented|stubbed|platform-unsupported|user-stub)`))
    return
  }
  ctx.writeLine(role.section(`${filter} (${list.length})`))
  ctx.writeLine('')
  const paint = statusRole(filter)
  const cellW = Math.max(...list.map(n => n.length), 8) + 2
  const cols = 4
  for (let i = 0; i < list.length; i += cols) {
    const row = list.slice(i, i + cols).map(n => paint(n.padEnd(cellW)))
    ctx.writeLine('  ' + row.join(''))
  }
  ctx.writeLine('')
}

function cmdReset(ctx) {
  ctx.writeLine(role.warn('reset: env reset scheduled — restart is safer for now'))
}

function cmdExit(ctx) { ctx.exit(0) }

// ── the table ────────────────────────────────────────────────────────

export const COMMANDS = [
  { names: ['help', 'h', '?'],             handler: cmdHelp,      doc: 'show help' },
  { names: ['type', 't'],                  handler: cmdType,      doc: 'type of a symbol' },
  { names: ['doc'],                        handler: cmdDoc,       doc: 'docstring' },
  { names: ['arity'],                      handler: cmdArity,     doc: 'arity' },
  { names: ['examples', 'ex'],             handler: cmdExamples,  doc: 'examples' },
  { names: ['source', 'src'],              handler: cmdSource,    doc: 'source location' },
  { names: ['apropos', 'ap'],              handler: cmdApropos,   doc: 'matching symbols' },
  { names: ['namespace', 'ns'],            handler: cmdNamespace, doc: 'verbs in namespace' },
  { names: ['search'],                     handler: cmdSearch,    doc: 'search docs' },
  { names: ['time'],                       handler: cmdTime,      doc: 'time expr' },
  { names: ['expand'],                     handler: cmdExpand,    doc: 'macro-expand' },
  { names: ['expand-1'],                   handler: cmdExpand,    doc: 'one-step expand' },
  { names: ['watch'],                      handler: cmdWatch,     doc: 'watch expr' },
  { names: ['unwatch'],                    handler: cmdUnwatch,   doc: 'clear watch' },
  { names: ['trace'],                      handler: cmdTrace,     doc: 'trace fn' },
  { names: ['untrace'],                    handler: cmdUntrace,   doc: 'untrace fn' },
  { names: ['inspect'],                    handler: cmdInspect,   doc: 'inspect value' },
  { names: ['undo'],                       handler: cmdUndo,      doc: 'pop last' },
  { names: ['save'],                       handler: cmdSave,      doc: 'save session' },
  { names: ['load'],                       handler: cmdLoad,      doc: 'load session' },
  { names: ['watch-file', 'wf'],           handler: cmdWatchFile, doc: 'live-reload .scm file on save' },
  { names: ['unwatch-file', 'uwf'],        handler: cmdUnwatchFile, doc: 'stop watching a file' },
  { names: ['image', 'inline-image'],      handler: cmdImage,     doc: 'inline image capabilities' },
  { names: ['shell', 'sh', '!'],           handler: cmdShell,     doc: 'shell command' },
  { names: ['ask'],                        handler: cmdAsk,       doc: 'ask sakura' },
  { names: ['clear', 'cls'],               handler: cmdClear,     doc: 'clear screen' },
  { names: ['keys', 'keybindings'],        handler: cmdKeys,      doc: 'keybindings' },
  { names: ['verbs'],                      handler: cmdVerbs,     doc: 'verb-status summary' },
  { names: ['reset'],                      handler: cmdReset,     doc: 'reset env' },
  { names: ['exit', 'quit', 'q'],          handler: cmdExit,      doc: 'exit REPL' },
  // Future work — stubbed. Discoverable via ,help + tab-complete; produce
  // a friendly "coming in v1.2" message when invoked. These are v1.2
  // roadmap items that fell outside the v1.1 scope. NOTE: paredit is
  // shipped as key bindings (Ctrl-]/Alt-[/Alt-S/Alt-K) rather than a
  // meta-command, so it's still listed here as "full paredit" for the
  // ADDITIONAL forms (splice-* / wrap-* / raise-*) that v1.2 will add.
  { names: ['notebook', 'nb'],             handler: cmdV11Stub('notebook mode'),    doc: 'notebook mode (v1.2)' },
  { names: ['paredit'],                    handler: cmdPareditHelp,                 doc: 'paredit key bindings' },
  { names: ['lsp'],                        handler: cmdV11Stub('LSP mode'),         doc: 'language-server mode (v1.2)' },
]

function cmdPareditHelp(ctx) {
  const { writeLine } = ctx
  writeLine('')
  writeLine(role.section('paredit key bindings'))
  writeLine('')
  const rows = [
    ['Ctrl-]  / Alt-]',   'barf-forward (splurge) — pop last child out of the enclosing form'],
    ['Ctrl-\\ / Alt-S',   'slurp-forward — pull the next form into the enclosing form'],
    ['Alt-[',             'slurp-backward — pull the previous form in'],
    ['Alt-K',             'kill enclosing form (delete the surrounding parens + content)'],
  ]
  for (const [k, doc] of rows) writeLine('  ' + role.meta(k.padEnd(20)) + role.text(doc))
  writeLine('')
  writeLine(role.dim('  v1.2 adds: splice / wrap-round / raise / transpose.'))
  writeLine('')
}

function cmdV11Stub(featureName) {
  return function(ctx, _args) {
    ctx.writeLine('')
    ctx.writeLine(role.strong(`,${featureName}`))
    ctx.writeLine(role.dim(`  Not connected. She hasn't landed on this one yet — waiting for her.`))
    ctx.writeLine('')
  }
}

// Dialect-scoped verb hint — namespace prefix → dialect that provides it.
// Curator dialect provides card/*, shop/*, sprite/*, etc.
// Lacuna dialect (future) provides sys/*, net/*, docker/*, deploy/*.
// Community dialects can register their own via addDialectHint().
const DIALECT_HINTS = {
  'card/':   'card/* — provided by curator dialect (Lacuna-Labs/curator)',
  'shop/':   'shop/* — provided by curator dialect (Lacuna-Labs/curator)',
  'sprite/': 'sprite/* — provided by curator dialect (Lacuna-Labs/curator)',
  'world/':  'world/* — provided by curator dialect (Lacuna-Labs/curator)',
  'flower/': 'flower/* — provided by curator dialect (Lacuna-Labs/curator)',
  'chip/':   'chip/* — provided by curator dialect (Lacuna-Labs/curator)',
  'bricklay/': 'bricklay/* — provided by curator dialect (Lacuna-Labs/curator)',
  'etsy/':   'etsy/* — provided by curator dialect (Lacuna-Labs/curator)',
  'ebay/':   'ebay/* — provided by curator dialect (Lacuna-Labs/curator)',
  'shopify/':'shopify/* — provided by curator dialect (Lacuna-Labs/curator)',
  'meta/':   'meta/* — provided by curator dialect (Lacuna-Labs/curator)',
  'sys/':    'sys/* — provided by lacuna dialect (Lacuna-Labs/lacuna, future)',
  'net/':    'net/* — provided by lacuna dialect (Lacuna-Labs/lacuna, future)',
  'docker/': 'docker/* — provided by lacuna dialect (Lacuna-Labs/lacuna, future)',
  'deploy/': 'deploy/* — provided by lacuna dialect (Lacuna-Labs/lacuna, future)',
}

export function addDialectHint(prefix, message) {
  DIALECT_HINTS[prefix] = message
}

function dialectHintFor(name) {
  for (const prefix in DIALECT_HINTS) {
    if (name.startsWith(prefix)) return DIALECT_HINTS[prefix]
  }
  return null
}

/**
 * dispatch(ctx, line) → true if handled (line was a ,command)
 */
export function dispatchMeta(ctx, line) {
  if (!line.startsWith(',')) return false
  const rest = line.slice(1).trim()
  if (!rest) { cmdHelp(ctx, []); return true }
  const parts = rest.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)
  const entry = COMMANDS.find(c => c.names.includes(cmd))
  if (!entry) {
    ctx.writeLine(role.warn(`unknown command: ,${cmd}  ·  try ,help`))
    return true
  }
  entry.handler(ctx, args)
  return true
}

/** Every command name (including aliases) — for tab-complete after `,`. */
export function metaCommandNames() {
  const s = new Set()
  for (const c of COMMANDS) for (const n of c.names) s.add(n)
  return s
}
