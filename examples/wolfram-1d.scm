; wolfram-1d.scm — elementary 1D cellular automata, rendered as
; scrolling patterns. Stephen Wolfram catalogued all 256 of them; a
; handful are worth staring at for hours.
;
; The setup: an infinite row of cells, each 0 or 1. Every generation,
; each cell's new value depends on the values of ITSELF and its two
; neighbors — a three-cell pattern with 2³ = 8 possible inputs. A rule
; is a lookup table mapping each of those 8 inputs to a 0 or 1 — so
; there are 2⁸ = 256 possible rules. The "rule number" is just those
; 8 output bits packed into a byte, MSB first.
;
; Rule 30 was Wolfram's favorite — it looks random. Wolfram used it as
; the random-number generator inside Mathematica for years.
;
; Rule 90 is the Sierpinski triangle — order from a single starting
; cell. Rule 110 is provably Turing complete: with the right initial
; row it can simulate any computation you can imagine.
;
; Presets:
;
;   3   Rule 30  — chaos (Wolfram's random-number generator)
;   9   Rule 90  — the Sierpinski triangle
;   1   Rule 110 — Turing complete
;   5   Rule 54  — complex; on the edge of chaos
;   8   Rule 184 — traffic flow model
;   r   restart with the current rule
;   c   clear and single-seed the middle cell again
;
; Run:
;   ./bin/sakura-scheme run examples/wolfram-1d.scm

(set-mode 'sakura)           ; 80×80 — 80 cells wide, 80 rows of history
(clear)

(define W 80)
(define H 80)

; The current rule number (0..255) and its decoded lookup table.
(define current-rule 30)

; Decode the rule number into an 8-slot lookup table.
; Slot index i (0..7) is the three-cell pattern read as binary:
;   i = (left << 2) | (self << 1) | right
; The output bit is (rule >> i) & 1.
(define (decode-rule n)
  (let build ((i 0) (acc '()))
    (if (= i 8)
        (reverse acc)
        (build (+ i 1) (cons (modulo (quotient n (expt 2 i)) 2) acc)))))

(define rule-table (decode-rule current-rule))

; Look up the next value of a cell given its three-neighbor context.
(define (apply-rule left self right)
  (list-ref rule-table (+ (* left 4) (* self 2) right)))

; ── grid state ────────────────────────────────────────────────────
;
; We keep the current row as a Scheme list of 0s and 1s. Each frame we
; compute the next row, scroll the framebuffer up one line, and draw
; the new row at the bottom.

(define (make-seeded-row)
  ; Single 1 in the middle, 0s everywhere else. Classic starting shape.
  (let build ((i 0) (acc '()))
    (if (= i W)
        (reverse acc)
        (build (+ i 1) (cons (if (= i (quotient W 2)) 1 0) acc)))))

(define current-row (make-seeded-row))

; Draw the current row at the given y coordinate. 1s are pink, 0s
; stay black.
(define (draw-row row y)
  (let loop ((r row) (x 0))
    (when (not (null? r))
      (pset x y (if (= (car r) 1) 14 0))
      (loop (cdr r) (+ x 1)))))

; Compute the next row from the current row, wrapping at the edges.
; The list is short (80) so a direct fold-left with lookahead is fine.
(define (next-row row)
  (let* ((v      (list->vector-ish row))    ; helper below
         (n      (length row))
         (left-i (lambda (i) (modulo (- i 1) n)))
         (right-i (lambda (i) (modulo (+ i 1) n))))
    (let build ((i 0) (acc '()))
      (if (= i n)
          (reverse acc)
          (build (+ i 1)
                 (cons (apply-rule (list-ref row (left-i i))
                                   (list-ref row i)
                                   (list-ref row (right-i i)))
                       acc))))))

; list-ref on an 80-item list per cell is O(n²) per row — for 80×80
; that's fine (6400 ops), but we keep the helper name honest.
(define (list->vector-ish lst) lst)

; ── scroll + step ────────────────────────────────────────────────
;
; Each frame: shift the whole image up one pixel (drop row 0, move
; everything else up, blank the bottom row), then draw the new row at
; the bottom.

(define (scroll-up)
  (let scan-y ((y 1))
    (when (< y H)
      (let scan-x ((x 0))
        (when (< x W)
          (pset x (- y 1) (pget x y))
          (scan-x (+ x 1))))
      (scan-y (+ y 1))))
  ; Clear the bottom row.
  (let clear-x ((x 0))
    (when (< x W)
      (pset x (- H 1) 0)
      (clear-x (+ x 1)))))

(define (step-1d)
  (scroll-up)
  (set! current-row (next-row current-row))
  (draw-row current-row (- H 1)))

; ── controls ────────────────────────────────────────────────────

(define (set-rule! n)
  (set! current-rule n)
  (set! rule-table (decode-rule n))
  (clear)
  (set! current-row (make-seeded-row))
  (draw-row current-row (- H 1))
  (display "rule ")
  (display n)
  (newline))

(on-key
  (lambda (k)
    (case k
      ((3) (set-rule! 30))
      ((9) (set-rule! 90))
      ((1) (set-rule! 110))
      ((5) (set-rule! 54))
      ((8) (set-rule! 184))
      ((r) (clear)
           (set! current-row (make-seeded-row))
           (draw-row current-row (- H 1)))
      ((c) (clear)
           (set! current-row (make-seeded-row))
           (draw-row current-row (- H 1)))
      ((+ =) (set-frame-rate (min 60 (+ (frame-rate) 5))))
      ((- _) (set-frame-rate (max 1  (- (frame-rate) 5)))))))

; ── boot ─────────────────────────────────────────────────────────

(set-frame-rate 20)
(draw-row current-row (- H 1))
(on-frame (lambda (f) (step-1d)))

(display "Wolfram 1D running. Rule ")
(display current-rule)
(display ". Keys: 3=r30 9=r90 1=r110 5=r54 8=r184 r=reset")
(newline)
