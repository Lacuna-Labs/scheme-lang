# Slat Build Progress

*Author: Slat Format Architect (single-worker delivery, 2026-07-09).*

## Sub-tasks

| # | Task                                            | Status  | Location                                                   |
|---|-------------------------------------------------|---------|------------------------------------------------------------|
| 1 | Create `forge/corpus/` package                  | done    | `~/code/forge/forge/corpus/__init__.py`                    |
| 2 | Implement reader (tokenizer + parser + canon)   | done    | `~/code/forge/forge/corpus/slat_reader.py`                 |
| 3 | Implement writer (`dumps` / `dump` / pretty)    | done    | `~/code/forge/forge/corpus/slat_writer.py`                 |
| 4 | Implement JSONL round-trip converter            | done    | `~/code/forge/forge/corpus/slat_jsonl.py`                  |
| 5 | Write pytest suite                              | done    | `~/code/forge/tests/test_slat.py`                          |
| 6 | Write SPEC.md                                   | done    | `./SPEC.md`                                                |
| 7 | Write GRAMMAR.md                                | done    | `./GRAMMAR.md`                                             |
| 8 | Write EXAMPLES.md                               | done    | `./EXAMPLES.md`                                            |
| 9 | Write README.md                                 | done    | `./README.md`                                              |
| 10| Update Big Forge Plan Part IV (sexpr → slat)    | done    | `~/code/lacuna-docs/engineering/THE-BIG-FORGE-PLAN.md`     |
| 11| Update THE-PLAN.md §4.4 (slat artifact para)    | done    | `~/code/lacuna-docs/engineering/THE-PLAN.md`               |

## Test result summary

`python3 -m pytest ~/code/forge/tests/test_slat.py -q` — **82 passed** in ~0.16s.

Coverage:

| Class                       | Count | Notes                                                   |
|-----------------------------|-------|---------------------------------------------------------|
| TestLexical                 | 15    | int / float / string / symbol / kw / bool / nil / rational / char |
| TestLexicalNegative         | 7     | unclosed paren, unterminated string, dangling `#`, etc. |
| TestCanonicalShapes         | 6     | event / brief / report / probe-tick / message / nested  |
| TestRoundTripHandCrafted    | 33    | 30 hand + 70 mechanical + bulk + verify                 |
| TestRoundTripRandom         | 1     | 100 random shapes, rng seed 1729                        |
| TestJsonlRoundTrip          | 5     | bulk + tagged-object per SlatValue kind                 |
| TestModes                   | 3     | tolerant vs strict + empty                              |
| TestComments                | 4     | bare line, trailing, block, shebang                     |
| TestStructuralSharing       | 2     | label + ref, expanded on write                          |
| TestStreamIO                | 5     | multi-line load, dump, pretty, blank-skipping           |

## Decisions taken (documented for the closeout report)

1. **Default reader mode = tolerant.** Strict via `strict=True`. Rationale: a single bad line in a 10M-line log must not tank the reader.
2. **Symbol / keyword / rational / char in JSON = `_type`-tagged object.** Self-contained, no sidecar.
3. **Structural sharing expanded on write.** Reader honors `#N=` / `#N#`; writer emits inline copies. Explicit share-preserving serialization is deferred.
4. **Comments captured into `_comment` on the enclosing form.** Bare comment lines land as `{"_form": "_comment", "text": ...}`.
5. **`;;;slat 1.0` shebang** — recognized by reader as `_shebang` record; written by `dump()` by default.
6. **`_form`, `_positional`, `_comment`, `_bad-line`, `_shebang`, `_value`** are reserved keys.
7. **`.slat` extension, `application/vnd.lacuna.slat+text` media type.**

## Verification steps run

1. Smoke: `python3 -c "from forge.corpus.slat_reader import loads; print(loads('(event :kind train :ts \"...\" :iter 500 :loss 0.771)'))"` → parses.
2. `python3 -m pytest ~/code/forge/tests/test_slat.py -q` → 82 passed.
3. SPEC.md/GRAMMAR.md/EXAMPLES.md/README.md TOC anchors reviewed for consistency.

## Not done / handoff

- Wire `slat_reader.load(strict=True)` into the Forge dispatcher's `.slat` artifact validator (THE-PLAN §4.4). The paragraph is written; the code hookup is a follow-up.
- Wire slat into `worker.py` mailbox reader (THE-BIG-FORGE-PLAN Part III.2.1 migration). Follow-up.
- Validation against real `~/.forge/corpus/sakura/train.jsonl` records was deferred — the training pid 96914 owns that file; sampling deferred to a quiet moment.

## Anti-taxonomy

Did **not** touch: Sakura Scheme reference doc (`~/code/curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md`), Curator code, Lacuna worker code, ledgers, `~/.forge/runs/`.
