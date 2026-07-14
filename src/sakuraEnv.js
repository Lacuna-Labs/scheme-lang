// sakuraEnv.js — the "everything" env for Sakura Scheme.
//
// Layers, in order:
//   L0 CORE  — R7RS + primitives  (base.js: makeBaseEnv)
//   L1 MEDIA — framebuffer + sound + input  (media.js: registerMedia,
//              already invoked inside makeBaseEnv)
//   L2 AI    — cortex + LLM interface       (ai.js)
//   L3 GAME  — sprites + physics + entities (game.js)
//   L4 SHOP  — etsy/ebay/shopify/meta/google (commercial.js)
//
// The Sakura binary (bin/sakura-scheme) uses `makeSakuraEnv` in place
// of `makeBaseEnv` — so every commercial verb registers, every AI verb
// exists, every game verb works out of the box.
//
// Non-Sakura callers (Jesse binary, Lacuna Engineering, standalone
// scheme-lang) keep using `makeBaseEnv` — they get L0 + L1 only.

import { makeBaseEnv } from './base.js'
import { installAi } from './ai.js'
import { installGame, makeGameState } from './game.js'
import { installGameTheory } from './game-theory.js'
import { installGameInstances } from './game-instances.js'
import { installJuggle } from './juggle.js'
import { installScene } from './scene.js'
import { installCine } from './cine.js'
import { installOps } from './ops.js'
import { installCommercial } from './commercial.js'
import { loadAuthFromDisk } from './auth/store.js'
import { registerReferenceVerbs } from './reference-register.js'
import { installWiredVerbs } from './wired-verbs.js'
import { installWiredVerbsIP } from './wired-verbs-priya-i-p.js'
import { installWiredVerbsHanaMath } from './wired-verbs-hana-math.js'
import { installWiredVerbsMarcusMathC } from './wired-verbs-marcus-math-c.js'
import { installSystem } from './system.js'

/**
 * makeSakuraEnv — the full L0 → L4 stack. Returns a ready-to-eval Env.
 *
 * Options:
 *   fuel      — the shared fuel cell (required)
 *   gameState — optional custom game state (default: fresh)
 *   loadAuth  — if true, prime the Cortex from ~/.sakura/auth.json
 *               before commercial verbs go live. Default true.
 */
export function makeSakuraEnv(fuel, {
  gameState = null,
  loadAuth  = true,
} = {}) {
  const env = makeBaseEnv(fuel)

  // L2 AI — cortex + llm interface. Cortex is a stub (in-memory dict);
  // llm errors cleanly when unwired.
  installAi(env)

  // L3 GAME — sprites, entities, physics, tile maps. Standalone game
  // state; adapters can override by passing their own.
  const game = gameState || makeGameState()
  installGame(env, game)

  // L3.5 JUGGLE — pure siteswap math. No state; standalone. Wires 6
  // verbs (juggle/valid? juggle/balls juggle/max-throw juggle/state
  // juggle/simulate juggle/generate). Must run BEFORE installWiredVerbs
  // so wired-verbs.js's descriptor stubs for juggle/* are skipped.
  installJuggle(env)

  // L3.55 SCENE — level orchestration verbs that mutate game.entities.
  // Wires 5 (scene/clear scene/grid scene/spawn-many scene/imagine
  // scene/load). Must run AFTER installGame (needs the entities Map)
  // and BEFORE installWiredVerbs.
  installScene(env, game)

  // L3.56 CINE — cinematography verbs. Camera state + shot vocabulary +
  // frame/shot records. Reads entity positions from game.entities for
  // aabb computation. Wires 7 (cine/comfort cine/follow cine/following?
  // cine/frame cine/shot cine/shots cine/stop). Same install-order
  // reasoning as scene: after game, before wired-verbs.
  installCine(env, game)

  // L3.6 GAME THEORY — kira-game lane. Pure combinatorial-game-theory
  // verbs: nim/mex/Grundy/Wythoff, surreal numbers, tic-tac-toe minimax.
  // Real math, no live subsystem. Runs BEFORE installWiredVerbs so the
  // fake descriptor-stubs there for game/surreal-* / game/ttt-* / etc.
  // are skipped and our authored impls win.
  installGameTheory(env)

  // L3.65 GAME INSTANCES — kira-game lane. Multi-instance loop registry.
  // Owns the (big-bang initial-state) → id mapping so game/frame,
  // game/state, game/running?, game/step, game/stop all work per-id.
  // No rendering, no physics; those live in installGame and elsewhere.
  installGameInstances(env)

  // L3.7 OPS — operations-research primitives (Zain, 2026-07-14). Wires
  // all 35 ops/* verbs (eoq, mm1, mmc, dijkstra, simplex, mip-solve,
  // pagerank, absorbing-probs, …). All pure computation, no I/O. Runs
  // BEFORE installWiredVerbs so the ops descriptor stubs there are
  // skipped by the preExisting check. Real algorithms, no descriptor
  // lies. Alfred: "we can't lie to people. They trust us."
  installOps(env)

  // L4 COMMERCIAL — etsy/ebay/shopify/meta/google. Every verb is
  // registered; execution is gated by an auth check that reads from
  // the Cortex.
  installCommercial(env)

  // Prime the Cortex with any on-disk auth from a prior login. Must
  // come after installAi (which sets up the Cortex) and before any
  // commercial verb actually fires.
  if (loadAuth) {
    try { loadAuthFromDisk() } catch { /* first-run OK */ }
  }

  // L4.4 SYSTEM — input/* + system/* real impls (hiroshi-system lane).
  // Real button state + edge map + permission gate + registry walker.
  // Runs BEFORE installWiredVerbs so our impls win over the descriptor
  // stubs there. No hardware attached: state slots default to honest
  // empty and reads reflect that truthfully.
  installSystem(env)

  // L4.5 WIRED — additional impls that close the reference→env gap.
  // Runs BEFORE the reference registrar so its stub pass sees these
  // as bound and skips them. Covers cortex first-class wrappers,
  // tick/*, beat/*, note/*, synth/*, ops/*, game/*, alg/* impls, and
  // shaped descriptors for the long tail (podcast-*, canvas-*, etc.)
  // so book examples read cleanly in standalone REPL.
  installWiredVerbs(env, fuel)

  // L4.6 WIRED-IP — Priya's lane (no-namespace i-p). Overrides shaped
  // descriptors from installWiredVerbs with real REPL-safe impls where
  // the semantics allow, and installs an honest podcast state model.
  installWiredVerbsIP(env, fuel)

  // L4.7 WIRED-HANA-MATH — Hana's lane (solve/plot/seq/calc). Overrides
  // descriptor stubs for the 26 calc/*, 14 plot/*, and 1 seq/* verbs
  // with real numerical impls. Plot verbs rasterize into the shared
  // framebuffer AND return an inspectable plot record.
  installWiredVerbsHanaMath(env, fuel)

  // L4.8 WIRED-MARCUS-MATH-C — Marcus's lane. Fixes const/ln{2,10} and
  // const/sqrt{2,3} (were thunks, must be numbers). Replaces descriptor
  // stubs for rule-conway, num/nintegrate-{2d,3d}, rasterize-text, rows,
  // and zoom-legible? with real impls. See docs/reports/lanes/
  // marcus-math-c-audit-2026-07-14.slat.
  installWiredVerbsMarcusMathC(env, fuel)

  // L5 REFERENCE — every documented verb from SAKURA-SCHEME-REFERENCE.slat.
  // Curated impls replace stubs; anything without an impl gets a
  // clean-error stub with the reference contract embedded in the
  // message. Runs LAST so already-installed L2/L3/L4 impls win over
  // the reference registrar's stubs.
  registerReferenceVerbs(env, fuel)

  return env
}

export default makeSakuraEnv
