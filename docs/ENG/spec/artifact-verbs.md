# Artifact verbs

The artifact system exposes a small, versioned set of Scheme verbs under
the `artifact/` namespace. Every capability Sakura Scheme has for
driving an artifact is a verb — JS is implementation, this document is
the reference.

Two phases have shipped on `main`:

- **Phase A** (PRs #26/#27/#28/#29/#39) — the eight core verbs:
  `spawn` · `describe` · `apply` · `read` · `on-event` · `at-location`
  · `close` · `list`. Every mounted artifact is driven through these.
- **Phase B** (this PR) — three verbs that unlock composition,
  recursion, and the Cortex return path: `compose` · `nest` ·
  `subscribe-cortex`.

The metadata roster lives in `src/base.js` as
`ARTIFACT_CORE_VERBS` (Phase A) and `ARTIFACT_PHASE_B_VERBS` (Phase B).
Tooling, RAG indexers, and the docs emitter enumerate the API from
these constants — the interpreter sees stubs in a headless env; the
browser wires the real implementations via `installArtifactVerbs`.

## Phase A — core verbs

See `docs/SAKURA-SCHEME-BOOK.md` and the ontology in
`research/lacuna-docs/specs/artifact-verb-ontology-2026-07-10.md` for
per-verb contracts. Every Phase-A verb was already reachable from a
mounted HelloSurface at the time this document was authored.

## Phase B — compose, nest, subscribe-cortex

### `artifact/compose`

- **arity:** `(primitives . kwargs)` — kwargs include `:chrome`,
  `:state`, `:type`, `:frosting`
- **perm:** `state-change`
- **returns:** `id` (string, e.g. `"composed-4"`)
- **contract:**
  - `primitives` is a list of primitive nodes. Each node is either a
    symbol/string naming the primitive, or a list whose head is the
    primitive name and whose tail is an alist of `:keyword value`
    bindings.
  - `:chrome` — optional composition-level chrome (e.g. `'clean-surface`).
  - `:state` — optional initial state. Accepts a state datum, a plain
    JS object, an alist, or a flat plist.
  - `:type` — optional taxonomy tag (default `"composed"`).
  - Emits `artifact.composed` on spawn, alongside the normal
    `artifact.mount`.
  - The default reducer handles `(set :field value)` and
    `(update alist)`; every other form is a no-op that returns the
    same state ref (no unnecessary re-render).
- **edge cases:**
  - Passing a non-list `primitives` argument throws
    `[artifact/compose] primitives must be a list`.
  - An empty primitives list spawns an artifact with a zero-primitive
    tree — technically legal, useful for a state-only artifact.

**Novice.**

```scheme
(artifact/compose (list 'heading 'paragraph)
                  :chrome 'clean-surface
                  :state '(:title "Hi"))
```

**Intermediate.**

```scheme
(artifact/compose (list (list 'heading :level 1)
                        'markdown-body)
                  :chrome 'clean-surface
                  :state '(:title "Cases" :body "…"))
```

**Expert.**

```scheme
(let ((id (artifact/compose
            (list 'chat-log 'input-row)
            :chrome 'clean-surface
            :state '(:messages ()))))
  (artifact/apply id '(set :messages (list "hi"))))
```

### `artifact/nest`

- **arity:** `(parent-id child . kwargs)` — kwargs include `:where`,
  `:props`
- **perm:** `state-change`
- **returns:** `child-id` (string; format `parent-id:nested-N`)
- **contract:**
  - `parent-id` must reference a live artifact.
  - `child` is a symbol/string naming a registered composition, OR a
    composition object (as produced inline).
  - `:where slot` — the named slot on the parent. Default `'default`.
  - `:props alist` — merged into the child's initial state.
  - Emits `artifact.nested` on the parent when the child mounts.
  - Every child event (mount, dispatch, state, unmount, …) is forwarded
    onto the parent's event stream under the kind
    `child.<child-id>.<original-kind>`. Subscribers on the parent
    observe the whole subtree without needing to know child ids in
    advance.
  - `nestedChildrenOf(parent-id)` returns
    `[ { slot, childId }, … ]` for describe extensions + tests.
- **edge cases:**
  - Unknown parent → `[artifact/nest] unknown parent '…'`.
  - Unknown child composition name →
    `[artifact/nest] unknown child composition '…'`.
  - Nested address syntax: `parent-id:slot:child-id`. Callers that
    walk multi-level trees compose this recursively.

**Novice.**

```scheme
(artifact/nest shop-1 'listing
               :where 'items
               :props '(:sku "A-1"))
```

**Intermediate.**

```scheme
(artifact/nest shop-1 'listing :where 'items :props '(:sku "A-1"))
(artifact/nest shop-1 'listing :where 'items :props '(:sku "A-2"))
(artifact/nest shop-1 'listing :where 'items :props '(:sku "A-3"))
```

**Expert.**

```scheme
(let ((child (artifact/nest shop-1 'review-form
                            :where 'reviews
                            :props '(:for "A-1"))))
  (artifact/on-event shop-1 'child.*
    (lambda (rec) (display rec))))
```

### `artifact/subscribe-cortex`

- **arity:** `(artifact-id cortex-path :on-change form)`
- **perm:** `read`
- **returns:** `subscription-id` (string; format `cortex-sub-N`)
- **contract:**
  - `artifact-id` must reference a live artifact.
  - `cortex-path` is a colon-separated address inside the Cortex
    graph. `*` at any segment matches any single segment; a bare `*`
    matches everything.
  - `:on-change form` — a verb-form dispatched when a matching change
    is published. The incoming change value is appended to the form's
    argument list, so a subscription with `:on-change '(set :price)`
    dispatches `(set :price <value>)` on the artifact.
  - Emits `artifact.cortex-subscribed` at registration time.
  - `unsubscribeCortex(sub-id)` removes the binding (returns `#t` on
    success, `#f` if the id is unknown or already removed).
  - `cortexSubscriptionsFor(artifact-id)` enumerates every live
    subscription belonging to an artifact.
- **edge cases:**
  - Unknown artifact →
    `[artifact/subscribe-cortex] unknown artifact '…'`.
  - Missing `:on-change` →
    `[artifact/subscribe-cortex] :on-change verb-form is required`.
  - The Cortex bridge is a lightweight fan-out. Any adapter that calls
    `publishCortexChange(path, value)` (from
    `site/apps/hello-surface/artifact/cortex-bridge.js`) feeds every
    matching subscriber. Real Cortex integration lands in a follow-up
    lane.

**Novice.**

```scheme
(artifact/subscribe-cortex chat-1
                           "cortex:message:*"
                           :on-change '(refresh))
```

**Intermediate.**

```scheme
(artifact/subscribe-cortex shop-1
                           "shop:listing:*:price"
                           :on-change '(reprice))
```

**Expert.**

```scheme
(let ((sub (artifact/subscribe-cortex
             chat-1
             "cortex:*"
             :on-change '(update-from-cortex))))
  sub)   ; keep the id so the artifact can unsubscribe on close
```

## Notes

- Phase-B verbs share the Phase-A dispatch registry, event stream, and
  state helpers. Nothing about `describe`, `apply`, `read`, `on-event`,
  `close`, or `list` changes — they observe composed and nested
  artifacts exactly like any other.
- Every Phase-B verb ships a headless stub in `src/base.js` so tooling
  can enumerate the API before a browser mounts. The stub throws a
  legible error mentioning `installArtifactVerbs` if called in a
  headless env; the browser wires the real implementation.
- The Cortex bridge is intentionally minimal — path fan-out plus a
  short ring buffer for tests. When richer Cortex machinery lands
  (see PR #52 T-10), the bridge stays the same and adapters point
  their existing publish paths at it.
