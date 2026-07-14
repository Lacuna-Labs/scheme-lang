; nim.scm — the game of Nim with a perfect-play autopilot.
;
; Verbs exercised: bit-xor, list, car, cdr, random-int, list-ref.
; Why it's interesting: Nim has a beautiful closed-form solution. XOR
; the pile sizes together; if the result is zero, the position is
; losing for whoever must move. If not, there's always a move that
; makes it zero. Perfect play is easy once you know that trick. This
; cart plays a game of the classic 3-4-5 setup between a random player
; and a perfect player. Perfect always wins if they can.
;
; Run:
;   ./bin/sakura-scheme run carts/games/nim.scm

; The starting piles.
(define piles (list 3 4 5))

(display "starting piles: ") (display piles) (newline)

; Nim-sum: XOR of all piles. Losing position ⇔ sum = 0.
(define (nim-sum ps)
  (let loop ((ps ps) (x 0))
    (if (null? ps) x (loop (cdr ps) (bit-xor x (car ps))))))

; Perfect move: find a pile i where (pile XOR nim-sum) < pile.
; Take enough to reduce that pile to (pile XOR nim-sum).
; Returns (pile-index new-count).
(define (perfect-move ps)
  (let ((s (nim-sum ps)))
    (if (= s 0)
        ; Losing — just take 1 from the first nonempty pile.
        (let scan ((i 0) (rest ps))
          (cond ((null? rest) #f)
                ((> (car rest) 0) (list i (- (car rest) 1)))
                (else (scan (+ i 1) (cdr rest)))))
        ; Winning — find a pile that can be reduced.
        (let scan ((i 0) (rest ps))
          (cond ((null? rest) #f)
                (else
                 (let ((new (bit-xor (car rest) s)))
                   (if (< new (car rest))
                       (list i new)
                       (scan (+ i 1) (cdr rest))))))))))

; Random move: pick a nonempty pile and take a random number from it.
(define (random-move ps)
  (let scan ((tries 0))
    (let* ((i (random-int (length ps))) (p (list-ref ps i)))
      (if (or (= p 0) (> tries 100))
          (if (> tries 100) #f (scan (+ tries 1)))
          (list i (- p (+ 1 (random-int p))))))))

; Apply a move — return a new pile list.
(define (apply-move ps move)
  (let loop ((i 0) (rest ps) (acc '()))
    (cond ((null? rest) (reverse acc))
          ((= i (car move))
           (loop (+ i 1) (cdr rest) (cons (car (cdr move)) acc)))
          (else (loop (+ i 1) (cdr rest) (cons (car rest) acc))))))

; Game over when all piles are zero. Last taker wins (normal play).
(define (all-zero? ps)
  (let scan ((ps ps))
    (cond ((null? ps) #t)
          ((> (car ps) 0) #f)
          (else (scan (cdr ps))))))

; Play. Turn 1 = random, Turn 2 = perfect.
(let play ((ps piles) (turn 1))
  (cond ((all-zero? ps)
         (display "\nfinal piles: ") (display ps) (newline)
         (display "winner: ")
         (display (if (= turn 1) "PERFECT" "RANDOM"))
         (newline))
        (else
         (let* ((mv (if (= turn 1) (random-move ps) (perfect-move ps)))
                (next (apply-move ps mv)))
           (display "  turn ")
           (display (if (= turn 1) "R" "P"))
           (display " (nim-sum before = ")
           (display (nim-sum ps))
           (display "): ")
           (display ps) (display " → ") (display next) (newline)
           (play next (if (= turn 1) 2 1))))))
