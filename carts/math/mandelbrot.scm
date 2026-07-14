; mandelbrot.scm — the classic fractal, 80×80 ASCII-colored.
;
; Verbs exercised: set-mode, clear, set-color, pset, arithmetic loop.
; Why it's interesting: for each pixel, iterate z = z² + c and see
; whether |z| stays bounded. The boundary between "bounded" and "shot
; to infinity" is the Mandelbrot set — a fractal with structure at
; every zoom. This cart plots the classic view centered on -0.5.
;
; Run:
;   ./bin/sakura-scheme run carts/math/mandelbrot.scm

(set-mode 'sakura)
(clear)

; View window in the complex plane.
(define x-min -2.0)
(define x-max 1.0)
(define y-min -1.2)
(define y-max 1.2)
(define max-iter 20)
(define grid 40)                ; render at 40×40 and skip pixels

; Given a pixel, compute how many iterations before |z| > 2.
(define (mandel cx cy)
  (let iter ((zx 0) (zy 0) (n 0))
    (cond ((>= n max-iter) max-iter)
          ((> (+ (* zx zx) (* zy zy)) 4) n)
          (else
           (iter (+ (- (* zx zx) (* zy zy)) cx)
                 (+ (* 2 zx zy) cy)
                 (+ n 1))))))

; Map iterations to a palette index.
(define (color-for n)
  (cond ((>= n max-iter) 0)     ; inside the set — black
        ((< n 5) 14)             ; petal — outer band
        ((< n 10) 9)              ; orange
        ((< n 15) 10)             ; yellow
        ((< n 22) 11)             ; green
        ((< n 30) 12)             ; blue
        (else 13)))               ; lavender — near boundary

; Render at 40×40 (each sample fills a 2×2 block) — fits under fuel.
(let py ((row 0))
  (if (< row grid)
      (begin
        (let px ((col 0))
          (if (< col grid)
              (let* ((cx (+ x-min (* (/ col grid) (- x-max x-min))))
                     (cy (+ y-min (* (/ row grid) (- y-max y-min))))
                     (n (mandel cx cy))
                     (c (color-for n))
                     (sx (* col 2))
                     (sy (* row 2)))
                (pset sx sy c)
                (pset (+ sx 1) sy c)
                (pset sx (+ sy 1) c)
                (pset (+ sx 1) (+ sy 1) c)
                (px (+ col 1)))))
        (py (+ row 1)))))

(display "mandelbrot complete — ")
(display (* grid grid))
(display " samples, max ")
(display max-iter)
(display " iterations each (2×2 blocks fill 80×80).")
(newline)
