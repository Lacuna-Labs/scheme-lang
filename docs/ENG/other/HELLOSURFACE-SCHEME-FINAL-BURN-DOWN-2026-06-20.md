# HelloSurface + Sakura Scheme — FINAL Pre-Beta Burn-Down

> Composed from 5 parallel Lacuna Engineering agents who each read the
> actual docs + code with file:line citations. Not a synthesis from
> memory. Beta target: 2026-07-04 (14 days). Today: 2026-06-20.
>
> **Verdict at a glance**: HelloSurface + Scheme spine works end-to-end
> for non-stub paths and survives Priya's adversarial pass with **0
> BETA-BLOCKER bugs**. But the security + behavior-honesty surface has
> **REAL beta-killing gaps**: 5 CRITICAL security holes (any one kills
> the tier model on day one), 17 paint primitives that silently no-op
> (fluent-wrong about Sakura magic), and the entire cart cost-HMAC layer
> is unenforced. The Architect's read: **6.8/10 composite, plausible-
> not-safe at July 4.** Three days of focused work close most of it.

**Agent IDs (verifiable, real research not voiced from memory):**
- Architect — `a515c59af87e4d54c` (77s, 7 tool uses)
- Daisy — `a89ad5edf8bc4ed4d` (189s, 36 tool uses)
- Priya — `a56c631a91a1aa076` (343s, 67 tool uses)
- Soo-Jin — `a211ce5463e3a2be0` (426s, 73 tool uses)
- Marcus — `a60d2fa8fa0fe7dda` (565s, 122 tool uses)

---

## 1. TL;DR — what to do tomorrow

Three days of focused engineering, in this order, gets the surface
beta-defensible:

| Day | Lane | Hours | Why |
|---|---|---|---|
| **Sun Jun 21** | **Security floor** — S1 (HMAC verify), S2 (deduct in every cloud-LLM endpoint), S4+S5 (websocket auth), S6 (open-redirect), S10 (OAuth XSS), S11 (XFF) | ~8h | Without these, opening paid tiers July 4 is reckless. |
| **Mon Jun 22** | **Honesty closure** — W1-W10 (fill gfx adapter so 17 paint primitives actually paint), W16 (cost_hmac into cart index), W17 (wire 31 missing verb backings) | ~10h | Each "Sakura did X" claim becomes true. |
| **Tue Jun 23** | **Visual ship-blockers** (V1+V2+V3 phosphor compositing bugs from tonight), **Priya P1** (perm vocab collision), **doc drift** (P3 anchors, P20 pitch contradiction) | ~6h | Closes the bugs I shipped last night + makes the engineering doc accurate. |

That's 24 focused hours over 3 days. Leaves **11 days for the 10
MINIMUM SHIP product items** (onboarding, voice, store-loads,
publish, focus mechanism, grammar decoder, sprites visible on real
device, reference manual, scale check) per the Architect's earlier
cut. Realistic completion: 80% of MINIMUM SHIP by July 4.

---

## 2. Scorecard (per Architect)

| Axis | Score | Note |
|---|---|---|
| Architectural completeness | **8/10** | Three-layer split clean, eight-star spine real, descriptor catalog solid. Gaps: worker bridge scaffolded but not wired; L2 lacuna/* verbs not registered. |
| Behaviour-honesty | **7/10** | `service-not-yet-wired` envelope disciplined. 586/1,873 carts honest-stub. **BUT**: ML1 grammar decoder NOT shipped → Sakura can still emit nonexistent verbs. |
| Visual-craft | **7/10** | Tonight's work +1 (centered circles, brand marks, 4px pitch, idle breath, shimmer). Real-iPhone+iPad screen-record gate still owed. |
| Performance | **6/10** | AST cache LRU, body cache lazy, code-split per cart. 4096+4px on A12 untested. HelloSurface.jsx 4683-line bus factor. |
| Security | **6/10** | Capability-bounded by construction. `freeze()` real. **BUT**: server-side token ledger NOT closed; HMAC + validator pre-flight not wired. **Cannot ship paid tiers below this floor.** |

**Composite: ~6.8/10.** Beta-defensible if the bottom three each gain 1 point in 14 days.

---

## 3. CRITICAL findings — beta-blockers as currently scoped

### 3A — Security (Soo-Jin, 5 CRITICAL)

| # | Title | File:line | Fix effort |
|---|---|---|---|
| **S1** 🔴 | Cart cost HMAC never verified server-side | `curator-api/curator_api/routes/tokens.py:107-171` (signing.verify_cart_cost_hmac defined but only called from CLI) | 1-2h |
| **S2** 🔴 | Most LLM endpoints never call `deduct_tokens` — token economy is honor-system | `app.py:3208,3276,4502,4537,4087,4115,2432,5318,5474,4955` + `routes/sakura_chat.py:440,679` | ~half-day retrofit |
| **S3** 🔴 | STT deduction is post-success + soft-fail (DoS DB, get free STT) | `routes/sakura_transcribe.py:200-232` | 30 min |
| **S4** 🔴 | `/ws/logs` streams logs to anyone (no auth) | `app.py:6071-6092` | 15 min |
| **S5** 🔴 | `/ws/uploads/{account_id}` cross-operator subscribable | `app.py:4379-4395` | 15 min |

**These five alone are a beta-blocker** as currently scoped. S2 + S1 together = total cost-drain (paid tiers are fiction). S4 + S5 = cross-operator info leak on day one.

### 3B — Behavior honesty (Marcus, 17 paint primitives + 2 critical wiring gaps)

**W1–W10 🔴** — 17 paint primitives silently no-op because the production `gfx` adapter (`sprites/render.js:36 makeSpriteGfx`) only implements `{dot, beginFrame, spriteGlow, spriteDot, spriteShadow}`. The Paint Kit primitives guard `if (!gfx.X) return` against methods that don't exist:

| Primitive | Guards on | File | Fix |
|---|---|---|---|
| paint-line | gfx.line | `paint/primitives/line.js:16` | Add gfx.line → c2d.lineTo |
| paint-rect | gfx.rect | `rect.js:22` | Add gfx.rect → c2d.fillRect/strokeRect |
| paint-circle | gfx.circle | `circle.js:12` | Add gfx.circle → c2d.arc+fill |
| paint-arc | gfx.arc | `arc.js:15` | Add gfx.arc |
| paint-spiral | gfx.polyline | `spiral.js:28` | Add gfx.polyline |
| paint-twinkle | gfx.twinkle | `twinkle.js:17` | Add gfx.twinkle |
| paint-arrow | gfx.arrow | `arrow.js:16` | Add gfx.arrow (headline "Sakura points") |
| paint-point-at | gfx.arrow | `point-at.js:18` | (shares arrow) |
| paint-glow | gfx.glow | `glow.js:16` | Add gfx.glow (Sakura signature halo) |
| paint-heart | gfx.glyph | `heart.js:16` | Add gfx.glyph router |
| paint-star | gfx.glyph | `star.js:12` | (shares glyph) |
| paint-surround | gfx.glyph | `surround.js:26` | (shares glyph) |
| paint-flow | gfx.glyph | `flow.js:38` | **THE TRANSFER DEMO PRIMITIVE per HelloSurface §6.1 — silently doesn't draw today** |
| paint-highlight | gfx.outline | `highlight.js:16` | Add gfx.outline |
| paint-pulse | gfx.outline | `pulse.js:16` | (shares outline) |
| paint-mesh | gfx.line | `mesh.js:44` | Phase A stub but emits 'paint.applied' chip |
| paint-clear (region) | gfx.clear | `clear.js:15` | Add gfx.clear region form |

**Total effort: 1-2 days** to implement 6 missing gfx adapter methods on `makeSpriteGfx` (line, rect, circle, arc, glyph, glow, outline, polyline, twinkle, clear). After this, 17 primitives flip from wired-lies to actually-paints.

**W16 🔴 — Cost HMAC missing from all 1,873 carts.** Spec LOCKED 2026-06-18 per memory; never implemented. `scripts/build_cart_index.mjs` doesn't emit `cost_hmac`. `curator-web/src/scheme/carts/index.json` has 0 occurrences. **The entire pricing ladder is unenforced — browser can claim any cart costs 1 token.** ~1d to: add HMAC emit at index build + verify at dispatch handler.

**W17 🔴 — Verb backings dispatch only 5 of 36 server routes.** `BACKING_ROUTES` in `runtime/verbBackings.js:21` exposes `{cortex/recall, cortex/remember, loam/operator-state, model/fast, model/workhorse}`. Backend has 36 handlers (etsy/listings, etsy/receipts, sakura/decide, shopify/products, web/scrape, web/search, model/draft, model/deep-reasoning, ebay/listings, instagram/post, ads/insights, analytics/report, vision/label, documents/parse-invoice, …). **31 verbs silently escalate even though backend would serve.** ~20 min mechanical edit.

### 3C — Visual ship-blockers from tonight's work (Daisy)

| # | Issue | File | Fix |
|---|---|---|---|
| **V1** 🔴 | `substrate-shimmer` compounds with focus-mode `filter: blur` on camera-stage — world pulses through focused dashboard | `motion.css:464-466` + `cards.css:1324-1330` | Pause shimmer when `body[data-card-focused="true"]`. 5 min. |
| **V2** 🔴 | `substrate-shimmer` runs when tab hidden — battery hog (CSS infinite filter doesn't auto-pause in Safari) | `motion.css:464-466` | `visibilitychange` JS listener + CSS `animation-play-state: paused`. 30 min. (Same fix for `sakura-card-idle-breath`.) |
| **V3** 🔴 | `sakura-card-idle-breath` fires during FLIP exit + portal transitions — competing transforms | `motion.css:441-450` | Extend `:not()` guard to include `--exiting-focus` + `--flip-play`. 1 line. |

These three are direct consequences of code I shipped tonight. All <1h total. Must close before announcing the layer "ships."

---

## 4. ORANGE findings — pre-beta nice-to-fix

### 4A — Architecture (Priya, 9 ORANGE)

| # | Title | File:line | Fix |
|---|---|---|---|
| **P1** 🟠 | Two `VerbRegistry`s with different perm vocabularies. Spine registry rejects `paint`/`destructive`/`network` perms that the dispatcher table requires. | `scheme/registry/VerbRegistry.js:55-61` vs `runtime/dispatch.js:65-72` | 30 min — fix `isValidPerm` |
| **P2** 🟠 | Doc §5.3 lists installers that don't match code (surface/* names wrong) | `SAKURA-SCHEME-1.0-ENGINEERING.md:572-578` vs `primitives/surface.js:105-150` | 10 min doc fix |
| **P3** 🟠 | Approval-checklist file:line anchors stale across the doc | `SAKURA-SCHEME-1.0-ENGINEERING.md:1832-1856` vs `interp.js`, `dispatch.js` | 45 min anchor sweep |
| **P4** 🟠 | `Math.random()` in dispatcher trace IDs — replay byte-identity broken | `runtime/dispatch.js:430-435` | 20 min |
| **P5** 🟠 | `grid/dot`, `grid/glow`, `grid/clear` register without explicit `perm` — slip past startup validator | `sprites/flowers.js:195,202,209` | 10 min add `perm: 'paint'` |
| **P6** 🟠 | `motion/follow-input` + `motion/anchor-to-input` declare `animate` but body is NOT-YET-WIRED — emits chip on no-op | `primitives/motion.js:200-205,310-320` | 30 min (escalate honestly) or 2h (wire sensor bus) |
| **P7** 🟠 | Worker bridge `verb-call` silently dropped — "sandbox isolation" claim is aspirational | `runtime/workerBridge.js:84-89` | 15 min add LOG of unhandled |
| **P8** 🟠 | `MotionHandle` claims frozen but `Object.create` wrapper exposes mutable own-properties | `primitives/motion.js:142-152` | 15 min |
| **P9** 🟠 | `safetyStars.withStars` 8-star contract collapses retry/degrade/escalate/ask_human to a single string router — no per-error-class branching | `safetyStars.js:117-149` | 30 min doc | 2h proper |

### 4B — Security HIGH (Soo-Jin, 7 HIGH)

| # | Title | File:line | Fix |
|---|---|---|---|
| **S6** 🟠 | OAuth open-redirect via `redirect` query param | `app.py:727` + `_auth.py:274-315` | 5 min require `startswith("/")` |
| **S7** 🟠 | Default `cardDo` tier = `operator-gesture` + `confirmed=true` — devtools/extension fires destructive verbs without gate | `surface/card-api/index.js:189` | 1h + audit callers |
| **S8** 🟠 | Podcasts SSRF (DNS-resolved + redirect-follow + xml.etree + unauth) | `routes/podcasts.py:410-467,532,554` | 2h (use proxy_audio _PinnedDNSBackend pattern) |
| **S9** 🟠 | `/api/web/fetch` unauth + DNS-only literal check (SSRF) | `web/fetch.py:75-104` + `app.py:4502` | 1h |
| **S10** 🟠 | OAuth callback HTML allows script breakout via `error` param (XSS) | `routes/oauth.py:817-844,869` | 30 min — escape `</` in JSON |
| **S11** 🟠 | XFF spoof bypasses per-IP rate limits | `_auth_rate_limit.py:52-65`, `public_ask.py:108-115`, `_beta_gate.py:87` | 30 min use Fly-Client-IP |
| **S12** 🟠 | `/api/cortex/image/{sha256}` unauth → cross-operator read | `app.py:4904-4922` | 1-2h key by `(operator_id, sha256)` |

### 4C — Behavior SILENT-NO-OPs (Marcus)

| # | Title | File:line | Fix |
|---|---|---|---|
| **W11** 🟠 | `motion/move-to`, `motion/halt`, `motion/follow-input`, `motion/anchor-to-input` — return MotionHandles with no consumer | `primitives/motion.js:286,298,310,322` | 1-2d wire consumer OR 30min honest pre-flight error |
| **W12** 🟠 | `surface/dim`, `surface/spotlight`, `surface/curtain` — return SurfaceHandles with no renderer | `primitives/surface.js:114,126,138` | Same options |
| **W13** 🟠 | `(timeline …)` `(animate …)` `(keyframe …)` — return frozen specs with no playback consumer | `fxVerbs.js:113,121,142` | Same options |
| **W14** 🟠 | `installVendorVerbs` has ZERO callers — 13 vendor verbs (Printify/Shippo/QuickBooks/Canva) are dead code in production | `vendorVerbs.js:139` | 10 min wire to runWithCards + cartHost drainer |
| **W15** 🟠 | `appBuilder` primitives (define-app/button/form, 13 verbs) have no renderer — write to in-process Maps, nothing reads | `appBuilder.js:83-199` (NEW THIS SESSION) | filed in chip+sys burn-down |

---

## 5. YELLOW — doc drift + structural

| # | Title | Source |
|---|---|---|
| **P10** | `model/deep` referenced in docs/carts but registered as `model/deep-reasoning` mismatch | Priya |
| **P11** | `card-do`, `card-emit`, `card-ask` admit NOT-YET-WIRED in source but register as functional | Priya |
| **P12** | Hand-curated tier-manifest sentinel has no test guarding it | Priya |
| **P13** | trace-counter wraps at 2^32 — collision risk on long sessions | Priya |
| **P14** | `cartDriver.js:432` uses `Date.now()` — non-deterministic in replay | Priya |
| **P15** | `cartLint.js` "dead/unreachable states" check is claimed but not implemented | Priya |
| **P16** | Doc §5.2 promises 18 capability verbs that are act-routed, not primitives — structurally misleading | Priya |
| **P17** | `sakura/decide`, `sakura/emit-structured`, `sakura/dream` (THE NORTH STAR) not registered | Priya |
| **P18** | 16-flower roster table fiction — only BLOSSOM pattern exists | Priya |
| **P19** | 32 stubbed verbs in `scheme/index.js` undisclosed in Honest Gaps §17 | Priya |
| **P20** | flowers.js says 4px pitch / 17 dots; HelloSurface §29d still says 6px pitch / 16 dots — contradiction | Priya |
| **V4** | Tier-accent CSS variables declared but keyframes hardcode literals (don't read the var) — fluent-wrong | Daisy |
| **V5** | `:root[data-tier='magic']` never gets stamped — no JS writer exists | Daisy |
| **V6** | `flowers.js BLOSSOM` (17 dots, sparse) vs `SpriteTestPanel.jsx BLOSSOM_DOTS` (densely-filled mandala) — same id, completely different flowers | Daisy |
| **V7** | `render.js dot()` draws 6px squares on 4px grid → adjacent dots OVERLAP (dot-matrix discreteness collapses) | Daisy |
| **V13** | `will-change: transform` on every cell-inner for an infinite animation = N persistent GPU layers | Daisy |
| **V14** | Sakura Magic™ grid is BLACK at 1% not PURPLE — signature element #1 regressed | Daisy |
| **W18-W23** | ✅ Camera, audio, anomaly, grid/*, paint-dots/text/marquee/emoji/burst/fireworks/pipe, glyph-* — ACTUALLY WORK | Marcus |
| **W24-W27** | 🟡 shopServicesVerbs, shopVerbsRuntime, cardVerbs notYet helpers — HONEST STUBS, well-disciplined | Marcus |
| **W28** | `card-effect` non-glow magics (pulse/shimmer/sparkle/echo/ghost/bloom) — verify each CSS keyframe exists | Marcus |

---

## 6. The MINIMUM-MINIMUM ship (per Architect)

If everything slips, what's the floor that's still honest for July 4?

1. **Onboarding V5** — operator opens app, picks avatar, connects one shop, sees one card
2. **Store loads** — Etsy listings populate (already in flight)
3. **Publish one listing honest** — at minimum Etsy; eBay/Shopify defer if needed
4. **Server ledger + validator pre-flight (S1+S2+S3)** — financial/legal floor
5. **One focus mechanism** — every card opens the same way (Deliverable B)
6. **Sprites visible on real device** — 80% done with tonight's work
7. **Reference manual** — 1d
8. **Doesn't crash** — D1 (4096+4px) thermal-tested on iPad A12

**Defer past July 4 if forced**: voice (3d), grammar decoder (2d). Bundled GGUF placeholder + chat textarea covers absence. Sakura speaks fewer verbs, but every verb she speaks is real. **That's the honesty wall.**

---

## 7. Top 3 beta-killers (Architect)

1. **B8 server-side ledger ships untested.** Single largest legal surface. ROSCA disclosure for $9.99/$39.99/$99.99 tiers attaches here. Mitigation: pen-test the HMAC replay path before July 2. If you can't, **don't open paid tiers on July 4 — open Free-tier-only beta. That's still honest.**

2. **Visual-golden gate skipped on real device.** Per CLAUDE.md the iOS Reduce Motion bug was caught only by screen-recording. Mitigation: cut the film **Friday July 3**, NOT day-of.

3. **HelloSurface.jsx is 4,683 lines.** That's a bus factor, not a metric. If Deliverable B (one focus mechanism) hits coupling deep in that file, day-budget evaporates. **Spike-test Sunday June 21** — if you can't unify card focus in 4h of probing, cut to "Etsy/eBay/Shopify cards only ship the unified path; others defer to 2.7."

---

## 8. Training-pivot gate

Per CLAUDE.md hard gate. Five items must land BEFORE "train her now":

1. **F8 corpus integrity verified** (already produced; one verify run)
2. **ML1 grammar decoder shipped** — without this, Sakura emits fluent-wrong and training on that surface produces a liar
3. **Scheme parser + verb registry frozen** for the training window
4. **B8 ledger live** so cost-budgeted training carts work
5. **One full E2E dispatch on dev** — voice → Cortex → cart → response, honest

**Plausible training start**: night of **Wed 2026-07-02** if MINIMUM SHIP holds. First checkpoint **Mon 2026-07-06**. If B8 or ML1 slips ≥2 days, training starts post-beta. Survivable. **Do not let the training pivot pressure you into shipping a feature you didn't need.**

---

## 9. Calendar — 14-day plan

| Date | Lane | Goal |
|---|---|---|
| **Sun 06-21** | Security floor + Deliverable B spike-test | S1, S2, S4, S5, S6, S10, S11 + 4h focus-mechanism probe |
| **Mon 06-22** | Honesty closure | W1-W10 (fill gfx adapter), W16 (cost_hmac at build), W17 (31 backings) |
| **Tue 06-23** | Visual ship-blockers + perm vocab | V1, V2, V3 + P1 + P3 anchor sweep + P20 doc fix |
| **Wed 06-24** | V5 onboarding | First-run, avatar, one shop |
| **Thu 06-25** | V5 onboarding (cont.) + Deliverable B | Finish onboarding + ship focus mechanism (or cut to shop-cards-only) |
| **Fri 06-26** | V3 voice + STT cost metering | STT live + metered |
| **Sat 06-27** | V3 voice (cont.) + publish polish | Voice + Etsy publish honest |
| **Sun 06-28** | ML1 grammar decoder | XGrammar + verb registry export |
| **Mon 06-29** | ML1 (cont.) + reference manual | Decoder + Sakura Scheme 1.0 Reference covers shipping verbs |
| **Tue 06-30** | iPad thermal test + visual goldens | Real-device screen-records on iPhone A12 + iPad |
| **Wed 07-01** | Caliper + a11y + perf | LCP/TBT/CLS pass; a11y audit |
| **Thu 07-02** | **TRAINING-START GATE** | All gate items verified; training fires night-of |
| **Fri 07-03** | **CUT THE FILM** + beta-eve checks | Real-device walkthrough recording; final smoke tests |
| **Sat 07-04** | **PUBLIC BETA** | Free-tier opens; paid tiers IFF security floor closed |

---

## 10. Punch list (what's left, by severity)

🔴 **DO BEFORE BETA** (effort < 1d each, total ~3-4d):
- S1 cart HMAC verify (1-2h)
- S2 deduct in cloud-LLM endpoints (~half-day)
- S3 STT deduction pre-success (30min)
- S4 /ws/logs auth (15min)
- S5 /ws/uploads/{id} auth (15min)
- W1-W10 gfx adapter (1-2d)
- W16 cost_hmac at index build (1d)
- W17 wire 31 verb backings (20min)
- V1 shimmer pause on focus (5min)
- V2 visibilitychange pause (30min)
- V3 idle-breath guard widen (1min)
- P1 perm vocab reconcile (30min)
- P3 doc anchor sweep (45min)

🟠 **PRE-1.0** (after beta or polish week):
- S6, S7, S8, S9, S10, S11, S12 — security HIGH
- P2, P4-P9 — architecture cleanup
- W11-W15 — animation engine consumers OR honest pre-flight
- V4, V5 — tier-accent wire OR mark as not-shipped
- V6, V14 — Sakura Magic™ signature consolidation

🟡 **POST-1.0** (2.7+ backlog):
- P10-P20 — doc drift, naming, mismatches
- V7, V13 — dot-overlap geometry, will-change cleanup
- W18-W27 — already honest, no action
- W28 — verify card-effect CSS keyframes

⚪ **NICE-POLISH** (whenever):
- S13-S20 — info-level security
- V8-V12 — subtle visual polish
- Phosphor #2-#6 — day/night, dust motes, brand pulse, voice listen, camera pan

---

## 11. Bottom line

Today's circle/letter-mark/pitch/appBuilder work moved real points on
visual-craft and architectural completeness. B8 scope-reduction
reclaimed ~2.5d. **Realistic completion of MINIMUM SHIP 10 items: 80%
by July 4** if scope discipline holds, 65% if any new design directive
lands before Monday.

**Sunday June 21 is now the most expensive day on the calendar** — spend
it on B8 security floor (S1-S5) + Deliverable B spike, not on the chip.
Cut the film July 3. Train her July 6.

Beta on July 4 is plausible. Beta with paid tiers on July 4 requires the
security floor (S1-S5 + S6+S10+S11) closed by Monday. If that doesn't
hold: **open Free-tier-only beta. That's still honest.**

---

End of document. Lives at `docs/HELLOSURFACE-SCHEME-FINAL-BURN-DOWN-2026-06-20.md`.
