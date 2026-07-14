; high-low.scm — the classic guessing game, autoplayed with binary
;                 search.
;
; Verbs exercised: random-int, display, quotient.
; Why it's interesting: binary search finds any number in [1..1000] in
; at most 10 guesses. Half the space every time. This cart shows a
; player guessing a hidden number using exactly that strategy, and
; prints the trace so you can see the interval collapse.
;
; Run:
;   ./bin/sakura-scheme run carts/games/high-low.scm

(define upper 1000)
(define secret (+ 1 (random-int upper)))

(display "hidden number is somewhere in [1, ")
(display upper)
(display "].  (spoiler: it's ") (display secret) (display ")")
(newline) (newline)

; Binary search: keep a low/high interval, guess the middle.
; "warmer" if we're getting closer.
(define (guess-loop lo hi n prev-dist)
  (let* ((g (quotient (+ lo hi) 2))
         (dist (abs (- g secret))))
    (display "  guess #") (display n) (display ": ")
    (display g)
    (display "  (interval [") (display lo) (display ", ") (display hi) (display "])")
    (cond ((= g secret)
           (display "  ⇐ correct!")
           (newline)
           (display "\nfound in ") (display n) (display " guesses.\n"))
          (else
           (if (> dist 0)
               (display (if (< dist prev-dist) "  warmer" "  cooler")))
           (newline)
           (if (< g secret)
               (guess-loop (+ g 1) hi (+ n 1) dist)
               (guess-loop lo (- g 1) (+ n 1) dist))))))

(guess-loop 1 upper 1 upper)

; How many guesses is the theoretical maximum?
; ceil(log2(1000)) = 10.
(display "theoretical maximum: 10 guesses ")
(display "(log2 of ") (display upper) (display " ≈ 10)")
(newline)
