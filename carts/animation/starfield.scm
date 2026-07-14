; starfield.scm — stars streaming past you at warp.
;
; Verbs exercised: set-mode, clear, set-color, pset, random-range,
;                  vector, vector-ref, vector-set!.
; Why it's interesting: each star has a position and a Z (distance).
; Every frame Z drops by a speed. A star's screen position is
; (x/z, y/z) — the projection is what gives the streaming feeling.
; When a star gets too close, it recycles to the far distance.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/starfield.scm

(set-mode 'sakura)

(define star-count 60)
(define frames 40)

; Star storage — three vectors, one per component. Parallel arrays are
; the tail-recursion-safe way to hold n small records without hashing.
(define xs (make-vector star-count 0))
(define ys (make-vector star-count 0))
(define zs (make-vector star-count 0))

; Seed each star at a random position and Z.
(let init ((i 0))
  (if (< i star-count)
      (begin
        (vector-set! xs i (- (random-range -40 40) 0))
        (vector-set! ys i (- (random-range -40 40) 0))
        (vector-set! zs i (random-range 1 40))
        (init (+ i 1)))))

; One frame: clear, then draw + step every star.
(define (step-frame)
  (clear)
  (let each ((i 0))
    (if (< i star-count)
        (let* ((z (vector-ref zs i))
               (x (vector-ref xs i))
               (y (vector-ref ys i)))
          ; Project into screen space centered at (40,40).
          (let ((sx (+ 40 (round (/ x (max z 0.5)))))
                (sy (+ 40 (round (/ y (max z 0.5))))))
            ; Color by depth — closer stars brighter.
            (set-color (if (< z 10) 7 (if (< z 25) 6 5)))
            (pset sx sy (if (< z 10) 7 (if (< z 25) 6 5))))
          ; Advance the star.
          (vector-set! zs i (- (vector-ref zs i) 1.2))
          (if (< (vector-ref zs i) 1)
              (begin
                (vector-set! xs i (- (random-range -40 40) 0))
                (vector-set! ys i (- (random-range -40 40) 0))
                (vector-set! zs i 40)))
          (each (+ i 1))))))

(let loop ((f 0))
  (if (< f frames)
      (begin (step-frame) (loop (+ f 1)))))

(display "starfield complete: ")
(display frames)
(display " frames × ")
(display star-count)
(display " stars.")
(newline)
