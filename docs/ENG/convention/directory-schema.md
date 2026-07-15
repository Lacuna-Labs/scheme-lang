---
slug: directory-schema
title: Directory schema
category: spec
kind: schema
version: 1.0.0
canonical: true
owner: docs-team
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 2 §2.7
---

# Directory schema

## Purpose

The whitelist of what is allowed at the top level of `~/code/`. Cleanup that isn't defended drifts back in a week — this spec is the defended shape.

## Scope

**In:** the file `directory-schema.yml`; enforcement mechanism (`tree-check.sh`); where and when the check runs.

**Out:** per-project directory shapes (see [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 2 §2.4); archive discipline (see the same chapter §2.6).

## Definitions

- **Core project** — a Tier A repo. Ships product code.
- **Shared infrastructure** — a Tier B repo. Docs, scripts, hooks, corpus.
- **Reserved** — a name held for a future project. May exist as a placeholder or not at all.
- **Hidden** — a directory whose name begins with `.` at `~/code/` root. Only three are allowed.

## Normative content

### 1. The schema file

Single source of truth: [`../engineering/directory-schema.yml`](../engineering/directory-schema.yml). Shape:

```yaml
version: 1
hidden: [.archive, .claude, .remember]
core_projects: [baobab, caliper, cortex, curator, forge, gastronomy-graph, lacuna, loam, meridian]
shared_infrastructure: [lacuna-docs, lacuna-labs, lacuna-git-hooks, sakura-corpus]
reserved: [sakura-scheme]
files_allowed_at_root: []
```

### 2. Rules

1. Every visible directory at `~/code/` MUST appear in `core_projects` OR `shared_infrastructure` OR `reserved`.
2. Every hidden directory at `~/code/` MUST appear in `hidden`.
3. Files at `~/code/` root: none, ever. `files_allowed_at_root: []` is enforced.
4. Any change to `directory-schema.yml` requires an entry in [`../canon/CHANGELOG.md`](../canon/CHANGELOG.md).

### 3. The check

`lacuna-docs/engineering/tools/tree-check.sh` reads the schema, lists `~/code/`, flags anything not in the union.

| Exit code | Meaning |
|---|---|
| 0 | Clean. All entries in the schema. |
| 1 | Unexpected entry. Non-schema directory or file at root. |
| 2 | Schema malformed. YAML invalid or missing required keys. |

### 4. Where the check runs

Both git hook AND CI — not either-or.

- **Local hook.** Fast feedback; catches drift before push.
- **CI.** The guarantee; no `--no-verify` bypass.
- **Weekly cron.** On Alfred's workstation; runs `tree-check.sh` against live `~/code/` and dumps results to `.remember/`. Catches `mkdir ~/code/foo` drift outside any repo's git flow.

## Non-normative examples

- Adding a new core project — patch: add its name to `core_projects`, add a `canon/CHANGELOG.md` line, ship.
- Removing a project — patch: move the entry into a tombstone under `.archive/`, remove from `core_projects`, add a CHANGELOG line.
- Renaming — same as removing then adding, in one commit.

## Compatibility and versioning

- **Additive:** adding a new entry to any list.
- **Breaking:** removing an entry (requires archival first), renaming a list, changing the meaning of a list.

The schema's own `version:` field bumps on breaking changes to the file's shape (not on adding/removing individual entries).

## See also

- [`../engineering/directory-schema.yml`](../engineering/directory-schema.yml) — the machine-readable file.
- [`../engineering/directory-layout.md`](../engineering/directory-layout.md) — the human-readable tour.
- [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) Chapter 2 — narrative parent.
- [`./enforcement-ladder.md`](./enforcement-ladder.md) — where this check sits on the ladder.
