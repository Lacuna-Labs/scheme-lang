; canon.scm — a two-voice canon, the second voice trailing the first.
;
; Verbs exercised: melody, silence.
; Why it's interesting: a canon is a single melody played against a
; delayed copy of itself. The tune has to fit against itself in
; harmony — the constraint that makes canons hard to write and
; wonderful to hear. Here we just play them in sequence so you hear
; both, then imagine them stacked.
;
; Run:
;   ./bin/sakura-scheme run carts/music/canon.scm

; A simple melody rising and falling around a major scale.
; C major: C D E F G A B C = 60 62 64 65 67 69 71 72
(define theme
  (list 60 64 67 72 71 67 64 60
        62 65 69 72 71 69 65 62))

(display "canon — theme, then again shifted up a fifth.")
(newline)

(display "voice 1 (theme):\n  ")
(display theme)
(newline)
(melody theme 0.22)
(silence 3.6)                   ; wait for voice 1 to finish

; Voice 2 — the same theme transposed up a perfect fifth (+7 semitones).
(define voice2 (map (lambda (n) (+ n 7)) theme))
(display "voice 2 (up a fifth):\n  ")
(display voice2)
(newline)
(melody voice2 0.22)
(silence 3.6)

(display "canon complete — one theme, two heights.")
(newline)
