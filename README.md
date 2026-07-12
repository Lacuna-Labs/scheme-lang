# scheme-lang

A small Scheme for humans and AI to program together.

**One-liner:** the base language + REPL + reference manual + tooling, dialect-neutral, community-forkable.

---

## Install

One line, zero ceremony:

```
curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
```

That drops a `scheme-lang` command onto your PATH. Type `scheme-lang` and you're in a REPL.

**Requirements:** Node 18+ and `git`. That's it.

Prefer to see the code first? Clone it and run in place:

```
git clone https://github.com/Lacuna-Labs/scheme-lang
cd scheme-lang
./bin/scheme-lang
```

Same REPL either way.

**Uninstall:**

```
rm -rf ~/.scheme-lang $(command -v scheme-lang)
```

---

## Beginner — first ten minutes

Type `scheme-lang`. You'll see a pink cherry-blossom banner and a `sakura>` prompt.

Try:

```scheme
sakura> (+ 1 2)
3

sakura> (* 6 7)
42

sakura> (- (* 2 21) (/ 84 2))
0
```

Numbers, arithmetic, exactly what you'd expect. Now name something:

```scheme
sakura> (define greeting "hello")
sakura> greeting
"hello"
```

Lists:

```scheme
sakura> (list 1 2 3 4)
(1 2 3 4)

sakura> (car '(1 2 3))
1

sakura> (cdr '(1 2 3))
(2 3)
```

`car` is the head of the list. `cdr` is everything after. Standard Scheme.

Draw something:

```scheme
sakura> (circle 40 40 15)
```

The REPL fills the screen with stars in the shape of a circle. Try `(disc 40 40 15)` — that one's filled in.

When you're ready to leave, type `,exit` or press `Ctrl-D`. She'll say `goodnight ✿`.

---

## Intermediate — the next hour

Define a function:

```scheme
sakura> (define (square x) (* x x))
sakura> (square 12)
144
```

Higher-order functions:

```scheme
sakura> (map square '(1 2 3 4 5))
(1 4 9 16 25)

sakura> (filter (lambda (x) (> x 10)) '(1 5 12 20 3 44))
(12 20 44)

sakura> (fold + 0 '(1 2 3 4 5 6 7 8 9 10))
55
```

**Named results** — every evaluation remembers the last ten answers as `_`, `_1`, `_2`, …, `_9`:

```scheme
sakura> (+ 1 2)
3
sakura> (* _ 10)
30
```

**Exploration** — the REPL has meta-commands that start with `,`. The exploration crew:

```
,help                       list every command
,help map                   arity + doc + examples for map
,type filter                just the type signature
,doc car                    just the docstring
,arity fold                 just the arity
,examples reduce            three tiered examples
,namespace list             every verb whose name starts with 'list'
,apropos map                symbols whose name matches 'map'
,search apply               regex over docs + examples
,time (map square '(1 2 3 4 5 6 7 8 9 10))
                            wall + fuel + memory
,expand (let ((x 1)) (+ x 2))
                            macroexpand
```

**Save your session** so you can come back to it:

```
sakura> ,save my-session.slat
saved 4 bindings, 12 history entries
```

Later:

```
sakura> ,load my-session.slat
```

Your defines and history come back.

---

## Expert — where it gets fun

**Tail-call recursion** — the interpreter has a trampoline, so deep recursion doesn't blow the stack:

```scheme
sakura> (define (loop n) (if (= n 0) 'done (loop (- n 1))))
sakura> (loop 1000000)
done
```

**Macros** with `syntax-rules`:

```scheme
sakura> (define-syntax when
          (syntax-rules ()
            ((_ test body ...) (if test (begin body ...) #f))))
sakura> (when (> 3 2) (display "yes"))
yes
```

**Trace a function** — see every call with nested indent:

```scheme
sakura> (define (fact n) (if (< n 2) 1 (* n (fact (- n 1)))))
sakura> ,trace fact
sakura> (fact 5)
→ fact(5)
  → fact(4)
    → fact(3)
      → fact(2)
        → fact(1)
        ← fact = 1
      ← fact = 2
    ← fact = 6
  ← fact = 24
← fact = 120
120
sakura> ,untrace fact
```

**Inspect a value** — walk into its structure with arrow keys:

```scheme
sakura> (define tree '((a 1) (b 2) (c (d 3) (e 4)) (f 5)))
sakura> ,inspect tree
```

`↑↓` siblings, `→` descend, `←` ascend, Enter binds focus to `_`, `q` quit.

**Live reload** — edit a `.scm` file in another window; the REPL notices:

```
sakura> ,watch-file ~/experiments/scratch.scm
watching scratch.scm — reloading on save
```

**Paredit** — parse-aware structural editing at the prompt:

- `Alt-]` barf-forward (shrink current form on the right)
- `Alt-\` slurp-forward (grow current form to swallow next form)
- `Alt-[` slurp-backward (grow current form to swallow previous)
- `Alt-K` kill-form (delete the current form)

Type `,paredit` for the current bindings.

**Ask Sakura** (when connected):

```
sakura> ,ask sakura "why is my map returning the wrong shape?"
```

She reads your current session bindings + the last few evaluations + your question, and answers with runnable code you can Enter to eval. Not connected in the base — waiting for her.

**Graphics as a first-class thing** — the shape verbs are real functions:

```scheme
sakura> (map (lambda (n) (list 'circle (* n 12) 20 3))
             '(1 2 3 4 5 6 7 8 9 10))
```

That returns a list of ten circles the display renders as one image. If you're in iTerm2, WezTerm, kitty, or a Sixel terminal, they render as inline images. Everywhere else, Braille. Type `,image` to see what your terminal supports.

---

## Features (short version)

The features you'll actually reach for in a session:

- **Fuzzy tab-complete** — verbs, namespaces, meta-commands. Not just prefix.
- **Ghost signature hints** — as you type `(map ` the row above dims to show arity + arg names + doc summary.
- **Rainbow parens + live syntax highlighting** — matched parens the same color, cycling by depth.
- **Auto-close parens** — type `(`, get `()` with the cursor between. Balanced Enter evaluates; unbalanced Enter adds a line.
- **Multi-line editing** — Shift-Enter always adds a line.
- **Ctrl-R fuzzy history search** — the emacs classic.
- **Ctrl-O opens `$EDITOR`** — write in your real editor, come back to the REPL.
- **Rich display** — number lists render as tables, hash-tables as key-value grids, graphics as stars.
- **20+ meta-commands** — all discoverable via `,help`.

Full guide: [`docs/REPL.md`](docs/REPL.md). Features doc: [`docs/REPL-FEATURES.md`](docs/REPL-FEATURES.md).

---

## Keybindings — emacs default

The default keybindings are emacs-flavored (Ctrl-A, Ctrl-E, Ctrl-K, Ctrl-U, Ctrl-W, Ctrl-R, Ctrl-Y, Alt-B, Alt-F). If you're a vim person, drop this in `~/.scheme-lang/config.slat`:

```
keybindings: vim
```

Now the prompt lands you in insert mode; `Esc` puts you in normal mode with hjkl / w / b / 0 / $ / x / i / a / A / I / o / :q. Full vim lives one keystroke away: `Ctrl-O` opens the current buffer in `$EDITOR`.

Config file supports:

```
;; ~/.scheme-lang/config.slat
keybindings:       emacs       ;; 'emacs | 'vim | 'default
theme:             sakura      ;; 'sakura | 'neutral
auto-close-parens: #t
show-signature:    #t
ghost-hints:       #t
editor:            nvim
history-max:       5000
sakura-endpoint:                ;; unset until she's connected
sakura-token:                   ;; bearer
```

Unknown keys are preserved (so tomorrow's settings can live there today).

---

## What ships in this repo

- **`bin/scheme-lang`** — the launcher. Discovers installed dialects; runs the base if you have nothing else installed.
- **`bin/sakura-scheme`** — the Sakura dialect binary (the base is called "Sakura Scheme" — every fork picks its own name; forks change this line).
- **`src/`** — the language: reader / interpreter / macros / base primitives / verb registry / dispatcher / REPL / launcher.
- **`src/adapters.js`** — no-op adapter stubs. Real dialects override with `setAdapters(…)`.
- **`docs/`** — reference manual, tutorial, engineering doc, style guide, REPL guide, feature showcase.
- **`tests/`** — smoke tests. Zero npm deps; runs on plain `node --test`.

## What lives elsewhere

- **Curator's dialect** (card / shop / sprite / world / flower verbs + adapters) — see `Lacuna-Labs/curator`. Cloning this base plus that gets you the Curator surface.
- **Cross-product engineering docs** (SLAT engineering, WEAVE training procedure, Big Burndown Plan) — see `Lacuna-Labs/lacuna-labs`.
- **Any dialect from anyone else** — the community forks pattern in `TEMPLATE-FOR-FORKS.md`.

## Make your own dialect

See [`TEMPLATE-FOR-FORKS.md`](TEMPLATE-FOR-FORKS.md). The gist: fork this repo, rename in `dialect.json`, add your verbs to `verbs/`, drop your adapters in `adapters/`, and you're a dialect. The REPL discovers you automatically.

---

## Design principles

1. **Nothing in excess.** Every element on screen earns its place by directing your attention somewhere useful. The frame around the code is a frame — nothing more. It exists to guide the eye to the inner frame, which exists to guide the eye to the code. If a layer isn't doing that job, it isn't there.

   Sixteen solid colors. No gradients. No animation. No sunset glow, no shimmer, no ceremony. The kind of restraint that looks plain until you use it for a while and can't remember what you thought was missing.

2. **Not an IDE.** REPL only. Editor lives next to us in a split.

3. **Interface over implementation.** The command is `scheme-lang`; whether Node or Rust is behind it is our business, not yours.

4. **Batteries included, not the kitchen sink.** The 20+ meta-commands cover the 80% every REPL user hits. Exotic features get a stub that says "waiting for her" until they arrive.

5. **The persona is dialect-owned.** The launcher is neutral. The banner is a *dialect* choice.

---

## What's coming

Some features aren't connected yet. Type them at the REPL and you'll see a Sakura-voiced note — "waiting for her." When she arrives, they light up:

- Notebook mode (`.snb` slat notebook)
- LSP mode (editors get hover-help, arity, contract, source-jump)
- Real `,ask sakura` wire — the REPL has the plumbing; the endpoint waits on her
- More paredit (splice / wrap-round / raise / transpose)

Everything discoverable in the REPL today via `,help`. Nothing crashes when you invoke a stub — you just get told what's still on its way.

---

## For the eleven-year-old boy

The person maintaining this thinks about you. When you type `(+ 1 2)` and see `3`, that's the easy part. When you type `,help map` and get a real answer — that's on purpose. When your circle draws in stars that you can save to a `.slat` file and come back to tomorrow — that's on purpose too.

Somebody gave a shit. Same standard as the good arcade cabinets. Same standard as anything built with care.

---

## License

MIT. Do whatever you want with it. Make your own dialect. Ship it. Tell us about it if you want.

Home: [github.com/Lacuna-Labs/scheme-lang](https://github.com/Lacuna-Labs/scheme-lang)
Made in Brooklyn.
