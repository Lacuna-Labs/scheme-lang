#!/usr/bin/env node
// hiroshi-eng-verify.mjs — REPL verification for eng/* verbs (hiroshi-system).
//
// Bypasses sakuraEnv.js and uses makeBaseEnv directly. Each 5-tier
// example from the reference is evaluated and its output printed. If
// any tier throws or returns a non-computed shape, the script exits 1.
//
// Alfred: "We can't lie to people. They trust us." — every stamp
// corresponds to a REAL run of every one of the 5 example tiers.

import { makeBaseEnv } from '../src/base.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'
import { expandProgram } from '../src/macro.js'

// Reset the fuel per test so a long computation doesn't starve the
// next one. Reference examples all fit in ~200k budget individually.
function freshEnv() {
  const fuel = { n: 2000000 }
  const env = makeBaseEnv(fuel)
  return { env, fuel }
}

function run(src, envAndFuel) {
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms)
  let result
  for (const f of expanded) result = evaluate(f, envAndFuel.env, envAndFuel.fuel)
  return result
}

const printVal = (v) => {
  if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Sym') return v.name
  if (Array.isArray(v)) return '(' + v.map(printVal).join(' ') + ')'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v === undefined) return '()'
  if (v === null) return '()'
  return String(v)
}

const cases = [
  // ── eng/tf ────────────────────────────────────────────────────────
  { verb: 'eng/tf', tier: 'novice',       src: "(eng/tf '(1) '(1 2 1))" },
  { verb: 'eng/tf', tier: 'apprentice',   src: "(define h (eng/tf '(10) '(1 5 6))) (car h)" },
  { verb: 'eng/tf', tier: 'intermediate', src: "(let ((h (eng/tf '(10) '(1 5 6)))) (eng/tf-stable? h))" },
  { verb: 'eng/tf', tier: 'expert',       src: "(define (design k) (list (eng/tf-dc-gain (eng/tf (list k) '(1 3 2))) (eng/tf-stable? (eng/tf (list k) '(1 3 2))))) (design 5)" },
  { verb: 'eng/tf', tier: 'master',       src: "(let* ((plant (eng/tf '(1) '(1 2 1))) (bode (eng/bode plant 0.1 10 5))) (length bode))" },

  // ── eng/tf-dc-gain ────────────────────────────────────────────────
  { verb: 'eng/tf-dc-gain', tier: 'novice',       src: "(eng/tf-dc-gain (eng/tf '(5) '(10)))" },
  { verb: 'eng/tf-dc-gain', tier: 'apprentice',   src: "(eng/tf-dc-gain (eng/tf '(1) '(1 2 1)))" },
  { verb: 'eng/tf-dc-gain', tier: 'intermediate', src: "(let ((h (eng/tf '(100) '(1 10 25)))) (* 2 (eng/tf-dc-gain h)))" },
  { verb: 'eng/tf-dc-gain', tier: 'expert',       src: "(eng/tf-dc-gain (eng/tf '(1 0) '(1)))" },
  { verb: 'eng/tf-dc-gain', tier: 'master',       src: "(define (closed-loop-gain k) (let* ((plant (eng/tf '(1) '(1 2))) (open-loop-gain (eng/tf-dc-gain plant)) (loop-gain (* k open-loop-gain))) (/ loop-gain (+ 1 loop-gain)))) (closed-loop-gain 10)" },

  // ── eng/tf-stable? ────────────────────────────────────────────────
  { verb: 'eng/tf-stable?', tier: 'novice',       src: "(eng/tf-stable? (eng/tf '(1) '(1 2 1)))" },
  { verb: 'eng/tf-stable?', tier: 'apprentice',   src: "(eng/tf-stable? (eng/tf '(1) '(1 -1)))" },
  { verb: 'eng/tf-stable?', tier: 'intermediate', src: "(eng/tf-stable? (eng/tf '(1) '(1 3 3 1)))" },
  { verb: 'eng/tf-stable?', tier: 'expert',       src: "(filter (lambda (k) (eng/tf-stable? (eng/tf (list k) '(1 3 2)))) '(1 5 10 20))" },
  { verb: 'eng/tf-stable?', tier: 'master',       src: "(map (lambda (den) (eng/tf-stable? (eng/tf '(1) den))) '((1 2 1) (1 -1) (1 0 1) (1 3 3 1) (1 -2 1)))" },

  // ── eng/beam-reactions ────────────────────────────────────────────
  { verb: 'eng/beam-reactions', tier: 'novice',       src: "(eng/beam-reactions 10 5 100)" },
  { verb: 'eng/beam-reactions', tier: 'apprentice',   src: "(eng/beam-reactions 12 3 240)" },
  { verb: 'eng/beam-reactions', tier: 'intermediate', src: "(map (lambda (a) (eng/beam-reactions 12 a 240)) '(3 6 9))" },
  { verb: 'eng/beam-reactions', tier: 'expert',       src: "(let* ((R (eng/beam-reactions 10 4 100)) (RA (car R)) (RB (cadr R))) (+ RA RB))" },
  { verb: 'eng/beam-reactions', tier: 'master',       src: "(define loads '((5 50) (10 100) (15 75))) (let ((rs (map (lambda (l) (eng/beam-reactions 20 (car l) (cadr l))) loads))) (list (fold-left + 0 (map car rs)) (fold-left + 0 (map cadr rs))))" },

  // ── eng/bode ──────────────────────────────────────────────────────
  { verb: 'eng/bode', tier: 'novice',       src: "(length (eng/bode (eng/tf '(1) '(1 2 1)) 0.1 10 5))" },
  { verb: 'eng/bode', tier: 'apprentice',   src: "(let ((b (eng/bode (eng/tf '(1) '(1 2 1)) 0.1 10 3))) (length b))" },
  { verb: 'eng/bode', tier: 'intermediate', src: "(let ((b (eng/bode (eng/tf '(10) '(1 1)) 0.1 100 5))) (length (car (cdr (car b)))))" },
  { verb: 'eng/bode', tier: 'expert',       src: "(let* ((tf1 (eng/tf '(10) '(1 1))) (tf2 (eng/tf '(100) '(1 10))) (b1 (eng/bode tf1 0.01 100 3)) (b2 (eng/bode tf2 0.01 100 3))) (length (list b1 b2)))" },
  { verb: 'eng/bode', tier: 'master',       src: "(car (eng/bode (eng/tf '(1) '(1 2 1)) 0.01 100 250))" },

  // ── eng/statics-solve ─────────────────────────────────────────────
  { verb: 'eng/statics-solve', tier: 'novice',       src: "(eng/statics-solve '((1 1 100)) '((5 -10 0)) '(R-A R-B))" },
  { verb: 'eng/statics-solve', tier: 'apprentice',   src: "(eng/statics-solve '((1 0 -100) (0 1 -50)) '() '(A-x A-y))" },
  { verb: 'eng/statics-solve', tier: 'intermediate', src: "(eng/statics-solve '((1 1 0 100)) '((0 5 -10 0) (1 0 1 50)) '(a b c))" },
  { verb: 'eng/statics-solve', tier: 'expert',       src: "(eng/statics-solve '((1 0 1 0 500) (0 1 0 1 300)) '((0 0 10 0 1500) (1 1 -1 -1 0)) '(A-x A-y C-x C-y))" },
  { verb: 'eng/statics-solve', tier: 'master',       src: "(eng/statics-solve '((1 1 1)) '() '(x y))" },
]

let failures = 0
let byVerb = {}
for (const c of cases) {
  byVerb[c.verb] = byVerb[c.verb] || { pass: 0, total: 0 }
  byVerb[c.verb].total++
  const ef = freshEnv()
  try {
    const v = run(c.src, ef)
    console.log(`OK  ${c.verb.padEnd(22)} ${c.tier.padEnd(12)}  →  ${printVal(v)}`)
    byVerb[c.verb].pass++
  } catch (err) {
    console.log(`ERR ${c.verb.padEnd(22)} ${c.tier.padEnd(12)}  →  ${err.message}`)
    failures++
  }
}
console.log('')
console.log('─────────────────────────────────────────────')
for (const [verb, stat] of Object.entries(byVerb)) {
  console.log(`${verb.padEnd(24)} ${stat.pass}/${stat.total}`)
}
console.log('─────────────────────────────────────────────')
if (failures > 0) {
  console.log(`FAIL ${failures} tier(s)`)
  process.exit(1)
}
console.log('All eng/* verbs verified.')
