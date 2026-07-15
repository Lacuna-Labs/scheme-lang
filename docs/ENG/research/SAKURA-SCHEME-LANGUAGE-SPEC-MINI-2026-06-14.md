;;~ Sakura Scheme — Mini Spec (v1, 2026-06-14)

Paste this into a contractor prompt. Self-contained reference. No prose.
For the full standard see SAKURA-SCHEME-GOLDEN-STANDARD-2026-06-14.md.

────────────────────────────────────────────────────────────────────
§A. Cart skeleton (all carts start here)
────────────────────────────────────────────────────────────────────

    ;;~ title    "Human-readable title"
    ;;~ author   "your-name"
    ;;~ version  1
    ;;~ mode     analysis | automation
    ;;~ flavor   white | pink | green | mint | light-purple | gray
    ;;~ id       cart-slug
    ;;~ trigger  cron:daily | event:<name> | analysis-pattern        ;; optional
    ;;~ touches  ()                                                  ;; () = read-only
    ;;~ summary  "One short sentence."

    ;; Documentation block (10-25 lines).
    ;; · WHAT the cart does in the operator's words.
    ;; · WHY this shape (cite spec sections).
    ;; · Idempotency note.
    ;; · ctx inputs the host provides.
    ;; · Error grammar (which escalate kinds, why).

    (cart 'cart-slug
      '((author    . "your-name")
        (version   . 1)
        (read-only . #t)))                  ;; #f if cart writes

    (define (start ctx)        ...)         ;; precondition_fetch + guard
    (define (fetch ctx)        ...)         ;; act → next named state
    (define (check-result ctx) ...)         ;; result + on_error grammar
    (define (announce ctx)     (done))

────────────────────────────────────────────────────────────────────
§B. Driver descriptors (these are the only verbs that drive flow)
────────────────────────────────────────────────────────────────────

    (next 'state ctx)              ;; advance
    (done)                         ;; finished
    (escalate 'kind detail)        ;; pause; surface decides
    (after N 'state ctx)           ;; sleep N seconds, resume at 'state
    (act 'verb args 'on-result)    ;; one tool call, named resume
    (wait 'event)                  ;; block on event
    (interrupted 'reason ctx)      ;; live-voice mid-speech catch

    ctx helpers:
      (ctx-get 'key ctx)
      (ctx-set 'key value ctx)
      (ctx-result ctx)             ;; the last act's response

────────────────────────────────────────────────────────────────────
§C. The 15 primitives (engine-implemented; cannot be invented around)
────────────────────────────────────────────────────────────────────

    motion/move-to          addr x y :ms :curve         → MotionHandle
    motion/halt             addr                        → MotionHandle
    motion/follow-input     addr sensor :axis :scale    → MotionHandle (ND)
    motion/anchor-to-input  addr sensor fn              → MotionHandle (ND)
    motion/idle             addr :pattern :amp :cycles  → MotionHandle
    note/strike             pitch :velocity :voice :ms  → NoteHandle (ND)
    note/place-at           staff-addr glyph :clef      → NoteHandle
    note/release            handle                      → NoteHandle (ND)
    surface/dim             alpha :ms :curve            → SurfaceHandle
    surface/spotlight       addr :radius :softness :ms  → SurfaceHandle
    surface/curtain         alpha :ms                   → SurfaceHandle
    card/do                 addr verb args              → EmitHandle
    card/emit               addr event payload          → EmitHandle
    card/ask                addr question :timeout      → AnswerHandle (ND)
    base/make-character     class :address :traits      → character
    input/may-i?            sensor                      → PermissionPromise

ND = non-deterministic (depends on sensor / clock / external state).

────────────────────────────────────────────────────────────────────
§D. The 36 macros (compose primitives; use these, don't reinvent)
────────────────────────────────────────────────────────────────────

  Motion idioms (13, all expand to motion/move-to with named curve+ms):
    motion/glide  motion/drift  motion/sway  motion/arrive  motion/depart
    motion/settle motion/spin   motion/lean-aside motion/ease-aside
    motion/reach  motion/pluck  motion/toss  motion/land

  Note idioms (2, expand to note/strike + note/place-at):
    note/glide   note/rest

  Musical forms (7, expand to (note/place-at …) sequences):
    form/I-IV-V  form/ii-V-I  form/12-bar-blues  form/vi-IV-I-V
    form/I-vi-ii-V  form/modal-Dorian  form/scale

  Scene atmosphere (2, compose surface/dim + surface/spotlight):
    surface/fade-around  surface/stage

  Timing composition (8):
    sequence  parallel  after  wait  repeat  in-window  every  stagger

  Mode-aware (4):
    when-mode  on-mode-change  on-input  on-gesture

────────────────────────────────────────────────────────────────────
§E. Verb namespaces (where act calls live)
────────────────────────────────────────────────────────────────────

  etsy/             receipts, listings, listing, images, inventory, reviews,
                    publish, update-listing, mark-shipped, reprice, delete-listing,
                    upload-image, conversations, ledger, sections, shop
  ebay/             listings, publish, update, fees
  shopify/          products, orders, update
  meta/             products, orders
  google-merchant/  status, sync, violations
  pinterest/        status, pin
  perplexity/       search
  firecrawl/        policy-lookup, page-scrape
  sakura/           decide (local), cloud-reason (relay), say (voice)
  cortex/           remember, recall, forget, calendar
  audio/            bar-clock
  voice/            speak, listen
  music/            score-play, transport-set
  scene/            fade-others, restore, bring-together
  paint-*           paint-marquee, paint-flow, paint-burst, paint-glow,
                    paint-pipe, paint-text, paint-clear

────────────────────────────────────────────────────────────────────
§F. Address grammar
────────────────────────────────────────────────────────────────────

    #anchor/<name>           top-left, center, bottom-right, …
    #edge-run/<side>         (anchor 'edge-run/top :u 0.3)
    #card/<kind>[/<id>]      #card/etsy or #card/store-listing/abc123
    #card-area/<addr>/<reg>  #card-area/etsy/header
    #beat/<m>/<b>            audio-clock measure + beat
    #input/<sensor>/<field>  #input/gyro/tilt-x
    #note-glyph/<dur>        #note-glyph/quarter
    #sprite/<id>             #sprite/blossom-3
    #class/<kind>            #class/sprite (operates on all instances)
    #sakura/mode             'work / 'whimsy / 'focus / 'rest

    (resolve <addr>)         lazy viewport-aware resolution at dispatch

────────────────────────────────────────────────────────────────────
§G. Tier conventions (flavor token in header)
────────────────────────────────────────────────────────────────────

  white         Free            read-only / Cortex-only / no cloud
  blossom/pink  Free            local-Sakura + Cortex; on-device only
  green         Free            event-triggered local automation
  mint          Standard $9.99  multi-platform + scheduled cloud allowance
  light-purple  Magic $39.99    cloud-relay reasoning, multi-platform writes
  purple        Magic $39.99    same as light-purple (legacy label)
  dream         Dream $99       Opus + voice + scene + Score
  gray          Internal        engine/debug/relay carts; not operator-visible

────────────────────────────────────────────────────────────────────
§H. The 11 rules (forever-code laws — auto-reject on violation)
────────────────────────────────────────────────────────────────────

   1. Idempotent — same input twice = same output, no double-write.
   2. Honest about gaps — every error returns a clear (escalate 'kind …).
   3. Cortex first, network second — read local before fetching.
   4. Open-loop — never poll; compose handles or use (after N …).
   5. Determinism propagation — if any descendant is non-deterministic,
      the whole form is; declare it honestly.
   6. PII redaction at every boundary — emails, addresses, phone, names
      get scrubbed before they cross to cloud or paint to a log.
   7. Rate-limit aware — on 'rate-limited, (after N 'fetch ctx); never retry-storm.
   8. Tier-gated cloud — free carts may NOT call sakura/cloud-reason.
   9. No vendor names in operator-facing strings — say "deep reasoning"
      not "Sonnet"; say "web search" not "Firecrawl"; marketplaces
      (Etsy/eBay/Meta/Shopify/Pinterest) STAY visible.
  10. Crisis: never replace real resources — 988, professional help,
      etc. are not the cart's job.
  11. Audit log isn't your job — the registry chokepoint instruments
      every act call automatically; do NOT manually card-emit duplicate
      audit events.

────────────────────────────────────────────────────────────────────
§I. Standard escalate kinds (use these names; don't invent)
────────────────────────────────────────────────────────────────────

  Precondition guards:
    'shop-not-connected     'missing-<field-name>   'cortex-not-ready

  Data:
    'no-data                'rate-limited           'service-not-yet-wired

  Local Sakura:
    'sakura-empty           'sakura-garbled         'sakura-low-confidence

  Cloud relay:
    'cloud-empty            'cloud-garbled          'cloud-quota
    'cloud-consent          'cloud-tier-required

  Consent:
    'cortex-write-consent   'operator-consent       'voice-consent

────────────────────────────────────────────────────────────────────
§J. The minimal valid cart (60 lines, copy-paste, gold-standard shape)
────────────────────────────────────────────────────────────────────

    ;;~ title    "Example · minimal cart"
    ;;~ author   "lacuna"
    ;;~ version  1
    ;;~ mode     analysis
    ;;~ flavor   white
    ;;~ id       example-minimal
    ;;~ touches  ()
    ;;~ summary  "Demonstrates the gold-standard skeleton."

    ;; Read-only architect-shape. Pulls receipts for the last 7 days,
    ;; tables them. Idempotent: same window → same table. Free tier:
    ;; no cloud relay, no cortex write.

    (cart 'example-minimal
      '((author    . "lacuna")
        (version   . 1)
        (read-only . #t)))

    (define (start ctx)
      (let ((connected (ctx-get 'shop-connected ctx)))
        (cond
          ((not connected) (escalate 'shop-not-connected null))
          (else            (next 'fetch ctx)))))

    (define (fetch ctx)
      (act 'etsy/receipts (list 'this-week) 'render))

    (define (render ctx)
      (let ((rows (ctx-result ctx)))
        (cond
          ((null? rows)              (escalate 'no-data null))
          ((eq? rows 'rate-limited)  (after 30 'fetch ctx))
          (else
            (table rows '(receipt-id buyer total state))
            (done)))))
