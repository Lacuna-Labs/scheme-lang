---
slug: deploy-vitepress-2026-07-10
title: VitePress deployment prep — 2026-07-10
category: infra
status: prep
owner: Marcus
---

# VitePress deployment prep

## What lands in this PR

- `.github/workflows/docs.yml` — a `workflow_dispatch`-only Pages build that runs `npx vitepress build docs` and publishes to GitHub Pages. Manual for now; flip the `push` trigger back on once the domain lands.
- This doc — the pre-flight checklist for Alfred.

## What still needs Alfred's hand

- **DNS record.** `scheme.lacunalabs.ai` → CNAME `Lacuna-Labs.github.io` (or an A record set to the GitHub Pages IPs). Needs Alfred to update the DNS at the registrar.
- **GitHub Pages custom domain.** After the workflow runs once, set the custom domain in `Settings → Pages → Custom domain` to `scheme.lacunalabs.ai` and enforce HTTPS.
- **Repository settings.** `Settings → Pages → Source` must be set to "GitHub Actions" (not "Branch" — the artifact upload path only works with Actions source).

## Why manual for now

- No first hand-run has passed on this repo.
- The Q7 DESIGN.md ruling picked the custom pipeline (Lane B's `build-book.mjs`) over VitePress for the canonical book. VitePress is still valuable for the reference + engineering-doc shell, but the shape of what actually publishes needs an Alfred call.
- `main` is still catching up on 23 open PRs; publishing before those land would ship a partial site.

## After Alfred confirms

1. Flip the trigger back on:
   ```yaml
   on:
     push:
       branches: [main]
       paths:
         - 'docs/**'
         - 'package.json'
         - '.github/workflows/docs.yml'
     workflow_dispatch:
   ```
2. Merge this PR.
3. Manually dispatch the first run to seed Pages.
4. Wire the domain per the checklist above.
