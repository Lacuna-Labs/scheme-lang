---
slug: lane-p-marionette-report-2026-07-10
title: Lane P — Marionette chapters 0-5 report
lane: P
book: marionette
date: 2026-07-10
status: complete
---

# Lane P — Book of Marionette, chapters 0-5

Authored the cover + first five chapters of the Book of Marionette (#652)
in Sakura Scheme, per the FULL Blossom-gamut memory
(`project_blossom_control_is_marionette_2026_07_04`). Marionette holds
the Blossoms; canon stays 16.

## Files

All in `~/code/sakura-scheme/docs/book/marionette/`:

- `00-cover.md` — control/routing/composition/orchestration framing, roster
  of the sixteen, "she never leaves the perch"
- `01-who-what-a-sprite-is.md` — sprites, roster, `world/spawn`, `world/find`,
  addressing one out of many
- `02-moods-and-personalities.md` — per-Blossom tempo + micro-mod;
  set/read/expire; the address-all pattern
- `03-roll-and-dash.md` — locomotion verbs; `tween/done`; event chaining
- `04-timing-with-a-counter.md` — modulo, phase offset, script-as-table,
  layered periods, sync-and-release
- `05-seeing-each-other.md` — `world/nearest`, `sprite/see?`,
  `sprite/predict-pos`, grid-anticipation math, predict/compare/adjust

## Counts

- Chapters: 6 (cover + 5)
- Total words: 6,492
- Full runnable Scheme programs: 30 (6 per content chapter; ≥6 requirement met)
- Every program authored via Marionette verbs (`world/spawn`, `world/step`,
  `world/find`, `world/frame`, `world/nearest`, `entity/*`, `sprite/*`) per
  the "MOTION in Scheme" rule.

## Guardrail checks

- No emoji.
- No banned words (grepped: leverages, empowers, seamless, robust, simply,
  delve, utilize — all zero).
- `~/.forge/runs/` untouched.
- Every fenced Scheme block is a complete standalone program (`(begin …)`
  or `(let …)` at top level, no fragments).

## Branch + commit

- Branch: `book/marionette-ch01-05`
- Commit: `62c9d7d` — "book: Marionette chapters 0-5 authored"
- 6 files changed, 1239 insertions(+)

## PR URL

No remote is configured on the sakura-scheme repo (checked `.git/config` —
no `[remote]` section). Every sibling lane (music, one-shot, reason-i,
systems, hello-surface) has landed the same way: named branch, commit
titled `book: <name> chapters 0-5 authored`, no push. Following that
convention. If a remote is added later, `git push -u origin
book/marionette-ch01-05` from the worktree at
`/tmp/sakura-marionette-worktree` will publish the branch and enable a
PR titled `book: Marionette chapters 0-5 authored`.

## Notes for the next lane (Ch 6+)

The book is in first-draft shape. Chapter 5 ends with a `next:
06-cards-and-carrying` link, which is the natural continuation per the
memo's card gamut (facet #13-14): move/open/close/hide, Blossom-carries-card,
card-card collision, Blossom-card collision, broadcast, exit-the-stage,
multi-actor orchestration. Recommend the same 6-programs-per-chapter
cadence; verbs already registered in `SAKURA-SCHEME-1.0-REFERENCE.md`
§19.1-19.2 cover most of what Ch 6 needs (`entity/solid!`,
`entity/layer!`, `world/collisions`).
