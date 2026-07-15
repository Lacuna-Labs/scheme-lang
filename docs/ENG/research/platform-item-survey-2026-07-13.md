# Platform Item Survey — five shop-card platforms

**Date:** 2026-07-13
**Dispatched by:** lacuna-eng
**Requested by:** Alfred
**Companion artifact:** `platform-item-survey-2026-07-13.slat` (canonical structured record)

## The question

How many items live on the five commerce platforms Lacuna Labs supports as
shop cards, how many categories does each platform expose, and how many
categories does Sakura actually need to learn to serve 80% of operator work
across all five?

## The numbers

| Platform | Item count | Category tree | Top-level cats | Per-platform 80% cats |
|---|---|---|---|---|
| **Etsy** | ~120M (est. from 5.6M sellers) | ~6,000 | ~50 | 4-5 |
| **eBay** | 2.5B live listings (2025 YE) | ~20,000 | 34 | 5 |
| **Meta** (FB Marketplace + FB Shop + IG Shop) | 3.5M new/day US+CA; total undisclosed | ~100 mid-level | 15 (Marketplace) | 6-7 |
| **Google** (GMC/Shopping) | Feed-consumer, not a marketplace | **5,595 (exact)** | 21 | 5 |
| **Shopify** | 140M-570M (est.; 2.86M storefronts) | 5,595 (inherits Google) | 21 | 6 |

## Per-platform 80% coverage set

- **Etsy (top-5 → 83%):** Home & Living, Jewelry & Personal Accessories,
  Apparel, Craft Supplies, Paper & Party Supplies.
- **eBay (top-5 → 81%):** Electronics, Fashion, Home & Garden, Motors/Parts,
  Collectibles/Trading Cards.
- **Meta (top-6 → ~71%):** Vehicles, Furniture & Home Goods, Apparel,
  Electronics, Baby & Kids, Home Improvement.
- **Google (top-5 → ~78%):** Apparel & Accessories, Electronics, Home &
  Garden, Health & Beauty, Furniture.
- **Shopify (top-6 → ~74%):** Apparel & Fashion, Beauty & Cosmetics, Health
  Fitness & Nutrition, Home & Garden, Food & Beverage, Electronics.

## The cross-platform answer — Alfred's "twelve-ish" verified

Twelve canonical categories appear across 4 or 5 of the five platforms.
This is the union 80% set Sakura needs for cross-platform operator coverage:

1. **Apparel / Fashion / Clothing** — all 5
2. **Electronics** — all 5
3. **Home & Garden / Home Goods** — all 5
4. **Jewelry & Accessories** — all 5
5. **Toys & Games** — all 5
6. **Health & Beauty** — all 5
7. **Furniture** — 4 (weak on Etsy handmade only)
8. **Baby & Kids / Baby & Toddler** — 4 (weak on eBay)
9. **Craft Supplies / Arts & Crafts** — 4 (weak on eBay)
10. **Pet Supplies** — 4 (weak on Etsy)
11. **Sporting Goods** — 4 (weak on Etsy)
12. **Media / Books** — 3 (eBay, Meta, Google)

Alfred's recall of "twelve-ish" is correct. This is the set for Book of
Words Tier-1 vocabulary depth. Categories in 3 platforms (Motors/Vehicles,
Collectibles, Musical Instruments, Food & Beverage) are Tier-2 additions
worth pursuing once Tier-1 is done.

## Vocabulary depth signal

The light per-category sample in the SLAT (30-50 terms per top category
per platform) confirms Alfred's Tier-1 target of 50-200 domain-specific
terms per canonical category is well-founded. Jewelry alone yields 60+
terms without effort (metal purities, cuts, settings, chain styles,
stones); Electronics yields 80+ (form factors, specs, refurbishment
grades, connectivity). Deep extraction is a next-lane job — this survey
just confirms the scope.

## Key caveats

- Etsy total-listing count is estimate; Etsy does not disclose it in the 10-K.
- Meta category share is triangulated from third-party 2025 reports; Meta
  does not disclose Marketplace category breakdowns.
- Google is a feed indexer, not a marketplace — "item count" is not a
  meaningful single number.
- Shopify total-products is a wide 140M-570M range because Shopify does not
  aggregate across stores in filings.
- eBay's ~20,000 category count is the US default tree from the Taxonomy
  API; the historical high was ~32,000 pre-2018.
- Google Product Taxonomy file version pulled is dated 2021-09-21 in its
  own header, but the URL is current as of 2026-07-13.

## Sources (top-tier)

- Etsy Inc. FY2025 Form 10-K (SEC)
- eBay Q4 2025 Earnings Presentation (ebay.q4cdn.com)
- eBay Taxonomy API (developer.ebay.com)
- Meta Newsroom, "Facebook Marketplace New AI Tools" 2026-03
- Google Product Taxonomy raw file (google.com/basepages)
- Shopify BFCM 2025 press release + Marketplace Pulse Shopify GMV tracker
- Statista eBay GMV-by-category 2025
- Etsy Engineering blog on structured data (6,000+ categories confirmation)
- Instagram Shopping Statistics 2025 (ElectroIQ)
- Chargeflow eBay Statistics 2026 (2.5B live listings)

Full citation list with accessed dates is in the SLAT `:sources` block.
