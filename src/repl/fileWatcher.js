// fileWatcher.js — live-reload of .scm files into the current REPL env.
//
// `,watch-file <path>` — start watching. On any change, re-parse the file,
// look at each `(define …)` form, and either bind it fresh (name isn't
// bound yet) or ASK before overwriting (name already exists), unless
// `--yes-all` was passed.
//
// `,unwatch-file <path>` — stop one watcher. Bare `,unwatch-file` — stop
// them all.
//
// Multiple watches allowed. State is kept on the ctx so `,reset` can
// clean up.
//
// The re-load is debounced (100ms) so a save that triggers two `change`
// events (some editors write twice) doesn't double-fire.

import { watch, existsSync, readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { parse, Sym } from '../reader.js'
import { expandProgram } from '../macro.js'
import { evaluate } from '../interp.js'
import { role } from './nordic.js'
import { schemeFormat } from './richDisplay.js'

/**
 * Start watching `path` and load its defines into ctx.env.
 *
 * Returns { ok, message }.
 */
export function addWatch(ctx, path, opts = {}) {
  const abs = resolve(path)
  if (!existsSync(abs)) {
    return { ok: false, message: `no such file: ${path}` }
  }
  ctx.fileWatchers = ctx.fileWatchers || new Map()
  if (ctx.fileWatchers.has(abs)) {
    return { ok: false, message: `already watching ${path}` }
  }

  // Do a first load right away so the file's current defines land in
  // the env — that's what makes a fresh `,watch-file` immediately useful.
  const loadResult = loadDefines(ctx, abs, { announce: false, yesAll: !!opts.yesAll })

  let debounceTimer = null
  const w = watch(abs, { persistent: false }, (eventType) => {
    if (eventType !== 'change') return
    if (debounceTimer) return
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      // If the file vanished + returned (some editors), skip silently.
      if (!existsSync(abs)) return
      const r = loadDefines(ctx, abs, { announce: true, yesAll: !!opts.yesAll })
      if (r.ok) {
        ctx.writeLine(role.dim(`  ↻ reloaded ${basename(abs)} — ${r.count} define(s)`))
        // If we're between prompts, the LineEditor may re-render its
        // frame on the next keystroke; if we're mid-eval, output is
        // fine as-is. We don't reach into the editor here.
      } else {
        ctx.writeLine(role.err(`  ↻ reload failed: ${r.message}`))
      }
    }, 100)
  })
  ctx.fileWatchers.set(abs, { watcher: w, path: abs, yesAll: !!opts.yesAll })

  return {
    ok: true,
    message: `watching ${abs} — initial load: ${loadResult.ok ? `${loadResult.count} define(s)` : loadResult.message}`,
  }
}

/**
 * Stop watching one file (bare removeWatch(ctx) stops all).
 */
export function removeWatch(ctx, path) {
  if (!ctx.fileWatchers || ctx.fileWatchers.size === 0) {
    return { ok: false, message: 'no active watchers' }
  }
  if (!path) {
    // Stop all.
    let n = 0
    for (const [_, w] of ctx.fileWatchers) {
      try { w.watcher.close() } catch {}
      n++
    }
    ctx.fileWatchers.clear()
    return { ok: true, message: `stopped ${n} watcher(s)` }
  }
  const abs = resolve(path)
  const w = ctx.fileWatchers.get(abs)
  if (!w) return { ok: false, message: `not watching ${path}` }
  try { w.watcher.close() } catch {}
  ctx.fileWatchers.delete(abs)
  return { ok: true, message: `unwatched ${abs}` }
}

/**
 * List currently-watched files (for introspection / tests).
 */
export function listWatches(ctx) {
  return ctx.fileWatchers ? [...ctx.fileWatchers.keys()] : []
}

/**
 * Parse the file + apply every top-level `(define …)` to ctx.env. Any
 * other forms are also evaluated (so a `.scm` file can seed data too).
 *
 * If a name is already bound and `yesAll` isn't set, we prompt via
 * ctx.confirm (an injected callback returning boolean) — or, if no
 * confirmation channel is available, we skip the redefinition and warn.
 *
 * Returns { ok, count, message? }.
 */
export function loadDefines(ctx, path, { announce = false, yesAll = false } = {}) {
  let src
  try { src = readFileSync(path, 'utf-8') } catch (e) {
    return { ok: false, count: 0, message: e.message }
  }
  let forms
  try { forms = parse(src) } catch (e) {
    return { ok: false, count: 0, message: `parse error: ${e.message}` }
  }
  let expanded
  try { expanded = expandProgram(forms).forms } catch (e) {
    return { ok: false, count: 0, message: `expand error: ${e.message}` }
  }

  let n = 0
  for (const f of expanded) {
    if (Array.isArray(f) && f[0] instanceof Sym &&
        (f[0].name === 'define' || f[0].name === 'define-syntax')) {
      // Find the name.
      const name = Array.isArray(f[1]) ? f[1][0].name : (f[1] && f[1].name)
      if (!name) continue
      const alreadyBound = envHas(ctx.env, name)
      if (alreadyBound && !yesAll) {
        // Confirm unless yesAll. Without an interactive channel, skip.
        if (!ctx.confirm || !ctx.confirm(`overwrite ${name}? (--yes-all to skip)`)) {
          if (announce) ctx.writeLine(role.warn(`  ↻ skipped ${name} (already bound; pass --yes-all to overwrite)`))
          continue
        }
      }
      try {
        evaluate(f, ctx.env, ctx.fuel)
        n++
      } catch (e) {
        if (announce) ctx.writeLine(role.err(`  ↻ ${name}: ${e.message}`))
      }
    } else {
      try { evaluate(f, ctx.env, ctx.fuel) } catch { /* non-fatal */ }
    }
  }
  return { ok: true, count: n }
}

function envHas(env, name) {
  let e = env
  while (e) {
    if (e.vars && e.vars.has && e.vars.has(name)) return true
    e = e.parent
  }
  return false
}
