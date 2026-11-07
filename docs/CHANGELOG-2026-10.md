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
- **"Effective, not a copy" pass** after the owner asked for research and the learner's own pain points: hint (trigger, rule, Estonian bridge) and one retry before the reveal; misses return typed at lesson end; practiced units mostly typed; 2 to 4 reps mixed in from confusable units; answer first, reasoning optional; Talk prompts rather than recasts.
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
- **Right-answer footer and Review verdict** restructured into labeled chips (Form, How common, Memory); deleted-session page; session menu copy. PlayButton no longer nests buttons.
- **Speak and Fluency** (`/speak`, `/fluency`): six voice scenes with ElevenLabs STT and prompts-not-recasts; Say it faster and Read it faster; clarity scoring (Azure Speech or transcript match). Replaced the Talk tile. See [research/speak-fluency.md](research/speak-fluency.md).
- **Milestones** (`/milestones`, PR #2 merged 03:15): "When can I…?" with words and speed measured apart, custom situations via the Cheap slot. Listen reps now log timing. See [research/milestones.md](research/milestones.md).
- **Watch** (`/watch`, PRs #3 and #4 merged): YouTube videos as guided input. See [research/watch.md](research/watch.md).
- **Desirable difficulties** (PR #5 merged ~04:05): graded, priced help everywhere; production over recognition; the "strong" stage; Listen and Watch reveal rules. See [research/desirable-difficulties.md](research/desirable-difficulties.md).
- **04:00 Git rules:** descriptive branch names; no merging to main without the owner. PR #6 (CEFR levels) is the first PR left open on purpose.
- **04:23 Level-assessment audit:** critical re-check bug, noisy grammar-only tiers, exact-string grading. Rebuild as an adaptive, model-judged check started on `fix/level-assessment`. See [research/level-assessment-audit.md](research/level-assessment-audit.md).
- **04:33 This write-up** (`docs/project-learnings`, PR #7).
- **05:03 Level descriptions** (PR #8): each target level has a plain can-do line in Slovak-life terms and says which chosen purposes it covers; the same lines sit under the level chips, in the hours sheet and on Today's goal line.
- **05:22 Rebuilt level check** (PR #9, merged by the owner at 06:03): an adaptive ladder over the 16 drill units that starts from the self-report and closes in about a dozen items; typed answers the dictionary did not expect are judged by the Cheap slot; a Socratic stage on the Strong slot asks up to six production and "why" questions at the edge and rates each unit held, slip or gap; a two-minute yes/no word check (40 words over five frequency bands plus 8 pseudowords) feeds the milestones page. Re-check, days-per-week and milestones bugs fixed. Every check is saved under `data/profiles/<lang>/placement/` and costed. The owner ran it live at about 06:10 and the judge accepted a valid alternative form.
- **06:10 Setup polish** (PR #10): the language panel closes on any outside press; the line under the languages names only the learner's own languages and explains what a parallel is; Settings → Learner gets a "Parallels from my languages" switch.
- **06:24 Weak spots** (PR #11): a weak-spots record in progress.json written by the check, by lessons under 85% and by review cards that keep lapsing, cleared after eight reps at 85%; shown on Today, the map, the tutor's profile block and the plan's Strengthen task. The check's miss verdict now teaches the pattern; crime, violence and death sentences are left out of the item pool.
- **UX audit pass** (`fix/ux-audit-pass`, PR pending): confirm dialogs for destructive settings, inline profile switch, labeled review and listen controls, a phone bottom nav, a keyboard-only focus ring, masked API keys, AA-readable muted text, pause/resume for Fluency with the mic off, a live status line for Speak, and phone-friendly Milestones and graph empty states.
- **Window-drag fix** (same branch, owner bug report: "scrolled down, I can't grab the window"): every drag strip was absolute inside the scrolling content, so it rode off-screen with the page and a scrolled page had no grab point left. AppShell's `<main>` now carries one sticky strip at the top — glued to the visible area at any scroll depth, inside `<main>` so it never spans the sidebar, first child so the DOM-order mask law still holds. Trade-off, same as the unscrolled state today: the top 52px of the window is always a drag band, so content scrolled under it is not clickable until it scrolls past.

## 29 October: the UX revamp

- **UX revamp** (`ux/revamp-views`, PR pending), after the owner's "so freaking bad and hard to use the controls". View by view, each checked at 1400×890, 1133×700 and 390 wide:
  - **Today:** one answer first. The next undone task is drawn large with Start (Enter starts it) and a segmented progress bar; "All done for today" when it is. Below it, "Practice anything" groups every mode by strand. A side column holds the week (days studied, strand balance, goal line with a link to Plan), weak spots and the path. The duplicate Continue card and link row are gone. The path folds unreached stages to their header and says which chapter opens next.
  - **Sidebar:** language and the four destinations first; the tutor's two actions and "Your chats" below, with search and the Learn/Practice filter behind one search button; Background agents only while one runs; session titles at 14px so they sit with the nav. On phone widths in the browser the sidebar is a drawer over the page instead of a column that left about 100px of page.
  - **Lesson:** the cue under the sentence is labeled ("means work", "base form mesto"); "Show translation · half XP" replaces "Meaning · half XP"; keyboard hints are drawn as keys; the X and Escape ask before dropping answered reps; the replay button no longer hangs off-screen on a phone; shared buttons.
  - **Review:** flat card and shared buttons (no uppercase 3D Check); a labeled "Answer by Typing / Choosing" switch and a "Sound on" toggle; hints show as labeled chips and say what they cost ("comes back sooner"); 1–4 pick an option when choosing; the letter keys sit in the card; a skeleton while the deck loads; the caught-up state gets a custom stepper for new words per day (the native number input is gone) and links to Today and a lesson; the sidebar's due badge updates after each card.
  - **Plan:** hours credited show as "2.4", not "2.4324324324324325"; the goal card puts the purposes on their own line.
  - **Type and copy:** `--text-xs` 11→12px, `--text-sm` 12.5→13px; strand advice and empty states rewritten in plain sentences; US spelling ("Practice") throughout.
- **Logo:** the mark is two voices — a filled speech bubble answered by an outlined one, in one ink, with a transparent gap between them (the ring is an open path, not a dark outline); it replaces the spiral/orbit icon. One geometry drives `build/mark.svg`, the app icon (`build/icon-flat.svg`, with `node scripts/make-icons.mjs` now also packing the pre-Tahoe `build/icon.icns`), the Icon Composer layers, the browser favicon (`app/icon.svg`) and the sidebar mark (`components/lh-mark.tsx`). Sheet: `docs/assets/brand/logo-sheet.png`; in-app shot: `docs/assets/brand/sidebar-mark.png`. Replaced on 2026-11-06 by the cursor mark (E59).
- **Measured minutes** (`feat/measured-minutes`, PR pending), after the owner asked whether time is tracked and what would help a learner most. Minutes were one wall-clock number a day, capped per task, so a lesson resumed after a break or a card left open counted in full (one lesson on the first profile was logged as exactly 60 minutes, 81% of the total), and the strand balance counted count × planned minutes instead. Now each task counts the time you were active and keeps it per activity (`minutesBy`); the strand balance reads those minutes and says how many of its minutes are still estimated. Time left in an unfinished lesson or card is sent when the page is left. Checked in the live app against a seeded profile: a review card left ten minutes counts 1.5 minutes (was 5), a lesson resumed after 30 minutes away 1.8 (was about 30), a Listen session with the tab hidden for seven of nine minutes 1.67 (was 8.7). Not covered live: Watch, Read, Speak, Say it faster and the level check (they need YouTube, a model or a mic; the handlers and the clock have tests), and the Electron shell. See [DECISIONS.md](DECISIONS.md) P9 and `scripts/demo-measured-minutes.ts`.

## 30 October: exams on the path, Data, settings and review fixes

Branch `fix/chapter-screens-design`, stacked on PR #51 (`feat/chapter-exams`). Not pushed.

- **Chapter exam on the path:** each open chapter ends with its exam row (DECISIONS E15). Record only: nothing is gated yet.
- **Review card:** a period or comma next to the blank stays on the blank's line at phone width, and the typing box is the same width as the verdict box.
- **Review holds still:** the loading skeleton waits 300 ms, so a fast load shows none. The last deck stays in memory for the page's life, and a refresh that brings the same card keeps the typed answer. Mode and sound are read before the first paint. Layout shift measured 0.0007 cold at 1400px and 0 on a return visit.
- **Review stepper:** the minus and plus buttons for new words per day are inset squares, so the hover fill no longer runs into the number.
- **Settings reorganised (DECISIONS E17):** the nav reads Keys, Tutor, Learning, Appearance, Skill map, Keyboard, Spending, General, Data. Rare controls sit under a closed Advanced disclosure. The Azure speech region is a field. Switches are green when on, and segmented controls replace the chip rows for playback speed and quiz mechanics. Copy: Providers → Keys, Learner → Learning, Agent → Tutor, Storage → Data.
- **Language level:** a language added in onboarding starts with no level pressed, and the picker reads "Pick a level". A level the learner presses, B2 included, is saved. B2 is still the tutor's fallback for a language with no level.
- **More languages panel:** it opens over the page and stays inside the window at phone and laptop widths, so the settings column no longer scrolls sideways.
- **Settings → Data:** what the app keeps (voice clips, learning progress, backups) with folders and sizes. The section reserves a row for each area, so it no longer jumps when the sizes arrive (layout shift 0.026 → 0.00004 at 1400px). The desktop app can clear its HTTP cache. Clear is disabled when the cache cannot be read, and the section says to restart `npm run desktop:dev` if the open window predates the cache code. Saved areas are never cleared (DECISIONS E16).
- **Cleanup:** 84 generated screenshots and Playwright page snapshots deleted from `.playwright-mcp/`, `_handoff/` and `data/`.

Unverified by the owner: Data and the cache clear in the Electron window (the clear is tested with a fake session, and the page was checked in a browser with a simulated bridge). Settings and Review were checked in a browser at 1400×890 and 1133×700 (Review also at 390px). Settings sections were not checked at 390px. Desktop speech may sound different from the web because the saved desktop speed can be 0.75× while the web default is 1×.

Known: at 390px wide the settings dialog gives its content about 125px in every section, so the left section list crowds the text. This predates this branch.

<<<<<<< HEAD
## 31 October: the first try is the measure

Branch `feat/grammar-error-tracking`. Not pushed.

- **The question:** does the app notice when the base form is right but the case is wrong — "Ako ďaleko je to od stanica?" for "stanice"? It did not: the cue brought the answer back right, and the genitive looked held.
- **First tries (DECISIONS E18):** the first answer, before any cue, is now the measure of a form. The lesson player holds it while the cue shows (and across a reload) and sends it with the rep; lessons and Review count it on the drill the rep practiced (`progress.json` units: `first`, split `byGender`), excluding peeks, meaning and build reps and the end-of-lesson retry. A Speak correction on a case form counts as a spoken slip, apart from first tries.
- **The kind of wrong:** a wrong first try is named from the dictionary (`src/core/form-slip.ts`): *dictionary form, no ending* (stanica for stanice), *wrong ending* (stanicu), *other word*, *no answer*. Accents-only stays its own verdict, never a slip.
- **The grammar atlas** reads first tries per case × gender: each cell's percentage is first tries right, and the rule panel lists the slips behind the wrong ones and the slips said in Speak.
- **The tutor's** "Measured weak points" reads first tries once a unit has six, with the slips; below that it falls back to lesson answers, labeled as such. The unit's reps/correct (XP, the path, the weak-spot mend rule) still read the final answer.
- **Places** (Bratislava, Košice — no gender in the dictionary) now drill the cases in the classifier; they fill no atlas cell.
- **The logs keep the evidence:** lesson reps carry `gender`, `first`, `slip`, `latencyMs`; review lines carry `unit`, `gender`, `slip`; Speak corrections carry `drill`, `slip`, `gender`.
- **Latency & hesitation tracking:** the lesson player measures `latencyMs` from presentation to first submission; values are logged per rep to capture fluency vs hesitation without altering scoring.
- **Adaptive weak-gender prioritization:** when drilling a unit without an explicit gender filter, `lessonFor` inspects `rec.byGender` (`weakestGender`). If one gender struggles (< 70% accuracy, >= 3 reps), `buildLesson` dynamically prioritizes candidates of that weak gender (approx 60% of the lesson) to reinforce the weak spot.
- **Targeted drill deep-linking:** Grammar Atlas cells link directly to `/lesson?unit=${cell.unit}&gender=${cell.col}`, allowing learners to deliberately practice any specific case and gender combination. Base lemma distractors and contrast units are tailored accordingly.

Unverified by the owner: the lesson player's first-try capture (the cue flow, a reload mid-cue) and the atlas at both window sizes — typecheck, lint and the affected suites pass, but the live run on the PC has not happened. Known on this machine: the full suite has 27 environment-bound failures that reproduce on the base commit (Windows path fixtures, the local `auth.json` keys, Electron/Node drift), including `tests/speak.test.ts` "transcribe refuses honestly without a key", which assumes no ElevenLabs key is saved.

## 31 October: a spoken line is WAV, and nothing is recorded as video

Branch `fix/speak-recording-wav`, from `be8e859` (main).

- **Speak records WAV only:** the browser's WebM/Opus → Ogg → MP4 chain is gone. Speak captures through the dictation AudioWorklet (16 kHz mono 16-bit PCM) and keeps one WAV per line (DECISIONS E19). No MediaRecorder, so no MP4 and no format guessing.
- **Speech-to-text gets the WAV** (it got the compressed clip before), pronunciation scoring always gets the WAV (before, only when Azure was set), and the scene keeps that same WAV.
- **File names tell the truth:** uploads are `line.wav` on the client, in `/api/speak` and in the ElevenLabs multipart part, and the scene keeps `NN.wav`. All the non-WAV handling is gone with it: the `audioExt` helper, the `audio/webm` fallbacks in `/api/stt`, `/api/speak` and `/api/pronounce`, and Azure's Ogg branch.
- **The worklet's tail is flushed on stop** (`public/worklets/pcm-capture.js`), so a line no longer drops up to 128 ms at the end.

Not verified live: no microphone in this shell, so Speak and Say it faster are covered by the new tests (`tests/speak-recorder.test.ts`), typecheck and lint only. The real WAV with an ElevenLabs or Deepgram key, and Azure's score on it, need the PC.

## Pull requests

| PR | Branch | What | State |
|---|---|---|---|
| #1 | (harness name) | Listen task, meaning-first lessons, strand balance | merged 2026-10-28 02:08 |
| #2 | (harness name) | Milestones calculator | merged 2026-10-28 03:15 |
| #3, #4 | (harness name) | Watch task; subtitle cover | merged 2026-10-28 |
| #5 | (harness name) | Desirable difficulties | merged 2026-10-28 ~04:05, minutes before the no-merge rule; may be reverted on request |
| #6 | `setup/cefr-language-levels` | Per-language CEFR levels | merged by the owner |
| #7 | `docs/project-learnings` | These documents | open |
| #8 | `setup/level-descriptions` | What each target level buys | merged by the owner |
| #9 | `fix/level-assessment` | Rebuilt level check | merged by the owner 2026-10-28 06:03 |
| #10 | `setup/parallels-and-panel-close` | Panel close, parallels wording and switch | merged by the owner |
| #11 | `feat/weak-spots` | Weak spots on record | merged by the owner |
| (new) | `ux/revamp-views` | UX revamp: Today, sidebar, lesson, Review, Plan | open |
| #55 | `feat/grammar-error-tracking` | First tries, form slips, targeted gender drills (E18) | open |
| (new) | `fix/speak-recording-wav` | WAV-only Speak recording; truthful upload names | open |

GitHub Actions never runs on this repo (owner-side setting); a red check there is not a code failure.

## Unverified by the owner as of 2026-10-28 06:30

Their PC profile had not gone through the new setup (the home page redirects to `/start`), so they have not yet seen the new Today, daily plan or strand balance with their own data. Specifically unverified:

- Setup wizard end to end apart from the level check, which the owner ran live at about 06:10 (the judge, Socratic stage and word check worked on their profile). Still unseen: PR #8's level lines, PR #10's parallels switch, PR #11's weak spots on Today and the map.
- Read: real episode generation with a live model (only the faux engine so far).
- Listen task and meaning-first lesson openers.
- Speak, Say it faster, Read it faster, and clarity scoring (no Azure key set; cloud screenshots used made-up scores).
- Milestones page with real Listen data.
- Watch (verified live by a session on the PC, not by the owner).
- Everything in PR #5 (difficulty rules).
- The Spending page's totals against their own expectation.
- The UX revamp (`ux/revamp-views`): the new Today, the sidebar and its phone drawer, the lesson leave question, and the Review card. Checked in a browser against a copy of the PC profile, not yet in the Electron window.
- Listen's Type mode (31 October): a Pick / Type switch on `/listen`. Type asks for the Slovak as heard, graded by the server with the lesson's rules (accents-only earns half XP). Pick stays the default. Unit tests pass; the screen is not yet checked in a browser or on the PC.

## Known environment facts

- Cloud test runs: Node 26 (CI's version) passes the full suite. Under Node 22 the pi-ai package-exports test fails (environment-bound).
- The sandbox sets `NODE_OPTIONS=--use-openssl-ca`, which Electron's Node rejects. Run the native renderer tests with `env -u NODE_OPTIONS`.
- Tests: `NODE_ENV=test npx tsx --test tests/<file>.test.ts` with `LH_DATA_DIR` pointed at scratch. Never the full suite against the real profile.
- The device shell on the PC cannot reach GitHub, delete files or commit; use a Remote Control session for git on the PC. A dev server started by a Remote Control session dies with it.
- Leftovers to delete from the PC when convenient: `.git/stale-*`, `.git/lh-xfer/`, `_handoff/`, `langharness-2.bundle`, `langharness-2.tar.gz`, `_backup-before-redesign\`, and a redundant `pre-deploy` git stash.
