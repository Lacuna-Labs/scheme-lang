; lissajous.scm — two sines beating against each other trace a curve.
;
; Verbs exercised: set-mode, clear, set-color, pset, sin, cos.
; Why it's interesting: a Lissajous figure is what an oscilloscope
; shows when you feed sin(a·t) into X and sin(b·t + phi) into Y. The
; ratio a:b decides whether the curve closes into a knot or wanders
; forever. This cart draws the 3:2 case — a tidy figure-eight braid.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/lissajous.scm

(set-mode 'sakura)
(clear)

(define cx 40)
(define cy 40)
(define rx 32)
(define ry 32)

; Frequency ratio and phase — the two knobs of a Lissajous.
(define a 3)
(define b 2)
(define phi 1.5708)             ; pi/2 — a right-angle offset

(define samples 500)

(set-color 14)
(let scan ((i 0))
  (if (< i samples)
      (let* ((t (* (/ i samples) 2 3.14159265358979))
             (x (+ cx (* rx (sin (+ (* a t) phi)))))
             (y (+ cy (* ry (sin (* b t))))))
        (pset (round x) (round y) 14)
        (scan (+ i 1)))))

; Overlay: try the 5:4 ratio in a different color for contrast.
(set-color 12)
(let scan ((i 0))
  (if (< i samples)
      (let* ((t (* (/ i samples) 2 3.14159265358979))
             (x (+ cx (* (- rx 6) (sin (+ (* 5 t) 0.7)))))
             (y (+ cy (* (- ry 6) (sin (* 4 t))))))
        (pset (round x) (round y) 12)
        (scan (+ i 1)))))

(display "lissajous complete — 3:2 pink + 5:4 blue, ")
(display samples)
(display " samples each.")
(newline)
