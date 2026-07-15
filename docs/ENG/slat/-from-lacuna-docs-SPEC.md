<p align="left">
  <img src="../../brand/assets/tri-tone-bar.svg" alt="Lacuna slat — messaging + logging format" width="400">
</p>

# Slat — Specification

*Newline-delimited S-expressions for Lacuna messaging and logging.*

---

## Contents

- [1. What slat is](#1-what-slat-is)
- [2. Grammar summary](#2-grammar-summary)
- [3. Lexical elements](#3-lexical-elements)
- [4. Structural sharing](#4-structural-sharing)
- [5. Line format](#5-line-format)
- [6. File format](#6-file-format)
- [7. Canonical shapes](#7-canonical-shapes)
- [8. JSONL round-trip](#8-jsonl-round-trip)
- [9. Reserved tokens](#9-reserved-tokens)
- [10. Extension mechanism](#10-extension-mechanism)
- [11. Backward compatibility](#11-backward-compatibility)
- [12. Line-safety property](#12-line-safety-property)
- [13. Bad-line policy](#13-bad-line-policy)

---

## 1. What slat is

Slat is a line-oriented S-expression format. One complete `(form ...)` per line, terminated by a single LF byte. It is used for two things: worker-to-worker messaging (briefs, reports, taxonomy), and event logging (probe ticks, insights events, errors). Slat lines can be `tail -f`'d, `grep`'d, appended to a socket, or written to a rotated log file — and each line stands on its own.

The dual role — messaging and logging — is why slat exists. JSONL is fine as an interchange target, but it has no notion of symbols, keywords, rationals, or chars, and its quoted-string escaping makes hand-editing painful. Slat's syntax is a subset of Sakura Scheme: everything a Lacuna worker can read as data, a human can read as code. `(brief :id "b-01" :owner "alfred")` is both a Scheme datum and a message payload.

---

## 2. Grammar summary

See [`GRAMMAR.md`](./GRAMMAR.md) for the full BNF/EBNF. In short:

```
line   := form NL | shebang NL | comment NL | blank NL
form   := "(" head keyvalue* positional* ")"
head   := symbol
keyvalue := keyword atom
atom   := string | symbol | keyword | int | float | rational | char | bool | nil | form | list
list   := "(" atom* ")"
```

---

## 3. Lexical elements

| Kind      | Example                | Notes                                                                          |
|-----------|------------------------|--------------------------------------------------------------------------------|
| String    | `"hello\n"`            | `\n \t \r \\ \"` escapes; no raw newlines inside                              |
| Symbol    | `train`, `foo-bar`     | Any run of non-whitespace, non-paren chars that doesn't parse as a number     |
| Keyword   | `:kind`, `:from`       | Leading colon; folds into dict key when it precedes a value                    |
| Integer   | `42`, `-7`, `+5`       | 64-bit signed; unbounded in-memory                                             |
| Float     | `3.14`, `-0.5`, `1e-3` | IEEE 754 double                                                                |
| Rational  | `1/3`, `-7/9`          | Two integer literals separated by `/`                                          |
| Char      | `#\a`, `#\space`       | Named forms: `space`, `newline`, `tab`, `return`                              |
| Boolean   | `#t`, `#f`             |                                                                                |
| Nil       | `nil`                  | Not `#nil`, not `null`                                                         |
| Comment   | `; ...`, `#\| ... \|#` | Line-to-EOL, or nestable block; captured onto enclosing form's `_comment`     |

Whitespace inside a form is `SPACE` (0x20) or `TAB` (0x09) only. `CR` (0x0D) and `LF` (0x0A) inside a form are a parse error — slat is single-line by construction.

---

## 4. Structural sharing

Slat supports Scheme's `#N=` / `#N#` labels for shared subtrees.

```
(outer :a #0=(inner :k "v") :b #0#)
```

The reader recognizes labels and refs and returns the shared subtree inline at both positions. The writer expands shared subtrees to inline copies on output — explicit share-preserving serialization is left as a future extension. If a producer needs deduplication, it should keep references at the application layer, not on the wire.

---

## 5. Line format

- One form per line.
- Terminator: single LF (`\n`, 0x0A). CRLF is accepted on read; writers emit LF only.
- No newlines inside a form. A form spanning multiple lines is not slat — it's Scheme source code.
- UTF-8. No BOM.
- Blank lines are permitted between records; readers skip them silently.

Typical record widths: 40–400 bytes. Records over ~4 KB should be reviewed — slat lines that big are usually a design smell (see [`EXAMPLES.md`](./EXAMPLES.md#too-big-a-record)).

---

## 6. File format

- Extension: `.slat`
- Media type: `application/vnd.lacuna.slat+text`
- Optional shebang on the first line: `;;;slat 1.0`

The shebang is not required, but readers recognize it and emit it as a `{"_form": "_shebang", ...}` record so downstream consumers can gate on the version. The default `dump()` writes the shebang.

---

## 7. Canonical shapes

Slat is data — any form is legal. But for cross-project interop, the following shapes are canonical. Handlers that receive these forms can rely on the listed keys.

### 7.1 `event`

Every observation a worker or trigger emits.

```
(event :kind train :ts "2026-07-09T22:00:00Z" :iter 500 :loss 0.771)
```

Required: `:kind` (symbol), `:ts` (ISO-8601 UTC string).
Optional: any other keyword. `:iter :loss :val :meta` are common.

### 7.2 `message`

Worker-to-worker chat.

```
(message :from "sakura" :to "alfred" :body "hello" :ts "2026-07-09T22:00:00Z")
```

Required: `:from`, `:to`, `:body` (strings), `:ts`.

### 7.3 `brief`

A task handed to a worker.

```
(brief :id "b-01" :owner "alfred" :task "spec extraction" :prio 3)
```

Required: `:id`, `:owner`, `:task`. Optional: `:prio`, `:context`, `:deadline`.

### 7.4 `report`

Worker output. Body of a taxonomy report goes here.

```
(report :brief-id "b-01" :status "done" :confidence "high" :handoff nil)
```

Required: `:brief-id`, `:status` (`"done"|"partial"|"blocked"`), `:confidence` (`"high"|"medium"|"low"`).

### 7.5 `probe-tick`

Freshness or health probe result. Emitted on every trigger evaluation.

```
(probe-tick :probe "train-alive" :iter 1000 :loss 0.814 :val 3.745 :ok #t)
```

Required: `:probe`, `:ok`. Optional: any tick-relevant metric.

### 7.6 `error`

An error a worker chose to surface.

```
(error :kind "read-timeout" :retry #t :attempt 2 :msg "sakura corpus stream stalled")
```

Required: `:kind`, `:msg`. Optional: `:retry`, `:attempt`, `:trace`.

### 7.7 `ping` / `pong`

Liveness.

```
(ping :from "meridian" :ts "2026-07-09T22:00:00Z")
(pong :from "sakura" :seq 42)
```

---

## 8. JSONL round-trip

Slat carries symbols, keywords, rationals, and chars. JSON does not. To round-trip through JSONL, these are encoded as tagged objects:

| Slat kind   | JSON encoding                                            |
|-------------|----------------------------------------------------------|
| Symbol      | `{"_type": "symbol", "value": "foo"}`                    |
| Keyword     | `{"_type": "keyword", "value": "foo"}`                   |
| Rational    | `{"_type": "rational", "num": 1, "denom": 3}`            |
| Char        | `{"_type": "char", "value": "a"}`                        |

Comments ride along on the containing form's `_comment` key (string or list of strings). Structural sharing is expanded to inline copies — a re-import re-emits inline.

Algorithm:

1. `slat_to_jsonl(stream)` → parse each slat line, walk the dict, tag SlatValues, `json.dumps`.
2. `jsonl_to_slat(stream)` → `json.loads`, walk the dict, unwrap tagged objects into SlatValues, `dumps`.

Round-trip guarantee: `loads(dumps(loads(line))) == loads(line)`, and `loads(dumps(x)) == x` for any `x` in the shape space of `_rand_form`. See the test suite `~/code/forge/tests/test_slat.py`.

---

## 9. Reserved tokens

The following keys are reserved on canonical forms. Producers must not use them for application data.

| Token         | Meaning                                                                              |
|---------------|--------------------------------------------------------------------------------------|
| `_form`       | Head symbol of the form. Set by the reader; consumed by the writer.                 |
| `_positional` | Non-keyword trailing elements. Rare — most forms are pure keyword-value.            |
| `_comment`    | Comment text attached to the enclosing form. String or list of strings.             |
| `_bad-line`   | Sentinel `_form` value used in tolerant mode when parsing fails.                     |
| `_shebang`    | Sentinel `_form` value for the `;;;slat 1.0` line.                                   |
| `_value`      | Sentinel `_form` value used when a JSONL record is a bare scalar or list.           |
| `_comment`    | Sentinel `_form` value when a slat line is a bare comment.                          |

The `_type` key inside a JSON value is likewise reserved to slat's tagged-value encoding.

---

## 10. Extension mechanism

Applications that need forms outside the canonical set should register them in `.lacuna/slat-forms.yaml` at the project root:

```yaml
forms:
  - name: shop-tick
    required: [shop-id, revenue, ts]
    optional: [region, currency]
    description: Per-shop hourly revenue tick from Curator.
  - name: cortex-write
    required: [slot, value, ts]
    optional: [ttl]
    description: Cortex write-time pre-materialization event.
```

The Lacuna dispatcher reads this file at boot; unknown forms are still accepted but skip shape validation. Registered forms fail-fast on missing required keys.

---

## 11. Backward compatibility

- **Additive** (safe): adding a new optional keyword, adding a new canonical form, adding a new tagged JSON type.
- **Breaking** (needs a version bump in the shebang): renaming a required key, removing a canonical form, changing a value's type, changing the JSON tagged-object schema.

Downstream consumers must be tolerant to unknown keywords — they may appear in newer records. The reader guarantees they land in the dict as strings; the consumer can ignore them.

---

## 12. Line-safety property

The core property slat guarantees: **any complete form fits on exactly one line, and any single line contains at most one complete form.** This lets rotated logs, chunked reads, and grep-based tools work without slat-aware parsing.

Corollary: `dumps_pretty` output is **not** slat — it spans multiple lines. Use it for human reading only.

---

## 13. Bad-line policy

- **Default: tolerant.** A malformed line yields `{"_form": "_bad-line", "raw": <str>, "error": <str>}`. This is what production logging paths use — a single garbled line in a 10M-line log must not tank the reader.
- **Opt-in: strict.** Pass `strict=True` to `loads()` / `load()` to raise `SlatSyntaxError` on any parse failure. CI test suites should run in strict mode. The dispatcher validates handler-produced `.slat` artifacts in strict mode at write time.

Bad-line records are still round-trippable — they emit as a canonical `_bad-line` form and re-parse identically.
