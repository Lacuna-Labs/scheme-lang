// auth/store.js — persistent auth-token storage.
//
// Tokens live in TWO places:
//   1. The Cortex (in-memory, per-process) — commercial verbs read
//      from here on every call.
//   2. A JSON file on disk (~/.sakura/auth.json) — survives REPL
//      restarts. Loaded into Cortex at startup.
//
// The file is chmod 600 so the OS keeps prying eyes off it. Nothing
// fancy — no keyring integration yet (that's a follow-on).
//
// Key layout in both stores:
//   auth/<provider>/token   — the access token
//   auth/<provider>/refresh — refresh token (Google gives us one)
//   auth/<provider>/expiry  — unix ms when the access token dies
//   auth/<provider>/user    — { id, email, name } — who's signed in
//
// Kid-readable comment: this is where "who you are" gets remembered
// between REPL sessions. Sign in once; it stays until you sign out.

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { getCortex } from '../ai.js'

const AUTH_DIR  = join(homedir(), '.sakura')
const AUTH_FILE = join(AUTH_DIR, 'auth.json')

function ensureAuthDir() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 })
  }
}

/**
 * loadAuthFromDisk — read the on-disk auth file (if any) and prime the
 * Cortex with its keys. Called at startup.
 */
export function loadAuthFromDisk() {
  if (!existsSync(AUTH_FILE)) return
  let json
  try {
    json = JSON.parse(readFileSync(AUTH_FILE, 'utf-8'))
  } catch {
    // Corrupt file — just skip. A user re-login rewrites it.
    return
  }
  const cortex = getCortex()
  for (const [k, v] of Object.entries(json)) {
    cortex.remember(k, v)
  }
}

/**
 * persistAuthToDisk — write the current auth keys from Cortex to disk.
 * Called after login / logout so the state survives a REPL restart.
 */
export function persistAuthToDisk() {
  ensureAuthDir()
  const cortex = getCortex()
  const snapshot = {}
  // Only persist the auth/* keys, not other Cortex contents.
  const keys = cortex.keys ? cortex.keys() : []
  for (const k of keys) {
    if (typeof k === 'string' && k.startsWith('auth/')) {
      snapshot[k] = cortex.recall(k)
    }
  }
  writeFileSync(AUTH_FILE, JSON.stringify(snapshot, null, 2), { mode: 0o600 })
  // Belt-and-braces: chmod even if writeFileSync ignored the mode.
  try { chmodSync(AUTH_FILE, 0o600) } catch { /* not fatal */ }
}

/**
 * saveAuth — write a fresh set of auth data (post-login) into Cortex +
 * disk.
 *
 *   provider  — 'google' | 'apple' | 'github' | …
 *   token     — access token string
 *   refresh   — refresh token (optional)
 *   expiresIn — seconds until the access token expires
 *   user      — { id, email, name } — optional
 */
export function saveAuth({ provider, token, refresh = null, expiresIn = 3600, user = null }) {
  const cortex = getCortex()
  cortex.remember(`auth/${provider}/token`, token)
  cortex.remember(`auth/${provider}/expiry`, Date.now() + expiresIn * 1000)
  if (refresh) cortex.remember(`auth/${provider}/refresh`, refresh)
  if (user)    cortex.remember(`auth/${provider}/user`, user)
  persistAuthToDisk()
}

/**
 * clearAuth — remove a provider's tokens from Cortex + disk. Used by
 * `sakura logout`.
 */
export function clearAuth(provider) {
  const cortex = getCortex()
  cortex.forget(`auth/${provider}/token`)
  cortex.forget(`auth/${provider}/expiry`)
  cortex.forget(`auth/${provider}/refresh`)
  cortex.forget(`auth/${provider}/user`)
  persistAuthToDisk()
}

/**
 * currentAuth — what's signed in? Returns null if nothing.
 * Otherwise: { provider, user, expiresAt }.
 */
export function currentAuth() {
  const cortex = getCortex()
  const providers = ['google', 'apple', 'github']
  for (const p of providers) {
    const token = cortex.recall(`auth/${p}/token`)
    if (!token) continue
    return {
      provider: p,
      user:     cortex.recall(`auth/${p}/user`) || null,
      expiresAt: cortex.recall(`auth/${p}/expiry`) || null,
    }
  }
  return null
}

/**
 * AUTH_FILE_PATH — exposed so tests + tooling know where to look.
 */
export const AUTH_FILE_PATH = AUTH_FILE
