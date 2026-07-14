; word-count.scm — count occurrences of each word in a short passage.
;
; Verbs exercised: string-split, string-downcase, hash-set!, hash-ref,
;                  hash-entries, sort, regex-replace-all.
; Why it's interesting: a word-frequency table is the ancestor of every
; term-frequency scheme in information retrieval — the first step from
; "text is bytes" toward "text is meaning." Zipf's law lives here too.
;
; Run:
;   ./bin/sakura-scheme run carts/data/word-count.scm

(define passage
  "The rain in Spain falls mainly on the plain.
   In Hartford Hereford and Hampshire hurricanes hardly ever happen.
   The rain in Spain falls mainly on the plain.
   By George she's got it. By George she's got it.")

; Normalize — lowercase and strip punctuation.
(define cleaned
  (regex-replace-all "[^a-z\\s]" (string-downcase passage) ""))

; Split on whitespace (regex-split handles newlines and multi-space).
(define tokens
  (let split ((words (regex-split "\\s+" cleaned)) (acc '()))
    (if (null? words)
        (reverse acc)
        (let ((w (car words)))
          (if (= (string-length w) 0)
              (split (cdr words) acc)
              (split (cdr words) (cons w acc)))))))

; Tally.
(define counts (make-hash))
(let each ((ws tokens))
  (if (null? ws) '()
      (let* ((w (car ws)) (prev (hash-ref counts w 0)))
        (hash-set! counts w (+ prev 1))
        (each (cdr ws)))))

; Sort by frequency descending.
(define sorted
  (sort (hash-entries counts)
        (lambda (a b) (> (car (cdr a)) (car (cdr b))))))

(display "── top 10 words ──\n")
(let show ((es sorted) (n 0))
  (if (or (null? es) (>= n 10)) '()
      (let* ((e (car es)) (w (car e)) (c (car (cdr e))))
        (display "  ") (display c) (display " × ") (display w) (newline)
        (show (cdr es) (+ n 1)))))

(display "\ntotal words: ")
(display (length tokens))
(display "   unique words: ")
(display (length sorted))
(newline)
