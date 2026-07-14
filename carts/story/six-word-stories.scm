; six-word-stories.scm — six words, one arc. Generated from vocab pools.
;
; Verbs exercised: list, list-ref, random-int, string-append, length.
; Why it's interesting: the six-word story is the shortest form that
; still has a beginning, a middle, and an end. Pick a subject, an
; action, an object, and a twist. Sometimes it works. Sometimes it
; doesn't. Both outcomes are instructive.
;
; Run:
;   ./bin/sakura-scheme run carts/story/six-word-stories.scm

; Subject pool.
(define subjects
  (list "The cat" "The letter" "Her mother" "The stranger"
        "The last light" "A single shoe" "The old man"
        "The child" "The clock"))

; Verb pool.
(define verbs
  (list "waited" "arrived" "was gone" "kept ringing"
        "opened its eyes" "started to sing"
        "would not leave" "began to fall"))

; Ending pool — the twist.
(define endings
  (list "but not for long"
        "the room was silent"
        "then everything changed"
        "no one had noticed"
        "we all felt it"
        "the door stayed shut"
        "and morning never came"
        "she smiled anyway"))

(define (pick pool)
  (list-ref pool (random-int (length pool))))

; Build one story: SUBJECT VERB ENDING.
(define (story)
  (string-append (pick subjects) " " (pick verbs) " — " (pick endings) "."))

(display "\n── six-word stories ──\n\n")

(let loop ((n 8))
  (if (> n 0)
      (begin
        (display "  ") (display (story)) (newline)
        (loop (- n 1)))))

(display "\n  (some land. some don't. that's the form.)\n")
