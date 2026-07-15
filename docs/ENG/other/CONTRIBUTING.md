# Contributing to Sakura Scheme

Sakura Scheme is a language. Language changes are a bigger commitment than product changes, so the process is slightly heavier than a typical repo — but only slightly.

## Filing an issue

Before you propose a change, file an issue that describes:

- What you want the language to let you do that it currently doesn't.
- What you tried, or what you'd want to write.
- Why it belongs in the language and not in a verb layer.

Some ideas are better as verbs (they live in the consumer's verb layer, not the engine). Some are better as macros (they don't need a core change). Some genuinely belong in the engine. The issue is where we figure out which.

## Proposing a change

Once the issue has consensus, open a PR against `main`:

1. Add the code to `src/`. Every module keeps its existing shape.
2. Update `src/index.js` if you're adding a new public symbol.
3. Update `PUBLIC-API.md` with the new symbol's row.
4. Add tests under `tests/`. Vitest, one file per module.
5. Update `docs/SAKURA-SCHEME-BOOK.md` — the Book is the source, not an afterthought.
6. Update `CHANGELOG.md` with a `[Unreleased]` entry, ready to become the next version.

## Reviewing

Every PR reads like a language design conversation. Reviewers ask:

- Does this need to be in the engine, or does it belong in a verb layer?
- Does it break any consumer? Curator's test suite runs on every engine PR.
- Is the naming consistent with the rest of the language?
- Is the change small? A language stays small by being reviewed by people who count LOC.

## Versioning

- Patch bump: a bugfix or clarification. Consumers auto-update.
- Minor bump: a new capability that doesn't break existing code. Consumers update at leisure.
- Major bump: a breaking change. Two-week migration window; consumers coordinate.

## Verb promotion

If a verb in Curator's layer or Lacuna's layer turns out to be dialect-neutral (both consumers want it, same signature, same semantics), it can be **promoted** into the base library. See `CONSUMERS.md` for the checklist. Promotion is a minor version bump.

## Code style

- Prettier (config in `package.json`).
- ESLint (config forthcoming).
- ES modules, `"type": "module"`.
- No `any` in JSDoc when a real type would do.
- Keep the engine dependency-free. Every added dep is a review item.

## Slat

Slat is the language's serialization format. Changes to the format affect both the JS binding (`bindings/js/slat.js`) and the Python binding (`bindings/python/`). Round-trip fixtures live in `tests/vectors.slat` and are shared between both bindings.
