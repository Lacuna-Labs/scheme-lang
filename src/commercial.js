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
// Also in this file: the card/* + shoppe/* runtime — Sakura's OWN
// storefront (distinct from external Etsy/eBay/etc). Those verbs have
// no auth gate; they use the Cortex for local state and an in-process
// card store for card lifecycle. See §CARD RUNTIME + §SHOPPE RUNTIME
// at the bottom of this file.

import { Sym } from './reader.js'
import { getCortex } from './ai.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── the commercial verb catalog ───────────────────────────────────────
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
  { name: 'ebay/list-items',          family: 'ebay', arity: 0, summary: 'list the operator\'s current eBay listings' },
  { name: 'ebay/get-item',            family: 'ebay', arity: 1, summary: 'fetch one eBay item by id' },
  { name: 'ebay/create-listing',      family: 'ebay', arity: 1, summary: 'create a new eBay listing from a spec' },
  { name: 'ebay/update-item',         family: 'ebay', arity: 2, summary: 'update fields on an existing eBay item' },
  { name: 'ebay/end-listing',         family: 'ebay', arity: 1, summary: 'take an eBay listing down' },
  { name: 'ebay/orders',              family: 'ebay', arity: 1, summary: 'fetch recent eBay orders' },
  { name: 'ebay/messages',            family: 'ebay', arity: 1, summary: 'read buyer messages on eBay' },
  { name: 'ebay/reply-message',       family: 'ebay', arity: 2, summary: 'reply to a buyer message' },
  { name: 'shopify/list-products',    family: 'shopify', arity: 0, summary: 'list Shopify products' },
  { name: 'shopify/get-product',      family: 'shopify', arity: 1, summary: 'fetch one Shopify product by id' },
  { name: 'shopify/create-product',   family: 'shopify', arity: 1, summary: 'create a new Shopify product' },
  { name: 'shopify/update-product',   family: 'shopify', arity: 2, summary: 'update fields on a Shopify product' },
  { name: 'shopify/orders',           family: 'shopify', arity: 1, summary: 'fetch recent Shopify orders' },
  { name: 'shopify/inventory',        family: 'shopify', arity: 1, summary: 'read inventory levels for a variant' },
  { name: 'shopify/inventory-set!',   family: 'shopify', arity: 2, summary: 'update inventory level for a variant' },
  { name: 'shopify/fulfill-order',    family: 'shopify', arity: 1, summary: 'mark a Shopify order fulfilled' },
  { name: 'meta/post',                family: 'meta', arity: 1, summary: 'publish a post to Facebook' },
  { name: 'meta/instagram-post',      family: 'meta', arity: 1, summary: 'publish a post to Instagram' },
  { name: 'meta/insights',            family: 'meta', arity: 1, summary: 'fetch page insights (reach, impressions)' },
  { name: 'meta/messages',            family: 'meta', arity: 1, summary: 'read Messenger messages' },
  { name: 'meta/reply',               family: 'meta', arity: 2, summary: 'reply to a Messenger thread' },
  { name: 'meta/ad-spend',            family: 'meta', arity: 1, summary: 'fetch ad spend for a date range' },
  { name: 'google/search-console',    family: 'google', arity: 1, summary: 'fetch search-console metrics' },
  { name: 'google/merchant-products', family: 'google', arity: 0, summary: 'list Merchant Center products' },
  { name: 'google/upsert-product',    family: 'google', arity: 1, summary: 'add or update a Merchant Center product' },
  { name: 'google/analytics',         family: 'google', arity: 1, summary: 'fetch Google Analytics events' },
  { name: 'google/ads-spend',         family: 'google', arity: 1, summary: 'fetch Google Ads spend for a date range' },
]

// ── provider seam ─────────────────────────────────────────────────────
const state = { provider: null }

export function setCommercialProvider(provider) { state.provider = provider }
export function getCommercialProvider() { return state.provider }
export function __resetCommercialProvider() { state.provider = null }

// ── auth check ────────────────────────────────────────────────────────
export function checkAuth(family, verbName) {
  const cortex = getCortex()
  const token = cortex.recall(`auth/${family}/token`)
  if (!token) throw new Error(`sign in to use \`${verbName}\` — run \`sakura login\``)
  const expiry = cortex.recall(`auth/${family}/expiry`)
  if (expiry && typeof expiry === 'number' && expiry < Date.now()) {
    throw new Error(`\`${verbName}\` token expired — run \`sakura login\` again`)
  }
  return token
}

// ── dispatcher for a verb ─────────────────────────────────────────────
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
  for (const entry of COMMERCIAL_VERBS) {
    const ent = entry
    env.define(ent.name, (...args) => {
      const coerced = args.map((a) => a instanceof Sym ? a.name : a)
      return callCommercialVerb(ent, coerced)
    }, {
      perm: 'network', cost: 'external-api-call', family: ent.family, commercial: true,
    })
  }
  // card/* + shoppe/* runtime verbs — no auth gate, local state.
  installCardVerbs(env)
  installShoppeVerbs(env)
  return env
}

export function commercialVerbNames() { return COMMERCIAL_VERBS.map((v) => v.name) }
export function commercialFamilies() { return Array.from(new Set(COMMERCIAL_VERBS.map((v) => v.family))) }

// ═══════════════════════════════════════════════════════════════════════
// §CARD RUNTIME — local card store for standalone REPL.
// ═══════════════════════════════════════════════════════════════════════

const cardStore = {
  cards:      new Map(),
  activities: new Map(),
  nextAId:    1,
}

function _cardKey(x) {
  if (x instanceof Sym) return x.name
  if (typeof x === 'string') return x
  if (typeof x === 'number') return String(x)
  return String(x)
}

function _getOrMakeCard(id) {
  const key = _cardKey(id)
  if (!cardStore.cards.has(key)) {
    cardStore.cards.set(key, {
      props:      new Map(),
      listeners:  new Map(),
      handlers:   new Map(),
      activities: new Set(),
    })
  }
  return cardStore.cards.get(key)
}

function _hasCard(id) { return cardStore.cards.has(_cardKey(id)) }

export function __resetCardStore() {
  cardStore.cards.clear()
  cardStore.activities.clear()
  cardStore.nextAId = 1
}

export function _registerCardHandler(cardId, verbName, fn) {
  const c = _getOrMakeCard(cardId)
  c.handlers.set(_cardKey(verbName), fn)
}

export function _registerCardListener(cardId, eventName, fn) {
  const c = _getOrMakeCard(cardId)
  const key = _cardKey(eventName)
  if (!c.listeners.has(key)) c.listeners.set(key, [])
  c.listeners.get(key).push(fn)
}

const VALID_PHYSICS = new Set(['slide', 'no-slide', 'dematerialize', 'waft', 'chubby-walk'])

function installCardVerbs(env) {
  env.define('card/activity', (cardId, label, expected) => {
    const c = _getOrMakeCard(cardId)
    const aid = `act-${cardStore.nextAId++}`
    cardStore.activities.set(aid, {
      cardId:   _cardKey(cardId),
      label:    label === undefined || label === null ? null : (label instanceof Sym ? label.name : label),
      expected: (typeof expected === 'number' && Number.isFinite(expected)) ? expected : null,
      progress: 0,
      done:     false,
    })
    c.activities.add(aid)
    return new Sym(aid)
  }, { perm: 'state-change' })

  env.define('card/activity-done', (activityId) => {
    if (activityId === undefined || activityId === null) return ['error', 'missing-activity-id']
    const aid = _cardKey(activityId)
    if (aid === '') return ['error', 'empty-activity-id']
    const rec = cardStore.activities.get(aid)
    if (rec) rec.done = true
    return new Sym('ok')
  }, { perm: 'state-change' })

  env.define('card/activity-progress', (activityId, progress) => {
    if (activityId === undefined || activityId === null) return ['error', 'missing-activity-id']
    const aid = _cardKey(activityId)
    if (aid === '') return ['error', 'empty-activity-id']
    if (typeof progress !== 'number' || !Number.isFinite(progress)) return ['error', 'progress-not-finite']
    const rec = cardStore.activities.get(aid)
    if (rec && !rec.done) rec.progress = progress
    return new Sym('ok')
  }, { perm: 'state-change' })

  env.define('card/ask', (cardId, question, ctx) => {
    if (!_hasCard(cardId)) return ['no-card', _cardKey(cardId)]
    const c = cardStore.cards.get(_cardKey(cardId))
    const qKey = _cardKey(question)
    const handler = c.handlers.get(qKey)
    if (!handler) return ['no-handler', qKey]
    try { return handler(question, ctx) } catch (e) { return ['error', String(e.message || e)] }
  }, { perm: 'state-change' })

  env.define('card/audio-pulse', (cardId, opts) => {
    if (cardId === undefined || cardId === null) return ['error', 'missing-card-id']
    const c = _getOrMakeCard(cardId)
    const cfg = { target: 'glow', source: 'audio-bus', color: 'petal', intensity: 0.5 }
    if (Array.isArray(opts)) {
      for (let i = 0; i < opts.length - 1; i += 2) {
        const k = opts[i] instanceof Sym ? opts[i].name : String(opts[i])
        const v = opts[i + 1]
        const key = k.startsWith(':') ? k.slice(1) : k
        if (key === 'target' || key === 'source' || key === 'color') {
          cfg[key] = v instanceof Sym ? v.name : String(v)
        } else if (key === 'intensity' && typeof v === 'number' && Number.isFinite(v)) {
          cfg.intensity = Math.max(0, Math.min(1, v))
        }
      }
    }
    c.props.set('audio-pulse', cfg)
    return new Sym('ok')
  }, { perm: 'state-change' })

  env.define('card/audio-pulse-off', (cardId) => {
    if (cardId === undefined || cardId === null) return ['error', 'missing-card-id']
    const c = _getOrMakeCard(cardId)
    c.props.set('audio-pulse', null)
    return new Sym('ok')
  }, { perm: 'state-change' })

  env.define('card/do', (cardId, verbName, ...args) => {
    if (!_hasCard(cardId)) return ['error', 'unknown-card', _cardKey(cardId)]
    const c = cardStore.cards.get(_cardKey(cardId))
    const vKey = _cardKey(verbName)
    const handler = c.handlers.get(vKey)
    if (!handler) return ['error', 'unknown-verb', vKey]
    try { return handler(...args) } catch (e) { return ['error', String(e.message || e)] }
  }, { perm: 'state-change' })

  env.define('card/emit', (cardAddr, eventName, payload) => {
    if (cardAddr === undefined || cardAddr === null) return false
    const key = _cardKey(cardAddr)
    if (key === '') return false
    const c = _getOrMakeCard(cardAddr)
    const evKey = _cardKey(eventName)
    const listeners = c.listeners.get(evKey) || []
    for (const fn of listeners) {
      try { fn(payload) } catch { /* one listener's throw does not halt others */ }
    }
    return true
  }, { perm: 'state-change' })

  env.define('card/physics!', (cardAddr, physicsName) => {
    if (cardAddr === undefined || cardAddr === null) return false
    const pkey = _cardKey(physicsName)
    if (!VALID_PHYSICS.has(pkey)) return false
    const c = _getOrMakeCard(cardAddr)
    c.props.set('physics', pkey)
    return new Sym(pkey)
  }, { perm: 'state-change' })

  env.define('card/transition', (cardAddr, actionName, x, y) => {
    if (cardAddr === undefined || cardAddr === null) return false
    if (typeof x !== 'number' || typeof y !== 'number') return false
    const c = _getOrMakeCard(cardAddr)
    c.props.set('last-transition', {
      action:  _cardKey(actionName),
      x, y,
      physics: c.props.get('physics') || 'slide',
    })
    return true
  }, { perm: 'animate' })
}

// ═══════════════════════════════════════════════════════════════════════
// §SHOPPE RUNTIME — Cortex-backed local shoppe state.
// ═══════════════════════════════════════════════════════════════════════

const SHOPPE_PRICING = {
  packs: [
    { size: 100,  cents: 500,   perTokenCents: 5.0  },
    { size: 500,  cents: 2000,  perTokenCents: 4.0  },
    { size: 1000, cents: 3500,  perTokenCents: 3.5  },
    { size: 5000, cents: 12500, perTokenCents: 2.5  },
  ],
  singleTokenCents: 10,
  tierSubscriptionCents: { free: 0, paid: 999, pro: 2999 },
}

const MERCH_SKUS = new Set([
  'sakura-shirt', 'sakura-mug', 'sakura-poster', 'sakura-sticker',
  'sakura-tote', 'sakura-hoodie', 'sakura-notebook',
])
const MERCH_CUSTOM_ARTWORK_ALLOWED = new Set(['sakura-shirt', 'sakura-poster', 'sakura-tote'])
const MERCH_PRICE_TOKENS = 100

function installShoppeVerbs(env) {
  const readTokens = () => {
    const t = getCortex().recall('shoppe/tokens')
    return typeof t === 'number' && Number.isFinite(t) ? t : 0
  }
  const readTier = () => {
    const t = getCortex().recall('shoppe/tier')
    if (t instanceof Sym) return t.name
    return typeof t === 'string' ? t : 'free'
  }
  const readTxLog = () => {
    const log = getCortex().recall('shoppe/tx-log')
    return Array.isArray(log) ? log : []
  }
  const appendTx = (record) => {
    const log = readTxLog()
    log.push(record)
    getCortex().remember('shoppe/tx-log', log)
  }

  env.define('shoppe/balance', () => {
    return [
      [new Sym('tokens'),   readTokens()],
      [new Sym('currency'), new Sym('sakura-token')],
      [new Sym('tier'),     new Sym(readTier())],
    ]
  }, { perm: 'personal-data' })

  env.define('shoppe/buy-merch', (sku, customArtId) => {
    const skuKey = _cardKey(sku)
    if (!MERCH_SKUS.has(skuKey)) {
      return [[new Sym('ok'), false], [new Sym('reason'), new Sym('unknown-sku')], [new Sym('sku'), sku]]
    }
    if (customArtId !== undefined && customArtId !== null) {
      if (!MERCH_CUSTOM_ARTWORK_ALLOWED.has(skuKey)) {
        return [[new Sym('ok'), false], [new Sym('reason'), new Sym('sku-doesnt-accept-custom')], [new Sym('sku'), sku]]
      }
    }
    const bal = readTokens()
    if (bal < MERCH_PRICE_TOKENS) {
      return [[new Sym('ok'), false], [new Sym('reason'), new Sym('insufficient-balance')], [new Sym('sku'), sku], [new Sym('needed'), MERCH_PRICE_TOKENS], [new Sym('have'), bal]]
    }
    getCortex().remember('shoppe/tokens', bal - MERCH_PRICE_TOKENS)
    appendTx({
      kind:      'merch-buy',
      sku:       skuKey,
      customArt: customArtId ? _cardKey(customArtId) : null,
      cost:      MERCH_PRICE_TOKENS,
      at:        Date.now(),
    })
    return [[new Sym('ok'), true], [new Sym('sku'), sku], [new Sym('cost'), MERCH_PRICE_TOKENS], [new Sym('balance'), bal - MERCH_PRICE_TOKENS]]
  }, { perm: 'financial' })

  env.define('shoppe/buy-pack', (sizeTokens) => {
    if (typeof sizeTokens !== 'number' || !Number.isFinite(sizeTokens) || sizeTokens <= 0) {
      return [[new Sym('ok'), false], [new Sym('reason'), new Sym('invalid-size')]]
    }
    const size = Math.floor(sizeTokens)
    const pack = SHOPPE_PRICING.packs.slice().reverse().find((p) => p.size <= size)
    const cents = pack ? Math.round(size * pack.perTokenCents) : size * SHOPPE_PRICING.singleTokenCents
    appendTx({
      kind:   'pack-intent',
      size:   size,
      cents:  cents,
      at:     Date.now(),
      status: 'pending-payment',
    })
    return [
      [new Sym('ok'),          true],
      [new Sym('size'),        size],
      [new Sym('cost-cents'),  cents],
      [new Sym('payment-url'), `sakura://checkout/pack/${size}`],
      [new Sym('status'),      new Sym('pending-payment')],
    ]
  }, { perm: 'financial' })

  env.define('shoppe/close', () => {
    getCortex().remember('shoppe/open?', false)
    return new Sym('closed')
  }, { perm: 'state-change' })

  env.define('shoppe/open', () => {
    getCortex().remember('shoppe/open?', true)
    return new Sym('opened')
  }, { perm: 'state-change' })

  env.define('shoppe/savings', (sizeTokens) => {
    const size = Math.max(0, Math.floor(sizeTokens || 0))
    const pack = SHOPPE_PRICING.packs.slice().reverse().find((p) => p.size <= size)
    const packCents   = pack ? Math.round(size * pack.perTokenCents) : size * SHOPPE_PRICING.singleTokenCents
    const singleCents = size * SHOPPE_PRICING.singleTokenCents
    const savedCents  = Math.max(0, singleCents - packCents)
    const percent = singleCents > 0 ? Math.round((savedCents / singleCents) * 100) : 0
    const tier = readTier()
    const currentSubCents = SHOPPE_PRICING.tierSubscriptionCents[tier] ?? 0
    const vsCurrentSub = tier === 'free' ? null : Math.max(0, currentSubCents - packCents)
    return [
      [new Sym('savedDollars'),          savedCents / 100],
      [new Sym('percent'),               percent],
      [new Sym('vsFree'),                savedCents / 100],
      [new Sym('vsCurrentSubscription'), vsCurrentSub === null ? null : vsCurrentSub / 100],
    ]
  }, { perm: 'read' })

  env.define('shoppe/transactions', (limit) => {
    const log = readTxLog()
    const sorted = log.slice().sort((a, b) => (b.at || 0) - (a.at || 0))
    const n = (typeof limit === 'number' && Number.isFinite(limit) && limit > 0)
      ? Math.floor(limit) : sorted.length
    return sorted.slice(0, n).map((tx) => [
      [new Sym('kind'),     tx.kind ? new Sym(tx.kind) : new Sym('unknown')],
      [new Sym('amount'),   typeof tx.cost === 'number' ? tx.cost : (tx.cents || 0)],
      [new Sym('at'),       tx.at || 0],
      [new Sym('sku'),      tx.sku ? new Sym(tx.sku) : null],
      [new Sym('category'), new Sym(tx.kind === 'merch-buy' ? 'merch' : 'pack')],
    ])
  }, { perm: 'personal-data' })
}

export default installCommercial
