---
slug: forge-restart-burndown-2026-07-10
title: Forge restart burndown — infrastructure to complement Weave 2.0 recovery
category: engineering
canonical: true
authored: 2026-07-10
authors: [claude]
owner: alfred
complements: WEAVE-2.0-BURNDOWN-2026-07-10.md
---

# Forge restart burndown

The Weave 2.0 burndown (`WEAVE-2.0-BURNDOWN-2026-07-10.md`) handles the *training-side* recovery of sakura-4b-v2 from incident 6: kill trainer, seed adapter, patch config, resume. This doc handles the *forge-side* infrastructure that makes the restart durable, observable, and non-recurring.

Where they meet: R-08 (Weave 2.0) launches the trainer; F-01…F-04 (this doc) make sure the trainer stays up, the class recognizer fires, and the operator sees the state.

Read the Weave 2.0 burndown first for the training-side context and for what R-01…R-10 already covers.

## Status snapshot (2026-07-10 evening)

- **Trainer:** stopped. Damaged run archived. Fresh adapter seeded. `train.cfg` patched. Ledger updated. **Launch blocked on missing `gpu_lock` source** (see Weave 2.0 R-08 for options).
- **General-purpose forge tools shipped tonight:** `~/code/forge/tools/kill-trainer.sh`, `~/code/forge/tools/relaunch-trainer.sh`. Both discovery-based, idempotent, guarded.
- **Service manager daemon:** designed in Weave 2.0 procedure doc §"Memory-aware service management", not built.
- **Pike watchdog:** designed in Weave 2.0 procedure doc + burndown S-01/S-05, not built. Class recovery playbooks now enumerated in procedure doc §"The six failure classes".
- **Forge UI panels for the new telemetry** (`batch_total_size`, `grad_norm_pre_clip`, `adam_m_v_ratio`, `val_subgroup_breakdown`, `memory_pressure`, `Service Availability`, `Corpus Scan`): all specified, none built.

## Phase F1 — the two shipped tools (document what exists)

| ID | Item | Cycles | Status |
|---|---|---|---|
| **F1-01** | Catalog `~/code/forge/tools/kill-trainer.sh` in the forge docs. Design intent: discovery-based (finds trainer by process pattern, not pid); graceful SIGTERM with 15s escalation to SIGKILL; `--dry-run` + `--keep-services` flags; memory report before/after. | S | tool shipped; doc pending |
| **F1-02** | Catalog `~/code/forge/tools/relaunch-trainer.sh` in the forge docs. Design intent: venv-python resolution; preflight (checks trainer not already running, adapter exists, cfg exists, launcher exists); `nohup` with log redirect; reports new pid + tail hint. | S | tool shipped; doc pending |
| **F1-03** | Add a `--rebuild-corpus` flag to `relaunch-trainer.sh` that regenerates `~/.forge/corpus/sakura/train.jsonl` from the corpus tree before launch. **This is the flag that enforces "restart after corpus refresh, not before."** | M | not started |
| **F1-04** | Add a `--verify-seed` flag: runs the pre-training corpus scan (procedure doc §"Pre-training corpus scan") against the target seed and refuses to launch if a landmine sits within N iters of the resume position. | M | not started |

## Phase F2 — gpu_lock recovery

Trainer's `locked_lora.py:41–42` depends on `~/code/curator/scripts/forge_watch/gpu_lock.py`. Source was never committed. Only the .pyc cache exists (1971 bytes). This is R-08's blocker.

| ID | Item | Cycles | Notes |
|---|---|---|---|
| **F2-01** | Try `pip install decompyle3` + decompile the `.pyc`. Python 3.12 support is patchy but the file is small. | S | Cheap. If it works, F2-02 is skipped. |
| **F2-02** | Write `gpu_lock.py` from scratch. Contract: `with gpu_lock():` — file-lock context manager that serializes GPU-heavy work between processes via `~/.forge/locks/gpu.lock`. Also `mini_scorecard.py` (larger `.pyc`; 16 KB). | S | ~50 LOC each. No reference; write from contract. |
| **F2-03** | Commit the restored/rewritten files to a repo (curator/scripts/forge_watch/ OR forge/scripts/). Preferred: **forge**, since forge is where they logically belong and where locked_lora.py runs from. This also lets us drop the `sys.path.insert(0, ...curator/scripts/forge_watch)` monkeypatch. | S | Follow-on refactor after F2-01 or F2-02 succeeds. |
| **F2-04** | Add a check to `relaunch-trainer.sh` that verifies gpu_lock is importable **before** nohup-forking the trainer. Fails fast with a diagnostic. | S | Preflight step. Avoids the repeat of tonight's diagnostic silence. |

## Phase F3 — pike watchdog (S-01 from Weave 2.0)

`~/.forge/scripts/pike-watchdog.py` — polls the trainer telemetry, matches against the six failure-class signatures, executes the recovery playbook per class.

| ID | Item | Cycles | Notes |
|---|---|---|---|
| **F3-01** | Poll loop: tails `train.log`, computes `train_loss` rolling window, `grad_norm_pre_clip`, `adam_m_v_ratio`, `batch_total_size`, `memory_pressure`. Emits to `~/.forge/watchdog.slat`. | M | ~150 LOC. |
| **F3-02** | Classifier: for each poll, matches current signal shape against the six class signatures (procedure doc §"The six failure classes"). Emits class assignment + confidence. | M | Rule-based first (deterministic). LLM-classifier optional later. |
| **F3-03** | Recovery dispatcher: for auto-authorized classes (2, 3, 4, 6), executes the recovery playbook. For manual classes (1, 5), alerts Alfred via `~/.lacuna/alerts.slat` and pauses training. | M | Wraps `kill-trainer.sh` + adapter reseed + `relaunch-trainer.sh`. |
| **F3-04** | Cooldown: after any recovery, watchdog stops firing for 500 iters (stability window). Prevents oscillation. | S | Config in `~/.forge/watchdog.cfg`. |
| **F3-05** | Novel-class handler: signal shape that matches no class → alert Alfred → open a "novel-class" slat record for later doctrine review. | S | Never auto-recover on novel signatures. |

## Phase F4 — service manager (S-01…S-06 from Weave 2.0)

`~/.forge/scripts/service-manager.py` — polls memory pressure, kills/starts supplementary services (chat_probe, scorecard_poller, live_signs) per policy. Full design in procedure doc §"Memory-aware service management".

| ID | Item | Cycles | Notes |
|---|---|---|---|
| **F4-01** | Daemon skeleton: poll every 30s, read `vm_stat`, compute headroom. | S | ~80 LOC. |
| **F4-02** | Instrument each supplementary service with `--report-memory-footprint` at startup; cache in `~/.forge/service-footprints.json`. | S | 5-line addition per service. |
| **F4-03** | Rules engine: <2 GB → evict largest; <4 GB → no new services; ≥6 GB → allow standing; ≥10 GB → allow concurrent generate calls. | S | Config-driven. |
| **F4-04** | Trainer-restart coordination: on `kill-trainer.sh` invocation, service-manager kills all supplementary services. On trainer's first-500-iter stability window pass, restart services one at a time. | S | Hook via signal file `~/.forge/trainer-restart.flag`. |
| **F4-05** | Emit `~/.forge/service-availability.json` for UI to read. Format: `{service: {status, needs_gb, free_gb, eta_iter, reason}}`. | S | Feeds F5-02. |

## Phase F5 — Forge UI panels

Forge dashboard renders the new telemetry + operational state. All specified in procedure doc; none built.

| ID | Item | Cycles | Notes |
|---|---|---|---|
| **F5-01** | Panel: **Batch Total Size** — timeseries over last 5000 iters. Highlights positions where sum > 2× `max_seq_length`. Click a spike → landmine record. | M | Feeds off `train.log`. |
| **F5-02** | Panel: **Service Availability** — three rows (chat_probe, scorecard_poller, live_signs). Each shows status + ETA reason. Powered by F4-05. | M | |
| **F5-03** | Panel: **Val Subgroup Breakdown** — stacked-line chart of val loss per corpus branch. Class-5 detector. | M | Requires trainer to emit per-branch val, which it currently doesn't (Weave 2.0 D-02 follow-up). |
| **F5-04** | Panel: **Adam m/v Ratio** — timeseries with warning bands at ratio thresholds. Class-3 + class-4 co-signal. | M | |
| **F5-05** | Panel: **Corpus Scan** — pre-run tab that reports landmines per seed and per resume position. Powered by F1-04 logic. | M | |
| **F5-06** | Panel: **Watchdog Ledger** — timeline of pike detections, class assignments, recovery actions taken, cooldown windows. Reads `~/.forge/watchdog.slat`. | M | |
| **F5-07** | Banner: memory-critical stage warning. "We're about to begin a stage that requires X GB. Service Y will be unavailable for ~Z min." | S | Text pulled from service-manager config. |

## Phase F6 — Loam telemetry rollup (from memory reference)

Per the "run/call telemetry = oracle-labeled corpus" memory: every verb-call and every training run gets tracked in 64-bit counters. Loam rolls up to weeks/months. Interp is the oracle so counts double as training labels.

| ID | Item | Cycles | Notes |
|---|---|---|---|
| **F6-01** | Trainer emits per-iter to a rolling `~/.forge/run-counters.slat` (train_loss, grad_norm, adam_ratio, mem_pressure). 64-bit counters roll up hourly → Loam. | M | Design references Cortex write-time pre-materialization pattern. |
| **F6-02** | Loam rollup script: consumes `run-counters.slat`, aggregates to hour/day/week granularity, writes `~/.forge/loam/` tree. | M | |
| **F6-03** | Corpus label emission: each run's counters double as oracle labels for the atoms used in that run's batches. Emits to `~/.forge/corpus/labels/`. | L | Feeds the sakura-4b-v3 training corpus. |

## Sequencing

```
Now:                    F2-01 (try decompile) → F2-02 (rewrite if needed) → F2-04 (preflight)
Once trainer restarts:  F3-01, F3-02, F3-03 (watchdog online for the currently-training run)
This week:              F4 (service manager) + F5-02 (service panel) + F5-04 (adam panel)
Next week:              F5-01, F5-03, F5-05, F5-06, F5-07 (remaining panels)
Later:                  F6 (Loam telemetry rollup)
```

F1-03 + F1-04 (`--rebuild-corpus`, `--verify-seed`) are the **structural** additions that enforce the Weave 2.0 sequencing at the tool level. They can be built at any point but pay for themselves before the next restart.

## What this doc does NOT cover

- Training-side recovery (Weave 2.0 R-01…R-10). Owned by `WEAVE-2.0-BURNDOWN-2026-07-10.md`.
- Corpus atom authoring (Weave 2.0 C-01…C-07). Owned by Jess lanes; 600+ atoms landed in PRs #53–56 tonight.
- Doctrine formalization (Weave 2.0 D-01…D-04). Class taxonomy now formalized in the procedure doc.
- Cross-tenant/Lacuna handoff (Weave 2.0 L-01…L-04). Later.

## Cross-references

- Weave 2.0 procedure: `~/code/lacuna-labs/research/lacuna-docs/specs/WEAVE-2.0-PROCEDURE-2026-07-10.md`
- Weave 2.0 burndown (training-side): `~/code/lacuna-labs/research/lacuna-docs/engineering/WEAVE-2.0-BURNDOWN-2026-07-10.md`
- Kill tool: `~/code/forge/tools/kill-trainer.sh`
- Relaunch tool: `~/code/forge/tools/relaunch-trainer.sh`
- Trainer run dir: `~/.forge/runs/sakura-4b-v2/`
- Trainer launcher: `~/code/forge/scripts/locked_lora.py`
- Missing dep: `~/code/curator/scripts/forge_watch/gpu_lock.py` (source lost; `.pyc` remains)
