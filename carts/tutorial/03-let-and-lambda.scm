; 03-let-and-lambda.scm — local names and anonymous procedures.
;
; Verbs exercised: define, let, let*, lambda, closures.
; Why it's interesting: let creates a scope; lambda creates a value.
; The two together are the whole game — every abstraction in Scheme
; sits on this pair.
;
; Run:
;   ./bin/sakura-scheme run carts/tutorial/03-let-and-lambda.scm

; `let` binds names for a block. The binding is invisible outside.
(let ((x 10) (y 32))
  (display "let x + y = ")
  (display (+ x y))
  (newline))

; `let*` binds sequentially — later names can see earlier ones.
(let* ((a 5) (b (* a 2)) (c (+ a b)))
  (display "let* a=5 b=(*a 2) c=(+ a b): ")
  (display (list a b c))
  (newline))

; `lambda` builds an anonymous procedure. Store it in a name to use it.
(define square (lambda (n) (* n n)))
(display "square(7) = ")
(display (square 7))
(newline)

; A closure captures its enclosing variables. Here, `make-counter` hands
; back a lambda that remembers `count` between calls.
(define (make-counter start)
  (let ((count start))
    (lambda ()
      (let ((old count))
        (set! count (+ count 1))
        old))))

(define tick (make-counter 100))
(display "tick, tick, tick: ")
(display (list (tick) (tick) (tick)))
(newline)

; Lambdas as arguments — the shape of higher-order code.
(define (apply-twice fn x) (fn (fn x)))
(display "apply-twice square 3 = ")
(display (apply-twice square 3))
(newline)
