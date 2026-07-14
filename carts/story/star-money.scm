; star-money.scm — a short retelling of the folk motif, with a night
;                   sky rendered as a coda.
;
; Verbs exercised: display, newline, set-mode, clear, set-color, pset,
;                  random-int, sleep.
; Why it's interesting: text can be a program too. This cart prints a
; four-beat little tale — a child gives away her last things and, in
; the end, coins fall from the sky. Then it renders a small starfield
; as a visual bow at the end.
;
; This is a paraphrase, retold in plain modern prose; the folk motif
; belongs to no one.
;
; Run:
;   ./bin/sakura-scheme run carts/story/star-money.scm

; ── the tale ──
(display "\n── star money ──\n\n")

(display "  once, a small girl walked into the forest with nothing but\n")
(display "  the shirt on her back and a piece of bread in her hand.\n\n")

(display "  a hungry man passed her. she gave him the bread.\n\n")

(display "  further on, a shivering child. she gave up her shirt.\n\n")

(display "  the wind grew cold. she looked up.\n")
(display "  the stars themselves were falling — coins, all around her,\n")
(display "  more than she could carry.\n\n")

(display "  she walked home rich, and she was never hungry again.\n\n")

; ── the sky, as a small coda ──
(set-mode 'sakura)
(clear 1)                       ; dark-blue sky

; A quiet field of stars, mostly small and pale.
(set-color 7)
(let stars ((i 0))
  (if (< i 40)
      (begin
        (pset (random-int 80) (random-int 60) 7)
        (stars (+ i 1)))))

; Three bigger, warmer stars — the coins.
(set-color 10)
(let coins ((i 0))
  (if (< i 3)
      (let ((x (+ 10 (* i 25))) (y (+ 15 (random-int 15))))
        (pset x y 10)
        (pset (- x 1) y 10)
        (pset (+ x 1) y 10)
        (pset x (- y 1) 10)
        (pset x (+ y 1) 10)
        (coins (+ i 1)))))

; The girl at the bottom center — a small pink figure.
(set-color 14)
(let ((gx 40) (gy 70))
  (pset gx gy 14)                       ; head
  (pset gx (+ gy 1) 14)                 ; body
  (pset (- gx 1) (+ gy 1) 14)
  (pset (+ gx 1) (+ gy 1) 14)
  (pset gx (+ gy 2) 14)
  (pset (- gx 1) (+ gy 3) 14)
  (pset (+ gx 1) (+ gy 3) 14))

(display "  (the sky is drawn.)\n")
