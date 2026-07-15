# Plan — Extract Sakura Scheme as a Shared Language

## Context

Alfred already has a working, tested Sakura Scheme interpreter written in JavaScript inside Curator. It's used everywhere — every card, every gesture, every animation runs through it. But it lives *inside a consumer*. Lacuna is about to grow a verb layer of its own. Gastronomy Graph writes `.scm` files as data. Forge reads `.sks` as opaque text. The tension is real: the language is doing the shared work, but the consumer that ships it also owns it.

The fix is to promote the language to its own repo, seal it against downstream modification, and make it *pleasant to use* — REPL help, web docs, bash CLI, Sakura-facing introspection, all fed from one metadata source. Consumers subscribe by pinning a version; they don't fork.

This plan is Phase 2 of THE-PLAN.md — the engine extraction Chapter 3 deferred to after Friday. It also folds in Alfred's convenience-layer requirement: **web docs, REPL help, Sakura-callable help, and bash CLI must all be first-class, all fed by one metadata layer.**

---

## What we found (Phase 1 exploration, 3 Explore agents, 175k LOC surveyed)

### Curator's current Scheme code (source of the extraction)

**Core language — 1,986 LOC, dialect-neutral, zero Curator coupling:**
- `curator-web/src/scheme/reader.js` (197 lines) — tokenizer + parser + source positions + LRU AST cache
- `curator-web/src/scheme/interp.js` (532 lines) — evaluator, `Env`, `Closure`, TCO trampoline, fuel budget
- `curator-web/src/scheme/base.js` (832 lines) — 80+ primitives (arithmetic, list, string, R7RS subset)
- `curator-web/src/scheme/macro.js` (425 lines) — hygienic `syntax-rules` + `define-macro`

**Runtime layer — extractable core parts (~650 LOC out of 4,643):**
- `curator-web/src/scheme/runtime/verbRegistry.js` (274 lines) — verb metadata format + validation
- `curator-web/src/scheme/runtime/dispatch.js` (857 lines total; core dispatch ~500 LOC, Curator security policy ~350 LOC) — the five-gate dispatcher

**Curator-specific — stays in Curator (~148k LOC):**
- `index.js` warming wrapper (1,080 LOC — this is where installers register)
- 35 primitive-adapter files (animation/audio/graphics/motion) — ~8,956 LOC
- 50+ top-level verb files (card/shop/sprite/music/etc.) — ~50,000 LOC
- Cart host, cart bus, live bridge — Curator's execution loop
- 237 test files, 44k LOC of tests
- 10,762 `.sks` cart files — the business logic

**The verb registration pattern is already clean:**
```javascript
env.define('card/open', (args) => body, {
  perm: 'state-change',
  arity: 1,
  contract: 'symbol -> boolean',
  doc: 'Opens the card identified by id',
  examples: [...],
  atom: 'card.open',
  tier: 'operator'
})
```
No hard-coded verb tables in the evaluator. Every verb plugs in via `env.define()`. The extraction boundary already exists in the code.

### Other consumers surveyed

| Repo | Current | Post-extraction |
|---|---|---|
| **Curator** | Owns 148k LOC + engine | Pins `sakura-scheme` version; keeps verb layer |
| **Lacuna** | Python S-expr stub (`recipe.py`, no eval) | Pins `sakura-scheme`; grows Lacuna verb layer (`sys/*`, `net/*`, `docker/*`) |
| **Gastronomy Graph** | 634 `.scm` files (pure data) | Pins reader-only via `sakura-scheme/reader`; nothing else changes |
| **Forge** | Reads `.sks` as opaque text | Optional: gains parse-verify at ingest |
| **Baobab** | Steel (Rust) — different ecosystem | No change. Steel is fine for embedded Rust workers |
| **Caliper** | Own tiny TS Scheme, 15 primitives, test-scenario compilation | No change. Different domain; keep bespoke |
| **sakura-corpus** | Fenced Scheme inside JSONL/slat | No change |

### The naming resolution

**One language: Sakura Scheme.** Two verb layers on top: Curator's (`world/*`, `card/*`, `flower/*`, `shop/*`) and Lacuna's (`sys/*`, `net/*`, `docker/*`, `deploy/*`). Not two dialects — one language, two vocabularies. Repo name = binary name = crate name = `sakura-scheme`. The persona name "Sakura" stays for the flower character in Curator; context disambiguates in prose.

---

## Architecture

### Three layers, one dependency direction

```
                       ┌────────────────────────────┐
                       │  sakura-scheme (repo)      │
                       │  reader · interp · base ·  │
                       │  macro · registry ·        │
                       │  dispatcher · REPL · CLI · │
                       │  doc-emitter · slat        │
                       └────────────┬───────────────┘
                                    │  depends on (SemVer pin)
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌────────────────────────┐      ┌────────────────────────┐
        │  Curator verb layer    │      │  Lacuna verb layer     │
        │  (~148k LOC, unchanged │      │  (new, small at first) │
        │   after extraction)    │      │                        │
        └───────────┬────────────┘      └───────────┬────────────┘
                    │                                │
                    ▼                                ▼
        ┌────────────────────────┐      ┌────────────────────────┐
        │  Curator app           │      │  Lacuna app            │
        └────────────────────────┘      └────────────────────────┘
```

Rule: no arrow between Curator and Lacuna. Neither can reach into the other's verb layer. Both pull from `sakura-scheme` by version. The engine has no upward knowledge of either.

**Proof of the seal:** `rm -rf ~/code/lacuna/` on a machine with Curator checked out — Curator still builds and runs. Same test in reverse. Both apps must pass this to prove no cross-reach crept in.

### The convenience layer (Alfred's ergonomics ask)

Every verb carries **one metadata blob**. That blob is the single source for:

1. **REPL introspection** — `,help card/open`, `,type card/open`, `,doc card/open`, `,arity card/open`, `,examples card/open`, `,source card/open`
2. **Bash CLI** — `sakura-scheme help card/open`, `sakura-scheme eval "..."`, `sakura-scheme repl`, `sakura-scheme run file.scm`, `sakura-scheme docs`, `sakura-scheme docs serve`
3. **Web docs** — auto-generated MD files, one page per namespace, rebuilt on trigger. Pretty on GitHub, deployable as static site
4. **Sakura-callable help** — `(help 'card/open)` in a program returns the same metadata. Sakura the persona can ask her own runtime what a verb does
5. **Reference-manual sync** — CI trigger (Chapter 4 of THE-PLAN) rebuilds `lacuna-docs/scheme/reference/` on any verb change

All five surfaces read from the same registry. Add a verb → all five update, automatically. That's the "one edit, everywhere current" property Alfred asked for.

---

## Repository shape — `~/code/sakura-scheme/`

```
sakura-scheme/
├── README.md                    # hero + quickstart + install + link to reference
├── CLAUDE.md                    # per-repo agent guidance
├── package.json                 # ES modules, npm name "sakura-scheme"
├── LICENSE
├── CHANGELOG.md                 # SemVer log; every version documented
├── CONSUMERS.md                 # downstreams that pinned this + their range
│
├── src/
│   ├── reader.js                # from curator-web/src/scheme/reader.js (verbatim)
│   ├── interp.js                # from curator-web/src/scheme/interp.js
│   ├── base.js                  # from curator-web/src/scheme/base.js (drop bricklay cache refs)
│   ├── macro.js                 # from curator-web/src/scheme/macro.js
│   ├── registry.js              # verb metadata format (extracted from runtime/verbRegistry.js)
│   ├── dispatch.js              # generic dispatch chokepoint (extracted from runtime/dispatch.js)
│   ├── repl.js                  # NEW — REPL machinery + meta-commands
│   ├── cli.js                   # NEW — bash CLI entry point
│   ├── docs-emitter.js          # NEW — verb metadata → MD generator
│   ├── slat.js                  # NEW — JS slat reader/writer (mirrors Python one)
│   └── introspect.js            # NEW — type-of, describe, arity-of, doc-of, help
│
├── bin/
│   └── sakura-scheme            # shebang binary → src/cli.js
│
├── docs/
│   ├── REFERENCE.md             # core language reference (moved from curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md)
│   ├── ENGINEERING.md           # engineering doc (moved from curator/docs/SAKURA-SCHEME-1.0-ENGINEERING.md)
│   ├── STYLE-GUIDE.md           # (moved from curator/docs/SAKURA-SCHEME-1.0-STYLE-GUIDE.md)
│   ├── TUTORIAL.html            # interactive tutorial (moved)
│   ├── CHALLENGES.md            # SICP-flavored programs (Ch 3 Challenges appendix)
│   └── slat/                    # slat format spec (integrated here since slat is language-adjacent)
│       ├── SPEC.md
│       ├── GRAMMAR.md
│       └── EXAMPLES.md
│
├── tests/                       # extracted from curator-web/src/scheme/**/*.test.js (core-only subset)
│   ├── reader.test.js
│   ├── interp.test.js
│   ├── base.test.js
│   ├── macro.test.js
│   ├── registry.test.js
│   ├── dispatch.test.js
│   ├── introspect.test.js
│   ├── repl.test.js
│   └── slat.test.js
│
├── scripts/
│   ├── setup-dev.sh             # pinned toolchain per Ch 5 §5.3 of THE-PLAN
│   ├── install-hooks.sh         # calls into lacuna-git-hooks
│   ├── test-fast.sh
│   ├── test-full.sh
│   ├── build-docs.sh            # emit MD from verb registry → docs/reference/
│   └── serve-docs.sh            # local doc server for live preview
│
├── .lacuna/
│   ├── triggers.yaml            # verb-added/removed → doc-regen handlers
│   └── tools.yaml               # pinned toolchain manifest
│
└── .github/
    └── workflows/               # per Ch 4 §4.7 of THE-PLAN
```

**Consumer side (Curator):**
```
curator/
├── package.json                 # adds "sakura-scheme": "1.4.x"
├── curator-web/src/scheme/
│   ├── curator-verbs/           # RENAMED from top-level src/scheme/*.js verb files
│   │   ├── card/                # cardVerbs.js and friends
│   │   ├── shop/
│   │   ├── sprite/
│   │   ├── flower/
│   │   └── ...
│   ├── index.js                 # warmed env, now imports { registerPrimitive, evaluate } from 'sakura-scheme'
│   └── carts/                   # 10,762 .sks files — UNCHANGED
```

Curator's business logic stays. Only the *four core files* (reader/interp/base/macro) plus the runtime slice move out. Everything else keeps its current path.

**Consumer side (Lacuna, new):**
```
lacuna/
├── package.json                 # adds "sakura-scheme": "1.4.x"
├── lacuna-src/lacuna/scheme/
│   ├── lacuna-verbs/            # NEW — Lacuna's verb layer
│   │   ├── sys/
│   │   ├── net/
│   │   ├── docker/
│   │   ├── deploy/
│   │   └── ...
│   └── index.js                 # symmetric to Curator's index.js but with Lacuna's installers
```

---

## Extraction procedure

Six steps. Each has an exit gate. Rollback = git revert.

**Step (a) — Copy files verbatim to new repo, preserve history.**
```bash
cd /tmp
git clone --no-local ~/code/curator engine-extract
cd engine-extract
git filter-repo \
  --path curator-web/src/scheme/reader.js \
  --path curator-web/src/scheme/interp.js \
  --path curator-web/src/scheme/base.js \
  --path curator-web/src/scheme/macro.js \
  --path curator-web/src/scheme/runtime/verbRegistry.js \
  --path curator-web/src/scheme/runtime/dispatch.js \
  --path-rename curator-web/src/scheme/:src/ \
  --path-rename src/runtime/:src/
```
Then `git init ~/code/sakura-scheme`, add remote, push. Gate: the new repo has full history for the six extracted files.

**Step (b) — Freeze the public API surface.**
Write `src/index.js` exporting exactly what consumers may touch:
```javascript
export { parse, posOf } from './reader.js'
export { evaluate, Env, Closure, apply } from './interp.js'
export { makeBaseEnv } from './base.js'
export { expandProgram } from './macro.js'
export { registerPrimitive, getVerbMeta, snapshotRegistry, validateRegistry } from './registry.js'
export { dispatch } from './dispatch.js'
export { help, describe, typeOf, arityOf, docOf, sourceOf } from './introspect.js'
export { startRepl } from './repl.js'
export { emitDocs } from './docs-emitter.js'
export { slatLoads, slatDumps, slatToJsonl, jsonlToSlat } from './slat.js'
export const VERSION = '1.4.0'
```
Everything else is internal. `PUBLIC-API.md` documents these exactly. Gate: docs written, symbols enumerated.

**Step (c) — Curator adds the dependency.**
`curator-web/package.json` adds `"sakura-scheme": "1.4.x"`. Local dev uses a path override:
```json
"overrides": { "sakura-scheme": "file:../../sakura-scheme" }
```
Gate: `npm install` in curator-web succeeds; version resolves.

**Step (d) — Rewire Curator's imports.**
Search-replace in `curator-web/src/scheme/`:
- `import { parse } from './reader.js'` → `import { parse } from 'sakura-scheme'`
- `import { evaluate, Env } from './interp.js'` → `import { evaluate, Env } from 'sakura-scheme'`
- etc.

Verb files stay put — they only import `Env` and `registerPrimitive` from `sakura-scheme` now.

Move Curator's verb `.js` files into `curator-web/src/scheme/curator-verbs/<namespace>/` (organizational, not required — but discoverable).

Gate: `npm run test` in curator-web is green. `npm run build` succeeds. Vite HMR still hot-reloads.

**Step (e) — Delete the old copies inside Curator.**
`git rm curator-web/src/scheme/reader.js interp.js base.js macro.js runtime/verbRegistry.js runtime/dispatch.js`. Commit: "chore: complete engine extraction; language now consumed via sakura-scheme dep."

Gate: Curator builds, tests pass, `grep -R "scheme/reader.js" curator-web/` returns empty.

**Step (f) — Move the language docs to the engine repo.**
`git mv curator/docs/SAKURA-SCHEME-1.0-*.md → sakura-scheme/docs/`. Leave stubs in Curator that link to the new home. Gate: doc site still resolves; every internal link works.

Estimated total: ~13 hours of focused work per Explore agent 3. Distributes across two evenings without disturbing training.

---

## Verb metadata — the ergonomics contract

Every `registerPrimitive` call must carry the full metadata blob. Existing Curator verbs already do most of this; extraction gate confirms 100%.

```javascript
registerPrimitive({
  name: 'card/open',
  arity: [1, 2],                    // required, [min, max]
  contract: '(symbol [options]) -> boolean',
  doc: 'Opens the card identified by id. Options is an optional hash-table.',
  examples: [
    { level: 'novice',       code: '(card/open \'welcome)' },
    { level: 'intermediate', code: '(card/open \'shop-main #:animate #t)' },
    { level: 'expert',       code: '(let ((r (card/open \'lyric #:on-close (lambda () ...)))) ...)' }
  ],
  atom: 'card.open',                // slug for reference manual
  tier: 'operator',                 // dispatch tier
  perm: 'state-change',             // permission required
  source: 'curator-verbs/card/open.js:42',  // where implemented
  namespace: 'card',                // for grouping
  since: 'sakura-scheme@1.0',       // when introduced
  impl: (id, opts) => { ... }       // the actual function
})
```

Every field but `impl`, `name`, and `arity` is optional but **strongly encouraged**. The doc-emitter reads these; missing fields become gaps in the reference. `validateRegistry()` warns on missing `doc` or `examples`.

**Levels of introspection at the REPL:**

```
> ,help card/open
card/open  —  Opens the card identified by id.
Arity:      1 or 2 args
Contract:   (symbol [options]) -> boolean
Namespace:  card
Tier:       operator (perm: state-change)
Since:      sakura-scheme@1.0
Source:     curator-verbs/card/open.js:42

Examples:
  novice        (card/open 'welcome)
  intermediate  (card/open 'shop-main #:animate #t)
  expert        (let ((r (card/open 'lyric #:on-close (lambda () ...)))) ...)

Related:      card/close, card/pin, card/zoom
```

```
> ,type card/open
(-> symbol (optional hash-table) boolean)
```

```
> ,arity card/open
1..2
```

```
> ,doc card/open
Opens the card identified by id. Options is an optional hash-table.
```

```
> ,examples card/open
[three levels shown]
```

```
> (help 'card/open)
;; same as ,help but returns a hash-table so Sakura can compose queries
```

REPL meta-commands: `,help`, `,type`, `,doc`, `,arity`, `,examples`, `,source`, `,namespace <ns>` (list all verbs in a namespace), `,search <regex>`, `,exit`.

---

## Bash CLI

```
$ sakura-scheme --help
sakura-scheme 1.4.2 — the language

Usage: sakura-scheme <command> [options]

Commands:
  repl                     Interactive REPL. Loads current dir's verb layer if present.
  eval "<code>"            Evaluate one expression, print result.
  run <file.scm>           Run a program file to completion.
  help <verb>              Print help for a verb (same as REPL ,help).
  docs                     Print MD reference to stdout, or --serve to launch local doc site.
  docs regen               Regenerate reference/ MD from live registry. Idempotent.
  version                  Print version + git sha of the interpreter.
  slat parse <file.slat>   Parse a .slat file; print as JSON.
  slat emit <file.jsonl>   Convert a JSONL log to slat.

Options:
  --verb-layer <path>      Load this verb layer instead of auto-detecting.
  --fuel <n>               Fuel budget (default 200_000).
  --seed <n>               PRNG seed (default: process time).
  --no-color               Disable ANSI.
```

**Auto-detection of verb layer**: `sakura-scheme` inside `~/code/curator/` loads Curator's verb layer via `curator-web/src/scheme/curator-verbs/index.js`. Inside `~/code/lacuna/` loads Lacuna's. Elsewhere loads only the base language.

Config file: `.sakura-scheme.toml` at project root:
```toml
[verb-layer]
path = "./curator-web/src/scheme/curator-verbs"
version = "1.4.x"
```

---

## Web docs (auto-regen trigger)

Docs live at `sakura-scheme/docs/reference/`:

```
docs/reference/
├── README.md                # index across all namespaces
├── core/                    # language forms — hand-written
│   ├── define.md
│   ├── let.md
│   ├── cond.md
│   └── ...
├── base/                    # primitives — hand-written
│   ├── car.md
│   ├── map.md
│   └── ...
├── card/                    # generated from Curator's verb layer
│   ├── open.md
│   ├── close.md
│   └── ...
└── sys/                     # generated from Lacuna's verb layer
    ├── reboot.md
    └── ...
```

**Auto-regen trigger** (per Chapter 4 of THE-PLAN):

```yaml
# .lacuna/triggers.yaml in sakura-scheme repo AND consumer repos
- id: verb-added-doc-regen
  subscribes: scheme/verb/added
  runs: sakura-scheme docs regen --verb {{atom}}
  layer: [git, watch, ci]
  outputs:
    - docs/reference/{{namespace}}/{{atom}}.md
  on-failure: block-commit
```

When a consumer adds a verb via `registerPrimitive({name: 'shop/list-items', ...})`, the trigger fires on commit:
1. Runs `sakura-scheme docs regen --verb shop.list-items`
2. Emits `curator/docs/reference/shop/list-items.md` (in consumer's docs tree)
3. Also emits a stub in `sakura-scheme/docs/reference/index.md` (the cross-consumer index)
4. Fails commit if the MD didn't emit (verifies output)

**Web site build**: `sakura-scheme docs --serve` runs a lightweight static site on the MD tree. GitHub Pages workflow deploys on push. Site style follows brand template (tri-tone hero, kebab slugs, TOC).

**Sakura's introspection path**: her runtime can call `(help 'shop/list-items)` and get the same hash-table the CLI/REPL uses. She reads it, incorporates it into her response. Same source of truth.

---

## Consumers — subscribe, don't own

`sakura-scheme/CONSUMERS.md` is a table:

```markdown
| Consumer | Path | Version pinned | Verb layer | Status |
|---|---|---|---|---|
| Curator | ~/code/curator/curator-web | ^1.4.0 | curator-verbs/ (148k LOC) | active |
| Lacuna | ~/code/lacuna/lacuna-src | ^1.4.0 | lacuna-verbs/ (small) | active |
| Gastronomy Graph | ~/code/gastronomy-graph | ^1.4.0 (reader-only) | none — parses .scm as data | active |
| Forge | ~/code/forge | (optional) | none — parses .sks at ingest | optional |
| Baobab | — | — | uses Steel (Rust) | separate ecosystem |
| Caliper | — | — | own 15-primitive TS impl | separate ecosystem |
```

**Subscriber rules:**
- Consumers pin a SemVer range in their manifest.
- Consumers may NOT push directly to `sakura-scheme/main`.
- Consumers propose changes via PR — reviewed as a language change, not a product change.
- Patch bumps: consumers auto-update. Minor: consumers update at leisure. Major: coordinated migration with two-week window per Chapter 3 §3.9.

---

## Slat's place in the language

Slat is language-adjacent (line-delimited S-expressions, uses the same reader). It lives **inside `sakura-scheme/`** as `src/slat.js` + `docs/slat/`. Rationale:

- Slat's reader IS the Sakura Scheme reader (same tokenizer, same grammar for atoms). Building it twice is drift risk.
- Meridian, Forge, and any other consumer imports `slat` from `sakura-scheme` alongside the language runtime.
- The Python `slat_reader.py` / `slat_writer.py` (already shipped by the Slat bot) stays as the **Python binding**. Both bindings ship in `sakura-scheme/bindings/python/` OR the Python one stays in `forge/forge/corpus/` and is documented as a mirror.

Per-language binding pattern:
```
sakura-scheme/
├── src/                     # JS core
├── bindings/
│   ├── python/              # Python reader/writer (for Forge, Meridian, corpus-authoring bots)
│   └── rust/                # future: for Baobab-style embedded workers
```

The engine repo owns the format spec. Bindings implement it. Round-trip tests ensure all bindings agree on the wire.

---

## Verification — how we know the extraction worked

1. **Zero-touch test.** Every existing Curator test passes without modification after step (d). Runs of `.sks` files produce byte-identical output.
2. **Seal test.** `rm -rf ~/code/lacuna/` → Curator builds and tests pass. Reverse also true.
3. **REPL bootstrap.** `sakura-scheme repl` inside `curator-web/` loads Curator's verb layer, evaluates `(card/open 'welcome)` correctly.
4. **CLI bootstrap.** `sakura-scheme eval "(+ 1 2)"` prints `3`. `sakura-scheme help card/open` prints structured help.
5. **Doc regen.** Adding a verb via `registerPrimitive({name: 'test/hello', ...})` triggers the hook; the MD lands; the doc site rebuilds; the reference index lists it.
6. **Sakura's introspection.** In Curator, `(help 'card/open)` returns a hash-table matching REPL output.
7. **Slat round-trip.** `slat_dumps(slat_loads(x)) === x` for 100 fixtures + 100 random.
8. **Gastronomy read.** `sakura-scheme run gastronomy-graph/cards/apple.scm` parses without error (reader-only mode).
9. **Consumer version pin.** `curator-web/package.json` has `"sakura-scheme": "^1.4.0"`, resolves via path override in dev, resolves via git tag in CI.

---

## Decisions locked (from Phase 3 clarifications)

- **CLI runtime: Node.js.** `bin/sakura-scheme` is a shebang script → `node`. ES modules throughout, matching Curator. `package.json` has `"type": "module"` and `"bin": { "sakura-scheme": "./bin/sakura-scheme" }`.
- **Slat bindings: both under `sakura-scheme/bindings/`.** JavaScript reader/writer live in `src/slat.js` (canonical). Python binding moves from `~/code/forge/forge/corpus/slat_*.py` into `~/code/sakura-scheme/bindings/python/`. Round-trip tests run across both bindings in CI (one Python fixture, one JS fixture, both must produce byte-identical output for shared inputs). Rust binding slot reserved at `bindings/rust/` for future Baobab-style embedded use.
- **Doc site: VitePress.** `docs/` becomes a VitePress site (already Vite-shaped, matches Curator's stack). MD files remain the working surface; VitePress builds them into a browsable static site with sidebar + search + version switcher. `scripts/build-docs.sh` runs `vitepress build`; `scripts/serve-docs.sh` runs `vitepress dev`. GitHub Actions deploys the built `docs/.vitepress/dist/` to Pages on push to `main`.

## Multi-language interop — Node core + sidecar hosts

The language runtime is Node.js only. There is exactly one canonical implementation. That does not mean Lacuna gives up Python or Rust — it means Python and Rust live on the **host side**, called from JS verb implementations via a sidecar pattern.

**The pattern:**

```
                      ┌─────────────────────────┐
                      │  sakura-scheme (Node.js)│
                      │  reader · interp ·      │
                      │  base · macro · REPL    │
                      └────────────┬────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌─────────────────────┐                    ┌─────────────────────┐
   │ Curator verb layer  │                    │ Lacuna verb layer   │
   │ JS impls (in-proc)  │                    │ JS impls (in-proc)  │
   │  card/*  world/*    │                    │  sys/*  net/*       │
   └─────────────────────┘                    └────────────┬────────┘
                                                           │
                                          verbs that need ML/crypto/OS libs
                                                           ▼
                                              ┌─────────────────────┐
                                              │  Sidecar workers    │
                                              │  Python (ML/data)   │
                                              │  Rust (crypto/OS)   │
                                              │  speak SLAT over    │
                                              │  Unix socket        │
                                              └─────────────────────┘
```

**Rules:**

- Every verb has a JavaScript implementation. Simple verbs (arithmetic, string ops, HTTP GETs, file I/O) are pure JS.
- Verbs that need heavy external libraries call a sidecar. The JS impl is a thin dispatcher: message-pass a slat request, await a slat response.
- Sidecars are the same worker spine specified in Big Forge Plan Part III. Curator gets sidecars when it wants ML too; not Lacuna-only.
- Sidecars speak slat over Unix socket (default) or HTTP loopback (fallback for cross-container).
- Startup: sidecars are declared in `.lacuna/sidecars.yaml`. Foreman (worker.py extension) launches them before verb dispatch begins.
- Failure model: a sidecar crash surfaces as `(error 'sidecar-down "python-ml")`; verb returns a proper error value; supervisor tree restarts per OTP-flavored policy.

**Concrete Lacuna example:**

```javascript
// lacuna/lacuna-scheme/lacuna-verbs/model/reason.js
import { registerPrimitive } from 'sakura-scheme'
import { callSidecar } from '../lib/sidecar.js'

registerPrimitive({
  name: 'model/reason',
  arity: 1,
  contract: '(string) -> string',
  doc: 'Ask the L1 8B reasoner. Returns its answer as a string.',
  examples: [
    { level: 'novice', code: '(model/reason "why is the sky blue?")' }
  ],
  atom: 'model.reason',
  tier: 'operator',
  perm: 'network',
  namespace: 'model',
  impl: async (prompt) => {
    // JS impl is 3 lines: dispatch to python-ml sidecar via slat
    const req = { kind: 'reason', prompt, model: 'l1-workhorse' }
    return await callSidecar('python-ml', req)
  }
})
```

The sidecar (`~/code/lacuna/lacuna-src/lacuna/sidecars/python-ml.py`) is a persistent Python daemon that speaks slat over `~/.lacuna/sockets/python-ml.sock` and holds ML models resident. It's a Lacuna implementation detail; the language doesn't know it exists.

## The "real language" positioning

Sakura Scheme is a real programming language, not a private DSL. It publishes real docs, invites real use, and follows real conventions.

**What that means concretely:**

- **npm package name reserved**: `sakura-scheme`. Private for now (`"private": true` in package.json) but published when Alfred says go.
- **License**: MIT (or whatever Alfred picks — recommend MIT for community friendliness).
- **CONTRIBUTING.md** at the repo root describing how to propose changes: file an issue, discuss, PR to the engine. Every consumer follows this path — no cowboy patches.
- **CHANGELOG.md** with every version, following Keep-a-Changelog conventions. Semver everywhere.
- **CODE_OF_CONDUCT.md** — Contributor Covenant. Signals seriousness.
- **README** opens with what the language *is* (a small Scheme for humans and AI to program together), *what it looks like* (a 10-line example), *how to install* (`npm i sakura-scheme` — even if private today), and *how to help* (link to CONTRIBUTING).
- **Docs site** at `sakura-scheme.lacunalabs.ai` (or similar) — served by GitHub Pages from the VitePress build. Public URLs the community can bookmark.
- **Community-friendly language design** — R7RS subset for the core, standard names (`car`, `cdr`, `map`, `for-each`, `cond`, `let`, `lambda`). Someone with Scheme background lands and knows what to type. AI models trained on internet Scheme can help humans learn ours.
- **Borrows from ecosystem** — no reinventing where good things exist. VitePress for docs. Node LTS for runtime. pnpm for deps. Prettier + ESLint for style. Standard test runners. Everything humans and AI already know how to use.
- **Positioned in the README** — "a programming language for humans and AI to work together, borrowing from Scheme's five-decade tradition of programs that are easy to read and easy to reason about." No AI-hype language, no "revolutionary." Real, understated, honest.

**Not in scope right now (but on the horizon):**

- Public npm publication
- Language server (LSP) for editor integration
- WASM bundle for in-browser REPL widget
- Package manager for verb layers (like Cargo for Sakura Scheme carts)

Those follow after v1.0 ships.

## Naming resolution — the Book vs the verb layers

The problem: the current `SAKURA-SCHEME-1.0-REFERENCE.md` (in Curator, 410 KB) mixes **language semantics** (dialect-neutral, belongs to the language) with **verb catalog** (Curator-specific, belongs to Curator). If the language repo is hermetic and Sakura Scheme is the language, the Reference can't be Curator's alone.

**The resolution:**

- **The Sakura Scheme Book** (`sakura-scheme/docs/SAKURA-SCHEME-BOOK.md`) — the canonical language reference. Covers the pure language and any verb that eventually gets **promoted** into the base library (dialect-neutral, both consumers want it, same semantics). Never mentions product-specific verbs.
- **`curator/docs/CURATOR-VERBS.md`** — Curator's verb catalog. Named after Curator, owned by Curator, evolves with Curator.
- **`lacuna/docs/LACUNA-VERBS.md`** — Lacuna's verb catalog. Same shape, different owner.
- **Doc site** — the Book is the front page. A "Verb layers" tab lists every consumer's verb reference with its version pin. Same site, three (or more) surfaces.

The current 410 KB `SAKURA-SCHEME-1.0-REFERENCE.md` gets **split during extraction**:
- Language-level material (grammar, forms, primitives, macros, error model, REPL machinery, contract system) → `sakura-scheme/docs/SAKURA-SCHEME-BOOK.md`.
- Verb-catalog material (~500 verbs across `world/*`, `card/*`, `flower/*`, `shop/*`, `sprite/*`, `sound/*`, etc.) → `curator/docs/CURATOR-VERBS.md`. Filename kebab-cased for consistency: `curator-verbs.md`.

**Promotion path:** a verb that turns out dialect-neutral (both consumers want it, same signature, same semantics) is promoted UP into the Book's base library on a minor version bump. Same mechanism that made `filter` and `map` core, not Curator-specific. Promotion checklist:
- Verb has no product-specific behavior in its impl (no `curator.state`, no DOM reach, no Cortex call).
- Two consumers signal they want it.
- A migration note lives in `sakura-scheme/CHANGELOG.md` explaining what moved and when.

**No language rename.** Sakura Scheme stays Sakura Scheme. The Book stays the Book. Only the *reference documents* got separated into their proper homes. That's the whole fix.

## The wow layer — REPL, tooling, and code that writes code

**All content in this section lands in the Sakura Scheme Book** (`sakura-scheme/docs/SAKURA-SCHEME-BOOK.md`), not just in this plan. This is what a language enthusiast reads when they land on the docs site.

The v1.0 shipping bar is not "extraction works." It's **"a language enthusiast downloads it, types five things, and posts on Hacker News."** The features below are what get us there. Every one is either in-the-box for Sakura (she already knows) or already-implicit in the existing metadata; the work is exposing them.

### Super REPL — every trick a modern language ships with

A REPL is the language's face. Ours is going to be **as good as Julia's, IPython's, and Common Lisp's put together**, because it has one advantage they don't: it can ask Sakura for help mid-session.

- **Tab-complete** — verbs, namespaces, keyword args, bound symbols, local variables, doc-anchors. Fuzzy match, not just prefix.
- **Inline signature help** — as you type `(card/open `, the REPL displays the arity + arg names + doc summary in a dim ghost row above the cursor. Same source as `,help`.
- **Live docstring popup** — press `F1` on any symbol; the doc pops out below.
- **Structural editing (paredit-flavored)** — auto-close parens, splurge/slurp for reshaping expressions, `Ctrl-Shift-K` to kill a form, `Ctrl-Shift-M` to select a form. Nobody counts parens in 2026.
- **Syntax highlighting** — the input line highlights forms, strings, keywords, comments as you type. Same theme applies to output pretty-printing.
- **Multi-line editing** — Shift-Enter for new line inside a form, Enter to evaluate when the form is balanced. `Ctrl-O` opens an editor buffer for anything bigger than a screen.
- **Named results** — `_` is the last result, `_1` the previous, `_2` before that. `,save foo` binds `_` to the symbol `foo` in the session.
- **Rich display** — vectors and lists render as tables, hash-tables as key-value grids, numbers with a units suffix if they carry `:unit` metadata, images render inline (base64 SVG/PNG blobs), plots render as ASCII first + SVG if the terminal supports it.
- **`,time expr`** — wall time + fuel used + peak memory.
- **`,trace fn`** / **`,untrace fn`** — record every call, print entries + returns, one line each. Nested trace shows indent.
- **`,watch expr`** — re-evaluate on every prompt; show the value in a status bar.
- **`,inspect val`** — walk into a value; navigate with arrow keys; press Enter to descend, `Backspace` to ascend, `q` to quit.
- **`,expand form`** — show the macroexpanded form. `,expand-1` shows one step. Great for teaching, essential for debugging.
- **`,apropos regex`** — every symbol whose name matches. Sorted by namespace, tagged with kind (verb, macro, form, primitive).
- **`,undo`** — pop the last evaluation. Useful when you accidentally `(define x 42)` and want it gone.
- **`,save session.slat`** and **`,load session.slat`** — dump the whole session (defines, verb overrides, history) to a slat file; restore later. Sessions ARE slat.
- **Ctrl-R fuzzy history search** — like every modern shell.
- **`,shell command`** — pipe into a shell command; output is returned as a string.
- **`,ask sakura "how do I ..."`** — direct line to the persona. She reads the current session's bindings + last N evaluations + the verb registry, and answers with runnable code the REPL can eval on Enter. **This is the "AI is a peer in the REPL" feature nobody else has.**
- **Live reload** — save a `.scm` file; the REPL notices; re-runs its `define`s in a sandboxed env; asks before overwriting bindings. Optional per-session.
- **Notebook mode** — `sakura-scheme notebook foo.snb` opens a Jupyter-ish cell UI in the terminal (or in a browser tab if you pass `--web`). Cells are slat records; the notebook is `.snb` (slat notebook).

### The top 10 language features anyone would want, ready in v1.0

Every one of these is a small extension of what's already in `curator-web/src/scheme/`. Nothing is invented from scratch.

1. **Native pattern matching.** `(match expr (list 'move x y) → ..., (list 'stop) → ...)`. Destructures lists, records, keyword-arg forms. Compiled to nested `cond` under the hood.
2. **Keyword + optional arguments.** `(card/open :id 'welcome :animate #t)`. The interpreter already reads `:foo` as a keyword; this makes verbs opt-in for named args with defaults.
3. **Destructuring in `let` and `lambda`.** `(let ([(x y z) some-list]) …)`. `(lambda ([:name n :age a]) …)`.
4. **Async/await** — first-class, backed by JS Promises. `(await (fetch "url"))` returns a value; the interpreter yields to the event loop underneath.
5. **Records with generated getters.** `(define-record point (x y))` gives you `point?`, `point-x`, `point-y`, `make-point`. Ships slat serialization for free.
6. **First-class types.** `(type-of card-id) → 'card-id`. Every value carries a runtime type tag. `describe` prints the type + fields + doc.
7. **Modules with import/export.** `(module foo (export bar baz) (define (bar) ...))` and `(import foo :as f)`. Uses the reader we already have; small evaluator change.
8. **Rich error records.** Errors are slat forms with `:kind`, `:message`, `:source-pos`, `:did-you-mean [list of nearest verbs]`, `:fix [suggested code]`, `:examples [links]`. Every error is a value; catching it is a normal `guard`.
9. **Lazy sequences / streams.** `(stream-take 10 (stream-iterate (lambda (n) (+ n 1)) 0))`. Infinite stream primitives.
10. **Contract-checked verbs.** The `:contract` field on every verb is not just documentation — the dispatcher enforces it. Passes a wrong-type arg → structured error before the impl runs.

### Autogen magic — code that writes code

This is Sakura's home. The interpreter is a peer to her; every code-writing capability she has is exposed as a verb.

- **`(help 'card/open)`** — returns a hash-table with docstring, examples, contract, source. Same as `,help` in the REPL. Sakura reads it, humans read it, IDEs read it. One source of truth.
- **`(new-verb 'my-ns/foo :arity 2 :doc "…" :contract '…)`** — scaffolds a verb: writes a stub file at `<consumer>/verbs/my-ns/foo.js`, updates `.lacuna/triggers.yaml`, opens a REPL editor buffer with the stub loaded. Ships a doc regen with it.
- **`(new-cart :topic 'welcome-user)`** — scaffolds a `.sks` cart with the standard headers, opens for editing, indexes on save.
- **`(regen-doc 'card/open)`** — writes the MD for one verb. Same call the trigger uses.
- **`(sakura/complete '<partial-expr>)`** — Sakura's model completes the expression. Returns a new form. The REPL shows a diff before eval.
- **`(sakura/rewrite '<expr> :goal 'more-idiomatic)`** — Sakura suggests a rewrite. Goals: `'more-idiomatic`, `'faster`, `'shorter`, `'safer`, `'more-explicit`. She reads the corpus; she knows the style.
- **`(sakura/explain '<expr>)`** — Sakura returns a natural-language explanation of what the expression does. Useful in the REPL, mandatory in the tutorial.
- **`(sakura/fix '<error>)`** — pass an error record; Sakura returns a suggested fix. She has the source position, the message, the suggested `did-you-mean`, and the corpus of past fixes.
- **`(propose-atom '<idea>)`** — Sakura drafts a new atom (word for reasoning ladders) and slots it into the world-knowledge tree. Author reviews before commit.
- **`(macroexpand '<form>)`** — the same expansion the interpreter does before evaluation. Available programmatically, not just via `,expand`.
- **Reader-time customization** — `#lang sakura-scheme` at the top of a file lets you extend the reader (custom literals for units, dates, etc.). Ships opt-in.

### Solving every Scheme pain point people have complained about for forty years

- **Parens are hard to read.** → Structural editing + syntax highlighting + rainbow paren coloring + auto-close.
- **No IDE support.** → LSP shipping in v1.0 (`sakura-scheme lsp`). Plugins for VS Code, Cursor, Vim, Emacs. Format-on-save, hover-for-help, go-to-definition, find-references, live diagnostics.
- **Small stdlib.** → Batteries included: string, list, hash, JSON, HTTP fetch, file I/O, regex, time, date, path, url, math, stats, testing, logging, event-emitter, environment. All in `base/`. Every one has a doc page.
- **Fragmented ecosystem.** → There is one Sakura Scheme. R7RS subset for the core; extensions clearly marked as ours.
- **Macros make debugging hard.** → `,expand` + `,expand-1` + source-map through macro expansion, so errors point at the original source, not the expanded form.
- **No modules.** → Modules from day one (feature #7 above).
- **Terrible error messages.** → Rich error records (feature #8) + `did-you-mean` suggestions + `sakura/fix` for hard cases.
- **Slow.** → V8-fast interpreter + optional TCE + WASM bundle for browser use. Not the fastest Scheme ever, but fast enough that it isn't a reason to choose against.
- **Hard to install.** → One-line installers for Mac and Linux. See "Install" below.

### Install — one line, works on Mac and Linux

- **macOS**: `brew install lacuna-labs/tap/sakura-scheme` (from our Homebrew tap)
- **Linux (any distro)**: `curl -fsSL sakura-scheme.lacunalabs.ai/install.sh | sh` — downloads a single-binary Node.js bundle to `~/.local/bin`
- **npm (Mac/Linux/Windows)**: `npm i -g sakura-scheme`
- **From source**: `git clone` + `npm install` + `npm link`

Post-install, `sakura-scheme --version` prints the version and the interpreter's git sha. `sakura-scheme repl` drops you into an interactive session. `sakura-scheme --tour` runs a five-minute guided intro that shows every super feature above (tab-complete, `,help`, `,ask sakura`, an autogen example, an install-a-package example).

### "The next Python" checklist

Python didn't win because it was the best language. It won because it was **immediately usable**, **generously documented**, and **friendly**. Sakura Scheme's v1.0 has to hit every one of these:

- ✅ **Hello in one line** — `sakura-scheme -e '(display "hi")'` prints `hi`. `sakura-scheme repl` → `(display "hi")` → `hi`.
- ✅ **Batteries included** — the stdlib matrix above.
- ✅ **Docs that explain, not just describe** — every verb has three tiered examples (novice, intermediate, expert), a source-link, and a run-in-browser button in the doc site.
- ✅ **REPL that isn't hostile** — inline help, tab-complete, error messages that suggest fixes.
- ✅ **Community-friendly** — CONTRIBUTING.md, MIT license, CODE_OF_CONDUCT, RFC process for changes.
- ✅ **Ecosystem** — package system for verb layers (`sakura-scheme install lacuna/net-tools`), auto-managed via the same trigger system that regenerates docs.
- ✅ **AI is a peer** — every REPL, every editor, every session has `(sakura/…)` verbs available. AI isn't retrofitted; it's built in.

That is what "the next Python" means for us. Not the language people are told to learn — the language they find themselves reaching for because it treats them, and their AI collaborators, like adults.

## Git triggers for keeping the Book, verb catalogs, and doc site in sync

Every step above has to survive weekly drift. The trigger system from Chapter 4 of THE-PLAN handles it. Concrete wiring:

**In `sakura-scheme/` (the language repo):**

```yaml
# sakura-scheme/.lacuna/triggers.yaml
- id: book-chapter-changed
  subscribes: docs/**/*.md
  runs: ./scripts/rebuild-book-toc.sh {{path}}
  layer: [git, watch, ci]
  outputs: [docs/.vitepress/sidebar.mts]
  on-failure: block-commit

- id: base-primitive-added
  subscribes: src/base.js
  runs: ./scripts/regen-book-base-section.sh
  layer: [ci]
  outputs: [docs/book/base.md]

- id: promoted-verb-added
  subscribes: src/promoted-verbs/**
  runs: ./scripts/regen-book-promoted-section.sh
  layer: [ci]
  outputs: [docs/book/promoted-verbs.md, CHANGELOG.md]

- id: slat-format-changed
  subscribes: src/slat.js
  runs: ./scripts/regen-slat-doc.sh
  layer: [ci]
  outputs: [docs/slat/SPEC.md, bindings/python/tests/vectors.slat]
  on-failure: block-commit
```

**In each consumer repo (`curator/`, `lacuna/`, etc.):**

```yaml
# curator/.lacuna/triggers.yaml
- id: curator-verb-added
  subscribes: curator-web/src/scheme/curator-verbs/**/*.js
  runs: sakura-scheme docs regen --consumer curator --verb {{atom}}
  layer: [git, watch, ci]
  outputs:
    - curator/docs/curator-verbs/{{namespace}}/{{atom}}.md
    - curator/docs/CURATOR-VERBS.md    # regenerated index
  on-failure: block-commit

- id: curator-verb-promoted
  subscribes: curator-web/src/scheme/curator-verbs/**/*.js
  runs: sakura-scheme check-promotion --verb {{atom}}
  layer: [ci]
  outputs: []
  # Advisory only; if a verb qualifies for promotion, opens a PR against sakura-scheme.
```

**Cross-repo integration:** the doc site build reads the Book from `sakura-scheme/` AND every consumer's `docs/*-VERBS.md` files, produces a unified site. Weekly cron rebuilds and deploys. Any consumer verb whose doc is stale (mtime lags source) gets a badge on the site: "Doc out of date — regen with `sakura-scheme docs regen --verb <atom>`."

## Chapter 3 amendment to THE-PLAN.md — authorized

Update `~/code/lacuna-docs/engineering/THE-PLAN.md` Chapter 3 to reflect what's been clarified today:

1. **Rename "dialects" to "verb layers"** — one language, two verb layers. Not two dialects. Grep for "dialect" in the chapter; rewrite each occurrence to "verb layer" or delete if not meaningful. This resolves the ambiguity flagged during the initial plan read.
2. **Confirm the language is JavaScript** — Node.js runtime, ES modules, matches Curator's stack. Add this to the "What lives in the engine repo" table if it isn't already explicit.
3. **Add the multi-language interop section** — mirror the sidecar architecture above. Python and Rust live host-side, called via slat over sockets, never embedded.
4. **Add "real language" positioning** — a short subsection under §3.7 (name question) titled "Real language, not private DSL" with the 4-5 line summary of npm + license + CONTRIBUTING + docs site + community-friendly design.
5. **Update §3.5 corpus extraction** — no logic change, but note that `sakura-corpus/` sits alongside `sakura-scheme/` in the family (both `sakura-*`).
6. **Add cross-ref to slat spec** — where §3 discusses REPL machinery and type introspection, add a link to `~/code/lacuna-docs/scheme/slat/SPEC.md` since the reader is shared.

The amendment worker will make this one edit + regenerate the docs-team CHANGELOG entry: "2026-07-09 · Ch3 amended: verb-layer terminology, JS confirmed, sidecar interop, real-language positioning."

---

## Critical files (for the executing worker)

**Read-only inputs:**
- `curator-web/src/scheme/{reader,interp,base,macro}.js` (source)
- `curator-web/src/scheme/runtime/{verbRegistry,dispatch}.js` (source)
- `curator-web/src/scheme/index.js` (rewiring pattern)
- `curator/docs/SAKURA-SCHEME-1.0-*.md` (docs to move)
- `~/code/lacuna-docs/engineering/THE-PLAN.md` Chapter 3 (extraction protocol)
- `~/code/lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md` Part III (worker spine — for verb-layer contract)
- `~/code/lacuna-docs/scheme/slat/` (slat spec being authored — reuse the reader)

**New files created:**
- `~/code/sakura-scheme/**` — the new repo
- `~/code/curator/curator-web/package.json` — adds the dep
- `~/code/lacuna/package.json` — adds the dep + starter verb layer

**Existing files that will move:**
- `curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md` → `sakura-scheme/docs/REFERENCE.md`
- `curator/docs/SAKURA-SCHEME-1.0-ENGINEERING.md` → `sakura-scheme/docs/ENGINEERING.md`
- `curator/docs/SAKURA-SCHEME-1.0-STYLE-GUIDE.md` → `sakura-scheme/docs/STYLE-GUIDE.md`
- `curator/docs/SAKURA-SCHEME-TUTORIAL.html` → `sakura-scheme/docs/TUTORIAL.html`
- `curator/docs/SCHEME-RUNTIME-TRUTH-*.md` → `sakura-scheme/docs/`
- `curator/docs/SCHEME-ERROR-TAXONOMY-*.md` → `sakura-scheme/docs/`

**Files that stay in Curator (verb layer):**
- All 50+ `curator-web/src/scheme/*Verbs.js` files
- `primitives/`, `sprites/`, `audio/`, `time/`, `runtime/verbBackings.js`, etc.
- `carts/` (10,762 files)
- All 237 test files that specifically test Curator verbs

---

## Not in scope

- Rewriting the interpreter in Rust or TypeScript. Alfred was explicit: **keep JavaScript.**
- Converting Baobab off Steel or Caliper off its bespoke TS Scheme. Both are different domains and stay.
- Rewriting cart syntax or adding language features. Extraction only; feature evolution is separate.
- Publishing `sakura-scheme` to public npm. It's private for now; Alfred decides later.
- CI/CD deploy pipeline for `sakura-scheme`. Phase 3 of THE-PLAN handles GitHub setup for every repo, this one included.

---

## Follow-ups after this plan lands

1. Draft a small worker to implement the extraction procedure end-to-end.
2. After extraction: draft Lacuna's initial verb layer (small — `sys/reboot`, `sys/status`, `net/probe`, `docker/deploy` — 8-12 verbs).
3. After Lacuna verb layer: wire trigger system so any consumer adding a verb regenerates its doc pages automatically.
4. After doc regen: publish the doc site to GitHub Pages (Phase 3 of THE-PLAN).
