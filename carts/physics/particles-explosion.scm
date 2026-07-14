; particles-explosion.scm — one point of ignition, hundreds of sparks.
;
; Verbs exercised: make-vector, vector-set!, vector-ref, random-range,
;                  sqrt, set-mode, clear, pset.
; Why it's interesting: each spark has (x, y, vx, vy, life). Advance
; each one, shave 1 off life, recolor by age, done. The pattern isn't
; scripted — it emerges from the initial radial spread plus gravity.
;
; Run:
;   ./bin/sakura-scheme run carts/physics/particles-explosion.scm

(set-mode 'sakura)

(define N 120)
(define frames 50)

(define xs   (make-vector N 0))
(define ys   (make-vector N 0))
(define vxs  (make-vector N 0))
(define vys  (make-vector N 0))
(define life (make-vector N 0))

; Seed all particles at (40, 40) with random radial velocities.
(let seed ((i 0))
  (if (< i N)
      (let* ((theta (* (/ i N) 2 3.14159265))
             (speed (+ 0.4 (/ (random-range 0 200) 100.0))))
        (vector-set! xs   i 40)
        (vector-set! ys   i 40)
        (vector-set! vxs  i (* speed (cos theta)))
        (vector-set! vys  i (* speed (sin theta)))
        (vector-set! life i (+ 15 (modulo i 20)))
        (seed (+ i 1)))))

; Color spark by remaining life — hot when new, cool when fading.
(define (life-color L)
  (cond ((> L 25) 10)           ; yellow
        ((> L 15) 9)            ; orange
        ((> L 8)  8)            ; red
        ((> L 3)  4)            ; brown
        (else     5)))          ; dark grey

(define (step-frame)
  (clear)
  (let each ((i 0))
    (if (< i N)
        (let ((L (vector-ref life i)))
          (if (> L 0)
              (let* ((nx  (+ (vector-ref xs i) (vector-ref vxs i)))
                     (ny  (+ (vector-ref ys i) (vector-ref vys i)))
                     (nvy (+ (vector-ref vys i) 0.08))) ; gravity
                (vector-set! xs   i nx)
                (vector-set! ys   i ny)
                (vector-set! vys  i nvy)
                (vector-set! life i (- L 1))
                (let ((sx (round nx)) (sy (round ny)))
                  (if (and (>= sx 0) (< sx 80) (>= sy 0) (< sy 80))
                      (let ((c (life-color L)))
                        (set-color c)
                        (pset sx sy c))))))
          (each (+ i 1))))))

(let loop ((f 0))
  (if (< f frames)
      (begin (step-frame) (loop (+ f 1)))))

; Count how many are still alive.
(let count ((i 0) (alive 0))
  (if (>= i N)
      (begin
        (display "particles-explosion complete: ")
        (display N) (display " sparks × ")
        (display frames) (display " frames. ")
        (display alive) (display " still burning.")
        (newline))
      (count (+ i 1) (if (> (vector-ref life i) 0) (+ alive 1) alive))))
