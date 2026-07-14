; twelve-bar-blues.scm — the twelve-bar blues chord progression in C.
;
; Verbs exercised: chord, silence.
; Why it's interesting: twelve bars. Three chords. A whole century of
; American music runs on this pattern. Play it and hear the shape.
;
;   I  I  I  I     C7 C7 C7 C7
;   IV IV I  I     F7 F7 C7 C7
;   V  IV I  V     G7 F7 C7 G7
;
; Run:
;   ./bin/sakura-scheme run carts/music/twelve-bar-blues.scm

; C7 = C E G Bb   = 60 64 67 70
; F7 = F A C Eb   = 65 69 72 75
; G7 = G B D  F   = 67 71 74 77
(define C7 (list 60 64 67 70))
(define F7 (list 65 69 72 75))
(define G7 (list 67 71 74 77))

; The progression as a list of chords. Each entry plays for one bar.
(define progression
  (list C7 C7 C7 C7
        F7 F7 C7 C7
        G7 F7 C7 G7))

(display "twelve-bar blues in C — ")
(display (length progression))
(display " bars.")
(newline)

; Play each bar. 0.7s per bar keeps the whole thing under 10 seconds.
(let bar ((prog progression) (n 1))
  (if (null? prog)
      (display "\nblues complete.\n")
      (begin
        (display "  bar ") (display n) (display " → ")
        (display (car prog))
        (newline)
        (chord (car prog) 0.7)
        (silence 0.7)
        (bar (cdr prog) (+ n 1)))))
