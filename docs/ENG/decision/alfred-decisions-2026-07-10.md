---
slug: alfred-decisions-2026-07-10
title: Alfred decisions card — 2026-07-10
category: engineering
canonical: true
owner: architect
status: awaiting-alfred
last-reviewed: 2026-07-10
---

# Alfred decisions card — 2026-07-10

**Rule:** every question has a plain-language framing, options with tradeoffs, and Jess's recommended default. Alfred can answer in a single line like `1a, 2c, 3b, 4-skip` and the loop unblocks all of them at once. Skipping any question means "use Jess's default."

**How to reply:**
Write a line at the top of your reply. Format: `Qn<letter>` per question, separated by commas. Skip any Q by writing `Qn-skip` or omitting it (defaults will apply). Example: `Q1a, Q2a, Q3b, Q4a, Q5b, Q6b, Q7-skip, Q8a`.

**Time to answer:** ~5-10 minutes total. Every answer unblocks a lane or a merge.

---

## Q1. Curator PR #3 → PR #2 merge sequence

**The question in plain language.** Curator PR #2 (the language rewire fix) is CI-red because of three CI-config gaps. Curator PR #3 already fixes those three gaps and is CLEAN + MERGEABLE. Do you want to merge PR #3 into PR #2's branch, then merge PR #2?

- **a) Yes — merge PR #3 into PR #2's branch now, verify PR #2 flips to CLEAN, then merge PR #2 into main.** (Jess's default.)
- **b) No — hold PR #2 for now, keep PR #3 sitting. Reason?**
- **c) Merge both in one shot without the intermediate verification step.**

**Tradeoffs.** (a) is safest and gives us a clean signal PR #2 actually turns green with the CI fixes applied. (b) leaves the language-finish gate open indefinitely. (c) skips one verification tick but is fine if you trust the fix.

**Jess's default:** **a**.

---

## Q2. 23 sakura-scheme PR merge order

**The question in plain language.** 23 PRs are open on `Lacuna-Labs/sakura-scheme`, all CLEAN + MERGEABLE. No CI is configured. You need to authorize a merge order because chapter-content PRs will break the site build if landed before the theme + build-pipeline PRs.

- **a) Approve the recommended order: `#17 → #3 → #5 → #4 → #2 → 11 book/* → #6/#7/#19 → #18 → #21 → #8`.** Marcus merges in sequence, checks build after each. (Jess's default.)
- **b) Land D10 first (write CI workflow), then batch-merge the 23 with CI gating each merge.** Safer but adds 2-3 lane cycles.
- **c) Merge everything into a single integration branch first, resolve conflicts once, then FF into main.** Fastest but no incremental verification.

**Tradeoffs.** (a) is the recommended sequence and gives verification per merge. (b) is the "do it right" option and takes an extra day. (c) is the "get it done" option but risks a big conflict blob.

**Jess's default:** **a**.

---

## Q3. Sakura Scheme runtime gaps for chapters 6/8/9/10/11/14

**The question in plain language.** Six chapters have Run buttons that will error today because the runtime is missing `define-record`, `match`, `delay`/`force`/`await`, `guard`/`error`, `module`/`import`, and `sakura/complete`. Ship the features, or scope the chapters down?

- **a) Ship the features.** 8-16 lane cycles. Every chapter's Run button works as advertised. (Jess's default for long-term correctness.)
- **b) Scope down.** Mark those six chapters "runtime preview," remove the offending Run buttons, ship the language finish declaration on today's runtime. 1 lane cycle.
- **c) Split — implement `define-macro`/`guard`/`error?` (already scoped in D24), scope down `define-record`/`match`/`delay`/`sakura/complete` for later.** 3-4 lane cycles.

**Tradeoffs.** (a) is what the book promises but is the largest single ask in the burndown. (b) means the book ships partially-live but honest. (c) matches D24 (three small primitives) and lets the harder four defer to a proper design pass.

**Jess's default:** **c** — closes the beginner-shippable ask fast, defers the harder features to their own design cycle.

---

## Q4. Merge the pending mergeable Forge PRs

**The question in plain language.** Four Forge PRs are open: #7 (ruamel + Panel 6/7/10 read-side), #8 (revert PR #6 mobile-redesign), #9 (voice-lock + 64-panel land). All three are CLEAN + MERGEABLE. Merge them?

- **a) Yes, merge all three (PR #7 → PR #8 → PR #9).** (Jess's default.)
- **b) Just PR #9 for now; hold #7 and #8 for a look first.**
- **c) None — I want to look at each before merging.**

**Tradeoffs.** (a) unblocks the largest fan-out of Forge work (ruamel is a P0 correctness fix from the old burndown; voice-lock is a real bug fix; PR #8 reverts a redesign you rejected). (b) leaves ruamel and the rollback sitting. (c) is fine but every hour you don't touch these is an hour they age.

**Jess's default:** **a**.

---

## Q5. Curator push-hook narrowing for `feat/curator-consume-sakura-scheme`

**The question in plain language.** The final language rewire push is blocked because the pre-push hook runs full curator-api pytest → SSH timeout. `--no-verify` is correctly blocked by classifier.

- **a) Narrow the hook** — Marcus writes a scoped hook that only runs pytest when the diff touches `curator-api/` paths. Durable fix.
- **b) Alfred pushes it himself** — one-shot unblock from the workstation, hook keeps running everything.
- **c) Both** — Alfred pushes to unblock now, Marcus narrows the hook this week anyway.

**Tradeoffs.** (a) unblocks all future `curator-web` pushes but takes a lane cycle. (b) unblocks this one push in 30 seconds. (c) is safest for the long tail. (Jess's default.)

**Jess's default:** **c**.

---

## Q6. Automations pink-tier band ruling

**The question in plain language.** Lane G's engineering-doc theme has a tier band called "Pink tier." Doctrine says Sakura-pink `#E7A4B4` is HER-only, no decoration. Lane G used neutral rose `#B96A7A` as a stand-in.

- **a) Rename the tier** — call it "Rose tier" and use `#B96A7A`. Keeps pink strictly reserved.
- **b) Keep the name "Pink tier"** and use rose neutral for the band. (Jess's default — matches Lane G's stand-in.)
- **c) Actually use Sakura-pink for this one exception** — override the doctrine for engineering docs.

**Tradeoffs.** (a) is doctrine-clean but renames a tier you may have wanted. (b) preserves the tier name and uses a compliant color. (c) breaks the HER-only rule.

**Jess's default:** **b**.

---

## Q7. 8 OPEN DESIGN.md contradictions

**The question in plain language.** DESIGN.md § 14 preserves 8 contradictions rather than silently resolving them. You need to rule on each. Answer format: `Q7 <letter-per-item>` where each of the 8 gets a letter (or `skip` per item).

The 8 contradictions:
1. **Site pipeline:** (a) VitePress (b) custom pipeline (Lane B's `build-book.mjs`). Jess's default: **b** — Lane B's already built.
2. **Engineering-book count:** (a) 8 (b) 9. Jess's default: **b** — matches Lane G proposal count.
3. **WASM REPL bundle timing:** (a) now (b) after 1000-programs milestone. Jess's default: **b** — PREP.
4. **Challenges appendix location:** (a) in Reference book (b) standalone. Jess's default: **a** — matches book canon 16 lock.
5. **Card-vs-artifact boundary:** (a) card is trigger, artifact is content (b) they're the same primitive. Jess's default: **a** — matches Lane AA implementation.
6. **Chapter-number font:** (a) ligature-friendly display face (b) same as body. Jess's default: **a** — Lane B already set.
7. **Voice register:** (a) warm-competent with Sakura-pink callouts (b) flat-technical. Jess's default: **a** — matches book design spec.
8. **Shell-code-block runtime:** (a) live REPL mount (b) syntax-highlight only. Jess's default: **a** — Lane F built it live.

**Jess's default:** **b, b, b, a, a, a, a, a**.

---

## Q8. Slug-convention canonicalization for 31 broken `[[…]]` refs

**The question in plain language.** Chapters cross-ref each other via wiki-links like `[[book-of-music]]`, but Lane B's resolver only matches `[[music]]`. Pick a convention.

- **a) Bare-slug.** Rewrite the ~50 `book-of-X` refs to plain `X`. Matches disk, matches resolver. (Jess's default.)
- **b) Canonical `book-of-X`.** Rewrite Lane B's resolver to match. More work, more explicit refs.
- **c) Both.** Resolver accepts either. Maximum flexibility, more moving parts.

**Tradeoffs.** (a) is the fastest fix. (b) is more expressive but drags the resolver. (c) is the "let both work" option.

**Jess's default:** **a**.

---

## Q9. Chapter-authoring pass past ch 5

**The question in plain language.** Every canonical book has ch 0-5 authored. Doctrine target is 1000 programs per book. That's a program of work, not one lane.

- **a) Open a plan doc, defer to next sprint.** Sane. (Jess's default.)
- **b) Kick off an all-hands 32-lane authoring pass now.**
- **c) Author ch 6-10 for the top-4 books (Reason I, Systems, Money, Self) as a probe.**

**Tradeoffs.** (a) is honest about the scope. (b) is the biggest push you could commission this cycle. (c) is a probe to see how the doctrine holds up under scale.

**Jess's default:** **a**.

---

## Q10. lacunalabs.ai deployment ask

**The question in plain language.** Was mentioned in old burndown but never fired. Depends on D1 (VitePress build) landing.

- **a) Deploy `sakura-scheme.lacunalabs.ai` once D1 lands.** Standard subdomain routing. (Jess's default.)
- **b) Deploy at a different subdomain** — specify.
- **c) Hold — no public site this sprint.**

**Jess's default:** **a**.

---

## Q11. Flux intro art generation

**The question in plain language.** 24 Flux brief files exist at `docs/covers/<slug>.flux.txt`. No art generated yet. Costs Flux credits.

- **a) Generate all 24 now.** Full aesthetic pass. Flux batch. (Jess's default.)
- **b) Generate the 8 "fun books" only** (Music, Animation, Games, Self, One-Shot, Miscellany, Marionette, Sight arc). Skip the serious books' art for now.
- **c) Hold** — use HTML placeholder covers until later.

**Tradeoffs.** (a) is the complete book aesthetic. (b) is cheaper and keeps the serious books restrained. (c) delays but saves credits.

**Jess's default:** **a**.

---

## Q12. Meridian PR-opening

**The question in plain language.** `Lacuna-Labs/meridian` exists with 2 branches pushed but no PRs opened. What are those branches?

- **a) Open both as PRs, review normally.** (Jess's default.)
- **b) Delete one** (specify which — need the branch names first).
- **c) Hold — I'll look at them myself.**

**Jess's default:** **a**.

---

## Q13. sakura-corpus PR-opening

**The question in plain language.** Repo created + LFS remote live. Nothing pushed yet.

- **a) Push the current on-disk corpus** — Lane dispatched to bootstrap.
- **b) Hold** — don't push corpus until training authorization. (Jess's default — matches doctrine that corpus is training-adjacent.)
- **c) Push a small sample corpus** — enough for schema validation, defer bulk.

**Jess's default:** **b**.

---

## Q14. Curator adoption of the artifact system + Nordic palette

**The question in plain language.** Artifact system baked in HelloSurface (PR #19). Plan is to adopt in Curator. Curator's current card-detail modals are the legacy pattern.

- **a) Adopt now — pick top-3 modals** (shop card, chat card, run card), migrate. 4-6 lane cycles.
- **b) Hold** — bake in HelloSurface longer, adopt after 1 more week of live use. (Jess's default — Lane AA said "adopt after this bakes in HelloSurface.")
- **c) Adopt only the palette** (Nordic tokens into Curator's tokens.css), defer the artifact migration.

**Jess's default:** **b**.

---

## Q15. 22 curator `audit/*` + `burn/*` branches

**The question in plain language.** 22 branches, 27 days idle, cross 30-day archive line on 2026-07-13.

- **a) Priya walks each branch** — tags rebase/archive/delete, batch action per tag. (Jess's default.)
- **b) Blanket archive** — all 22 go to `refs/archive/`, keep git objects, remove from branch list.
- **c) Blanket delete** — reflog will preserve for 90 days if needed.

**Jess's default:** **a**.

---

## Q16. Night-watch script authorization

**The question in plain language.** Task brief mentioned this was HOLD long ago and never revisited. Is there a script on disk? What does it do? Do you want it enabled?

- **a) Priya finds any night-watch script on disk, reports what it does.** Alfred rules after. (Jess's default.)
- **b) Delete any night-watch scripts** — I don't want automated overnight actions.
- **c) Enable and describe the intended behavior** — Alfred provides the doctrine.

**Jess's default:** **a**.

---

## Q17. Public npm publication (sakura-scheme `"private": true`)

**The question in plain language.** `package.json` still has `"private": true`. L6 from old burndown was held for Alfred.

- **a) Publish public** — `npm publish --access public`. Lacuna org owns it. (Jess's default assumes yes because you shipped 23 PRs preparing it.)
- **b) Keep private** — internal-only, `test/hello-surface-fixup` dead-end release.
- **c) Wait for post-training** — publish after 1001-card test proves the language yields.

**Jess's default:** **a**.

---

## Answer format template (copy this line and fill it in)

```
Q1a, Q2a, Q3c, Q4a, Q5c, Q6b, Q7 b/b/b/a/a/a/a/a, Q8a, Q9a, Q10a, Q11a, Q12a, Q13b, Q14b, Q15a, Q16a, Q17a
```

The above line is Jess's defaults strung together — you can literally copy it as-is if you want to greenlight all defaults.

## What happens after you answer

The loop runner (`loop-runner-2026-07-10.md`) reads your answer, updates the burndown items with your rulings, closes the AWAIT-ALFRED flags, and dispatches the unblocked lanes on the next tick.
