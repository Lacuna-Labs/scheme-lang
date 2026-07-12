# Make your own dialect

The base language is dialect-neutral. To turn it into your dialect — with your own verbs, your own banner, your own name — do these five things.

## 1. Fork the repo

```
git clone https://github.com/Lacuna-Labs/scheme-lang your-dialect
cd your-dialect
rm -rf .git
git init
```

## 2. Rename yourself in `dialect.json`

```json
{
  "name":        "your-dialect",
  "displayName": "Your Dialect Name",
  "version":     "1.0.0",
  "core":        false,
  "extends":     "base",
  "entrypoint":  "./bin/your-dialect",
  "tagline":     "…a one-line description…",
  "palette":     "your-color",
  "description": "…a paragraph…"
}
```

## 3. Add your verbs

Create `verbs/` at the repo root:

```
verbs/
├── my-namespace/
│   ├── open.js
│   ├── close.js
│   └── whatever.js
└── index.js
```

Each verb file exports a `register(env)` function:

```javascript
import { registerPrimitive } from '../../src/registry.js'

export function register(env) {
  registerPrimitive({
    name: 'my-namespace/open',
    arity: 1,
    contract: '(symbol) -> boolean',
    doc: 'Open the thing.',
    examples: [
      { level: 'novice',       code: "(my-namespace/open 'welcome)" },
      { level: 'intermediate', code: "(my-namespace/open 'shop-main)" },
    ],
    atom: 'my-namespace.open',
    tier: 'operator',
    perm: 'state-change',
    namespace: 'my-namespace',
    impl: (id) => { /* … your code … */ return true }
  })
}
```

`verbs/index.js` imports each file and calls its `register()`.

## 4. Provide your adapters (if you need any)

If your verbs need to reach into a host runtime (a logbus, a canvas, a database), create `adapters/` and inject at load time:

```javascript
import { setAdapters } from '../src/adapters.js'
import { yourLogbus } from './your-logbus.js'

setAdapters({
  emit: yourLogbus.emit,
  // …anything else you need
})
```

Call `setAdapters` before the first dispatch — usually in your dialect's boot sequence.

## 5. Point `bin/scheme-lang` at your dialect

```
cp bin/sakura-scheme bin/your-dialect
```

Edit the shebang to run the same interpreter but point it at your `verbs/index.js` load. If the shape of the base binary doesn't fit, copy the pattern from `bin/scheme-lang` — it's ~50 lines of Node.

---

## Now you're a dialect

```
$ ./bin/scheme-lang
Your Dialect Name  v1.0.0
…your tagline…

your-dialect> (my-namespace/open 'welcome)
#t

your-dialect> ,help my-namespace/open
my-namespace/open  —  Open the thing.
Arity:     1 arg
Contract:  (symbol) -> boolean

your-dialect> ,exit
```

The launcher discovers you automatically as long as `dialect.json` is present.

---

## Getting your dialect discovered by someone else's `scheme-lang`

Users install your dialect by dropping the folder into any of these locations:

- `./` — the current working directory
- `~/.scheme-lang/dialects/<your-name>/`
- `/usr/local/share/scheme-lang/dialects/<your-name>/`

When they run `scheme-lang` at their terminal, your dialect shows up in the menu.

---

## Publishing

We encourage community dialects. If your dialect is public and you'd like it in a "known dialects" list on our docs site, drop us a link. No approval required — that list is discovery, not certification.

## License

Same MIT that the base ships under. Your dialect can be MIT, LGPL, GPL, proprietary, whatever you want. It's yours.
