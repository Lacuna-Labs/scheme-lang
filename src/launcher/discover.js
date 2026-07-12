// discover.js — find installed Scheme dialects on this machine.
//
// A dialect is a directory containing:
//   • `dialect.json` — { name, version, entrypoint, tagline?, palette? }
//   • the entrypoint file is a binary or script that runs a REPL when
//     invoked with no args, and `eval "..."` for one-shot eval.
//
// Search order (later entries override earlier ones on name collision):
//   1. current directory (`./dialect.json` or `./scheme-lang/dialect.json`)
//   2. $XDG_DATA_HOME/scheme-lang/dialects/*/dialect.json
//   3. ~/.scheme-lang/dialects/*/dialect.json
//   4. /usr/local/share/scheme-lang/dialects/*/dialect.json
//   5. the directory the launcher was invoked from (via SCHEME_LANG_HOME env)
//   6. the launcher's own repo — always includes the bundled Sakura
//      dialect when the launcher lives next to a sakura-scheme binary
//
// Duplicate names → later wins so a user override in ~/.scheme-lang
// beats the system install.

import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * discoverDialects({ launcherPath, cwd })
 * → Array<Dialect>
 *
 * Dialect = { name, version, entrypoint, tagline?, palette?, source }
 * `source` is the absolute path of dialect.json (useful for debug).
 */
export function discoverDialects({ launcherPath, cwd = process.cwd() } = {}) {
  const dialects = new Map()

  const addFrom = (dir) => {
    // Direct dialect.json in dir.
    const direct = join(dir, 'dialect.json')
    if (safeIsFile(direct)) {
      const d = readDialect(direct)
      if (d) dialects.set(d.name, d)
    }
    // Or a `dialects/*/dialect.json` sub-shape.
    const dialectsDir = join(dir, 'dialects')
    if (safeIsDir(dialectsDir)) {
      for (const child of safeReaddir(dialectsDir)) {
        const p = join(dialectsDir, child, 'dialect.json')
        if (safeIsFile(p)) {
          const d = readDialect(p)
          if (d) dialects.set(d.name, d)
        }
      }
    }
    // Or a plain scheme-lang/dialect.json subfolder.
    const sl = join(dir, 'scheme-lang', 'dialect.json')
    if (safeIsFile(sl)) {
      const d = readDialect(sl)
      if (d) dialects.set(d.name, d)
    }
  }

  // 1. cwd
  addFrom(cwd)

  // 2. XDG data
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) addFrom(join(xdg, 'scheme-lang'))

  // 3. ~/.scheme-lang/dialects/*
  addFrom(join(homedir(), '.scheme-lang'))

  // 4. /usr/local/share/scheme-lang
  addFrom('/usr/local/share/scheme-lang')

  // 5. SCHEME_LANG_HOME override
  if (process.env.SCHEME_LANG_HOME) addFrom(process.env.SCHEME_LANG_HOME)

  // 6. The launcher's own repo — walk up from launcherPath looking for
  //    scheme-lang/dialect.json. This catches the "installed alongside
  //    the launcher" case.
  if (launcherPath) {
    let d = dirname(launcherPath)
    for (let i = 0; i < 4 && d && d !== '/'; i++) {
      const p = join(d, 'dialect.json')
      if (safeIsFile(p)) {
        const dl = readDialect(p)
        if (dl && !dialects.has(dl.name)) dialects.set(dl.name, dl)
      }
      d = dirname(d)
    }
  }

  return [...dialects.values()].sort((a, b) => {
    // 'sakura' first (it's the core), then alphabetical.
    if (a.name === 'sakura') return -1
    if (b.name === 'sakura') return 1
    return a.name < b.name ? -1 : 1
  })
}

function readDialect(path) {
  try {
    const text = readFileSync(path, 'utf-8')
    const d = JSON.parse(text)
    if (!d.name || !d.entrypoint) return null
    // Resolve entrypoint relative to dialect.json's dir.
    const dir = dirname(path)
    const ep = resolve(dir, d.entrypoint)
    if (!existsSync(ep)) return null
    return {
      name: d.name,
      version: d.version || '0',
      entrypoint: ep,
      tagline: d.tagline || '',
      palette: d.palette || null,
      isCore: d.core === true || d.name === 'sakura',
      source: path,
    }
  } catch { return null }
}

function safeIsFile(p) { try { return statSync(p).isFile() } catch { return false } }
function safeIsDir(p)  { try { return statSync(p).isDirectory() } catch { return false } }
function safeReaddir(p) { try { return readdirSync(p) } catch { return [] } }
