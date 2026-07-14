; 06-a-tiny-game.scm — one entity, gravity, a floor. A whole game loop
;                       in thirty lines.
;
; Verbs exercised: set-mode, physics/gravity!, physics/friction!,
;                  entity/make, entity/set-velocity!, entity/pin!,
;                  entity/state, entity/collides?, physics/step,
;                  clear, set-color, disc, rect-fill.
; Why it's interesting: this is the smallest simulation that shows all
; the pieces — a world with rules, a thing in it, a loop that steps
; time, and a rendering pass. Everything else is decoration.
;
; Run:
;   ./bin/sakura-scheme run carts/tutorial/06-a-tiny-game.scm

(set-mode 'sakura)
(physics/gravity! 0.4)
(physics/friction! 0.99)

; The ball starts high with a nudge sideways.
(entity/make 'ball 20 5 4 4)
(entity/set-velocity! 'ball 1.2 0)

; The floor is pinned so gravity can't drag it down.
(entity/make 'floor 0 76 80 4)
(entity/pin! 'floor)

; Step 60 frames. On each frame: physics, bounce, draw.
(define (frame n)
  (if (> n 0)
      (begin
        (physics/step)
        (if (entity/collides? 'ball 'floor)
            (let ((s (entity/state 'ball)))
              ; entity/state → (id x y vx vy w h)
              ; bounce with a bit of damping
              (entity/set-velocity! 'ball
                                    (list-ref s 3)
                                    (* -0.8 (list-ref s 4)))))
        (clear)
        (set-color 6) (rect-fill 0 76 80 4)     ; floor
        (set-color 14)                            ; petal
        (let ((s (entity/state 'ball)))
          (disc (round (list-ref s 1)) (round (list-ref s 2)) 2))
        (frame (- n 1)))))

(frame 60)

(let ((s (entity/state 'ball)))
  (display "final ball position: (")
  (display (round (list-ref s 1))) (display ", ")
  (display (round (list-ref s 2))) (display ")")
  (newline))
(display "tiny game complete.")
(newline)
