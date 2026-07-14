; rain.scm — falling raindrops, streaks, and a puddle at the bottom.
;
; Verbs exercised: set-mode, clear, set-color, pset, line, rect-fill,
;                  random-int, make-vector, vector-set!, vector-ref.
; Why it's interesting: each drop has an x, y, and speed. When it hits
; the puddle level, it recycles to the top with a new x and speed.
; The puddle grows one pixel every dozen frames just for atmosphere.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/rain.scm

(set-mode 'sakura)

(define drops 40)
(define frames 50)
(define puddle-y 74)

; Parallel arrays for drop state.
(define xs (make-vector drops 0))
(define ys (make-vector drops 0))
(define vs (make-vector drops 0))

(let init ((i 0))
  (if (< i drops)
      (begin
        (vector-set! xs i (random-int 80))
        (vector-set! ys i (random-int 60))
        (vector-set! vs i (+ 1 (random-int 3)))
        (init (+ i 1)))))

; The puddle starts thin and thickens slowly.
(define puddle-h 1)

(let loop ((f 0))
  (if (< f frames)
      (begin
        (clear 1)                 ; dark-blue sky
        ; Draw the puddle band at the bottom.
        (set-color 12)
        (rect-fill 0 (- puddle-y puddle-h) 80 (+ puddle-h 6))
        ; Update and draw each drop.
        (set-color 6)
        (let each ((i 0))
          (if (< i drops)
              (let ((x (vector-ref xs i))
                    (y (vector-ref ys i))
                    (v (vector-ref vs i)))
                ; Draw the drop as a short vertical streak.
                (line x y x (min (+ y 2) puddle-y))
                (vector-set! ys i (+ y v))
                (if (>= (vector-ref ys i) puddle-y)
                    (begin
                      (vector-set! xs i (random-int 80))
                      (vector-set! ys i 0)
                      (vector-set! vs i (+ 1 (random-int 3)))))
                (each (+ i 1)))))
        (if (= 0 (modulo f 12))
            (set! puddle-h (min (+ puddle-h 1) 6)))
        (loop (+ f 1)))))

(display "rain complete: ")
(display frames)
(display " frames, puddle grew to ")
(display puddle-h)
(display " pixels deep.")
(newline)
