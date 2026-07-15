---
slug: sakura-scheme-book-design-2026-07-10
title: Sakura Scheme Book — Design + Palette + Living Tutorial
category: engineering
canonical: true
owner: docs-team (Jess)
status: active
last-reviewed: 2026-07-10
---

# The Sakura Scheme Book — design spec

Alfred (2026-07-10 ~03:00): *"I want the scheme guide to use the new interpreter. Make it THE BEST book. MD first and translate. Take me through the language features. Use the same colors and work as the Sakura for HelloSurface."*

## Palette — this book only

- **Background:** white
- **Top band:** darker purple
- **Center accents:** mint
- **Secondary purple:** softer / lighter — subheadings, callouts, quote borders
- **Sakura pink** — reserved for HER alone in this book. When Sakura speaks in a callout, when her name appears as an author of a code example, when she's the narrator of a section, it's pink. Everything else is purple + mint + white + ink. **Do not use pink for decoration.**
- **Ink:** warm plum (`#1A1626`), never pure black

Colors resolve to the canvas palette tokens where possible:
- background = `--canvas-cream` or `#FFFFFF` if cream is too warm
- top band darker purple = `--magic` (`#2e2167`) at 100% or a hero variant
- center mint = a new `--canvas-mint` derived from Ditoo shell mint pastel
- pink = `--sakura-pink` (`#E7A4B4`) — Sakura-only

## Living tutorial requirement

**Every code block runs.** The Book uses the new sakura-scheme interpreter — either via a WASM bundle embedded in the page, or via a REPL server the page calls into. Reader clicks Run on any example, sees the output inline.

Fallback: if the runtime isn't available, code block gets a "Run" button that grays out with tooltip *"REPL unavailable in this context — read-only."*

## MD first, then translated

- Author every chapter in Markdown at `sakura-scheme/docs/book/<NN>-chapter.md`
- HTML build reads the MD, applies palette + Sakura decorations, embeds the runtime, emits static files under `sakura-scheme/site/`
- HelloSurface DID elements: cherry-blossom-dusted page edges, falling-petal transition between chapters, Flux-generated Sakura-style intro art on Part covers

## Book arc — take the reader through the language

1. **Hello, Sakura Scheme** — install, first REPL session, hello world.
2. **Values** — numbers, strings, symbols, chars, booleans, nil.
3. **Forms** — `define`, `let`, `lambda`, `cond`, `if`, `when`, `case`, `begin`, `quote`, `quasiquote`, `unquote`.
4. **Lists** — cons, car, cdr, map, filter, fold. Every classic worked out live.
5. **Recursion + tail calls** — the trampoline, the fuel budget.
6. **Records + types** — `define-record`, `type-of`, `describe`.
7. **Macros** — `syntax-rules` + `define-macro`. `,expand` at the REPL.
8. **Pattern matching** — `match` with destructuring.
9. **Async + streams** — `await`, lazy sequences.
10. **Errors** — rich error records, `guard`, `did-you-mean`.
11. **Modules** — `module`, `import`, verb layers.
12. **The REPL** — meta-commands, `,help`, `,ask sakura`, `,inspect`, `,trace`, `,save`, `,load`.
13. **Slat** — the language's serialization format.
14. **Autogen** — `sakura/complete`, `sakura/rewrite`, `sakura/explain`.

Two appendices:
- **A. Solved Scheme pain points** — parens, IDE, stdlib, macros, errors.
- **B. A wife's tutorial** — a beginner-friendly Scheme-only slice, no verb layer, no product context. Just: variables, lists, recursion, small games.

## Chrome + decoration

- Cover page: Flux-generated Sakura in her Curator persona reading a book, purple + mint gradient background, one small pink flower in her hair.
- Part title pages (every 4 chapters): a Flux-generated Ghibli-inflected illustration of a garden scene, the Sakura tree center, mint grass, purple sky.
- Edges of every page: subtle dusted pink petals along outer margin, low-opacity.
- Between chapters: a small falling-petal animation on scroll (CSS keyframes only, no JS libs, opt-out via `prefers-reduced-motion`).
- Callouts:
  - `> **Sakura says**` — pink callout with tri-tone-bar to left, first-person voice
  - `> **Warning**` — mint border, plum ink
  - `> **Tip**` — top-purple border, plum ink
  - `> **Under the hood**` — darker purple background, mint text — for interpreter internals

## Voice

Warm-competent, first-person from Sakura where she narrates. Third-person when explaining the language. Never says "the reader" — always "you." No emoji. No banned words (leverages, empowers, seamless, robust, simply run, etc). Every claim runs.

## Build pipeline

1. `sakura-scheme/scripts/build-book.sh` — reads `docs/book/*.md`, applies decoration layer, produces HTML at `sakura-scheme/site/book/`
2. VitePress or custom static gen (Jess decides — MD-first is the hard rule)
3. Deploy target: `lacunalabs.ai/scheme/book/` (Alfred's call on the exact path)

## Companion engineering books

The same design + build pipeline renders the other 8 canonical engineering docs:
- HELLO-SURFACE-1.0-ENGINEERING
- LOAM-1.0-ENGINEERING
- SAKURA-SCHEME-1.0-ENGINEERING
- SAKURA-SCHEME-1.0-REFERENCE (once the 410 KB split lands)
- SAKURA-AUTOMATIONS-1.0
- SAKURA-TRAINING-MANUAL-1.0-ENGINEERING
- LACUNA-INTEGRATION-1.0-ENGINEERING
- LACUNA-TELEMETRY-1.0-ENGINEERING
- FORGE-1.0-ENGINEERING (this doc gets rendered too — includes tonight's canvas + arch changes)

Palette same for all engineering docs. Sakura-pink still reserved for HER.

Related: [[reference-lacuna-engineering-named-team]] (Jess owns this), [[the-plan]] Chapter 3 §Real language positioning, [[forge-panels-categories-2026-07-10]] (canvas + arch capture).
