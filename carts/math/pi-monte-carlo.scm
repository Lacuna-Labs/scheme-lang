; pi-monte-carlo.scm — estimate π by throwing darts at a square.
;
; Verbs exercised: set-mode, clear, set-color, pset, random-int,
;                  arithmetic loop.
; Why it's interesting: a unit square with a quarter-circle inscribed
; has area 1, and the quarter-circle has area π/4. So the ratio of
; (points inside the arc) / (points anywhere) approaches π/4 as you
; throw more darts. Random noise, careful counting, and π falls out.
;
; Run:
;   ./bin/sakura-scheme run carts/math/pi-monte-carlo.scm

(set-mode 'sakura)
(clear)

(define throws 5000)

; Throw a dart, plot it, and count if it's inside the quarter-circle.
(let toss ((i 0) (in 0))
  (if (>= i throws)
      (let ((est (* 4.0 (/ in throws))))
        (display "π ≈ ")
        (display est)
        (display " (from ")
        (display throws)
        (display " darts, ")
        (display in)
        (display " inside)")
        (newline)
        (display "true π = 3.14159265358979...")
        (newline)
        (display "error   = ")
        (display (abs (- est 3.14159265358979)))
        (newline))
      (let* ((x (random-int 80))
             (y (random-int 80))
             ; Normalized coordinates in [0,1].
             (nx (/ x 80.0))
             (ny (/ y 80.0))
             (inside? (<= (+ (* nx nx) (* ny ny)) 1.0)))
        (set-color (if inside? 14 12))
        (pset x y (if inside? 14 12))
        (toss (+ i 1) (+ in (if inside? 1 0))))))
