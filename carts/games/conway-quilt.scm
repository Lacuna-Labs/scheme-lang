; conway-quilt.scm — three panels, three cellular-automaton rules.
;
; Verbs exercised: set-mode, clear, set-color, pset, pget, make-vector,
;                  vector-set!, vector-ref, random-int.
; Why it's interesting: Conway's B3/S23 is the famous one — but change
; the rules and you get a whole other world. This cart runs three
; different rulesets side by side on 26×26 panels, so you can watch
; each one settle into its own aesthetic.
;
;   left:   B3/S23      — Conway. Blinkers and gliders.
;   middle: B36/S23     — HighLife. Also has a "replicator".
;   right:  B3/S12345   — Maze. Grows dendritic maze patterns.
;
; Run:
;   ./bin/sakura-scheme run carts/games/conway-quilt.scm

(set-mode 'sakura)

(define ALIVE 14)
(define DEAD  0)
(define GRID 16)

; Three panels: x = 3, x = 30, x = 57. Each is GRID×GRID.
(define panels (list 3 30 57))

; Store panel state as vectors (row-major, GRID×GRID).
(define (new-panel) (make-vector (* GRID GRID) 0))
(define a-cur (new-panel))
(define b-cur (new-panel))
(define c-cur (new-panel))
(define a-next (new-panel))
(define b-next (new-panel))
(define c-next (new-panel))

(define (idx x y) (+ x (* y GRID)))

; Random seed — ~35% fill each.
(define (seed panel)
  (let loop ((i 0))
    (if (< i (* GRID GRID))
        (begin
          (vector-set! panel i (if (< (random-int 100) 35) 1 0))
          (loop (+ i 1))))))

(seed a-cur) (seed b-cur) (seed c-cur)

; Toroidal neighbor count — unrolled for speed.
(define (neighbors panel x y)
  (let ((xm (modulo (- x 1) GRID))
        (xp (modulo (+ x 1) GRID))
        (ym (modulo (- y 1) GRID))
        (yp (modulo (+ y 1) GRID)))
    (+ (vector-ref panel (idx xm ym))
       (vector-ref panel (idx x  ym))
       (vector-ref panel (idx xp ym))
       (vector-ref panel (idx xm y))
       (vector-ref panel (idx xp y))
       (vector-ref panel (idx xm yp))
       (vector-ref panel (idx x  yp))
       (vector-ref panel (idx xp yp)))))

; Given a panel, a next panel, a birth-set, and a survival-set, step.
(define (step-panel cur nxt birth survive)
  (let py ((y 0))
    (if (< y GRID)
        (begin
          (let px ((x 0))
            (if (< x GRID)
                (let* ((alive (vector-ref cur (idx x y)))
                       (n (neighbors cur x y)))
                  (vector-set! nxt (idx x y)
                               (cond ((and (= alive 1) (member n survive)) 1)
                                     ((and (= alive 0) (member n birth)) 1)
                                     (else 0)))
                  (px (+ x 1)))))
          (py (+ y 1))))))

; Draw a panel at ox, oy.
(define (draw-panel panel ox oy)
  (let py ((y 0))
    (if (< y GRID)
        (begin
          (let px ((x 0))
            (if (< x GRID)
                (begin
                  (pset (+ ox x) (+ oy y)
                        (if (= 1 (vector-ref panel (idx x y))) ALIVE DEAD))
                  (px (+ x 1)))))
          (py (+ y 1))))))

; Run 10 generations.
(let gen ((g 0))
  (if (< g 10)
      (begin
        ; Conway: B3, S23
        (step-panel a-cur a-next '(3) '(2 3))
        ; HighLife: B36, S23
        (step-panel b-cur b-next '(3 6) '(2 3))
        ; Maze: B3, S12345
        (step-panel c-cur c-next '(3) '(1 2 3 4 5))
        ; Swap by copying next → cur.
        (let swap ((i 0))
          (if (< i (* GRID GRID))
              (begin
                (vector-set! a-cur i (vector-ref a-next i))
                (vector-set! b-cur i (vector-ref b-next i))
                (vector-set! c-cur i (vector-ref c-next i))
                (swap (+ i 1)))))
        (gen (+ g 1)))))

; Draw all three panels.
(clear)
; Three 16-wide panels with 6px gaps: x = 6, 28, 50.
(draw-panel a-cur 6 32)
(draw-panel b-cur 28 32)
(draw-panel c-cur 50 32)

; Labels are hard without text — use color stripes instead.
(set-color 12) (rect-fill 6 27 GRID 2)      ; blue = Conway
(set-color 11) (rect-fill 28 27 GRID 2)     ; green = HighLife
(set-color 10) (rect-fill 50 27 GRID 2)     ; yellow = Maze

(display "conway-quilt complete — 10 generations of ")
(display "Conway, HighLife, and Maze rules, side by side.")
(newline)
