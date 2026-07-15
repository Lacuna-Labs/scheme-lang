# Flower sprites — addressable bodies, Scheme-orchestrated

> 2026-06-21. The flower bodies live in Scheme, not JavaScript.
> Sakura generates them, addresses their parts by name, and composes
> motion via named clips. JS owns the pixel surface; Scheme owns the
> performance.

This spec records the architecture so future sessions don't ask Alfred
to remember. Implements pending tasks #65 (F3 limbs), #70 (F8 corpus),
#71 (F9 keyframe clips), and finishes #41 (Dream PRODUCT) when wired
through Sakura.

## What's done (today, 2026-06-21)

- `BIG_BLOSSOM` pattern shipped in `curator-web/src/sprites/flowers.js`
  — 5 filled petal discs + centre disc, ~750 lit virtual pixels,
  ~30 vp bounding box. Spawn via `(grid/flower-spawn! "big" colour x y)`.
- Three new Scheme animation primitives wired:
  - `(grid/flower-bloom! id dur-ms)` — scale 0→1, ease-out cubic
  - `(grid/flower-sway! id amp-deg period-ms)` — ±amp rotation, sine
  - `(grid/flower-cycle! id palette period-ms)` — colour crossfade
- Verified end-to-end on the live dev surface: pink blossom paints,
  blooms, sways, cycles. `/tmp/curator-big-bloom.mp4` is the proof.

## The architecture (what Sakura needs to know)

A flower is a **body** with **named limbs**. JS provides:

- The pixel surface (the dot-matrix substrate, 4px virtual-pixel pitch)
- A registry of flower bodies keyed by id
- Per-limb position/rotation/scale state

Scheme provides everything else: what flowers exist, which limbs they
have, what they do.

### Limb addressing

A flower has six addressable limbs:

| Limb | Alias | Default cells |
|---|---|---|
| `'centre` | `'core`, `'stamen` | the centre disc (~80 cells) |
| `'petal-0` | `'north`, `'top` | top petal (~150 cells) |
| `'petal-1` | `'north-east` | upper-right petal |
| `'petal-2` | `'south-east` | lower-right petal |
| `'petal-3` | `'south-west` | lower-left petal |
| `'petal-4` | `'north-west` | upper-left petal |

Addressing in Scheme:

```scheme
(define rose (grid/flower-spawn! "big" "#ffb1cd" 540 360))

(grid/limb rose 'petal-0)               ; → opaque limb handle
(grid/limb rose 'north)                 ; same handle (alias)

(grid/limb-pos rose 'petal-0)           ; → (x . y) world coords
(grid/limb-rotate! rose 'petal-0 15)    ; degrees, relative to body
(grid/limb-scale! rose 'petal-0 1.2)    ; uniform scale
(grid/limb-detach! rose 'petal-0)       ; petal leaves the body
                                        ;   — becomes its own sprite,
                                        ;   keeps moving independently
```

### Named clips — composite motion

A **clip** is a Scheme procedure that returns a sequence of
(time, action) pairs. Built-ins:

| Clip | Effect |
|---|---|
| `'idle-amble` | gentle continuous breathing + 1° sway |
| `'bow` | tip the body forward 20°, hold 400ms, return |
| `'run` | translate while alternating petal scale (gait) |
| `'roll` | full body rotation over 1s with petals trailing |
| `'jump` | y-arc + scale pulse at apex |
| `'wave` | petal-0 rotates +30° then back, like a hand |

Calling a clip:

```scheme
(clip/play rose 'bow)
(clip/play rose 'run '#card/shop/etsy-orders)  ; run toward a card
(clip/loop rose 'idle-amble)                   ; loop until cancelled
(clip/cancel rose 'idle-amble)
```

Clips are pure Scheme — they compose existing primitives
(`grid/limb-rotate!`, `grid/flower-move-to!`, etc.) into named scenes.
New clips ship as `.sks` files in `dreams/clips/`.

### The helicopter scene (Alfred's example)

The classic "they jumped into the helicopter" pattern is just three
clips composed:

```scheme
(cart 'flowers-board-helicopter
  (state 'start
    (let* ((heli (grid/card-center '#card/helicopter)))
      (for-each
        (λ (flower)
          (clip/play flower 'run heli)         ; run to door
          (clip/play flower 'jump)             ; hop in
          (grid/flower-clear! flower))         ; gone
        (grid/flower-list))
      (next 'done))))
```

The 'run + 'jump + clear sequence reads exactly as Alfred said it.

## What Sakura learns (training corpus, task #70)

The corpus pairs natural language with Scheme:

| Operator says | Sakura emits |
|---|---|
| "make a pink flower in the middle" | `(grid/flower-spawn! "rose" "#ffb1cd" 540 360)` |
| "bow to me" | `(clip/play rose 'bow)` |
| "wave hello" | `(clip/play rose 'wave)` |
| "send them to the helicopter" | `(load-cart 'flowers-board-helicopter)` |
| "the pink one nods" | `(clip/play (grid/flower-by-colour "pink") 'bow)` |
| "petals open wider" | `(for-each (λ (p) (grid/limb-scale! rose p 1.2)) '(petal-0 petal-1 petal-2 petal-3 petal-4))` |

Target: ~2,000 limb/clip composition pairs in the v2 corpus before training.

## Implementation order (next session)

1. **F3 — limb registry in flowers.js** (~150 LOC). Track per-flower
   limb state. Expose `(grid/limb)`, `(grid/limb-pos)`,
   `(grid/limb-rotate!)`, `(grid/limb-scale!)`, `(grid/limb-detach!)`.
2. **F9 — clip engine** (~200 LOC). `clip/define`, `clip/play`,
   `clip/loop`, `clip/cancel`. Built-ins as `.sks` clips, NOT hardcoded JS.
3. **F8 — corpus** (~2k pairs). Procedurally generate from
   clip × flower × target tuples.
4. **#41 — Dream PRODUCT** wiring. Sakura's dream loop picks a recent
   Cortex noun → picks a clip that matches → composes it as a Scheme
   thought-bubble cart.

The pattern is: every new sprite behaviour lands as a clip the operator
can call by name, not as JS the operator has to learn. JS only grows
when a new primitive is genuinely needed (e.g. a new addressing axis).

## Files referenced

- `curator-web/src/sprites/flowers.js` — bodies + primitives
- `curator-web/src/scheme/carts/dreams/clips/` — new clip library (to create)
- `docs/SAKURA-SCHEME-1.0-REFERENCE.md` — append the new verbs
- `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` — append the limb/clip arch
- `/tmp/curator-big-bloom.mp4` — proof of the BIG_BLOSSOM pattern
- IMG_0741.png (Alfred's reference) — the visual target
