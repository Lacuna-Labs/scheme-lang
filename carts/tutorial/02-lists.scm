; 02-lists.scm — cons cells, car/cdr, and shapes made of pairs.
;
; Verbs exercised: list, cons, car, cdr, length, reverse, append, map.
; Why it's interesting: a list is the atom of Lisp. Once you can build
; one and pick it apart, half the language is already in your hand.
;
; Run:
;   ./bin/sakura-scheme run carts/tutorial/02-lists.scm

(display "── lists ──")
(newline)

; Two ways to build the same list.
(define xs (list 1 2 3 4 5))
(define ys (cons 1 (cons 2 (cons 3 (cons 4 (cons 5 '()))))))

(display "xs: ") (display xs) (newline)
(display "ys: ") (display ys) (newline)

; car peels off the first; cdr peels off the rest.
(display "(car xs): ") (display (car xs)) (newline)
(display "(cdr xs): ") (display (cdr xs)) (newline)

; length, reverse, append — the workhorses.
(display "(length xs): ") (display (length xs)) (newline)
(display "(reverse xs): ") (display (reverse xs)) (newline)
(display "(append xs '(6 7)): ") (display (append xs '(6 7))) (newline)

; map applies a fn to every element.
(display "squared: ") (display (map (lambda (n) (* n n)) xs)) (newline)

; Sum the list with a named-let loop (no fold in this suite).
(define (sum lst)
  (let loop ((s 0) (l lst))
    (if (null? l)
        s
        (loop (+ s (car l)) (cdr l)))))
(display "sum: ") (display (sum xs)) (newline)

(display "lists complete.")
(newline)
