; rock-paper-scissors.scm — 20 rounds between random players. Tally.
;
; Verbs exercised: random-int, list-ref, cond, make-vector, vector-ref,
;                  vector-set!.
; Why it's interesting: RPS has no dominant strategy. If both players
; play uniformly at random, the long-run stats are 1/3 win, 1/3 lose,
; 1/3 tie. Twenty rounds is short — the sample is noisy — but the
; program's shape is exactly what a real cover-your-eyes tournament
; would be.
;
; Run:
;   ./bin/sakura-scheme run carts/games/rock-paper-scissors.scm

(define hands (list 'rock 'paper 'scissors))

; Given two hand indices, return 1 if a beats b, -1 if b beats a, 0 tie.
(define (compare a b)
  (cond ((= a b) 0)
        ((or (and (= a 0) (= b 2))     ; rock beats scissors
             (and (= a 1) (= b 0))     ; paper beats rock
             (and (= a 2) (= b 1)))    ; scissors beats paper
         1)
        (else -1)))

; Tally: [a-wins  b-wins  ties]
(define score (make-vector 3 0))

(display "── rock-paper-scissors, 20 rounds ──\n")
(let round ((n 0))
  (if (< n 20)
      (let* ((a (random-int 3)) (b (random-int 3))
             (r (compare a b)))
        (display "  round ")
        (display (+ n 1))
        (display ": ")
        (display (list-ref hands a))
        (display " vs ")
        (display (list-ref hands b))
        (display " → ")
        (cond ((= r  1) (display "A wins")
                        (vector-set! score 0 (+ (vector-ref score 0) 1)))
              ((= r -1) (display "B wins")
                        (vector-set! score 1 (+ (vector-ref score 1) 1)))
              (else     (display "tie")
                        (vector-set! score 2 (+ (vector-ref score 2) 1))))
        (newline)
        (round (+ n 1)))))

(display "\nfinal:  A ")
(display (vector-ref score 0))
(display "  B ")
(display (vector-ref score 1))
(display "  ties ")
(display (vector-ref score 2))
(newline)
