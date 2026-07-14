// snippets.js — canonical snippets for the IDE.
//
// A snippet is a named template — trigger word + expanded body. When
// the user types the trigger and asks for completion, the snippet shows
// up alongside verb completions with a "snippet" marker. Selecting it
// inserts the body at the cursor, with a $CURSOR marker replaced by
// the final caret position (single cursor for v0.0 — no tab-stops yet).
//
// The catalogue below covers the six templates Alfred called out plus
// a small companion set. Keep the list narrow — every snippet is a
// keystroke the kid learns; too many blur the palette.
//
// Adding a snippet: extend SNIPPETS below. `trigger` must be unique.
// `body` uses \n for newlines. Use $CURSOR to mark where the caret
// lands after insertion (v0.0 supports one $CURSOR per snippet; extras
// are stripped).

export const SNIPPETS = Object.freeze([
  {
    trigger: 'cart-scaffold',
    label:   'cart-scaffold — canonical cart shape',
    kind:    'template',
    body: `(define (start ctx)
  (act 'cortex/recall
       (list '(:topic $CURSOR))
       'check-cache))

(define (check-cache ctx)
  (let ((hit (ctx-get 'last-result ctx)))
    (if (null? hit)
        (next 'fetch ctx)
        (next 'render (ctx-set 'data hit ctx)))))

(define (fetch ctx)
  (act 'etsy/receipts (list 'this-week) 'render))

(define (render ctx)
  (list ':summary (ctx-get 'data ctx)))
`,
  },
  {
    trigger: 'verb-template',
    label:   'verb-template — SLAT verb entry (author in reference)',
    kind:    'template',
    body: `(verb
  :name "$CURSOR"
  :library ""
  :kind "read"
  :signature "(verb-name arg1 arg2) → value"
  :summary ""
  :explanation ""
  :examples (
    (:tier "novice"       :code "" :note "")
    (:tier "intermediate" :code "" :note "")
    (:tier "expert"       :code "" :note "")
  )
  :caveats ()
  :drawbacks ()
  :usecases ()
  :related ()
  :learn (:concept "" :prerequisites () :progression ""))
`,
  },
  {
    trigger: 'book-chapter',
    label:   'book-chapter — SLAT book chapter header',
    kind:    'template',
    body: `(chapter
  :title "$CURSOR"
  :epigraph ""
  :prose (
    ""
  )
  :examples (
    (:code "" :note "")
  ))
`,
  },
  {
    trigger: 'define-fn',
    label:   'define-fn — named function',
    kind:    'template',
    body: `(define ($CURSOR arg)
  arg)
`,
  },
  {
    trigger: 'let-binding',
    label:   'let-binding — local variables',
    kind:    'template',
    body: `(let (($CURSOR value))
  )
`,
  },
  {
    trigger: 'hello-world',
    label:   'hello-world — the smallest complete program',
    kind:    'template',
    body: `(display "Hello, world!$CURSOR")
(newline)
`,
  },
  {
    trigger: 'lambda-fn',
    label:   'lambda-fn — anonymous function',
    kind:    'template',
    body: `(lambda ($CURSOR)
  )`,
  },
  {
    trigger: 'cond-branch',
    label:   'cond-branch — multi-way conditional',
    kind:    'template',
    body: `(cond
  (($CURSOR) )
  (else ))
`,
  },
  {
    trigger: 'for-each-list',
    label:   'for-each-list — iterate over a list',
    kind:    'template',
    body: `(for-each
  (lambda (item)
    $CURSOR)
  (list 1 2 3))
`,
  },
])

/**
 * Return the snippet whose trigger exactly matches, or null.
 */
export function findSnippet(trigger) {
  const t = String(trigger || '').trim()
  for (const s of SNIPPETS) if (s.trigger === t) return s
  return null
}

/**
 * Fuzzy-match snippets by trigger prefix or label substring.
 * Returns an array (may be empty), score-sorted.
 */
export function matchSnippets(query) {
  const q = String(query || '').toLowerCase()
  if (!q) return []
  const out = []
  for (const s of SNIPPETS) {
    const tl = s.trigger.toLowerCase()
    const ll = s.label.toLowerCase()
    let score = 0
    if (tl === q) score = 200
    else if (tl.startsWith(q)) score = 150 - (tl.length - q.length)
    else if (tl.includes(q)) score = 100
    else if (ll.includes(q)) score = 60
    if (score > 0) out.push({ snippet: s, score })
  }
  out.sort((a, b) => b.score - a.score)
  return out.map(x => x.snippet)
}

/**
 * Expand a snippet body — strip $CURSOR markers, return
 *   { text, cursorOffset }
 * where cursorOffset is a char index into text (or text.length if no marker).
 */
export function expandSnippet(snippet) {
  const raw = snippet.body || ''
  const idx = raw.indexOf('$CURSOR')
  if (idx < 0) return { text: raw, cursorOffset: raw.length }
  const text = raw.slice(0, idx) + raw.slice(idx + '$CURSOR'.length)
  return { text, cursorOffset: idx }
}
