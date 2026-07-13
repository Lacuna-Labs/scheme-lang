// verbInfo.js — source of truth for `,help <verb>` in the REPL.
//
// Merges three sources:
//
//   1. Live env bindings — every JS primitive or Scheme lambda the REPL
//      knows about. Arity comes from `Function.length` or `Closure.params`.
//      Type = 'primitive' | 'closure' | 'value'.
//
//   2. Static verb doc-table — hand-authored short docstrings + examples
//      for the core vocabulary. Lives inline below so `,help` works with
//      zero setup and no filesystem reads.
//
//   3. Verb-metadata registry — the perm-tier / rate-limit / schema data
//      the dispatcher uses (loaded from src/registry.js). Optional; only
//      present for verbs the Curator security layer knows about.
//
// The reference manual SLATs are the DEEP source (900+ verbs, 3 examples
// each — see scheme-lang/docs/SAKURA-SCHEME-1.0.REF.md). Loading the full
// reference on REPL start would cost startup latency; instead we hand-
// author short docs for ~120 core verbs here, and `,source <verb>` /
// `,search <regex>` reach into the reference file on demand.

import { Sym } from '../reader.js'

// ── the static doc-table ─────────────────────────────────────────────
// Format: name → { sig, doc, examples: [novice, intermediate, expert] }
// Kept small so the whole thing fits in memory at REPL start; expanded
// on-demand from the reference doc when `,help` misses.

export const CORE_DOCS = Object.freeze({
  // arithmetic
  '+':        { sig: '(+ n …)',                        doc: 'Sum of numbers. Zero args → 0.',
                examples: ['(+ 1 2)  ; → 3', '(+ 1 2 3 4)  ; → 10', '(apply + (range 1 11))  ; → 55'] },
  '-':        { sig: '(- n) or (- n m …)',             doc: 'Subtraction. One arg → negate. More → left-fold.',
                examples: ['(- 5 2)  ; → 3', '(- 10)  ; → -10', '(- 100 10 20)  ; → 70'] },
  '*':        { sig: '(* n …)',                        doc: 'Product. Zero args → 1.',
                examples: ['(* 2 3)  ; → 6', '(* 2 3 4)  ; → 24', '(apply * (range 1 6))  ; → 120'] },
  '/':        { sig: '(/ n) or (/ n m …)',             doc: 'Division. One arg → reciprocal. Careful with 0.',
                examples: ['(/ 10 2)  ; → 5', '(/ 4)  ; → 0.25', '(/ 100 5 2)  ; → 10'] },
  'modulo':   { sig: '(modulo x y)',                   doc: 'Sign of divisor. Handy for wrapping indices.',
                examples: ['(modulo 10 3)  ; → 1', '(modulo -1 3)  ; → 2', '(modulo (* n 7) 12)'] },
  'quotient': { sig: '(quotient x y)',                 doc: 'Integer division, truncated toward zero.',
                examples: ['(quotient 10 3)  ; → 3', '(quotient -10 3)  ; → -3', ''] },
  'max':      { sig: '(max n …)',                      doc: 'Largest of its arguments.',
                examples: ['(max 3 1 4)  ; → 4', '(apply max scores)', '(max 0 (- x 1))  ; clamp low'] },
  'min':      { sig: '(min n …)',                      doc: 'Smallest of its arguments.',
                examples: ['(min 3 1 4)  ; → 1', '(min upper (+ x 1))  ; clamp high', ''] },
  'abs':      { sig: '(abs x)',                        doc: 'Absolute value.',
                examples: ['(abs -7)  ; → 7', '(< (abs (- a b)) epsilon)', ''] },

  // predicates
  '=':        { sig: '(= a b)',                        doc: 'Numeric equality.',
                examples: ['(= 3 3)  ; → #t', '(if (= x 0) "zero" "not")', ''] },
  '<':        { sig: '(< a b)',                        doc: 'Less than.',
                examples: ['(< 1 2)  ; → #t', '(filter (lambda (x) (< x 10)) xs)', ''] },
  '>':        { sig: '(> a b)',                        doc: 'Greater than.',
                examples: ['(> 5 3)  ; → #t', '(sort xs >)  ; descending', ''] },
  '<=':       { sig: '(<= a b)',                       doc: 'Less-or-equal.',
                examples: ['(<= x 100)', '(and (<= 0 x) (<= x 1))', ''] },
  '>=':       { sig: '(>= a b)',                       doc: 'Greater-or-equal.',
                examples: ['(>= age 18)', '', ''] },
  'not':      { sig: '(not x)',                        doc: 'Logical negation. Only #f is false.',
                examples: ['(not #f)  ; → #t', '(filter (lambda (x) (not (null? x))) xs)', ''] },
  '=?':       { sig: '(=? a b)',                       doc: 'Smart equality — numbers/strings/lists/symbols DWIM.',
                examples: ['(=? \'(1 2) \'(1 2))  ; → #t', '(=? "cat" "cat")  ; → #t', ''] },
  'null?':    { sig: '(null? x)',                      doc: 'True on the empty list ().',
                examples: ['(null? \'())  ; → #t', '(null? \'(1))  ; → #f', ''] },
  'pair?':    { sig: '(pair? x)',                      doc: 'True on a non-empty list.',
                examples: ['(pair? \'(a b))  ; → #t', '(pair? \'())  ; → #f', ''] },
  'number?':  { sig: '(number? x)',                    doc: 'True if x is a number.', examples: [] },
  'string?':  { sig: '(string? x)',                    doc: 'True if x is a string.', examples: [] },
  'symbol?':  { sig: '(symbol? x)',                    doc: 'True if x is a symbol.', examples: [] },
  'procedure?': { sig: '(procedure? x)',               doc: 'True if x is callable.', examples: [] },

  // list ops
  'list':     { sig: '(list x …)',                     doc: 'Build a list from its arguments.',
                examples: ['(list 1 2 3)  ; → (1 2 3)', '(list)  ; → ()', ''] },
  'cons':     { sig: '(cons head tail)',               doc: 'Prepend head to tail. tail must be a list.',
                examples: ['(cons 1 \'(2 3))  ; → (1 2 3)', '(cons \'a \'())  ; → (a)', ''] },
  'car':      { sig: '(car lst)',                      doc: 'Head of a non-empty list.',
                examples: ['(car \'(a b c))  ; → a', '', ''] },
  'cdr':      { sig: '(cdr lst)',                      doc: 'Tail — everything after the head.',
                examples: ['(cdr \'(a b c))  ; → (b c)', '', ''] },
  'length':   { sig: '(length lst)',                   doc: 'Number of elements in a list.',
                examples: ['(length \'(a b c))  ; → 3', '(length \'())  ; → 0', ''] },
  'range':    { sig: '(range a b)',                    doc: 'Half-open [a,b) as a list.',
                examples: ['(range 0 5)  ; → (0 1 2 3 4)', '(map (lambda (i) (* i i)) (range 1 6))', ''] },
  'map':      { sig: '(map fn lst)',                   doc: 'Apply fn to each element, return list of results.',
                examples: ['(map (lambda (x) (* x 2)) \'(1 2 3))  ; → (2 4 6)',
                           '(map car \'((a 1) (b 2)))  ; → (a b)',
                           '(map + xs ys)  ; parallel'] },
  'filter':   { sig: '(filter pred? lst)',             doc: 'Elements for which pred? is not #f.',
                examples: ['(filter odd? \'(1 2 3 4 5))  ; → (1 3 5)',
                           '(filter (lambda (x) (> x 0)) xs)', ''] },
  'reduce':   { sig: '(reduce fn init lst)',           doc: 'Left-fold. `(fn (fn (fn init x0) x1) x2) …`.',
                examples: ['(reduce + 0 \'(1 2 3 4))  ; → 10',
                           '(reduce max 0 scores)  ; → best',
                           '(reduce (lambda (acc x) (cons x acc)) \'() lst)  ; reverse'] },
  'for-each': { sig: '(for-each fn lst)',              doc: 'Apply fn for side effect. Returns nothing meaningful.',
                examples: ['(for-each display lst)', '', ''] },
  'apply':    { sig: '(apply fn args)',                doc: 'Call fn with list `args` as its argument list.',
                examples: ['(apply + \'(1 2 3))  ; → 6', '(apply max scores)', ''] },
  'append':   { sig: '(append lst …)',                 doc: 'Concatenate lists.',
                examples: ['(append \'(1 2) \'(3 4))  ; → (1 2 3 4)', '', ''] },
  'reverse':  { sig: '(reverse lst)',                  doc: 'Elements in reverse order.',
                examples: ['(reverse \'(a b c))  ; → (c b a)', '', ''] },
  'sort':     { sig: '(sort lst less?)',               doc: 'Sorted copy. `less?` is the comparator.',
                examples: ['(sort \'(3 1 2) <)  ; → (1 2 3)', '(sort names string<?)', ''] },

  // strings
  'string-append':  { sig: '(string-append s …)',      doc: 'Concatenate strings.',
                      examples: ['(string-append "hi " "there")  ; → "hi there"', '', ''] },
  'string-length':  { sig: '(string-length s)',        doc: 'Character count.',
                      examples: ['(string-length "hello")  ; → 5', '', ''] },
  'string->number': { sig: '(string->number s)',       doc: 'Parse to number, or #f on failure.',
                      examples: ['(string->number "42")  ; → 42', '(string->number "oops")  ; → #f', ''] },
  'number->string': { sig: '(number->string n)',       doc: 'Format number as string.',
                      examples: ['(number->string 3.14)  ; → "3.14"', '', ''] },
  'substring':      { sig: '(substring s a b)',        doc: 'Half-open [a,b) slice.',
                      examples: ['(substring "hello" 1 4)  ; → "ell"', '', ''] },

  // math
  'sqrt':     { sig: '(sqrt x)',    doc: 'Square root.',        examples: ['(sqrt 16)  ; → 4', '', ''] },
  'sin':      { sig: '(sin x)',     doc: 'Sine (radians).',     examples: ['(sin (/ pi 2))  ; → 1', '', ''] },
  'cos':      { sig: '(cos x)',     doc: 'Cosine (radians).',   examples: ['(cos 0)  ; → 1', '', ''] },
  'tan':      { sig: '(tan x)',     doc: 'Tangent (radians).',  examples: [] },
  'expt':     { sig: '(expt b e)',  doc: 'b to the e-th power.', examples: ['(expt 2 10)  ; → 1024', '', ''] },
  'floor':    { sig: '(floor x)',   doc: 'Round toward -∞.',    examples: ['(floor 3.7)  ; → 3', '', ''] },
  'ceiling':  { sig: '(ceiling x)', doc: 'Round toward +∞.',    examples: ['(ceiling 3.2)  ; → 4', '', ''] },
  'round':    { sig: '(round x)',   doc: 'Nearest integer.',    examples: ['(round 2.5)  ; → 3', '', ''] },
  'pi':       { sig: 'pi',          doc: 'The number π.',       examples: ['(* 2 pi r)  ; circumference', '', ''] },

  // special forms
  'define':   { sig: '(define name val) OR (define (name . args) body …)',
                doc: 'Bind a name in the current environment.',
                examples: ['(define x 42)', '(define (square n) (* n n))', '(define (fact n) (if (< n 2) 1 (* n (fact (- n 1)))))'] },
  'lambda':   { sig: '(lambda (params …) body …)',
                doc: 'Make a procedure.',
                examples: ['(lambda (x) (* x x))',
                           '((lambda (x y) (+ x y)) 3 4)  ; → 7',
                           '(define add (lambda (a b) (+ a b)))'] },
  'if':       { sig: '(if test then else?)',
                doc: 'Conditional. `else` is optional.',
                examples: ['(if (> x 0) "positive" "not")',
                           '(if empty? default (car lst))', ''] },
  'let':      { sig: '(let ((name val) …) body …)',
                doc: 'Local bindings.',
                examples: ['(let ((x 1) (y 2)) (+ x y))  ; → 3',
                           '(let ((n (length lst))) (if (> n 0) (car lst) #f))', ''] },
  'let*':     { sig: '(let* ((name val) …) body …)',
                doc: 'Sequential bindings — each sees the ones before.',
                examples: ['(let* ((x 1) (y (+ x 1))) y)  ; → 2', '', ''] },
  'cond':     { sig: '(cond (test body …) … (else body …))',
                doc: 'Multi-way conditional.',
                examples: ['(cond ((< x 0) "neg") ((= x 0) "zero") (else "pos"))', '', ''] },
  'when':     { sig: '(when test body …)',
                doc: 'Run body when test is not #f.',
                examples: ['(when (>= score 100) (celebrate))', '', ''] },
  'quote':    { sig: "(quote datum) OR 'datum",
                doc: 'Return the datum literally.',
                examples: ["'foo  ; → foo", "'(1 2 3)  ; → (1 2 3)", ''] },
  'begin':    { sig: '(begin expr …)',
                doc: 'Evaluate in sequence, return last.',
                examples: ['(begin (display "hi") (newline) 42)', '', ''] },

  // ── L1 MEDIA — framebuffer, drawing, sound, animation, input ──────
  'set-mode': { sig: '(set-mode w h) | (set-mode preset)',
                doc: 'Resize the framebuffer. Presets: pico8, tic80, sakura.',
                examples: ['(set-mode 128 128)', "(set-mode 'pico8)", "(set-mode 'tic80)"] },
  'mode-info':{ sig: '(mode-info)',
                doc: 'Return current framebuffer size as (w h).',
                examples: ['(mode-info)  ; → (80 80)', '', ''] },
  'set-color':{ sig: '(set-color n) | (set-color name)',
                doc: 'Set the current draw color. 0..15 or a name.',
                examples: ['(set-color 8)', "(set-color 'petal)", "(set-color 'white)"] },
  'get-color':{ sig: '(get-color)',
                doc: 'Return the current draw color index.',
                examples: ['(get-color)  ; → 14', '', ''] },
  'clear':    { sig: '(clear) | (clear c)',
                doc: 'Wipe the framebuffer to color 0 (or c).',
                examples: ['(clear)', '(clear 12)  ; blue background', ''] },
  'circle':   { sig: '(circle cx cy r)',
                doc: 'Draw an outline circle at (cx,cy) with radius r.',
                examples: ['(circle 40 40 15)', '(circle 20 20 8)', ''] },
  'disc':     { sig: '(disc cx cy r)',
                doc: 'Draw a filled disc at (cx,cy) with radius r.',
                examples: ['(disc 40 40 15)', '(disc 20 20 8)', ''] },
  'line':     { sig: '(line x0 y0 x1 y1)',
                doc: 'Draw a line from (x0,y0) to (x1,y1).',
                examples: ['(line 0 0 40 40)', '(line 10 20 60 20)', ''] },
  'rect':     { sig: '(rect x y w h)',
                doc: 'Draw a rectangle outline.',
                examples: ['(rect 5 5 20 15)', '', ''] },
  'rect-fill':{ sig: '(rect-fill x y w h)',
                doc: 'Draw a filled rectangle.',
                examples: ['(rect-fill 5 5 20 15)', '', ''] },
  'plot':     { sig: '(plot data)',
                doc: 'Render a numeric series as a sparkline.',
                examples: ["(plot '(1 3 2 4 5 2 1))", '(plot (map (lambda (x) (* x x)) (range 1 20)))', ''] },
  'pset':     { sig: '(pset x y c)',
                doc: 'Set a single pixel.',
                examples: ['(pset 40 40 8)', '', ''] },
  'pget':     { sig: '(pget x y)',
                doc: 'Read a pixel color index. Out-of-range returns 0.',
                examples: ['(pget 40 40)', '', ''] },
  'render':   { sig: '(render)',
                doc: 'Return a snapshot of the framebuffer. Prints as an image.',
                examples: ['(render)', '', ''] },
  'frame':    { sig: '(frame) | (frame w h shape …)',
                doc: 'Zero args → frame counter. With shapes → composite record.',
                examples: ['(frame)  ; → 0', "(frame 40 40 '(circle 20 20 5))", ''] },
  'frame-rate':{ sig: '(frame-rate)',
                doc: 'Return the target frame rate (fps).',
                examples: ['(frame-rate)  ; → 60', '', ''] },
  'set-frame-rate':{ sig: '(set-frame-rate n)',
                doc: 'Change target FPS. Clamped to 1..120.',
                examples: ['(set-frame-rate 30)', '', ''] },
  'tone':     { sig: '(tone freq dur)',
                doc: 'Play a raw tone at freq Hz for dur seconds.',
                examples: ['(tone 440 0.25)', '(tone 220 1)', ''] },
  'note':     { sig: '(note pitch [dur] [vel])',
                doc: 'Play a musical pitch. Symbol like A4, C#4, Db3.',
                examples: ["(note 'A4)", "(note 'C#4 'quarter 0.8)", "(note 'Db3 0.5 0.5)"] },
  'sfx':      { sig: '(sfx kind freq dur . opts)',
                doc: 'Play a synth effect: pulse, square, saw, sine, triangle. Options as quoted pairs like \':attack 0.01.',
                examples: ["(sfx 'pulse 440 0.3)", "(sfx 'square 220 0.5 ':attack 0.01)", ''] },
  'music':    { sig: '(music track)',
                doc: 'Schedule a named music track.',
                examples: ["(music 'demo)", "(music 'title-theme)", ''] },
  'silence':  { sig: '(silence dur)',
                doc: 'Reserve dur seconds of quiet on the audio timeline.',
                examples: ['(silence 1)', '(silence 0.5)', ''] },
  'stop-sound':{ sig: '(stop-sound)',
                doc: 'Cancel any scheduled audio.',
                examples: ['(stop-sound)', '', ''] },
  'on-frame': { sig: '(on-frame handler)',
                doc: 'Install a per-frame handler. Called ~60Hz by the loop.',
                examples: ['(on-frame (lambda () (circle 40 40 15)))', '', ''] },
  'on-key':   { sig: '(on-key handler)',
                doc: 'Install a keyboard event handler. Handler receives (key-name).',
                examples: ["(on-key (lambda (k) (display k) (newline)))", '', ''] },
  'on-mouse': { sig: '(on-mouse handler)',
                doc: 'Install a mouse event handler. Handler receives (x y button).',
                examples: ['(on-mouse (lambda (x y b) (disc x y 3)))', '', ''] },
  'on-gamepad':{ sig: '(on-gamepad handler)',
                doc: 'Install a gamepad handler. Handler receives (pad button pressed?).',
                examples: ['(on-gamepad (lambda (p b down?) (display down?)))', '', ''] },
  'sync':     { sig: '(sync)',
                doc: 'Yield to the event loop; returns the current frame.',
                examples: ['(sync)', '', ''] },
  'sleep':    { sig: '(sleep sec)',
                doc: 'Busy-wait for at most 5 seconds. For animations use on-frame.',
                examples: ['(sleep 0.1)', '', ''] },
  'stop':     { sig: '(stop)',
                doc: 'Halt the animation loop.',
                examples: ['(stop)', '', ''] },
  'tick-frame':{ sig: '(tick-frame)',
                doc: 'Manually advance the animation loop by one frame.',
                examples: ['(tick-frame)', '', ''] },
  'fire-key': { sig: '(fire-key name)',
                doc: 'Synthesize a key event. Wraps on-key handlers.',
                examples: ["(fire-key 'A)", '', ''] },
  'fire-mouse':{ sig: '(fire-mouse x y button)',
                doc: 'Synthesize a mouse event.',
                examples: ['(fire-mouse 40 40 0)', '', ''] },
  'fire-gamepad':{ sig: '(fire-gamepad pad button pressed?)',
                doc: 'Synthesize a gamepad event.',
                examples: ['(fire-gamepad 0 1 #t)', '', ''] },
  'save-cart':{ sig: '(save-cart path)',
                doc: 'Bundle framebuffer + audio state into a .sks file.',
                examples: ['(save-cart "mygame.sks")', '', ''] },
  'load-cart':{ sig: '(load-cart path)',
                doc: 'Restore state from a .sks cart.',
                examples: ['(load-cart "mygame.sks")', '', ''] },
})

/**
 * verbInfo(env, name) → { name, kind, sig, doc, examples, meta, source? } | null
 *
 * `env` = live REPL environment (interp.js Env).
 * `name` = symbol string.
 */
export function verbInfo(env, name) {
  const doc = CORE_DOCS[name] || null
  let bound = null
  let kind = 'unknown'
  try {
    if (env && typeof env.lookup === 'function') {
      bound = env.lookup(new Sym(name))
    } else if (env && env.vars) {
      // Walk env chain manually.
      let e = env
      while (e) {
        if (e.vars && e.vars.has && e.vars.has(name)) { bound = e.vars.get(name); break }
        e = e.parent
      }
    }
  } catch { /* unbound */ }

  if (bound !== null && bound !== undefined) {
    if (typeof bound === 'function') kind = 'primitive'
    else if (bound && bound.constructor && bound.constructor.name === 'Closure') kind = 'closure'
    else kind = 'value'
  }

  if (!doc && kind === 'unknown') return null

  return {
    name,
    kind,
    sig: doc ? doc.sig : sigFromValue(name, bound),
    doc: doc ? doc.doc : '',
    examples: doc && doc.examples ? doc.examples.filter(Boolean) : [],
    bound,
    meta: null, // filled in by caller if perm registry available
  }
}

function sigFromValue(name, val) {
  if (typeof val === 'function') {
    const argc = val.length
    if (argc === 0) return `(${name})`
    if (argc === 1) return `(${name} x)`
    if (argc === 2) return `(${name} a b)`
    if (argc === 3) return `(${name} a b c)`
    return `(${name} …)`
  }
  if (val && val.params) {
    return `(${name} ${val.params.map(p => p.name || p).join(' ')})`
  }
  return name
}

/**
 * allKnownVerbs(env) → Set<string>
 *
 * Union of doc-table names + every binding in the env chain. Used by
 * autocomplete + `,apropos`.
 */
export function allKnownVerbs(env) {
  const names = new Set(Object.keys(CORE_DOCS))
  let e = env
  while (e) {
    if (e.vars && typeof e.vars.forEach === 'function') {
      e.vars.forEach((_, k) => names.add(k))
    } else if (e.vars && typeof e.vars.keys === 'function') {
      for (const k of e.vars.keys()) names.add(k)
    }
    e = e.parent
  }
  return names
}
