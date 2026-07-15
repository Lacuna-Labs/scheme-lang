<p align="left">
  <img src="../../brand/assets/tri-tone-bar.svg" alt="Lacuna slat — examples" width="400">
</p>

# Slat — Examples

*Runnable slat forms and their JSON counterparts.*

Every example on this page is a real slat line — copy it into `python3 -c "from forge.corpus import loads; print(loads('...'))"` and it parses.

---

## Hello world event

```
(event :kind hello :ts "2026-07-09T22:00:00Z")
```

Parses to:

```python
{'_form': 'event',
 'kind': SlatValue(kind='symbol', value='hello'),
 'ts': '2026-07-09T22:00:00Z'}
```

Round-trips to JSONL as:

```json
{"_form": "event", "kind": {"_type": "symbol", "value": "hello"}, "ts": "2026-07-09T22:00:00Z"}
```

---

## Worker brief (nested job form)

```
(brief :id "b-2026-07-09-001" :owner "alfred" :task "specs extraction" :context (job :urgency 3 :deadline "2026-07-10"))
```

The nested `(job ...)` becomes its own dict under `:context`, with `_form = "job"`.

---

## Worker taxonomy report

```
(report :brief-id "b-2026-07-09-001" :status "done" :confidence "high" :handoff nil :meta (taxonomy :worker-class "docs-extraction" :systems ("lacuna-docs" "forge" "curator") :anti "did not touch code"))
```

The `:systems` value is a bare list of three strings — no head symbol → stays a list, not a form.

---

## Training-step probe-tick

```
(probe-tick :probe "train-alive" :iter 1000 :loss 0.814 :val 3.745 :ok #t :ts "2026-07-09T22:00:00Z")
```

Written by Forge every N steps; consumed by Meridian's freshness monitor.

---

## Freshness-probe result

```
(probe-tick :probe "sakura-corpus-fresh" :ok #f :last-write "2026-07-09T18:00:00Z" :age-seconds 14400)
```

`:ok #f` and a stale `:last-write` — Meridian would raise this via `alert-routing`.

---

## Rational + char (uncommon; here for completeness)

```
(x :ratio 1/3 :marker #\space)
```

Parses to:

```python
{'_form': 'x',
 'ratio': SlatValue(kind='rational', value=Fraction(1, 3)),
 'marker': SlatValue(kind='char', value=' ')}
```

Round-trips to JSONL as:

```json
{"_form": "x",
 "ratio": {"_type": "rational", "num": 1, "denom": 3},
 "marker": {"_type": "char", "value": " "}}
```

---

## Multi-line pretty form + its single-line slat equivalent

`dumps_pretty` gives a human-readable multi-line rendering. It is **not** slat — the reader will reject it. Use it for reading only.

Pretty (multi-line, NOT a slat line):

```
(brief
  :id "b-01"
  :owner "alfred"
  :context (job
    :urgency 3
    :deadline "2026-07-10"
  )
)
```

Slat (single line, canonical):

```
(brief :id "b-01" :owner "alfred" :context (job :urgency 3 :deadline "2026-07-10"))
```

Both parse to the same dict.

---

## Structural sharing (label + ref)

```
(bundle :primary #0=(actor :id "sakura" :role "author") :also #0#)
```

Both `:primary` and `:also` land as the same actor dict. On dump, the writer expands to two inline copies:

```
(bundle :also (actor :id "sakura" :role "author") :primary (actor :id "sakura" :role "author"))
```

The parse tree is equivalent; the wire form is not.

---

## Bad line (tolerant mode)

```
(oops
```

In tolerant mode (default):

```python
{'_form': '_bad-line',
 'raw': '(oops',
 'error': 'unclosed paren'}
```

In strict mode: raises `SlatSyntaxError`.

---

## Too big a record

Slat is not designed for large payloads. If a record grows over ~4 KB — say, a full session transcript or a large report body — put the body somewhere else and reference it by URL or content hash:

Wrong:

```
(report :body "... 50k of markdown ...")
```

Right:

```
(report :body-url "file:///Users/alfred/code/lacuna-docs/reports/2026-07-09-taxonomy.md" :body-sha "e3b0c44298fc1c149afbf4c8996fb92427ae41e4")
```

The line stays grep-friendly; the payload lives where big payloads should live.

---

## JSON round-trip for the whole page

Every example above is included in `~/code/forge/tests/test_slat.py`'s `HAND_CRAFTED` or a moral equivalent. `slat_to_jsonl(HAND_CRAFTED) → jsonl_to_slat(...) → parse == parse(orig)` for every one.
