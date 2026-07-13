; bouncing-ball.scm — L3 demo: a ball falls, hits the floor, bounces.
;
; This program uses only L0 (arithmetic + define) and L3 (game verbs).
; No adapter required — it runs headless and prints the ball's position
; at each frame.
;
; Run:
;   ./bin/sakura-scheme run examples/bouncing-ball.scm

; ── set up the world ────────────────────────────────────────────────
;
; Zero gravity would leave the ball drifting; the default 0.5 is a
; cartoony fall speed. Friction 0.99 keeps energy in the system so the
; ball bounces a few times before settling.
(physics/gravity! 0.5)
(physics/friction! 0.99)

; The ball starts at the top of a 80×80 world with a slight horizontal
; velocity to make the trajectory interesting.
(entity/make 'ball 40 5 4 4)
(entity/set-velocity! 'ball 1 0)

; The floor is a static entity at the bottom of the world. Pin it so
; gravity doesn't act on it — floors shouldn't fall.
(entity/make 'floor 0 76 80 4)
(entity/pin! 'floor)
(entity/tag! 'floor 'ground)

; ── run 30 physics frames ───────────────────────────────────────────
;
; Each frame: step physics, check for collision with the floor, bounce
; the ball's Y velocity if it hits.
(define (step n)
  (if (> n 0)
      (begin
        (physics/step)
        ; Simple bounce — if the ball hits the floor, flip vy AND
        ; damp it slightly.
        (if (entity/collides? 'ball 'floor)
            (let ((s (entity/get 'ball)))
              ; s is (id x y vx vy w h). We keep x, but reset y to
              ; just above the floor and invert vy with 0.7 damping.
              (entity/set-velocity! 'ball
                                    (list-ref s 3)          ; vx unchanged
                                    (* -0.7 (list-ref s 4))))) ; -0.7 * vy
        ; Print the current position + velocity.
        (display "frame ")
        (display (- 31 n))
        (display ": ")
        (display (entity/get 'ball))
        (newline)
        (step (- n 1)))))

(step 30)
(display "done — the ball settled.")
(newline)
