; breakout.scm — the classic paddle-and-bricks arcade.
;
; A ball bounces around the top of an 80×80 world. A paddle sits at the
; bottom. Bricks line the top four rows. The ball breaks bricks it
; touches, bounces off walls and the paddle, and dies when it drops off
; the bottom.
;
; This example RUNS ITSELF: an autopilot paddle tracks the ball so you
; can see the mechanic without a keyboard. Change (autopilot?) to #f and
; hook (on-key) if you want to drive it yourself.
;
; Verbs demoed: set-mode, clear, set-color, rect-fill, entity/make,
;               entity/set-velocity!, entity/move, physics/step,
;               entity/collides?, tone, note, tick-frame.
;
; Run:
;   sakura-scheme --example breakout
;   sakura-scheme run examples/breakout.scm

(set-mode 'sakura)                  ; 80×80 pixel world
(physics/gravity! 0)                ; brick-and-ball worlds are gravity-free
(physics/friction! 1.0)             ; no drag either

; ── the world ──────────────────────────────────────────────────────
;
; The paddle is a 12×3 pinned rectangle 4 pixels from the bottom.
; The ball is a 3×3 mover with an initial diagonal velocity.
; Bricks live in a 10×4 grid at the top of the screen.

(define paddle-w 12)
(define paddle-y 74)
(define brick-w 8)
(define brick-h 4)
(define brick-cols 10)
(define brick-rows 4)

(entity/make 'paddle 34 paddle-y paddle-w 3)
(entity/pin! 'paddle)
(entity/tag! 'paddle 'wall)

(entity/make 'ball 40 40 3 3)
(entity/set-velocity! 'ball 0.9 0.9)
(entity/tag! 'ball 'ball)

; Build the brick wall. Each brick is a pinned entity so it can be
; collided with, but doesn't move. The color alternates by row.
(define (make-bricks row)
  (if (< row brick-rows)
      (begin
        (make-brick-row row 0)
        (make-bricks (+ row 1)))))
(define (make-brick-row row col)
  (if (< col brick-cols)
      (begin
        (entity/make (string->symbol (string-append "b-" (number->string row) "-" (number->string col)))
                     (* col brick-w) (+ 6 (* row brick-h))
                     brick-w brick-h)
        (entity/tag! (string->symbol (string-append "b-" (number->string row) "-" (number->string col))) 'brick)
        (entity/pin! (string->symbol (string-append "b-" (number->string row) "-" (number->string col))))
        (make-brick-row row (+ col 1)))))
(make-bricks 0)

; ── drawing ────────────────────────────────────────────────────────
;
; Each frame: clear, redraw every brick + the paddle + the ball. Colors
; are chosen so the ball (pink) pops against the muted bricks (blues +
; peaches).

(define (draw)
  (clear)
  ; Bricks: read every entity, skip non-bricks, paint each in a color
  ; that depends on its row.
  (for-each
   (lambda (id)
     (let ((e (entity/get id)))
       (if (and e (entity/has-tag? id 'brick))
           (begin
             (set-color (+ 8 (modulo (list-ref e 2) 4)))  ; 8..11 by row
             (rect-fill (list-ref e 1) (list-ref e 2)
                        (list-ref e 5) (list-ref e 6))))))
   (entity/all))
  ; Paddle: soft peach.
  (let ((p (entity/get 'paddle)))
    (set-color 15)
    (rect-fill (list-ref p 1) (list-ref p 2)
               (list-ref p 5) (list-ref p 6)))
  ; Ball: petal-pink.
  (let ((b (entity/get 'ball)))
    (set-color 14)
    (rect-fill (list-ref b 1) (list-ref b 2)
               (list-ref b 5) (list-ref b 6))))

; ── collision + reflection ─────────────────────────────────────────

(define (ball-x)  (list-ref (entity/get 'ball) 1))
(define (ball-y)  (list-ref (entity/get 'ball) 2))
(define (ball-vx) (list-ref (entity/get 'ball) 3))
(define (ball-vy) (list-ref (entity/get 'ball) 4))

(define (reflect-walls!)
  ; Bounce off left/right/top edges. The bottom is death (see game loop).
  (if (or (<= (ball-x) 0) (>= (ball-x) 77))
      (entity/set-velocity! 'ball (- 0 (ball-vx)) (ball-vy)))
  (if (<= (ball-y) 0)
      (entity/set-velocity! 'ball (ball-vx) (- 0 (ball-vy)))))

(define (handle-brick-hits!)
  (let ((hits (entity/hits-tag 'ball 'brick)))
    (if (not (null? hits))
        (begin
          ; Break the first brick we're touching. Flip vy — a real Breakout
          ; would check which side we hit; kid-readable code favors clarity.
          (entity/remove! (car hits))
          (entity/set-velocity! 'ball (ball-vx) (- 0 (ball-vy)))
          (note 'C5 'sixteenth 0.6)))))

(define (handle-paddle-hit!)
  (if (entity/collides? 'ball 'paddle)
      (begin
        ; When the ball hits the paddle, its horizontal speed is nudged by
        ; where along the paddle it landed. Corner-hit = steeper angle.
        (let* ((p (entity/get 'paddle))
               (px (list-ref p 1))
               (bx (ball-x))
               (offset (- (+ bx 1.5) (+ px (/ paddle-w 2))))
               (nudge (/ offset 8)))
          (entity/set-velocity! 'ball (+ (ball-vx) nudge) (- 0 (abs (ball-vy))))
          (note 'G4 'sixteenth 0.5)))))

; ── autopilot paddle ───────────────────────────────────────────────
;
; The paddle chases the ball's x position by 1 pixel per frame. Slow
; enough that the ball wins sometimes; fast enough to see rallies.

(define autopilot? #t)

(define (move-paddle!)
  (if autopilot?
      (let* ((p (entity/get 'paddle))
             (px (list-ref p 1))
             (target (- (ball-x) (/ paddle-w 2))))
        (cond ((< px target) (entity/move 'paddle 1 0))
              ((> px target) (entity/move 'paddle -1 0))))))

; ── the game loop ──────────────────────────────────────────────────

(define alive? #t)
(define frames-left 240)

(define (game-frame)
  (if (and alive? (> frames-left 0))
      (begin
        (physics/step)
        (reflect-walls!)
        (handle-brick-hits!)
        (handle-paddle-hit!)
        (move-paddle!)
        (draw)
        (if (> (ball-y) 78) (set! alive? #f))
        (set! frames-left (- frames-left 1))
        (tick-frame)
        (game-frame))))

(display "breakout — 240 frames of autopilot rally.")
(newline)
(game-frame)
(if alive?
    (display "ball survived — bricks remaining: ")
    (display "the ball fell. game over. bricks remaining: "))
(display (length (filter (lambda (id) (entity/has-tag? id 'brick)) (entity/all))))
(newline)
(render)
