; pendulum.scm — a simple pendulum. Angle equation, one dot swinging.
;
; Verbs exercised: set-mode, clear, set-color, disc, line, sin, cos.
; Why it's interesting: angular acceleration = -g/L · sin(theta) is
; the whole story. This cart integrates that equation and draws the
; bob's position each frame. Small angles look like a sine wave;
; larger swings show off the nonlinearity — try starting at (pi - 0.1).
;
; Run:
;   ./bin/sakura-scheme run carts/physics/pendulum.scm

(set-mode 'sakura)

; Pivot at the top center.
(define px 40)
(define py 12)

; Pendulum state.
(define theta 1.0)              ; initial angle (radians)
(define omega 0)                ; angular velocity
(define L 32)                   ; length
(define g 0.03)                 ; gravity

(define frames 90)

(define (step-frame)
  (clear)
  ; Integrate: alpha = -g/L · sin(theta)
  (let* ((alpha (* (- g) (sin theta))))
    (set! omega (+ omega alpha))
    (set! theta (+ theta omega)))
  ; Draw the string.
  (let* ((bx (round (+ px (* L (sin theta)))))
         (by (round (+ py (* L (cos theta))))))
    (set-color 6)
    (line px py bx by)
    ; Draw the pivot.
    (set-color 5)
    (disc px py 2)
    ; Draw the bob.
    (set-color 14)
    (disc bx by 4)))

(let loop ((f 0))
  (if (< f frames)
      (begin (step-frame) (loop (+ f 1)))))

(display "pendulum complete: ")
(display frames)
(display " frames.  final theta = ")
(display theta)
(display "  omega = ")
(display omega)
(newline)
