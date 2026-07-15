<p align="left">
  <img src="../../brand/assets/tri-tone-bar.svg" alt="Lacuna slat — messaging + logging format" width="400">
</p>

# Slat

*Newline-delimited S-expressions. One `(form ...)` per line. Messaging and logging.*

---

Slat is Lacuna's line-oriented S-expression format. It carries worker briefs, reports, events, probe ticks, and error records. Every slat line is a complete, self-contained S-expression: `tail -f` works, `grep` works, sockets work, rotated log files work.

Slat is a subset of Sakura Scheme. A slat line is legal Scheme, and Scheme data expressed as slat is legal slat. That's the payoff — a human reads it as code, a worker reads it as data, and the reader/writer round-trips guarantee they mean the same thing.

## Quickstart

```python
from forge.corpus import loads, dumps, slat_to_jsonl, jsonl_to_slat

# read a slat line
rec = loads('(event :kind train :ts "2026-07-09T22:00:00Z" :iter 500 :loss 0.771)')
# rec == {'_form': 'event', 'ts': '2026-07-09T22:00:00Z', 'iter': 500, 'loss': 0.771, 'kind': SlatValue('symbol', 'train')}

# emit a slat line
line = dumps({'_form': 'ping', 'from': 'meridian'})
# line == '(ping :from "meridian")'

# convert a stream to JSONL
for jline in slat_to_jsonl(open('/tmp/log.slat')):
    print(jline)

# and back
for sline in jsonl_to_slat(open('/tmp/log.jsonl')):
    print(sline)
```

## Documentation

- [`SPEC.md`](./SPEC.md) — normative specification (lexical, canonical shapes, JSONL round-trip, extension mechanism)
- [`GRAMMAR.md`](./GRAMMAR.md) — formal BNF/EBNF grammar
- [`EXAMPLES.md`](./EXAMPLES.md) — runnable examples with parses and JSON encodings
- [`progress.md`](./progress.md) — build progress + decisions

## 60-second reader tour

```
(head-symbol :key1 value1 :key2 value2 ... positional-item ...)
```

- The head symbol becomes `_form` in the parsed dict.
- Keyword-value pairs (`:key val`) become dict entries.
- Positional atoms after the head land in `_positional`.
- Nested forms recurse.
- Comments (`; ...` or `#| ... |#`) attach to the enclosing form's `_comment`.
- Values can be strings, symbols, keywords, ints, floats, rationals, chars, bools, nil, forms, or bare lists.

That's all of it.

## Why not JSONL

- **JSONL has no symbols or keywords.** A `kind: "train"` string is not the same as a `kind: train` symbol. The distinction matters when the value is a handler name or a Scheme identifier.
- **JSONL is quote-heavy.** Every key is quoted; every string value is quoted. Slat lines are shorter and less noisy.
- **JSONL is not Scheme.** A slat line drops directly into a Sakura Scheme interpreter as data.

Slat still round-trips through JSONL when you need it — Meridian ingest, external analytics, anywhere JSON tooling is entrenched. But the primary format on-wire and in-log is slat.
