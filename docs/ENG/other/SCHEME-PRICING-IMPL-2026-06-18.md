# Scheme Pricing — Implementation Spec 2026-06-18

## Goal
Add `cost_tokens` and `cost_breakdown` fields to every entry in
`curator-web/src/scheme/carts/index.json` so Automations+Analysis
can show pre-flight cost badges without calling the server.

## Two files to create/modify

### 1. CREATE `curator-web/src/scheme/verbCosts.js`

New file. Export one function:

```js
// verbCosts.js — token cost for a single verb call.
// Multiplier hierarchy (LOCKED 2026-06-18):
//   Scheme/L0  = 1    (on-device, local)
//   L2         = 10   (Fly server, any marketplace API)
//   L3         = 100  (any cloud LLM — fast/workhorse/deep)
//   MCMC/Loam  = 1500 (ensemble / graph query)

const VERB_TIER = {
  // L0 — on-device, free
  'sakura':    1,
  // L2 — Fly server or marketplace API
  'cortex':    10,
  'lacuna':    10,
  'loam':      10,   // loam/operator-state is L2; full loam queries handled separately
  'pii':       10,
  'etsy':      10,
  'ebay':      10,
  'shopify':   10,
  'meta':      10,
  'instagram': 10,
  'ads':       10,
  'ship':      10,
  'stripe':    10,
  'web':       10,   // web/scrape web/search route through Fly proxy
  // L3 — cloud LLM
  'model':     100,
  'vision':    100,
  'documents': 100,
  'analytics': 100,
}

// Special-case full Loam (not operator-state) = 1500
// mcmc/* = 1500
const EXPENSIVE = { 'mcmc': 1500, 'loam-query': 1500 }

/**
 * Return the token cost for a single verb invocation.
 * verb is the full name like "model/workhorse" or "etsy/listings".
 */
export function tokenCostForVerb(verb) {
  if (!verb || typeof verb !== 'string') return 1
  const prefix = verb.split('/')[0]
  if (EXPENSIVE[prefix]) return EXPENSIVE[prefix]
  // loam/* that is NOT loam/operator-state costs 1500
  if (prefix === 'loam' && verb !== 'loam/operator-state') return 1500
  return VERB_TIER[prefix] ?? 1  // default: treat unknown as L0
}

/**
 * Compute total token cost and breakdown for an array of verb names.
 * Returns { total: number, breakdown: { [verb]: number } }
 */
export function cartTokenCost(verbs) {
  if (!Array.isArray(verbs) || verbs.length === 0) {
    return { total: 1, breakdown: { 'scheme': 1 } }
  }
  const breakdown = {}
  let total = 0
  for (const v of verbs) {
    const cost = tokenCostForVerb(v)
    breakdown[v] = cost
    total += cost
  }
  return { total, breakdown }
}
```

### 2. MODIFY `scripts/build_cart_index.mjs`

**Step A — import verbCosts at the top of the file** (after the existing imports):

```js
import { cartTokenCost } from '../curator-web/src/scheme/verbCosts.js'
```

**Step B — in the `parseCart` function, after the `verbs` line**, add cost calculation:

```js
const { total: cost_tokens, breakdown: cost_breakdown } = cartTokenCost(verbs)
```

**Step C — add cost_tokens and cost_breakdown to the returned object** (after `wired`):

```js
cost_tokens,
cost_breakdown,
```

So the return object grows two fields: `cost_tokens` (number) and `cost_breakdown` (object mapping verb→tokens).

**Step D — in the `writeIndex` function** (search for where index entries are assembled for JSON output), ensure `cost_tokens` and `cost_breakdown` are included in the output. The current index entry already includes all parseCart fields; just verify they propagate. If there is a field-allowlist/pick step, add both fields to it.

## Verification

After editing, run:
```
node scripts/build_cart_index.mjs
```
Then check that `curator-web/src/scheme/carts/index.json` entries contain `cost_tokens` and `cost_breakdown`. A quick sanity check:
```
node -e "const idx=JSON.parse(require('fs').readFileSync('curator-web/src/scheme/carts/index.json','utf8')); const e=idx.entries[0]; console.log(e.slug, e.cost_tokens, JSON.stringify(e.cost_breakdown))"
```
A listing-draft cart with one `model/workhorse` call should show `cost_tokens: 100` (or higher if it also calls etsy/listing = +10).

## What NOT to do

- Do NOT add HMAC signing here — that's server-side, separate session.
- Do NOT modify the Validator or HelloSurface — just the build script.
- Do NOT change tier logic or WIRED_VERBS.
- Keep the build deterministic: same disk state → same output.
