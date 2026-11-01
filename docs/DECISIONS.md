# LangHarness decisions

The product principles and working rules behind LangHarness, with the date each was set and why. Newest rules win where two conflict. Read this before changing how a task teaches, where data goes, or how work reaches the repo.

"The owner" below is the person who owns the repo and set these rules. "The learner" is whoever is using the app; the app is meant for more than one.

Companion documents: [learner.md](learner.md) (who this is built for), [research/README.md](research/README.md) (the evidence), [CHANGELOG-2026-10.md](CHANGELOG-2026-10.md) (what was built when).

## Product principles

### P1. Effective, not a clone (2026-10-27)

Owner's rule: do not make this like every other language app; make something effective, grounded in language-learning research and in the learner's own pain points.

**Why:** the first redesign copied the Duolingo shape (streaks, XP, tiles). That made the app feel like a language app, but the research pass that followed showed form-focused drilling was taking three quarters of the planned minutes.

**How to apply:** every new task starts from a research note in `docs/research/` and from the learner's own evidence (lesson log, chats), not from what another app does. Gamification stays where it costs nothing (XP, streaks), never where it changes what is practised.

### P2. Four strands, not pure comprehensible input (2026-10-28)

Nation's four strands: meaning-focused input, meaning-focused output, language-focused learning, fluency, about a quarter of the time each. Research note: [research/comprehensible-input.md](research/comprehensible-input.md).

**Why:** a learner who reads well but produces beginner endings is the documented failure mode of pure input (the Swain immersion finding), so the app keeps explicit instruction and output. Before this rule the app was about 76% form-focused, 12% input, 12% output, 0% fluency.

**How to apply:** the daily plan keeps one task per strand (Review, Lesson, Listen or Watch, Speak, Read) before any second drill. The strand balance under the daily plan shows this week's minutes against a quarter each. Input tasks stay easy at the word level (93% to 98% known words); difficulty lives in output and study.

### P3. Desirable difficulty: learning must be hard (2026-10-28)

Owner's rule: things should be hard and the learner should face struggle, because that is where learning happens, even though people like to think they can speedrun. Research note: [research/desirable-difficulties.md](research/desirable-difficulties.md).

**How to apply:** every rep is retrieval first. Help is allowed but graded, visible and priced in XP or rating, never free. Recognition only to meet a form; production to prove it. Difficulty rises with mastery (a completed unit is practised production-only with the meaning hidden). Concretely: first miss shows the smallest cue only, rule and bridges open after the second miss; a missed choice retries typed; Review hints cap the rating; Listen shows the text only after a second listen and a peeked sentence does not count as understood; Watch shows the meaning only after the Slovak text. "I don't know" is on every lesson rep (not in the blitz sprint) and is never free: the answer shows at once, the rep counts as a miss with no XP, skips the cue, and comes back once at the end. It is the lesson's version of the Review deck's "I don't know" (2026-10-28, after the learner reported having to type random text to leave a rep they did not know).

Listen gained a typed mode on 2026-10-31: the owner found pick-a-meaning "way too easy for the level", so a Pick / Type switch asks for the Slovak as heard (dictation, graded like a lesson's listening rep, accents-only earns half XP). Pick stays the default. Typed reps are kept out of the speed measure, because typing time is not listening time.

### P4. Meet a form in a sentence before being tested on it (2026-10-28)

A new unit's first lesson opens with two "What does it mean?" reps (sentence spoken, target form marked, pick the meaning from three) before any production.

**Why:** input before output, from the same research note as P2.

### P5. Answer first, reasoning optional (2026-10-27)

Every practice and story session in the first week was abandoned at a field labelled "Your thinking". Confidence sliders were left at the default 18 of 24 times.

**How to apply:** one tap or one number key answers; confidence and thinking sit behind "Explain my reasoning". Short loops. Show evidence (the sentences behind a placement), not a verdict.

### P6. Bridges from every language the learner knows (2026-10-26, widened 2026-10-28)

The original spec locked Estonian as the bridge language (Estonian cases make Slavic morphology intuitive). The rule was widened to every language the learner knows, and to up to two explanation languages, on the reasoning that the more a learner sees their languages side by side, the more they can learn.

**How to apply:** every grammar unit carries bridge lines for the learner's known languages, best-known first. The tutor explains in the first explanation language and adds the key line and grammar terms in the second, never a full second copy. A language known at A1 or A2 gets short lines only. A parallel is one line in Why? and hints when a Slovak rule mirrors a known one, never a lesson in that language, and Settings → Learning can switch parallels off (PR #10).

### P7. Measure cheaply, spend the model on the edge (2026-10-28)

Goal and level discovery through tutor chats was judged ancient and inefficient. The model is welcome where it is used precisely and Socratically to understand the learner's understanding; wasteful chat is not.

**How to apply:** setup is four screens with no model call; the tutor gets a "This learner" block and probes only shaky strands with one to three Socratic questions. The level check works the same way since PR #9: an adaptive ladder with no model call on a match, the Cheap slot judging only typed answers the dictionary did not expect, the Strong slot asking a handful of Socratic questions at the edge; see [research/level-assessment-audit.md](research/level-assessment-audit.md).

### P8. Honest numbers (2026-10-27 onward)

Estimates say what they assume: the hours sheet names its sources and the head start it credits; the milestones page labels an assumed speed as assumed; the placement result shows the sentences as evidence. Do not overstate dictionary accuracy either (4 words hand-checked against JÚĽŠ, 2,958 rule-generated and verified, the rest unknown).

### P9. Time counts while you practise, and says what it assumed (2026-10-29)

Minutes were one wall-clock number a day. A lesson resumed after thirty minutes away, or a card left open, counted in full up to a cap (on the first profile one lesson was logged as exactly 60 minutes, 81% of everything recorded), which made the pace and the ETA too optimistic, and the strand balance ignored measured time for count × planned-minutes guesses.

**How to apply:** a task counts the time the learner was active, per activity. Lesson, Blitz, Review, the level check, Speak and Say it faster count the gaps between actions, each capped at 90 seconds; Watch, Read and Listen count the time the tab is visible and focused, since they are passive by design (`src/core/active-time.ts`, `components/use-active-time.ts`). Time is kept per activity (`minutesBy` in progress.json; `minutes` stays the sum) and sent as a delta, so the time sent when an unfinished session is left (`POST /api/progress/time`) and the final send never count the same seconds. The wall-clock `ms` stays in the logs, because the speed measures and the milestones page read it. The strand balance counts measured minutes and falls back to the plan's estimate per activity for Talk, Story and tutor sessions (no timer) and for days before this; the card says how many of its minutes were estimated (P8). Open: timers for tutor sessions; each finish or leave can carry up to one 90-second gap of trailing time. Talk and Story are timed as Speak and Read now (E8).

## Engineering rules

### E1. Save every generated artifact to `data/` in open formats (2026-10-27)

**Why:** everything the app pays for is worth keeping, both to avoid paying twice and so the corpus can seed a future app of the owner's own. The ask was for it to be "extremely organized, even overly organized and easy to find."

**How to apply:** any new AI or TTS feature caches to `data/` before calling an API and reuses on a repeat. Audio library with an index, lesson log per day, Why? index, stories, videos, speak sessions with recordings, fluency log, milestones. A README next to every data folder, and `npm run corpus:export` for a snapshot. Deleted chats move to `chats/trash/` instead of being unlinked. Details: [corpus.md](corpus.md).

### E2. Cheap and Strong model slots (2026-10-27)

Why?, Talk, Story, Practice, Read episodes, Speak scenes, Watch translations and custom milestones run on the Cheap slot. Learn (teaching) stays on Strong. Cheap falls back to Strong if empty. Lessons, Blitz, Review, Listen and Fluency are local and cost nothing. Prompts were condensed (practice composition 37k to 24k chars); the doctrine paragraphs are pinned by tests, keep them verbatim. Spending is visible at Settings → Spending, priced from each chat's `turns` log at read time.

### E3. Unit completion rule (2026-10-27)

A unit is done after 3 lessons at 80% or better, or after 6 lessons. One lesson at 95% or better tests out. Tutor units need 2 sessions.

**Why:** "when does a lesson ever get completed?" had no answer in the UI.

### E4. Custom UI, no native widgets, no layout shift (2026-10-27)

No native `<select>`; chips, steppers and searchable panels instead. Sidebar state lives in a cookie, appearance variables are server-rendered on `<html>`, the Today summary is SSR'd, so there is no CLS or FOUC. Structure and alignment like Duolingo's; label every chip, because unlabelled prose lines read as unstructured. Run every screen state at both window sizes (about 1400×890 and 1133×700, or 1280 and 390 px wide, and 820 px for an iPad with touch emulation) before calling a UI pass done; the owner reviews screenshots closely.

### E4a. One button family, one answer first, labelled cues (2026-10-29)

**Why:** the owner: "the UX here of our app is so freaking bad and it's hard to use the controls." Today showed the same next step three times (Continue card, plan, mode tiles), every learning screen carried its own button styles (the uppercase 3D Check on Review, small ghost links elsewhere), and cues such as a lone "still" under a lesson sentence read as stray words.

**How to apply:**
- Buttons on learning screens come from `components/ui/learn-buttons.ts` (`PRIMARY`, `SECONDARY`, `QUIET`, `SMALL`, `KBD`): flat, sentence case, 48px. No uppercase, no faux-3D bottom edge.
- Strand colours come from `components/strand-style.ts` (input sky, output xp, form go, fluency gold), so a strand looks the same on Today, in the plan and in the week card.
- Today answers first: the next undone task is drawn large with one Start (Enter starts it); everything else is grouped below by strand. Only one card says what to do next.
- Every cue chip carries a label ("means", "base form"); a key that does something is shown as a key (`Enter` to check, `1`–`4` to pick), shown only where a fine pointer is the main input (`pointer-fine:`, E20), so a touch screen never shows a key it does not have.
- Leaving a lesson that has answers asks first (X or Escape); staying is the default.
- The sidebar is language-first: language, the four destinations, then the tutor and its chats. Search and the Learn/Practice filter sit behind one search button. Background agents show only while one runs. Below `md` in the browser the sidebar is a drawer over the page, closed on load and on navigation.
- Minimum text size is 12px (`--text-xs`); `--text-sm` is 13px.

### E5. Keep API keys out of chat (2026-10-26)

Keys go in `.env` or environment variables, never in a thread. Each key only goes to its own service and is never logged in full.

### E6. Tests never touch the real profile (2026-10-28)

A full test run on the PC once wrote fixture chats into the real session list and ran a paid Opus placement turn. Under `NODE_ENV=test` with no `LH_DATA_DIR`, data goes to a temp folder. Always test in the cloud copy with `LH_DATA_DIR` pointed at scratch. Run with `NODE_ENV=test npx tsx --test tests/<file>.test.ts`. The suite is green on Node 26, the version CI runs (2807 tests). Under Node 22 the pi-ai package-exports test in `tests/subscription-auth.test.ts` fails; that is environment-bound, not a regression. On the PC (Eastern time) one sidebar test, "awaiting meta keeps the existing date", fails because it expects a UTC date; it passes with `TZ=UTC`.

### E7. Local only, no sync (2026-10-26)

Data lives in `data/` next to the app and is gitignored. The Electron app and `npm run dev` share it. No installer yet; the app runs with `bun run desktop:dev` on port 3010 (port 3000 belongs to another project on the same machine).

### E8. One screen per task, one scene list (2026-10-30)

**Why:** Talk ran twice. The chat version (2026-10-27) and the spoken Speak screen (2026-10-28) shared the same six scenes, copied into two lists. The curriculum's goal scenes still opened the chat, so one scene could be spoken or typed depending on where you clicked. A chat Talk credited output minutes when it opened, before anything was said, and kept the day active for the streak. Story had a chat version beside Read, and the plan had stopped producing it.

**How to apply:** each task has one screen and one scene list. Talk and Talk in writing are `/speak` (`?mode=typed` opens it with the keyboard on), Story is `/read`, and a goal's scene opens `/speak?scene=`. The scenes are `SPEAK_SCENES` in `src/core/speak.ts`. Chats are for what a screen cannot do: tutor units, Why? and the placement follow-up. Old Talk and Story chats still open, and the usage and corpus exports still classify them by title. A learning screen's "Set up a model" or "Settings → Keys" line opens the settings dialog (`components/settings/settings-link.tsx`).

### E9. Every chapter has the same seven steps (2026-10-30)

**Why:** a chapter was only a list of unit IDs, so nothing showed what it asked of the learner or where they were in it. Every chapter now gets the same seven steps in the same order: story, words, forms, pairs, scene, sound, exam.

**How to apply:** the steps are `ARC_STEPS` and `chapterArc()` in `src/core/arc.ts`, computed from `CHAPTERS` and `CURRICULUM`; do not copy unit lists into them. A step with no unit yet is "not yet", and tutor units stay outside the seven steps. `tests/arc.test.ts` names every chapter without a words or forms step, with the reason.

### E10. A chapter opens with its own story episode (2026-10-30)

**Why:** the arc's story step was "not yet", and the Read shelf picked purely by word-fit scoring, so "today" never read as "day 3 of At the doctor's". The story bible (`curriculum/slovak/world.json`: six cast members with Robo the lead, six Bratislava places from the Speak scenes, one English plot beat per chapter) now seeds the episodes, and a chapter without one gets it written first on the cheap slot, cached under `data/` (E1).

**How to apply:**
- The bible is data, not code: edit `world.json`, never the brief. `tests/reading.test.ts` validates it against `CHAPTERS` (one beat per chapter, six cast, six places).
- `pickStory` prefers the current chapter's unread episodes in written order, even when another story fits better; the gate that rejects a low-coverage story does not apply there, so the shelf never chases a hard chapter episode with a second write. The shelf writes the chapter's episode before generic top-ups, within the day's cap.
- `StoryRecord.chapter` already existed; the index lines carry it now too. No migration: older episodes without it keep working.

### E11. Contrast pairs are a choice between two real forms (2026-10-30)

**Why:** the arc's pairs step (Dvojičky, E9) was "not yet". The twins a learner mixes up (ísť/chodiť, kam/kde, robiť/urobiť…) are now taught as a recognition choice: the sentence is a verified lexicon example that contains exactly one twin's form, the form stays visible, and the learner picks which of the two lemmas the sentence really uses. Sentences come only from verified forms (P8) — never generated ones.

**How to apply:**
- The pairs are data, not code: `curriculum/slovak/pairs.json` (id, a, b, one English rule, one Estonian bridge, the chapter that teaches them). Both twins must be lexicon entries; a pair with fewer than three verified sentences is dropped (`src/core/pairs.ts`).
- One pairs unit per chapter that teaches a pair (`pairs-<chapter>` in `src/core/lesson.ts`), placed right after the chapter's forms unit; `chapterArc` fills its pairs step from it. The rep's rule and bridge are the pair's own, shown after a miss — the unit's line is a fallback only.
- A pairs unit is a drill on the map: it joins Continue and the daily plan like any drill, and its misses feed the review deck as usual.

### E12. The grammar atlas shows the map before it is full (2026-10-30)

**Why:** the case system was invisible — a learner saw drill units one at a time but never the six cases × three genders they are working through, or where their accuracy sat in it.

**How to apply:** the table is `src/core/grammar.ts` (pure): six cases down the side (N, G, D, A, L, I), three genders across (masc, fem, neut). Each cell points at the drill that teaches it (A-fem → acc-fem, A-masc → acc-people, one drill per case for G, D, L, I) or is "not yet"; a mapped id that is not a unit in `UNITS` counts as "not yet" too, never a broken link. A cell's accuracy is `correct / reps` from `progress.units`, and zero reps reads "not yet" — no percentage without anything behind it. Every cell links to `/lesson?unit=<id>`; the rule text shows for the pointed-at cell. Do not map a cell to a unit that does not exist, and do not show accuracy for a cell with no reps.

### E13. A scripted scene walks the rails before it goes live (2026-10-30)

**Why:** the Speak scene threw the learner straight into free speech with a model — for a first-time learner that is a wall, not a task. The arc's scene step (E9) promised a scripted scene first: the tutor's line, then a choice of three next lines, one right and two plausible slips, graded locally with no model call.

**How to apply:**
- The scripts are data, not model output: `curriculum/slovak/scenes/<scene id>.json` (scene id from `SPEAK_SCENES`), six to ten turns, each a tutor line (Slovak + English) and exactly three options with exactly one correct. Correct lines use lexicon words; wrong ones carry a one-line English `why`. They are authored in the repo and pinned by `tests/speak-script.test.ts`.
- The grading is `src/core/speak-script.ts` (pure): `scriptFor(sceneId)` and `grade(script, turn, choice)` → correct, or wrong with the explanation and the right line. One wrong answer may be retried once; a second miss shows the right line and moves on.
- `/speak?scene=<id>&mode=script` runs `components/speak/script-player.tsx` and never auto-starts the live scene (SpeakPlayer starts when `sceneId` is set — script mode renders the other player instead). "Say it live" at the end hands over to the normal scene; every picker card has a "Script first" link.

### E14. The chapter exam is recorded before it gates (2026-10-30)

**Why:** the plan makes the exam a required gate, but a gate on an unchecked exam would block learners. Phase 6a ships the exam as record only: every chapter's Skúška draws eight choose items from the chapter's own word and drill units, is scored against an 80% pass mark, and is saved per chapter — and nothing opens or closes on it yet.

**How to apply:** the draw and the score are `src/core/exam.ts` (pure), built from the lesson item builders (src/core/lesson.ts) — no second generator; a chapter with a Dvojičky unit gets one pair rep in place of a form item. Attempts live in progress.json's `exams` per chapter (`at`, `score`, `total`, `passed`, `misses`); the client sends only its picks, the server re-grades from the seed. The path reads the best attempt per chapter and never changes `curriculumState`. The gate (6b) switches on only when the owner flips it.

### E15. The chapter exam lives on the path (2026-10-30)

**Why:** a separate exam page repeated the path and added a screen to find. The path already shows where a learner stands, so the exam belongs at the end of its chapter. The exam screens had also drifted from the lesson's look: their own option cards, a result panel with a "Recorded" stat, and an 11px label. The Speak picker had 3D card shadows, and a "Script first" link floating under each card.

**How to apply:**
- Each open chapter on the path (Today and `/curriculum`) ends with a "Chapter exam" row (`components/curriculum-path.tsx`) that links to `/exam?chapter=<id>`. Its ring is a unit's ring: it fills to the best score and turns gold once passed. Its line comes from `examLine` in `src/core/exam.ts`: "Not taken yet · pass mark 80%", "Best 5 of 8 · pass mark 80%", or "Passed · best 8 of 8".
- `progressSummary` carries each exam chapter's attempts and best (`exams`, from `examSummaries`). Media has no exam (`chapterHasExam`: its arc has no words or form unit).
- An unknown chapter id is a 404.
- The exam, the grammar atlas, the Speak picker and the Speak script use the lesson's parts: the two-column option grid, the feedback band with Next at the bottom, one button family, and text no smaller than 12px (`text-xs`). The exam's blank stays a blank, so the options never move; the band shows the whole sentence.
- On the Speak picker each scene is one bordered row: the scene, and beside it "Step by step" (was "Script first") for the scripted walk-through (E13). Nothing new is gated.

### E16. Settings → Data measures what is kept, and clears only the cache (2026-10-30)

**Why:** nothing in the app showed what it kept, so a stale copy could only be fixed by hand. The one thing that is safe to clear is the copy of audio and pages the desktop app keeps for speed, which downloads again. Voice clips are generated once and kept, so clearing them would mean generating them again. Progress and backups are the learner's own work.

**How to apply:**
- `GET /api/storage` (`src/server/storage.ts`) is read-only. It measures three areas on disk: voice clips (`data/audio`), the active language's progress (its folder under `data/profiles/`) and backups (`data/backups`). Each row shows its path and size. Saved areas never offer a clear.
- Only the desktop app clears anything, and only its HTTP cache. `electron/storage-ipc.cjs` answers `lh:storage:cache-size` and `lh:storage:clear-cache` for the app's own window. The web build cannot clear the browser's cache, so its row says where to find it.
- The section sits in Settings → Data, above Reset (`components/settings/storage-section.tsx`). Reset is still the only way to start over, and it moves progress into backups rather than deleting it.

### E17. Settings names what it does, rare controls sit under Advanced, and Review holds still (2026-10-30)

**Why:** The settings dialog had grown names only its author could read (Providers, Learner, Prompts). Rare knobs such as the background colour, heading weight, compaction thresholds and system prompts sat beside everyday ones. A switch that was on looked disabled, and the Azure speech region had no field. On Review the page painted a skeleton, then the card, then the mode toggle. The owner saw that as a flicker, and it counted as layout shift (CLS, E4).

**How to apply:**
- The nav reads Keys, Tutor, Learning, Appearance, Skill map, Keyboard, Spending, General, Data, in that order. Keys opens first. Storage and Reset are sections of Data.
- Rare settings sit under a closed **Advanced** disclosure (`SettingsDisclosure` in `components/settings/controls.tsx`). Tutor has long chats and system prompts. Appearance has the background, the heading weight and the bold and italic colours. Skill map has the map update size. An empty field's hint names the factory default, never the stored value.
- Values that are not secrets are plain settings and show in their field: the Azure speech region (`plain: true` in `src/core/auth-keys.ts`). Keys stay masked and out of chat (E5).
- A switch is green with a white knob when on and grey when off. A choice among a few values is a segmented control (playback speed, quiz mechanics). The chosen font is marked with a tick and `aria-current`, not a fill.
- Mode is a fact until light mode exists ("Light mode is coming soon"), so it has no control.
- Review: the loading skeleton waits 300 ms, the last deck stays in memory for the page's life, a refresh that brings the same card keeps the typed answer, and mode and sound are read before the first paint. The header counts wait for the language.
- Desktop: `electron/main.cjs` and the modules it loads start once. After changing them, quit the window and run `npm run desktop:dev` again (see `docs/development.md`).
- A language added in onboarding starts with no level pressed ("Pick a level"), so the picker never guesses one. A pressed level is saved, B2 included: the server used to drop B2 because it equals the default, so the picker showed a level that was not stored. `DEFAULT_LANG_LEVEL` stays B2 as the tutor's fallback for a language with no level.
- Repeated class strings belong in a component (`MenuOption` in `components/settings/model-menu.tsx`), not in an exported string constant.
- Stepper buttons are inset squares inside a bordered group, so the hover fill stays inside the control.
- A section with a size or status that loads later reserves its rows up front (Data), so the layout does not move when the value arrives.

### E18. The first try is the measure of a form (2026-10-31)

**Why:** the lesson's final verdict overstated how a form went. The cue after a first miss lets the answer come back right, and XP should reward that — but the grammar atlas and the tutor read the result as the learner's hold on the case, so "Ako ďaleko je to od stanica?" corrected to "stanice" looked like a genitive held. A wrong answer also carried no kind of wrong: the dictionary form where an inflected one was needed is a different miss from another case's ending, or another word.

**How to apply:**
- The first try is the first answer, before any help: no cue, no peek, the first ask of the sentence — never the end-of-lesson retry, and only where a form is asked (a meaning check tests the sentence, a word bank the order). `src/core/first-try.ts` is the measure; the lesson player holds the first answer while the cue shows and sends it as `first`, and lessons, Review and Speak record it on the drill the rep practised (`progress.json` units: the `first` tally and its `byGender` split). A review answer counts too, unless a hint came first; it never joins the unit's `reps`.
- A wrong first try gets a slip named from the dictionary (`src/core/form-slip.ts`): `base` (the dictionary form, no ending), `same-word` (another ending of the same word), `other`, `blank`. The verdict does not change; accents-only is still its own verdict and never a slip.
- The grammar atlas cell and the tutor's "Measured weak points" read first tries, with the slips behind the wrong ones; under six first tries the tutor falls back to the lesson answers, labelled as such. The unit's `reps`/`correct` — XP, the path, the weak-spot mend rule — still read the final answer. The two measures answer different questions; do not mix them.
- A Speak correction on a case form counts as a spoken slip on its drill and atlas cell (`correctionSlip` in `src/server/speak.ts`), kept apart from first tries: it has no right answers beside it, so it never makes an accuracy.
- Places (Bratislava, Košice) decline like nouns in the classifier, so they drill the cases; the dictionary gives them no gender, so they fill no atlas cell.
- The logs keep the evidence: a lesson rep carries `gender`, `first`, `slip`; a review line carries `unit`, `gender`, `slip`; a Speak correction carries `drill`, `slip`, `gender`.

### E19. A spoken line is 16 kHz mono WAV, captured through the worklet (2026-10-31)

**Why:** Speak asked the browser for WebM/Opus and fell back to MP4, so a line could be kept as a video container, and speech-to-text always got that compressed clip — the WAV was built only when Azure scored pronunciation. Every engine a line goes to (ElevenLabs, Deepgram, Azure) accepts WAV, and a line is a few seconds (about 1 MB per 30 s, well under the 8 MB cap). The upload name was fixed at the same time: every clip was called `line.webm`, even when it was MP4.

**How to apply:**
- `components/speak/recorder.ts` captures through the same AudioWorklet dictation uses (`public/worklets/pcm-capture.js`): 16 kHz, mono, 16-bit PCM, encoded once into a WAV. There is no MediaRecorder, no container choice and no MP4 path.
- The worklet answers a `flush` message with its trailing partial frame, then `flushed`, so a stopped line loses nothing (a frame is posted only when 2048 samples are full).
- The worklet's per-quantum RMS is the meter and the stop-on-silence clock; the level mapping is unchanged.
- A recording is `{ wav, ms, spokeAt }`, and `ms` comes from the samples. The WAV goes to `/api/stt`, to pronunciation scoring and with the line to `/api/speak` (kept beside the scene), so the engine and the archive see the same bytes.
- The file name is always `line.wav` on upload and `NN.wav` in the scene: WAV is the only format the path handles, so there is no type-to-extension mapping and no non-WAV branch left anywhere (the former `audioExt` helper is gone).
- Azure's scoring path needs no conversion: it already asks for `audio/wav` PCM at 16 kHz.

### E20. Phone and iPad: a responsive installable web app, served from the PC (2026-11-01)

**Why:** the owner wants LangHarness on a phone and an iPad. A store app would have to move the keys and the learner's data off the PC, needs an Apple developer account, and sits in the weakest position under App Store guideline 4.2 (a thin client to a server the owner runs). A responsive web app keeps one UI for the desktop and the tablet, and keeps the data (E7) and the keys (E5) on the PC. The route and its limits are in [research/mobile-ipad.md](research/mobile-ipad.md).

**How to apply:**
- One UI. Phone and tablet layouts are CSS breakpoints and pointer variants on the same components, not separate screens.
- Choose by pointer, not by width, for touch behaviour: `pointer-coarse:` for 44 px targets and the press-and-hold microphone, `pointer-fine:` for keycap hints (E4a), and `touch-narrow:` (a coarse pointer below `lg`) for the sidebar drawer.
- Every tappable control is at least 44 px tall on touch (the Apple HIG minimum). The sidebar gets this from one rule in `app/globals.css` (`[data-sidebar]`); reader and lesson controls carry `pointer-coarse:min-h-11`. A word inside a sentence keeps its line height, because inline padding does not grow the line box, so its tap area is 39 px tall on a phone. Do not make it taller: the lines would move on touch.
- Pad for the safe areas with `env(safe-area-inset-*)` on the shell, the bottom navigation and the drawer. `viewport-fit=cover` and `theme-color` come from `app/layout.tsx`.
- Installable: `app/manifest.ts` (standalone, starts at `/`, the app's colours) and `app/apple-icon.png`, rendered from `build/mark.svg` by `scripts/make-pwa-icons.mjs`. `app/layout.tsx` sets `apple-mobile-web-app-capable` explicitly: Next 16 emits only the standard `mobile-web-app-capable`, and iOS reads the Apple name for a full-screen launch.
- The server stays on `127.0.0.1` in every mode. A phone reaches it only through Tailscale Serve, which connects from this computer, and only once remote access is on (E21). Do not bind it to the network: it holds the keys and the learner's data.
- Browser storage holds only per-viewer conveniences. WebKit bug 237350 reports that iOS removes a Home Screen web app's storage after seven days unused, so progress belongs on the PC (E7).

### E21. Remote access is off by default, and a phone pairs with a code (2026-11-01)

**Why:** a phone or tablet has to reach the app without the server listening on the network. A LAN bind would send pairing codes and session cookies in clear text, and anyone on the same Wi-Fi could reach the pairing page. Tailscale Serve connects from this computer, so the server keeps its loopback bind and only signed-in tailnet devices can reach it. The options and sources are in [research/remote-access.md](research/remote-access.md); the owner's steps are in [remote-access.md](remote-access.md).

**How to apply:**
- Off is the default. `access.json` in the data root holds the switch, at most one pairing code and the paired devices; a missing file is off. While off, the app answers this computer only, and refuses any request that a proxy marked (`Forwarded`, `X-Real-IP`, a Tailscale identity header) or that names another host.
- On: a request that names this computer and came through no proxy always passes, switch on or off: the browser on the PC, the packaged window and the dev server. (PR #65 sent the PC's own browser to pairing; this rule is the fix.) A request that came through the proxy (Tailscale Serve) must name a tailnet host and carry a paired device's cookie, or it goes to `/pair` if it is a page, or gets `401 pairing_required` if it is the API. Public while on: `/pair`, its one POST, and the static assets. A request is proxied when it carries a Tailscale identity header, `Forwarded` or `X-Real-IP`, or names a tailnet host in `X-Forwarded-Host`. `x-forwarded-*` alone proves nothing, because Next sets it on every request.
- Pairing: six digits, shown in Settings → Devices and typed on the phone within five minutes. Five wrong tries use the code up, and a new code replaces the old one. A paired device gets a random 180-day token in an HttpOnly, SameSite=Lax cookie (Secure over HTTPS); only its SHA-256 digest is stored. Signing out one device, or turning the switch off, takes effect on the next request.
- Trust comes from the device cookie, never from a header. Tailscale identity headers do not grant access, because tagged devices and Funnel send none.
- The app never runs Tailscale. The owner runs `tailscale serve --bg 3010` once. Funnel is not supported: it publishes the app to the internet.
- Recovery: a corrupt `access.json` reads as on with no devices, so phones are refused until `npm run remote:off` writes it back to off, which also signs every device out.
- Tests run on a scratch data folder (E6): `tests/remote-access.test.ts` covers the rules as pure functions; `tests/remote-access-store.test.ts` covers the file, codes and sessions.

## Working rules (how work reaches the repo)

### W1. Take over, do not ask (2026-10-27, repeated 2026-10-28)

Pick the recommended option, build it, verify it in the live app, deploy, then send one short report with screenshots. Do not ask for confirmation, choices or approval. The only exceptions are things impossible from the cloud (creating a GitHub repo, approving a device card). `AGENTS.md` carries the upstream "No guessing, always ask" rule; for LangHarness the owner's standing rule overrides it.

### W2. Descriptive branch names, no merging to main (2026-10-28)

Branches are named after the work (`feat/desirable-difficulty`, `setup/cefr-language-levels`, `docs/project-learnings`), never generated names. Open the PR, assign the owner, request their review, deploy the branch to the PC for verification, and stop. The owner merges. PRs #1 to #5 were merged before this rule; #5 landed minutes before it. Since then the owner has merged #6 and #8 to #11 themselves.

### W3. Deploying to the PC

The code lives at `C:\Users\Stream\Projects\langharness-2` (rename to `langharness` deferred; it needs the app closed). The dev server hot-reloads, so a deploy is a `git fetch` plus checkout of the PR branch on a clean tree, done from a Remote Control session (the device shell cannot reach GitHub, delete files, or commit). A dev server started by a Remote Control session dies with it; restart it afterwards. GitHub Actions never runs on this repo (owner-side setting), so red CI there is not a code failure.

### W4. Research notes live in the repo (2026-10-28)

Every research pass goes to `docs/research/` in Markdown with its sources, and the index in [research/README.md](research/README.md) is updated. Decisions go in this file, in the same PR as the work.

## Dropped or deferred

- **Clozemaster integration (dropped 2026-10-28).** Its terms forbid automated access; the official CLI's MCP server only edits collections. The in-app Review deck is the replacement, and the aim is to be better than it.
- **Russian profile.** Prompts and a profile exist; no lexicon, seed or review deck. Not started.
- **Folder rename** langharness-2 → langharness: wanted, deferred until the app can be closed.
- **Windows installer and sync:** not built; data is local only.
