// session-restore.js — save + restore IDE session across launches.
//
// Persists a small JSON blob to ~/.sakura/ide-session.json holding:
//   · lastFile        the file that was open at exit
//   · cursor          { line, col }
//   · scrollTop       viewport top row
//   · mode            'vim' | 'emacs'
//   · theme           theme name
//   · replHistory     the REPL command history (capped at 200)
//   · lineNumbers     boolean toggle state
//   · fontSize        integer 8..40
//   · savedAt         ISO timestamp
//
// Non-fatal on any read/write failure — the IDE still runs, just with
// factory defaults.
//
// Format is JSON, not SLAT, because this is a machine file that gets
// overwritten every session — not authored content.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SESSION_DIR = join(homedir(), '.sakura')
const SESSION_FILE = join(SESSION_DIR, 'ide-session.json')

/**
 * Read the last session, or null if none / unreadable.
 */
export function loadSession() {
  try {
    if (!existsSync(SESSION_FILE)) return null
    const raw = readFileSync(SESSION_FILE, 'utf-8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') return obj
  } catch { /* ignore */ }
  return null
}

/**
 * Write the current session snapshot. Silently no-ops on failure so a
 * disk-full or permission-denied doesn't crash the IDE at exit.
 */
export function saveSession({ filePath, cursor, scrollTop, mode, theme, replHistory, lineNumbers, fontSize } = {}) {
  try {
    if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true })
    const snap = {
      lastFile:     filePath || null,
      cursor:       cursor || { line: 0, col: 0 },
      scrollTop:    scrollTop || 0,
      mode:         mode || 'vim',
      theme:        theme || 'sakura-dark',
      replHistory:  (replHistory || []).slice(-200),
      lineNumbers:  lineNumbers === false ? false : true,
      fontSize:     fontSize || 14,
      savedAt:      new Date().toISOString(),
    }
    writeFileSync(SESSION_FILE, JSON.stringify(snap, null, 2), 'utf-8')
    return true
  } catch { return false }
}

/**
 * Test seam — the path.
 */
export function sessionFilePath() { return SESSION_FILE }
