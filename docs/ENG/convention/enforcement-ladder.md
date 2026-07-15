---
slug: enforcement-ladder
title: Enforcement ladder
category: spec
kind: policy
version: 1.0.0
canonical: true
owner: docs-team
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 5 §5.9-5.11
---

# Enforcement ladder

## Purpose

Same rule fires at multiple layers, each with different cost-to-developer. This spec locks the ladder — five layers, one design principle, one exception protocol.

## Scope

**In:** the five layers; the layer-choice principle; retired cowboy behaviors that no longer get past the ladder; the exception protocol.

**Out:** the specific rules any given repo runs (each repo declares those in its `.lacuna/triggers.yaml`); the concrete configurations of `ruff`, `eslint`, `prettier`, etc.

## Definitions

- **Layer** — a stage at which a rule can fire (editor, pre-commit, pre-push, CI, PR gate).
- **Cost-to-developer** — the wall-clock time between the developer's action and the rule's response.
- **Exception** — a conscious deviation from a rule that would otherwise apply. Has a paper trail.
- **Hotfix** — an incident-procedure commit. **Not** an exception.

## Normative content

### 1. The five layers

| # | Layer | Cost | Examples |
|---|---|---|---|
| 1 | **Editor** | 0 ms | Format-on-save, live lint squiggles, type errors in the gutter. `.editorconfig` + language-server plugins + `prettier`/`ruff` on save. |
| 2 | **Pre-commit** | ~500 ms | Large files, secrets, staged-file format check. See [`../brand/git-hooks-spec.md`](../brand/git-hooks-spec.md) §1.1. Any commit that trips this cannot enter history. |
| 3 | **Pre-push** | ~30 s | `test:fast` only. Catches regressions before they leave the machine. |
| 4 | **CI** | ~5 min | Full formatter, full linter, full type-check, full test suite, all trigger handlers, security scans, doc generation, deploy previews. Nothing merges to `main` unless CI is green. |
| 5 | **PR gate** | manual | Required-check enforcement + CODEOWNERS approval + branch protection. The wall. |

### 2. Design principle

A rule that fires only in CI has failed 80% of its job. By the time CI catches it, the developer has already context-switched. **Work backwards:**

1. Can it fire in the editor? If yes, ship an editor config change.
2. If no, can it fire at pre-commit? If yes, put it in the hook.
3. Only if neither, put it in CI.

Same rule, four chances to catch it. We invest in the earlier layers because that investment pays back on every commit forever.

### 3. What happens when a layer fails

| Layer | Behavior |
|---|---|
| Editor | Squiggle, fix, keep typing. |
| Pre-commit | Refused with an actionable message. |
| Pre-push | Refused; developer runs `test:fast` locally. |
| CI | Check red; push a fix. |
| PR gate | Merge disabled. |

### 4. Retired cowboy behaviors

The ladder retires these behaviors. Each is enforced by a specific check.

| Behavior | Retired by |
|---|---|
| Direct pushes to `main` | Branch protection + required CODEOWNERS approval + required checks. Configured via `.github/settings.yml`. **No exceptions**, not for the owner, not for his wife, not for LLM instances. |
| `--no-verify` outside the incident procedure | Post-merge scan for the `Hook-bypass:` trailer. Missing incident ID auto-opens an issue. |
| Config drift between repos | Shared configs live in `lacuna-docs/engineering/` and are `extend`-referenced. Repo-lint checks. |
| Untracked "temporary" directories (`_scratch/`, `_tmp/`, `wip/`, `old/`, `foo/`, `.bak`, `-copy`, `-v2`, `-real-final`) | Pre-commit rejects staged paths matching these patterns. Legitimate scratch areas need a name, a `KILL_BY` date, and a `.lacuna/triggers.yaml` registration. |
| Cross-project imports by relative path | Language-specific enforcement in `verify.yml`. |
| LLM-generated docs in the wrong place | `lacuna-docs` pre-commit refuses any file added without frontmatter, without a slug, or with a duplicate slug. |
| Orphaned config | Repo-lint grep-verifies every top-level `.<something>` file has at least one reference. |

### 5. The exception protocol

Rules have edges. The point of the protocol is that granting an exception leaves a paper trail — never quiet.

**What counts.** A `# type: ignore` in Python without a linked issue. A `// @ts-ignore` without a comment. A `# noqa` without a rule code. A `--no-verify` outside an incident. A relative-path import across projects. Any config override that widens a shared rule.

**The four steps.**

1. **Name it.** Same-line or immediately-above comment explaining the reason:
   ```
   # type: ignore[attr-defined]  # upstream lib has no stubs; tracked in #NNN
   ```
2. **Track it.** Every exception has a linked issue titled `[exception] <one-line-summary>`. Enumerates the rule bypassed, the reason, expected duration, retire-condition.
3. **Sweep it.** Docs-team runs a monthly grep for exception comments; produces a table of every exception, its age, issue link, retire-condition. Exceptions >90 days without an active retire plan escalate.
4. **Retire it.** Every exception has a death date. Either the underlying issue is fixed and the exception removed, or the exception is promoted to a documented rule change.

**Not an exception.**

- Hotfix commits (that's the incident procedure).
- Scripts that don't need tests (that's "scripts are scripts").
- Generated files that don't fit our formatter (that's `.gitattributes` `linguist-generated`).

The exception protocol is for conscious deviations from a rule that otherwise applies.

## Non-normative examples

See [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 5 §5.9–§5.11 for narrative and rationale.

## Compatibility and versioning

- **Additive:** new retired behaviors, new layers (unlikely).
- **Breaking:** removing a layer, reversing a retired-behavior policy.

## See also

- [`./trigger-system.md`](./trigger-system.md) — what runs at each layer.
- [`./directory-schema.md`](./directory-schema.md) — a rule enforced at the ladder.
- [`../brand/git-hooks-spec.md`](../brand/git-hooks-spec.md) — the four git hooks.
- [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 5 — narrative parent.
