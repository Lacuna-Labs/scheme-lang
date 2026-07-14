; conways-life.scm — Conway's Game of Life with named presets.
;
; Life is the classic cellular automaton: an 80×80 grid where each cell
; is alive (color 14 — Sakura petal pink) or dead (color 0). Every
; frame, each cell looks at its 8 neighbors and follows two rules:
;
;   • a live cell with 2 or 3 live neighbors stays alive
;   • a dead cell with exactly 3 live neighbors is born
;
; Everything else dies. That's it. Those two rules produce gliders,
; oscillators, spaceships, and — if you're patient — Turing-complete
; computation.
;
; This example ships with hotkey presets so you can conjure the famous
; patterns without hand-drawing them:
;
;   1  glider              — the smallest spaceship, walks diagonally
;   2  R-pentomino         — 5 cells that evolve for 1103 generations
;   3  Gosper glider gun   — the first known infinite pattern
;   4  Diehard             — 7 cells, stable for 130 gens, then dies
;   5  Acorn               — 7 cells, chaotic settler (~5206 gens)
;   6  random noise        — 30% fill, chaos
;   c  clear
;   space  pause / step one frame while paused
;   +/-  speed up / slow down
;   click  toggle a cell
;
; Run:
;   ./bin/sakura-scheme run examples/conways-life.scm

; ── the world ──────────────────────────────────────────────────────
;
; The framebuffer IS the grid. Color 14 = alive, 0 = dead. Reading uses
; pget; writing uses pset. This lets Life render itself for free — no
; separate "draw the grid" pass.

(set-mode 'sakura)         ; 80×80
(set-color 14)             ; petal-pink for alive cells
(clear)

(define W 80)
(define H 80)

; Playback state — mutable via set!.
(define paused #f)
(define frame-count 0)

; Toroidal wrap: gliders that walk off the east edge come back on the
; west. Keeps the world a closed loop so nothing drops off the map.
(define (alive-at? x y)
  (= (pget (modulo x W) (modulo y H)) 14))

(define (n-count x y)
  (+ (if (alive-at? (- x 1) (- y 1)) 1 0)
     (if (alive-at? x       (- y 1)) 1 0)
     (if (alive-at? (+ x 1) (- y 1)) 1 0)
     (if (alive-at? (- x 1) y)       1 0)
     (if (alive-at? (+ x 1) y)       1 0)
     (if (alive-at? (- x 1) (+ y 1)) 1 0)
     (if (alive-at? x       (+ y 1)) 1 0)
     (if (alive-at? (+ x 1) (+ y 1)) 1 0)))

; ── one generation ─────────────────────────────────────────────────
;
; The subtle bit: every cell's fate depends on its OLD neighbors, so we
; must gather ALL the new values before we start writing. Otherwise
; earlier writes in a scan line would poison the reads for the next
; cell — Life would look right locally but drift globally.
;
; Strategy: sweep once to collect "cells that need to change," then
; sweep once to apply them. Two passes, all reads before any writes —
; atomicity preserved without ever holding two full grids in memory.

(define (step-life)
  (define changes '())
  (define (scan y)
    (when (< y H)
      (let scan-x ((x 0))
        (when (< x W)
          (let* ((was  (alive-at? x y))
                 (n    (n-count x y))
                 (next (or (and was (or (= n 2) (= n 3)))
                           (and (not was) (= n 3)))))
            (when (not (eq? was next))
              (set! changes (cons (list x y (if next 14 0)) changes))))
          (scan-x (+ x 1))))
      (scan (+ y 1))))
  (scan 0)
  (for-each (lambda (c) (pset (car c) (cadr c) (caddr c))) changes))

; ── preset patterns ────────────────────────────────────────────────
;
; Each preset is a list of (x y) offsets. `paint` renders them into the
; grid at a chosen anchor. The explicit-list form is longer than RLE
; encoding but reads better as documentation of what the shape IS.

(define (paint cells ox oy)
  (for-each
    (lambda (cell)
      (pset (+ ox (car cell)) (+ oy (cadr cell)) 14))
    cells))

; A glider — smallest spaceship, walks southeast.
;   . X .
;   . . X
;   X X X
(define glider-cells
  '((1 0) (2 1) (0 2) (1 2) (2 2)))

; R-pentomino — 5 cells that stabilize after 1103 generations.
;   . X X
;   X X .
;   . X .
(define r-pentomino-cells
  '((1 0) (2 0) (0 1) (1 1) (1 2)))

; Gosper glider gun — 36 cells, emits a glider every 30 generations.
; The first known pattern that grows without bound. It answered
; Conway's own question: yes, there ARE infinite-growth patterns.
(define gosper-cells
  '((0 4) (0 5) (1 4) (1 5)
    (10 4) (10 5) (10 6) (11 3) (11 7) (12 2) (12 8) (13 2) (13 8)
    (14 5) (15 3) (15 7) (16 4) (16 5) (16 6) (17 5)
    (20 2) (20 3) (20 4) (21 2) (21 3) (21 4) (22 1) (22 5)
    (24 0) (24 1) (24 5) (24 6)
    (34 2) (34 3) (35 2) (35 3)))

; Diehard — 7 cells that live for exactly 130 generations, then vanish
; completely. Named because it looked like it should die immediately
; but stubbornly refuses to.
;   . . . . . . X .
;   X X . . . . . .
;   . X . . . X X X
(define diehard-cells
  '((6 0) (0 1) (1 1) (1 2) (5 2) (6 2) (7 2)))

; Acorn — 7 cells that stabilize into 633 cells after 5206 generations.
; The most chaotic small "methuselah" pattern.
;   . X . . . . .
;   . . . X . . .
;   X X . . X X X
(define acorn-cells
  '((1 0) (3 1) (0 2) (1 2) (4 2) (5 2) (6 2)))

; Random noise — 30% fill. Chaotic; usually settles into a mix of
; stable blocks, blinkers, and the occasional escaped glider.
(define (paint-random!)
  (define (loop y)
    (when (< y H)
      (let loop-x ((x 0))
        (when (< x W)
          (if (< (random) 0.30) (pset x y 14) (pset x y 0))
          (loop-x (+ x 1))))
      (loop (+ y 1))))
  (loop 0))

; ── input handling ────────────────────────────────────────────────

(define (load-preset name)
  (clear)
  (cond
    ((eq? name '1) (paint glider-cells      38 38))
    ((eq? name '2) (paint r-pentomino-cells 38 38))
    ((eq? name '3) (paint gosper-cells      20 30))
    ((eq? name '4) (paint diehard-cells     36 38))
    ((eq? name '5) (paint acorn-cells       36 38))
    ((eq? name '6) (paint-random!))
    ((eq? name 'c) (clear))))

(on-key
  (lambda (k)
    (case k
      ((1 2 3 4 5 6 c) (load-preset k))
      ((space)
        (set! paused (not paused))
        ; If we're unpausing by pressing space during pause, still let
        ; the loop drive. If pause→step→pause is desired, uncomment:
        ; (when paused (step-life))
        )
      ((+ =) (set-frame-rate (min 60 (+ (frame-rate) 5))))
      ((- _) (set-frame-rate (max 1  (- (frame-rate) 5)))))))

(on-mouse
  (lambda (x y button)
    ; Toggle: if the cell is alive, kill it; if dead, wake it.
    (if (= (pget x y) 14) (pset x y 0) (pset x y 14))))

; ── the animation loop ─────────────────────────────────────────────

(set-frame-rate 15)          ; ~15 gens/sec — fast enough to feel alive

(on-frame
  (lambda (f)
    (unless paused
      (step-life)
      (set! frame-count (+ frame-count 1)))))

; Boot with a glider so there's something to watch immediately.
(load-preset '1)
(display "Life is running. 1-6 for presets, space to pause, +/- for speed.")
(newline)
