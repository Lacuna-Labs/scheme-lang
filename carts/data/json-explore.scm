; json-explore.scm — parse a JSON blob and dig around inside it.
;
; Verbs exercised: json-parse, json-stringify, hash-ref, hash-keys,
;                  map, length.
; Why it's interesting: JSON is the lingua franca of the web. If you
; can parse it into native data and pluck fields out, half the wire
; formats out there are already yours.
;
; Run:
;   ./bin/sakura-scheme run carts/data/json-explore.scm

(define blob
  "{\"users\":[
      {\"name\":\"alice\",\"age\":30,\"skills\":[\"scheme\",\"rust\"]},
      {\"name\":\"bob\",\"age\":24,\"skills\":[\"python\",\"go\",\"scheme\"]},
      {\"name\":\"carol\",\"age\":41,\"skills\":[\"c\",\"asm\",\"scheme\"]}
    ],
    \"count\":3,
    \"generated_at\":\"2026-07-14T09:00:00Z\"}")

(define parsed (json-parse blob))

(display "── raw JSON parsed ──\n")
(display parsed)
(newline)

(display "\n── top-level keys ──\n  ")
(display (hash-keys parsed))
(newline)

(display "\ntotal users: ")
(display (hash-ref parsed "count"))
(newline)

; Each user is a hash — iterate and print name + age.
(define users (hash-ref parsed "users"))
(display "\n── users ──\n")
(let each ((us users))
  (if (null? us) '()
      (let* ((u (car us))
             (name (hash-ref u "name"))
             (age  (hash-ref u "age"))
             (skills (hash-ref u "skills")))
        (display "  ") (display name)
        (display " (") (display age) (display ") — ")
        (display skills)
        (newline)
        (each (cdr us)))))

; Compute the average age.
(define ages (map (lambda (u) (hash-ref u "age")) users))
(display "\naverage age: ")
(display (mean ages))
(newline)

; Who knows scheme?
(display "\nscheme users: ")
(let scheme-users ((us users) (acc '()))
  (if (null? us)
      (display (reverse acc))
      (let ((u (car us)))
        (if (member "scheme" (hash-ref u "skills"))
            (scheme-users (cdr us) (cons (hash-ref u "name") acc))
            (scheme-users (cdr us) acc)))))
(newline)

; Round-trip: parse → stringify → parse again.
(display "\nround-trip length: ")
(display (string-length (json-stringify parsed)))
(display " characters.")
(newline)
