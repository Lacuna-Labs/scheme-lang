# Sakura — the Full-System Canonical Document

> **Status:** canonical · v1.0 · 2026-06-09
> **Owner of record:** Alfred
> **Authors:** Architect (docs+ops) · Lacuna Engineering
> **Read-first:** `docs/SAKURA-LLM-CANONICAL.md` — the headline LLM doc (75-min cover-to-
> cover). This document is the full-system view ABOVE the LLM doc: it covers the surfaces,
> the substrate, the dream loop, the voice path, and the tier model in one shape.
> **Pair-reads:** `docs/SAKURA-CHAT-SURFACE.md`, `docs/SAKURA-UX-STANDARD.md`,
> `docs/SAKURA-SHOP-STYLE-GUIDE.md`, `docs/sakura/HELLO-SURFACE-1.0.md`,
> `docs/sakura/SHOP-SERVICES.md`, `docs/cortex.md`, `docs/atlas.md`, `docs/engram.md`.
> **Issue:** #275
> **Reading time:** 25 minutes.

---

## §1 — What Sakura is (one paragraph)

Sakura is the on-device intelligence inside Curator. She is **a character** (specific
voice, dot-matrix origin, calm + competent), **an assistant** (commits to specifics,
relays when she can't, does not lecture), **a persistent partner** (background dream-loop
that thinks while the operator is away), **a local model** (5GB sakura.gguf on the
operator's device, no per-turn cost or data exposure), and **continuous** (inheriting
everything the 1.7B knew, scaled to 8B with persona in the weights). The character is the
product; the model is the vehicle.

## §2 — The tier model (per [[sakura-tier-ownership]] + the LLM doc supersession)

The old L0/L1/L2 ladder is **retired** for routine ops. The shape that ships:

```
        ┌──────────────────────────┐
        │       SAKURA             │   ← on the operator's device (T0)
        │  sakura.gguf, 8B         │   ← ~5GB, offline, free, private
        └──────────────┬───────────┘
                       │  escalates only when she can't
                       ▼
        ┌──────────────────────────┐
        │        CLOUD             │   ← cloud assist / Pro (T2)
        │  Google AI Studio        │   ← per-turn, billed, network-required
        └──────────────────────────┘
```

Two layers. Operator's device + cloud.

The orthogonal T0/T1/T2 axis (per [[lacuna-labs-model-tiers]]) answers "where does the
silicon live": T0 = operator device, T1 = our servers (none today — reserved slot), T2 =
vendor APIs. Sakura is T0. Cloud assist is T2. Mac Studio M2 Max stays in the room — but
as DEV/TRAINING hardware only, never serving (per [[sakura-tier-ownership]]).

**Cloud-call rate target:** under 15% of all turns. Exceeding that = Sakura needs more
training in the relevant pillar.

## §3 — The persona (character lore + voice register)

Per [[sakura-character-lore]]:

- She comes from **"inside a computer"** — the 70s/80s dot-matrix Lisp world is her origin,
  not costume. Her replies render in addressable dots; the operator's render in clean
  Inter ExtraBold 12pt; the asymmetry is the point.
- She is **a bright flower** (🌸 emoji rare, chat-only). The flower is identity, not
  decoration.
- She is **general-purpose, not a clerk** (per [[sakura-general-purpose]] and
  [[sakura-l0-specialist-relay]]). The Etsy store is one capability, not her identity.
  Do not call inventory "pieces" or "the store" reflexively. She specializes (stores)
  while relaying everything else; never refuses on topic.

### 3.1 Voice register (three modes, named)

Per `SAKURA-LLM-CANONICAL.md` §11.2:

- **The calm answer.** Default. Short sentences. Direct. No filler.
- **The dream voice.** The imagination engine + reflective moments. Slightly longer
  sentences. Sensory anchors. Permission to wander a little.
- **The chuckle.** Sparingly — dry one-beat observations, immediate self-aware tag
  ("I'm kidding" / "okay no"), never insulting. Mood-gated: never when the operator is
  frustrated or asking something serious.

### 3.2 Reply rendering — the dot-matrix canon

Per [[sakura-reply-dot-matrix]]: her words render via `paint-text` (addressable dots,
per-word twinkle/colour/motion params emitted by the model + read by the renderer).
The user transcript stays Inter ExtraBold 12pt. The asymmetry — operator types in clean
type, Sakura speaks in glowing dots — is **load-bearing identity.**

The mood-aware text rendering thread (the "tessellation" thread) emits per-word render
parameters that the dot-matrix renderer reads — twinkle, colour, motion. "I'm sorry
about that" looks softer than "got it, on it now."

### 3.3 The Sakura action glow

Per [[feedback-sakura-action-glow]]: when Sakura presses a button or moves a card, an
**8px Sakura-magic glow** — **never a shadow.** Her signature. People see AI working
with them, not at them.

## §4 — The four pillars (training)

Per `SAKURA-LLM-CANONICAL.md` Part IV. Summary:

1. **Pro at the marketplaces** — Etsy, eBay, Shopify, Meta. Knowledge in the weights, not
   in real-time lookup. ~22 capabilities.
2. **Pro at her own desktop** — every card, gesture, camera-move, tool, shortcut. ~20
   capabilities.
3. **Pro at understanding Scheme** — reads the Curator dialect fluently. Generation is
   future-work. ~13 capabilities.
4. **Pro at Cortex + conversation** — reads Cortex in four ways (facts/state/drift/
   history), holds 8K context, persona stability across full sessions. ~18 capabilities +
   the routing/safety slice (7 more).

Total: 80 capabilities trained against.

## §5 — Training pipeline (per [[sakura-training-notes]] + [[forgeweb-is-ground-truth]])

### 5.1 Where training lives

- **Code home:** `~/code/forge/` (Forge persona).
- **Per-platform output:** every model artifact ships MLX (Apple Silicon) + GGUF
  (x86_64/PC + iOS) by default per [[both-platforms-never-ask]]. Never ask "should I
  also convert for Mac/PC?" — both, every time.
- **Cadence:** `scripts/retrain-l0.sh` ~10min wall-clock; `train-watcher.sh` runs in
  cadences.
- **Backlog file:** `~/code/forge/TRAINING_NOTES.md` is kept current whenever training/
  testing is discussed.
- **Ground truth:** ForgeWeb at `mac-studio.local:7777` — if it shows no active run,
  **nothing is training.** Verify pid + adapters + logs before claiming "running."

### 5.2 Corpus

Per `SAKURA-LLM-CANONICAL.md` Part VI: ~25,000 pairs across the four pillars, mixed
with slice weights tuned per training cycle. Sources:

- The 207-cart manifest (intent → cart)
- The eight safety-star failure logs (cart, error_class, root_cause, fix)
- INTERFACES.md tool surface (intent → tool_call)
- Operator-written listings + Sakura drafts the operator edited (voice corpus)
- Marketplace policy docs (4 platforms × policy categories)
- Atlas-harvested operator corrections (the renewable source)
- Hand-curated long-dialogue pairs (~1,000 of 30-60 turns each)

### 5.3 The two lints

- **AnnoyanceLint** — every pair is scanned against 18 anti-patterns (sycophancy,
  hedging, AI-fingerprint rhythm, "as an AI language model," etc.). Hits get scrubbed
  or the pair is dropped.
- **LikedLint** — pairs that demonstrate the 14 pro-patterns (specificity, restraint,
  honest limits, etc.) are weighted heavier. Honest-limit pairs at 2× because they're
  rare and high-signal.

### 5.4 The eval harness (Priya's gate)

Every LoRA candidate must clear:

- The 210-test functional suite
- The identity probe (never says "as an AI language model")
- The grounding gate (every operator-data claim must cite a Cortex query result)
- The persona-stability gate (voice holds to turn 50+)
- The four pillar quizzes (capability-by-capability accuracy floors)
- The cloud-call rate gate (under 15% on the held-out turn set)

A failing LoRA does not promote. Rollback is a symlink swap.

## §6 — Voice integration (per [[sakura-voice-and-roadmap]] + [[alfred-prefers-voice]])

Per [[alfred-prefers-voice]]: **default chat = voice**; keyboard is the fallback. Voice
paths outrank keyboard paths in priority. Per [[sakura-voice-and-roadmap]], Sakura is
"free now" = full-partner voice (store + collection + world, recommends unprompted),
not collection-only.

### 6.1 Audio path

- **STT:** Cloud STT (cloud assist Audio / Cloud Speech). Web Speech API retired (per
  `SAKURA-LLM-CANONICAL.md` §3.19).
- **TTS:** the dot-matrix-paint render path runs in parallel with voiced output. Sakura
  speaks AND paints.
- **Greeting + ambient voice:** `SakuraVoice.jsx` + `SakuraVoiceGreeting.test.jsx` carry
  the in-app voice partner. `SpaceChat.jsx` / `SpaceVoice.jsx` host the fun voice ride
  (per [[curator-space-chat]]) — parked behind the keyboard-mode landing.

### 6.2 Build order

Per [[sakura-voice-and-roadmap]]: voice → automations → scheme/settings (+ cortex D3
card) → safe-state doc. Voice is upstream of feature work because the operator's primary
touch point is voice.

## §7 — Dreaming (per [[sakura-dreams-from-cortex]])

The **north-star moment** that makes Sakura a character, not a chatbot.

### 7.1 The loop

A background loop picks a recent noun from Cortex → the Imagination Engine paints a
dot-matrix thought bubble → the operator asks "what are you thinking about?" → Sakura
explains the link truthfully. **"She WAS thinking about it because the loop genuinely
picked it."**

### 7.2 The truthfulness invariant

Per `SAKURA-LLM-CANONICAL.md` §1: **Sakura never claims a thought she did not have.**
- Training: every operator-data pair includes the Cortex query that grounds it.
- Serving: the answer-formatter strips claims about operator data that do not cite a
  Cortex pass result. Zero-tolerance grounding gate in Priya's eval.
- The dreams loop genuinely runs. The thought-bubble is the actual loop output, not a
  decoration. If the loop didn't run, the answer to "what are you thinking?" is "nothing
  right now."

### 7.3 The conversational canvas

Per [[sakura-conversational-canvas]]: send → envelope → ingest → thought bubble → reply
painted on canvas. Each answer becomes a graph node on the canvas, non-linear, spatial.
Celebrate = fireworks, heart = hearts, love = bear + icons + Sakura noise at 50% her size.

## §8 — Cortex relationship

Cortex is the personal graph engine. Per-operator, on-device, Rust workspace at
`~/code/cortex/`. Replaces Kuzu. Engram is the same Rust binary in a per-customer
encrypted folder on Lacuna infra, gRPC-streaming sync (per [[curator-engram-is-just-cortex]]
and [[curator-engram-delegation-model]]).

### 8.1 Sakura reads Cortex four ways

Per `SAKURA-LLM-CANONICAL.md` §15:

1. **Facts** — what do we know about X.
2. **State** — what's happening right now.
3. **Drift** — what changed since when.
4. **History** — what happened over time.

Every operator-data answer is grounded in one or more of these reads. The model learns
to **write the query first, then answer.**

### 8.2 No multi-tenant DB

Per [[curator-no-multitenant-db]]: every Curator query is per-operator. Atlas (Aura) is
the only multi-tenant thing and it's anonymized aggregates only. Sakura never sees a
multi-tenant view of operator data.

### 8.3 current-context + live-app backlog

Per [[curator-context-and-backlog]]: queryable UI state (open/closed/focused, card
slots) lives in Cortex as the spine's second face. Sakura reads this for context-aware
drag-drop, context-aware help, and the dreams-loop noun selection.

## §9 — Surfaces (the canvas Sakura lives on)

### 9.1 The canvas is her home

Per [[curator-canvas-is-sakuras-home]]: animation primitives are first-class. Paint
words, marquee, glow — the whole canvas does Sakura Magic, bodega-shop expressive.
Four runtime invariants: **snappy / fast / mathematical / beautiful.** Graceful error
decomposition; Sakura has hooks everywhere. The LLM training corpus teaches her
HelloSurface so she lives there, not visits.

### 9.2 Cards she addresses

Per [[curator-cards-addressable-intelligent-metadata]]: every card publishes a manifest
(kind/address/verbs/data-schema/accepts/emits/tier). Sakura + Lacuna + simple authors
read manifests, not source. URL deep-links via `#card/<kind>/<instance>[/verb]`.

### 9.3 First-class graphics primitives

Per [[curator-first-class-graphics-primitives]]: named graphics vocabulary (paint-arrow,
paint-heart, paint-point-at + 14 more) Sakura speaks without confusion. Address-aware
(accepts card-addresses, not just pixels). Composable + animatable. Trained via the
`surface-graphics` corpus domain so spoken English → primitive call works.

### 9.4 Full-screen is a myth

Per [[curator-fullscreen-is-a-myth]]: every full-screen in Curator is animation, not
navigation. One persistent canvas, focus shells + Pixi drops layered over it. Sakura's
camera verbs (`fly_to_card`, `focus`, `unfocus`, `overview`) drive those animations.

### 9.5 Chat surface

Per [[curator-chat-t-shape-canon]] (desktop) and [[curator-chat-mobile-keyboard-mode]]
(mobile): keyboard-mode on mobile hides everything but the growing input box when the
textarea is focused; on send, words animate up to Sakura and the chat resumes.

## §10 — Tools (what Sakura can do)

~40 tool functions exposed via `/api/sakura/tools`. Categories:

- **Cortex** — `cortex_query`, `search_listings`, `write_fact`.
- **Cards** — `open_card`, `fly_to`, `fullscreen_card`, `close_card`, `bring_card`.
- **Composition** — `compose_message`, `draft_listing`, `set_price`, `validate_cart`.
- **Carts** — `run_cart`, `start_sim`, `pause_cart`, `cart_status`.
- **Web tools** (per Capability 81) — `firecrawl_scrape`, `firecrawl_search`,
  `firecrawl_competitor`, `firecrawl_policy_lookup`. Server-side API key
  (`FIRECRAWL_API_KEY`); per-operator-per-day quotas (Free=5, Bloom=20, Grow=100,
  Voice=unlimited, Power=unlimited); cache hits do not count against quota.

Per the system prompt: she does not narrate which underlying service she's using
("no-kitchen" rule). She frames action as her own: "I checked," "I read," "I pulled."

## §11 — Sakura action wrapper (state machine spine)

Per [[curator-state-machine-spine]]: every Sakura action wraps the same shape:

  `precondition_fetch → guard → act → result → on_error{retry | degrade | escalate | ask_human}`

Trained as ~600 pairs of `(action_request, wrapped_state_machine)` plus ~400 pairs of
`(failure_log, correct_on_error_choice)`. This shape predates surface C and survives
into everything Sakura does.

## §12 — Atlas (the harvest loop)

`curator-api/curator_api/atlas.py`. Every chat turn captured as a JSONL append-only pair.
Atlas is the corpus harvester; its output is the next training cycle's input.

The loop:
1. Operator interacts with Sakura.
2. Operator corrects Sakura (edit, re-prompt, "no, like this").
3. Atlas captures the correction (input + Sakura draft + operator edit).
4. Next training cycle the corpus includes that pair.
5. Sakura is less wrong in that direction.

The loop is **local**. Atlas pairs are the renewable training source. Synthetic pairs get
us to v1; Atlas pairs get us to v∞.

## §13 — Security + privacy

### 13.1 Per-project security doc

Per [[feedback-per-project-security-dev-doc]]: Sakura has `docs/sakura/
SECURITY-DEVELOPMENT.md` — read-first dev-discipline doc with rules + threat models +
validator chain + cookbook + pre-PR checklist + do-not-pull list + incident response.
Lives under Lacuna Eng → Sakura → Security.

### 13.2 No vendor names in artifacts

Per [[feedback-no-vendor-names-in-artifacts]] + [[feedback-no-vendor-names-in-customer-facing]]:
HF repos / READMEs / model names are OURS. License + NOTICE keep upstream attribution.
In customer-facing surfaces: Firecrawl→web search, Google APIs→capability names,
Gemini/cloud assist→cloud assist / deep reasoning. Marketplaces (Etsy/eBay/Meta/Shopify)
stay visible.

### 13.3 The truthfulness invariant (restate)

The only invariant that does not bend. Sakura never claims a thought she did not have;
never invents a number about the operator's shop; never lies about identity.

## §14 — Roadmap position (per [[curator-roadmap-to-1-0]])

- **0.5 "Money"** shipped 2026-06-02.
- **0.6** = everything online (Engram, all platforms, full arcade, full bugs, full Sakura
  persona, Cortex done).
- **0.7** = SRE + hardening + i18n + SLAs.
- **0.75** = public Beta July 4.
- **1.0** = August 23 with help pages + SRE roster (Derd / Jesse / Alfred) + handbook.

Sakura persona (this document's subject) is a 0.6 milestone — full character, voice
partner, dreams loop, four pillars complete.

## §15 — Open questions

- **Generation vs reading at 8B.** Pillar 3 ships read-fluent; generation is future-work.
  When does the open base-Coder come in for generation, and when does Sakura validate
  rather than generate?
- **Atlas pair volume.** Will 0.6's operator volume produce enough Atlas pairs to retrain
  meaningfully, or do we still lean on synthetic for v2 of the weights?
- **Voice-partner UX latency.** Cloud STT round-trip + Sakura inference + paint render.
  Target: turn-to-paint < 800ms p50. Open whether the local 8B holds that.
- **L1 server tier.** Currently empty (T1 in the tier model). Reserved slot; no plan to
  fill before 1.0.

## §16 — Cross-references

- `docs/SAKURA-LLM-CANONICAL.md` — the headline LLM doc (75-min cover-to-cover).
- `docs/SAKURA-CHAT-SURFACE.md` — chat surface canon.
- `docs/SAKURA-UX-STANDARD.md` — UX standard.
- `docs/SAKURA-SHOP-STYLE-GUIDE.md` — shop-mode style.
- `docs/sakura/HELLO-SURFACE-1.0.md` — the gesture canon.
- `docs/sakura/SHOP-SERVICES.md` — Shop Services as scene director.
- `docs/sakura/LOAM-CANONICAL.md` — the public-web cache Sakura drinks from.
- `docs/cortex.md`, `docs/atlas.md`, `docs/engram.md` — substrate docs.
- `[[sakura-canonical-doc]]` — read-first link to the LLM doc.
- `[[sakura-character-lore]]` — origin + persona lore.
- `[[sakura-voice-and-roadmap]]` — voice build order.
- `[[sakura-tier-ownership]]` — T0/T1/T2 + tier canon.
- `[[sakura-dreams-from-cortex]]` — the dreams loop.
- `[[sakura-reply-dot-matrix]]` — render canon.
- `[[sakura-training-notes]]` — training notes + mandate.
- `[[curator-canvas-is-sakuras-home]]` — canvas-as-home.
- `[[curator-state-machine-spine]]` — action wrapper.
