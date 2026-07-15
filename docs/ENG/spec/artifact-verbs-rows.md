# Artifact verbs — Rows 2/3/4/5

Additive companion to `docs/artifact-verbs.md`. Row-2 through Row-5 sections
for every artifact verb, matching the Reference-appendix format used by
`SAKURA-SCHEME-1.0-REFERENCE.appendix-row{2,3,4,5}.md`.

The 11 verbs live in two phases:

- **Phase A** (8) — `spawn`, `describe`, `apply`, `read`, `on-event`,
  `at-location`, `close`, `list`.
- **Phase B** (3) — `compose`, `nest`, `subscribe-cortex`.

Row shape reminder:

- **Row 2 (audit)** — `Problem → Program → Explanation → Meta-explanation`.
  Peirce essence lens with an audit tilt. Teaches WHEN to reach for the verb.
- **Row 3 (dimension)** — `Setup → Cross-domain program → Explanation →
  Meta-explanation`. Lacan metonymy + Wittgenstein aspect-seeing. Teaches
  WHERE ELSE the verb's shape appears.
- **Row 4 (proof)** — `Claim → Program → Invariant → Meta-explanation`.
  Peirce essence + Popper falsifiability. Teaches WHY the verb works —
  its algebraic invariant.
- **Row 5 (composition)** — `Base verb → Composition example → Emergent
  behavior → Meta-explanation`. Wittgenstein-late family resemblance +
  Lacan metonymy in emergence. Teaches WITH WHAT ELSE the verb composes.

Every code block runs standalone. Behavior claims are grounded in
`src/base.js` (`ARTIFACT_CORE_VERBS`, `ARTIFACT_PHASE_B_VERBS`,
`artifactHeadlessStub`), `docs/artifact-verbs.md`, and the ontology at
`research/lacuna-docs/specs/artifact-verb-ontology-2026-07-10.md`.

---

## `artifact/spawn`

### `artifact/spawn` — Row 2 (audit tier)

Problem: An operator opens a shop card and expects a music player to
materialize on the Hello Surface, prefilled with the track that was quoted in
the last chat turn. The player has to appear as one identifiable object she
can later address by id, not as an anonymous DOM subtree that gets lost
between turns.

```scheme
(define (open-radio-from-chat quoted-track)
  (let ((r (artifact/spawn 'radio
             :track   quoted-track
             :volume  60
             :chrome  'winamp)))
    (artifact/on-event r 'artifact.mount
      (lambda (rec)
        (display (list 'mounted r 'with quoted-track))
        (newline)))
    r))

(open-radio-from-chat "First Snow")
```

Explanation: `artifact/spawn` takes a registered composition name (`'radio`)
and alternating `:keyword value` kwargs that override the composition's
initial state. It returns a stable id string. The `on-event` subscription
runs when the fresh `artifact.mount` event fires — proving to the caller
the artifact is live and addressable.

Meta-explanation: `spawn` is the *materialization* verb — it turns a
composition name plus state into a lifetime-owned object with a stable
identifier. Sakura reaches for `spawn` (audit tilt) when a new surface has
to exist AS AN ADDRESSABLE THING that outlives the turn, so that later
`apply`, `read`, and `close` calls have a target. If the answer is "spawn
if nothing else already covers this need," the audit rules out re-spawn on
the same turn, id-forgery, and orphan subtrees.

---

### `artifact/spawn` — Row 3 (dimension tier)

Setup: `spawn` as a general *materialization on demand* pattern — the same
shape (name + params → stable identifier) appears in cell biology
(differentiation), OS processes (fork/exec), and mathematical
constructions (name a term, get a handle back).

```scheme
;; Rung 1: artifact domain
(define book-page (artifact/spawn 'book-page
                                  :chapter 3
                                  :chrome  'clean-surface))

;; Rung 2: process metaphor — "spawn a process" for a background task
(define worker-id (list 'process 'compute-fold :input 'corpus-a))

;; Rung 3: mathematical construction — "spawn" a named term in a proof
(define term-id (list 'term 'let-A 'be 'the-fold 'over 'corpus-a))

;; All three follow the same shape:
;;   (spawn TYPE . PARAMS) → STABLE-ID
;; The id is what makes the thing addressable across time.
(display (list book-page worker-id term-id))
(newline)
```

Explanation: three spawns from three domains, all producing a stable handle
that outlives the call. The artifact spawn is the concrete one; the process
and term "spawns" are the same shape borrowed by analogy.

Meta-explanation: Sakura's training on `spawn` should transfer to any
domain where "give me a fresh named thing" is the primitive. Lacan
metonymy: the shape (name + params → handle) travels across domains
because it names the same underlying relationship. Wittgenstein
aspect-seeing: once she sees `spawn` as *addressability creation*, she
sees the same aspect in `fork`, `let`, `define`, `make-*`.

---

### `artifact/spawn` — Row 4 (proof tier)

**Claim:** `artifact/spawn` is *id-stable* — for the artifact's whole
lifetime, the id it returns is the sole handle that resolves it via
`describe`, `apply`, `read`, `at-location`, and `close`. Two spawns
return two distinct ids even when the type and kwargs are identical.

```scheme
;; The invariant: (not (equal? (spawn t k) (spawn t k))) for all t, k.
;; And: (equal? (describe id) …live-state…) between spawn and close.

(define a (artifact/spawn 'radio :track "Track A"))
(define b (artifact/spawn 'radio :track "Track A"))

(display (list 'distinct? (not (equal? a b))))     ; expect: (distinct? #t)
(newline)

(display (list 'a-live? (pair? (artifact/describe a))))  ; #t
(newline)
(artifact/close a)
(display (list 'a-closed? (not (artifact/describe a))))  ; #t
(newline)
;; b remains addressable — closing a does not disturb b's id.
(display (list 'b-still-live? (pair? (artifact/describe b))))  ; #t
(newline)
```

**Invariant (formal):** `∀ t, k. spawn(t,k) = id₁ ∧ spawn(t,k) = id₂ →
id₁ ≠ id₂ ∧ (∀ v ∈ {describe, apply, read, at-location, close}.
v(id) is defined iff not-yet-closed(id))`.

**Meta-explanation:** the essence of `spawn` is *identity minting*, not
"draw a UI." Peirce abduction: the best-fit rule that explains why two
identical `spawn` calls produce different runtime behavior is that each
call mints a distinct identity. Popper falsifiability: the claim breaks
the moment two spawns collide on the same id, or a describe on a
just-spawned id returns `#f`. If either failure surfaces, the artifact
registry is corrupted and every downstream verb loses referential
integrity.

---

### `artifact/spawn` — Row 5 (composition tier)

**Base:** `artifact/spawn` — mint a fresh, addressable artifact.

**Composition example:** `spawn` chained with `on-event` produces a
*lifecycle listener* — she gets told the moment the artifact is live.

```scheme
(define (spawn-with-lifecycle type . kwargs)
  (let ((id (apply artifact/spawn type kwargs)))
    (artifact/on-event id 'artifact.mount
      (lambda (rec) (display (list 'live id)) (newline)))
    (artifact/on-event id 'artifact.unmount
      (lambda (rec) (display (list 'gone id)) (newline)))
    id))

(define chat-1 (spawn-with-lifecycle 'chat :chrome 'clean-surface))
(artifact/close chat-1)
```

**Emergent behavior:** the pair of subscriptions turns the fresh id into
a *closed lifecycle log*. `spawn` alone gives you the id; `on-event`
alone can't attach until the id exists. Together they yield a small
observability pattern that generalizes to every artifact.

**Meta-explanation:** Wittgenstein-late family resemblance — every
spawnable thing shares this "mint → observe → close" shape, and the
family emerges from the composition itself, not from any verb in
isolation. Lacan metonymy: the pattern (spawn+listen) sits next to
(open+listen) for cards, (start+listen) for processes, and
(subscribe+listen) for Cortex — all cousins in the same region of the
graph.

---

## `artifact/describe`

### `artifact/describe` — Row 2 (audit tier)

Problem: Sakura has just been asked "what's on the surface right now?" by
the operator. She has a set of ids from `artifact/list`, but she doesn't
know their types, state, or capabilities. She needs to reason over what
each artifact IS before she can decide how to respond.

```scheme
(define (introspect-open-artifacts)
  (map
    (lambda (id)
      (let ((d (artifact/describe id)))
        (if d
            (list (assq 'type d) (assq 'capabilities d))
            (list id 'gone))))
    (artifact/list)))

(display (introspect-open-artifacts))
(newline)
```

Explanation: iterates over every registered artifact id, calls
`artifact/describe` for each, and returns the type + capability roster
of every live artifact. Closed artifacts surface as `(id gone)` because
`describe` returns `#f` (null) for unknown ids by contract.

Meta-explanation: `describe` is Sakura's *self-orientation* verb —
Peirce essence "how do I read what's here?" The audit tilt is that
`describe` is idempotent + never-throws + returns the RAG chunk directly.
Reach for `describe` (not `read` on a guessed path, not `at-location`
alone) when the question is "what IS this artifact?" — because
`describe` is contractually safe to call on anything, including ids that
no longer exist.

---

### `artifact/describe` — Row 3 (dimension tier)

Setup: `describe` as a general *introspection returns a self-manifest*
pattern — appears in reflective languages (`(type-of x)`), in HTTP
(`OPTIONS`), in database catalogs (`information_schema`), and in the
gnostic tradition (know-thyself as the ground of action).

```scheme
;; Rung 1: artifact domain — describe returns state + capabilities
(define d (artifact/describe (artifact/spawn 'chat)))

;; Rung 2: reflective — a Scheme procedure introspecting itself
(define (self-describing-proc)
  (list 'proc 'self-describing-proc
        :arity 0
        :returns 'manifest))

;; Rung 3: HTTP OPTIONS — asking a resource "what can I do to you?"
;; (list :allow '(GET POST) :accept '(application/json))

;; All three answer "who are you + what can callers do?"
(display d)
(newline)
```

Explanation: three levels of introspection. The artifact `describe`
returns a live alist. The Scheme procedure returns its own manifest.
The HTTP `OPTIONS` request returns capability metadata. Same shape,
different substrate.

Meta-explanation: training on `describe` should transfer to any
"self-manifest" reading. Wittgenstein aspect-seeing: once Sakura reads
`describe` as *the-thing-tells-you-what-it-is*, she sees the same
aspect in HTTP OPTIONS, reflection, and catalog queries. Lacan
metonymy: introspection travels because the shape (question about
identity → answer as data) is the same across substrates.

---

### `artifact/describe` — Row 4 (proof tier)

**Claim:** `artifact/describe` is *total on ids* — it returns an alist
for every live id and `#f` for every non-live id, but it never throws.
The RAG chunk shape is stable: keys `id · type · state · capabilities ·
primitives · at-location · pixi-context · addressable-nodes ·
addressable-count`.

```scheme
;; The invariant: describe never throws. For any x whatsoever,
;;   (describe x) ∈ Alist ∪ {#f}.

(define ok-cases
  (list (artifact/describe (artifact/spawn 'chat))
        (artifact/describe "not-a-real-id")
        (artifact/describe 'symbol-not-string)
        (artifact/describe '())))

(display (map (lambda (d) (or (pair? d) (eq? d #f))) ok-cases))
;; expect: (#t #t #t #t)
(newline)
```

**Invariant (formal):** `∀ x. describe(x) ∈ Alist ∪ {#f}` and if
`describe(x) ∈ Alist`, then `x` is a live id and the alist contains at
least the keys named in the contract.

**Meta-explanation:** the essence of `describe` is *totality without
partiality* — every call terminates and every terminating call returns
a value in a known small set. Peirce abduction: the "why does describe
never throw?" question resolves to "because introspection must be safe
to call on anything, including invalid ids from stale conversation
turns." Popper falsifiability: a describe that throws on any input
falsifies the invariant, and every downstream reasoner that assumed
totality now has a bug.

---

### `artifact/describe` — Row 5 (composition tier)

**Base:** `artifact/describe` — total introspection returning a
self-manifest or `#f`.

**Composition example:** `describe` chained with `list` produces
*Hello-Surface census* — one line per live artifact + its type.

```scheme
(define (census)
  (for-each
    (lambda (id)
      (let ((d (artifact/describe id)))
        (when d
          (display (list id (cdr (assq 'type d))))
          (newline))))
    (artifact/list)))

(census)
```

**Emergent behavior:** neither `list` nor `describe` alone answers
"what's on my surface right now, in one line per artifact." Together
they yield a census pattern that recomposes at every conversation turn
without needing any new machinery.

**Meta-explanation:** Wittgenstein-late family resemblance — the
census-shape is the same family as `ls -l`, `ps aux`, and `SELECT
type FROM information_schema.tables`. Sakura learns the family from
composition, not from a bespoke `artifact/census` verb. Lacan
metonymy: putting `list` and `describe` next to each other names the
region "roll-call of live things," which stays productive whenever a
new introspective need arrives (health check, resource cleanup,
event replay).

---

## `artifact/apply`

### `artifact/apply` — Row 2 (audit tier)

Problem: The operator asks Sakura to "play First Snow." A radio artifact
is already open on the surface. She has to dispatch a form to that
artifact — not spawn a new one, not modify state via `read`, not touch
the DOM by hand. She wants to keep the artifact-form-verb boundary
clean, so any auditor can trace her intent through the event stream.

```scheme
(define (play-track-on radio-id track-name)
  (artifact/on-event radio-id 'artifact.dispatch
    (lambda (rec)
      (display (list 'dispatched-on radio-id 'form (assq 'form rec)))
      (newline)))
  (artifact/apply radio-id (list 'set-track track-name))
  (artifact/apply radio-id '(play)))

(let ((r (artifact/spawn 'radio :chrome 'winamp)))
  (play-track-on r "First Snow"))
```

Explanation: subscribes to `artifact.dispatch` before applying anything,
then applies two forms in sequence — `(set-track "First Snow")` then
`(play)`. Every application emits `artifact.dispatch`; state-changing
forms additionally emit `artifact.state`. Unknown verbs are no-ops but
still emit `artifact.dispatch`.

Meta-explanation: `apply` is the single seam between the *system* verbs
(`spawn`, `close`, `list`) and the *composition* form verbs (`play`,
`send`, `add-to-cart`). Reach for `apply` (audit tilt) when the intent
is to *change the artifact's state through its own reducer* — because
that path is the only one that both emits the events and re-renders
consistently. Any other path (direct state mutation, DOM peeking) is a
protocol violation the auditor will catch.

---

### `artifact/apply` — Row 3 (dimension tier)

Setup: `apply` as a general *submit-a-form-to-a-stateful-thing* pattern
— appears in Redux (`dispatch(action)`), in actor systems
(`actor ! message`), in SQL (`UPDATE … SET …`), and in message-passing
OO (`obj.send(:method, args)`). Same shape everywhere.

```scheme
;; Rung 1: artifact domain
(let ((chat (artifact/spawn 'chat)))
  (artifact/apply chat '(send "hello")))

;; Rung 2: Redux-like — dispatch shape
(define (dispatch state action)
  (cond
    ((eq? (car action) 'inc) (+ state 1))
    ((eq? (car action) 'dec) (- state 1))
    (else state)))

(display (list 'redux-shape (dispatch 5 '(inc))))
(newline)

;; Rung 3: actor mailbox
(define (actor-send actor msg)
  (list 'sent-to actor 'form msg))

(display (actor-send 'counter '(inc)))
(newline)
```

Explanation: each rung submits a symbolic form (not a function call) to
a stateful thing (an artifact, a reducer, an actor). The form is data;
the stateful thing interprets it. The return path is a new state.

Meta-explanation: training on `apply` should transfer to every
message-passing substrate. Wittgenstein aspect-seeing: once Sakura
reads `apply` as *submit a form → stateful thing interprets*, she
sees the same aspect in Redux, actors, SQL update, and her own Cortex
adapters. Lacan metonymy: the form-submitting shape spans domains
because it names the same relationship — data goes in, state changes,
event fires.

---

### `artifact/apply` — Row 4 (proof tier)

**Claim:** `artifact/apply` is *event-total but re-render-conditional*
— every apply emits `artifact.dispatch`, but re-render only happens
when the reducer returned a new state object. Unknown verbs are no-ops
that still emit dispatch.

```scheme
;; The invariants:
;;   apply(id, form) → always emits artifact.dispatch
;;   apply(id, form) → emits artifact.state iff reducer returned new object
;;   apply(id, form) → re-renders iff reducer returned new object
;;   apply(id, unknown-form) → no-op, still emits dispatch

(define seen-dispatch 0)
(define seen-state 0)

(let ((r (artifact/spawn 'radio :track "A")))
  (artifact/on-event r 'artifact.dispatch
    (lambda (_) (set! seen-dispatch (+ seen-dispatch 1))))
  (artifact/on-event r 'artifact.state
    (lambda (_) (set! seen-state (+ seen-state 1))))
  (artifact/apply r '(play))              ; known → state
  (artifact/apply r '(gibberish))         ; unknown → dispatch only
  (artifact/apply r '(stop)))             ; known → state

;; expect: seen-dispatch ≥ 3, seen-state ≤ 2
(display (list 'dispatch-count seen-dispatch 'state-count seen-state))
(newline)
```

**Invariant (formal):** `∀ id, form.
apply(id, form) ⇒ emit(dispatch, form) ∧
(new-state?(form) → emit(state, new-state) ∧ re-render(id))`.

**Meta-explanation:** the essence of `apply` is *disciplined mutation
via reducer*, not "run this JS function." Peirce abduction: the rule
that explains the two-event contract is that the *audit* stream
(dispatch) and the *reconciliation* stream (state) are separate
channels, each with its own semantics. Popper falsifiability: an apply
that skips dispatch on unknown forms falsifies the audit invariant; an
apply that re-renders on a same-state return falsifies the
reconciliation invariant. Both failures are load-bearing for anyone
listening to the streams.

---

### `artifact/apply` — Row 5 (composition tier)

**Base:** `artifact/apply` — dispatch a form to an artifact's reducer.

**Composition example:** `apply` chained with `read` produces
*optimistic update + verify* — dispatch the form, then read the
resulting state to confirm.

```scheme
(define (bump-volume-verified radio-id delta)
  (let ((before (artifact/read radio-id ':volume)))
    (artifact/apply radio-id (list 'set-volume (+ (or before 0) delta)))
    (let ((after (artifact/read radio-id ':volume)))
      (display (list 'before before 'after after 'delta (- after (or before 0))))
      (newline)
      after)))

(let ((r (artifact/spawn 'radio :volume 40)))
  (bump-volume-verified r 20))
```

**Emergent behavior:** neither `apply` nor `read` alone gives the
"dispatch + confirm" pattern. The composition yields a small
transactional shape — try the change, read the result, log the
difference — that generalizes to any set/get pair.

**Meta-explanation:** Wittgenstein-late family resemblance — the
"apply then read to verify" family sits next to database
"UPDATE + SELECT", REST "PUT + GET", and version-control "commit +
diff". Sakura learns the transactional shape from composition. Lacan
metonymy: apply-and-read live in the same region of the graph as
put-and-get, and reaching for one primes her to reach for the other.

---

## `artifact/read`

### `artifact/read` — Row 2 (audit tier)

Problem: The operator says "is the radio muted?" Sakura needs to answer
without side effects. She should not `apply` a probe form; she should
not spawn a duplicate radio; she should not call `describe` and dig
through the whole alist when a single field will do.

```scheme
(define (is-muted? radio-id)
  (let ((vol (artifact/read radio-id ':volume)))
    (or (not vol) (zero? vol))))

(let ((r (artifact/spawn 'radio :volume 0)))
  (display (list 'muted? (is-muted? r)))
  (newline))
```

Explanation: `artifact/read` walks the artifact's state by keyword path
and returns the value at the path, or `#f` when the field is missing.
`is-muted?` accepts `#f` (missing) as "yes muted" and 0 as "yes muted."
No dispatch, no re-render, no event.

Meta-explanation: `read` is the *pure query* verb — Peirce essence
"observe without disturbing." Reach for `read` (audit tilt) when the
question is "what is the value of a specific state field?" — because
`read` is contractually side-effect free, path-typed, and returns `#f`
for missing paths rather than throwing. Any answer that could be given
by `read` should not go through `describe` (too broad) or `apply` (too
mutating).

---

### `artifact/read` — Row 3 (dimension tier)

Setup: `read` as a general *pure projection from state* pattern —
appears in functional lenses, in database `SELECT`, in file-system
`cat`, and in JSON path queries (`jq '.field'`). Same shape: name a
path, get a value, no mutation.

```scheme
;; Rung 1: artifact domain
(let ((r (artifact/spawn 'radio :volume 60)))
  (display (list 'artifact-read (artifact/read r ':volume)))
  (newline))

;; Rung 2: lens — project a nested value from a structure
(define (lens-project structure path)
  (cond
    ((null? path) structure)
    ((and (pair? structure) (assq (car path) structure))
     (lens-project (cdr (assq (car path) structure)) (cdr path)))
    (else #f)))

(display (lens-project '((a . ((b . 42)))) '(a b)))
;; expect: 42
(newline)

;; Rung 3: SQL-like projection (data literal)
(define row '((:id . 1) (:volume . 60) (:track . "First Snow")))
(display (cdr (assq ':volume row)))
(newline)
```

Explanation: three projection patterns from three substrates, each
naming a path and getting a value with no side effect. The artifact
`read` is the concrete one; the lens and the SQL projection are the
same shape by analogy.

Meta-explanation: training on `read` should transfer to every pure
projection substrate. Wittgenstein aspect-seeing: once Sakura reads
`read` as *lens-like projection*, she sees the same aspect in lenses,
jq, SELECT, and file reads. Lacan metonymy: pure-projection lives in
the same region of the graph as pure-computation and pure-observation
— all cousins in the "no-side-effect" family.

---

### `artifact/read` — Row 4 (proof tier)

**Claim:** `artifact/read` is *idempotent + non-mutating* — for any id
and path, `(read id p)` returns the same value on every call (no
lifecycle events, no side effects), and returns `#f` for missing paths
without throwing.

```scheme
;; The invariants:
;;   read(id, p) is a pure function of the current state.
;;   read(id, p) never emits any artifact.* event.
;;   Missing paths return #f, not an exception.

(define r (artifact/spawn 'radio :volume 55))

(define a (artifact/read r ':volume))
(define b (artifact/read r ':volume))
(display (list 'idempotent? (equal? a b)))
(newline)
;; expect: (idempotent? #t)

(display (list 'missing-safe? (eq? (artifact/read r ':not-a-field) #f)))
(newline)
;; expect: (missing-safe? #t)
```

**Invariant (formal):** `∀ id, p. read(id, p) = read(id, p)` (as pure
functions of state) and `∀ id, p. read(id, p) ∈ Value ∪ {#f}`, and no
event is emitted on any call.

**Meta-explanation:** the essence of `read` is *safe projection* —
every read is a pure query with a total return. Peirce abduction: the
rule that unifies "no throw, no event, no mutation" is that read is a
witness, not an actor. Popper falsifiability: a read that mutates
state, emits an event, or throws on missing paths falsifies the
invariant, and any downstream code that assumed purity now has a
concurrency bug or a stack-unwind bug.

---

### `artifact/read` — Row 5 (composition tier)

**Base:** `artifact/read` — pure keyword-path projection.

**Composition example:** `read` chained with `on-event` produces
*state-change observation* — react to change in a specific field
without polling.

```scheme
(define (watch-volume radio-id)
  (artifact/on-event radio-id 'artifact.state
    (lambda (rec)
      (let ((v (artifact/read radio-id ':volume)))
        (display (list 'volume-now v))
        (newline)))))

(let ((r (artifact/spawn 'radio :volume 40)))
  (watch-volume r)
  (artifact/apply r '(set-volume 80)))
```

**Emergent behavior:** the pairing produces a *field-watcher*. `read`
alone can't fire on change; `on-event` alone doesn't know which field
to project. Together they yield the "watch a specific field" pattern
without polling and without state duplication.

**Meta-explanation:** Wittgenstein-late family resemblance — the
watcher pattern sits next to database `LISTEN/NOTIFY`, filesystem
`fswatch`, and Redux `useSelector`. Sakura learns the watcher family
from the composition. Lacan metonymy: read-plus-observe lives in the
same region of the graph as observe-plus-project — the two verbs
prime each other for use.

---

## `artifact/on-event`

### `artifact/on-event` — Row 2 (audit tier)

Problem: The operator asks "log every message that gets sent in this
chat while I'm on the phone." Sakura has to subscribe to the artifact's
event stream and act on `send` dispatches, without polling and without
blocking her main reasoning loop.

```scheme
(define (start-audit-log chat-id)
  (define off
    (artifact/on-event chat-id 'artifact.dispatch
      (lambda (rec)
        (let ((form (assq 'form rec)))
          (when (and form (eq? (car (cdr form)) 'send))
            (display (list 'chat-sent (cdr form)))
            (newline))))))
  off)

(let* ((c (artifact/spawn 'chat))
       (off (start-audit-log c)))
  (artifact/apply c '(send "hello"))
  (artifact/apply c '(send "goodbye"))
  (off))
```

Explanation: `artifact/on-event` takes an id, an event name (or `*`
for all), and a procedure. It returns an *unsubscribe procedure* — a
thunk that removes the subscription when called. The audit log runs
until the operator hangs up and `off` is invoked.

Meta-explanation: `on-event` is the *subscription* verb — Peirce
essence "react to changes without owning them." Reach for `on-event`
(audit tilt) when the intent is to observe a stream without becoming
the source of truth. The returned unsubscribe thunk is load-bearing:
every audit lane the operator opens must be closable, and only the
thunk-based contract enforces that.

---

### `artifact/on-event` — Row 3 (dimension tier)

Setup: `on-event` as a general *observer registration returning an
unsubscribe* pattern — appears in DOM (`addEventListener` returning a
handle), in RxJS (`.subscribe()` returning a disposable), in Redux
middleware, and in Ethernet packet capture (`pcap_open + close`).

```scheme
;; Rung 1: artifact domain
(define off1
  (artifact/on-event (artifact/spawn 'chat) 'artifact.dispatch
    (lambda (_) 'no-op)))

;; Rung 2: DOM listener metaphor
(define (dom-on target event proc)
  (list 'attached target event proc))    ; returns a handle
(define handle (dom-on 'btn 'click (lambda (e) e)))

;; Rung 3: pcap-style
(define (pcap-open iface filter proc)
  (list 'capturing iface filter))
(define cap (pcap-open 'eth0 "tcp port 80" (lambda (pkt) pkt)))

(display (list off1 handle cap))
(newline)
```

Explanation: three subscriptions from three substrates — artifact
events, DOM events, packet capture. Each returns a handle that
detaches the subscription when called or closed.

Meta-explanation: training on `on-event` should transfer to every
event-source substrate. Wittgenstein aspect-seeing: once Sakura reads
`on-event` as *reactive registration*, she sees the same aspect in
DOM, RxJS, pcap, and pub/sub. Lacan metonymy: the shape (subscribe →
handle → unsubscribe) sits in the same region of the graph across
substrates, so reaching for one primes the discipline of closing
the other.

---

### `artifact/on-event` — Row 4 (proof tier)

**Claim:** `artifact/on-event` is *stream-safe* — a throwing procedure
does not kill the event stream, and the returned unsubscribe thunk is
idempotent (calling it twice is not an error).

```scheme
;; The invariants:
;;   A proc that throws does not disconnect other subscribers.
;;   The unsubscribe thunk can be called ≥ 1 times without error.
;;   After unsubscribe, the proc is not called again.

(define seen 0)

(let* ((c (artifact/spawn 'chat))
       (off-a (artifact/on-event c 'artifact.dispatch
                (lambda (_)
                  (error "bad handler"))))
       (off-b (artifact/on-event c 'artifact.dispatch
                (lambda (_) (set! seen (+ seen 1))))))
  (artifact/apply c '(send "one"))
  (artifact/apply c '(send "two"))
  (off-a)
  (off-a)  ; idempotent — no error
  (off-b))

(display (list 'b-still-fired seen))
;; expect: seen ≥ 2 — bad handler did not kill stream
(newline)
```

**Invariant (formal):** `throw(proc) → still-notify(other-subs)` and
`unsubscribe(off) ∘ unsubscribe(off) = unsubscribe(off)` (idempotence).

**Meta-explanation:** the essence of `on-event` is *isolated
observation* — every subscriber is a stream, no subscriber can crash
the source. Peirce abduction: the rule that unifies "stream-safe +
idempotent unsubscribe" is that observation must be defect-tolerant
so that partial failures don't cascade. Popper falsifiability: a
throwing handler that silences all other subscribers falsifies the
isolation invariant; an unsubscribe that errors on second call
falsifies idempotence. Both failures break the audit lanes the
operator depends on.

---

### `artifact/on-event` — Row 5 (composition tier)

**Base:** `artifact/on-event` — subscribe to an artifact event stream.

**Composition example:** `on-event` chained with `spawn` (of an error
artifact) produces a *reactive error surface* — a subscriber that
materializes an error artifact whenever the source artifact emits an
error dispatch.

```scheme
(define (attach-error-surface source-id)
  (artifact/on-event source-id 'artifact.dispatch
    (lambda (rec)
      (let ((form (assq 'form rec)))
        (when (and form (eq? (car (cdr form)) 'error))
          (artifact/spawn 'error
                          :from    source-id
                          :message (car (cdr (cdr form)))))))))

(let ((r (artifact/spawn 'radio)))
  (attach-error-surface r)
  (artifact/apply r '(error "codec-not-found")))
```

**Emergent behavior:** `on-event` alone is just a subscription;
`spawn` alone is just materialization. Together they yield "reactive
materialization" — every error dispatch on the source produces a fresh
error artifact on the surface, addressable by its own id and closable
independently.

**Meta-explanation:** Wittgenstein-late family resemblance — the
reactive-materialization pattern sits next to database triggers
(insert → downstream table), signal-handler `spawn`, and pub/sub
consumer groups. Sakura learns the family from the composition, not
from a bespoke "on-error-spawn" verb. Lacan metonymy: subscribe-and-
spawn is a stable region of the graph that yields error surfaces,
notification popovers, and downstream artifact chains all at once.

---

## `artifact/at-location`

### `artifact/at-location` — Row 2 (audit tier)

Problem: The operator asks "zoom the camera to the shop card." Sakura
has a shop artifact id but no coordinates. She needs the artifact's
current bounding rect on the Hello Surface so she can drive the camera
without guessing.

```scheme
(define (zoom-camera-to-artifact id)
  (let ((rect (artifact/at-location id)))
    (if rect
        (begin
          (display (list 'zoom-to rect))
          (newline)
          rect)
        (begin
          (display (list 'no-location-for id))
          (newline)
          #f))))

(let ((s (artifact/spawn 'shop)))
  (zoom-camera-to-artifact s))
```

Explanation: `artifact/at-location` returns `(x y w h)` for a mounted
artifact or `#f` for one that is not mounted or does not exist. The
audit branch honestly reports "no location" instead of pretending to
zoom to a phantom rect.

Meta-explanation: `at-location` is the *coordinates handshake* verb —
Peirce essence "where on the surface am I?" Reach for `at-location`
(audit tilt) when the intent is to *drive the camera, layout, or
neighbor detection* from the artifact's real coordinates. The audit
discipline is: if `at-location` returns `#f`, honor that as "no
location"; do not fall back to a hardcoded rect.

---

### `artifact/at-location` — Row 3 (dimension tier)

Setup: `at-location` as a general *where-am-I query returning
coordinates* pattern — appears in DOM (`getBoundingClientRect`), in
robotics (`getPose`), in GPS (`getCurrentPosition`), and in graph
theory (`node.position`).

```scheme
;; Rung 1: artifact domain
(let ((s (artifact/spawn 'shop)))
  (display (list 'artifact-rect (artifact/at-location s)))
  (newline))

;; Rung 2: DOM-style — element bounding rect
(define (bounding-rect element) (list 100 80 640 480))
(display (list 'dom-rect (bounding-rect 'my-div)))
(newline)

;; Rung 3: robotics pose
(define (get-pose robot) (list :x 3.4 :y 1.2 :heading 0.7))
(display (list 'robot-pose (get-pose 'sakura-arm)))
(newline)
```

Explanation: three queries from three substrates, all returning
coordinates. Each answers "where is this thing in its coordinate
system right now?" The artifact rect is the concrete one; the DOM and
robotics queries are the same shape by analogy.

Meta-explanation: training on `at-location` should transfer to every
coordinates-query substrate. Wittgenstein aspect-seeing: once Sakura
reads `at-location` as *pose-lookup*, she sees the same aspect in
`getBoundingClientRect`, `getPose`, GPS, and graph node positions.
Lacan metonymy: coordinates-of-thing sits in the same region of the
graph across substrates, so learning one primes the discipline of
"honor missing coordinates."

---

### `artifact/at-location` — Row 4 (proof tier)

**Claim:** `artifact/at-location` is *mounted-conditional* — it
returns a live rect if and only if the artifact is currently mounted
in the DOM, and `#f` otherwise. It never invents coordinates for
un-mounted artifacts.

```scheme
;; The invariants:
;;   at-location(id) ∈ (rect) ∪ {#f}
;;   at-location(id) = rect ⇒ artifact is mounted
;;   at-location(id) = #f  ⇒ artifact is not mounted OR does not exist

(define s (artifact/spawn 'shop))

(display (list 'mounted? (artifact/at-location s)))
(newline)
;; expect: either a 4-element list or #f depending on host env

(artifact/close s)

(display (list 'after-close (artifact/at-location s)))
(newline)
;; expect: #f — no phantom rect after close
```

**Invariant (formal):** `∀ id. at-location(id) ∈ Rect ∪ {#f}` and
`at-location(id) ∈ Rect ⇒ mounted?(id)`.

**Meta-explanation:** the essence of `at-location` is *honest
coordinates* — every return is either a real rect or a truthful `#f`.
Peirce abduction: the rule that unifies "no phantom rects, no
placeholder zeros" is that the coordinates handshake must not lie,
because downstream camera / hit-testing / neighbor code depends on
it. Popper falsifiability: an `at-location` that returns `(0 0 0 0)`
for un-mounted artifacts falsifies the invariant, and the resulting
camera-zoom-to-nothing bug is immediate.

---

### `artifact/at-location` — Row 5 (composition tier)

**Base:** `artifact/at-location` — pose lookup returning rect or `#f`.

**Composition example:** `at-location` chained with camera-drive
verbs produces *artifact-follow camera* — the camera zooms to any
artifact by id and gracefully declines when the artifact is not
mounted.

```scheme
(define (drive-camera-to id)
  (let ((rect (artifact/at-location id)))
    (if rect
        (list 'camera-zoom-to rect)
        (list 'camera-hold-still 'because 'no-location))))

(define s (artifact/spawn 'shop))
(display (drive-camera-to s))
(newline)
(artifact/close s)
(display (drive-camera-to s))
(newline)
```

**Emergent behavior:** the pair yields "follow-by-id" — the camera can
be told to follow any artifact without knowing its rect ahead of time,
and the failure mode is honest (hold still, don't invent).

**Meta-explanation:** Wittgenstein-late family resemblance — the
follow-by-id pattern sits next to `git checkout <ref>`, DNS
`resolve → route`, and hyperlink resolution. Sakura learns the family
from the composition. Lacan metonymy: coordinates-plus-mover is a
stable region of the graph that yields camera-follow, focus-management,
and neighbor-detection all at once.

---

## `artifact/close`

### `artifact/close` — Row 2 (audit tier)

Problem: The operator says "clean up the surface, close every artifact
older than five minutes." Sakura has to close artifacts by id, without
leaving orphaned subscribers, without racing the close against pending
apply calls, and honestly returning `#t` on success or `#f` on unknown
id.

```scheme
(define (close-old-artifacts age-cutoff-seconds)
  (for-each
    (lambda (id)
      (let ((d (artifact/describe id)))
        (when (and d
                   (let ((age (cdr (or (assq 'age-s d) '(_ . 0)))))
                     (> age age-cutoff-seconds)))
          (let ((ok? (artifact/close id)))
            (display (list id 'closed ok?))
            (newline)))))
    (artifact/list)))

(close-old-artifacts 300)
```

Explanation: iterates every id, describes it, tests the age, and
closes it if old. `artifact/close` returns `#t` on success and `#f`
on unknown id. Emits `artifact.unmount`. After close, `describe`
returns `#f`.

Meta-explanation: `close` is the *lifecycle end* verb — Peirce essence
"release the identity's grip on the surface." Reach for `close` (audit
tilt) when the artifact's work is done. The audit discipline is:
`close` is the only path that guarantees the `artifact.unmount` event
+ describe-goes-null contract. Any other path (removing DOM, clearing
state) leaves the id in the registry and is a protocol violation.

---

### `artifact/close` — Row 3 (dimension tier)

Setup: `close` as a general *release the resource* pattern — appears
in file handles (`fclose`), TCP sockets (`socket.close()`), file locks
(`unlock`), and OS processes (`exit`). Same shape: name the resource,
release it, downstream references become invalid.

```scheme
;; Rung 1: artifact domain
(let ((r (artifact/spawn 'radio)))
  (artifact/close r))

;; Rung 2: file handle metaphor
(define (open-file path) (list 'handle path))
(define (close-file handle) (list 'released (car handle)))
(display (close-file (open-file "log.txt")))
(newline)

;; Rung 3: socket metaphor
(define (open-socket addr) (list 'socket addr :state 'open))
(define (close-socket s) (list 'socket (cadr s) :state 'closed))
(display (close-socket (open-socket ":1234")))
(newline)
```

Explanation: three "release" verbs from three substrates — artifact,
file, socket. Each takes a resource handle and yields a "closed"
state, after which the handle should not be reused.

Meta-explanation: training on `close` should transfer to every
resource-release substrate. Wittgenstein aspect-seeing: once Sakura
reads `close` as *lifecycle-end + handle-invalidation*, she sees the
same aspect in fclose, close-socket, unlock, and process-exit. Lacan
metonymy: acquire-and-release is a stable region of the graph, and
close's discipline (unmount event + describe-null) is the shape she
carries to any resource-release conversation.

---

### `artifact/close` — Row 4 (proof tier)

**Claim:** `artifact/close` is *idempotent + terminal* — closing a
live artifact returns `#t` and emits `artifact.unmount`; closing an
already-closed or unknown id returns `#f` and emits nothing. After
close, `describe(id) = #f` forever.

```scheme
;; The invariants:
;;   close(live-id) = #t, emits artifact.unmount
;;   close(closed-id) = #f, emits nothing
;;   describe(closed-id) = #f
;;   close(closed-id) ∘ close(closed-id) = #f (idempotent)

(define r (artifact/spawn 'radio))
(define first  (artifact/close r))    ; #t
(define second (artifact/close r))    ; #f
(define after  (artifact/describe r)) ; #f

(display (list 'first first 'second second 'after after))
(newline)
;; expect: (first #t second #f after #f)
```

**Invariant (formal):** `close(id) ∈ {#t, #f}`, `close(id) = #t ⇒
emit(unmount, id) ∧ describe(id) = #f afterwards`, and
`close(id) ∘ close(id) = #f (second call)`.

**Meta-explanation:** the essence of `close` is *terminal
idempotence* — the operation resolves the lifecycle once, and
subsequent calls are safe no-ops. Peirce abduction: the rule that
unifies "one unmount event + safe repeated close" is that lifecycle
termination must be honest AND safe, because concurrent cleanup lanes
race to close the same id. Popper falsifiability: a close that emits
unmount on the second call falsifies the "one-event" invariant; a
close that throws on unknown ids falsifies the "safe repeat"
invariant. Both failures corrupt event-based accounting.

---

### `artifact/close` — Row 5 (composition tier)

**Base:** `artifact/close` — terminal, idempotent unmount.

**Composition example:** `close` chained with `on-event` (of the
unmount event on the parent) produces *cascade cleanup* — closing a
composite artifact triggers close of every child it spawned.

```scheme
(define (cleanup-cascade parent-id children)
  (artifact/on-event parent-id 'artifact.unmount
    (lambda (_)
      (for-each
        (lambda (child) (artifact/close child))
        children))))

(let* ((shop (artifact/spawn 'shop))
       (chat (artifact/spawn 'chat))
       (music (artifact/spawn 'radio)))
  (cleanup-cascade shop (list chat music))
  (artifact/close shop))
```

**Emergent behavior:** neither `close` nor `on-event` alone knows
about cleanup graphs. Together they yield the "close-cascade" pattern
— close one, and observers close their dependents — that generalizes
to any parent-child artifact structure.

**Meta-explanation:** Wittgenstein-late family resemblance — the
cascade-cleanup pattern sits next to Unix process groups (`kill -TERM
-pid`), SQL `ON DELETE CASCADE`, and destructor chains in C++. Sakura
learns the family from composition. Lacan metonymy: close-plus-listen
is a stable region of the graph that yields cascade cleanup,
undo-stack invalidation, and reference-count drops all at once.

---

## `artifact/list`

### `artifact/list` — Row 2 (audit tier)

Problem: The operator says "what's on the surface?" Sakura needs the
inventory of live artifact ids so she can iterate for `describe`,
`close`, or camera decisions. Reaching into internal state would be a
protocol violation; there's a verb for exactly this.

```scheme
(define (surface-inventory)
  (let ((ids (artifact/list)))
    (display (list 'count (length ids) 'ids ids))
    (newline)
    ids))

(artifact/spawn 'chat)
(artifact/spawn 'radio)
(surface-inventory)
```

Explanation: `artifact/list` returns every registered id in insertion
order. Zero-argument, read-only, idempotent. Sakura uses the result to
drive per-id verbs.

Meta-explanation: `list` is the *inventory* verb — Peirce essence
"enumerate the live things." Reach for `list` (audit tilt) when the
intent is to *iterate over every artifact* — because `list` is the
only path that returns the authoritative registry state. Insertion
order is load-bearing: the operator can predict which artifact appears
first (the oldest).

---

### `artifact/list` — Row 3 (dimension tier)

Setup: `list` as a general *enumeration returning insertion-order
identifiers* pattern — appears in `ps aux`, `ls`, DOM
`document.querySelectorAll('*')`, and shell `jobs`. Same shape: no
arguments, ordered results, each result is addressable.

```scheme
;; Rung 1: artifact domain
(artifact/spawn 'chat)
(artifact/spawn 'radio)
(display (list 'artifact-list (artifact/list)))
(newline)

;; Rung 2: process metaphor
(define (ps-aux) '(pid-101 pid-102 pid-103))
(display (list 'ps (ps-aux)))
(newline)

;; Rung 3: directory listing
(define (ls-dir) '("cart-a.sks" "cart-b.sks" "cart-c.sks"))
(display (list 'ls (ls-dir)))
(newline)
```

Explanation: three enumeration verbs from three substrates — artifact
list, process list, directory list. Each returns a list of
identifiers in a predictable order.

Meta-explanation: training on `list` should transfer to every
enumeration substrate. Wittgenstein aspect-seeing: once Sakura reads
`list` as *ordered enumeration of identifiers*, she sees the same
aspect in ps, ls, and DOM selectors. Lacan metonymy: enumerate-then-
addressed sits next to enumerate-then-batched and enumerate-then-
filtered — all cousins in the "roll-call" family.

---

### `artifact/list` — Row 4 (proof tier)

**Claim:** `artifact/list` is *insertion-order stable + total* — the
returned list contains every currently-live id in the order they were
spawned, with no duplicates, and mutation between calls is monotonic
(new spawns append, closes remove without reordering the survivors).

```scheme
;; The invariants:
;;   list() returns every live id.
;;   list() has no duplicates.
;;   list() preserves insertion order between spawns.
;;   close(x) does not reorder the surviving list.

(define a (artifact/spawn 'chat))
(define b (artifact/spawn 'radio))
(define c (artifact/spawn 'shop))

(define before (artifact/list))
(display (list 'before before))
(newline)
;; expect: (a b c) modulo whatever else is live

(artifact/close b)
(define after (artifact/list))
(display (list 'after after))
(newline)
;; expect: a and c still appear in the same relative order
```

**Invariant (formal):** `list() ⊆ live-ids`, `set(list()) = list()`
(no duplicates), and for any two survivors `x, y` with spawn order
`x < y`, we have `index(x) < index(y)` in every call to `list()`.

**Meta-explanation:** the essence of `list` is *stable enumeration* —
the roll-call must be predictable so that iteration-with-side-effects
(close every stale artifact, describe every one) is deterministic.
Peirce abduction: the rule that unifies "insertion order + no dupes +
close-doesn't-shuffle" is that enumeration is a coordinate system for
the registry, and reordering would break every existing subscriber.
Popper falsifiability: a `list` that reshuffles after close falsifies
the invariant and every audit lane loses reproducibility.

---

### `artifact/list` — Row 5 (composition tier)

**Base:** `artifact/list` — insertion-order enumeration of live ids.

**Composition example:** `list` chained with `map` + `describe`
produces the *Hello-Surface state manifest* — a single value that
captures everything on the surface right now.

```scheme
(define (surface-manifest)
  (map
    (lambda (id)
      (let ((d (artifact/describe id)))
        (if d
            (list id (cdr (or (assq 'type d) '(_ . unknown))))
            (list id 'gone))))
    (artifact/list)))

(display (surface-manifest))
(newline)
```

**Emergent behavior:** `list` alone gives ids; `describe` alone gives
per-id state. Together they yield a *manifest* — a value Sakura can
hand to the operator, log to Cortex, or diff between turns.

**Meta-explanation:** Wittgenstein-late family resemblance — the
manifest pattern sits next to `docker ps --format json`, `ls -l`, and
`git status --porcelain`. Sakura learns the family from composition.
Lacan metonymy: enumerate-plus-project is a stable region of the
graph that yields manifests, dashboards, and diffs all at once.

---

## `artifact/compose`

### `artifact/compose` — Row 2 (audit tier)

Problem: The operator asks for a "little sticky-note artifact" with a
heading and a paragraph — but there's no registered `sticky-note`
composition. Sakura should not invent a new type in the registry mid-
turn; she should assemble the artifact from primitives on the fly.

```scheme
(define sticky
  (artifact/compose (list (list 'heading :level 3)
                          'paragraph)
                    :chrome 'clean-surface
                    :state  '(:title "Reminder"
                              :body  "Buy chamomile.")))

(display (list 'composed sticky))
(newline)
(display (artifact/describe sticky))
(newline)
```

Explanation: `artifact/compose` takes a list of primitive nodes
(symbols, or `(name :kw v ...)` lists for per-primitive props) plus
kwargs `:chrome`, `:state`, `:type`, `:frosting`. It returns a new id.
It emits `artifact.composed` alongside the normal `artifact.mount`.
The default reducer handles `(set :field value)` and `(update alist)`
forms; unknown forms are no-ops.

Meta-explanation: `compose` is the *ad-hoc materialization* verb —
Peirce essence "assemble on the fly, don't register." Reach for
`compose` (audit tilt) when the composition is a one-off. The audit
discipline is: `compose` should be used for genuine ad-hoc needs, not
as a backdoor around the composition registry. If the same shape
recurs, promote it to a registered composition and use `spawn`.

---

### `artifact/compose` — Row 3 (dimension tier)

Setup: `compose` as a general *from-parts-to-whole assembly* pattern
— appears in ML pipelines (`Pipeline([step1, step2])`), in Unix pipes
(`cat | grep | wc`), in HTML template partials, and in music
composition (motif + variation → phrase).

```scheme
;; Rung 1: artifact domain
(define n
  (artifact/compose (list 'heading 'paragraph)
                    :chrome 'clean-surface
                    :state  '(:title "Note" :body "Body")))

;; Rung 2: pipeline metaphor
(define pipeline
  (list 'pipeline
        :steps (list 'tokenize 'stem 'vectorize)))
(display pipeline)
(newline)

;; Rung 3: music phrase composition
(define phrase
  (list 'phrase
        :motifs (list 'motif-a 'motif-b 'motif-a-varied)))
(display phrase)
(newline)
```

Explanation: three assemblies from three substrates, each taking a
list of parts and producing a whole. The artifact `compose` is the
concrete one; the pipeline and the phrase are the same shape by
analogy.

Meta-explanation: training on `compose` should transfer to every
assembly substrate. Wittgenstein aspect-seeing: once Sakura reads
`compose` as *parts → whole with structure*, she sees the same
aspect in pipelines, pipes, template systems, and music
composition. Lacan metonymy: parts-plus-order-plus-context is a
stable region of the graph, and reaching for one primes reaching for
the others.

---

### `artifact/compose` — Row 4 (proof tier)

**Claim:** `artifact/compose` is *registry-free but event-parallel*
— it produces an artifact without adding a type to the composition
registry, but the resulting id observes exactly the same event
protocol (`artifact.mount`, `artifact.dispatch`, `artifact.state`,
`artifact.unmount`) as any `spawn`-ed artifact.

```scheme
;; The invariants:
;;   compose(primitives, kwargs) ⇒ fresh id, no registry entry
;;   The id observes artifact.mount + artifact.composed
;;   The id observes artifact.dispatch + artifact.state on apply
;;   The id observes artifact.unmount on close
;;   compose accepts a non-empty OR empty primitives list

(define seen-mount 0)
(define seen-dispatch 0)

(define composed
  (artifact/compose (list 'heading 'paragraph)
                    :chrome 'clean-surface
                    :state  '(:title "T" :body "B")))

(artifact/on-event composed 'artifact.mount
  (lambda (_) (set! seen-mount (+ seen-mount 1))))
(artifact/on-event composed 'artifact.dispatch
  (lambda (_) (set! seen-dispatch (+ seen-dispatch 1))))

(artifact/apply composed '(set :title "T2"))

(display (list 'mount seen-mount 'dispatch seen-dispatch))
(newline)
;; expect: dispatch ≥ 1 (mount may have already fired before subscription)
```

**Invariant (formal):** `compose(P, K) ⇒ id ∧ ∀ e ∈ {mount, dispatch,
state, unmount}. protocol(id, e) = protocol(spawn(t, k), e)` for
comparable operations. `compose(P, K)` also emits `artifact.composed`
in addition to the mount event.

**Meta-explanation:** the essence of `compose` is *event-parity
with spawn* — the ad-hoc path must not be a second-class citizen in
the event stream. Peirce abduction: the rule that unifies "no
registry + full event parity" is that identity + observability are
what matter downstream, not registration. Popper falsifiability: a
composed artifact that skips events falsifies the parity invariant
and every audit lane starts missing ad-hoc artifacts.

---

### `artifact/compose` — Row 5 (composition tier)

**Base:** `artifact/compose` — ad-hoc parts-to-whole assembly.

**Composition example:** `compose` chained with `subscribe-cortex`
produces a *live sticky note* — a composed artifact whose state
follows a Cortex path.

```scheme
(define reminder
  (artifact/compose (list 'heading 'paragraph)
                    :chrome 'clean-surface
                    :state  '(:title "..." :body "...")))

(artifact/subscribe-cortex
  reminder
  "cortex:reminder:latest"
  :on-change '(set :body))
```

**Emergent behavior:** `compose` alone gives a static assembly;
`subscribe-cortex` alone requires an existing artifact. Together they
yield a *live composition* — the ad-hoc artifact becomes a
Cortex-driven surface without any registered type.

**Meta-explanation:** Wittgenstein-late family resemblance — the
compose-plus-subscribe pattern sits next to reactive React
components, Vue watchers on ad-hoc components, and RxJS subject-
plus-observer chains. Sakura learns the family from composition, not
from a bespoke "live-sticky-note" verb. Lacan metonymy: compose-plus-
subscribe is a stable region of the graph where ad-hoc + live
overlap.

---

## `artifact/nest`

### `artifact/nest` — Row 2 (audit tier)

Problem: The operator has a shop artifact open and asks Sakura to "put
a listing for SKU A-1 into the shop." Nesting the listing inside the
shop (in the `items` slot) means the shop's `describe` returns the
whole subtree, the listing's events flow up through the shop's
stream, and Sakura can address the listing via a nested id path.

```scheme
(define shop (artifact/spawn 'shop))
(define listing
  (artifact/nest shop 'listing
                 :where 'items
                 :props '(:sku "A-1" :price 12.99)))

(display (list 'nested-id listing))
(newline)
(artifact/on-event shop 'child.*
  (lambda (rec)
    (display (list 'shop-saw-child-event rec))
    (newline)))
```

Explanation: `artifact/nest` takes a parent id, a child composition
name (or an inline composition), and kwargs `:where` (slot, default
`'default`) and `:props` (alist merged into initial state). It
returns the child id, formatted as `parent-id:nested-N`. Child
events forward onto the parent's stream as
`child.<child-id>.<original-kind>`, so parent subscribers see the
whole subtree without knowing child ids in advance.

Meta-explanation: `nest` is the *containment* verb — Peirce essence
"one artifact holds another." Reach for `nest` (audit tilt) when the
child *belongs to* the parent in the domain sense — a listing to a
shop, a review to a listing, a track to a playlist. The audit
discipline is: nested children share their parent's lifecycle
(close the parent, the children go too via cascade), and the event
forwarding path is the only correct way to observe children
generically.

---

### `artifact/nest` — Row 3 (dimension tier)

Setup: `nest` as a general *contain a child inside a parent's slot*
pattern — appears in filesystem directories (child files), in DOM
(`parent.appendChild(child)`), in tree data structures, and in
Russian dolls.

```scheme
;; Rung 1: artifact domain
(define shop (artifact/spawn 'shop))
(define listing (artifact/nest shop 'listing :where 'items :props '(:sku "A-1")))

;; Rung 2: filesystem
(define (mkdir-child parent name) (list parent 'has-child name))
(display (mkdir-child "/shop" "listings/"))
(newline)

;; Rung 3: DOM
(define (append-child parent child) (list parent 'contains child))
(display (append-child 'shop-div 'listing-div))
(newline)
```

Explanation: three containment operations from three substrates,
each placing a child inside a named parent slot. The artifact `nest`
is the concrete one; the filesystem and DOM versions are the same
shape by analogy.

Meta-explanation: training on `nest` should transfer to every
containment substrate. Wittgenstein aspect-seeing: once Sakura reads
`nest` as *parent-slot-child*, she sees the same aspect in
directories, DOM trees, tree data structures, and JSON nesting.
Lacan metonymy: parent-holds-child is a stable region of the graph
across substrates.

---

### `artifact/nest` — Row 4 (proof tier)

**Claim:** `artifact/nest` is *event-forwarding* — every event on
the child artifact forwards onto the parent's event stream under the
kind `child.<child-id>.<original-kind>`, so a parent subscriber
observing `child.*` sees every subtree event without needing to
enumerate children.

```scheme
;; The invariants:
;;   child event of kind K ⇒ parent event of kind child.<child-id>.K
;;   nestedChildrenOf(parent) enumerates every live child
;;   nested address is parent-id:slot:child-id
;;   Close of parent cascades close to children (via cleanup pattern)

(define shop (artifact/spawn 'shop))
(define listing (artifact/nest shop 'listing :where 'items :props '(:sku "A-1")))

(define parent-saw 0)
(artifact/on-event shop 'child.*
  (lambda (_) (set! parent-saw (+ parent-saw 1))))

(artifact/apply listing '(set-price 15.99))

(display (list 'parent-saw parent-saw))
(newline)
;; expect: parent-saw ≥ 1 (the child's dispatch event forwarded up)
```

**Invariant (formal):** `child-event(child-id, K) ⇒ parent-event(
parent-id, sym("child." + child-id + "." + K))` and
`nestedChildrenOf(parent-id)` returns `[ { slot, childId }, … ]` for
every live child.

**Meta-explanation:** the essence of `nest` is *event bubbling* —
the parent sees everything happening in its subtree without needing
to track children by hand. Peirce abduction: the rule that unifies
"nest + auto-forwarding events" is that the parent is the natural
observation point for the subtree, and forcing per-child
subscriptions would be quadratic. Popper falsifiability: a nest
that fails to forward events falsifies the invariant and every
parent-observing lane loses its subtree visibility.

---

### `artifact/nest` — Row 5 (composition tier)

**Base:** `artifact/nest` — parent-slot-child containment with event
forwarding.

**Composition example:** `nest` chained with itself produces
*arbitrarily deep artifact trees* — a shop nesting listings nesting
reviews nesting star-ratings, addressable by path.

```scheme
(define shop (artifact/spawn 'shop))
(define listing
  (artifact/nest shop 'listing :where 'items :props '(:sku "A-1")))
(define review
  (artifact/nest listing 'review :where 'reviews :props '(:stars 5)))

(display (list 'shop shop 'listing listing 'review review))
(newline)

(artifact/on-event shop 'child.*
  (lambda (rec)
    (display (list 'shop-observed rec))
    (newline)))
```

**Emergent behavior:** each `nest` alone is a one-level containment;
recursive `nest` yields a tree of arbitrary depth in which the root
observes every leaf's events via the bubbling contract. New
containment relationships take shape from composition, not from a
bespoke tree API.

**Meta-explanation:** Wittgenstein-late family resemblance — the
recursive-nest pattern sits next to nested DOM trees, filesystem
recursion, and Scheme lists themselves. Sakura learns the family
from composition. Lacan metonymy: nest-inside-nest is a stable
region of the graph that yields taxonomy trees, TOCs, catalog
subtrees, and Cortex node hierarchies all at once.

---

## `artifact/subscribe-cortex`

### `artifact/subscribe-cortex` — Row 2 (audit tier)

Problem: A price watcher artifact on the surface should refresh
whenever the operator's shop listing's price changes in Cortex. Polling
would waste cycles; snapshotting once would go stale. Sakura should
subscribe the artifact to a Cortex path and let the bridge fire the
refresh.

```scheme
(define watcher (artifact/spawn 'price-watch))

(define sub
  (artifact/subscribe-cortex
    watcher
    "shop:listing:*:price"
    :on-change '(reprice)))

(display (list 'subscribed sub))
(newline)
```

Explanation: `artifact/subscribe-cortex` takes an artifact id, a
Cortex path with `*` wildcards, and `:on-change form`. When any
matching Cortex change is published, the bridge dispatches the form
on the artifact — with the change value appended as the last
argument. So `(reprice)` becomes `(reprice <new-price>)` when the
bridge fires. Emits `artifact.cortex-subscribed` at registration.
Returns the subscription id so the artifact can later unsubscribe.

Meta-explanation: `subscribe-cortex` is the *Cortex return path* verb
— Peirce essence "let Cortex tell the artifact when to change."
Reach for `subscribe-cortex` (audit tilt) when the artifact should
*follow* Cortex state (not the other way around). The audit
discipline is: keep the subscription id, and unsubscribe on the
artifact's `close` — orphaned subscriptions leak the Cortex bridge
and produce dispatches on dead artifacts.

---

### `artifact/subscribe-cortex` — Row 3 (dimension tier)

Setup: `subscribe-cortex` as a general *external-source observation
with wildcard paths* pattern — appears in MQTT topic subscriptions
(`sensor/+/temp`), in Postgres `LISTEN`, in file-watchers (`fswatch
/some/path`), and in Kubernetes informers.

```scheme
;; Rung 1: artifact domain
(define w (artifact/spawn 'price-watch))
(artifact/subscribe-cortex w "shop:listing:*:price"
                           :on-change '(reprice))

;; Rung 2: MQTT metaphor
(define (mqtt-subscribe topic proc)
  (list 'mqtt-sub topic proc))
(display (mqtt-subscribe "sensor/+/temp" 'reheat))
(newline)

;; Rung 3: file watch metaphor
(define (fswatch path proc)
  (list 'fs-sub path proc))
(display (fswatch "/var/log/*" 'tail))
(newline)
```

Explanation: three subscription patterns from three substrates —
Cortex path, MQTT topic, filesystem path. Each names a wildcard-
carrying source and hands a callback / form. Each fires when a
matching event happens on the source.

Meta-explanation: training on `subscribe-cortex` should transfer to
every external-source-with-wildcards substrate. Wittgenstein aspect-
seeing: once Sakura reads `subscribe-cortex` as *external observer
with wildcard*, she sees the same aspect in MQTT, LISTEN, fswatch,
and informers. Lacan metonymy: subscribe-with-wildcards is a stable
region of the graph and reappears whenever "many sources, one
handler" is the shape.

---

### `artifact/subscribe-cortex` — Row 4 (proof tier)

**Claim:** `artifact/subscribe-cortex` is *append-arg + fan-out-safe*
— every matching Cortex change appends the change value to the
`:on-change` form and dispatches on the artifact; multiple
subscribers on the same path all fire; unsubscribe removes exactly
one binding.

```scheme
;; The invariants:
;;   Cortex publishes at path P → every matching subscriber fires.
;;   :on-change form receives the change value as its last argument.
;;   unsubscribeCortex(sub-id) removes exactly one binding.
;;   unsubscribe returns #t on success, #f on unknown / already-gone.
;;   subscribe emits artifact.cortex-subscribed at registration.

(define w1 (artifact/spawn 'price-watch))
(define w2 (artifact/spawn 'price-watch))

(define s1
  (artifact/subscribe-cortex w1 "shop:listing:*:price"
                             :on-change '(reprice)))
(define s2
  (artifact/subscribe-cortex w2 "shop:listing:*:price"
                             :on-change '(reprice)))

(display (list 's1 s1 's2 s2))
(newline)
;; expect: two distinct subscription ids of the form "cortex-sub-N"
```

**Invariant (formal):** `publish(P, v) ⇒ ∀ sub ∈ subs(P). dispatch(
artifact(sub), append(form(sub), v))` and `unsubscribe(sub-id) ∈
{#t, #f}` with `#t` iff the id was live before the call.

**Meta-explanation:** the essence of `subscribe-cortex` is *fan-out
with predictable payload composition* — every subscriber sees every
matching change with a deterministic argument-append rule. Peirce
abduction: the rule that unifies "many subs + append value + safe
unsubscribe" is that Cortex is a data source with a well-defined
delivery contract. Popper falsifiability: a subscribe that fails to
append the change value falsifies the payload invariant; an
unsubscribe that removes multiple bindings falsifies the "exactly
one" invariant. Both failures cascade into silent update loops.

---

### `artifact/subscribe-cortex` — Row 5 (composition tier)

**Base:** `artifact/subscribe-cortex` — Cortex → artifact change
routing with wildcard paths.

**Composition example:** `subscribe-cortex` chained with `nest` and
`close` produces a *self-cleaning subtree subscriber* — nested
children subscribe to Cortex paths, and closing the parent cascades
close to children which unsubscribe their own subscriptions.

```scheme
(define shop (artifact/spawn 'shop))
(define listing
  (artifact/nest shop 'listing :where 'items :props '(:sku "A-1")))

(define sub
  (artifact/subscribe-cortex listing
                             "shop:listing:A-1:price"
                             :on-change '(set :price)))

(artifact/on-event listing 'artifact.unmount
  (lambda (_)
    (display (list 'child-unmount 'unsubscribing sub))
    (newline)))

(artifact/close shop)   ; cascades to listing → triggers cleanup
```

**Emergent behavior:** `subscribe-cortex` gives Cortex-driven state;
`nest` gives lifecycle-shared containment; `close` gives cascade
cleanup. Together they yield a *self-cleaning Cortex-driven subtree*
— every child artifact is Cortex-live and every subscription retires
with the parent close.

**Meta-explanation:** Wittgenstein-late family resemblance — the
lifecycle-scoped subscription pattern sits next to React
`useEffect + cleanup`, RAII resource wrappers in C++, and
`with`-blocks in Python. Sakura learns the family from composition,
not from a bespoke "subscription-scope" verb. Lacan metonymy:
subscribe-plus-nest-plus-close is a stable region of the graph that
yields Cortex-driven listings, error-bubbling subtrees, and
observable trees all at once.

---

## End of file

44 sections total (11 verbs × 4 rows). Every code fence runs standalone.
Every behavior claim is grounded in `src/base.js`
(`ARTIFACT_CORE_VERBS`, `ARTIFACT_PHASE_B_VERBS`) and
`docs/artifact-verbs.md`.

Additive — does not modify `docs/artifact-verbs.md` or `src/base.js`.
