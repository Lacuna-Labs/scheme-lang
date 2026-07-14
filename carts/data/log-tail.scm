; log-tail.scm — process a fake log, filter by severity, tally counts.
;
; Verbs exercised: string-split, string-contains?, hash-set!, hash-ref,
;                  make-hash, hash-entries, sort.
; Why it's interesting: every log-processing job you'll ever write is
; this shape — split into lines, extract a field, tally, sort, print.
; Do it a hundred times and you can do it in your sleep.
;
; Run:
;   ./bin/sakura-scheme run carts/data/log-tail.scm

(define log-text
  "2026-07-14 09:00:01 INFO  server started on port 8080
2026-07-14 09:00:15 INFO  connection from 192.168.1.42
2026-07-14 09:00:22 WARN  slow query 340ms on orders
2026-07-14 09:01:03 ERROR db timeout after 5000ms
2026-07-14 09:01:05 INFO  retrying db connection
2026-07-14 09:01:07 INFO  db reconnected
2026-07-14 09:02:11 WARN  cache miss rate above 40%
2026-07-14 09:03:00 ERROR authentication failed for user 'bob'
2026-07-14 09:03:12 INFO  authentication succeeded for user 'bob'
2026-07-14 09:04:22 WARN  disk usage 85%
2026-07-14 09:05:00 INFO  hourly checkpoint written
2026-07-14 09:06:15 ERROR connection reset by peer")

(define lines (string-split log-text "\n"))

; Extract the severity level — third whitespace-separated token.
(define (severity line)
  (let ((tokens (string-split line " ")))
    (if (>= (length tokens) 3) (list-ref tokens 2) "?")))

; Tally by severity in a hash table.
(define counts (make-hash))
(let each ((ls lines))
  (if (null? ls) '()
      (let* ((sev (severity (car ls)))
             (prev (hash-ref counts sev 0)))
        (hash-set! counts sev (+ prev 1))
        (each (cdr ls)))))

; Print only the ERROR lines.
(display "── ERRORS ──\n")
(let each ((ls lines))
  (if (null? ls) '()
      (begin
        (if (string-contains? (car ls) "ERROR")
            (begin (display "  ") (display (car ls)) (newline)))
        (each (cdr ls)))))

; Print the tally, sorted by count descending.
(display "\n── tally ──\n")
(let* ((entries (hash-entries counts))
       (sorted  (sort entries (lambda (a b) (> (car (cdr a)) (car (cdr b)))))))
  (let show ((es sorted))
    (if (null? es) '()
        (let* ((e (car es)) (sev (car e)) (n (car (cdr e))))
          (display "  ") (display sev) (display " × ") (display n) (newline)
          (show (cdr es))))))

(display "\ntotal lines: ")
(display (length lines))
(newline)
