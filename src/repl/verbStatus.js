// verbStatus.js — classify + color a verb by its implementation state.
//
// LANG-SPEC 2026-07-13 (Alfred): "Things that are unimplemented but in
// the docs should be noted by color and such verbs you can't use because
// platform support. But verbs that you make can be 'un implemented' so
// you can make stubs."
//
// Five statuses, five colors:
//
//   implemented           green    — real body, works as documented
//   stubbed               yellow   — SLAT reference registered, no impl
//   platform-unsupported  orange   — impl exists, this platform lacks a dep
//   user-stub             blue     — (define-stub …) placeholder
//   missing               red      — not registered anywhere (typo?)
//
// The classifier is a pure function of (name, env, registry). No
// caching in this module — the REPL's palette / IDE calls it on the
// fly for help / apropos / tab-complete. The registry lookup is a
// single Map.get; the env chain walk is at most a handful of hops.

import { getVerbMeta } from '../registry.js'
import { statusRole } from './palette.js'
import { Sym } from '../reader.js'

/**
 * classifyVerb(env, name) → { name, status, meta?, bound?, source }
 *
 * status is one of:
 *   'implemented' | 'stubbed' | 'platform-unsupported' | 'user-stub' | 'missing'
 *
 * source is the winner among:
 *   'env-fn'         — bound as a JS function
 *   'env-closure'    — bound as a Scheme lambda
 *   'env-value'      — bound as a data value
 *   'registry'       — registry meta only (e.g. name reserved, not bound)
 *   'nowhere'        — unknown
 *
 * The registry's status field is authoritative when set. The env lookup
 * confirms actual bind-ness; a stub can look bound (it IS a function
 * that throws) but its status is 'stubbed'. This is the whole point of
 * the axis — reachability of a name is not the same as usability.
 */
export function classifyVerb(env, name) {
  if (!name || typeof name !== 'string') {
    return { name, status: 'missing', source: 'nowhere' }
  }
  const meta = getVerbMeta(name)
  const bound = envLookupSafe(env, name)

  // Unknown to both — genuinely missing.
  if (!meta && bound === undefined) {
    return { name, status: 'missing', source: 'nowhere' }
  }

  // Determine env source label.
  let source = 'nowhere'
  if (typeof bound === 'function') source = 'env-fn'
  else if (bound && bound.constructor && bound.constructor.name === 'Closure') source = 'env-closure'
  else if (bound !== undefined && bound !== null) source = 'env-value'
  else if (meta) source = 'registry'

  const status = (meta && meta.status) || 'implemented'
  return { name, status, meta: meta || null, bound, source }
}

/**
 * colorizeVerb(env, name) → ANSI-colored name string.
 *
 * The primary consumer: `,help`, `,apropos`, `,search`, tab-complete,
 * and error suggestions. A single call site — classify once, colorize
 * once — so the palette stays consistent everywhere.
 */
export function colorizeVerb(env, name) {
  const c = classifyVerb(env, name)
  return statusRole(c.status)(name)
}

/**
 * statusMarker(status) → single-character marker for compact displays
 * (e.g. tab-complete rows or an eight-column apropos grid).
 *
 *   ●  implemented
 *   ○  stubbed
 *   ◐  platform-unsupported
 *   ◇  user-stub
 *   ×  missing
 */
export function statusMarker(status) {
  switch (status) {
    case 'implemented':          return '●'
    case 'stubbed':              return '○'
    case 'platform-unsupported': return '◐'
    case 'user-stub':            return '◇'
    case 'missing':              return '×'
    default:                     return ' '
  }
}

/**
 * Walk the env chain safely. Returns undefined on unbound.
 */
function envLookupSafe(env, name) {
  if (!env) return undefined
  try {
    if (typeof env.lookup === 'function') return env.lookup(new Sym(name))
  } catch { /* fallthrough to manual walk */ }
  let e = env
  while (e) {
    if (e.vars && typeof e.vars.has === 'function' && e.vars.has(name)) {
      return e.vars.get(name)
    }
    e = e.parent
  }
  return undefined
}

/**
 * defineStubVerb(env, name, message?, options?)
 *
 * Public entry the REPL exposes as `(define-stub 'name "message")`.
 * Registers a name with a throwing body + status 'user-stub'. Message
 * shows in `,help name` and in the error the throw surfaces.
 *
 * Idempotent — calling twice replaces the previous stub message.
 */
export function defineStubVerb(env, name, message, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('define-stub: name must be a non-empty string')
  }
  const msg = typeof message === 'string' && message.length > 0
    ? message
    : `\`${name}\` is a user-defined stub — not yet implemented.`
  const stub = function userStub(...args) {
    throw new Error(
      `Verb \`${name}\` is a user-defined stub.\n  ${msg}\n  ` +
      `Called with ${args.length} argument(s). Define the real impl with (define ${name} …).`,
    )
  }
  stub._sakuraUserStub = true
  stub._sakuraStubMessage = msg
  env.define(name, stub, {
    perm: options.perm || 'read',
    status: 'user-stub',
    stubMessage: msg,
  })
  return name
}
