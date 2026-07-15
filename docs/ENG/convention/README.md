<p align="left">
  <img src="../docs/images/mark.svg" alt="Lacuna Labs — tri-tone bar" width="400">
</p>

# Specs

*Normative, versioned interface, protocol, format, and schema definitions across Lacuna projects.*

Specs answer **what a thing IS** — a wire format, a message shape, a schema, a protocol contract, an enforcement rule. They are versioned, have a slug, name their owner, and change under compatibility discipline.

Plans and runbooks live in [`../engineering/`](../engineering/). Voice and visual live in [`../brand/`](../brand/). Locked decisions live in [`../canon/`](../canon/). **Specs live here** — and in each project's own `<project>/specs/` when the spec is owned by that project.

## Table of contents

- [Rules of the spec](#rules-of-the-spec)
- [Cross-project canonical specs](#cross-project-canonical-specs)
- [Per-project specs](#per-project-specs)
- [How to extract a spec from a plan](#how-to-extract-a-spec-from-a-plan)
- [Versioning](#versioning)
- [See also](#see-also)

---

## Rules of the spec

A spec is not a design doc. A spec is not a runbook. A spec is not a wiki page. Every spec doc obeys the same shape.

**Frontmatter — mandatory:**

```yaml
---
slug: <kebab-unique>
title: <sentence case>
category: spec
kind: format | protocol | schema | interface | policy
version: 1.0.0
canonical: true
owner: <lane or docs-team>
status: draft | active | deprecated
last-reviewed: YYYY-MM-DD
supersedes: <optional prior slug>
extracted-from: <plan file + section, when applicable>
---
```

**Body — seven sections in order:**

1. **Purpose** — one paragraph, what this spec is for.
2. **Scope** — what it covers, what it does not.
3. **Definitions** — key terms.
4. **Normative content** — the actual spec (grammar, protocol, schema, rules).
5. **Non-normative examples** — realistic uses.
6. **Compatibility and versioning** — what constitutes a breaking change and how the spec evolves.
7. **See also** — links to related specs, engineering docs, and code.

**Extraction rule.** When a spec is extracted from a plan (e.g., [`THE-PLAN.md`](../engineering/THE-PLAN.md) or [`THE-BIG-FORGE-PLAN.md`](../engineering/THE-BIG-FORGE-PLAN.md)), the parent doc keeps its section but adds a callout link:

> See [`specs/<slug>.md`](../specs/<slug>.md) for the normative version of this section.

The plan is the narrative. The spec is the source of truth for the interface.

**Linking rule.** If a canonical spec already lives elsewhere (e.g., `curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md`), the project's `specs/` entry is a short stub with frontmatter, one-paragraph purpose, and a link to the existing full spec. Do not duplicate content. Link, don't copy.

---

## Cross-project canonical specs

Specs that span more than one project or govern the shared substrate. Owned here.

| Spec | Kind | Version | Status | One-line |
|---|---|---|---|---|
| [Slat format](./slat-format.md) | format | 1.0.0 | draft | Canonical structured-log line format. |
| [Worker protocol](./worker-protocol.md) | protocol | 1.0.0 | draft | Message shapes, lifecycle, and supervisor tree for the Lacuna worker fleet. |
| [Trigger system](./trigger-system.md) | interface | 1.0.0 | draft | Event grammar and handler registry across git-hooks, watcher, and CI. |
| [Directory schema](./directory-schema.md) | schema | 1.0.0 | draft | Whitelist for `~/code/` top level. |
| [Code separation](./code-separation.md) | policy | 1.0.0 | draft | The three-layer stack: core engine, verb layer, app. |
| [Enforcement ladder](./enforcement-ladder.md) | policy | 1.0.0 | draft | Editor → pre-commit → pre-push → CI → PR gate. |

---

## Per-project specs

Each project maintains its own `specs/` directory. Cross-project references are welcome; duplication is not.

### [forge/specs/](../../forge/specs/)

- Insights panel v2, ML controls, optimizer state persistence, worker interface, trigger registry usage.

### [curator/specs/](../../curator/specs/)

- Sakura Scheme reference (link), book canon ledger (link), world-knowledge atom spec (link), resident-scheme ledger (link), voice persona canon (link), flower personalities (link), card system (link).

### [lacuna/specs/](../../lacuna/specs/)

- SRE brain, worker foreman.

### [meridian/specs/](../../meridian/specs/)

- Telemetry schema, probe registry, alert routing.

### [sakura-corpus/specs/](../../sakura-corpus/specs/)

- Corpus schema, family taxonomy, held-out policy.

### [caliper/specs/](../../caliper/specs/)

- Eval harness.

### [baobab/specs/](../../baobab/specs/)

- Identity (BIP39 + Nostr), wallet schema.

### [gastronomy-graph/specs/](../../gastronomy-graph/specs/)

- Graph schema.

### [cortex/specs/](../../cortex/specs/)

- Persona graph schema, ambient context, write-time pre-materialization.

### [loam/specs/](../../loam/specs/)

- Plane health.

---

## How to extract a spec from a plan

Plans (long, narrative, chapter-shaped) mix engineering rationale with interface definition. Specs are the interface, stripped clean.

1. Read the plan chapter.
2. Identify the normative content — the grammar, the schema, the exact message shape, the enforcement rule. Everything a caller or implementer needs.
3. Move that content into a spec under the right owner (`lacuna-docs/specs/` for cross-project; `<project>/specs/` for project-owned).
4. Add a callout back to the plan: `See [specs/<slug>.md](../specs/<slug>.md) for the normative version.`
5. Do not remove the plan section. The plan holds the narrative; the spec holds the interface.

## Versioning

Specs follow SemVer within their `kind`.

- **Patch** — clarifications, examples, editorial. No implementation change required.
- **Minor** — additive. New fields, new event types, new subsections. Existing implementations keep working.
- **Major** — breaking. Removed fields, changed semantics, changed contracts. Requires migration notes and coordination.

Every spec change bumps the version in frontmatter, updates `last-reviewed`, and — for a canon-shaping spec — adds a line to [`../canon/CHANGELOG.md`](../canon/CHANGELOG.md).

---

## See also

- [`../engineering/THE-PLAN.md`](../engineering/THE-PLAN.md) — master plan, the source many specs extract from.
- [`../engineering/THE-BIG-FORGE-PLAN.md`](../engineering/THE-BIG-FORGE-PLAN.md) — Forge v2 plan.
- [`../engineering/specs-extraction-progress.md`](../engineering/specs-extraction-progress.md) — extraction bookkeeping.
- [`../brand/repo-template.md`](../brand/repo-template.md) — the README template every project inherits.
- [`../canon/CHANGELOG.md`](../canon/CHANGELOG.md) — dated log of canon-shaping changes.
