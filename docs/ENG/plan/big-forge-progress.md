---
slug: big-forge-progress
title: Big Forge Plan · Weekend Ship Progress
category: engineering
last-reviewed: 2026-07-09
---

# Big Forge Plan · Weekend Ship Progress

Companion to `THE-BIG-FORGE-PLAN.md`. Tracks what landed for the weekend
tranche (Part V + Part I ship-list 6-11, 24, 31, 32).

## Landed 2026-07-09

### Part V — Optimizer state persistence

- **File:** `~/code/forge/scripts/locked_lora.py`
- **Shape:** monkeypatch, ~30 lines core + ~90 lines including hooks and
  meta emission. Code lands for the *next* resume — the live trainer
  (pid 96914 as of this ship) already imported the module; the new
  behavior does not affect it.
- **Save-hook** — wraps `mx.save_safetensors` at module scope. When a
  filename matches `\d{7}_adapters\.safetensors`, writes a sibling
  `{it:07d}_optimizer.safetensors` (from `_current_optimizer.state`,
  flattened via `mlx.utils.tree_flatten`) plus a
  `{it:07d}_optimizer.meta.json`
  `{iter, lr, warmup_steps_completed, hash_of_optimizer_state,
    n_tensors, mlx_version, timestamp, timestamp_iso}`.
  Failure to save the sibling does NOT abort adapter save.
- **Restore-hook** — installed via `_install_trainer_hook()` that wraps
  `mlx_lm.tuner.trainer.train`. Captures the optimizer, then, if
  `args.resume_adapter_file` was set (captured via
  `_install_lora_hook()`), looks for the sibling optimizer safetensors.
  - Present + shape matches → `mxu.tree_unflatten` and assign
    `optimizer.state`. Log `[locked_lora] optimizer state restored ...`
  - Absent → warn `[locked_lora] WARN: no optimizer sibling found ...
    Recommend warmup>=500 in train.cfg.`
  - Shape mismatch → raise RuntimeError with FATAL prefix. Aborts.
- **Grad-norm ring** — added a ~50-slot ring buffer inside
  `_clipped_update` (iter markers only; the norm arrays themselves are
  materialized inside the compiled step and are not safe to eval there
  — same crash mode as the pre-existing NOTE). Drained to
  `{run_dir}/gradnorm.jsonl` on each optimizer save. Panel 6 reads it.

### Insights v2 — 8 weekend panels

All 8 land as additive JSON fields on the existing
`/api/watch/insights/{name}` endpoint. HTML `<details>` blocks added
inside the existing insights `rd-card`. Existing 16 panels unchanged.

| # | Slug | JSON field | HTML id | Backing source |
|--:|---|---|---|---|
|  7 | `adam-moment-health` | `adam_moment_health` | `ins-adam-moment` | Part V `_optimizer.meta.json` |
|  9 | `warmup-sanity` | `warmup_sanity` | `ins-warmup-sanity` | train.cfg + train.log + optimizer meta |
| 24 | `optim-state-integrity` | `optim_state_integrity` | `ins-optim-integrity` | Part V meta hashes |
|  6 | `grad-norm-v2` | `grad_norm_v2` | `ins-grad-norm-v2` | `gradnorm.jsonl` from Part V |
|  8 | `batch-fingerprint` | `batch_fingerprint` | `ins-batch-fingerprint` | segmented train-loss profile |
| 10 | `gpu-contention` | `gpu_contention` | `ins-gpu-contention` | timeseries ips vs median baseline |
| 31 | `token-length-dist` | `token_length_dist` | `ins-token-length-dist` | timeseries tps percentiles |
| 32 | `sre-summary` | `sre_summary` | `ins-sre-summary` | synthesis of 7 above (rendered `open` by default at the top of the accordion) |

Each panel:
- Ships with a graceful "no data yet — populates on next checkpoint"
  fallback when the backing source doesn't exist (Part V hasn't fired
  its first save; ledger absent; etc.).
- Has an ask-Lacuna button, matching the pattern of existing panels.
- Emits alarm chips per the plan's thresholds.

### Live-run smoke result

Ran the server helpers against `~/.forge/runs/sakura-4b-v2` (the live
pid-96914 run). Results (2026-07-09 evening):

- `optimizer_metas`: 0 (expected — Part V hook lands for next restart)
- `warmup_sanity`: warmup=500, is_resume=True, hard_fail=False, warn=False
  (matches Alfred's live cfg — warmup=500 is exactly the Incident-5 fix)
- `optim_state_integrity`: n_saves=0, panel shows "populates on next checkpoint"
- `grad_norm_v2`: no data yet, panel shows populate-on-next-save note
- `batch_fingerprint`: 3 segments (rollback ledger), delta>40% between
  seg-1 and seg-2 → RED. Matches known history.
- `gpu_contention`: baseline ips=0.192, 8 dips detected (likely
  val-eval-induced pauses — noted for follow-up threshold tuning)
- `token_length_dist`: p99=136.8 (well under 2000 — post-chop corpus)
- `sre_summary`: overall=RED (2 reds — fingerprint alarm + a false-positive
  contention alarm; 3 yellows for the 3 no-data-yet panels; 2 greens)

## Deferred to week-two

- Panels 11 (`thermal-state`), 19 (`val-subgroup`), 20 (`seed-sensitivity`),
  25 (`resume-latency`), 21 (`ckpt-recovery-cost`), and all `-v2` reworks
  (1, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 27).
- The Part I §I.2 lane split (Health · Deep · SRE segmented control) —
  segmented control not added yet; the new SRE panel opens by default.
- Grad-norm actual per-step numeric values. Ring buffer currently
  publishes iter-only markers (materializing the norm array inside the
  compiled step crashes the way the pre-existing NOTE in `_clipped_update`
  documents; needs a separate uncompiled path — a training_callback hook
  is one option).
- `gpu_lock` event-annotation stream for panel 10 (adds context to dip
  events; format not standardized yet).

## Follow-up items to close

1. **Adam moment ratio.** Part V's meta.json currently stores
   `hash_of_optimizer_state` (a shape hash) and `n_tensors`. Panel 7
   presents a proxy (1.0 if meta exists, else 0.0) until Adam's actual
   `‖m‖/‖v‖^0.5` is added to the meta emission. That extra computation
   is straightforward — iterate the flattened state, group by `m`/`v`
   suffix, compute per-key ratios, mean — but adds ~1-2s per save on
   the ~250-tensor rank-128 adapter. Land in a follow-up patch after
   next restart proves Part V's happy path.
2. **Grad-norm materialization.** Same "uncompiled path" work as
   above; needs a mid-training callback that eval's outside the compiled
   step (safer via TrainingCallback.on_train_loss_report).
3. **GPU-contention threshold.** Current 30% drop threshold is
   trigger-happy against val-eval-induced ips wobble. Filter to
   training-only reports, or exclude the eval-step reports.

## Files touched

- `~/code/forge/scripts/locked_lora.py` — 72 → 290 lines (net +218)
- `~/code/forge/web/server.py` — inserted 8 helpers (~220 lines) and 8
  new fields in `api_watch_insights` return value
- `~/code/forge/web/templates/run-detail.html` — 8 new `<details>` blocks
  in the insights `rd-card`, 8 new JS renderers, wired into
  `pullInsights` fetch cycle. Existing panels untouched.

## Verification

- Python syntax check: both `locked_lora.py` and `server.py` parse cleanly.
- Full module import of `locked_lora` in an isolated subprocess: no runtime
  errors; all hook-installation side effects fire as expected.
- Full module import of `server`: no runtime errors.
- HTML parses cleanly (html.parser).
- All 6 script chunks in `run-detail.html` have balanced braces + parens.
- Live-data helper runs (above) return well-formed responses on the live
  sakura-4b-v2 run without crashing.
