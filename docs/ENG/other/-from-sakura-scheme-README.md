<p align="left">
  <img src="./docs/images/mark.svg" alt="Lacuna Labs — tri-tone bar" width="400">
</p>

# Sakura Scheme

*A small Scheme for humans and AI to program together.*

![build](https://img.shields.io/badge/build-passing-brightgreen)
![version](https://img.shields.io/badge/version-1.4.0-blue)
![license](https://img.shields.io/badge/license-MIT-lightgrey)
![status](https://img.shields.io/badge/status-beta-orange)
[![canonical-docs](https://img.shields.io/badge/canonical--docs-lacuna--docs-black)](../lacuna-docs/)

## Table of contents

- [What it is](#what-it-is)
- [What it looks like](#what-it-looks-like)
- [Install](#install)
- [Quickstart](#quickstart)
- [Directory tour](#directory-tour)
- [The Book](#the-book)
- [Consumers](#consumers)
- [Canonical docs](#canonical-docs)
- [License and status](#license-and-status)

## What it is

Sakura Scheme is a small programming language, a Scheme dialect written in JavaScript, packaged so you can `npm install` it and use it as a library or run it from the command line. It borrows from Scheme's five-decade tradition of programs that are easy to read and easy to reason about, and it treats a language model as a peer in the REPL — so you can ask for help, get a suggestion, and evaluate it, all without leaving the prompt.

The engine is ~2,000 lines of dependency-free JavaScript: a reader, a tree-walking evaluator with tail-call optimization, hygienic macros, and a base library of ~80 primitives. On top of that sits a verb registry with rich metadata (docs, examples, contracts, source pointers) that a REPL, a CLI, a doc emitter, and Sakura herself all read from — one source of truth.

## What it looks like

```scheme
(define (greet name)
  (string-append "hello, " name))

(greet "world")
;; => "hello, world"

(define fact
  (lambda (n)
    (if (= n 0) 1 (* n (fact (- n 1))))))

(fact 10)
;; => 3628800

(map (lambda (n) (* n n)) '(1 2 3 4 5))
;; => (1 4 9 16 25)
```

Ten lines. Nothing surprising. That's the point.

## Install

Three ways in:

```sh
# macOS — Homebrew tap (recommended)
brew install lacuna-labs/tap/sakura-scheme

# Any Unix — curl installer
curl -fsSL sakura-scheme.lacunalabs.ai/install.sh | sh

# Anywhere Node runs — npm
npm i -g sakura-scheme
```

After installation:

```sh
sakura-scheme --version   # 1.4.0
sakura-scheme repl        # interactive session
```

## Quickstart

```sh
$ sakura-scheme eval "(+ 1 2)"
3

$ sakura-scheme repl
sakura-scheme 1.4.0  —  type ,help <verb> or ,exit
> (define pi 3.14159)
> (* 2 pi)
6.28318
> ,exit
bye
```

See [The Sakura Scheme Book](./docs/SAKURA-SCHEME-BOOK.md) for the full tour.

## Directory tour

```
sakura-scheme/
├── src/               # engine — reader, interp, base, macro, registry
├── bin/               # sakura-scheme CLI entry
├── bindings/
│   ├── js/            # canonical JS slat reader/writer
│   └── python/        # Python binding (round-trip compatible)
├── docs/
│   ├── SAKURA-SCHEME-BOOK.md      # the Book
│   ├── SAKURA-SCHEME-1.0-*.md     # engineering / style guide / etc.
│   └── slat/          # slat format spec
├── tests/             # vitest tests for every module
├── scripts/           # dev shell scripts
└── .lacuna/           # triggers.yaml + tools.yaml
```

## The Book

The canonical language reference is [The Sakura Scheme Book](./docs/SAKURA-SCHEME-BOOK.md). Fifteen chapters plus two appendices, one runnable example on every claim.

## Consumers

Every downstream that pins Sakura Scheme is listed in [CONSUMERS.md](./CONSUMERS.md). Curator, Lacuna, Gastronomy Graph, Forge (optional). Baobab and Caliper have their own domain-specific interpreters and stay separate.

## Canonical docs

- Company canon: [`~/code/lacuna-docs/`](../lacuna-docs/)
- The extraction plan: [`~/code/lacuna-docs/engineering/THE-PLAN.md`](../lacuna-docs/engineering/THE-PLAN.md), Chapter 3
- Public API surface: [PUBLIC-API.md](./PUBLIC-API.md)
- Change history: [CHANGELOG.md](./CHANGELOG.md)
- Contributor guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## License and status

MIT, per [LICENSE](./LICENSE). Status: beta — the engine is production-tested inside Curator; the REPL wow-layer, LSP, and package manager arrive over the next few sprints.
