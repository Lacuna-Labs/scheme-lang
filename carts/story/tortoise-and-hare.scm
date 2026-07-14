; tortoise-and-hare.scm — the fable, and a simulated race that shows it.
;
; Verbs exercised: display, newline, set-mode, clear, set-color, disc,
;                  rect-fill, line, pset.
; Why it's interesting: text tells the moral; simulation shows it. The
; hare bursts ahead, then sleeps. The tortoise plods. Frame by frame,
; the plodder gains and the sprinter squanders. Same story, two media.
;
; Retold from the Aesopic tradition — public-domain motif.
;
; Run:
;   ./bin/sakura-scheme run carts/story/tortoise-and-hare.scm

; ── the fable, in a few lines ──
(display "\n── the tortoise and the hare ──\n\n")
(display "  a hare mocked a tortoise for being slow.\n")
(display "  the tortoise, unmoved, proposed a race.\n")
(display "  the hare laughed and agreed.\n\n")
(display "  the hare tore ahead — so far ahead that he lay down\n")
(display "  under a tree and slept.\n")
(display "  the tortoise plodded on, and on, and on.\n\n")
(display "  when the hare woke, the tortoise was already at the line.\n\n")
(display "  slow and steady wins.\n\n")

; ── the race ──
(set-mode 'sakura)
(clear)

; Track — a green line across the middle.
(set-color 11)
(rect-fill 0 40 80 2)

; Finish line.
(set-color 8)
(rect-fill 75 34 2 14)

; Run 60 frames; hare sprints then sleeps; tortoise walks steadily.
(define hare-x 4)
(define tort-x 4)
(define hare-slept? #f)
(define hare-awake-since 0)

(let race ((f 0))
  (if (< f 60)
      (begin
        ; Hare logic: fast until far ahead, then sleeps for a long time.
        (cond
         ((and (> (- hare-x tort-x) 25) (not hare-slept?))
          ; nap for 40 frames — quite a nap
          (set! hare-slept? #t)
          (set! hare-awake-since (+ f 40)))
         ((and hare-slept? (< f hare-awake-since))
          ; still napping
          (set-color 6) (pset (round hare-x) 30 6))
         (else
          ; Cap the hare so he stops at the finish line.
          (if (< hare-x 74)
              (set! hare-x (+ hare-x 2.4)))))
        ; Tortoise: slow and constant. Stops at the finish line.
        (if (< tort-x 74)
            (set! tort-x (+ tort-x 1.1)))
        ; Draw.
        (clear)
        (set-color 11) (rect-fill 0 40 80 2)
        (set-color 8)  (rect-fill 75 34 2 14)
        ; Hare — yellow disc.
        (set-color 10)
        (disc (round (min hare-x 76)) 38 3)
        ; Tortoise — green disc.
        (set-color 3)
        (disc (round tort-x) 44 3)
        (race (+ f 1)))))

; Report the outcome.
(display "  hare  ended at x = ")
(display (round hare-x))
(display "  (slept: ")
(display (if hare-slept? "yes" "no"))
(display ")")
(newline)
(display "  tort. ended at x = ")
(display (round tort-x))
(newline)
(display "  winner: ")
(display (if (>= tort-x hare-x) "TORTOISE" "hare"))
(newline)
