; dice-battle.scm — a simplified Risk battle. Attacker rolls 3 dice,
;                    defender rolls 2. Highest attacker die vs highest
;                    defender die, and second-highest vs second-highest.
;
; Verbs exercised: random-int, sort, list, car, cdr, make-vector,
;                  vector-set!, vector-ref.
; Why it's interesting: this is a classic worked probability example.
; With 3 vs 2, the attacker wins about 37% of both dice, loses about
; 29% of both, and splits the rest. Simulate 500 battles and watch the
; empirical numbers converge on the theory.
;
; Run:
;   ./bin/sakura-scheme run carts/games/dice-battle.scm

; Roll n dice, return sorted (descending) list of face values.
(define (roll-dice n)
  (let roll ((i 0) (acc '()))
    (if (= i n)
        (sort acc >)
        (roll (+ i 1) (cons (+ 1 (random-int 6)) acc)))))

; Resolve one battle: 3 vs 2. Returns list (attacker-losses defender-losses).
(define (battle)
  (let* ((att (roll-dice 3))
         (def (roll-dice 2))
         ; Highest matchup.
         (a1  (car att))
         (d1  (car def))
         (loss1-att (if (> a1 d1) 0 1))
         (loss1-def (if (> a1 d1) 1 0))
         ; Second matchup.
         (a2  (car (cdr att)))
         (d2  (car (cdr def)))
         (loss2-att (if (> a2 d2) 0 1))
         (loss2-def (if (> a2 d2) 1 0)))
    (list (+ loss1-att loss2-att) (+ loss1-def loss2-def))))

; Tally over 500 battles. Buckets: 0-2 = attacker-losses [0..2].
; We store (attacker-loss, defender-loss) as a two-index key.
(define outcomes (make-vector 9 0))    ; 3×3 grid, row = att losses

(let sim ((n 0))
  (if (< n 500)
      (let* ((b (battle))
             (al (car b))
             (dl (car (cdr b)))
             (k  (+ (* al 3) dl)))
        (vector-set! outcomes k (+ (vector-ref outcomes k) 1))
        (sim (+ n 1)))))

(display "── 500 battles: 3 attacker dice vs 2 defender dice ──\n")
(display "  (att-loss, def-loss) → count\n")
(let show ((al 0))
  (if (< al 3)
      (begin
        (let inner ((dl 0))
          (if (< dl 3)
              (let ((c (vector-ref outcomes (+ (* al 3) dl))))
                (if (> c 0)
                    (begin
                      (display "  (") (display al) (display ", ")
                      (display dl) (display ")  → ")
                      (display c)
                      (newline)))
                (inner (+ dl 1)))))
        (show (+ al 1)))))

; Sum: "both defender losses" (a=0, d=2) vs "both attacker losses" (a=2, d=0).
(display "\n  attacker won both  = ")
(display (vector-ref outcomes 2))
(display " / 500 = ")
(display (/ (vector-ref outcomes 2) 500.0))
(newline)
(display "  defender won both  = ")
(display (vector-ref outcomes 6))
(display " / 500 = ")
(display (/ (vector-ref outcomes 6) 500.0))
(newline)
(display "  (theory: ~0.37, ~0.29 respectively)\n")
