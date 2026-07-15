# Template for forks — Pages ecosystem

Every dialect repo can host its own GitHub Pages site with an in-browser
REPL + rendered reference manual on the same page. The `Lacuna-Labs/scheme-lang`
repo is the base — the pattern below documents how a fork inherits the
"Try it →" affordance for free.

The result: your fork's README carries a "Try it →" link at the top; the
link points at your own Pages URL; the reader lands, clicks, and is in a
REPL running your interpreter within a second, zero install.

## What ships in the base

The base repo (`Lacuna-Labs/scheme-lang`) ships:

- `docs/site/` — the site source (bundler + REPL widget + styles + template)
- `docs/site/build.mjs` — bundles the interpreter to a browser ES module
- `docs/site/render-ref.mjs` — renders `docs/SAKURA-SCHEME-1.0.REF.md` to HTML
- `docs/site/build-site.mjs` — stitches everything into `docs/site/dist/`
- `docs/site/repl.js` — the browser REPL widget (881 lines, zero deps)
- `docs/site/styles.css` — the Bauhaus-clean CSS
- `docs/site/index.template.html` — the landing page template
- `.github/workflows/pages.yml` — deploys on push to main
- `TEMPLATE-FOR-FORKS-PAGES.md` — this file

Nothing under `docs/site/` uses npm — the bundler is a small hand-rolled
Node script. Your fork inherits it verbatim.

## Fork setup — the minimum

1. **Fork `Lacuna-Labs/scheme-lang`** into your account.
2. **Update `dialect.json`** in the fork root to describe your dialect:
   ```json
   {
     "name": "your-dialect",
     "displayName": "Your Dialect",
     "version": "0.1.0",
     "core": false,
     "entrypoint": "./bin/your-dialect",
     "tagline": "what your dialect adds",
     "palette": "your-palette",
     "description": "one paragraph."
   }
   ```
3. **Add your verbs** to `src/base.js` or a new `src/dialect.js` that
   layers on top of `makeBaseEnv`. Keep the base engine (reader / interp /
   macro) untouched — that's what makes forks inherit fixes.
4. **Update the reference manual** at `docs/SAKURA-SCHEME-1.0.REF.md`
   (or rename it and update `docs/site/render-ref.mjs` to point at the
   new path).
5. **Rename the site title** in `docs/site/index.template.html`
   (search for "Sakura Scheme" and "scheme-lang").
6. **Enable Pages** in the fork settings — Settings → Pages → Source:
   GitHub Actions.
7. **Push to `main`** — the workflow builds and publishes. Your Pages
   URL will be:
   ```
   https://<owner>.github.io/<repo-name>/
   ```
8. **Add "Try it →" to your README** at the top:
   ```markdown
   [Try it →](https://<owner>.github.io/<repo-name>/)
   ```

That's it. Every push to main rebuilds + redeploys automatically.

## Loading your own verb registry

The browser bundle exports `makeBaseEnv(fuel)`. To add your dialect's
verbs, edit `docs/site/repl.js` — the constructor of `BrowserRepl` calls
`makeBaseEnv`; add your verb installer right after:

```js
constructor(root) {
  this.fuel = { n: DEFAULT_FUEL }
  this.env = makeBaseEnv(this.fuel)
  installYourVerbs(this.env, this.fuel)   // ← your addition
  ...
}
```

Then have your bundler include `installYourVerbs` (either bake it into
`src/base.js` and it'll be picked up by `docs/site/build.mjs`, or add a
new entry to `docs/site/build.mjs`'s `ORDER` array).

## Loading your own reference manual

The reference is rendered at build time from
`docs/SAKURA-SCHEME-1.0.REF.md`. If your fork's reference lives elsewhere,
update the `REF_PATH` constant at the top of `docs/site/render-ref.mjs`.

The renderer handles: fenced code blocks with syntax highlighting +
runnable "Run" buttons, headings, prose, block quotes, lists, and inline
markup (bold / italic / code / links). It's a small MD subset that's
enough for a reference manual and stays reliable across forks.

## Not shipping the REPL widget

If your dialect only wants a static rendered reference (no live REPL),
delete `docs/site/repl.js` and remove the `<script>` tag from
`index.template.html`. The bundler still works; the page loads
instantly; the Run buttons become dead but the reference reads fine.

## Community forks: change the banner

The pink cherry-blossom banner is Sakura's. Community dialects should
change the banner glyph + palette. Edit the `writeBanner` method in
`docs/site/repl.js` and swap the `--petal`, `--bloom`, `--blush` palette
tokens in `docs/site/styles.css`.

Recommended: pick ONE glyph (not many) that carries your dialect's
identity. The rule of the aesthetic tradition is "one earned decoration,
no more" — see the design language memory.

## Reporting bugs upstream

If the base engine (reader / interp / macro / base) has a bug that
affects your dialect, please file an issue on
`Lacuna-Labs/scheme-lang` — every fork inherits the fix.

## Related

- `README.md` — user-facing install + first-ten-minutes
- `TEMPLATE-FOR-FORKS.md` — the CLI + install pattern (companion to this)
- `docs/REPL.md` — the terminal REPL doctrine
- `docs/REPL-FEATURES.md` — the killer REPL feature list

## One-line for future forks

**Fork the repo, update `dialect.json`, layer your verbs into
`src/base.js`, enable Pages in Settings, push to main. The workflow
builds and publishes. Add "Try it →" to your README at the top.**
