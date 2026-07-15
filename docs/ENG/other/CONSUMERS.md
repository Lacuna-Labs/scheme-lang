# Consumers

Every downstream that pins Sakura Scheme, and the range they pin.

| Consumer | Path | Version pinned | Verb layer | Status |
|---|---|---|---|---|
| Curator | ~/code/curator/curator-web | ^1.4.0 | curator-verbs/ (~148k LOC) | active |
| Lacuna | ~/code/lacuna/lacuna-src | ^1.4.0 | lacuna-verbs/ (small; growing) | active |
| Gastronomy Graph | ~/code/gastronomy-graph | ^1.4.0 (reader-only) | none — parses .scm as data | active |
| Forge | ~/code/forge | (optional) | none — parses .sks at ingest | optional |
| Baobab | — | — | uses Steel (Rust) | separate ecosystem |
| Caliper | — | — | own 15-primitive TS impl | separate ecosystem |

## Subscriber rules

- Consumers pin a SemVer range in their manifest.
- Consumers may **not** push directly to `sakura-scheme/main`.
- Consumers propose changes via PR — reviewed as a language change, not a product change.
- Patch bumps: consumers auto-update. Minor: consumers update at leisure. Major: coordinated migration with two-week window.

## Promotion

A verb that turns out dialect-neutral (both consumers want it, same signature, same semantics) is promoted UP into the base library on a minor version bump. Same mechanism that made `filter` and `map` core, not Curator-specific.

Promotion checklist:

- Verb has no product-specific behavior in its impl (no `curator.state`, no DOM reach, no Cortex call).
- Two consumers signal they want it.
- A migration note lives in `CHANGELOG.md` explaining what moved and when.
