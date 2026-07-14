; maze-carver.scm — carve a perfect maze with randomized DFS.
;
; Verbs exercised: make-vector, vector-ref, vector-set!, random-int,
;                  set-mode, clear, set-color, pset, rect-fill.
; Why it's interesting: pick a cell. Knock out a wall to a random
; unvisited neighbor and recurse. When you're stuck, backtrack. Every
; cell is reachable from every other, and there's exactly one path
; between any two — a "perfect" maze.
;
; Run:
;   ./bin/sakura-scheme run carts/games/maze-carver.scm

(set-mode 'sakura)
(clear)

; Cell grid: 20×20. Each cell stores a bitmask of which walls are open.
; Bit 0 = up, 1 = right, 2 = down, 3 = left.
(define GW 20)
(define GH 20)

(define cells (make-vector (* GW GH) 0))
(define visited (make-vector (* GW GH) #f))

(define (cell-idx x y) (+ x (* y GW)))

; Directions: (dx dy open-from open-to). open-from is the bit to set on
; the source cell; open-to is the reciprocal bit on the target.
(define dirs
  (list
    (list  0 -1 1 4)   ; up:    src bit 0, dst bit 2
    (list  1  0 2 8)   ; right: src bit 1, dst bit 3
    (list  0  1 4 1)   ; down:  src bit 2, dst bit 0
    (list -1  0 8 2))) ; left:  src bit 3, dst bit 1

; Shuffle a list — pick a random element, remove it, repeat.
(define (shuffle lst)
  (let shuf ((remaining lst) (acc '()))
    (if (null? remaining)
        acc
        (let* ((n (length remaining))
               (i (random-int n))
               (picked (list-ref remaining i))
               (rest (let drop ((k 0) (rem remaining) (out '()))
                       (cond ((null? rem) (reverse out))
                             ((= k i) (drop (+ k 1) (cdr rem) out))
                             (else (drop (+ k 1) (cdr rem) (cons (car rem) out)))))))
          (shuf rest (cons picked acc))))))

; Recursive DFS.
(define (carve x y)
  (vector-set! visited (cell-idx x y) #t)
  (let each ((ds (shuffle dirs)))
    (if (not (null? ds))
        (let* ((d  (car ds))
               (dx (car d))
               (dy (car (cdr d)))
               (src-bit (car (cdr (cdr d))))
               (dst-bit (car (cdr (cdr (cdr d)))))
               (nx (+ x dx)) (ny (+ y dy)))
          (if (and (>= nx 0) (< nx GW) (>= ny 0) (< ny GH)
                   (not (vector-ref visited (cell-idx nx ny))))
              (let ((src-idx (cell-idx x y))
                    (dst-idx (cell-idx nx ny)))
                (vector-set! cells src-idx (bit-or (vector-ref cells src-idx) src-bit))
                (vector-set! cells dst-idx (bit-or (vector-ref cells dst-idx) dst-bit))
                (carve nx ny)))
          (each (cdr ds))))))

; Carve starting from (0, 0).
(carve 0 0)

; Draw: every cell is 4×4 pixels. Walls are drawn between cells;
; openings are just gaps in the wall.
(define CS 4)
; Background — fill dark grey.
(set-color 5)
(rect-fill 0 0 (* GW CS) (* GH CS))

; Draw open cells as pink squares, walls as darker grey lines.
(let py ((y 0))
  (if (< y GH)
      (begin
        (let px ((x 0))
          (if (< x GW)
              (let ((walls (vector-ref cells (cell-idx x y)))
                    (ox (* x CS)) (oy (* y CS)))
                ; Cell body — pink.
                (set-color 14)
                (rect-fill (+ ox 1) (+ oy 1) (- CS 2) (- CS 2))
                ; Open passages punch through the wall.
                (if (> (bit-and walls 1) 0)    ; up
                    (rect-fill (+ ox 1) oy (- CS 2) 1))
                (if (> (bit-and walls 2) 0)    ; right
                    (rect-fill (+ ox (- CS 1)) (+ oy 1) 1 (- CS 2)))
                (if (> (bit-and walls 4) 0)    ; down
                    (rect-fill (+ ox 1) (+ oy (- CS 1)) (- CS 2) 1))
                (if (> (bit-and walls 8) 0)    ; left
                    (rect-fill ox (+ oy 1) 1 (- CS 2)))
                (px (+ x 1)))))
        (py (+ y 1)))))

(display "maze-carver complete: ")
(display (* GW GH))
(display " cells carved via DFS.")
(newline)
