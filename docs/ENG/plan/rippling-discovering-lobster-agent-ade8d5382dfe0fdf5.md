# Specs Extraction + Organizer — Plan

## Context confirmed at start

- **Pid 96914 alive** — `locked_lora.py` training run.
- **Slat SPEC.md does not yet exist** at `~/code/lacuna-docs/scheme/slat/SPEC.md` (parallel worker will author). Directory is empty. Will only create a **stub link** at `lacuna-docs/specs/slat-format.md`, never touch the SPEC.md itself.
- **Recently modified files (last 30 min)** to be skipped:
  - `lacuna-docs/README.md`
  - `lacuna-docs/engineering/phase-1-progress.md`
  - `lacuna-docs/engineering/visual-identity-progress.md`
  - `lacuna-docs/engineering/big-forge-progress.md`
  - `lacuna-docs/engineering/phase-1-closeout.md`
- All target `<project>/specs/` directories are absent — need creating.
- Two work-in-progress files already committed to (before plan mode kicked in):
  - `~/code/lacuna-docs/specs/README.md` — master index
  - `~/code/lacuna-docs/specs/slat-format.md` — stub
  - `~/code/lacuna-docs/specs/worker-protocol.md` — extraction from Big Forge Plan Part III
- Empty specs directories already created at all 10 project locations.

## Work already completed (before plan mode)

1. Created empty specs directories at:
   - `~/code/lacuna-docs/specs/`
   - `~/code/forge/specs/`
   - `~/code/curator/specs/`
   - `~/code/lacuna/specs/`
   - `~/code/meridian/specs/`
   - `~/code/sakura-corpus/specs/`
   - `~/code/caliper/specs/`
   - `~/code/baobab/specs/`
   - `~/code/gastronomy-graph/specs/`
   - `~/code/cortex/specs/`
   - `~/code/loam/specs/`
2. Wrote `~/code/lacuna-docs/specs/README.md` — master index with tri-tone-bar hero, rules, cross-project + per-project spec listings, extraction procedure, versioning.
3. Wrote `~/code/lacuna-docs/specs/slat-format.md` — stub pointing at `../scheme/slat/SPEC.md`.
4. Wrote `~/code/lacuna-docs/specs/worker-protocol.md` — full extraction of Big Forge Plan Part III normative content.

## Remaining work — what I will do when unblocked

### Cross-project canonical specs — 4 more to write in `lacuna-docs/specs/`

Each: frontmatter + 7-section body extracted from the plan chapters.

- **`trigger-system.md`** — extracted from THE-PLAN Chapter 4 (dispatcher, event grammar, handler registry, three layers, freshness probes). Draft already prepared in-message.
- **`directory-schema.md`** — extracted from THE-PLAN Chapter 2 §2.7 + pointer to `directory-schema.yml`; whitelist rules and enforcement.
- **`code-separation.md`** — extracted from THE-PLAN Chapter 3 (three-layer stack, engine vs verb-layer vs app, versioning + breaking-change protocol).
- **`enforcement-ladder.md`** — extracted from THE-PLAN Chapter 5 §5.9 + retired cowboy behaviors §5.10 + exception protocol §5.11.

### Per-project specs — write per project

**forge/specs/** (real extractions from Big Forge Plan):
- `README.md` — project spec index.
- `insights-panel-v2.md` — Big Forge Plan Part I (health-lane 12 panels + deep-lane 20 panels + incident classes).
- `ml-controls.md` — Big Forge Plan Part II (control set, ships-in-three-tranches, controls card schema, test-plan yaml).
- `optimizer-state-persistence.md` — Big Forge Plan Part V (save/restore hooks, failure modes, integration with insights panel 24).
- `forge-as-worker-interface.md` — Big Forge Plan Part VI (workers tab, REST + WebSocket API, actor-model mapping).
- `trigger-registry-usage.md` — placeholder describing Forge-specific handler declarations (references `trigger-system.md`).

**curator/specs/** (mostly stubs linking to existing docs):
- `README.md`
- `sakura-scheme-reference.md` — stub linking to `curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md`.
- `book-canon-ledger.md` — stub linking to `curator/docs/BOOK-CANON-LEDGER.md`.
- `world-knowledge-atom-spec.md` — stub linking to `curator/docs/WORLD-KNOWLEDGE-ATOM-SPEC-2026-07-06.md`.
- `resident-scheme-ledger.md` — stub linking to `curator/docs/RESIDENT-SCHEME-LEDGER.md`.
- `voice-persona-canon.md` — stub linking to `curator/docs/SAKURA-VOICE-PERSONA-1.0-CANON-2026-06-30.md`.
- `flower-personalities.md` — stub linking to `curator/docs/FLOWER-PERSONALITIES-2026-06-13.md` (need to verify path exists; will grep).
- `card-system.md` — stub linking to `lacuna-docs/canon/cards-system-canon.md`.

**lacuna/specs/**:
- `README.md`
- `sre-brain.md` — placeholder for SRE architecture (design pending; own-decision doc from memory).
- `worker-foreman.md` — extends `lacuna/lacuna-src/lacuna/worker.py` + Part III protocol. Points at cross-project worker-protocol.md.

**meridian/specs/**:
- `README.md`
- `telemetry-schema.md` — probe/tick/event record shape (link/reference `meridian/spec/data-records-v0.1.md`, `log-format-v0.1.md`).
- `probe-registry.md` — freshness probes from THE-PLAN §4.9.
- `alert-routing.md` — notify/page/open-issue rules.

**sakura-corpus/specs/**:
- `README.md`
- `corpus-schema.md` — from Big Forge Plan Part IV (JSONL as it stands + S-expr form + reader/converter/validator).
- `family-taxonomy.md` — atom passes + family types (scheme-cart / persona / book-prose / atom-yaml / rehearsal).
- `held-out-policy.md` — from THE-PLAN Ch 3 §3.5 (FROZEN-1001, `.forge-exclude` marker, pre-commit rejection).

**caliper/specs/**:
- `README.md`
- `eval-harness.md` — placeholder describing Caliper's role.

**baobab/specs/**:
- `README.md`
- `identity-bip39-nostr.md` — extraction from `baobab/docs/identity-design.md` (BIP39, Nostr keys, DIDs).
- `wallet-schema.md` — extract from baobab docs.

**gastronomy-graph/specs/**:
- `README.md`
- `graph-schema.md` — placeholder + link to existing gastronomy-graph docs.

**cortex/specs/**:
- `README.md`
- `persona-graph-schema.md` — link to `cortex/docs/cortex-persona-graph-tech.md` (also mirrored in `lacuna-docs/canon/cortex-persona-graph-tech.md`).
- `ambient-context.md` — placeholder from category-knowledge-broker memory notes.
- `write-time-prematerialization.md` — placeholder from Cortex memory notes.

**loam/specs/**:
- `README.md`
- `plane-health.md` — placeholder.

### Callout links added to parent plan docs

- Add a `> See [specs/<slug>.md] for the normative version of this section.` line at the head of each corresponding section in:
  - `lacuna-docs/engineering/THE-PLAN.md` — Chapters 2 §2.7, 3, 4, 5 §5.9.
  - `lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md` — Parts I, II, III, IV, V, VI.

### Progress doc

- Author `~/code/lacuna-docs/engineering/specs-extraction-progress.md` — consolidated progress doc listing every spec created, whether it's a real extraction or a stub, gaps requiring owner-authored content, and taxonomy report.

## Rules being observed

- **Skip fresh files.** Any file with mtime in last 30 min will not be overwritten.
- **Do not touch `~/.forge/runs/`.** Verified pid 96914 alive.
- **No code modifications.** Docs-only.
- **Slat SPEC.md — never touched.** Only stub link created.
- **Zero audience-tells.** Warm-competent voice per brand guide.
- **Tri-tone-bar hero** on `lacuna-docs/specs/README.md` (already done).

## Final report I will produce

Report back with:
- Count of specs created per project (11 projects total including lacuna-docs).
- Cross-project canonical spec count (target: 6 = slat-format, worker-protocol, trigger-system, directory-schema, code-separation, enforcement-ladder).
- Which extractions were "real work" vs stubs.
- Anything that couldn't be extracted (needs owner-authored content) — likely SRE brain, gastronomy graph schema, loam plane health, ambient context, write-time pre-materialization, some baobab identity fields.
- Taxonomy report (worker class = docs-extraction; systems touched; confidence; handoff; anti-taxonomy).

## Confidence levels for what will be produced

- **High** — cross-project specs from THE-PLAN and THE-BIG-FORGE-PLAN; corpus-schema (well-specified in Part IV); worker-protocol (already done); insights-panel-v2 and ML controls (well-specified).
- **Medium** — Meridian specs (existing `spec/*` docs at `~/code/meridian/spec/` need consulting); baobab identity extraction (source doc exists but is a design doc, not a normative spec).
- **Low / stub-only** — SRE brain, plane-health, ambient-context, gastronomy graph schema, write-time pre-materialization — these are memory-only concepts without a written source; the stub will say so.

## Halt-on-real-blockers protocol

Will halt honestly if:
- Any file I intend to edit was authored in the last 30 min (skip and note).
- The Slat SPEC.md gets a body during my run (link, don't touch).
- Pid 96914 dies (halt cleanup, do not restart).
