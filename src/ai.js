// ai.js — Layer 2 (L2): Cortex + LLM primitives (INTERFACE ONLY).
//
// The interface Sakura Scheme scripts use to talk to the AI world:
//   · (cortex/remember key value) — write a fact into long-term memory
//   · (cortex/recall key)          — read a fact back out
//   · (cortex/query pattern)       — search memory by pattern
//   · (llm/complete prompt)        — ask an LLM to complete a prompt
//   · (llm/embed text)             — get an embedding vector for text
//
// STUB IMPLEMENTATION (standalone REPL):
//   · Cortex is an in-memory dictionary. Persists for the life of the
//     REPL process; goes away on exit. Real Cortex arrives when the
//     Sakura runtime plugs itself in via setAiProvider().
//   · LLM primitives ERROR with a clean message: "no LLM connected —
//     configure :ai-provider in scheme-lang.config.slat." This is
//     honest — we don't pretend to be an LLM when we're not.
//
// The provider seam:
//   Consumers (Sakura runtime, Curator, Lacuna Engineering) call
//   setAiProvider({ cortex: {...}, llm: {...} }) to swap in real impls.
//   Same shape as adapters.js — one record, functions resolve at call
//   time so setAiProvider() takes effect for callers who imported early.
//
// Kid-readable comment: this is the "remember + think" part of the
// language. Save something now, ask about it later. Or ask a big model
// a hard question.

import { Sym } from './reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── the default in-memory Cortex ──────────────────────────────────────
//
// A plain Map. Keyed by string; values can be anything Scheme can hold.
// Good enough for standalone testing; the real Cortex has persistence,
// provenance, similarity search, temporal decay, etc.
function makeInMemoryCortex() {
  const store = new Map()
  return {
    remember(key, value) {
      store.set(String(key), value)
      return true
    },
    recall(key) {
      const k = String(key)
      return store.has(k) ? store.get(k) : undefined
    },
    query(pattern) {
      // Very simple: pattern is either
      //   · a string  — substring match against keys
      //   · a list ('key foo) — exact key lookup (same as recall)
      // Real Cortex uses embeddings + similarity; the stub keeps it
      // honest by only doing what its name says.
      if (typeof pattern === 'string') {
        const hits = []
        for (const [k, v] of store) {
          if (k.includes(pattern)) hits.push([k, v])
        }
        return hits
      }
      if (Array.isArray(pattern) && pattern.length === 2) {
        const key = String(nm(pattern[1]))
        return store.has(key) ? [[key, store.get(key)]] : []
      }
      return []
    },
    forget(key) {
      return store.delete(String(key))
    },
    keys() {
      return Array.from(store.keys())
    },
    size() {
      return store.size
    },
    // Reset for tests. Not exposed to Scheme.
    __reset() {
      store.clear()
    },
  }
}

// ── the default (missing) LLM ─────────────────────────────────────────
//
// Standalone mode has no LLM. Every call errors with the same clean
// message so users know exactly what to do: configure a provider.
function makeMissingLlm() {
  const missing = (verb) => () => {
    throw new Error(
      `(${verb} …) needs an LLM provider. ` +
      `Set :ai-provider in scheme-lang.config.slat, ` +
      `or call setAiProvider({ llm: … }) at startup.`
    )
  }
  return {
    complete: missing('llm/complete'),
    embed:    missing('llm/embed'),
    chat:     missing('llm/chat'),
    tokens:   missing('llm/tokens'),
  }
}

// ── provider state + swap-in ──────────────────────────────────────────

const state = {
  cortex: makeInMemoryCortex(),
  llm:    makeMissingLlm(),
}

/**
 * setAiProvider — swap in real Cortex + LLM implementations. Consumers
 * (Sakura runtime, Curator) call this once at startup; every subsequent
 * (cortex/remember …) or (llm/complete …) reaches the real backend.
 *
 * Partial overrides are OK — pass just `{ cortex: … }` and llm stays
 * missing (so paid verbs still error cleanly).
 */
export function setAiProvider(providers) {
  if (!providers) return
  if (providers.cortex) state.cortex = providers.cortex
  if (providers.llm)    state.llm    = providers.llm
}

/**
 * getCortex — used by other layers that need to persist data (auth
 * tokens live in the Cortex — see auth/store.js).
 */
export function getCortex() {
  return state.cortex
}

/**
 * getLlm — used by higher-level verbs that want to route through the
 * configured LLM.
 */
export function getLlm() {
  return state.llm
}

/**
 * __resetAiProvider — test-only seam. Reinstalls the default in-memory
 * Cortex + the missing-LLM stub.
 */
export function __resetAiProvider() {
  state.cortex = makeInMemoryCortex()
  state.llm    = makeMissingLlm()
}

// ── install AI verbs into a Scheme env ────────────────────────────────

export function installAi(env) {
  // Most Cortex verbs are personal-data (they touch operator memory).
  // LLM verbs are network (they hit an external service).
  const def = (n, f, perm) => env.define(n, f, { perm })

  // ── Cortex ─────────────────────────────────────────────────────────

  // (cortex/remember key value) — save a fact. Key is coerced to string;
  // value can be any Scheme value.
  def('cortex/remember', (key, value) => {
    return state.cortex.remember(String(nm(key)), value)
  }, 'personal-data')

  // (cortex/recall key) — read a fact. Returns nil when nothing's stored.
  def('cortex/recall', (key) => {
    return state.cortex.recall(String(nm(key)))
  }, 'personal-data')

  // (cortex/query pattern) — search memory. Returns a list of matches.
  def('cortex/query', (pattern) => {
    // Handle Sym at the top so scripts can (cortex/query 'foo).
    const p = pattern instanceof Sym ? pattern.name : pattern
    return state.cortex.query(p)
  }, 'personal-data')

  // (cortex/forget key) — drop a fact.
  def('cortex/forget', (key) => {
    return state.cortex.forget(String(nm(key)))
  }, 'personal-data')

  // (cortex/keys) — list all remembered keys.
  def('cortex/keys', () => {
    return state.cortex.keys ? state.cortex.keys() : []
  }, 'personal-data')

  // (cortex/size) — how many facts are stored.
  def('cortex/size', () => {
    return state.cortex.size ? state.cortex.size() : 0
  }, 'personal-data')

  // ── LLM ────────────────────────────────────────────────────────────

  // (llm/complete prompt [options]) — ask the configured LLM to complete
  // a prompt. Options is an optional dict (currently a plain list for
  // Scheme-shape reasons); the real provider decides how to use them.
  def('llm/complete', (prompt, options) => {
    return state.llm.complete(String(prompt), options)
  }, 'network')

  // (llm/embed text) — get an embedding vector for text.
  def('llm/embed', (text) => {
    return state.llm.embed(String(text))
  }, 'network')

  // (llm/chat messages [options]) — chat-shaped completion. Messages is
  // a list of (role content) pairs.
  def('llm/chat', (messages, options) => {
    return state.llm.chat(messages, options)
  }, 'network')

  // (llm/tokens text) — count tokens in a piece of text.
  def('llm/tokens', (text) => {
    return state.llm.tokens(String(text))
  }, 'network')

  return env
}

export default installAi
