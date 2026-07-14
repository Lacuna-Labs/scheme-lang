; primes.scm — the sieve of Eratosthenes plotted as a comb.
;
; Verbs exercised: set-mode, clear, set-color, pset, make-vector,
;                  vector-set!, vector-ref, prime?.
; Why it's interesting: strike out every multiple of 2, then every
; multiple of 3, then 5, and so on. What remains is the primes. The
; gaps between them look random up close and mysteriously regular from
; far away — this cart draws them as a comb so you can see both.
;
; Run:
;   ./bin/sakura-scheme run carts/math/primes.scm

(set-mode 'sakura)
(clear)

; Sieve up to N.
(define N 400)
(define sieve (make-vector (+ N 1) #t))

; 0 and 1 aren't prime.
(vector-set! sieve 0 #f)
(vector-set! sieve 1 #f)

; The classical sieve.
(let outer ((i 2))
  (if (<= (* i i) N)
      (begin
        (if (vector-ref sieve i)
            (let inner ((j (* i i)))
              (if (<= j N)
                  (begin
                    (vector-set! sieve j #f)
                    (inner (+ j i))))))
        (outer (+ i 1)))))

; Plot: x = n mod 80, y = n div 80 × 8. A pixel per prime.
(set-color 14)
(let scan ((n 2) (count 0))
  (if (<= n N)
      (if (vector-ref sieve n)
          (let ((x (modulo n 80))
                (y (* 8 (quotient n 80))))
            (pset x y 14)
            (pset x (+ y 1) 14)
            (scan (+ n 1) (+ count 1)))
          (scan (+ n 1) count))
      (begin
        (display "sieve done: ")
        (display count)
        (display " primes below ")
        (display N)
        (display " — largest gap ends at ")
        ; Find the biggest prime gap.
        (let gap-scan ((prev 2) (n 3) (best 0) (best-end 3))
          (cond ((> n N)
                 (display best-end)
                 (display " (gap = ")
                 (display best)
                 (display ")")
                 (newline))
                ((vector-ref sieve n)
                 (let ((g (- n prev)))
                   (gap-scan n (+ n 1)
                             (if (> g best) g best)
                             (if (> g best) n best-end))))
                (else (gap-scan prev (+ n 1) best best-end)))))))
