; histogram.scm — bucket a series of numbers into bins and draw bars.
;
; Verbs exercised: make-vector, vector-set!, vector-ref, random-normal,
;                  set-mode, clear, set-color, rect-fill, sum.
; Why it's interesting: bucket + count is the world's oldest data-viz
; move. Feed it 1000 samples from a normal distribution and the bell
; curve stands up all by itself, no formula needed.
;
; Run:
;   ./bin/sakura-scheme run carts/data/histogram.scm

(set-mode 'sakura)
(clear)

(define bins 20)
(define samples 1000)

; Storage for bin counts.
(define hist (make-vector bins 0))

; Sample from a standard normal, shifted to fit into [0, bins).
; Roughly: mean = bins/2, sd = bins/6.
(let sample ((n 0))
  (if (< n samples)
      (let* ((z (random-normal))              ; N(0, 1)
             (idx (round (+ (/ bins 2) (* z (/ bins 6))))))
        (if (and (>= idx 0) (< idx bins))
            (vector-set! hist idx (+ (vector-ref hist idx) 1)))
        (sample (+ n 1)))))

; Find the max count for scaling.
(define max-count
  (let loop ((i 0) (m 0))
    (if (>= i bins) m
        (loop (+ i 1) (max m (vector-ref hist i))))))

; Draw bars — each bar 4px wide, height scaled to fit 70px.
(let draw ((i 0))
  (if (< i bins)
      (let* ((count (vector-ref hist i))
             (h (round (* 70 (/ count max-count))))
             (x (* i 4))
             (y (- 78 h)))
        ; Bars fade from pink at the peak to blue at the tails.
        (set-color (if (> count (* max-count 0.5)) 14 12))
        (rect-fill x y 3 h)
        (draw (+ i 1)))))

; Print the numbers under the bars.
(display "── histogram: 1000 samples from N(0,1), 20 bins ──\n")
(let show ((i 0))
  (if (< i bins)
      (begin
        (display "  bin ") (display i) (display ": ")
        (display (vector-ref hist i))
        (newline)
        (show (+ i 1)))))

(display "\ntotal: ")
(display (let loop ((i 0) (s 0))
           (if (>= i bins) s (loop (+ i 1) (+ s (vector-ref hist i))))))
(display "   max bin: ")
(display max-count)
(newline)
