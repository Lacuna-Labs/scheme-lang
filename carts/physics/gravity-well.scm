; gravity-well.scm — a heavy body pulls particles toward it. Newtonian
; inverse-square gravity, computed by hand (no physics engine).
;
; Verbs exercised: set-mode, clear, set-color, pset, sqrt, make-vector,
;                  vector-set!, vector-ref, sin, cos.
; Why it's interesting: Newton's law says F = G·m·M / r². Each frame,
; every particle feels a pull toward the central mass with magnitude
; that grows as it approaches. Give a particle a sideways velocity and
; you get an orbit. Give it none and it falls straight in.
;
; Run:
;   ./bin/sakura-scheme run carts/physics/gravity-well.scm

(set-mode 'sakura)

(define cx 40)
(define cy 40)
(define G 40)                   ; gravitational constant, tuned

(define n 20)
(define xs (make-vector n 0))
(define ys (make-vector n 0))
(define vxs (make-vector n 0))
(define vys (make-vector n 0))

; Seed particles on a ring, moving perpendicular to the radius.
; That's the tangent-velocity trick for a circular orbit.
(let seed ((i 0))
  (if (< i n)
      (let* ((theta (* (/ i n) 2 3.14159265))
             (r (+ 22 (modulo (* i 7) 8)))
             (v (/ (sqrt (/ G r)) 1.0)))
        (vector-set! xs i (+ cx (* r (cos theta))))
        (vector-set! ys i (+ cy (* r (sin theta))))
        (vector-set! vxs i (* v (- (sin theta))))
        (vector-set! vys i (* v (cos theta)))
        (seed (+ i 1)))))

(define (step-frame)
  (clear)
  ; Central mass.
  (set-color 10)
  (disc cx cy 3)
  ; Each particle: compute pull toward center, update velocity, move.
  (let each ((i 0))
    (if (< i n)
        (let* ((x (vector-ref xs i))
               (y (vector-ref ys i))
               (dx (- cx x))
               (dy (- cy y))
               (r2 (max 4 (+ (* dx dx) (* dy dy))))
               (r  (sqrt r2))
               (a  (/ G r2))              ; magnitude of acceleration
               (ax (/ (* a dx) r))
               (ay (/ (* a dy) r))
               (nvx (+ (vector-ref vxs i) ax))
               (nvy (+ (vector-ref vys i) ay))
               (nx  (+ x nvx))
               (ny  (+ y nvy)))
          (vector-set! vxs i nvx)
          (vector-set! vys i nvy)
          (vector-set! xs  i nx)
          (vector-set! ys  i ny)
          (set-color 14)
          (pset (round nx) (round ny) 14)
          (each (+ i 1))))))

; Run 80 frames.
(let loop ((f 0))
  (if (< f 80)
      (begin (step-frame) (loop (+ f 1)))))

(display "gravity-well complete: ")
(display n)
(display " orbiting particles × 80 frames.")
(newline)
