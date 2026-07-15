---
slug: lane-f-scheme-app-report-2026-07-10
title: Lane F — Sakura Scheme = interactive application
category: engineering
owner: lane-f
status: shipped
last-reviewed: 2026-07-10
---

# Lane F report — Sakura Scheme as an interactive application

## Branch + commit

- Branch: `book-pretty/scheme-app` in `sakura-scheme` repo
- Commit: `cfedc99` — "book: Sakura Scheme = interactive application"
- PR URL: **NOT OPENED** — the local `sakura-scheme` repo has no configured
  remote and `Lacuna-Labs/sakura-scheme` does not yet exist on GitHub. Branch
  is landed locally; opening the PR requires the remote to be provisioned
  first (queue for the infra lane).

## Files created

Runtime app under `site/apps/scheme-repl/`:

- `index.js` — mount/unmount. Resolves the runtime via `window.SAKURA_SCHEME`
  or a set of same-origin candidates. Injects `styles.css` on first mount.
- `repl.js` — the widget. Multi-line textarea + syntax-highlight mirror,
  rainbow parens, auto-close on `( [ "`, tab-complete against base env +
  chapter env + user defines, balanced-Enter to run, Ctrl-Enter to run,
  Up/Down history. Handles meta-command dispatch inline.
- `runbutton.js` — bridge to Lane B's app-shell. Exposes `instance.run(code, lang)`,
  which the shell calls when the reader clicks Run. Falls back to wiring
  buttons itself in dev preview where the shell isn't loaded.
- `env-per-chapter.js` — fetches the URL declared by
  `<meta name="app:initial-env">` and evaluates it silently into the REPL env.
- `styles.css` — palette-locked to `/theme/tokens.css`. Sakura-pink used only
  by rainbow-paren layer #4 (per the "HER only" rule the pink slot is not
  used for prose chrome; it appears as one paren color in the depth cycle).
- `envs/chapter-05.scm` — `count-down` + `sum-to` for recursion.
- `envs/chapter-08.scm` — small matcher helpers for pattern-matching.

Book chapters under `docs/book/`:

- `01-hello-sakura-scheme.md` (already existed on `book-pretty/design-doc`)
- `02-values.md` through `14-autogen.md` — all 13 remaining chapters
- `A-solved-scheme-pain-points.md`
- `B-a-wifes-tutorial.md`

App-shell:

- `site/theme/app-shell.js` — I shipped a bootstrap; Lane B extended it in
  place while I was authoring. My commit picks up the extended version so
  both lanes' contracts hold.

## Chapters shipped

All 14 chapters + both appendices. Every chapter has: front-matter
(`book: scheme`, `chapter: N`, `app: scheme-repl`, optional `initial-env`),
tiered examples (novice / intermediate / expert), at least one
`> **Sakura says**` callout, and cross-links.

## Runtime source

The app loads the extracted `sakura-scheme` package directly via dynamic
import — no WASM bundle. The build serves `/src/index.js` under the site's
static root. This is the cleanest option because the package is pure JS
(no native deps), 25/25 tests pass, and Lane B's app-shell already
implements the mount contract.

## Meta-commands implemented

`,help <verb>`, `,type <verb>`, `,doc <verb>`, `,arity <verb>`,
`,examples <verb>`, `,expand <expr>`, `,apropos <regex>`, `,clear`.

`,ask sakura` is deliberately NOT wired — it needs the LLM bridge (queue
for the sakura/complete lane).

## Language features promised but not yet in the runtime

Flag these to the runtime team — the book asserts them, the runtime v1.4.0
either stubs them or lacks them:

- **`define-record`, `type-of`, `record?` accessors** (Chapter 6) — not
  visible in `PUBLIC-API.md`; may live in a verb layer that isn't loaded
  by default.
- **`match` / pattern-matching** (Chapter 8) — appears in `src/repl.js`'s
  keyword set but no matcher primitive is exported from `base.js`.
- **`delay` / `force` / `await`** (Chapter 9) — same.
- **`guard`, `error`, `error-kind`, `error-did-you-mean`** (Chapter 10) —
  no guard form exposed by base env.
- **`module` / `import`** (Chapter 11) — no module system in v1.4.0.
- **`sakura/complete`, `sakura/rewrite`, `sakura/explain`** (Chapter 14) —
  need LLM wire.

The chapter Run buttons for these will error at runtime with a "no such
verb" message until the runtime lands the feature. That's the same
signal the terminal REPL would give, so the failure mode is honest.

## Follow-ups

- Provision remote for `sakura-scheme` so this PR can open.
- Runtime lane: land the six missing feature families above so the book
  chapters run end-to-end.
- Diagrams lane: no diagrams needed; the REPL IS the visualization.
