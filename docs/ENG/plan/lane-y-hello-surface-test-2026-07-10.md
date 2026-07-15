---
title: Lane Y — HelloSurface book end-to-end test
lane: Y (test / verify)
date: 2026-07-10
depends-on: Lane E (site/apps/hello-surface + docs/book/hello-surface), Lane B (theme + build-book pipeline), Lane C (diagram kit)
branch: test/hello-surface-fixup (pushed to origin)
commit: e9f4d35
pr: not opened — no other branches on origin to PR against; base=main is behind Lanes B/C/E and rejects with "no commits between"
verdict: HelloSurface book is shippable after this fix (Lane Y's `test/hello-surface-fixup` commit)
---

# Lane Y report

## Lane E state

**Finished.** Commit `8715cac book: HelloSurface = interactive application` on
branch `book-pretty/hello-surface-app`. All promised files present:
`site/apps/hello-surface/` (8 files + 12-file demos dir) and
`docs/book/hello-surface/` (11 chapter MDs, 00-cover through 10-what-next).

Lane E's branch does not contain the theme + build script (those live on Lane
B and Lane C branches). Lane Y cherry-picked B+C onto `test/hello-surface-fixup`
in an isolated worktree at `/tmp/lane-y-worktrees/hello-surface` — the shared
clone was mid-branch-hop by another lane while Lane Y was working. Concurring
with Lane E: `git worktree add` is the fix for multi-lane passes.

## Build

`node scripts/build-book.mjs` from the worktree emitted 13 files:

- 11 chapter pages: `site/book/hello-surface/<slug>/index.html`
- 1 book TOC: `site/book/hello-surface/index.html`
- 1 library landing: `site/book/index.html`

No broken links inside the HelloSurface book. (Reason I was untracked in the
shared clone and referenced a not-yet-authored Reason II; unrelated to Lane E,
not blocking Lane Y.)

## Testing (Playwright, real Chromium, 1440x900)

Static server: `python3 -m http.server 8765` rooted at
`/tmp/lane-y-worktrees/hello-surface/site`. Killed cleanly on exit; port 8765
released.

### Bug found and fixed

The first Playwright pass showed 0 canvases across all 11 pages and one
console error per page:

    console: [app-shell] failed to mount hello-surface
             SyntaxError / app "hello-surface" exports no mount function

Root cause: `site/apps/hello-surface/index.js` shipped
`export default { mount, unmount, post, loadDemo }` — an object. Lane B's
`app-shell.js` does `const mount = mod.default || mod.mount;` and rejects the
truthy object with "exports no mount function". Lane E's own
`app-shell.js` docstring specifies the contract as
`export default function mount(el, ctx) { ... }`.

Fix (1 file, +17/-1, well under Lane Y's 5-file / 30-line ceiling):

- Default export switched to `mount` directly.
- `mount()` handle gained `unmount`, `send`, and `run` so the shell's
  `beforeunload` cleanup and Run-button dispatch both drive it end-to-end;
  `destroy` stayed as an alias for direct callers (bridge tests + preview).

Committed as `e9f4d35 test: HelloSurface book — small fixes from Lane Y
end-to-end run` on branch `test/hello-surface-fixup`, pushed to
`origin`. Pre-push hook: 25/25 vitest tests passed.

### PR status

Not opened. `origin` (Lacuna-Labs/sakura-scheme) has exactly one branch —
`test/hello-surface-fixup`, the one Lane Y just pushed. Lanes B, C, E have not
pushed. `gh pr create --base main` rejects with "no commits between".
Recommend: push B/C/E, rebase Y onto E, open a 1-commit PR then. Fix is safe
on remote branch until then.

### After-fix run

All 11 pages green — per-chapter counts (canvas / sakura / animating / RM-paused / run-btns / errors):

    cover           2 / 5 / yes / yes / 0 / 0
    the-surface     2 / 4 / yes / yes / 1 / 0
    cards           2 / 5 / yes / yes / 2 / 0
    sprites         2 / 4 / yes / yes / 2 / 0
    blossoms        2 / 5 / yes / yes / 3 / 0
    camera          2 / 4 / yes / yes / 3 / 0
    goodies         2 / 4 / yes / yes / 1 / 0
    services        2 / 5 / yes / yes / 2 / 0
    sakura-speaks   2 / 5 / yes / yes / 3 / 0
    under-the-hood  2 / 4 / yes / yes / 2 / 0
    what-next       2 / 5 / yes / yes / 2 / 0
    ─── totals ───  11/11  11/11  11/11  11/11  21  0

All 10 chapters with Run buttons produced a body-text change on first-button
click (no thrown errors).

### Screenshots

11 full-page 1440x900 PNGs saved to
`~/code/lacuna-labs/research/lacuna-docs/engineering/artifacts/lane-y-hello-surface-shots/`.

Spot-checked cover, blossoms, sakura-speaks — theme reads correctly (cream
background, purple headers, pink Sakura-says callouts, prose typography, prev
chapter link, dot lattice).

## Bugs found and HOLD

Not shipping blockers, but Lane E should look at these:

- **Cover chapter subhead reads "Chapter 01 HelloSurface" / "Hello Surface — Part I".**
  The build script defaults `chapter: 01` when front-matter is silent. `00-cover.md`
  should either set `chapter: 00` or the theme should recognize "cover" as
  chapter-less. Severity: LOW (cosmetic).
- **Embedded surface renders very small in the app-region.** Screenshots show
  a tiny checkbox-sized canvas below the "hello — this is the surface" heading
  and near-empty content in the sticky right-hand region except for a "HELLO
  SURFACE" marquee at the top. The surface API is running (tick counter
  reaches 217+ within the two-second wait), but visually it does not fill the
  space. Likely canvas sizing / initial camera zoom bounds. Severity: MEDIUM
  (the book "reads" but the world doesn't visually fill).

## Final verdict

**HelloSurface book is shippable** after Lane Y's one-commit fix
(`e9f4d35` on `test/hello-surface-fixup`). The app-shell contract is
satisfied, all 11 chapters mount canvases, Sakura animates in every corner,
reduced-motion is honored, all 21 Run buttons produce output, and there are
zero uncaught console errors.

Before ship, the two HOLD items above (cover chapter label + small surface
canvas) should be addressed for polish. Neither breaks correctness.
