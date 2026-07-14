; four-in-a-row.scm — Connect Four with two random players.
;
; Verbs exercised: make-vector, vector-set!, vector-ref, random-int,
;                  set-mode, clear, set-color, disc, rect-fill.
; Why it's interesting: gravity! Every drop lands at the lowest empty
; row of its column. That constraint changes the whole strategic
; landscape from tic-tac-toe. Random play here mostly ends in threats
; that never quite line up.
;
; Run:
;   ./bin/sakura-scheme run carts/games/four-in-a-row.scm

(set-mode 'sakura)
(clear 1)

; 7 columns × 6 rows.
(define W 7)
(define H 6)
(define board (make-vector (* W H) 0))       ; 0 empty, 1 red, 2 yellow

(define (idx c r) (+ c (* r W)))

; Drop a piece in column c for player p. Return the row it landed at,
; or -1 if the column was full.
(define (drop! c p)
  (let scan ((r (- H 1)))
    (cond ((< r 0) -1)
          ((= 0 (vector-ref board (idx c r)))
           (vector-set! board (idx c r) p)
           r)
          (else (scan (- r 1))))))

; Check 4-in-a-row starting from (c, r) in direction (dc, dr) for player p.
(define (four? c r dc dr p)
  (let loop ((i 0))
    (cond ((= i 4) #t)
          ((let ((nc (+ c (* i dc))) (nr (+ r (* i dr))))
             (or (< nc 0) (>= nc W) (< nr 0) (>= nr H)
                 (not (= p (vector-ref board (idx nc nr))))))
           #f)
          (else (loop (+ i 1))))))

; Check win by scanning every cell in four directions.
(define (won? p)
  (let scan ((c 0) (r 0))
    (cond ((>= r H) #f)
          ((>= c W) (scan 0 (+ r 1)))
          ((or (four? c r 1 0 p)     ; horizontal
               (four? c r 0 1 p)     ; vertical
               (four? c r 1 1 p)     ; diagonal down-right
               (four? c r 1 -1 p))   ; diagonal up-right
           #t)
          (else (scan (+ c 1) r)))))

; Column c full?
(define (col-full? c)
  (not (= 0 (vector-ref board (idx c 0)))))

; Play. Random column choice; retry if full.
(let play ((turn 1) (moves 0))
  (cond ((won? 1) (display "\nred wins after ") (display moves) (display " moves.\n"))
        ((won? 2) (display "\nyellow wins after ") (display moves) (display " moves.\n"))
        ((>= moves (* W H)) (display "\nboard full — draw.\n"))
        (else
         (let try ((c (random-int W)))
           (if (col-full? c)
               (try (modulo (+ c 1) W))
               (let ((r (drop! c turn)))
                 (display "  move ")
                 (display (+ moves 1))
                 (display ": player ")
                 (display (if (= turn 1) "R" "Y"))
                 (display " → col ")
                 (display c)
                 (display " row ")
                 (display r)
                 (newline)
                 (play (if (= turn 1) 2 1) (+ moves 1))))))))

; Render the final board — bottom row at y = 70, cells 10×10.
(let py ((r 0))
  (if (< r H)
      (begin
        (let px ((c 0))
          (if (< c W)
              (let ((v (vector-ref board (idx c r)))
                    (x (+ 5 (* c 10)))
                    (y (+ 20 (* r 10))))
                (cond ((= v 1) (set-color 8)  (disc (+ x 5) (+ y 5) 4))
                      ((= v 2) (set-color 10) (disc (+ x 5) (+ y 5) 4))
                      (else    (set-color 6)  (rect-fill x y 10 10)
                               (set-color 1)  (disc (+ x 5) (+ y 5) 3)))
                (px (+ c 1)))))
        (py (+ r 1)))))

(display "\nboard drawn.\n")
