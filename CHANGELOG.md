# Changelog

All notable changes to scheme-lang / sakura-scheme are recorded here.

## [1.5.0] — 2026-07-13

The four-lane landing. Every layer of the language now stacks cleanly on
top of the L0 core, driven by a single consolidated SLAT reference.

### Added

- **L1 media layer** — framebuffer, drawing primitives (`circle`, `disc`,
  `line`, `rect`), audio (`tone`), animation (`on-frame`), input surface.
- **L2 AI layer** — `cortex/remember`, `cortex/recall`, model dispatch.
- **L3 game layer** — `entity/make`, `entity/get`, `entity/collides?`,
  physics (`physics/gravity!`, `physics/step`), boid steering (`ai/*`).
- **L4 commercial layer** — Etsy / eBay / Shopify commerce verbs with
  auth-gated dispatch (`etsy/list-products` and friends surface a clean
  "sign in to use" error when no session is present).
- **CLI Google device-flow login** — `sakura login`, `sakura logout`,
  `sakura whoami`. Device-flow prompt renders; a real Google client id
  will be wired in a follow-up.
- **Consolidated reference SLAT** — `docs/SAKURA-SCHEME-REFERENCE.slat`
  supersedes the retired `SAKURA-SCHEME-1.0.REF.md`. 1,157 verbs +
  70 core language forms in a single Scheme-shaped file. The REPL,
  `,help`, the docs site, and the LLM tool-call schemas all read from it.
- **Book of Jesse** — `docs/BOOK-OF-JESSE.md`, a 15-chapter onboarding
  translation manual from Fennel / TIC-80 / Clojure / Lua to Sakura Scheme.
- **Reader R7RS §6.7 string escapes** — `\n`, `\t`, `\r`, `\\`, `\"`, `\0`,
  `\a`, `\b`. Previously the reader silently stripped backslashes,
  turning `"\n"` into a literal `n`. Fixed.

### Fixed

- 7 novice-tier example bugs in the consolidated reference SLAT
  (trailing-quote-as-JS-string typos + two unclosed-list bugs). Two
  interesting reader-macro-style example bugs are logged for a follow-up
  pass — see `docs/reports/deep-bugs-for-jesse-2026-07-13.md`.
- Docs-site reference renderer (`docs/site/render-ref.mjs`) rewritten to
  consume the SLAT via the same loader the REPL uses, replacing the
  old MD renderer.

### Notes

- 225 tests pass, 0 fail. Full suite in `tests/`.
- REPL smoke tests all clean: shape verbs, `tone`, `on-frame`,
  `cortex/remember` / `cortex/recall`, `entity/make`, unauthenticated
  `etsy/list-products` (clean error), `sakura login` (prints prompt),
  `sakura whoami`, multi-layer example script (`examples/bouncing-ball.scm`).

## [1.0.0] — 2026-07

Initial public release. L0 core interpreter, shape verbs, REPL, tutorial.
