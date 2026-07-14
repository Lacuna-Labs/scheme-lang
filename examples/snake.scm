; snake.scm — the tail-growing snake, running as an autoplay demo.
;
; The snake is a list of cells; the head is the first cell. Each step
; we pick a heading, push a new cell in that direction, and drop the
; tail — unless we just ate food, in which case we keep the tail and
; the snake grows.
;
; This demo autoplays a food-chasing snake for ~200 steps, drawing each
; frame to the framebuffer + playing a short chirp when food is eaten.
; Wrap-around: the snake exits one edge and enters the other.
;
; Verbs demoed: set-mode, clear, set-color, rect-fill, disc,
;               random-int, list, car, cdr, note, tick-frame.
;
; Run:
;   sakura-scheme --example snake
;   sakura-scheme run examples/snake.scm

(set-mode 'sakura)         ; 80×80
(define cell 4)            ; each snake cell is 4×4 pixels
(define cols (/ 80 cell))  ; 20 columns
(define rows (/ 80 cell))  ; 20 rows

; ── the snake ──────────────────────────────────────────────────────
;
; A cell is a two-element list: (x y). The snake is a list of cells,
; head first. Start length 3, moving east.
; Directions: 0=east 1=south 2=west 3=north

(define snake  (list (list 10 10) (list 9 10) (list 8 10)))
(define dir    0)
(define food   (list 15 10))
(define eaten  0)
(define alive? #t)

(define (cx c)   (car c))
(define (cy c)   (car (cdr c)))
(define (head)   (car snake))
(define (tail)   (cdr snake))

(define (dx-of d) (cond ((= d 0) 1) ((= d 2) -1) (else 0)))
(define (dy-of d) (cond ((= d 1) 1) ((= d 3) -1) (else 0)))

; Wrap x/y around the grid (Pac-Man-style edges).
(define (wrap x n) (modulo (+ x n) n))

; ── one step of snake logic ────────────────────────────────────────

(define (cells-equal? a b)
  (and (= (cx a) (cx b)) (= (cy a) (cy b))))

(define (in-snake? c s)
  (cond ((null? s) #f)
        ((cells-equal? c (car s)) #t)
        (else (in-snake? c (cdr s)))))

(define (new-food)
  (let ((c (list (random-int cols) (random-int rows))))
    (if (in-snake? c snake) (new-food) c)))

; Drop the last element — the snake's tail vanishes each step it doesn't eat.
(define (drop-last xs)
  (if (or (null? xs) (null? (cdr xs))) '()
      (cons (car xs) (drop-last (cdr xs)))))

(define (step-snake!)
  (let* ((h (head))
         (nx (wrap (+ (cx h) (dx-of dir)) cols))
         (ny (wrap (+ (cy h) (dy-of dir)) rows))
         (nhead (list nx ny)))
    ; Self-collision (with body, not tail-cell it just left) ends the game.
    (if (in-snake? nhead (tail))
        (set! alive? #f)
        (if (cells-equal? nhead food)
            (begin
              (set! snake (cons nhead snake))    ; grow — keep tail
              (set! food (new-food))
              (set! eaten (+ eaten 1))
              (note 'E5 'sixteenth 0.7))
            (set! snake (cons nhead (drop-last snake)))))))

; ── autopilot direction picker ─────────────────────────────────────
;
; A simple AI: turn toward food most of the time, occasionally wander.
; Not a great player — just a lively demo.

(define (choose-dir!)
  (if (< (random) 0.10)
      (set! dir (random-int 4))                    ; random wander
      (let* ((h (head))
             (dx (- (cx food) (cx h)))
             (dy (- (cy food) (cy h))))
        (cond ((> (abs dx) (abs dy))
               (set! dir (if (> dx 0) 0 2)))
              (else
               (set! dir (if (> dy 0) 1 3)))))))

; ── drawing ────────────────────────────────────────────────────────

(define (draw)
  (clear)
  ; Food — a bright red disc.
  (set-color 8)
  (disc (+ (* (cx food) cell) 2) (+ (* (cy food) cell) 2) 2)
  ; Snake — green head, dark-green body.
  (let loop ((s snake) (first? #t))
    (if (null? s) 'done
        (let ((c (car s)))
          (set-color (if first? 11 3))
          (rect-fill (* (cx c) cell) (* (cy c) cell) cell cell)
          (loop (cdr s) #f)))))

; ── the game loop ──────────────────────────────────────────────────

(define frames 200)
(display "snake — autopilot for ")
(display frames)
(display " steps.")
(newline)

(define (game-loop n)
  (if (and alive? (> n 0))
      (begin
        (choose-dir!)
        (step-snake!)
        (draw)
        (tick-frame)
        (game-loop (- n 1)))))

(game-loop frames)
(display (if alive? "alive · " "died · "))
(display "length ")
(display (length snake))
(display " · ate ")
(display eaten)
(newline)
(render)
