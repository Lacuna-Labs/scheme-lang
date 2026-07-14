; waves.scm — layered sine waves as a wobbling seascape.
;
; Verbs exercised: set-mode, clear, set-color, pset, sin.
; Why it's interesting: an ocean is a sum of sines with different
; wavelengths and phases. Stack three and you get water. Stack ten and
; you get Sunday afternoon. This cart layers three, drawn as a filled
; region against a dark-blue sky.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/waves.scm

(set-mode 'sakura)
(clear 1)                       ; dark-blue sky

; Sample the water height at each column.
(define (water-height x t)
  (+ 50
     (* 4 (sin (+ (/ x 8.0) t)))
     (* 2 (sin (+ (/ x 4.0) (* 2 t))))
     (* 3 (sin (+ (/ x 12.0) (* 0.7 t))))))

; Draw one frozen snapshot at t=0.
(let column ((x 0))
  (if (< x 80)
      (let ((h (round (water-height x 0))))
        ; Sea below the wave line.
        (set-color 12)
        (let fill ((y h))
          (if (< y 80)
              (begin
                (pset x y 12)
                (fill (+ y 1)))))
        ; Foam on the wave crest.
        (set-color 7)
        (pset x h 7)
        (column (+ x 1)))))

; Sun in the sky.
(set-color 10)
(let sun ((k 0))
  (if (< k 32)
      (let* ((theta (* (/ k 32) 2 3.14159265))
             (sx (+ 60 (* 6 (cos theta))))
             (sy (+ 15 (* 6 (sin theta)))))
        (pset (round sx) (round sy) 10)
        (sun (+ k 1)))))

; And a couple of birds — small check marks.
(set-color 5)
(pset 20 12 5) (pset 21 11 5) (pset 22 12 5)
(pset 35 18 5) (pset 36 17 5) (pset 37 18 5)

(display "waves complete — 3-sine sea, sun, two birds.")
(newline)
