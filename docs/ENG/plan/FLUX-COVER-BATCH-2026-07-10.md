---
slug: flux-cover-batch-2026-07-10
title: Flux cover batch — 24 covers via local Mac Studio painter (Q11 prep)
category: infra
status: prep
owner: Marcus
---

# Flux cover batch — local Mac Studio painter

## What lands in this PR

- `scripts/generate-covers-flux.mjs` — a Node driver that reads every
  `site/covers/*.flux.txt` brief, writes a `_manifest.json` at
  `site/covers/art/`, and (when passed `--run`) shells out to the local
  painter through Curator's `flux_runner.py` API.
- This doc — the run plan and safety notes.

## Held: execution

The PR only ships the driver. The batch itself is held on Alfred per the
Q11 instruction ("if there's a local-Flux driver script, batch-submit;
if not, produce a proposal script that would drive them but hold
execution"). No cloud credits are burned by the driver; local mflux
runs on Alfred's Mac Studio at zero cash cost, but a full 25-cover
`dev`-model batch takes ~25 × 60-120 s = 25-50 minutes on the box.

## Run instructions

Dry-run (produces the manifest, no painter call):
```bash
node scripts/generate-covers-flux.mjs
```

Batch all 25 covers:
```bash
node scripts/generate-covers-flux.mjs --run
```

Single cover (useful for iterating):
```bash
node scripts/generate-covers-flux.mjs --run --only book-of-music
```

## Environment

| Var | Purpose | Default |
|---|---|---|
| `CURATOR_API_ROOT` | Where Curator's Python venv + flux_runner lives | `~/code/curator/curator-api` |
| `CURATOR_VENV_PY`  | Python interpreter with mflux importable       | `$CURATOR_API_ROOT/.venv/bin/python` |
| `MFLUX_BIN`        | Painter binary (read by flux_runner)           | Curator default |
| `FLUX_BASE_MODEL`  | `dev` (pretty, slower) or `schnell` (fast)     | `dev` |
| `FLUX_STEPS`       | Override step count                            | 15 for `dev`, 2 for `schnell` |
| `COVERS_OUT_DIR`   | Override output dir                            | `site/covers/art/` |

## Vendor-naming discipline

The driver refers to "the painter" and "the local model" in every log
line. The vendor name (`mflux`) appears only in the env var `MFLUX_BIN`
(developer-machine config, not operator-visible) and in the Python
wire-call inside Curator. Same discipline as the Dreamhouse widget.

## What ships next after Alfred's go

1. Run the batch on Mac Studio.
2. Sanity-eyeball each of the 25 PNGs.
3. Wire the images into the cover templates via `<img src="/covers/art/<slug>.png">`
   in the composed HTML placeholder art positions.
4. Commit the PNGs (LFS-gated by extension in `.gitattributes`).
