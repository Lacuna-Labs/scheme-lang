; coin-flip-streaks.scm — flip a coin 10000 times, find the longest run.
;
; Verbs exercised: random-int, make-vector, vector-set!, vector-ref,
;                  set-mode, clear, set-color, rect-fill.
; Why it's interesting: a fair coin will produce surprisingly long
; runs by pure chance. In 10000 flips, expect a run of ~13 heads or
; tails. Most people guess much less. This cart flips, tracks the
; longest run, and draws a bar chart of run-lengths.
;
; Run:
;   ./bin/sakura-scheme run carts/games/coin-flip-streaks.scm

(set-mode 'sakura)
(clear)

(define flips 10000)

; Track: current run length, previous side, longest so far.
; Also histogram of every run's length up to 20.
(define histo (make-vector 20 0))

(let flip ((n 0) (prev -1) (run 0) (best 0))
  (if (= n flips)
      (begin
        (display "── coin flip streaks ──\n")
        (display "  flips     : ") (display flips) (newline)
        (display "  longest   : ") (display best) (display " in a row") (newline)
        (display "\n  run length | count\n")
        (let show ((i 1))
          (if (< i 20)
              (let ((c (vector-ref histo i)))
                (if (> c 0)
                    (begin
                      (display "  ") (display i)
                      (display " → ") (display c) (newline)))
                (show (+ i 1)))))

        ; Draw a bar chart of runs 1..15.
        (let bar ((i 1))
          (if (< i 16)
              (let* ((c (vector-ref histo i))
                     (h (round (* 0.02 c))))
                (set-color (if (odd? i) 14 12))
                (rect-fill (* i 5) (- 78 h) 4 h)
                (bar (+ i 1)))))
        (display "\nchart drawn.\n"))
      ; Otherwise: continue flipping.
      (let ((side (random-int 2)))
        (cond ((= side prev)
               (let ((new-run (+ run 1)))
                 ; Record this run when it ends — done lazily below.
                 (flip (+ n 1) side new-run (max new-run best))))
              (else
               ; Previous streak ended; record if it was > 0.
               (if (< prev 0)
                   ; First flip.
                   (flip (+ n 1) side 1 1)
                   (begin
                     (let ((idx (min run 19)))
                       (vector-set! histo idx (+ 1 (vector-ref histo idx))))
                     (flip (+ n 1) side 1 (max best 1)))))))))
