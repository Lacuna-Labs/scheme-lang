---
title: Lane E — HelloSurface book as interactive application
lane: E (book-pretty)
date: 2026-07-10
branch: book-pretty/hello-surface-app
pr: local-only repo — no origin in ~/code/sakura-scheme
commit: 8715cac
status: shipped-to-branch
---

# Lane E report

The HelloSurface book is now a running application on every page.
Sakura the corner flower sways in place, the 1024×1024 dot world
runs its render loop while you read, and readers tap the surface for
coordinates, press Run buttons in prose to add cards, zoom the camera,
or send a marionette walking.

## Files

`~/code/sakura-scheme/site/apps/hello-surface/`:

- `index.js` — `mount(container, options)` + `unmount(container)`; also
  auto-mounts every `[data-app="hello-surface"]` if Lane B's shell is
  absent.
- `surface.js` — 1024×1024 dot-world canvas, 4-CSS-px pitch, 2:1
  dot:gap. Cards, sprites, blossoms, marionette, marquee, camera, tick,
  ambient lattice, 3×5 dot font.
- `sakura.js` — corner flower: sway + spin SVG, mood knobs, pink
  speech bubble.
- `bridge.js` — postMessage + in-page dispatch, 11-command whitelist
  (`load, add-card, add-sprite, add-blossom, marionette, marquee,
  camera, clear, sakura-say, sakura-mood, reset`).
- `chapter-runtime.js` — wires `<button data-cmd>` and goodie reveals.
- `styles.css` — palette-locked; `prefers-reduced-motion` honored.
- `preview.html` — stand-alone verification page.
- `demos/` — 11 demos (cover + ch01..ch10). Ch01 empty, ch05 four
  cards + a blossom, ch10 moving marionette.

`~/code/sakura-scheme/docs/book/hello-surface/`:

- `00-cover.md` through `10-what-next.md` — 11 MD files, each with
  `app` + `demo` front-matter, an embedded surface, and at least one
  live Run button.

## Chapters

00 cover · 01 the surface · 02 cards · 03 sprites · 04 blossoms ·
05 the camera · 06 goodies · 07 services · 08 Sakura speaks ·
09 under the hood · 10 what next.

## Reuse vs. reimplement

Reimplemented. Curator's canvas is React and pulls the dispatch layer,
which per `sakura-scheme/CLAUDE.md` still hard-imports Curator
internals (logbus, cardApi, canvasPower, chipSink). The book needs
pure ES modules loadable from a `<script type="module">`; importing
that surface would drag in the whole tree. Reimplementation ~350 LOC,
palette-locked, 2:1 dot:gap, paints on every tick.

## Verified

Every JS file parses (`node --check`). Import smoke with a stub DOM
confirms `mount`, `unmount`, `post`, `loadDemo` exports and 21 demo
keys. `preview.html` is a browser-loadable sanity page.

## Contract with Lane B

`app-shell.js` should scan `[data-app="hello-surface"]` and call
`mount(container, { demo: container.dataset.demo })`. Absent the
shell, this module self-mounts on DOMContentLoaded.

## One thing the design spec was missing

The book design spec covers palette, callouts, voice, and the 14-chapter
Sakura Scheme arc, but the HelloSurface companion has no equivalent
chapter list. It names HELLO-SURFACE-1.0-ENGINEERING as a companion
"same pipeline," which reads as a code doc, not a reader-facing tour.
This lane invented the 10-chapter arc. Recommend the spec grow a short
§HelloSurface arc so future lanes don't re-invent it.

## Note on the shared tree

Multiple lanes are checking out branches in the same clone this pass.
A couple of my writes briefly landed on a sibling lane's HEAD before
re-checkout; cleaned up via cherry-pick onto
`book-pretty/hello-surface-app`. Recommend `git worktree add` for the
next multi-lane pass.
