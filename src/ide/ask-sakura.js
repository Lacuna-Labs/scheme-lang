// ask-sakura.js — the Ask Sakura widget.
//
// Ctrl-K opens a modal. User types a natural-language question. On
// Enter, we resolve to a suggested Scheme expression and insert at
// the cursor.
//
// v0.0 resolution — a small in-file mapper looks at keywords in the
// query and picks the closest matching verb + a canned invocation.
// It's not real inference; it's a placeholder that gets the WORKFLOW
// right so the hosted mini-Sakura can drop in later without changing
// any calling code.
//
// The resolve() function receives the verb-completions index and
// returns a string to insert (or null).

const KEYWORD_MAP = [
  // [regex, template]  — template is what we insert if the regex matches
  [/hello|greet|hi/i,           '(display "Hello, world!\\n")'],
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
]

export function openAskSakura(state) {
  return {
    query: '',
    resolve(verbs) {
      const q = this.query.trim()
      if (!q) return null
      // First, if the query is literally a verb name (or partial), return
      // the completion.
      const matches = verbs.match(q)
      if (matches.length > 0) {
        const first = matches[0]
        return `(${first.name}${first.sig ? ' ' + placeholderArgs(first.sig) : ''})`
      }
      // Keyword mapping
      for (const [re, tpl] of KEYWORD_MAP) {
        if (re.test(q)) return tpl
      }
      // Fallback: return a comment marker with the query
      return `; ask: ${q}\n`
    },
  }
}

function placeholderArgs(sig) {
  // sig looks like "(name arg1 arg2 …)"; extract args, return placeholder
  const m = sig.match(/^\(\S+\s*(.*?)\)/)
  if (!m) return ''
  return m[1].split(/\s+/).filter(Boolean).map(() => '_').join(' ')
}
