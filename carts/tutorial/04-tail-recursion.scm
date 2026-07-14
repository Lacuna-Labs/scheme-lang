; 04-tail-recursion.scm — loops without loops.
;
; Verbs exercised: define, named-let, recursion, tail calls.
; Why it's interesting: Scheme has no `for` and no `while`. Every loop
; is a function that calls itself. When the call is the last thing the
; function does — a tail call — the runtime reuses the stack frame and
; the recursion runs in constant space. This is how a Lisp counts to a
; million without blowing up.
;
; Run:
;   ./bin/sakura-scheme run carts/tutorial/04-tail-recursion.scm

; Sum 1..n with a named-let. The recursive call is in tail position.
(define (sum-to n)
  (let loop ((i 1) (acc 0))
    (if (> i n)
        acc
        (loop (+ i 1) (+ acc i)))))

(display "sum 1..100    = ")
(display (sum-to 100))
(newline)

(display "sum 1..10000  = ")
(display (sum-to 10000))
(newline)

; Factorial — same shape. Accumulator makes it tail-recursive.
(define (fact n)
  (let loop ((i 1) (acc 1))
    (if (> i n) acc (loop (+ i 1) (* acc i)))))

(display "10! = ")
(display (fact 10))
(newline)

; Fibonacci — two accumulators walk in lockstep.
(define (fib n)
  (let loop ((i 0) (a 0) (b 1))
    (if (>= i n) a (loop (+ i 1) b (+ a b)))))

(display "first 12 Fibs: ")
(let show ((i 0))
  (if (< i 12)
      (begin
        (display (fib i))
        (display " ")
        (show (+ i 1)))))
(newline)

; Count down from a big number to prove tail calls actually recycle.
(define (countdown n)
  (if (<= n 0) 'done (countdown (- n 1))))

(display "countdown 50000: ")
(display (countdown 50000))
(newline)
