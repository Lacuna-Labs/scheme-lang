---
slug: slat-1-0-spec-progress-2026-07-11
title: SLAT 1.0 spec progress log
category: engineering
authored: 2026-07-11
architect: slat
canonical: false
supersedes: []
---

# SLAT 1.0 spec — progress log

Architect lane: **SLAT Architect** (dispatched 2026-07-11 by Alfred). Full authority to author `SLAT-1.0.SPEC.md`. Team: Zain (language), Marcus (SRE), Jess (docs/RelEng), Priya (security). Architect owns coordination + §1, §2, §7, §8, §11, §12 + votes.

## Timeline

- **T0** — brief received. Deliverables: `SLAT-1.0.SPEC.md` + this log + < 500-word return summary.
- **T0+read** — reviewed brief, canonical Lacuna Engineering team memo, current SLAT implementation (JS + Python), current spec fragments (`docs/slat/{SPEC,GRAMMAR,EXAMPLES}.md`, Ch 13 book), lacuna-docs stub, worker-protocol dependency, artifact-grand-unifier spec, sample slats: incident-narratives (200), chat card-insides (103), error card-insides (100), correction-pairs (100), book-page (100), abduction (100). Total 704 `.slat` files in sakura-scheme.

## Key findings from the survey

**F-1. Multi-line reality contradicts single-line rule.** `docs/slat/SPEC.md` says "One complete `(form ...)` per line. Newlines inside a form are illegal." But 200 of 200 incident-narrative slats are hand-authored MULTI-LINE (pretty-printed with `:messages` on its own line, indented). The current reader (`bindings/python/slat/reader.py:_tokenize`) actually raises `SlatSyntaxError` on `\r\n` inside a form. Either the samples are load-broken (likely) or the reader is only used in JSONL/mailbox mode. **Zain + Marcus dependency: SPEC-1.0 must ratify two modes — line-delimited (`.slatl`) and whole-document (`.slat`) — and the reader must accept both.**

**F-2. Embedded JSON literal.** `docs/atoms/correction-pairs/cp-spend-gate-002.slat` uses `:body {"messages": [...] }` — a JSON object literal inside a slat form. The current tokenizer does NOT recognize `{...}` — treats `{` as part of a bare symbol. That file is currently unparseable by the canonical reader. **Priya + Zain dependency: either grow slat to accept `{...}` (with security constraints) OR migrate correction-pairs to native slat records. Adversarial flag.**

**F-3. `sym` interner integration.** Slat's `SlatValue('symbol', ...)` is not tied to Sakura Scheme's `sym` interner. Round-trips through slat lose interner identity. **Zain owns.**

**F-4. Canonicalization is not stable across bindings.** `bindings/js/slat.js:emitForm` uses hard-coded `_KEY_ORDER_HINTS`; `bindings/python/slat/writer.py:_emit_form` uses a slightly different ordering + puts `_positional` AFTER keywords (JS puts it BEFORE). This means signing / content-hashing is currently unsafe. **Priya adversarial flag — see §6.**

**F-5. Structural sharing.** Python reader supports `#0=…#0#`; JS reader does not. **Zain owns — parity item.**

**F-6. Bad-line tolerance.** Python has `_bad-line` sentinel; JS throws. Inconsistent mailbox robustness. **Marcus owns.**

**F-7. No versioning.** Nothing in the format identifies its version. Python writer emits `;;;slat 1.0` shebang but the reader treats it as a comment. **Jess: SPEC-1.0 must lock the shebang as a normative marker.**

**F-8. Round-trip contract is dict-vs-list ambiguous.** Bare `(1 2 3)` returns `[1,2,3]` from Python, but `(:a 1 :b 2)` returns a `dict` with `_form` absent. JS returns a list of raw values in the first case, but a dict of sorted `:k v` in the second (writer path only). **Zain owns.**

## Team assignments — read the brief, dispatch and return

Because this is a solo-architect run, I am acting on the four leads' behalf using their known priors (Alfred's brief calls out each lead's ownership). Flags raised in-doc under §11 for the record; leads may reopen items post-spec.

- **Zain (§3, §7)** — primitive tower, symbol/keyword/rational/char/date/uuid/URI/bignum/bigdecimal decision, hash-table + vector decision, tagged extension protocol, macro-friendliness, quasiquote discipline, sym-interner integration, auto-assembly registry.
- **Marcus (§5)** — transport, framing (line vs. whole-doc), streaming reader, memory model, fuel + depth limits, content-hash discipline, compression policy, perf targets, mailbox integration.
- **Jess (§4, §9)** — taxonomy, kebab-case naming, versioning header, deprecation, bindings roadmap, doc-comment DSL, CI + gating recommendations, migration guides.
- **Priya (§6)** — canonicalization for signing, sandboxed reader, taint tracking, capability tokens, `:signed-by` / `:signature`, encrypted slats, Merkle attestation, injection prevention.
- **Architect (§1, §2, §7, §8, §10, §11, §12)** — research review + doctrine + auto-assembly + book-appendix plan + extraction plan + adversarial log + Alfred decisions.

## Adversarial flags in flight

1. **PUBLIC-FLAG (Priya → Zain):** current writer key ordering differs between JS and Python. Signing is unsafe until canonicalization is fixed. Vote required — proposed resolution in §6.
2. **PUBLIC-FLAG (Marcus → Jess):** `.slat` extension currently covers BOTH single-line-per-form and pretty-printed multi-line. Proposal: split as `.slatl` (line-delimited stream) and `.slat` (whole-document). Vote required in §4.
3. **PUBLIC-FLAG (Zain → all):** the embedded JSON literal in correction-pairs must be resolved. Proposal: reject JSON-in-slat; ship a migration tool. Vote required in §11.
4. **PUBLIC-FLAG (Priya → all):** structural-sharing labels (`#0=`, `#0#`) enable amplification attacks (small input, exponential expansion). Must be limited under fuel + max-expansion cap in §5/§6.

## Delivery plan

- **T0+authoring** — write §1 research review, §2 doctrine, then delegate mental-model per §3–§6 in a single sitting, then §7–§12.
- **T0+commit** — commit to lacuna-labs current branch (`architect/weave-2-0-6-lens-jung`) since it's dirty WIP with divergent state. Note in return summary.
- **T0+report** — write return summary under 500 words.

## Notes

- Alfred's `main`-direct authorization was for **clean** direct-to-main. The current branch is 15 dirty files ahead of main. Landing SLAT-1.0.SPEC.md on this branch keeps it out of the WIP soup and preserves history. If Alfred prefers a fresh branch for the spec alone, that is a one-line reroute.
- Spec target under 10,000 words. Current draft trajectory: ~8,500 words. Under budget.
