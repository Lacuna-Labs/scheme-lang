; sierpinski.scm — Sierpinski triangle via the chaos game.
;
; Verbs exercised: set-mode, clear, set-color, pset, random-int.
; Why it's interesting: pick three vertices of a triangle. Start with a
; random point. Repeatedly move HALFWAY toward a randomly chosen vertex
; and paint that spot. In a few thousand steps the Sierpinski triangle
; emerges — order from pure noise, which shouldn't work but does.
;
; Run:
;   ./bin/sakura-scheme run carts/math/sierpinski.scm

(set-mode 'sakura)
(clear)

; Three vertices near the edges of the 80×80 canvas.
(define ax 40) (define ay 6)
(define bx 6)  (define by 74)
(define cx 74) (define cy 74)

; Start somewhere reasonable.
(define x 40)
(define y 40)

(define iters 3000)

; The chaos game — each step: pick a vertex, walk halfway toward it,
; drop a pixel there.
(set-color 14)
(let step ((i 0))
  (if (< i iters)
      (let ((pick (random-int 3)))
        (cond ((= pick 0)
               (set! x (/ (+ x ax) 2))
               (set! y (/ (+ y ay) 2)))
              ((= pick 1)
               (set! x (/ (+ x bx) 2))
               (set! y (/ (+ y by) 2)))
              (else
               (set! x (/ (+ x cx) 2))
               (set! y (/ (+ y cy) 2))))
        ; Skip the first few points — they're outside the attractor.
        (if (> i 20)
            (pset (round x) (round y) 14))
        (step (+ i 1)))))

; Mark the three vertices in a different color so their role is visible.
(set-color 12)
(pset ax ay 12)
(pset bx by 12)
(pset cx cy 12)

(display "sierpinski complete: ")
(display iters)
(display " chaos-game iterations.")
(newline)
