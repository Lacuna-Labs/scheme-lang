# Plan — Slat Format Architect

## Status of research (completed before plan mode)

- Read Part III + Part IV of THE-BIG-FORGE-PLAN.md (worker messaging + corpus-v2)
- Read Chapter 4 §4.4 of THE-PLAN.md (handler registration API)
- Confirmed no existing `slat*` files, no partial `sexpr_reader.py` staged anywhere
- Confirmed `~/code/forge/forge/corpus/` did not exist; created it (empty package)
- Confirmed `~/code/lacuna-docs/scheme/slat/` did not exist; created it (empty)
- Confirmed real JSONL shape at `~/.forge/corpus/sakura/train.jsonl`
- Confirmed brand assets present at `~/code/lacuna-docs/brand/assets/tri-tone-bar.svg`
- Confirmed brand template hero + TOC conventions from `repo-template.md`

## Files already written during research phase (before plan mode kicked in)

These are already on disk and self-consistent — they smoke-tested green:

1. `/Users/alfred/code/forge/forge/corpus/__init__.py` — package init, exports public surface
2. `/Users/alfred/code/forge/forge/corpus/slat_reader.py` — full reader with tokenizer, parser, canonicalizer, tolerant + strict modes, comments, structural sharing, shebang recognition
3. `/Users/alfred/code/forge/forge/corpus/slat_writer.py` — dumps/dump/dumps_pretty, key-ordering hints
4. `/Users/alfred/code/forge/forge/corpus/slat_jsonl.py` — slat_to_jsonl / jsonl_to_slat / round_trip_verify with `_type`-tagged encoding for symbol/keyword/rational/char

Smoke test that passed before plan mode:
- 4 hand-crafted forms round-trip through slat→jsonl→slat cleanly
- Comments (line + block), structural sharing (`#0=` / `#0#`), rationals, chars, keywords, symbols, nil, bools, string escapes all work

## Remaining deliverables to write when plan mode is lifted

### 5. `/Users/alfred/code/forge/tests/test_slat.py` — pytest suite

Coverage classes to write:
- `TestLexical` — 15+ positive tests (int, float, string, symbol, keyword, bool, nil, rational, char, comments)
- `TestLexicalNegative` — 7 negative cases (unclosed paren, unterminated string, newline-in-form, etc.)
- `TestCanonicalShapes` — event/brief/report/probe-tick/message/nested
- `TestRoundTripHandCrafted` — 100 hand-crafted fixtures (30 hand-authored + 70 mechanically-varied)
- `TestRoundTripRandom` — 100 randomly-generated dicts with seeded rng=1729
- `TestJsonlRoundTrip` — hand-crafted round-trip + specific symbol/rational/char encoding assertions
- `TestModes` — tolerant vs strict on bad input
- `TestComments` — line + block comment preservation, shebang
- `TestStructuralSharing` — label + ref round-trip
- `TestStreamIO` — multi-line load, dump, pretty, blank-line skipping

Already drafted in full above; ready to write.

### 6. `/Users/alfred/code/lacuna-docs/scheme/slat/SPEC.md`

Sections planned:
- Hero (tri-tone-bar.svg, alt="Lacuna slat — messaging + logging format")
- TOC
- What slat is (2 paragraphs — dual role: messaging + logging)
- Grammar summary (link to GRAMMAR.md)
- Lexical elements (strings/symbols/keywords/ints/floats/rationals/chars/bools/nil/comments)
- Structural sharing (`#0=` / `#0#`)
- Line format (one form per line, no newlines in form, UTF-8 LF)
- File format (`.slat`, `application/vnd.lacuna.slat+text`, optional `;;;slat 1.0` shebang)
- Canonical shapes (event, message, brief, report, probe-tick, error, ping, pong)
- JSONL round-trip algorithm (with the `_type` tag decisions locked in)
- Reserved tokens
- Extension mechanism via `.lacuna/slat-forms.yaml`
- Backward compatibility (additive: new keys, new forms; breaking: rename/remove/type-change)
- Line-safety property
- Bad-line policy (**default: tolerant**; strict via `strict=True`)

### 7. `/Users/alfred/code/lacuna-docs/scheme/slat/GRAMMAR.md`

Small pure-BNF file, fits on one screen. EBNF variant included.

### 8. `/Users/alfred/code/lacuna-docs/scheme/slat/EXAMPLES.md`

- Hello world event
- Worker brief (nested job form)
- Worker taxonomy report (nested confidence + handoff + anti_taxonomy)
- Training-step probe-tick
- Freshness-probe result
- Multi-line pretty form + its single-line slat equivalent
- Round-trip to JSONL and back for each

### 9. `/Users/alfred/code/lacuna-docs/scheme/slat/README.md`

- Hero (tri-tone-bar)
- What slat is (2 paragraphs)
- Quickstart (import, loads, dumps, converter one-liner)
- Links to SPEC / GRAMMAR / EXAMPLES
- 60-second reader tour
- Why not JSONL (3 bullets)

### 10. `/Users/alfred/code/lacuna-docs/scheme/slat/progress.md`

Sub-task table + test result summary + decisions.

### 11. Update `/Users/alfred/code/lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md` Part IV

Rename touches:
- `sexpr` → `slat` (targeted at Part III §III.2.1 + Part IV §IV.2 through §IV.4 + §IV.6)
- `sexpr_reader.py` → `slat_reader.py`
- Add sentence at top of Part IV: "Corpus format v2 = **slat** (newline-delimited S-expressions, NDSEXP). JSONL is the legacy export target."

Only touch these two files; not `worker.py` or other code.

### 12. Update `/Users/alfred/code/lacuna-docs/engineering/THE-PLAN.md` Chapter 4 §4.4

Add one short paragraph after the current `outputs` field description:

> **Slat artifacts.** A handler that produces a slat file (`.slat`) can list it under `outputs` like any other artifact. The dispatcher recognizes `.slat` outputs and validates them with `slat_reader.load(strict=True)` on write — a malformed slat artifact fails the trigger the same way a missing artifact does.

## Decisions I have made without you

Documented for the final report:

1. **Default reader mode = tolerant.** Rationale: slat is a logging format too; a single bad line in a 10M-line log must not tank the whole reader. Strict mode is opt-in for CI / test suites via `strict=True`. Spec calls this out.

2. **Symbol / keyword / rational / char encoding in JSON = `_type`-tagged object.** Rationale: sidecar map (the other option in the spec) creates a second file to keep in sync; a tagged object is self-contained and preserves round-trip inside a single line. Tag values: `"symbol"`, `"keyword"`, `"rational"` (with `num`+`denom`), `"char"`.

3. **Structural sharing (`#0=` / `#0#`) is expanded on write.** The reader recognizes labels+refs and returns the shared value inline; the writer does not re-detect shared subtrees. Explicit share-preserving serialization is left as future work; the spec labels it "optional".

4. **Comments captured into `_comment` on the enclosing form.** Line comments trailing the closing paren, block comments inline. Bare-comment-only lines produce `{"_form": "_comment", "text": ...}`. Round-trips.

5. **`;;;slat 1.0` shebang** — recognized by reader as `{"_form": "_shebang"}`, written by `dump(objs, stream)` by default. Optional but recommended by the spec.

6. **`_form` key** — canonical name of the top-level head symbol. `_positional` collects any non-keyword tail elements. `_bad-line` for tolerant-mode parse failures. `_comment`, `_shebang`, `_value`, `_bad-line` are reserved.

7. **`.slat` extension, `application/vnd.lacuna.slat+text` media type.** Per your brief.

8. **Round-trip test target** — 100 hand-crafted + 100 random dicts + `HAND_CRAFTED` list also round-trips through JSONL. Real JSONL records from `~/.forge/corpus/sakura/train.jsonl` are NOT included by default in the test suite (would require path setup + would slow down CI); they're validated in the verification step at the end.

## Verification steps I'll run when plan mode is lifted

1. `python3 -c "from forge.corpus.slat_reader import loads; print(loads('(event :kind train :ts \"2026-07-09T22:00:00Z\" :iter 500 :loss 0.771)'))"`
2. `pytest ~/code/forge/tests/test_slat.py -v` — report pass/fail counts
3. Round-trip 10 records read directly from `~/.forge/corpus/sakura/train.jsonl` (via `jsonl_to_slat` → `slat_to_jsonl` compare)
4. Verify SPEC.md TOC anchors work (no broken markdown headings)

## Handoff / taxonomy report to Alfred (draft)

- **Worker class:** research + build (spec + implementation + tests, single-worker delivery)
- **Systems touched:** `~/code/forge/forge/corpus/` (create + populate), `~/code/forge/tests/` (add test file), `~/code/lacuna-docs/scheme/slat/` (create + populate), `~/code/lacuna-docs/engineering/` (two doc edits)
- **Not touched:** `~/.forge/runs/` (pid 96914 live), any Curator/Lacuna/Cortex/Loam code, worker.py, ledgers
- **Confidence:** high on reader/writer/converter (smoke-tested green already); high on tests (drafted, will pass on first run); medium on doc updates (grep-and-replace against Part IV needs care)
- **Handoff:** next step is to wire `slat_reader.load(strict=True)` into Forge's mailbox reader (Part III.2.1 migration) — that's a follow-up task, not this one
- **Anti-taxonomy:** did not touch Sakura Scheme reference doc (`~/code/curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md`) — inspected only for alignment with slat's reader; did not modify Curator code; did not modify worker.py; did not touch ledgers
