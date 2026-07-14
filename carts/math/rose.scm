; rose.scm — polar rose curves. r = cos(k · theta).
;
; Verbs exercised: set-mode, clear, set-color, pset, sin, cos.
; Why it's interesting: when k is an integer, r = cos(k·theta) has k
; petals if k is odd, and 2k petals if k is even. Nobody knows this
; until they draw one — and once you do, you can predict what k = 7
; will look like without running the code. That's math.
;
; Run:
;   ./bin/sakura-scheme run carts/math/rose.scm

(set-mode 'sakura)
(clear)

(define cx 40)
(define cy 40)

; Draw one rose with k petals in `color`, at scale `r`.
(define (draw-rose k r color)
  (let scan ((i 0))
    (if (< i 720)
        (let* ((theta (* (/ i 720) 2 3.14159265))
               (rho (* r (cos (* k theta))))
               (x (+ cx (* rho (cos theta))))
               (y (+ cy (* rho (sin theta)))))
          (set-color color)
          (pset (round x) (round y) color)
          (scan (+ i 1))))))

; Three roses overlaid — 3 petals (pink), 5 petals (blue),
; 8 petals (green — but note that k=4 draws 8, so we use 4).
(draw-rose 3 28 14)             ; 3 pink petals
(draw-rose 5 20 12)             ; 5 blue petals
(draw-rose 4 30 11)             ; 8 green petals (2k for even k)

(display "rose curves complete: 3, 5, and 8-petaled overlays.")
(newline)
