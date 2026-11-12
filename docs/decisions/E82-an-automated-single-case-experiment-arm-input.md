# E82. An automated single-case experiment arm: input-first Russian vs Slovak control (2026-11-08, branch `t3/pronunciation-principles-review`)

**Why:** the owner asked to test whether listening-first improves listening faster than the normal plan ("take me out of the loop"), comparing Russian on the input-first arm against Slovak on the normal control over a 42-day study (2026-11-11 to 2026-12-22). Single-case interrupted time-series design (SCED v3, [docs/experiments/input-first-russian.md](../experiments/input-first-russian.md)) with randomized onset (uniform draw between days 12 and 22).

**How to apply:**
- `INPUT_FIRST_TASKS = ["review", "listen", "words", "read", "watch"]` (`src/core/curriculum.ts`). Drops `lesson`, `strengthen`, `blitz`, `speak`, and `fluency` (which records mic output).
- Deterministic PRNG (`mulberry32` with seed `20261108`) draws Day 15 (2026-11-25) as onset day. Baseline runs Days 1–14; intervention runs Days 15–42.
- Automation engine (`src/core/experiment.ts`, `src/server/experiment.ts`):
  - In `src/server/lesson.ts`, `progressSummary` automatically assigns `arm: "input-first"` on and after the onset day for Russian without manual settings changes.
  - Automatically logs daily first-play understanding share, dictation reps, minutes, covariates, and task compliance to `daily.jsonl`, regenerating `summary.md`.
  - Weekly checks on the last day of each week (10 listening dictation probes + 5 spoken production prompts) are served via `/experiments/input-first/check` (with API `/api/experiments/input-first/check`) and saved to `checks.jsonl`.
  - Dashboard at `/experiments/input-first` (linked in sidebar navigation under Trial with `FlaskConicalIcon` and a 42d badge) displays timeline, current phase, regression level shift $b_2$, permutation randomization $p$-value, weekly checks, and a reset endpoint (`POST /api/experiments/input-first/reset`). Backward-compatible redirects maintained from `/experiment` and `/experiments`.
- Protocol provenance (commit `8e767a9f`, SHA-256 `1c9f0bd5e4fb093c8beae59e1207a6db9edf5572b9d1889f146f70e7dd7829d1`) and decision rules are fixed in `experiment.json`. Final `verdict.json` written after Day 42.
- **The study's day is the app's local day** (`dayKey`), the same key the lesson logs, progress and the scheduled arm already use. The reset default start date, the daily sync and the state read all take the local day; a UTC day cut every local evening's practice away from the day it belonged to.

Changed by [study-follows-its-protocol.md](study-follows-its-protocol.md) on 2026-11-11.
