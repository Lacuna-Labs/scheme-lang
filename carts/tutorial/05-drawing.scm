; 05-drawing.scm — the framebuffer is a grid you can poke.
;
; Verbs exercised: set-mode, clear, set-color, pset, disc, circle,
;                  rect, rect-fill, line, pget.
; Why it's interesting: every color-per-pixel game in this language
; starts here. The framebuffer is 80×80 by default and lives at the
; palette-index level — no floats, no antialiasing, no fuss.
;
; Run:
;   ./bin/sakura-scheme run carts/tutorial/05-drawing.scm

(set-mode 'sakura)      ; 80×80
(clear)                 ; wipe to color 0 (black)

; Palette walk — a horizontal band of every color across the top.
(let stripe ((i 0))
  (if (< i 16)
      (begin
        (set-color i)
        (rect-fill (* i 5) 0 5 8)
        (stripe (+ i 1)))))

; A pink disc in the middle — Sakura's petal.
(set-color 14)
(disc 40 40 12)

; A ring of small blue dots around the disc.
(set-color 12)
(let ring ((k 0))
  (if (< k 16)
      (let* ((theta (* (/ k 16.0) 2 3.14159265))
             (x (+ 40 (* 22 (cos theta))))
             (y (+ 40 (* 22 (sin theta)))))
        (pset (round x) (round y) 12)
        (ring (+ k 1)))))

; Diagonal line, top-left to bottom-right.
(set-color 7)
(line 10 20 70 78)

; A hollow rectangle framing the whole scene.
(set-color 6)
(rect 2 2 76 76)

; Read a pixel back — proof that pset/pget round-trip.
(display "pixel at (40,40) = color ")
(display (pget 40 40))
(newline)
(display "drawing done — pink petal, blue ring, framed.")
(newline)
