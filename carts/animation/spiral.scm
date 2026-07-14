; spiral.scm — an Archimedean spiral spun out from the center.
;
; Verbs exercised: set-mode, clear, set-color, pset, sin, cos, sqrt.
; Why it's interesting: r = a·theta is the spiral you get when you
; unwind a spool at constant speed. Every full turn adds a fixed
; distance to the radius — a truth that also runs your record player.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/spiral.scm

(set-mode 'sakura)
(clear)

(define cx 40)
(define cy 40)

; a controls how quickly the arms spread. Higher = fatter spiral.
(define a 0.35)
(define turns 5)
(define samples 800)

; Rainbow-ish: cycle through 6 palette colors as we wind outward so the
; arms are visible against themselves.
(define colors (list 14 9 10 11 12 13))

(let scan ((i 0))
  (if (< i samples)
      (let* ((theta (* (/ i samples) turns 2 3.14159265))
             (r (* a theta))
             (x (+ cx (* r (cos theta))))
             (y (+ cy (* r (sin theta))))
             (color-i (modulo (quotient i (quotient samples 6)) 6)))
        (set-color (list-ref colors color-i))
        (pset (round x) (round y) (list-ref colors color-i))
        (scan (+ i 1)))))

(display "spiral complete: ")
(display turns)
(display " turns, ")
(display samples)
(display " samples.")
(newline)
