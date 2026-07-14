// ask-sakura.js — the Ask Sakura widget.
//
// Ctrl-K opens a modal. User types a natural-language question. On
// Enter, we resolve to a suggested Scheme expression and insert at
// the cursor.
//
// Resolution passes (in order — first hit wins):
//   1. Exact verb-name match → real verb signature (first example if any)
//   2. Verb-name prefix / substring match → first ranked verb
//   3. Verb-summary keyword scan → verb whose summary/library best matches
//   4. Static keyword map → canned code for common intents
//   5. Fallback → an ask-comment with the raw query
//
// Pass 3 is the Round-2 upgrade: instead of a canned response, we walk
// the reference SLAT looking for verbs whose summary contains one of
// the query's content words (stop-words stripped). This surfaces
// "draw a circle" → `(circle 50 50 20)` even when the user never types
// "circle" verbatim, and picks up e.g. "make a queue" → `(ops/mm1 …)`
// via the queue-theory summary.
//
// The resolve() function receives the verb-completions index and
// returns a string to insert (or null).

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'you', 'we', 'they', 'it', 'this', 'that',
  'is', 'are', 'was', 'be', 'been', 'to', 'of', 'in', 'on', 'at',
  'for', 'from', 'with', 'by', 'and', 'or', 'but', 'if', 'so',
  'how', 'what', 'why', 'when', 'where', 'do', 'does', 'did',
  'can', 'could', 'would', 'should', 'my', 'your', 'me', 'us',
  'please', 'want', 'need', 'make', 'give', 'show', 'get', 'have',
])

const KEYWORD_MAP = [
  // [regex, template]  — template is what we insert if the regex matches
  [/hello|greet|hi\b/i,          '(display "Hello, world!\\n")'],
  [/random|dice|roll/i,          '(random-integer 1 6)'],
  [/list|collection|series/i,    '(list 1 2 3)'],
  [/circle|draw|paint/i,         '(circle 50 50 20)'],
  [/rectangle|square/i,          '(rectangle 10 10 40 30)'],
  [/count|length|size/i,         '(length (list 1 2 3))'],
  [/sum|add|total/i,             '(+ 1 2 3)'],
  [/sin|sine|wave/i,             '(tick/sine 30 60 1 0)'],
  [/ease|animate/i,              '(tick/ease "ease-in-quad" 0.5)'],
  [/matrix/i,                    '(matrix/* (list (list 1 2)(list 3 4)) (list (list 5 6)(list 7 8)))'],
  [/permutation|choose|combinatoric/i, '(comb/choose 5 2)'],
  [/stats?|standard[- ]deviation/i,    '(stat/sd (list 1 2 3 4 5))'],
  [/factor|prime/i,              '(alg/zn-units 12)'],
  [/queue|little/i,              '(ops/mm1 5 10)'],
  [/eoq|inventory/i,             '(ops/eoq 1000 50 2)'],
  [/entity|sprite|character/i,   '(entity/make (quote hero) 40 40)'],
  [/beat|drum/i,                 '(beat/on 1 4)'],
  [/note|pitch/i,                '(note/strike "C4" 0.5)'],
  [/nim|game/i,                  '(game/nim-sum 3 5 7)'],
  [/cortex|memory|remember/i,    '(cortex/write "key" "value")'],
  [/recall|lookup/i,             '(cortex/read "key")'],
  [/loop|iterate|for.each/i,     '(for-each (lambda (x) (display x)) (list 1 2 3))'],
  [/define|function|fn\b/i,      '(define (name x) x)'],
  [/lambda|anonymous/i,          '(lambda (x) x)'],
  [/condition|branch|if/i,       '(if (positive? x) "yes" "no")'],
]

export function openAskSakura(state) {
  return {
    query: '',
    resolve(verbs) {
      const q = this.query.trim()
      if (!q) return null

      // Pass 1: exact verb-name match
      const exact = verbs.lookup ? verbs.lookup(q) : null
      if (exact && exact.example && exact.example.code) return exact.example.code
      if (exact && exact.sig) return `(${exact.name}${sigArgs(exact.sig)})`

      // Pass 2: prefix / substring match
      const matches = verbs.match(q)
      if (matches.length > 0) {
        const first = matches[0]
        if (first.example && first.example.code) return first.example.code
        return `(${first.name}${sigArgs(first.sig)})`
      }

      // Pass 3: content-word scan over verb summaries
      const words = q.toLowerCase().split(/[^a-z0-9/-]+/).filter(w => w && !STOP_WORDS.has(w) && w.length > 2)
      if (words.length > 0 && verbs.lookup) {
        let best = null
        let bestScore = 0
        for (const name of verbs.names) {
          const meta = verbs.lookup(name)
          if (!meta) continue
          const hay = ((meta.summary || '') + ' ' + (meta.library || '') + ' ' + name).toLowerCase()
          let score = 0
          for (const w of words) {
            if (hay.includes(w)) score += 10
            // Boost for verb-name substring match
            if (name.toLowerCase().includes(w)) score += 5
            // Boost for library match
            if (meta.library && meta.library.toLowerCase() === w) score += 20
          }
          if (score > bestScore) { bestScore = score; best = meta }
        }
        if (best && bestScore >= 10) {
          if (best.example && best.example.code) return best.example.code
          return `(${best.name}${sigArgs(best.sig)})`
        }
      }

      // Pass 4: static keyword map
      for (const [re, tpl] of KEYWORD_MAP) {
        if (re.test(q)) return tpl
      }

      // Pass 5: fallback — comment marker with the query
      return `; ask: ${q}\n`
    },
  }
}

function sigArgs(sig) {
  if (!sig) return ''
  // sig looks like "(name arg1 arg2 …) → out"; extract just the arg list
  const m = String(sig).match(/^\(\S+\s*([^)]*)\)/)
  if (!m) return ''
  const args = m[1].split(/\s+/).filter(Boolean).map(a => a.replace(/[[\]]/g, '')).map(() => '_')
  return args.length ? ' ' + args.join(' ') : ''
}
