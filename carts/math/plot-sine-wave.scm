; plot-sine-wave.scm — sine, cosine, and a beat between them.
;
; Verbs exercised: set-mode, clear, set-color, pset, line, sin, cos.
; Why it's interesting: two waves, an octave-and-a-half apart, plotted
; together. Where they cross, where they peak, where they cancel — the
; whole vocabulary of waves is on one screen.
;
; Run:
;   ./bin/sakura-scheme run carts/math/plot-sine-wave.scm

(set-mode 'sakura)
(clear)

; Axes.
(set-color 5)
(line 0 40 80 40)               ; x axis
(line 40 0 40 80)               ; y axis

; sin(x/6) — pink.
(set-color 14)
(let scan ((x 0))
  (if (< x 80)
      (let ((y (+ 40 (round (* 20 (sin (/ x 6.0)))))))
        (pset x y 14)
        (scan (+ x 1)))))

; cos(x/9) — blue.
(set-color 12)
(let scan ((x 0))
  (if (< x 80)
      (let ((y (+ 40 (round (* 20 (cos (/ x 9.0)))))))
        (pset x y 12)
        (scan (+ x 1)))))

; sin(x/6) * cos(x/9) — their product. Green.
(set-color 11)
(let scan ((x 0))
  (if (< x 80)
      (let ((y (+ 40 (round (* 20 (sin (/ x 6.0)) (cos (/ x 9.0)))))))
        (pset x y 11)
        (scan (+ x 1)))))

(display "sine plot complete — sin (pink), cos (blue), product (green).")
(newline)
