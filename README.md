# scheme-lang

```
                    .                  .
             .   .     ✿     .
                ✿   .   .    .   ✿
              .    ✿   ✿   ✿    .
         .   ✿   ✿   sakura   ✿   ✿    .
              .    ✿   ✿   ✿    .
                ✿   .   .    .   ✿
             .   .     ✿     .
                    .                  .
```

**A small Scheme for humans and AI to program together.**

Five layers. 1,157 verbs. One REPL. Runs on any laptop with Node 18+.

**[Try it in your browser →](https://lacuna-labs.github.io/scheme-lang/)** &nbsp;·&nbsp; no install, real interpreter, `Tab` to complete, `,help` for commands.

---

## What it is, in one screen

```
  ┌─────────────────────────────────────────────────────────┐
  │  L4  commercial   shop · cart · auth   (opt-in)         │
  │  L3  game         entity · physics · steering           │
  │  L2  ai           cortex/remember · cortex/recall       │
  │  L1  media        framebuffer · sound · animation       │
  │  L0  core         reader · interpreter · macros         │
  └─────────────────────────────────────────────────────────┘
```

Each layer stacks. You load only what you need. The default `sakura-scheme` binary boots L0 + L1 + L2 + L3 — enough to draw, play, animate, remember. L4 requires `sakura-scheme login` and is off by default. Every verb carries arity, docstring, three tiered examples, and a source position; the REPL, the docs site, and the LLM tool-call schemas all read from one SLAT reference.

If you know Scheme, this will feel small and stable. If you don't, [the Book of Scheme](docs/BOOK-OF-SCHEME.md) will get you pretty good in a weekend.

---

## Install

**Requirements:** Node 18+ and `git`. Nothing else.

**One-liner** (macOS / Linux):

```
curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
```

The installer clones into `~/.scheme-lang/repo`, symlinks `sakura-scheme` and `scheme-lang` onto your PATH (via `~/.local/bin`, `/usr/local/bin`, or `~/bin` — whichever is writable), and adds the PATH line to your shell rc if needed. Open a new terminal and you're in.

**Windows (PowerShell):**

```
iwr -useb https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.ps1 | iex
```

**Clone and run in place** (if you want to hack on the interpreter):

```
git clone https://github.com/Lacuna-Labs/scheme-lang.git
cd scheme-lang
./bin/sakura-scheme
```

Homebrew tap and `npm install -g sakura-scheme` coming next.

**Uninstall:**

macOS / Linux:
```
rm -rf ~/.scheme-lang
rm -f ~/.local/bin/scheme-lang ~/.local/bin/sakura-scheme
```

Windows (PowerShell):
```
Remove-Item -Recurse -Force $env:LOCALAPPDATA\scheme-lang
```
Then remove `%LOCALAPPDATA%\scheme-lang\bin` from your User PATH.

npm:
```
npm uninstall -g sakura-scheme
```

---

## First ten minutes

Type `sakura-scheme`. You'll see a pink cherry-blossom banner and a `sakura>` prompt.

```
                      ✿
                    ✿   ✿
                  ✿  ✿  ✿
                    ✿   ✿
                      ✿

  sakura-scheme 1.5.0
  ,help for commands · Tab to complete · Ctrl-D to leave

  sakura> _
```

Try:

```scheme
sakura> (+ 1 2)
3

sakura> (* 6 7)
42

sakura> (define greeting "hello")
sakura> greeting
"hello"

sakura> (map (lambda (x) (* x x)) '(1 2 3 4 5))
(1 4 9 16 25)
```

Now draw something:

```scheme
sakura> (circle 40 40 15)
```

The REPL fills the screen with the shape. Try `(disc 40 40 15)` — that one's filled.

Make it beep:

```scheme
sakura> (tone 440 0.25)
```

That's A4 for a quarter second. In a terminal without audio the fallback is a terminal bell; with the `speaker` npm package installed, or in the browser REPL, you hear the actual sine wave.

When you're ready to leave, type `,exit` or press `Ctrl-D`. She'll say `goodnight ✿`.

---

## The five layers, briefly

### Layer 0 — core

Small, stable Scheme. R7RS-subset: `define`, `lambda`, `let` / `let*` / `letrec`, `cond`, `case`, `if`, `when` / `unless`, `quote`, `quasiquote`, `begin`, `set!`, `and`, `or`. Hygienic macros via `syntax-rules`. First-class functions, closures, proper tail calls. Around 350 primitives — arithmetic, list ops, strings, math, hash tables, financial helpers.

### Layer 1 — media

The pixel canvas + sound + timing.

```
     framebuffer                          sound
  ┌──────────────────┐              ┌──────────────────┐
  │ ● ● ● ● ● ● ● ●  │              │  ▁▂▃▅▆▇▆▅▃▂▁     │
  │ ●               ●│              │       tone       │
  │ ●     circle    ●│              │       note       │
  │ ●    (40,40,15) ●│              │       sfx        │
  │ ●               ●│              │       music      │
  │ ● ● ● ● ● ● ● ●  │              │                  │
  └──────────────────┘              └──────────────────┘

                    animation
                 ┌──────────────────┐
                 │  (on-frame ...)  │
                 │  60Hz driver     │
                 └──────────────────┘
```

`(circle cx cy r)`, `(disc cx cy r)`, `(line x0 y0 x1 y1)`, `(rect x y w h)` draw into a shared 80×80 framebuffer (adjust with `(set-mode w h)` or `(set-mode 'pico8)`). `(clear c)` wipes it. `(tone freq dur)` plays a sine wave; `(note 'A4)` plays a named pitch. `(on-frame handler)` registers a 60Hz frame callback — that's how you animate.

### Layer 2 — ai

Cortex + LLM primitives. In the standalone REPL, Cortex is an in-memory dictionary you write into and read back out; a real Cortex arrives when the Sakura runtime plugs itself in.

```scheme
sakura> (cortex/remember 'birthday "July 12")
#t
sakura> (cortex/recall 'birthday)
"July 12"
```

`(llm/complete ...)` and friends error cleanly ("no LLM connected — configure `:ai-provider` in `scheme-lang.config.slat`") in the base — honest about what's wired.

### Layer 3 — game

Entities, physics, collision, steering behaviors. Every entity is `{ id, x, y, vx, vy, w, h, tags }`; AABB collision; verlet integration with gravity + friction.

```scheme
sakura> (entity/make 'ball 40 5 4 4)
"ball"
sakura> (entity/set-velocity! 'ball 1 0)
#t
sakura> (physics/step)
sakura> (entity/get 'ball)
("ball" 41 5.5 1 0.5 4 4)
```

### Layer 4 — commercial

Etsy / eBay / Shopify verbs. Auth-gated — the base REPL surfaces a clean "sign in to use" error when you try to call one without `sakura-scheme login`. Real Google device-flow OAuth is the plumbing; a real Google client id is a follow-up.

---

## The reference is the language

`docs/SAKURA-SCHEME-REFERENCE.slat` — one file, 1,157 verbs, 128 core language forms. The REPL reads from it. The docs site reads from it. The LLM tool-call schemas read from it. When you type `,help map` at the REPL you're looking at the same source we're looking at:

```
sakura> ,help map

  map · primitive
    (map fn lst)
    Apply fn to each element, return list of results.

    examples:
      (map (lambda (x) (* x 2)) '(1 2 3))       ;; → (2 4 6)
      (map car '((a 1) (b 2)))                  ;; → (a b)
      (map + xs ys)                             ;; parallel
```

Add a verb; every downstream tool picks it up. That's the trick.

---

## REPL exploration

Meta-commands start with `,`:

```
,help                       list every command
,help map                   arity + doc + examples for map
,type filter                just the type signature
,doc car                    just the docstring
,arity fold                 just the arity
,examples reduce            three tiered examples
,namespace list             every verb whose name starts with 'list'
,apropos map                symbols whose name matches 'map'
,search apply               regex over docs + examples
,time (map square '(1 2 3 4 5 6 7 8 9 10))
                            wall + fuel + memory
,expand (let ((x 1)) (+ x 2))
                            macroexpand
,trace fact                 print every call with nested indent
,inspect tree               walk a value with arrow keys
,save my-session.slat       every binding + history to disk
,load my-session.slat       and back
,watch-file scratch.scm     live-reload as the file changes
```

Full REPL guide: [`docs/REPL.md`](docs/REPL.md).

---

## Two books, one language

- **[Book of Scheme](docs/BOOK-OF-SCHEME.md)** — the ramp-up. If you've written code before (Python, JS, C, whatever) but never a Lisp, this gets you from "what's a Scheme" to "I can build things" in one careful pass.
- **[Book of Jesse](docs/BOOK-OF-JESSE.md)** — the translation manual. If you already ship in Fennel, TIC-80, Clojure, or Lua, this maps what you know onto what we do. Same shape, different spelling.

Both books read the same reference the REPL does.

---

## Community-forkable

- **Every product is a fork.** Rename in `dialect.json`, drop your verbs into `verbs/`, drop your adapters into `adapters/`. The REPL and tooling discover you automatically. See [`TEMPLATE-FOR-FORKS.md`](TEMPLATE-FOR-FORKS.md).
- **Every fork gets a browser REPL + rendered reference on GitHub Pages for free.** See [`TEMPLATE-FOR-FORKS-PAGES.md`](TEMPLATE-FOR-FORKS-PAGES.md).

---

## Design principles

1. **Nothing in excess.** Sixteen solid colors. No gradients. No animation. No shimmer. The kind of restraint that looks plain until you use it for a while and can't remember what you thought was missing.
2. **Not an IDE.** REPL only. Your editor sits next to it.
3. **Interface over implementation.** The command is `scheme-lang`. Whether Node or Rust is behind it is our business, not yours.
4. **Batteries included, not the kitchen sink.** The 20+ meta-commands cover the 80% every REPL user hits. Exotic features get a stub that says "waiting for her" until they arrive.
5. **The persona is dialect-owned.** The launcher is neutral. The banner is a *dialect* choice.

---

## For the eleven-year-old boy

The person maintaining this thinks about you. When you type `(+ 1 2)` and see `3`, that's the easy part. When you type `,help map` and get a real answer — that's on purpose. When your circle draws in stars that you can save to a `.slat` file and come back to tomorrow — that's on purpose too.

Somebody gave a shit. Same standard as the good arcade cabinets. Same standard as anything built with care.

---

## License

MIT. Do whatever you want with it. Make your own dialect. Ship it. Tell us about it if you want.

Home: [github.com/Lacuna-Labs/scheme-lang](https://github.com/Lacuna-Labs/scheme-lang)
Made in Brooklyn.

---

## Appendix — copy-paste examples

Everything below is real code from the base you just installed. Every block runs unmodified. Ramp is intentional — the tiers get bigger as you go.

### Level 0 — Scheme basics

```scheme
;; arithmetic
(+ 1 2)                                     ;; ⇒ 3
(* 6 7)                                     ;; ⇒ 42
(- (* 2 21) (/ 84 2))                       ;; ⇒ 0

;; naming
(define greeting "hello")
(define pi 3.14159265)

;; lists
(list 1 2 3 4)                              ;; ⇒ (1 2 3 4)
(car '(a b c))                              ;; ⇒ a
(cdr '(a b c))                              ;; ⇒ (b c)
(cons 'a '(b c))                            ;; ⇒ (a b c)
(length '(a b c d))                         ;; ⇒ 4
(reverse '(1 2 3))                          ;; ⇒ (3 2 1)
(append '(a b) '(c d))                      ;; ⇒ (a b c d)

;; higher-order
(map (lambda (x) (* x x)) '(1 2 3 4 5))     ;; ⇒ (1 4 9 16 25)
(filter (lambda (x) (> x 10)) '(1 5 12 20 3 44))
                                            ;; ⇒ (12 20 44)
(reduce + 0 '(1 2 3 4 5 6 7 8 9 10))        ;; ⇒ 55

;; a function
(define (square x) (* x x))
(square 12)                                 ;; ⇒ 144

;; hash tables
(define person (make-hash))
(hash-set! person 'name "Alfred")
(hash-set! person 'age  32)
(hash-ref person 'name)                     ;; ⇒ "Alfred"
```

### Level 1 — drawing

Type into the REPL, or save any of these blocks as a `.scm` file and run with `sakura-scheme run <file>`.

```scheme
;; one circle
(circle 40 40 15)

;; one filled disc
(disc 40 40 15)

;; a row of circles
(for-each (lambda (n) (circle (* n 12) 20 3))
          '(1 2 3 4 5 6 7 8 9 10))

;; a diagonal line
(line 0 0 79 79)

;; a rectangle
(rect 10 10 30 20)

;; a wipe + a filled rectangle
(clear 0)
(rect-fill 20 20 40 30)

;; pick a color first (0..15 palette index; 14 is petal pink)
(set-color 14)
(disc 40 40 20)

;; a whole picture composed from shapes
(clear 0)
(disc 40 40 25)                             ;; big pink circle
(line 0 40 79 40)                           ;; horizon
(rect 25 45 30 15)                          ;; house body
(line 25 45 40 30)                          ;; roof left
(line 40 30 55 45)                          ;; roof right
```

### Level 2 — animation + sound

Shebang-runnable — save as `bounce.scm`, `chmod +x`, then `./bounce.scm`:

```scheme
#!/usr/bin/env sakura-scheme
;; bounce.scm — a small ball bounces around the framebuffer.

(define x 40)
(define y 40)
(define vx 2)
(define vy 1)

(define (frame)
  (clear 0)
  (set! x (+ x vx))
  (set! y (+ y vy))
  (when (or (< x 4) (> x 76)) (set! vx (- vx)))
  (when (or (< y 4) (> y 76)) (set! vy (- vy)))
  (disc x y 3))

(on-frame frame)
```

Sound — a rising major scale:

```scheme
#!/usr/bin/env sakura-scheme
;; scale.scm — a C major scale, one note at a time.

(for-each (lambda (pitch)
            (note pitch 0.3))
          '(C4 D4 E4 F4 G4 A4 B4 C5))
```

Or with raw frequencies — the same thing, unpacked:

```scheme
#!/usr/bin/env sakura-scheme
;; scale-raw.scm — same scale, but computed from a base frequency.

(define base 261.63)                        ;; middle C, in Hz
;; whole-number ratios from the just-intoned major scale, as floats
(define ratios (list 1.0 1.125 1.25 1.333 1.5 1.667 1.875 2.0))

(for-each (lambda (r) (tone (* base r) 0.3))
          ratios)
```

### Level 3 — physics + entities

The bouncing ball on gravity:

```scheme
#!/usr/bin/env sakura-scheme
;; bouncing-ball.scm — a ball falls, hits the floor, bounces.
;;
;; Runs headless. Prints the ball's position each frame.

(physics/gravity! 0.5)
(physics/friction! 0.99)

;; the ball
(entity/make 'ball 40 5 4 4)
(entity/set-velocity! 'ball 1 0)

;; the floor — static, pinned, tagged
(entity/make 'floor 0 76 80 4)
(entity/pin! 'floor)
(entity/tag! 'floor 'ground)

(define (step n)
  (if (> n 0)
      (begin
        (physics/step)
        ;; bounce on floor contact — flip vy, dampen slightly
        (if (entity/collides? 'ball 'floor)
            (let ((s (entity/get 'ball)))
              (entity/set-velocity! 'ball
                                    (list-ref s 3)
                                    (* -0.7 (list-ref s 4)))))
        (display "frame ")
        (display (- 31 n))
        (display ": ")
        (display (entity/get 'ball))
        (newline)
        (step (- n 1)))))

(step 30)
(display "done — the ball settled.")
(newline)
```

### Level 4 — Cortex, the memory verbs

Cortex is the AI layer's persistent memory. In the standalone REPL it's an in-memory Map; when the Sakura runtime plugs itself in, it becomes real long-term memory.

```scheme
#!/usr/bin/env sakura-scheme
;; cortex-demo.scm — write facts, read them back, search across them.

;; store a few things
(cortex/remember 'birthday "July 12")
(cortex/remember 'favorite-color "pink")
(cortex/remember 'wants "a trip to Fiji")

;; read one back
(display (cortex/recall 'birthday))         ;; "July 12"
(newline)

;; list every key
(display (cortex/keys))                     ;; (birthday favorite-color wants)
(newline)

;; how many facts?
(display (cortex/size))                     ;; 3
(newline)

;; forget one
(cortex/forget 'favorite-color)
(display (cortex/size))                     ;; 2
(newline)
```

Everything on this page runs today. If any block doesn't do what you expect, that's a bug — please open an issue.
