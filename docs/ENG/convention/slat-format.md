---
slug: slat-format
title: Slat format
category: spec
kind: format
version: 1.0.0
canonical: true
owner: docs-team
status: draft
last-reviewed: 2026-07-09
---

# Slat format

## Purpose

Slat is the canonical line-oriented format used across Lacuna projects for structured logging, worker mailboxes, and any place where a stream of typed records needs to be both human-readable and machine-parseable. This document is a **stub pointing at the canonical spec pack**.

## Scope

The Slat format itself is authored as its own spec pack under [`../scheme/slat/`](../scheme/slat/). That location holds the full grammar, reader/writer semantics, round-trip guarantees, encoding rules, and worked examples.

## Definitions

See the canonical spec.

## Normative content

**The canonical Slat specification lives at [`../scheme/slat/SPEC.md`](../scheme/slat/SPEC.md).** That document is the source of truth for the format. This file is an index entry so cross-project readers can find Slat from the specs index without needing to know it lives under `scheme/slat/` in the docs tree.

## Non-normative examples

See the worked examples inside [`../scheme/slat/`](../scheme/slat/).

## Compatibility and versioning

Governed by the canonical spec. Version-bumps land there and are announced via a line in [`../canon/CHANGELOG.md`](../canon/CHANGELOG.md).

## See also

- [`../scheme/slat/SPEC.md`](../scheme/slat/SPEC.md) — the normative Slat specification.
- [Worker protocol](./worker-protocol.md) — one Slat consumer; worker mailboxes use it.
- [`../engineering/THE-BIG-FORGE-PLAN.md`](../engineering/THE-BIG-FORGE-PLAN.md) Part III — narrative context for structured messaging.
