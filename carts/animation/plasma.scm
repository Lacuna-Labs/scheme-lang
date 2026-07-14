; plasma.scm — the classic demoscene plasma effect, one frame.
;
; Verbs exercised: set-mode, clear, set-color, pset, sin, cos, sqrt.
; Why it's interesting: layer several 2D sinusoids at different
; frequencies, sum them, and map the result through a palette. The
; sum of sines gives you a smooth, blob-like field that looks alive
; even though it's completely deterministic.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/plasma.scm

(set-mode 'sakura)

; Palette cycle for the plasma bands.
(define plasma-colors (list 14 13 12 11 10 9 8 4))

; For each pixel compute a plasma value from four superimposed waves.
(let py ((y 0))
  (if (< y 80)
      (begin
        (let px ((x 0))
          (if (< x 80)
              (let* ((cx (/ (- x 40) 8.0))
                     (cy (/ (- y 40) 8.0))
                     (v (+ (sin (/ x 4.0))
                           (sin (/ y 3.0))
                           (sin (/ (+ x y) 5.0))
                           (sin (/ (sqrt (+ (* cx cx) (* cy cy))) 1.0))))
                     ; Map v ∈ [-4, 4] to a palette slot.
                     (idx (modulo (round (+ (* 1.0 v) 8)) 8)))
                (set-color (list-ref plasma-colors idx))
                (pset x y (list-ref plasma-colors idx))
                (px (+ x 1)))))
        (py (+ y 1)))))

(display "plasma complete — 80×80 pixels, 4 superimposed waves.")
(newline)
