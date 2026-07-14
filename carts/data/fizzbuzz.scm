; fizzbuzz.scm — the interview classic. Numbers 1..30 with a twist.
;
; Verbs exercised: modulo, cond, display, newline.
; Why it's interesting: fizzbuzz is what every programmer stops
; noticing after year two — but it's the canonical example of "map a
; number to a category by divisibility." Cond + modulo is the whole
; toolkit. The Scheme version reads exactly like the spec.
;
; Run:
;   ./bin/sakura-scheme run carts/data/fizzbuzz.scm

; Divisible-by helper.
(define (divides? a b) (= 0 (modulo b a)))

; Categorize one number.
(define (fizzbuzz n)
  (cond ((divides? 15 n) "FizzBuzz")
        ((divides?  3 n) "Fizz")
        ((divides?  5 n) "Buzz")
        (else            (number->string n))))

; Print 1..30 on one line each.
(let loop ((i 1))
  (if (<= i 30)
      (begin
        (display "  ") (display i) (display "  →  ") (display (fizzbuzz i))
        (newline)
        (loop (+ i 1)))))

; Also print how many of each type we saw.
(let count ((i 1) (fizz 0) (buzz 0) (fb 0) (n 0))
  (if (> i 30)
      (begin
        (display "\ncounts up to 30:\n")
        (display "  Fizz     : ") (display fizz) (newline)
        (display "  Buzz     : ") (display buzz) (newline)
        (display "  FizzBuzz : ") (display fb) (newline)
        (display "  numbers  : ") (display n) (newline))
      (cond ((divides? 15 i) (count (+ i 1) fizz buzz (+ fb 1) n))
            ((divides?  3 i) (count (+ i 1) (+ fizz 1) buzz fb n))
            ((divides?  5 i) (count (+ i 1) fizz (+ buzz 1) fb n))
            (else            (count (+ i 1) fizz buzz fb (+ n 1))))))
