; spring.scm — Hooke's law: F = -k·x. A mass oscillates on a spring.
;
; Verbs exercised: set-mode, clear, set-color, pset, disc, line.
; Why it's interesting: one number for stiffness (k), one for damping
; (c), and you have the whole vocabulary of a spring. This cart plots
; the mass's Y position over time — you see the classic exponentially-
; damped sinusoid, the shape of every real oscillator in the world.
;
; Run:
;   ./bin/sakura-scheme run carts/physics/spring.scm

(set-mode 'sakura)
(clear)

; Axes for the time plot.
(set-color 5)
(line 0 40 80 40)

; Spring parameters.
(define k 0.15)                 ; stiffness
(define damping 0.02)           ; drag coefficient

; State: displacement y (from equilibrium) and velocity vy.
(define y 20)                   ; pulled 20 pixels above rest
(define vy 0)

(define frames 80)

; At each step: acceleration = -k·y - damping·vy. That's Hooke + drag.
(let step ((t 0))
  (if (< t frames)
      (let* ((a (- (* (- k) y) (* damping vy)))
             (new-vy (+ vy a))
             (new-y  (+ y new-vy)))
        (set! vy new-vy)
        (set! y new-y)
        ; Plot the y position at time t.
        (set-color 14)
        (let ((py (round (- 40 y))))
          (pset t py 14)
          (pset t (+ py 1) 14))
        (step (+ t 1)))))

; Now draw the spring itself in its final resting position — a coil
; sketch on the left, mass at the bottom.
(set-color 12)
(let coil ((y0 5))
  (if (< y0 45)
      (begin
        (line 70 y0 76 (+ y0 2))
        (line 76 (+ y0 2) 70 (+ y0 4))
        (coil (+ y0 4)))))
; The mass at the bottom.
(set-color 10)
(disc 73 55 4)

(display "spring complete — 80 frames of damped oscillation, ")
(display "final y = ")
(display y)
(display "  vy = ")
(display vy)
(newline)
