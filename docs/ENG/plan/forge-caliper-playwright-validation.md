# Forge · Caliper + Playwright validation — 2026-07-09

**Author:** Lacuna Worker (Caliper + Playwright validator)
**Target:** `http://127.0.0.1:7777` (Forge web, rolled-back "safe" state)
**Verdict:** rolled-back state validates cleanly after two small JS fixes. Training + web PIDs both healthy the whole run.

---

## Executive summary

| Layer | Result |
|---|---|
| Layer 1 · HTTP smoke (45 GET routes) | 45/45 non-500. 3 x 422 for path-param-required endpoints, expected. |
| Layer 2 · Playwright browser test on `/runs/sakura-4b-v2` | **12/12 assertions pass** (after fixes). Two real bugs found + fixed. |
| Layer 3 · Caliper scenario compile | Compiled cleanly to Playwright TS (dev-mode `CALIPER_DEV=1`). Emitted TS is idiomatic. |
| Layer 4 · Slat integrity | `slat_reader`, `slat_writer`, `slat_jsonl`, `__init__` all importable in Forge venv. 42/42 non-UI-audit tests pass. |
| Training run pid 96914 | Untouched. Elapsed 03:37 at end (was 03:30 at start). Iter 2400 → 2450 during run (~10 min). |
| Web server pid 43127 | Untouched. Not restarted (JS was a static-asset fix, no reload needed). |

## Server state — before/after

**Before:**
- pid 43127, uvicorn on 0.0.0.0:7777.
- pid 96914, MLX LoRA trainer on sakura-4b-v2, iter ~2300.
- Server code = rolled-back local `main` (no `stops_continues`, no `narrator`).
- Slat files preserved at `~/code/forge/forge/corpus/slat_*.py`.

**After:**
- pid 43127 alive (10:35 elapsed) — never restarted.
- pid 96914 alive (03:37:31 elapsed) — never touched.
- Two small JS fixes committed on branch `fix/validation-2026-07-09` (no PR opened per instructions).

## Layer 1 — HTTP smoke

45 GET routes probed. All return 2xx or 4xx (no 5xx). Full log in `artifacts/forge-validation-2026-07-09/layer1-smoke.txt`.

- 42 routes return 200.
- 3 routes return 422 (`/api/baseline-gen/sample`, `/api/abel/by-cart`, `/api/corpus/peek`) because probe called them without required query params — expected validation behavior, not a bug.
- Static assets served with correct MIME (`text/css`, `text/javascript`).

## Layer 2 — Playwright browser test

Test script: `/tmp/forge_playwright.py` (Python 3.12 + `playwright==1.61.0` installed into Forge venv; Chromium browsers already present at `~/Library/Caches/ms-playwright/`).

### Initial run — 10/12 pass, 2 real failures

1. **JS error (fired twice):** `TypeError: Cannot read properties of null (reading 'replaceChildren') at refresh (forgeweb.js:357:14)`
2. **404:** `GET /avatars/3d194c25da20b0d0e13d208e6f5b58cf.svg`

### Root cause — bug #1 (the real one)

`run-detail.html` sets `<body data-page="runs" data-run-name="{{ name }}">` so the topbar highlights the "Runs" tab. The JS boot dispatcher (`forgeweb.js:1967-1976`) fires `initRuns()` whenever `data-page === "runs"`, unconditionally. `initRuns()` looks up `$("runs-list")` — the list container that only exists on `/runs`, not on `/runs/{name}` — so `root` is `null`, and the poll loop later calls `root.replaceChildren(...)` and crashes. The 5s poll interval explains why the error fired repeatedly.

Same class of bug on `/models/{owner}/{repo}` — confirmed by loading it and seeing `Cannot read properties of null (reading 'addEventListener')` from `initModels()`.

### Root cause — bug #2 (cosmetic)

`GET /api/hf/whoami` returns `"avatarUrl":"/avatars/<hash>.svg"` — a relative path from HuggingFace's API that the browser resolves against Forge's origin, not HF's. Forge doesn't proxy avatars, so the request 404s. This is presentational only, but it counts as a console-error in the "no console errors" assertion.

### Fix — single file, 20+/7- lines

Branch: `fix/validation-2026-07-09` (local only, no PR).
File: `web/static/forgeweb.js` (static asset — the running uvicorn serves fresh JS on the next page load, no restart required).

1. Dispatcher: skip `initRuns()`/`initModels()` when the corresponding detail-page dataset attribute is present.
2. HF chip: only render `<img>` for an absolute-URL `avatarUrl`; otherwise fall back to the existing dot placeholder.

Diff (both hunks in one file):

```javascript
// before
if (page === "models")  initModels();
if (page === "runs")    initRuns();
if (page === "system")  initSystem();
if (document.body.dataset.repoId) initModelDetail();
if (document.body.dataset.runName) initRunDetail();

// after
const isRunDetail = !!document.body.dataset.runName;
const isModelDetail = !!document.body.dataset.repoId;
if (page === "models" && !isModelDetail) initModels();
if (page === "runs" && !isRunDetail)     initRuns();
if (page === "system") initSystem();
if (isModelDetail) initModelDetail();
if (isRunDetail)   initRunDetail();
```

```javascript
// HF chip
const avatarAbs = j.avatarUrl && /^https?:\/\//i.test(j.avatarUrl);
chip.replaceChildren(
  avatarAbs ? h("img", { src: j.avatarUrl, alt: "", class: "hf-avatar" })
            : h("span", { class: "hf-dot" }),
  ...
);
```

### After-fix run — 12/12 pass

```
[PASS] root_loads_200
[PASS] h1_has_run_name              actual="sakura-4b-v2"
[PASS] loss_svg_has_children        actual=5
[PASS] lineage_svg_has_children     actual=3
[PASS] log_tail_populated           actual_len=11595
[PASS] run_block_populated          actual_len=89
[PASS] iter_indicator_matches_log   log_iter=2450  page_iter=2450
[PASS] details_open_cleanly         count=0 (no <details> in current template)
[PASS] no_page_errors               errors=[]
[PASS] no_console_errors            errors=[]
[PASS] no_static_or_api_404s        404s=[]
[PASS] no_visible_error_text        errors=[]
```

Also verified `/models/mlx-community/Qwen3-4B-4bit` now loads with zero page errors.

Screenshots: `artifacts/forge-validation-2026-07-09/01-root.png`, `02-run-detail.png`.
Full JSON: `artifacts/forge-validation-2026-07-09/layer2-playwright.json`.
Logs: `layer2-playwright{-after-fix,-after-fix2}.log`.

## Layer 3 — Caliper scenario

Wrote `artifacts/forge-validation-2026-07-09/forge-run-panel.yaml` — 10-step scenario matching the Layer 2 assertions (goto, wait-for run-block + loss svg, assert-visible on h1/loss/lineage/log-tail, screenshot, assert-no-error).

- `CALIPER_DEV=1 node dist/cli/index.js scenario validate forge-run-panel.yaml` → **ok: 1 scenario(s)**
- `CALIPER_DEV=1 node dist/cli/index.js scenario emit forge-run-panel.yaml` → wrote `forge-run-panel.spec.ts` (23 lines, clean Playwright TS).

Emitted file wires `pageerror` + `console.error` listeners exactly as the Python test does. To actually execute the emitted TS you need `@playwright/test` and a Playwright test runner project — Caliper compiles, it does not run Playwright itself yet (that's a follow-up: `caliper scenario run <path>` would be the natural next verb).

For this validation the Python Playwright test carried the same assertions and executed them successfully. Layer 3 confirms the DSL side of the chain works.

Artifacts: `forge-run-panel.yaml`, `forge-run-panel.spec.ts`.

## Layer 4 — Slat integrity

- `~/code/forge/forge/corpus/{__init__.py, slat_reader.py, slat_writer.py, slat_jsonl.py}` — all present.
- `from forge.corpus import slat_reader, slat_writer, slat_jsonl` — imports OK in the Forge venv.
- `slat_reader` exports include `SlatValue, SlatSyntaxError, load, loads, dump, dumps, dumps_pretty, jsonl_to_slat, slat_to_jsonl, round_trip_verify` — surface intact.

### Forge test suite

```
tests/test_loom.py             — pass
tests/test_notify.py           — pass (skipped in some envs)
tests/test_restart_lineage.py  — pass
tests/test_static_ui_audit.py  — 3 FAIL, 5 pass
```

The 3 failures are all in `test_static_ui_audit.py` and check for elements from the merged PR-#1/#3 template that was ROLLED BACK: `ls-status`, `lac-light`, `lac-status` status chip IDs, "SRE summary" / "batch fingerprint" / "GPU contention" v2 insight panels. These tests are stale against the current rolled-back template — they were shipped alongside the PRs that were rolled back. **Not touching them** — that's a decision to be made when Alfred decides whether to re-land the merged UI.

- 47 pass / 3 fail (stale) / 1 skip overall.
- 42/42 pass when the stale suite is excluded.

## Blockers / decisions needed

1. **`test_static_ui_audit.py` is stale.** Options: (a) delete now, (b) skip-mark with a note referencing the rollback, (c) leave and revisit when the merged UI decision lands. I did nothing — Alfred's call.
2. **Feature branch not pushed and no PR opened** per instructions. Branch is `fix/validation-2026-07-09` on `~/code/forge`. Ready when you say.
3. **Caliper `scenario run`** would close the loop end-to-end (compile → execute → report). Not blocking, worth a follow-up.

## Safety accounting

- No signal, kill, or restart sent to pid 96914. Elapsed 03:30 → 03:37 during validation (live iter 2400 → 2450 in `train.log`).
- No signal, kill, or restart sent to pid 43127. Elapsed reached 10:35 — server was never bounced (fix was in a static JS asset, served fresh on next page load).
- `~/.forge/runs/` opened read-only (only for `tail` of `train.log`).
- No source under `scripts/locked_lora.py`, `resume-offset.json`, corpus readers, or slat modules touched.
- Fix is 27 lines in one file (`web/static/forgeweb.js`) — well under the 50-line budget.

## Artifacts

Directory: `~/code/lacuna-docs/engineering/artifacts/forge-validation-2026-07-09/`

- `layer1-smoke.txt` — every route + status
- `layer2-playwright.log`, `layer2-playwright.json`, `layer2-playwright-after-fix.log`, `layer2-playwright-after-fix2.log`
- `01-root.png`, `02-run-detail.png` — screenshots
- `forge-run-panel.yaml` — Caliper scenario source
- `forge-run-panel.spec.ts` — emitted Playwright TS
