; random-melody.scm — a generative walk through a pentatonic scale.
;
; Verbs exercised: melody, silence, random-int, list-ref.
; Why it's interesting: pentatonic scales sound consonant no matter
; what order you play them in — one reason blues and folk lean on them
; so hard. A random walk here always sounds "kind of okay," which is
; the whole superpower of the scale.
;
; Run:
;   ./bin/sakura-scheme run carts/music/random-melody.scm

; C minor pentatonic across two octaves: C Eb F G Bb C Eb F G Bb C.
(define pent (list 48 51 53 55 58 60 63 65 67 70 72))

(define length-notes 24)

; Build the melody by picking pent[i] where i moves ±1 or stays put.
(let build ((remaining length-notes) (i 5) (acc '()))
  (if (= remaining 0)
      (let ((notes (reverse acc)))
        (display "generated pentatonic walk (")
        (display length-notes)
        (display " notes):\n  ")
        (display notes)
        (newline)
        (melody notes 0.18)
        (silence 5.0))
      (let* ((step (- (random-int 3) 1)) ; -1, 0, or 1
             (next-i (max 0 (min (- (length pent) 1) (+ i step))))
             (n (list-ref pent next-i)))
        (build (- remaining 1) next-i (cons n acc)))))

(display "random melody complete.")
(newline)
