---
slug: code-separation
title: Code separation — the three-layer stack
category: spec
kind: policy
version: 1.0.0
canonical: true
owner: docs-team
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 3
---

# Code separation

## Purpose

The dependency-arrow discipline that keeps Curator, Lacuna, and the shared Sakura Scheme engine from tangling. *If they share parts of an engine, they share the engine.* No partial reach-in. No `../curator/scheme/...` imports from Lacuna. Ever.

## Scope

**In:** the three-layer stack (Core engine / Verb layer / App); what lives in the engine repo; what does not; verb-layer conventions; versioning and breaking-change protocol.

**Out:** the specific Rust/Python idioms of any particular verb layer; the specific commands each verb takes (see the verb-layer docs in each project).

## Definitions

- **Core** — `sakura-scheme` engine. Reader, evaluator, primitives, REPL, type introspection. One binary, one linkable library.
- **Verb layer** — the product-specific extension surface: `world/spawn`, `card/open`, `sys/reboot`, `net/probe`. Each product's verbs stay in that product's repo.
- **App** — the user-facing product on top of a verb layer. Curator, Lacuna.
- **Additive change** — a change that does not break any existing caller.
- **Breaking change** — a change that renames, removes, or alters observable semantics of an existing primitive.

## Normative content

### 1. The three-layer stack

```
                       ┌────────────────────────────┐
                       │   CORE  (shared engine)    │
                       │  reader · evaluator ·      │
                       │  primitives · REPL ·       │
                       │  type introspection        │
                       └────────────┬───────────────┘
                                    │  depends on (versioned)
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌────────────────────────┐      ┌────────────────────────┐
        │  CURATOR VERB LAYER    │      │  LACUNA VERB LAYER     │
        │  world/spawn           │      │  sys/reboot            │
        │  card/open             │      │  net/probe             │
        │  flower/mood           │      │  docker/deploy         │
        │  shop/list-items …     │      │  deploy/rollout …      │
        └───────────┬────────────┘      └───────────┬────────────┘
                    │                                │
                    ▼                                ▼
        ┌────────────────────────┐      ┌────────────────────────┐
        │       CURATOR APP      │      │       LACUNA APP       │
        │  UI · Cortex · shop    │      │  SRE brain · fleet     │
        │  ops · Sakura persona  │      │  control · alerting    │
        └────────────────────────┘      └────────────────────────┘
```

### 2. Dependency arrows

- Curator App → Curator Verb Layer → Core. **No arrow to Lacuna.**
- Lacuna App → Lacuna Verb Layer → Core. **No arrow to Curator.**
- Core → nothing. It has no upward knowledge of either verb layer or either app.
- Verb layers → each other: **forbidden.**

Enforced by (a) repo boundaries — three separate repos, (b) build tooling — each app's dep graph forbids the other's namespace, (c) CI — a PR that adds a cross-product import fails.

**Test of the rule.** `rm -rf ~/code/lacuna/` on a machine that has Curator checked out — Curator still builds and runs. Same test in reverse. If either fails, cross-reach has crept in.

### 3. What lives in the engine repo

Repo: `~/code/sakura-scheme/`. Binary: `sakura-scheme`. Crate: `sakura-scheme`.

Reader, tokenizer, evaluator, core forms (`define`, `let`, `lambda`, `if`, `cond`, `and`, `or`, `set!`, `quote`, `syntax-rules`, `define-macro`), primitive types (number/string/symbol/char/bool/pair/vector/hash/procedure/record/null/void), arithmetic, list/string/hash ops, error model (`error`, `raise`, `guard`), REPL machinery, type introspection API (`type-of`, `describe`, `arity-of`, `doc-of`, `source-of`), dispatch hook (`register-primitive!`), versioning (SemVer runtime constant `(engine-version)`), build artifacts (binary + linkable library).

Core does **NOT** contain: any verb whose name starts with a product-owned namespace; any I/O beyond REPL and source-file reading; any network/DB/OS-shell primitive; any Curator or Lacuna symbol, string, path, or config.

### 4. What does NOT live in the engine repo

**Curator verb layer — stays in Curator:** `world/*`, `card/*`, `flower/*`, `camera/*`, `shop/*`, `automation/*`, `cortex/*`, `sprite/*`, `background/*`, `voice/*`, `sight/*`, `sound/*`, `speech/*`, `hearing/*`, `blossom/*`.

**Lacuna verb layer — stays in Lacuna:** `sys/*`, `net/*`, `docker/*`, `deploy/*`, `alert/*`, `ticket/*`, `fleet/*`, `hal/*`, `loam/*`, `run/*`.

**The line, restated.** If the verb's meaning changes when you swap the product, it's a verb-layer symbol. If the verb's meaning is the same in any Scheme program in any product forever (like `car` or `+`), it's Core.

### 5. Versioning + breaking-change protocol

SemVer, Scheme-shaped.

| Bump | Meaning | Verb-layer impact |
|---|---|---|
| **Patch** (`1.4.2 → 1.4.3`) | Bug fixes, perf, docs. Observable behavior unchanged. | None. |
| **Minor** (`1.4.x → 1.5.0`) | Additive. New forms, primitives, API surface. Existing programs still run. | None required. |
| **Major** (`1.x.y → 2.0.0`) | Breaking. Removed or renamed forms, changed semantics, changed contracts. | Coordinated bump required. |

**Breaking = any of:** removing/renaming a form, primitive, or FFI symbol; changing arity or type contract; changing evaluation order observably; changing error record shape; changing the type-introspection wire format; changing REPL meta-command grammar non-additively.

**Additive default.** When in doubt, add, don't change. Nicer version of an existing primitive → add `foo/v2` alongside `foo`, deprecate `foo` in docs; `foo` continues to work for at least one major version.

**Both-apps handling.**

- Patch — engine ships; both apps update pins at leisure.
- Minor — engine ships with changelog; each app updates at its own pace.
- Major — PR against the engine repo with every breaking change and its migration. Merge only when both apps have a migration plan. Each app has a two-week window to migrate.

**Fork trigger.** If real drift emerges over 6-12 months and coordination becomes painful, fork the engine rather than trying to keep one engine serving two divergent needs.

**Changelog.** `~/code/sakura-scheme/CHANGELOG.md` — one section per version. Each app's README names its supported engine version range.

## Non-normative examples

See [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 3 for narrative and rationale, including the extraction sequence (§3.6) and the naming discussion (§3.7).

## Compatibility and versioning

The spec itself is versioned separately from the engine. Additive to the spec — new verb-layer conventions, new banned patterns — bumps minor. Removing or reversing a rule bumps major.

## See also

- [`./directory-schema.md`](./directory-schema.md) — where each layer lives.
- [`./enforcement-ladder.md`](./enforcement-ladder.md) — how the boundary is enforced.
- [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 3 — narrative parent.
