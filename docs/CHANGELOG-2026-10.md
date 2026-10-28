# LangHarness, October 2026: what was built, when, and what is still unverified

A narrative of the first three days, from the fork to the task-based app. Times are UTC. "Unverified" means the owner has not yet used it in the live app; the cloud walk-throughs and tests passed.

## 26 October: the fork

- Forked LearnHarness 0.3.8 on branch `slovak` from the Wayfinder spec: Slovak and Russian profiles under `data/profiles/<lang>/`, a seeded grammar graph (53 nodes, 40 vocabulary clusters, 57 prerequisite chains, every node with an Estonian bridge), language prompt fragments, `lookup_word` over the 7,074-word lexicon exported from slovak.wiki, the four-tier audio cascade (ElevenLabs → Edge → Piper → browser), the letter bar, and the Review page: a Clozemaster-style cloze deck over Tatoeba sentences scheduled with FSRS-5 (Phases 1 to 7).
- Checked where each API key is sent (each only to its own service; two gaps fixed: tutor file tools could read key files, and dev mode was open on the LAN). Keys go in `.env`, never in chat.
- Clozemaster integration explored and later dropped (terms forbid automated access).

## 27 October: from chat tutor to language app

- **UX audit** of a real 70-minute session (23 min placement, 37 min waiting at plan approval, 9 min teaching). Verdict: "the process is way too slow and cumbersome."
- **Redesign:** Today home with streak, XP, daily goal ring, week strip and tiles; 12-rep local lessons from the lexicon (choose, type, build, listen) with no model call; Blitz; progress.json; one-tap Review. Old graph home moved to `/map`.
- **Visual pass:** Nunito, rebuilt sidebar, no CLS or FOUC (sidebar cookie, server-rendered appearance vars, SSR'd Today summary), under a quarter second to content. App runs on port 3010; `desktop:dev` works on Windows.
- **"Effective, not a copy" pass** after the owner asked for research and the learner's own pain points: hint (trigger, rule, Estonian bridge) and one retry before the reveal; misses return typed at lesson end; practised units mostly typed; 2 to 4 reps mixed in from confusable units; answer first, reasoning optional; Talk prompts rather than recasts.
- **Lesson screen round 2** after "you missed so much": one bottom action bar, Why? in place, growing answer box, flat buttons, check and cross icons, quoted wrong answers, draggable top bar. Lesson state persists across a trip to the chat.
- **Tokens:** prompts condensed (practice composition 37k → 24k chars); Why?, Talk, Story and Practice moved to the Cheap slot, Learn stays on Strong.
- **Lesson flow fixes:** Next lesson works; unit completion = 3 lessons at 80%+ or 6 lessons; real icons instead of letters.
- **Curriculum:** 4 stages, 19 chapters, about 120 units to B2; full map at `/curriculum`; daily plan sized to minutes a day; goal estimate (~650 guided hours to B2). Gap: the lexicon has too few "to be" sentences, so that unit is a tutor session.
- **Corpus** (23:43 onward): audio library with index and legacy migration (55 clips, 54 texts recovered), lesson log, Why? index, chat trash, READMEs in every data folder, `npm run corpus:export`. See [corpus.md](corpus.md).

## 28 October: the strands, the setup, the rules

- **00:27 Spending page** (Settings → Spending) and the test-data fence after a test run polluted the real profile.
- **00:24 to 04:15 Setup** (`/start`): purposes, known languages (61, with CEFR levels in PR #6), up to two explanation languages, time with the hours sheet, the placement staircase; "This learner" block in every tutor prompt; Settings → Learner. Five rounds of feedback (custom UI, no 90-minute cap, "see the Estonian way", two explanation languages, no free text). See [research/onboarding.md](research/onboarding.md).
- **Read task** (`/read`): daily Robo in Bratislava episode at ~97% known words, tap-to-gloss, level-graded questions. Replaced the Story tile. See [research/reading.md](research/reading.md).
- **Comprehensible-input research and PR #1** (merged 02:08): Listen task, meaning-first lesson openers, one task per strand, strand balance on Today. See [research/comprehensible-input.md](research/comprehensible-input.md).
- **Right-answer footer and Review verdict** restructured into labelled chips (Form, How common, Memory); deleted-session page; session menu copy. PlayButton no longer nests buttons.
- **Speak and Fluency** (`/speak`, `/fluency`): six voice scenes with ElevenLabs STT and prompts-not-recasts; Say it faster and Read it faster; clarity scoring (Azure Speech or transcript match). Replaced the Talk tile. See [research/speak-fluency.md](research/speak-fluency.md).
- **Milestones** (`/milestones`, PR #2 merged 03:15): "When can I…?" with words and speed measured apart, custom situations via the Cheap slot. Listen reps now log timing. See [research/milestones.md](research/milestones.md).
- **Watch** (`/watch`, PRs #3 and #4 merged): YouTube videos as guided input. See [research/watch.md](research/watch.md).
- **Desirable difficulties** (PR #5 merged ~04:05): graded, priced help everywhere; production over recognition; the "strong" stage; Listen and Watch reveal rules. See [research/desirable-difficulties.md](research/desirable-difficulties.md).
- **04:00 Git rules:** descriptive branch names; no merging to main without the owner. PR #6 (CEFR levels) is the first PR left open on purpose.
- **04:23 Level-assessment audit:** critical re-check bug, noisy grammar-only tiers, exact-string grading. Rebuild as an adaptive, model-judged check started on `fix/level-assessment`. See [research/level-assessment-audit.md](research/level-assessment-audit.md).
- **04:33 This write-up** (`docs/project-learnings`).

## Pull requests

| PR | Branch | What | State |
|---|---|---|---|
| #1 | (harness name) | Listen task, meaning-first lessons, strand balance | merged 2026-10-28 02:08 |
| #2 | (harness name) | Milestones calculator | merged 2026-10-28 03:15 |
| #3, #4 | (harness name) | Watch task; subtitle cover | merged 2026-10-28 |
| #5 | (harness name) | Desirable difficulties | merged 2026-10-28 ~04:05, minutes before the no-merge rule; may be reverted on request |
| #6 | `setup/cefr-language-levels` | Per-language CEFR levels | open |
| — | `fix/level-assessment` | Rebuilt level check | in progress |
| — | `docs/project-learnings` | These documents | open |

GitHub Actions never runs on this repo (owner-side setting); a red check there is not a code failure.

## Unverified by the owner as of 2026-10-28 04:30

Their PC profile had not gone through the new setup (the home page redirects to `/start`), so they have not yet seen the new Today, daily plan or strand balance with their own data. Specifically unverified:

- Setup wizard end to end, including PR #6's CEFR levels (screenshots only).
- Read: real episode generation with a live model (only the faux engine so far).
- Listen task and meaning-first lesson openers.
- Speak, Say it faster, Read it faster, and clarity scoring (no Azure key set; cloud screenshots used made-up scores).
- Milestones page with real Listen data.
- Watch (verified live by a session on the PC, not by the owner).
- Everything in PR #5 (difficulty rules).
- The Spending page's totals against their own expectation.

## Known environment facts

- Cloud test runs: a few tests fail on main regardless (desktop payload trace, pi-ai package exports, one Pi loader test under Node 22). Environment-bound, not regressions.
- Tests: `NODE_ENV=test npx tsx --test tests/<file>.test.ts` with `LH_DATA_DIR` pointed at scratch. Never the full suite against the real profile.
- The device shell on the PC cannot reach GitHub, delete files or commit; use a Remote Control session for git on the PC. A dev server started by a Remote Control session dies with it.
- Leftovers to delete from the PC when convenient: `.git/stale-*`, `.git/lh-xfer/`, `_handoff/`, `langharness-2.bundle`, `langharness-2.tar.gz`, `_backup-before-redesign\`, and a redundant `pre-deploy` git stash.
