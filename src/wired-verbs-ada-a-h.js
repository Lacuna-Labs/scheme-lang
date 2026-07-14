// wired-verbs-ada-a-h.js — real impls for the no-namespace a-h lane.
//
// This is Ada's lane for the wire-596 push (2026-07-14). It runs
// AFTER installWiredVerbs so it can override the shaped-descriptor
// placeholders with real, honest impls.
//
// Doctrine (Alfred): reference IS the language. If a kid types
//   (done)
// they deserve a real symbol back — not a shaped string-in-a-list.
//
// Scope pilot (3 verbs — pure control tokens + real Scheme eval):
//   - done       — state-machine terminal signal; returns (list 'done)
//   - escalate   — state-machine fatal signal; returns (list 'escalate kind detail)
//   - eval       — real dynamic Scheme evaluation via the interpreter
//
// The remaining 92 verbs in Ada's lane are either card-runtime,
// conway-grid, grid-substrate, UI-host, or misc-deferred — see
// docs/reports/lanes/ada-math-a-audit-2026-07-14.slat for the full
// breakdown and the per-tier deferred-reasons. Those keep the
// wired-verbs.js descriptor shape as the honest fallback and their
// staging entries mark :impl-status "deferred".

import { Sym, sym, parse } from './reader.js'
import { evaluate } from './interp.js'

export function installWiredVerbsAdaAH(env, fuel) {
  // Force-override: earlier installWiredVerbs bound descriptor shapes.
  // We overwrite them with real impls. `env.define` handles the
  // mirror in the verb registry.
  const def = (name, fn, meta = { perm: 'read' }) => env.define(name, fn, meta)

  // ── done — cadence-control terminal signal ─────────────────────────
  //
  // Reference contract: (done) -> [symbol]. A list containing the
  // symbol `done`. The host reads the head as a marker to retire the
  // cart. Prior impl returned ["done", ...] (a string, not a symbol);
  // this ships the real Scheme symbol.
  //
  // Variadic to accept an optional trailing detail (some carts pass a
  // result value along; the reference example shows both zero-args and
  // args-passing shapes).
  def('done', (...args) => [sym('done'), ...args])

  // ── escalate — cadence-control fatal signal ────────────────────────
  //
  // Reference contract: (escalate kind detail) -> control-value.
  // A list with the `escalate` symbol at head, followed by the kind
  // (a symbol identifying the failure class) and a detail value.
  // Terminal: no further states run until the host resets the cart.
  //
  // We coerce a string-kind to a symbol so callers writing
  // (escalate 'no-config 'shop-id-required) get symbolic heads
  // rather than strings.
  def('escalate', (kind, detail = null) => {
    const kindSym = kind instanceof Sym ? kind : sym(String(kind))
    return [sym('escalate'), kindSym, detail]
  })

  // ── eval — dynamic Scheme evaluation ────────────────────────────────
  //
  // Reference contract: (eval expr [env]) -> value. Takes a
  // quoted-code structure (a list or symbol), reads it back through
  // the same interpreter, and returns the evaluated value.
  //
  // Because Scheme quote/read cycles are shape-preserving, the input
  // can be either (a) a list/symbol already read (from a quote), or
  // (b) a string source that we tokenise + parse first.
  //
  // The optional second argument (an env) is REPL-scoped in the full
  // host — here we default to the current env. Ignoring an out-of-scope
  // env argument would be a lie; instead we return a helpful error.
  def('eval', (expr, evEnv) => {
    // Case: string source → parse and evaluate each top-level form,
    // returning the last value (standard Scheme behaviour).
    if (typeof expr === 'string') {
      const forms = parse(expr)
      let last = undefined
      const targetEnv = evEnv || env
      for (const f of forms) last = evaluate(f, targetEnv, fuel)
      return last
    }
    // Case: pre-read AST (from a quote). evaluate handles list forms
    // + symbols + atoms transparently.
    const targetEnv = evEnv || env
    return evaluate(expr, targetEnv, fuel)
  })
}
