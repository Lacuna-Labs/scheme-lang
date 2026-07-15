---
slug: lane-aj-donts-reference-report-2026-07-10
title: Lane AJ — Book of Don'ts + Reference (Challenges) authoring report
category: engineering
canonical: true
owner: docs-team (Lane AJ)
status: complete
last-reviewed: 2026-07-10
---

# Lane AJ — Book of Don'ts + Reference appendix — authoring report

**Branch:** `book/donts-reference`
**PR:** https://github.com/Lacuna-Labs/sakura-scheme/pull/22
**Worktree:** `/tmp/lane-aj-donts-reference` (isolated from `~/code/sakura-scheme`)

## Deliverable

12 files created — 2 directories × 6 chapters each.

### Book of Don'ts (`docs/book/donts/`)
Defensive book. Refusal as a safety move, not a mood.

| File | Words | Programs |
|---|---:|---:|
| `00-cover.md` | 794 | 0 |
| `01-what-refusal-is-for.md` | 1,256 | 7 |
| `02-hard-lines.md` | 1,663 | 8 |
| `03-soft-lines-with-check-in.md` | 1,670 | 9 |
| `04-what-to-do-instead.md` | 1,635 | 8 |
| `05-honesty-when-refusing.md` | 1,855 | 10 |

**Chapters cover:** two-lane framing (safety vs cost); refusal record + classifier; hard-line table (CSAM / targeted-harm / mass-casualty) as intrinsic-not-imposed lookup; confirm-not-refuse pattern with one pop-up / two doors + change-gated proposals (per `project_automation_consent_and_shop_verbs_2026_07_06`); exact/approx/none alt shapes with anti-fabrication guard; six named honesty anti-patterns (vague-sorry, fake-inability, moral-lecture, over-hedged, echo-the-ask, apology-flourish).

### Reference / Challenges appendix (`docs/book/reference/`)
SICP-style CS-guts cookbook. Sits at end of `SAKURA-SCHEME-1.0-REFERENCE.md`.

| File | Words | Programs |
|---:|---:|---:|
| `00-cover.md` | 799 | 0 |
| `01-conway.md` | 2,035 | 8 |
| `02-sorting-viz.md` | 2,132 | 8 |
| `03-tail-recursion.md` | 1,548 | 10 |
| `04-macros.md` | 1,573 | 9 |
| `05-sicp-flavor.md` | 2,408 | 8 |

**Chapters cover:** Conway's Life (grid, neighbors, step, blinker/glider/toad); sorting visualized (bubble/insertion/quicksort with trace layer + dot-matrix rendering + compare counting); tail recursion (accumulator pattern, named `let`, fib/sum/tree-sum with explicit stack); macros (`when`/`unless`/`swap!`/`for-range`/`and*` + hygiene); tiny metacircular evaluator (literals, `if`, `define`, `lambda`, closure, application, hello-world).

## Program count validation

- Every content chapter (10 chapters) clears the >=6 full standalone runnable Scheme program threshold.
- Cover chapters intentionally carry 0 programs (framing only).
- Don'ts: 42 programs across content chapters.
- Reference: 43 programs across content chapters.
- Total: 85 runnable programs authored.

## Voice discipline

- Warm, brief chorus voice. No chunky paragraphs.
- Show-don't-tell — prose sets up the situation, code carries the disposition.
- Callouts: `> **Sakura says**` (pink, first-person), `> **Warning**`, `> **Tip**`, `> **Under the hood**`.
- No emoji. No banned words (`leverages`, `empowers`, `seamless`, `robust`, `simply run`).
- Every fenced Scheme block runs standalone — no fragments, no invisible prior state.

## Guardrails observed

- Worktree isolated to `/tmp/lane-aj-donts-reference`; never touched `~/.forge/runs/`.
- Branch pushed only to `origin/book/donts-reference`; never touched `main`.
- No `--force`, no `--no-verify`.
- Pre-push hook ran vitest (25 tests passed, 4 files).
- Subject-line hook caught first commit's 76-char subject; retried at 41 chars.

## PR URL

https://github.com/Lacuna-Labs/sakura-scheme/pull/22
