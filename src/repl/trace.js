// trace.js — per-call trace rendering for the REPL's ,trace command.
//
// A traced binding is REPLACED in the environment with a wrapper closure
// (for user-defined procedures) or wrapper function (for primitives) that
// prints an entry line before applying and an exit line after. Nesting
// indents by the current call depth; multiple traces multiplex cleanly
// because the depth counter is process-scoped, not per-trace.
//
// The originals live in a per-context map (`ctx.traceOriginals`) so
// `,untrace <name>` can put them back exactly as they were.
//
// The render is deliberately quiet — no color spam, one arrow in, one
// arrow out, single-line values. If a value is a graphic or a huge list
// we abbreviate.

import { Closure } from '../interp.js'
import { role } from './nordic.js'
import { schemeFormat } from './richDisplay.js'

// Process-scoped state so nested + concurrent traces indent together.
const state = {
  depth: 0,
  writer: null,       // (line) => void — where trace output goes
}

/** Set/reset the writer trace lines go through. Called by installTrace. */
export function setTraceWriter(writer) {
  state.writer = writer
}

function emit(s) {
  if (state.writer) state.writer(s)
  else process.stdout.write(s + '\n')
}

function pad() { return '  '.repeat(state.depth) }

/**
 * Compact one-line rendering of a value for trace output. Graphics + huge
 * lists are abbreviated so a trace doesn't dump 20 rows of Braille.
 */
function brief(v) {
  if (v === undefined) return '()'
  if (v === null) return '()'
  if (typeof v === 'number' || typeof v === 'boolean') return schemeFormat(v)
  if (typeof v === 'string') {
    const s = schemeFormat(v)
    return s.length > 60 ? s.slice(0, 57) + '…"' : s
  }
  if (Array.isArray(v)) {
    if (v.length > 8) return `(… ${v.length} items)`
    return schemeFormat(v)
  }
  if (typeof v === 'function') return '#<procedure>'
  if (v && typeof v === 'object' && v.kind === 'graphic') return '#<graphic>'
  return schemeFormat(v)
}

/**
 * Look up a name in the env chain and return the env-level containing it,
 * plus the current value. Returns `null` if the name is unbound.
 */
function findBinding(env, name) {
  let e = env
  while (e) {
    if (e.vars && e.vars.has && e.vars.has(name)) return { env: e, val: e.vars.get(name) }
    e = e.parent
  }
  return null
}

/**
 * installTrace(ctx, name) — wrap the current binding so calls are logged.
 *
 * Returns { ok, message } to feed the REPL output.
 */
export function installTrace(ctx, name) {
  ctx.traceOriginals = ctx.traceOriginals || new Map()
  if (ctx.traceOriginals.has(name)) {
    return { ok: false, message: `already tracing ${name}` }
  }
  const binding = findBinding(ctx.env, name)
  if (!binding) {
    return { ok: false, message: `unbound: ${name}` }
  }
  const original = binding.val

  // Wire the writer once per install — cheap, idempotent.
  setTraceWriter((line) => ctx.writeLine(line))

  if (typeof original === 'function') {
    // Primitive. Wrap with a JS function of the same shape.
    const wrapped = function tracedPrim(...args) {
      const argStr = args.map(brief).join(' ')
      emit(role.dim(pad() + `→ ${name}` + (argStr ? ' ' + argStr : '')))
      state.depth++
      try {
        const result = original(...args)
        state.depth--
        emit(role.dim(pad() + `← ${name} = `) + role.text(brief(result)))
        return result
      } catch (e) {
        state.depth--
        emit(role.dim(pad() + `← ${name} `) + role.err(`threw: ${e.message}`))
        throw e
      }
    }
    // Re-write directly on the owning env's Map so we bypass the perm-warn
    // that .define() emits (the wrapped value is still a function, so the
    // registry would re-log). Semantics: same function slot, wrapped.
    binding.env.vars.set(name, wrapped)
    ctx.traceOriginals.set(name, { env: binding.env, original, kind: 'fn' })
    return { ok: true, message: `tracing ${name}` }
  }

  if (original instanceof Closure) {
    // Closure. Wrap by producing a NEW closure whose body evaluates the
    // ORIGINAL closure via a primitive that logs before + after.
    //
    // Cleaner: keep the closure shape, but the interpreter always calls
    // applyStep on a Closure. To intercept, we install a JS-function
    // shim that adapts the call. Callers use `(f 1 2)` — the interpreter
    // does applyStep(shim, [1,2], fuel) which resolves as function.
    // This is safe because Scheme call sites don't distinguish JS
    // functions vs Closures except in `procedure?`, which returns #t for
    // both.
    const wrapped = function tracedClos(...args) {
      const argStr = args.map(brief).join(' ')
      emit(role.dim(pad() + `→ ${name}` + (argStr ? ' ' + argStr : '')))
      state.depth++
      try {
        // Re-enter the trampoline on the original closure.
        // We need to import apply — but that creates a cycle. Rather than
        // that, we call the interpreter through a callback injected by
        // the ctx (which was set up in repl.js).
        const result = ctx.applyFn ? ctx.applyFn(original, args) : (() => {
          throw new Error('trace: no applyFn wired into ctx')
        })()
        state.depth--
        emit(role.dim(pad() + `← ${name} = `) + role.text(brief(result)))
        return result
      } catch (e) {
        state.depth--
        emit(role.dim(pad() + `← ${name} `) + role.err(`threw: ${e.message}`))
        throw e
      }
    }
    binding.env.vars.set(name, wrapped)
    ctx.traceOriginals.set(name, { env: binding.env, original, kind: 'closure' })
    return { ok: true, message: `tracing ${name}` }
  }

  return { ok: false, message: `${name} is not a procedure` }
}

/** Restore the original binding for one traced name. */
export function removeTrace(ctx, name) {
  if (!ctx.traceOriginals || !ctx.traceOriginals.has(name)) {
    return { ok: false, message: `not tracing ${name}` }
  }
  const { env, original } = ctx.traceOriginals.get(name)
  env.vars.set(name, original)
  ctx.traceOriginals.delete(name)
  return { ok: true, message: `untraced ${name}` }
}

/** Remove every active trace (used on ,reset or session end). */
export function removeAllTraces(ctx) {
  if (!ctx.traceOriginals) return 0
  let n = 0
  for (const name of [...ctx.traceOriginals.keys()]) {
    const r = removeTrace(ctx, name)
    if (r.ok) n++
  }
  return n
}

/** Introspection — list currently-traced names. */
export function tracedNames(ctx) {
  return ctx.traceOriginals ? [...ctx.traceOriginals.keys()] : []
}
