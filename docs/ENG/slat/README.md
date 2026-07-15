<p align="left">
  <img src="./docs/images/mark.svg" alt="Lacuna Labs — tri-tone bar" width="400">
</p>

# lacuna-docs

*The canonical documentation home for Lacuna Engineering.*

If a document describes how the company builds, ships, runs, or reasons about its work — and that document is meant to outlive any single project — it lives here.

## Table of contents

- [Who this is for](#who-this-is-for)
- [Project index](#project-index)
- [What belongs here (vs. per-project)](#what-belongs-here-vs-per-project)
- [The Plan](#the-plan)
- [How to navigate](#how-to-navigate)
- [The walk-in test](#the-walk-in-test)
- [Visual identity](#visual-identity)
- [Contributing](#contributing)
- [What is not here](#what-is-not-here)

---

## Who this is for

Two audiences, one repo:

1. Engineers joining a project, switching between projects, or trying to remember how a shared system works.
2. Agents walking into `~/code/` cold and needing to know where to work and where to put things.

Both audiences share the same failure mode: guessing where a doc lives, creating a duplicate in the wrong place, and fragmenting the ground truth. This repo exists to eliminate that.

---

## Project index

Every repo Lacuna Labs ships, one row each. Canonical-docs links resolve into this repo; mark files are the hero image on the corresponding README.

| Repo | One-liner | Mark | Canonical docs |
|---|---|---|---|
| [`curator`](../curator/) | Sakura's app — the operator-facing shop-ops surface | Sakura lockup | [`brand/`](./brand/), [`scheme/`](./scheme/) |
| [`sakura-corpus`](../sakura-corpus/) | Training data for Sakura — one repo, one canonical location | Sakura mark | [`engineering/THE-PLAN.md`](./engineering/THE-PLAN.md) §3.5 |
| [`lacuna`](../lacuna/) | Resident operator daemon for a single-user POSIX host | Lacuna mark | [`ops/`](./ops/), [`security/`](./security/) |
| [`forge`](../forge/) | Textual TUI for training and operating small open-weight LLMs | Tri-tone bar | [`engineering/THE-BIG-FORGE-PLAN.md`](./engineering/THE-BIG-FORGE-PLAN.md) |
| [`caliper`](../caliper/) | One number, 0-1000, that says how good a web build actually is | Tri-tone bar | [`engineering/`](./engineering/) |
| [`baobab`](../baobab/) | News, markets, and community for the Black diaspora | Tri-tone bar | [`engineering/`](./engineering/) |
| [`gastronomy-graph`](../gastronomy-graph/) | Google for food — content aggregator plus service layer | Tri-tone bar | [`engineering/`](./engineering/) |
| [`lacuna-git-hooks`](../lacuna-git-hooks/) | Shared git hook set every Lacuna repo installs | Tri-tone bar | [`brand/git-hooks-spec.md`](./brand/git-hooks-spec.md) |
| [`lacuna-docs`](.) | This repo — canon, engineering docs, brand, ops | Tri-tone bar | — |

Which mark goes on which repo is codified in [`brand/visual-identity.md`](./brand/visual-identity.md#which-mark-goes-on-which-repo).

---

## What belongs here (vs. per-project)

| Belongs in `lacuna-docs/` | Belongs in `<project>/docs/` |
|---|---|
| Company-wide policies, standards, canon | Design docs for one project's features |
| Cross-project engineering practices | LLM-generated scratch, planning, RFCs for a single app |
| Directory layout, onboarding, ops runbooks | Per-project READMEs, per-feature specs |
| Brand, security, canon (Sakura persona, Book canon, etc.) | Anything that dies with the project |

**Rule of thumb:** if you delete the project tomorrow, does this doc still matter? Yes → `lacuna-docs/`. No → `<project>/docs/`.

---

## The Plan

**[engineering/THE-PLAN.md](./engineering/THE-PLAN.md)** is the canonical planning document for `~/code/` — the manifesto, the target directory architecture, the code separation strategy, the trigger system, the conventions, and the execution runbook. Read it end-to-end before touching anything under `~/code/`. Phase 1 progress lives at [`engineering/phase-1-progress.md`](./engineering/phase-1-progress.md).

## How to navigate

Top-level categories, each with its own README:

- **[engineering/](./engineering/)** — how we build. Directory layout, repo conventions, tooling, code review, git hooks. Home of [`THE-PLAN.md`](./engineering/THE-PLAN.md) and [`directory-layout.md`](./engineering/directory-layout.md). **Start here** if you're new.
- **[scheme/](./scheme/)** — Sakura Scheme language canon: reference manual, book canon, verb ladders, training taxonomy.
- **[security/](./security/)** — secrets policy, threat model, prod access, incident response.
- **[onboarding/](./onboarding/)** — first-day and first-week checklists for anyone new to the tree.
- **[ops/](./ops/)** — runbooks, on-call, deploy procedures, cost policy (Max-only, no API keys), fleet control.
- **[brand/](./brand/)** — voice, visual identity, Sakura persona canon, repo README templates. Includes [`visual-identity.md`](./brand/visual-identity.md), [`repo-template.md`](./brand/repo-template.md), [`git-hooks-spec.md`](./brand/git-hooks-spec.md), and the SVG marks in [`brand/assets/`](./brand/assets/).
- **[canon/](./canon/)** — locked decisions that shape everything else: 16-book canon, corner-flower-is-Sakura, Mac-Studio-is-dev-only, etc. See [`canon/CHANGELOG.md`](./canon/CHANGELOG.md) for dated entries.

---

## The walk-in test

An engineer or LLM instance new to the codebase should find where to work in **under 60 seconds**:

1. Open `~/code/lacuna-docs/README.md` (this file). **10s**
2. Read `engineering/directory-layout.md`. **40s**
3. Land in the right project directory and start. **10s**

If any doc in this repo takes longer than that path to reach, we've failed. File an issue and move it.

---

## Visual identity

Every Lacuna repo's README opens with a Hero mark drawn from [`brand/assets/`](./brand/assets/). Which mark, which palette, and which typography go where is codified in [`brand/visual-identity.md`](./brand/visual-identity.md); the README shape itself is in [`brand/repo-template.md`](./brand/repo-template.md).

Two families ship side by side. **Lacuna** — monochrome tri-tone bar, Geist Mono wordmark, no chromatic claim on the parent tool. **Sakura** — five-petal bloom with V-notch, two-register wordmark (Fraunces "The" + Inter "Curator"), warm cream paper. Subdomain accents (Engineering cyan, Research purple) surface only on that subdomain's own metadata.

---

## Contributing

- Prefer **short, dense, load-bearing** docs. If a section is prose padding, delete it.
- Every category README stays under **200 words**. Detail lives in the files it links to.
- Company canon changes (things that would break other docs) get a one-line entry in `canon/CHANGELOG.md` with a date.
- If you find a doc in the wrong place, don't delete it — leave a **stub pointer** at the old path and move the content. See `engineering/directory-layout.md` §5.

---

## What is **not** here

- **Code.** No source, no configs, no scripts.
- **Training data.** Lives in `sakura-corpus/` (to be extracted).
- **Training runs / checkpoints.** Live in `~/.forge/runs/` (out of git).
- **Secrets.** Never here, never anywhere in `~/code/`.
- **Per-project design scratch.** Lives in `<project>/docs/`.
