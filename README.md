# scheme-lang

A small Scheme for humans and AI to program together.

**One-liner:** the base language + REPL + reference manual + tooling, dialect-neutral, community-forkable.

---

## Try it in 30 seconds

```
git clone https://github.com/Lacuna-Labs/scheme-lang
cd scheme-lang
./bin/scheme-lang
```

You'll land in a REPL with tab-complete, syntax colors, and a pink cherry-blossom banner. Type `(+ 1 2)`. It says `3`. Type `,help`. Have at it.

---

## What ships in this repo

- **`bin/scheme-lang`** — the neutral launcher. Discovers installed dialects; runs the base if you have nothing else installed.
- **`bin/sakura-scheme`** — the Sakura dialect binary (the base is called "Sakura Scheme" — every fork picks its own name; forks change this line).
- **`src/`** — the language: reader / interpreter / macros / base primitives / verb registry / dispatcher / REPL / launcher.
- **`src/adapters.js`** — no-op adapter stubs. Real dialects override with `setAdapters(…)`.
- **`docs/`** — reference manual, tutorial, engineering doc, style guide, REPL guide, feature showcase.
- **`tests/`** — smoke tests. Zero npm deps; runs on plain `node --test`.

## What lives elsewhere

- **Curator's dialect** (card / shop / sprite / world / flower verbs + adapters) — see `Lacuna-Labs/curator`. Cloning this base plus that gets you the Curator surface.
- **Cross-product engineering docs** (SLAT engineering, WEAVE training procedure, Big Burndown Plan) — see `Lacuna-Labs/lacuna-labs`.
- **Any dialect from anyone else** — the community forks pattern in `TEMPLATE-FOR-FORKS.md`.

---

## Make your own dialect

See [`TEMPLATE-FOR-FORKS.md`](TEMPLATE-FOR-FORKS.md).

The gist: fork this repo, rename in `dialect.json`, add your verbs to `verbs/`, drop your adapters in `adapters/`, and you're a dialect. The REPL discovers you automatically.

---

## Design principles

1. **Clean lines and intent to purpose.** Nothing in excess. Frames frame frames — the outer structure exists to guide your eye to the inner structure exists to guide your eye to the code. Bauhaus, IKEA, KDE, Volvo, mid-century modern, brutalist — that discipline. Solid colors. No animation. No gradient sunsets. If you want fireworks, use something else.
2. **Not an IDE.** REPL only. Editor lives next to us in a split.
3. **Interface over implementation.** The command is `scheme-lang`; whether Node or Rust is behind it is our business, not yours.
4. **Batteries included, not the kitchen sink.** The 20+ meta-commands cover the 80% every REPL user hits. Exotic features are named on the tin as v1.1.
5. **The persona is dialect-owned.** The launcher is neutral. The banner is a *dialect* choice.

---

## What's coming (v1.1 — named on the tin)

- Full paredit (splurge / slurp / kill-form / mark-form)
- `,inspect` walker (arrow keys, ascend / descend / quit)
- `,trace` per-call render with nested indent
- Live reload from `.scm` file changes
- Session replay from `.slat` files
- Notebook mode (`.snb` slat notebook)
- Real `,ask sakura` wire (currently stub — endpoint configurable)
- Sixel + iTerm2 + kitty + wezterm inline image router (auto-detect)
- LSP mode (editors get hover-help, arity, contract, source-jump)

Every one of these is discoverable in the REPL today via `,help` — they just respond with a friendly "coming in v1.1" message when invoked.

---

## Quick session

```
$ ./bin/scheme-lang
       ✿  ✿
     ✿  ✿  ✿             Sakura Scheme  v1.0
       ✿  ✿              a language for humans and AI
         │                to program together

sakura> (+ 1 2)
3

sakura> ,help map
map  —  Apply a function to each element of a list.
Arity:      2 args
Contract:   ((-> a b) (list a)) -> (list b)

sakura> (map (lambda (x) (* x x)) '(1 2 3 4))
(1 4 9 16)

sakura> ,exit
goodnight ✿
```

---

## For the eleven-year-old boy

The person maintaining this thinks about you. When you type `(+ 1 2)` and see `3`, that's the easy part. When you type `,help map` and get a real answer — that's on purpose. When your Braille circle draws in dots that you can save to a `.slat` file and come back to tomorrow — that's on purpose too.

Somebody gave a shit. Same standard as the good arcade cabinets. Same standard as anything built with care.

---

## License

MIT. Do whatever you want with it. Make your own dialect. Ship it. Tell us about it if you want.

Home: [github.com/Lacuna-Labs/scheme-lang](https://github.com/Lacuna-Labs/scheme-lang)
Made in Brooklyn.
