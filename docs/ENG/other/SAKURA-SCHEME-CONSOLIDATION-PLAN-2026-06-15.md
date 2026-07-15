# Sakura Scheme — Consolidation Plan (2026-06-15)

> **Convened:** Lacuna Engineering — Soo-Jin (runtime / primitives), Aiko (voice / clarity),
> Marcus (cost / cache / per-session prompting), Dr Imani (honest cut), Owner stand-in.
> **Trigger:** owner directive 2026-06-15 17:29 UTC — "consolidate our scheme, one
> reference manual, an engineering manual, an automations MD, one HTML tutorial."
> **Output of this lane:** *this plan*. The four final docs are NOT written here.

---

## §1 Inventory — the sprawl

Scanned `~/code/curator/docs`, `docs/specs/`, `docs/sakura/`, `docs/runbooks/`, and
`curator-web/src/scheme/{SPEC.md,GUIDE/}`. **K** = becomes one of the final 4. **C** =
content folds into one of the 4 then dies. **A** = archive to `docs/archive/scheme/`.
**S** = scratch, delete. Sizes/dates per `ls -la`.

**Feeders → Engineering (C):** `SAKURA-LLM-CANONICAL.md` (117 KB → §Persona+§LLM-prompting), `AUTOMATIONS-STATE-MACHINE-CHAPTER.md` (53 KB → §Driver-loop), `specs/CART-SPINE-DESIGN.md` (25 KB → §Cart spine), `LANGUAGE-REPORT-2026-06-13.md` (17 KB), `SAKURA-SCHEME-GOLDEN-STANDARD-2026-06-14.md` (25 KB), `SAKURA-NEW-FEATURES-RAG-2026-06-14.md` (16 KB → §Cache), `SAKURA-ADVICE-RELEVANCE-2026-06-15.md` (35 KB → §Prompting), `2026-06-06-camera-scheme-best-practices.md` (43 KB), `SECURITY-REVIEW-1-SLICE-B-SCHEME-2026-06-13.md` (25 KB → §Sandbox), `specs/SAKURA-BEHAVIORAL-POLICY-2026-06-13.md` (71 KB), `specs/KILLER-SCHEME.md` (6 KB).

**Feeders → Reference (C):** `specs/SCHEME-ANIMATION-CONTROL-2026-06-13.md` (103 KB), `specs/SCHEME-INTERACTION-CATALOG.md` (25 KB), `specs/SAKURA-SCHEME-COMPLETENESS-AUDIT.md` (26 KB), `specs/SAKURA-COGNITION-VERBS-2026-06-14.md` (10 KB), `SAKURA-SCHEME-LANGUAGE-SPEC-MINI-2026-06-14.md` (14 KB, → appendix), `scheme/GUIDE/01..15-*.md` (~30 KB).

**Feeders → Automations 1.0 (C):** `AUTOMATIONS-CANONICAL-v2-2026-06-14.md` (23 KB, primary), `AUTOMATIONS-RESWEEP-2026-06-14.md` (30 KB), `CART-INVENTORY-2026-06-15.md` (35 KB), `COMBO-CARTS-*` (126 KB, 2 files), `PINK/MCMC/BASIC-CRUD/10-MORE-FAMILIES-*` (~280 KB, 4 files), `specs/PODCAST-SAKURAS-PICK-2026-06-14.md` (8 KB), each `.sks` in `carts/`.

**Keep (K/K-adjacent):** `docs/HELLO-SURFACE-1.0-ENGINEERING.md` (349 KB, Eng cross-links not subsumes), `docs/sakura/HELLO-SURFACE-1.0.md` (22 KB, sibling), `curator-web/src/scheme/SPEC.md` (~20 KB, in-code), `docs/CART-INDEX-DESIGN-2026-06-15.md` (13 KB), `docs/runbooks/scheme.md` (5 KB).

**Archive (A)** — persona/sprite lane out of Scheme scope per directive:
all `specs/SAKURA-{COMPANION,VOICE*,PERSONA-DEEPER*,EXISTENTIAL-MODE*,INNER-WORLD*,LIVING-WORLD,SYNTHESIS,INTEGRATED-PLAN,BECOMING-BURNDOWN,KNOWLEDGE-MODEL,LLM-ROUTING-AUDIT,TRAINING-DISCIPLINE,FLOWER-*}.md` + `CORTEX-SAKURA.md` (~325 KB); `specs/HELLO-SURFACE-{FINISH,MOTION-SPEC}.md`; `specs/audit-soojin-*.md`; `sakura/{HELLO-SURFACE-1.0-GAP-INVENTORY,SAKURA-FULL-SYSTEM,DECISION-act-carts}.md`; `AUTOMATIONS-CANONICAL.md` (self-deprecated), `AUTOMATIONS-INVENTORY-2026-06-13.md`, `CART-{REVIEW-FINAL,PORTING-REPORT,FINAL}-*.md`; `SAKURA-{CHAT-SURFACE,UX-STANDARD,SHOP-STYLE-GUIDE}.md`; `scheme/GUIDE/*-2026-06-02.md`.

**Scratch (S)** — delete after 14-day grace: `docs/D3-AUTOMATION-SURFACE.html`, `CART-FAKE-SHOP-SWEEP-2026-06-14.md`, `CART-LINT-REPORT-2026-06-14.md`, `docs_site/scheme.html`.

**Tutorial HTML:** `docs_site/scheme.html` (331 ln) → **S**. `scheme-manual.html` (672 ln) → **K** (rename = Tutorial). `scheme-api.html` (1,504 ln) → **C** (auto-regen from new Reference at build, no hand-edits).

**Headline:** ~70 Scheme-touching docs in 14 days. ~35 carry load-bearing content (folds into 4 final docs); ~35 archive or delete.

---

## §2 The 4-doc structure

### 2.1 `SAKURA-SCHEME-1.0-ENGINEERING.md`
Engineers + LLMs only. **Outline:** mission/lineage (`SPEC.md` §1-2) · persona-as-runtime (LLM-CANONICAL pillars) · HS overlap cited not duplicated · evaluator (interp.js, TCO, freeze, fuel) · primitive installers · dispatcher + verb registry + worker bridge · **cart spine** (`runCartLive`, from CART-SPINE-DESIGN) · driver-loop FSM (`next/done/escalate/after/act/wait/interrupted`, Simmons/Brooks/Gat) · sandbox + capability gate · cart-authoring contract (GOLDEN-STANDARD §0-12) · **cache strategy** (Marcus: per-session prompt cache, RAG envelope, prefix-hit math) · **per-session LLM prompting** (Marcus: generate-vs-route, prompt structure, mini-spec injection, validator chain) · animation · camera · cart-index regen. **Length** 60-90pp. **Discipline:** honest partials; backend vendor names OK; no automations; no cost-benefit except caches + prompt economics. **Owner-calls:** (a) reconcile "15 primitives+36 macros" (LANGUAGE-REPORT) vs "370 verbs" (COMPLETENESS-AUDIT). (b) HS overlap = cite + 1-2 para summary?

### 2.2 `SAKURA-SCHEME-1.0-REFERENCE.md`
Cart composers. **Outline:** §0 counts · §1 core (117) · §2 cart-prelude (12) · §3 card (37) · §4 paint (29) · §5 motion (8) · §6 animation · §7 audio+note (11) · §8 camera · §9 sprite kit (29) · §10 conway/grid/surfaces (86) · §11 podcast (38) · §12 cognition · §13 macros (36) · Appendix mini-spec. **Per-entry:** signature, 1-sentence description, effects, **Novice/Intermediate/Expert** examples. Inline source cite (`scheme/cardVerbs.js:NNN`) or `;; generated example`. **Sourcing:** enumerate `scheme/primitives/`, `registry/coreVerbs.js`, all `*Verbs.js`. Mine via `grep -rn "(<verb>" curator-web/src/scheme/carts/`, take three callers sorted by `sized_bytes` in `index.json`. <3 callers → fall back to `examples.js` + `__snapshots__/`. Last resort: a `;; generated example` that passes `cartLint.js` + `executeAllCarts.test.js`. Generated examples use real sprite ids ([[curator-sprite-helpers]]), real card kinds, real flavors. **Length** 100-150pp. **Discipline:** no vendor names except backend footnotes; failing examples kill the doc PR (CI gate). **Owner-calls:** macros in scope? podcast verbs here or in Automations?

### 2.3 `SAKURA-AUTOMATIONS-1.0.md`
Engineers + LLMs maintaining cart corpus. **Outline:** one section per family per `carts/index.json` (pink 348, etsy 231, imagine 157, dream 65, cron 48, rules 20, scenes 17, magic 11, google 6, personal 3, radio 3, transfer 3 — 860 total at 06-15 17:19Z). One entry per cart in slug order. **Per-cart shape** (owner directive verbatim):
```
### <slug>  (<flavor> · <trigger>)
**Layperson** — operator's words. (1-2 paragraphs.)
**CS / engineering / math** — algorithm, data flow, cache key, idempotency,
  state graph. (2-4 paragraphs.)
**Equations / principles** — formal notation. Cite algorithm by name
  (Newton's method / EMA / Levenshtein / token-bucket / …).
**Used in the wild** — paper / package / industry practice, with citation.
**Source** — `carts/<dir>/<slug>.sks` · verbs · cortex keys.
```
**Sourcing:** `carts/index.json` canonical. "Layperson" from `;;~ summary` header. "CS/math" fresh by Marcus + Soo-Jin. Citations vetted by Dr Imani. "Source" auto-extracted from `index.json` `verbs[]`. COMBO/PINK/MCMC/BASIC-CRUD/10-MORE-FAMILIES are raw feed. **Length** ~860 × ~1pp ≈ 800-900pp — Aiko: 900-page single MD won't render. Recommend per-family split at `docs/automations/<family>.md` with parent index. **Discipline:** operator-voice layperson (no vendor names — `model/workhorse`, `web/search`); engineering-voice math; NO cost-benefit; honest about un-wired services. **Owner-calls:** (a) split? (b) "in the wild" per-cart or per-algorithm-family shared blocks (~30% length saving)? (c) `_legacy/`, `_reference/`, `demo/`, `ml/` in scope?

### 2.4 `SAKURA-SCHEME-TUTORIAL.html`
Rename `docs_site/scheme-manual.html` ("an on-ramp", 672 lines, paper/Fraunces) → `docs/SAKURA-SCHEME-TUTORIAL.html`. Light refresh: verbs aligned to LANDED floor per LANGUAGE-REPORT. Close with pointers to Reference + Engineering. 672 lines stays. No vendor names operator-facing. **Owner-call:** keep paper/Fraunces? *(Recommend keep — most Curator-shaped HTML we have.)*

---

## §3 Execution plan — lanes

> **Tonight:** plan + owner-calls. Writing is a multi-day burn.

| Lane | Doc | Chair(s) | Wall-clock | Key inputs |
|---|---|---|---|---|
| **A** | Engineering | Soo-Jin + Marcus (§Cache + §LLM-prompting) | 2 days | `SPEC.md`, `CART-SPINE-DESIGN.md`, `STATE-MACHINE-CHAPTER`, `LANGUAGE-REPORT`, security-review, `NEW-FEATURES-RAG`, `ADVICE-RELEVANCE`, camera-best-practices, `KILLER-SCHEME` |
| **B** | Reference | Aiko (clarity) + Soo-Jin (correctness) | 3 days | `scheme/primitives/*`, `registry/coreVerbs.js`, all `*Verbs.js`, COMPLETENESS-AUDIT, LANGUAGE-REPORT, ANIMATION-CONTROL, INTERACTION-CATALOG, GUIDE/03-11. Example-mining: `grep -rn` over `carts/` |
| **C** | Automations (parent index + per-family) | Aiko + Marcus + Dr Imani | 5-7 days | `carts/index.json`, CANONICAL-v2, RESWEEP, COMBO/PINK/MCMC/BASIC-CRUD/10-MORE-FAMILIES, each `.sks` |
| **D** | Tutorial (HTML) | Aiko | 0.5 day | `docs_site/scheme-manual.html` |

**Order:** D first (cheap, proves shape) → A + B in parallel (Marcus splits time) → C last (benefits from A+B settling; per-cart math cross-links Reference). All four are independent and can also be fully parallel.

**Owner-calls before writing:**
1. Eng: cite-HS or include-HS overlap? *(Recommend cite + 1-2 para summary.)*
2. Reference: macros in scope? primitive-vs-verb naming policy?
3. Automations: single file or per-family split? algorithm-family shared "in the wild" blocks?
4. Tutorial: keep paper/Fraunces?
5. Out-of-scope confirm: Sakura-persona docs (Companion, Voice, Inner-World, Persona-Deeper) — these are NOT Scheme-language. Stay out of the 4-doc consolidation? *(Read directive as: yes, persona is out; Scheme is what consolidates.)*

---

## §4 The cut list

Full enumerations live in §1 — this is the policy:

- **Delete (S)** after the 4 ship + 14-day grace: 4 files (see §1 Scratch row).
- **Archive (A) → `docs/archive/scheme/`** — move, never delete: all rows tagged A in §1. Persona/sprite-lane docs go here per directive.
- **Consolidate-then-stub (C):** every C-row in §1 → content moves into one of the final 4, original file becomes a 1-line stub: `MOVED to <final-doc> §<section>; will delete 2026-07-15.`
- **Keep as-is (K/K-adjacent):** 5 files (see §1 Keep row).

**Dr Imani's veto:** any doc that cannot be traced into the final 4 by a *named section reference* stays archived, not deleted. Anything ambiguous → archive. Conservative is the rule.

---

## §5 LLM maintenance rule — proposed `CLAUDE.md` addition

Insert after the existing **Scheme cart corpus — INDEX MUST STAY IN SYNC** section in `/Users/alfred/code/curator/CLAUDE.md`:

````markdown
## Scheme documentation — KEEP THE 4 DOCS IN SYNC

The Sakura Scheme has exactly four living docs. Same discipline as the cart
index: edits to the runtime, primitive set, cart corpus, or automations
MUST update the relevant doc in the same PR.

- **Add/modify a Scheme primitive, verb, or macro** →
  update `docs/SAKURA-SCHEME-1.0-REFERENCE.md` (entry + 3 examples). Generated
  examples must lint clean (`npm --prefix curator-web run lint:carts`) and pass
  `executeAllCarts.test.js`.
- **Change the runtime, evaluator, dispatcher, cart spine, sandbox, cache
  strategy, or per-session LLM prompting** →
  update `docs/SAKURA-SCHEME-1.0-ENGINEERING.md`.
- **Add/rename/retire a cart** →
  update `docs/SAKURA-AUTOMATIONS-1.0.md` (per-family file at
  `docs/automations/<family>.md` if split adopted) AND regenerate the cart
  index (pre-commit hook already handles `carts/index.json`,
  `sakura-corpus.jsonl`, `sakura-cart-breadcrumbs.json`).
- **Tutorial** — `docs/SAKURA-SCHEME-TUTORIAL.html` changes only when the
  on-ramp verb floor changes. Owner sign-off required for tutorial edits.

If unsure which doc, add entry to Reference, design note to Engineering,
cart to Automations. When in doubt, all three.

Planned CI gate `scheme-docs-sync`: a PR that touches `scheme/*Verbs.js` or
`scheme/primitives/*` without touching `SAKURA-SCHEME-1.0-REFERENCE.md`
fails. Same shape as the cart-index-sync gate.
````

---

## Sign-offs

- 🧠 **Soo-Jin** — *affirm.* The 4-doc shape matches the runtime's natural cleavage (engine / lexicon / corpus / on-ramp). Reference doc finally pays off the 370-verb audit.
- 🎨 **Aiko** — *affirm w/ ask.* Confirm per-family Automations split before Lane C starts — one 900-page MD won't render and nobody will read it.
- 💻 **Marcus** — *affirm.* Cache + per-session LLM-prompting in Eng is the one place cost math is allowed per directive. RAG-as-cache + prefix-hit math goes there. Automations stays cost-free.
- 🔬 **Dr Imani** — *affirm w/ veto.* Any C-classified doc untraceable into a named final-4 section gets archived, not deleted. No load-bearing prose lost under "scratch."
- 🏛️ **Owner stand-in** — *affirm.* Curator-shaped: honest about load-bearing vs. scratch, conservative deletion, owner-calls itemized not guessed, cache + LLM-prompting carve-out matches the directive verbatim. Five owner-calls in §3 need answers before A/B/C start.
