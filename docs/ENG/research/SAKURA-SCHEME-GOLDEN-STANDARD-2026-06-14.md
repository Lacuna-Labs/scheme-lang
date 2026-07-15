# Sakura Scheme — Golden Standard (v1, 2026-06-14)

> The standard prompt-package we send to any contractor (human or LLM)
> when asking for a new cart. Self-contained: read this + write a cart
> that matches its bar. Pass-or-fail visual + functional review.
>
> Companion doc: `SAKURA-SCHEME-LANGUAGE-SPEC-MINI-2026-06-14.md` —
> the tiny inline reference. Paste it INSIDE the contractor prompt; keep
> this doc as the larger reference they consult before writing.
>
> Foundational sources (the law underneath this doc):
> - `LANGUAGE-REPORT-2026-06-13.md` — 15 primitives + 36 macros (floor)
> - `SAKURA-LLM-CANONICAL.md` — persona + capability tiers
> - `specs/MUSIC-COMPOSITION-2026-06-13.md` — music verbs
> - `cartPrelude.js` — driver descriptor contract
> - `registry/coreVerbs.js` — live primitive signatures
> - `CODE-COMMENT-STANDARD-2026-06-14.md` — WHAT / TECHNIQUE / WHY /
>   CONSTRAINT block per code unit (imported by §8 rule 12 + §9)

---

## §0. What you're writing

A **cart** is one operator-meaningful automation. It is:

- Written in **Sakura Scheme** (R7RS-small floor + Sakura's domain extension).
- Run by the **cart driver** as a state-machine spine.
- **Audited at the registry chokepoint** — you do NOT manually log; the runtime instruments every `(act …)` call automatically.
- Reviewed against **§12 criteria** below. A cart that doesn't pass all four is rejected.

A cart is **NOT**:
- A library of helpers. (One cart = one automation.)
- A monolith. (If it does two unrelated things, it's two carts.)
- A polling loop. (If you wrote `(while …)` somewhere, stop and re-read §4.)
- A vendor-aware string-builder. (See §8 rule 9.)

---

## §1. The minimum cart skeleton

Every cart starts with a metadata header (`;;~ key value`), then a documentation comment block, then the `(cart 'slug …)` registration, then the state functions.

```scheme
;;~ title    "Human-readable title — operator's words"
;;~ author   "your-name"
;;~ version  1
;;~ mode     analysis | automation
;;~ flavor   white | pink | green | mint | light-purple | gray
;;~ id       cart-slug
;;~ trigger  cron:daily | event:<name> | analysis-pattern      ;; optional
;;~ touches  ()                                                 ;; () = read-only
;;~ summary  "One short sentence in the operator's voice."

;; Documentation block (10-25 lines).
;;
;; WHAT this cart does, in the operator's words — no jargon.
;;
;; WHY this shape — cite the spec section that justifies it. E.g.:
;;   "Per LISTING-COMPETENCE-AND-FREE-TIER §1.3, scheduled audits
;;    are Free-tier and Cortex-only — no cloud relay."
;;
;; IDEMPOTENCY: explain why running this twice is safe.
;;
;; CTX inputs: list every (ctx-get 'key …) the cart reads, in order.
;;
;; ERROR GRAMMAR: list every (escalate 'kind …) the cart can emit,
;; and what each one means to the surface that catches it.

(cart 'cart-slug
  '((author    . "your-name")
    (version   . 1)
    (read-only . #t)))                            ;; #f if the cart writes

;; ── state functions ───────────────────────────────────────────────

(define (start ctx) ...)          ;; precondition_fetch + guard
(define (fetch ctx) ...)          ;; (act …) → named on-result
(define (check-result ctx) ...)   ;; result handler + on_error branches
(define (announce ctx) (done))    ;; clean exit
```

The metadata header isn't decorative. The studio reads it. The linter reads it. The corpus pipeline reads it. The promptkit reads it. If you omit a field the tooling silently drops your cart.

---

## §2. The 15 primitives (you cannot invent more)

These are the verbs the engine implements natively. Per `LANGUAGE-REPORT-2026-06-13.md` §3, this list is closed. Anything not on it composes from these.

| Namespace | Primitive | Args (positional + keys) | Returns | Determinism |
|---|---|---|---|---|
| `motion/` | `move-to` | `addr x y` `:ms :curve :rotate :arc-via` | `MotionHandle` | deterministic |
| `motion/` | `halt` | `addr` | `MotionHandle` | deterministic |
| `motion/` | `follow-input` | `addr sensor` `:axis :scale :clamp` | `MotionHandle` | **non-deterministic** |
| `motion/` | `anchor-to-input` | `addr sensor fn` | `MotionHandle` | **non-deterministic** |
| `motion/` | `idle` | `addr` `:pattern :amp :cycles :ms` | `MotionHandle` | deterministic |
| `note/` | `strike` | `pitch` `:velocity :voice :ms` | `NoteHandle` | non-deterministic |
| `note/` | `place-at` | `staff-addr glyph` `:clef` | `NoteHandle` | deterministic |
| `note/` | `release` | `handle` | `NoteHandle` | non-deterministic |
| `surface/` | `dim` | `alpha` `:ms :curve` | `SurfaceHandle` | deterministic |
| `surface/` | `spotlight` | `addr` `:radius :softness :ms :invert?` | `SurfaceHandle` | deterministic |
| `surface/` | `curtain` | `alpha` `:ms` | `SurfaceHandle` | deterministic |
| `card/` | `do` | `addr verb args` | `EmitHandle` | deterministic |
| `card/` | `emit` | `addr event payload` | `EmitHandle` | deterministic |
| `card/` | `ask` | `addr question` `:timeout` | `AnswerHandle` | non-deterministic |
| `base/` | `make-character` | `class` `:address :traits` | character | deterministic |
| `base/` | `input/may-i?` | `sensor` | `PermissionPromise` | deterministic |

(The base namespace also carries `deterministic?` and `resolve` — both introspection / address-resolution helpers, not user-facing verbs.)

If you reach for a primitive that isn't on this list, you're either inventing a verb (auto-reject) or you want a macro from §3.

---

## §3. The 36 macros (use these — they expand to primitives)

Macros are the operator-facing vocabulary. They are **hygienic** (no identifier capture). Their expansions are deterministic by §7 of the Language Report.

### Motion idioms (13 — all expand to `motion/move-to` with named curve + ms)

`motion/glide` · `motion/drift` · `motion/sway` · `motion/arrive` · `motion/depart` · `motion/settle` · `motion/spin` · `motion/lean-aside` · `motion/ease-aside` · `motion/reach` · `motion/pluck` · `motion/toss` · `motion/land`

Each is a named timing + curve from the physics catalog. Use the macro whose **name** matches the operator's word. "She drifts to the corner" → `motion/drift`. "She arrives at her mark" → `motion/arrive`.

### Note idioms (2 — over `note/strike` + `note/place-at`)

`note/glide` (legato slide between two pitches), `note/rest` (silence for N beats).

### Musical forms (7 — over `note/place-at` sequences)

`form/I-IV-V` · `form/ii-V-I` · `form/12-bar-blues` · `form/vi-IV-I-V` · `form/I-vi-ii-V` · `form/modal-Dorian` · `form/scale`

Each expands to the staff-bound `note/place-at` calls for that progression in the given key.

### Scene atmosphere (2 — compose `surface/dim` + `surface/spotlight`)

`surface/fade-around` (dim everything except the named address), `surface/stage` (theatrical fade + center spotlight).

### Timing composition (8)

`sequence` · `parallel` · `after` · `wait` · `repeat` · `in-window` · `every` · `stagger`

The composition triplet collapsed: **`together` and `with` were dropped; `parallel` is canonical.** Don't try to use the others.

### Mode-aware (4)

`when-mode` · `on-mode-change` · `on-input` · `on-gesture`

The Behavioral Policy lane self-cut from 8 → 4. Don't try the deprecated names; they aren't registered.

---

## §4. The state-machine spine

Every cart is a state machine. The states are operator-meaningful — they name what's happening, not which function is running. Per the **state machine spine canon** (memory entry `project_curator_state_machine_spine`):

```
precondition_fetch  →  guard  →  act  →  result  →  on_error
                                                    ├ retry      ;; (after N 'fetch ctx)
                                                    ├ degrade    ;; (next 'fallback ctx)
                                                    ├ escalate   ;; (escalate 'kind detail)
                                                    └ ask_human  ;; (escalate 'operator-consent …)
```

The cart writes the state functions; the driver routes them. The driver intercepts `(act 'verb args 'on-result)` descriptors, calls the real verb through the dispatcher chokepoint, threads the response into `ctx` via `'last-result`, and jumps to the named `on-result` state.

**Five rules of the spine:**

1. **One side effect per state.** A state function either guards or `(act …)`s — never both, and never two `(act …)`s.
2. **Result-handler names match outcome, not function position.** `'check-fetch`, `'check-publish`, `'check-reason` — not `'step-2`.
3. **Every `(act …)` has a named `'on-result`.** No anonymous continuations.
4. **The final state calls `(done)`.** Never an inline `(done)` mid-flow.
5. **`(escalate …)` carries a closed `'kind` symbol.** Free-form strings break the surface's switch. Use §I of the mini-spec.

---

## §5. Verb-namespace registry (where `(act …)` calls live)

| Namespace | Live verbs (representative) |
|---|---|
| `etsy/` | `receipts`, `listings`, `listing`, `images`, `inventory`, `reviews`, `publish`, `update-listing`, `mark-shipped`, `reprice`, `delete-listing`, `upload-image`, `conversations`, `ledger`, `sections`, `shop`, `relist`, `create-draft` |
| `ebay/` | `listings`, `publish`, `update`, `fees` |
| `shopify/` | `products`, `orders`, `update` |
| `meta/` | `products`, `orders` |
| `google-merchant/` | `status`, `sync`, `violations` |
| `pinterest/` | `status`, `pin`              (tier-gated; verify W40) |
| `perplexity/` | `search`                    (tier-gated; verify W01) |
| `firecrawl/` | `policy-lookup`, `page-scrape` (operator-facing name: "web search") |
| `sakura/` | `decide` (local), `cloud-reason` (relay), `say` (voice) |
| `cortex/` | `remember`, `recall`, `forget`, `calendar` |
| `audio/` | `bar-clock` |
| `voice/` | `speak`, `listen` |
| `music/` | `score-play`, `transport-set` |
| `scene/` | `fade-others`, `bring-together`, `restore` |
| `paint-*` (top-level) | `paint-marquee`, `paint-flow`, `paint-burst`, `paint-glow`, `paint-pipe`, `paint-text`, `paint-clear` |
| `card-*` (top-level) | `card-do`, `card-emit`, `card-ask`, `card-find-by-kind` |
| `input/` | `may-i?` (sensor permission) |
| `on-*` / `when-*` | `on-input`, `on-gesture`, `on-mode-change`, `when-mode` |

**The registry is the law.** Before you write `(act 'foo/bar …)`, confirm `foo/bar` is in the live registry — `curator-web/src/scheme/registry/coreVerbs.js` plus the namespace files (`vendorVerbs.js`, `sakura*`, `etsy*`, etc.). If it isn't, you're not allowed to make it up.

---

## §6. Addressing grammar (the consolidated 9-address table)

| Address | What it names | Example |
|---|---|---|
| `#anchor/<name>` | One of 9 canvas anchor points | `#anchor/center` |
| `#edge-run/<side>` | Parameterized edge segment (u: 0..1) | `(anchor 'edge-run/top :u 0.3)` |
| `#card/<kind>[/<id>]` | A card by kind and optional instance | `#card/etsy/abc123` |
| `#card-area/<addr>/<region>` | Sub-region of a card | `#card-area/etsy/header` |
| `#beat/<m>/<b>` | Audio-clock measure + beat | `#beat/3/2` |
| `#input/<sensor>/<field>` | Live sensor value | `#input/gyro/tilt-x` |
| `#note-glyph/<dur>` | Canonical 48×48 note body | `#note-glyph/quarter` |
| `#sprite/<id>` · `#note/<id>` · `#prop/<id>` | Character instance | `#sprite/blossom-3` |
| `#class/<kind>` | Class-level (all instances) | `#class/sprite` |

`(resolve <addr>)` is the lazy viewport-aware resolution verb. Use it at dispatch boundaries.

---

## §7. Tier conventions (flavor token in the header)

| Flavor | Tier | What it means |
|---|---|---|
| `white` | Free | Read-only / Cortex-only / no cloud / no writes |
| `pink` (a.k.a. `blossom`) | Free | Local-Sakura + Cortex; on-device only |
| `green` | Free | Event-triggered local automation |
| `mint` | Standard $9.99 | Multi-platform reads + scheduled tier-allowed cloud |
| `light-purple` | Magic $39.99 | Cloud-relay reasoning (Sonnet); multi-platform writes |
| `purple` | Magic $39.99 | Legacy label for `light-purple` (still accepted) |
| `dream` | Dream $99 | Opus + voice + scene + Score + audio composition |
| `gray` | Internal | Engine/debug/relay carts; not operator-visible |

**Tier-gate guard pattern** (mandatory for any cart whose service may not be wired yet):

```scheme
(define (start ctx)
  (act 'pinterest/status '() 'check-tier-eligible))

(define (check-tier-eligible ctx)
  (let ((status (ctx-result ctx)))
    (cond
      ((eq? status 'not-yet-wired) (escalate 'service-not-yet-wired null))
      ((not (eq? status 'connected)) (escalate 'service-not-connected null))
      (else (next 'fetch ctx)))))
```

---

## §8. The 12 rules (forever-code laws)

These are the auto-reject conditions. The linter checks some; the human reviewer checks the rest.

1. **Idempotent.** Run the cart twice on the same inputs — the result must be the same and no double-write must happen. If you must write, write through an upsert path the host owns.
2. **Honest about gaps.** Every error path returns a closed `(escalate 'kind …)` symbol. No silent `#f`. No `(error …)` strings.
3. **Cortex first, network second.** Read `cortex/recall` before you call `etsy/receipts`. The network is rate-limited and expensive; Cortex is local and instant.
4. **Open-loop control.** Never poll a handle. Compose via the driver: use `(after N 'state ctx)` to defer, `wait` to block, `(act … 'on-result)` to await a tool call.
5. **Determinism propagation.** If any branch of a `(cond …)` could call a non-deterministic verb, the whole form is non-deterministic. Declare it honestly (the registry tracks this; the linter checks it).
6. **PII redaction at every boundary.** Names, emails, addresses, phone numbers, photos must be scrubbed BEFORE they cross to cloud or hit a paint primitive that touches a screenshot.
7. **Rate-limit aware.** On `'rate-limited`, always `(after 30 'fetch ctx)` (or longer). Never retry-storm.
8. **Tier-gated cloud.** A `white` or `pink` cart MAY NOT call `sakura/cloud-reason` or any tier-gated service. The linter rejects this combination.
9. **No vendor names in operator-facing strings.** Customer-facing strings (`paint-marquee`, `sakura/say`, `voice/speak`) say "deep reasoning" not "Sonnet"; "web search" not "Firecrawl"; "answers" not "Perplexity". Marketplaces (Etsy, eBay, Meta, Shopify, Pinterest) STAY visible. Backend keeps the real names.
10. **Crisis: never replace real resources.** If a cart could be operating on a buyer in distress (sentiment carts, sympathy cards, mood check-ins), it must include language that surfaces 988 or professional help — and it must NEVER position itself as a replacement.
11. **Audit log isn't your job.** The registry chokepoint instruments every `(act …)` call automatically. Do NOT `card-emit` duplicate audit events; that double-counts the audit log and breaks the replay.
12. **Comment block per code unit.** Every top-level `(define …)` carries a preceding `;;` block answering WHAT / TECHNIQUE / WHY / CONSTRAINT (minimum 2 lines, the four-part block recommended). The cart-file documentation block covers the cart-scope claim. Full spec in `CODE-COMMENT-STANDARD-2026-06-14.md`; dialect linter follow-on tracked as clause C11.

---

## §9. Visual house style (forever code = beautiful)

The bar Alfred set: *"write them so beautifully that people will vomit when they see it."* That means:

- **2-space indentation, no tabs.** Period.
- **Section dividers** — `;; ── <label> ` followed by a run of `─` to about column 64. Mark the major beats of the cart (helpers / state functions / entry point).
- **Comment block above each `(define …)`** — the four-part block (WHAT / TECHNIQUE / WHY / CONSTRAINT) per `CODE-COMMENT-STANDARD-2026-06-14.md`. Minimum 2 lines; full block recommended. The block is the spec; the code is the implementation; they must agree.
- **`ctx` keys** are dash-separated lowercase symbols, consistent within a cart. (`'listing-id` not `'listingId`; `'sale-id` not `'saleID`.)
- **Names read like the operator would say** — `seasonality-pulse`, not `kpi-monthly-bucket-rank`. `gift-finder-for-partner`, not `cortex-cloud-relay-gift`.
- **No throwaway helpers.** Every `(define …)` earns its place. A helper used once gets inlined. A helper used twice gets named.
- **No tail commentary.** Comments live ABOVE the code, never to its right (the linter strips trailing comments anyway).
- **Whitespace tells the story.** A blank line between a `(define …)` and the next means "new beat." Two blank lines means "new section." Never three.

---

## §10. The 5 patterns we use (with one exemplar each)

The 15 carts in this package are organized by pattern. When a contractor asks "what shape do I write?", point them at the exemplar.

| # | Pattern | Exemplar |
|---|---|---|
| 1 | **Analysis** — read-only, tabular output | `etsy/orders-week.sks` |
| 2 | **Local automation** — Cortex + local Sakura | `etsy/detect-near-duplicate-image.sks` |
| 3 | **Cloud-relay automation** — Sonnet/Opus | `etsy/year-end-summary.sks` |
| 4 | **Scene** — multi-step orchestration | `scenes/reconcile-sold.sks` |
| 5 | **Cross-platform** — Etsy ↔ eBay etc. | `scenes/transfer-shop-to-shop.sks` |

The 15 golden-standard carts (see §13) demonstrate each pattern across each tier and against each service. They are the reference for "is this contractor's output up to bar?"

---

## §11. Anti-patterns (auto-reject)

If your cart contains any of these, it gets bounced:

- **Inventing verbs not in the registry.** The cloud relay's constrained decode and the linter both reject this at the dispatch boundary.
- **Polling a handle for completion.** Open-loop is the contract.
- **Mixing two unrelated automations in one cart.** Split it.
- **Silent failures.** No `(if (…) #f (…))` swallowing errors. Always escalate.
- **Hard-coded credentials.** The host injects auth into the dispatcher. If you wrote a string that looks like an API key, the cart is wrong-shaped.
- **Vendor names in operator-facing strings.** Per §8 rule 9.
- **Direct mutation outside `(act …)`.** Carts don't write to the world except via the driver-mediated act path.
- **Inline lambdas as `on-result`.** Must be a quoted symbol referencing a top-level `define`.
- **`(while …)`, `(do-while …)`, manual `(let loop …)` over a non-deterministic condition.** Loop forms over deterministic bounds (`(repeat N …)`, `(let loop … bounded)`) are allowed; over a sensor or wall-clock condition they aren't.
- **Using `together` or `with` for parallel composition.** Use `parallel`.

---

## §12. Review criteria (a cart passes IFF…)

1. **Linter passes.** Dialect-conformant per the 10 conformance clauses in `LANGUAGE-REPORT-2026-06-13.md` §8. Every verb in the registry. Every address resolves. Determinism field honest.
2. **Fake-shop replay matches the cart's declared intent.** The fake-shop runs the cart against canned data; the audit log should read like a story matching the cart's `summary` field.
3. **Visual: passes the house-style checklist.** §9 above. Two-space indent. Section dividers. Four-part comment block above each define (per `CODE-COMMENT-STANDARD-2026-06-14.md`). Operator-meaningful names. No trailing comments.
4. **Forever: a reader three years from now still understands intent.** The cart's documentation block explains *why*. The code reads top-to-bottom as a story.

If any one of these fails, the cart goes back to the contractor with a one-line review comment citing the failed criterion.

---

## §13. The 15 golden-standard carts (this package's deliverable)

| # | slug | tier | pattern | path |
|---|---|---|---|---|
| 1 | `seasonality-pulse` | free (white) | analysis (Cortex-only) | `carts/etsy/seasonality-pulse.sks` |
| 2 | `competitor-watch-light` | free (pink) | scheduled analysis (Firecrawl wired) | `carts/etsy/competitor-watch-light.sks` |
| 3 | `holiday-lead-time-warn` | free (white) | scheduled alert (Cortex calendar) | `carts/etsy/holiday-lead-time-warn.sks` |
| 4 | `tag-cleanup-suggest` | free (pink) | local-Sakura suggestion | `carts/etsy/tag-cleanup-suggest.sks` |
| 5 | `cs-message-draft-reply` | standard (mint) | local-Sakura draft | `carts/etsy/cs-message-draft-reply.sks` |
| 6 | `price-anchor-vs-median` | standard (mint) | analysis with reasoning | `carts/etsy/price-anchor-vs-median.sks` |
| 7 | `pin-photo-to-pinterest` | standard (mint) | cross-platform publish (tier-gated) | `carts/scenes/pin-photo-to-pinterest.sks` |
| 8 | `anti-undercut-reprice` | magic (light-purple) | cloud-relay reasoning + multi-platform | `carts/scenes/anti-undercut-reprice.sks` |
| 9 | `quarter-end-narrative` | magic (light-purple) | cloud-relay narrative | `carts/etsy/quarter-end-narrative.sks` |
| 10 | `dream-scene-calm` | dream | Opus + Score + scene atmosphere | `carts/scenes/dream-scene-calm.sks` |
| 11 | `bedtime-story-engine` | dream | voice + scene + music | `carts/scenes/bedtime-story-engine.sks` |
| 12 | `the-letter-sympathy` | dream | dot-matrix handwriting + envelope | `carts/scenes/the-letter-sympathy.sks` |
| 13 | `mood-check-in` | free (pink) | local Sakura conversational | `carts/personal/mood-check-in.sks` |
| 14 | `daily-news-brief` | standard (mint) | Perplexity-gated (W01) | `carts/personal/daily-news-brief.sks` |
| 15 | `gift-finder-for-partner` | magic (light-purple) | Cortex + cloud-relay | `carts/personal/gift-finder-for-partner.sks` |

These 15 are the bar. New contractor work is compared against them.

---

## §14. Submission template (what the contractor sends back)

A contractor delivers four artifacts:

1. **The `.sks` file** at the canonical path under `curator-web/src/scheme/carts/<area>/<slug>.sks`.
2. **A 3-line summary** of what the cart should do, in the operator's voice.
3. **The fake-shop fixture inputs** (any non-default `ctx` values) needed to exercise the cart.
4. **The verbs it consumes**, cross-referenced against §5 (`etsy/receipts`, `sakura/decide`, etc.). One line per verb.

The reviewer runs the cart against the fake-shop, watches the audit log, checks the four §12 criteria, and posts a one-paragraph verdict.

---

## §15. Open questions (escalate to owner)

Honest research flags surviving the v1 cut:

1. **`'service-not-yet-wired` vs `'service-not-connected`** — Pinterest, Perplexity, and the music-engine all need a tier-gate guard. Two escalate kinds proposed: `'service-not-yet-wired` (the platform's not in our infra yet) vs `'service-not-connected` (it's wired but this operator hasn't OAuth'd). The 15 exemplars use both honestly per-cart; the surface needs a chip that distinguishes them.
2. **Cortex calendar address grammar** — Does the holiday-lead-time-warn cart read `(cortex/calendar 'us-major)` or `(cortex/recall '(:topic holidays :region us))`? The exemplar takes the explicit-verb shape pending Cortex API freeze.
3. **`scene/dream-atmosphere` macro shape** — Is a dream-tier "atmosphere" a one-shot composition of `surface/dim` + `surface/spotlight` + music score, or its own macro? The dream-scene-calm cart inlines the composition; lifting it to a macro is a §3 candidate.
4. **`voice/listen` interruption shape** — The bedtime-story-engine assumes `(interrupted 'voice ctx)` will fire if the listener wakes; the cartPrelude tagged that descriptor but the engine binding isn't pinned. Verify before bedtime-story-engine lands behind a paywall.
5. **Personal-cart directory** — These 15 introduce `carts/personal/` (mood-check-in, daily-news-brief, gift-finder-for-partner). Manifest scaffold included; SchemeStore must register it.

---

## §16. Why this exists (the closing word)

A contractor — human or LLM — who reads this doc plus the mini-spec plus the 15 exemplars knows exactly what shape we accept. The bar is the bar. Beauty is part of the bar. The cart they send back is either ready to merge or it's not, and the review is fast either way.

The 15 exemplars matter because **examples teach faster than rules.** A contractor who's read the rules once and the carts twice will write a fourth that passes review on the first try. That's the goal: make excellence reproducible by handing over an exact-fit reference.

The next contractor who opens this doc walks away knowing how Curator's automation layer thinks.

*Authored 2026-06-14 for the Sakura Scheme contractor-handoff pipeline.*
