// scheme-lang / src / adapters.js
// -----------------------------------------------------------------------------
// Adapter interfaces for dialect-provided host services.
//
// The BASE dialect ships no-op stubs so `./bin/scheme-lang` works standalone
// out of the box — arithmetic, forms, macros, REPL, all fly.
//
// A DIALECT LAYER (e.g. curator-scheme-lang) can override any of these by
// calling `setAdapters({ … })` before the first dispatch. The runtime keeps
// the overrides in a single record; imports below are stable exports that
// resolve current values at call time.
//
// Rationale (Alfred 2026-07-12): the language must NOT reach into any
// particular product's runtime. Adapters get injected by whoever's using it.
// -----------------------------------------------------------------------------

const noop = () => {}
const noopReturning = (v) => () => v

// Default adapter set — all no-ops, safe defaults.
// Curator's dialect layer overrides these via setAdapters().
const state = {
  // Log bus — best-effort event emission.
  emit: noop,

  // Card API — who's the current caller?
  _setCurrentCaller: noop,
  _getCurrentCaller: noopReturning(null),

  // Canvas power tier — which permissions does the current context have?
  canvasPowerGetTier: noopReturning('operator'),

  // Chip sink — where user-facing side chips get written.
  chipWrite: noop,
  chipEvent: noop,

  // Legal-floor event log — per-verb evidence layer.
  logEvent: noop,

  // Correlation context — request/session ids.
  currentCorrelationId: noopReturning(null),
  withCorrelation: (id, fn) => fn(),
  mintCorrelationId: () => 'corr-' + Math.random().toString(36).slice(2, 10),

  // Chat chip bus — publish reasoning events to the chat UI.
  chatChipPublish: noop,

  // Bricklay layout cache (used by graphics verbs in Curator).
  bricklayCacheKey: () => '',
  bricklayCacheGet: noopReturning(null),
  bricklayCacheSet: noop,
}

export function setAdapters(overrides) {
  for (const k in overrides) {
    if (typeof overrides[k] === 'function') state[k] = overrides[k]
  }
}

export function getAdapters() {
  return { ...state }
}

// Named exports — resolve current values at call time so setAdapters()
// takes effect for callers who imported before the override happened.
export const emit                  = (...a) => state.emit(...a)
export const _setCurrentCaller     = (...a) => state._setCurrentCaller(...a)
export const _getCurrentCaller     = (...a) => state._getCurrentCaller(...a)
export const canvasPowerGetTier    = (...a) => state.canvasPowerGetTier(...a)
export const chipWrite             = (...a) => state.chipWrite(...a)
export const chipEvent             = (...a) => state.chipEvent(...a)
export const logEvent              = (...a) => state.logEvent(...a)
export const currentCorrelationId  = (...a) => state.currentCorrelationId(...a)
export const withCorrelation       = (...a) => state.withCorrelation(...a)
export const mintCorrelationId     = (...a) => state.mintCorrelationId(...a)
export const chatChipPublish       = (...a) => state.chatChipPublish(...a)
export const bricklayCacheKey      = (...a) => state.bricklayCacheKey(...a)
export const bricklayCacheGet      = (...a) => state.bricklayCacheGet(...a)
export const bricklayCacheSet      = (...a) => state.bricklayCacheSet(...a)
