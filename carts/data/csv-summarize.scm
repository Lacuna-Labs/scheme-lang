; csv-summarize.scm — parse a CSV in memory, compute summary stats.
;
; Verbs exercised: string-split, string->number, map, sum, mean, sort,
;                  min, max, length.
; Why it's interesting: parse → tidy → summarize is the entire shape
; of data work. Here it's just three rows and three columns, but the
; program's structure would scale — replace the literal string with
; read-file and it's a real tool.
;
; Run:
;   ./bin/sakura-scheme run carts/data/csv-summarize.scm

(define csv-data
  "name,visits,revenue
alice,12,340.50
bob,7,215.00
carol,20,890.75
dave,4,80.00
eve,15,510.25")

; Split into rows, then each row into fields.
(define rows
  (map (lambda (line) (string-split line ","))
       (string-split csv-data "\n")))

(display "── raw rows ──\n")
(let each ((rs rows))
  (if (null? rs) '()
      (begin
        (display "  ") (display (car rs)) (newline)
        (each (cdr rs)))))

; The first row is the header.
(define header (car rows))
(define data-rows (cdr rows))

; Extract a single column from data-rows by index.
(define (col idx)
  (map (lambda (r) (list-ref r idx)) data-rows))

; Parse numeric columns.
(define visits (map string->number (col 1)))
(define revenue (map string->number (col 2)))

(display "\n── visits ──\n")
(display "  values : ") (display visits) (newline)
(display "  sum    : ") (display (sum visits)) (newline)
(display "  mean   : ") (display (mean visits)) (newline)
(display "  min    : ") (display (apply min visits)) (newline)
(display "  max    : ") (display (apply max visits)) (newline)

(display "\n── revenue ──\n")
(display "  values : ") (display revenue) (newline)
(display "  sum    : ") (display (sum revenue)) (newline)
(display "  mean   : ") (display (mean revenue)) (newline)

; Top spender.
(let* ((zipped (map (lambda (r) (list (car r) (string->number (list-ref r 2))))
                    data-rows))
       (sorted (sort zipped (lambda (a b) (> (car (cdr a)) (car (cdr b)))))))
  (display "\n── top spender ──\n")
  (display "  ") (display (car (car sorted)))
  (display " → ") (display (car (cdr (car sorted))))
  (newline))
