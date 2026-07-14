; scales.scm — the seven modes of the major scale, played in order.
;
; Verbs exercised: melody, silence, map.
; Why it's interesting: pick a note, walk up seven whole/half steps.
; Different starting notes on the same set of white keys give the
; seven modes — Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian,
; Locrian. Each one feels different because our ears track intervals,
; not pitches.
;
; Run:
;   ./bin/sakura-scheme run carts/music/scales.scm

; Mode intervals in semitones — the pattern of steps from the root.
; Ionian (major)     = 2 2 1 2 2 2 1
; Dorian             = 2 1 2 2 2 1 2
; Phrygian           = 1 2 2 2 1 2 2
; Lydian             = 2 2 2 1 2 2 1
; Mixolydian         = 2 2 1 2 2 1 2
; Aeolian (minor)    = 2 1 2 2 1 2 2
; Locrian            = 1 2 2 1 2 2 2

; Given a root and a step-pattern, walk out the scale as MIDI numbers.
(define (build-scale root steps)
  (let loop ((n root) (steps steps) (acc (list root)))
    (if (null? steps)
        (reverse acc)
        (let ((next (+ n (car steps))))
          (loop next (cdr steps) (cons next acc))))))

(define modes
  (list (list 'ionian     (list 2 2 1 2 2 2 1))
        (list 'dorian     (list 2 1 2 2 2 1 2))
        (list 'phrygian   (list 1 2 2 2 1 2 2))
        (list 'lydian     (list 2 2 2 1 2 2 1))
        (list 'mixolydian (list 2 2 1 2 2 1 2))
        (list 'aeolian    (list 2 1 2 2 1 2 2))
        (list 'locrian    (list 1 2 2 1 2 2 2))))

(define root 60)                ; C4

(let each ((ms modes))
  (if (null? ms)
      (display "\nseven modes complete.\n")
      (let* ((entry (car ms))
             (name  (car entry))
             (steps (car (cdr entry)))
             (notes (build-scale root steps)))
        (display "  ") (display name) (display " → ") (display notes) (newline)
        (melody notes 0.14)
        (silence 1.1)
        (each (cdr ms)))))
