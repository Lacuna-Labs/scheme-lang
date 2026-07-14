; langton-flock.scm — many Langton's ants on one grid at once.
;
; Verbs exercised: set-mode, clear, set-color, pset, pget, make-vector,
;                  vector-set!, vector-ref, modulo, random-int.
; Why it's interesting: one Langton's ant famously builds a highway
; after ~10,000 steps. Many ants at once interfere with each other's
; trails and produce something new — a churning ecosystem that
; sometimes settles into moving patterns, sometimes doesn't.
;
; Run:
;   ./bin/sakura-scheme run carts/games/langton-flock.scm

(set-mode 'sakura)
(clear 7)                       ; white background

(define W 80)
(define H 80)
(define WHITE 7)
(define BLACK 0)

(define ant-count 8)

; Parallel arrays for ant state.
(define ax  (make-vector ant-count 0))
(define ay  (make-vector ant-count 0))
(define ah  (make-vector ant-count 0))     ; heading 0=N 1=E 2=S 3=W
(define acolor (list 14 12 11 10 9 8 13 4))

; Seed at random positions with random headings.
(let seed ((i 0))
  (if (< i ant-count)
      (begin
        (vector-set! ax i (random-int W))
        (vector-set! ay i (random-int H))
        (vector-set! ah i (random-int 4))
        (seed (+ i 1)))))

; Turn a heading by delta.
(define (turn-h h d) (modulo (+ h d 4) 4))

; Advance one ant one step. Standard Langton rule: white → flip to
; black, turn right, step; black → flip to white, turn left, step.
(define (step-ant i)
  (let* ((x (vector-ref ax i))
         (y (vector-ref ay i))
         (h (vector-ref ah i))
         (c (pget x y)))
    ; Flip the cell.
    (if (= c WHITE)
        (begin (pset x y BLACK)
               (vector-set! ah i (turn-h h 1)))
        (begin (pset x y WHITE)
               (vector-set! ah i (turn-h h -1))))
    ; Step forward.
    (let ((nh (vector-ref ah i)))
      (cond ((= nh 0) (vector-set! ay i (modulo (- y 1) H)))
            ((= nh 1) (vector-set! ax i (modulo (+ x 1) W)))
            ((= nh 2) (vector-set! ay i (modulo (+ y 1) H)))
            ((= nh 3) (vector-set! ax i (modulo (- x 1) W)))))))

; Run 1500 total steps, cycling through the ants.
(let step ((s 0))
  (if (< s 1500)
      (begin
        (step-ant (modulo s ant-count))
        (step (+ s 1)))))

; Overlay each ant in its color so we can see the flock's current state.
(let mark ((i 0))
  (if (< i ant-count)
      (let ((c (list-ref acolor i)))
        (set-color c)
        (pset (vector-ref ax i) (vector-ref ay i) c)
        (mark (+ i 1)))))

(display "langton-flock complete: ")
(display ant-count)
(display " ants × 1500 total steps.")
(newline)
