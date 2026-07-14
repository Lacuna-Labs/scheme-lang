; twinkle.scm — Twinkle Twinkle Little Star as a melody.
;
; Verbs exercised: melody, silence.
; Why it's interesting: every kid knows the tune. Encoded as MIDI
; numbers it becomes a data structure — a list of integers your ears
; agree is a song. This is what a note is to a computer.
;
; Run:
;   ./bin/sakura-scheme run carts/music/twinkle.scm

; MIDI: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71, C5=72.
;
; Twinkle: C C G G A A G — F F E E D D C
;          G G F F E E D — G G F F E E D
;          C C G G A A G — F F E E D D C
(define twinkle
  (list 60 60 67 67 69 69 67
        65 65 64 64 62 62 60
        67 67 65 65 64 64 62
        67 67 65 65 64 64 62
        60 60 67 67 69 69 67
        65 65 64 64 62 62 60))

(display "playing Twinkle Twinkle — ")
(display (length twinkle))
(display " notes at 0.3s each.")
(newline)

(melody twinkle 0.3)

; Give the driver a moment to finish scheduling.
(silence 0.5)

(display "twinkle complete.")
(newline)
