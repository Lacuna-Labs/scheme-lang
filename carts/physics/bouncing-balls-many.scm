; bouncing-balls-many.scm — twelve balls in a box, all bouncing.
;
; Verbs exercised: set-mode, physics/gravity!, physics/friction!,
;                  entity/make, entity/pin!, entity/set-velocity!,
;                  entity/state, entity/collides?, physics/step,
;                  clear, set-color, disc, string->symbol, number->string.
; Why it's interesting: the physics engine handles each ball
; independently. The interesting behavior — near-collisions, energy
; loss, patterns — emerges from many simple, identical simulations
; running in parallel.
;
; Run:
;   ./bin/sakura-scheme run carts/physics/bouncing-balls-many.scm

(set-mode 'sakura)
(physics/gravity! 0.35)
(physics/friction! 0.995)

; Four walls — pinned rectangles.
(entity/make 'floor 0 76 80 4) (entity/pin! 'floor)
(entity/make 'ceil 0 0 80 2)   (entity/pin! 'ceil)
(entity/make 'left 0 0 2 80)   (entity/pin! 'left)
(entity/make 'right 78 0 2 80) (entity/pin! 'right)

; Spawn 12 balls with different starting positions and velocities.
(define ball-count 12)

(let spawn ((i 0))
  (if (< i ball-count)
      (let* ((id (string->symbol (string-append "b" (number->string i))))
             (x (+ 8 (* i 5)))
             (y (+ 10 (modulo (* i 7) 20)))
             (vx (- (modulo (* i 3) 4) 1.5))
             (vy (- (modulo (* i 5) 3) 1)))
        (entity/make id x y 3 3)
        (entity/set-velocity! id vx vy)
        (spawn (+ i 1)))))

; Colors for the balls, cycling through the palette.
(define ball-colors (list 14 12 11 10 9 8))

(define (color-for i)
  (list-ref ball-colors (modulo i 6)))

; A frame: physics step, floor/wall bounce for every ball, redraw all.
(define (bounce id vy-flip? vx-flip?)
  (let ((s (entity/state id)))
    ; s = (id x y vx vy w h)
    (let ((vx (list-ref s 3)) (vy (list-ref s 4)))
      (entity/set-velocity! id
                            (if vx-flip? (* -0.85 vx) vx)
                            (if vy-flip? (* -0.85 vy) vy)))))

(define (draw-ball id color)
  (let ((s (entity/state id)))
    (set-color color)
    (disc (round (+ (list-ref s 1) 1))
          (round (+ (list-ref s 2) 1))
          2)))

(define (step-frame)
  (physics/step)
  (clear)
  ; Walls.
  (set-color 6) (rect-fill 0 76 80 4)
  (rect-fill 0 0 80 2) (rect-fill 0 0 2 80) (rect-fill 78 0 2 80)
  ; Per ball: bounce off any wall it touches, then draw.
  (let each ((i 0))
    (if (< i ball-count)
        (let ((id (string->symbol (string-append "b" (number->string i)))))
          (cond ((entity/collides? id 'floor) (bounce id #t #f))
                ((entity/collides? id 'ceil)  (bounce id #t #f))
                ((entity/collides? id 'left)  (bounce id #f #t))
                ((entity/collides? id 'right) (bounce id #f #t)))
          (draw-ball id (color-for i))
          (each (+ i 1))))))

; Run 100 frames.
(let loop ((f 0))
  (if (< f 100)
      (begin (step-frame) (loop (+ f 1)))))

(display "bouncing-balls-many complete: ")
(display ball-count)
(display " balls × 100 frames.")
(newline)
