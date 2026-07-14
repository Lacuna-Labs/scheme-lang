; haiku-generator.scm — three lines, chosen from pools, in the classic
;                       5-7-5 shape.
;
; Verbs exercised: display, newline, random-int, list-ref, length.
; Why it's interesting: a haiku is a shape: a moment, a shift, a
; resonance. Even random selection from small pools produces something
; that reads. The form does most of the work — which is a lesson about
; form.
;
; Run:
;   ./bin/sakura-scheme run carts/story/haiku-generator.scm

; Five-syllable openers.
(define fives
  (list "an old wooden bridge"
        "the plum tree in bloom"
        "morning fog in june"
        "one small yellow leaf"
        "snow on the mountain"
        "wind across the field"
        "quiet by the pond"))

; Seven-syllable middles.
(define sevens
  (list "a heron pauses to look"
        "a child running after birds"
        "the smell of rain on the road"
        "someone is singing nearby"
        "the sound of a distant bell"
        "shadows lengthen on the wall"
        "steam rises from the kettle"))

; Five-syllable closers — the resonance.
(define closers
  (list "and then it is gone"
        "and no one is home"
        "who left the door wide"
        "she says nothing back"
        "one last cup of tea"
        "and the day begins"
        "we forget her name"))

(define (pick pool)
  (list-ref pool (random-int (length pool))))

(display "\n── three haiku ──\n\n")

(let loop ((n 3))
  (if (> n 0)
      (begin
        (display "  ") (display (pick fives))   (newline)
        (display "  ") (display (pick sevens))  (newline)
        (display "  ") (display (pick closers)) (newline)
        (newline)
        (loop (- n 1)))))

(display "  (generated. keep the ones you like.)\n")
