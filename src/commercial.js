// commercial.js — Layer 4 (L4): shop verbs, auth-gated.
//
// The etsy/ebay/shopify/meta/google verb families. Each verb is a
// registered function that fires an external API call. Auth is gated at
// EXECUTION, not authoring — so a script that calls (etsy/list-products)
// still parses and registers fine; it only errors when actually invoked
// without a token.
//
// The auth check reads from the Cortex (auth tokens are stored there,
// keyed to the operator). A missing token yields a clean error:
//
//   "sign in to use `etsy/list-products` — run `sakura login`"
//
// The verb bodies are STUBS. They validate auth, then either:
//   · call the configured provider (real API impl) via getCommercialProvider()
//   · error with "not implemented" if no provider is wired.
//
// Same seam as ai.js: setCommercialProvider({ etsy: {...}, ebay: {...} })
// swaps in real implementations at runtime. Sakura's own runtime does
// that; standalone REPL leaves them stubbed.
//
// Kid-readable comment: this is the "sell on Etsy / eBay / Shopify"
// part of the language. Every verb here needs the operator to be signed
// in first — because someone else's website is going to hear about it.

import { Sym } from './reader.js'
import { getCortex } from './ai.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── the commercial verb catalog ───────────────────────────────────────
//
// Each entry:
//   name         — the Scheme verb name (family/verb)
//   family       — etsy | ebay | shopify | meta | google
//   summary      — one-line description (for help)
//   arity        — expected number of args (docs only; not enforced)
//   cost         — 'external-api-call' for the whole set
//
// The catalog is defined here rather than pulled from the reference
// SLAT because the reference doesn't yet enumerate every etsy/ebay/etc
// verb — the plan calls out that these are DEFINED at the language
// boundary and PROVIDED by the runtime.
export const COMMERCIAL_VERBS = [
  // ── Etsy ────────────────────────────────────────────────────────────
  { name: 'etsy/list-products',       family: 'etsy', arity: 0, summary: 'list the operator\'s current Etsy listings' },
  { name: 'etsy/get-product',         family: 'etsy', arity: 1, summary: 'fetch one Etsy listing by id' },
  { name: 'etsy/create-listing',      family: 'etsy', arity: 1, summary: 'create a new Etsy listing from a spec' },
  { name: 'etsy/update-listing',      family: 'etsy', arity: 2, summary: 'update fields on an existing Etsy listing' },
  { name: 'etsy/delete-listing',      family: 'etsy', arity: 1, summary: 'take an Etsy listing down' },
  { name: 'etsy/publish-listing',     family: 'etsy', arity: 1, summary: 'flip an Etsy draft to active' },
  { name: 'etsy/receipts',            family: 'etsy', arity: 1, summary: 'fetch recent Etsy orders/receipts' },
  { name: 'etsy/ledger',              family: 'etsy', arity: 1, summary: 'fetch the operator\'s Etsy payments ledger' },
  { name: 'etsy/shop-info',           family: 'etsy', arity: 0, summary: 'shop-wide metadata (name, currency, policies)' },
  { name: 'etsy/upload-image',        family: 'etsy', arity: 2, summary: 'upload a product image to Etsy' },

  // ── eBay ────────────────────────────────────────────────────────────
  { name: 'ebay/list-items',          family: 'ebay', arity: 0, summary: 'list the operator\'s current eBay listings' },
  { name: 'ebay/get-item',            family: 'ebay', arity: 1, summary: 'fetch one eBay item by id' },
  { name: 'ebay/create-listing',      family: 'ebay', arity: 1, summary: 'create a new eBay listing from a spec' },
  { name: 'ebay/update-item',         family: 'ebay', arity: 2, summary: 'update fields on an existing eBay item' },
  { name: 'ebay/end-listing',         family: 'ebay', arity: 1, summary: 'take an eBay listing down' },
  { name: 'ebay/orders',              family: 'ebay', arity: 1, summary: 'fetch recent eBay orders' },
  { name: 'ebay/messages',            family: 'ebay', arity: 1, summary: 'read buyer messages on eBay' },
  { name: 'ebay/reply-message',       family: 'ebay', arity: 2, summary: 'reply to a buyer message' },

  // ── Shopify ─────────────────────────────────────────────────────────
  { name: 'shopify/list-products',    family: 'shopify', arity: 0, summary: 'list Shopify products' },
  { name: 'shopify/get-product',      family: 'shopify', arity: 1, summary: 'fetch one Shopify product by id' },
  { name: 'shopify/create-product',   family: 'shopify', arity: 1, summary: 'create a new Shopify product' },
  { name: 'shopify/update-product',   family: 'shopify', arity: 2, summary: 'update fields on a Shopify product' },
  { name: 'shopify/orders',           family: 'shopify', arity: 1, summary: 'fetch recent Shopify orders' },
  { name: 'shopify/inventory',        family: 'shopify', arity: 1, summary: 'read inventory levels for a variant' },
  { name: 'shopify/inventory-set!',   family: 'shopify', arity: 2, summary: 'update inventory level for a variant' },
  { name: 'shopify/fulfill-order',    family: 'shopify', arity: 1, summary: 'mark a Shopify order fulfilled' },

  // ── Meta (Facebook + Instagram) ─────────────────────────────────────
  { name: 'meta/post',                family: 'meta', arity: 1, summary: 'publish a post to Facebook' },
  { name: 'meta/instagram-post',      family: 'meta', arity: 1, summary: 'publish a post to Instagram' },
  { name: 'meta/insights',            family: 'meta', arity: 1, summary: 'fetch page insights (reach, impressions)' },
  { name: 'meta/messages',            family: 'meta', arity: 1, summary: 'read Messenger messages' },
  { name: 'meta/reply',               family: 'meta', arity: 2, summary: 'reply to a Messenger thread' },
  { name: 'meta/ad-spend',            family: 'meta', arity: 1, summary: 'fetch ad spend for a date range' },

  // ── Google (Shopping + Search Console + Merchant Center) ────────────
  { name: 'google/search-console',    family: 'google', arity: 1, summary: 'fetch search-console metrics' },
  { name: 'google/merchant-products', family: 'google', arity: 0, summary: 'list Merchant Center products' },
  { name: 'google/upsert-product',    family: 'google', arity: 1, summary: 'add or update a Merchant Center product' },
  { name: 'google/analytics',         family: 'google', arity: 1, summary: 'fetch Google Analytics events' },
  { name: 'google/ads-spend',         family: 'google', arity: 1, summary: 'fetch Google Ads spend for a date range' },
]

// ── provider seam ─────────────────────────────────────────────────────
//
// A provider is a per-family record: `{ etsy: {...}, ebay: {...} }`.
// Each family exposes methods keyed by short verb name (no prefix).
// Standalone REPL uses a null provider — every verb errors with
// "not implemented" once auth passes.

const state = {
  provider: null,
}

/**
 * setCommercialProvider — swap in a real impl. Sakura's runtime does
 * this at startup. Partial overrides work: `{ etsy: … }` alone leaves
 * the other families unimplemented.
 */
export function setCommercialProvider(provider) {
  state.provider = provider
}

export function getCommercialProvider() {
  return state.provider
}

/**
 * __resetCommercialProvider — test seam.
 */
export function __resetCommercialProvider() {
  state.provider = null
}

// ── auth check ────────────────────────────────────────────────────────
//
// The dispatcher hook. Before firing a paid verb, we look up an auth
// token for the family in the Cortex. Standard key layout:
//
//   'auth/<family>/token'  — the actual access token
//   'auth/<family>/expiry' — unix ms when it expires
//
// Missing token → clean error the user can act on. Expired token
// (expiry < now) → same shape.
export function checkAuth(family, verbName) {
  const cortex = getCortex()
  const token = cortex.recall(`auth/${family}/token`)
  if (!token) {
    throw new Error(
      `sign in to use \`${verbName}\` — run \`sakura login\``
    )
  }
  const expiry = cortex.recall(`auth/${family}/expiry`)
  if (expiry && typeof expiry === 'number' && expiry < Date.now()) {
    throw new Error(
      `\`${verbName}\` token expired — run \`sakura login\` again`
    )
  }
  return token
}

// ── dispatcher for a verb ─────────────────────────────────────────────
//
// Wraps the provider call with the auth check. If no provider is wired
// (standalone REPL), errors cleanly.
function callCommercialVerb(entry, args) {
  const token = checkAuth(entry.family, entry.name)
  const provider = state.provider
  if (!provider || !provider[entry.family]) {
    throw new Error(
      `\`${entry.name}\` needs a runtime provider — ` +
      `standalone REPL doesn't ship a real ${entry.family} client. ` +
      `Run inside Sakura or wire one via setCommercialProvider().`
    )
  }
  // Short verb name (family stripped off).
  const shortName = entry.name.slice(entry.family.length + 1)
  const fam = provider[entry.family]
  if (typeof fam[shortName] !== 'function') {
    throw new Error(
      `\`${entry.name}\` is registered but the ${entry.family} provider ` +
      `doesn't implement \`${shortName}\`.`
    )
  }
  return fam[shortName](token, ...args)
}

// ── install into a Scheme env ─────────────────────────────────────────

export function installCommercial(env) {
  // Every commercial verb is 'network' perm + 'external-api-call' cost.
  // The cost tag is metadata the dispatcher can meter against (e.g. one
  // token per external call in Sakura's token budget).
  for (const entry of COMMERCIAL_VERBS) {
    // Snapshot the entry so the closure keeps its own reference — no
    // aliasing issues if a caller pushes onto COMMERCIAL_VERBS later.
    const ent = entry
    env.define(ent.name, (...args) => {
      // Coerce Syms to strings so a script that does (etsy/get-product 'abc)
      // sees "abc", not { name: "abc" }.
      const coerced = args.map((a) => a instanceof Sym ? a.name : a)
      return callCommercialVerb(ent, coerced)
    }, {
      perm: 'network',
      cost: 'external-api-call',
      family: ent.family,
      commercial: true,
    })
  }
  return env
}

/**
 * commercialVerbNames — the flat list of names (for tests / docs).
 */
export function commercialVerbNames() {
  return COMMERCIAL_VERBS.map((v) => v.name)
}

/**
 * commercialFamilies — the distinct families we know about.
 */
export function commercialFamilies() {
  return Array.from(new Set(COMMERCIAL_VERBS.map((v) => v.family)))
}

export default installCommercial
