; tic-tac-toe.scm — a full autoplay game between two players who
;                   pick empty squares at random.
;
; Verbs exercised: make-vector, vector-set!, vector-ref, random-int,
;                  set-mode, clear, set-color, line, disc.
; Why it's interesting: the smallest game with a real endgame check.
; Random play often draws — but sometimes X wins by luck. Watch it
; happen ten times in the printed log.
;
; Run:
;   ./bin/sakura-scheme run carts/games/tic-tac-toe.scm

(set-mode 'sakura)

; Board is a vector of 9 cells: 0 = empty, 1 = X, 2 = O.
; Positions are numbered:
;   0 1 2
;   3 4 5
;   6 7 8
(define (new-board) (make-vector 9 0))

; Winning lines.
(define lines
  (list
    (list 0 1 2) (list 3 4 5) (list 6 7 8)  ; rows
    (list 0 3 6) (list 1 4 7) (list 2 5 8)  ; cols
    (list 0 4 8) (list 2 4 6)))              ; diagonals

; Check whether player p has won.
(define (won? b p)
  (let scan ((ls lines))
    (cond ((null? ls) #f)
          ((let* ((line (car ls))
                  (a (vector-ref b (car line)))
                  (bb (vector-ref b (car (cdr line))))
                  (c (vector-ref b (car (cdr (cdr line))))))
             (and (= a p) (= bb p) (= c p))) #t)
          (else (scan (cdr ls))))))

; List of empty cell indices.
(define (empties b)
  (let loop ((i 0) (acc '()))
    (cond ((= i 9) (reverse acc))
          ((= (vector-ref b i) 0) (loop (+ i 1) (cons i acc)))
          (else (loop (+ i 1) acc)))))

; One random move by player p.
(define (play-move! b p)
  (let* ((es (empties b))
         (k (list-ref es (random-int (length es)))))
    (vector-set! b k p)))

; Play a full game — return 1 if X wins, 2 if O, 0 if draw.
(define (play-game)
  (let ((b (new-board)))
    (let loop ((turn 1))
      (cond ((won? b 1) 1)
            ((won? b 2) 2)
            ((null? (empties b)) 0)
            (else (play-move! b turn)
                  (loop (if (= turn 1) 2 1)))))))

; Play ten games, tally results.
(define results (make-vector 3 0))
(let games ((n 0))
  (if (< n 10)
      (let ((r (play-game)))
        (vector-set! results r (+ (vector-ref results r) 1))
        (games (+ n 1)))))

(display "── tic-tac-toe, 10 random-vs-random games ──\n")
(display "  X wins : ") (display (vector-ref results 1)) (newline)
(display "  O wins : ") (display (vector-ref results 2)) (newline)
(display "  draws  : ") (display (vector-ref results 0)) (newline)

; Draw the final board of one last game to the framebuffer.
(clear)
(define final (new-board))
(let final-play ((turn 1))
  (cond ((won? final 1) 'x-won)
        ((won? final 2) 'o-won)
        ((null? (empties final)) 'draw)
        (else (play-move! final turn)
              (final-play (if (= turn 1) 2 1)))))

; Grid lines.
(set-color 6)
(line 25 5 25 75) (line 50 5 50 75)
(line 5 25 75 25) (line 5 50 75 50)

; Marks: X is a pink cross, O is a blue ring.
(let draw ((i 0))
  (if (< i 9)
      (let* ((col (modulo i 3))
             (row (quotient i 3))
             (cx (+ 12 (* col 25)))
             (cy (+ 12 (* row 25)))
             (v (vector-ref final i)))
        (cond ((= v 1)                       ; X
               (set-color 14)
               (line (- cx 6) (- cy 6) (+ cx 6) (+ cy 6))
               (line (- cx 6) (+ cy 6) (+ cx 6) (- cy 6)))
              ((= v 2)                       ; O
               (set-color 12)
               (disc cx cy 6)
               (set-color 0)
               (disc cx cy 3)))
        (draw (+ i 1)))))

(display "\nfinal board drawn.\n")
