; fireworks.scm — bursts of colored sparks against a dark sky.
;
; Verbs exercised: set-mode, clear, set-color, pset, sin, cos,
;                  random-range, random-int.
; Why it's interesting: each firework is a source point that spawns
; radially outward. A little gravity pulls the sparks down, so the
; classic weeping-willow shape emerges from a single vector field.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/fireworks.scm

(set-mode 'sakura)
(clear)

(define spark-count 24)

; One burst — draw sparks from a center point, each with a random
; direction, walking outward for `life` steps under a gravity drift.
(define (burst cx cy color)
  (let each ((k 0))
    (if (< k spark-count)
        (let* ((theta (* (/ k spark-count) 2 3.14159265))
               (speed (+ 0.5 (/ (random-int 100) 100.0)))
               (vx (* speed (cos theta)))
               (vy (* speed (sin theta)))
               (life (+ 8 (random-int 12))))
          (let walk ((t 0) (x cx) (y cy) (yv vy))
            (if (< t life)
                (begin
                  (set-color color)
                  (pset (round x) (round y) color)
                  (walk (+ t 1)
                        (+ x vx)
                        (+ y yv)
                        (+ yv 0.15))))) ; gravity drift
          (each (+ k 1))))))

; Three bursts staggered across the sky, each a different palette hue.
(burst 20 25 14)                ; pink
(burst 55 20 10)                ; yellow
(burst 40 45 12)                ; blue

; A fourth burst near the bottom for balance.
(burst 30 55 11)                ; green

(display "fireworks complete: 4 bursts × ")
(display spark-count)
(display " sparks.")
(newline)
