; orbit.scm — a point traces a circle. The purest animation.
;
; Verbs exercised: set-mode, clear, set-color, pset, disc, sin, cos.
; Why it's interesting: parametric motion — position = (cos t, sin t) —
; is the atom from which every rotational animation is built. This cart
; scribes a full orbit and marks its center. Watch the ring emerge.
;
; Run:
;   ./bin/sakura-scheme run carts/animation/orbit.scm

(set-mode 'sakura)
(clear)

(define cx 40)
(define cy 40)
(define radius 28)
(define frames 120)

; Draw the center marker.
(set-color 7)
(disc cx cy 2)

; Trace the orbit — one pixel per frame around the full circle.
(set-color 14)                  ; petal pink
(let orbit ((i 0))
  (if (< i frames)
      (let* ((theta (* (/ i frames) 2 3.14159265358979))
             (x (+ cx (* radius (cos theta))))
             (y (+ cy (* radius (sin theta)))))
        (pset (round x) (round y) 14)
        (orbit (+ i 1)))))

; And a second, faster orbit at half the radius, in a different color.
(set-color 12)                  ; blue
(let inner ((i 0))
  (if (< i frames)
      (let* ((theta (* (/ i frames) 4 3.14159265358979))
             (x (+ cx (* (/ radius 2) (cos theta))))
             (y (+ cy (* (/ radius 2) (sin theta)))))
        (pset (round x) (round y) 12)
        (inner (+ i 1)))))

(display "orbit complete: ")
(display frames)
(display " outer frames + ")
(display frames)
(display " inner frames.")
(newline)
