; langtons-ant.scm — one ant, two rules, emergent order from chaos.
;
; Langton's Ant is a two-dimensional Turing machine invented by Chris
; Langton in 1986. It's the simplest possible CA that produces surprise:
;
;   1. If the ant is on a WHITE cell:
;        flip it to BLACK, turn 90° RIGHT, step forward one cell.
;   2. If the ant is on a BLACK cell:
;        flip it to WHITE, turn 90° LEFT, step forward one cell.
;
; That's the whole program. Two rules.
;
; What happens: for the first ~500 steps the ant scribbles a symmetric
; blob. Then it goes chaotic for ~10,000 steps of random-looking mess.
; Then — and this is the miracle — around step 10,000 it locks into a
; repeating 104-step cycle that walks diagonally forever, building an
; endless "highway" across the grid.
;
; Nobody has proven Langton's Ant ALWAYS eventually builds a highway
; from any starting configuration. It's an open problem. Every ant
; anyone has ever run has eventually built one.
;
; Run:
;   ./bin/sakura-scheme run examples/langtons-ant.scm

(set-mode 'sakura)           ; 80×80
(clear 7)                    ; start with the whole grid WHITE (color 7)

(define W 80)
(define H 80)

; ── the ant ────────────────────────────────────────────────────────
;
; Ant state: position (x y) and heading. Heading is 0=north, 1=east,
; 2=south, 3=west. Turning right = +1 mod 4; turning left = -1 mod 4.

(define ant-x 40)
(define ant-y 40)
(define ant-h 0)             ; heading north
(define step-count 0)

; Two colors for the grid — white background, black trail.
; The ant itself renders in pink (color 14) so you can see where it is.
(define WHITE 7)
(define BLACK 0)
(define ANT-COLOR 14)

; ── one step ──────────────────────────────────────────────────────
;
; Read the cell UNDER the ant (not the ant's pink pixel — we track the
; underlying color separately). The ant repaints its old position when
; it moves, then flags its new position with the ant color.

; The tricky bit: the framebuffer shows the ant as pink, but rules
; depend on the ORIGINAL cell color at that spot. So we keep track of
; what was under the ant BEFORE we painted it pink.
(define under-ant WHITE)     ; the color that will be revealed when
                             ; the ant leaves this cell

(define (turn-right) (set! ant-h (modulo (+ ant-h 1) 4)))
(define (turn-left)  (set! ant-h (modulo (- ant-h 1) 4)))

(define (step-forward)
  (cond
    ((= ant-h 0) (set! ant-y (modulo (- ant-y 1) H)))   ; north
    ((= ant-h 1) (set! ant-x (modulo (+ ant-x 1) W)))   ; east
    ((= ant-h 2) (set! ant-y (modulo (+ ant-y 1) H)))   ; south
    ((= ant-h 3) (set! ant-x (modulo (- ant-x 1) W))))) ; west

(define (step-ant)
  ; What was the cell before the ant arrived? (under-ant remembers.)
  (let ((was under-ant))
    ; Apply the rule: flip color, turn, step.
    (cond
      ((= was WHITE)
        ; White → flip to black, turn right.
        (pset ant-x ant-y BLACK)
        (turn-right))
      (else
        ; Black → flip to white, turn left.
        (pset ant-x ant-y WHITE)
        (turn-left)))
    ; Move to the next cell.
    (step-forward)
    ; Remember what's under the new position (it hasn't been repainted
    ; pink yet — we read the true underlying color first).
    (set! under-ant (pget ant-x ant-y))
    ; Now paint the ant on top so we can see it.
    (pset ant-x ant-y ANT-COLOR)
    (set! step-count (+ step-count 1))))

; ── the loop ──────────────────────────────────────────────────────

; The ant is fast — do many steps per frame so you can see the pattern
; emerge in seconds rather than minutes.
(define steps-per-frame 50)

(on-frame
  (lambda (f)
    (let loop ((i 0))
      (when (< i steps-per-frame)
        (step-ant)
        (loop (+ i 1))))))

(on-key
  (lambda (k)
    (case k
      ; +/- change simulation speed (steps per frame).
      ((+ =) (set! steps-per-frame (min 500 (+ steps-per-frame 10))))
      ((- _) (set! steps-per-frame (max 1   (- steps-per-frame 10))))
      ; r resets: white grid, ant back to center facing north.
      ((r)   (clear WHITE)
             (set! ant-x 40) (set! ant-y 40) (set! ant-h 0)
             (set! under-ant WHITE)
             (set! step-count 0)
             (pset ant-x ant-y ANT-COLOR)))))

; Boot: place the ant.
(pset ant-x ant-y ANT-COLOR)
(set-frame-rate 30)
(display "Langton's Ant running. Watch for chaos → highway around step 10,000.")
(newline)
(display "  +/-  speed   r  reset")
(newline)
