# LangHarness decisions

The product principles and working rules behind LangHarness, with the date each was set and why. Newest rules win where two conflict. Read this before changing how a task teaches, where data goes, or how work reaches the repo.

"The owner" below is the person who owns the repo and set these rules. "The learner" is whoever is using the app; the app is meant for more than one.

Companion documents: [learner.md](learner.md) (who this is built for), [research/README.md](research/README.md) (the evidence), [CHANGELOG-2026-10.md](CHANGELOG-2026-10.md) (what was built when).

## Product principles

### P1. Effective, not a clone (2026-10-27)

Owner's rule: do not make this like every other language app; make something effective, grounded in language-learning research and in the learner's own pain points.

**Why:** the first redesign copied the Duolingo shape (streaks, XP, tiles). That made the app feel like a language app, but the research pass that followed showed form-focused drilling was taking three quarters of the planned minutes.

**How to apply:** every new task starts from a research note in `docs/research/` and from the learner's own evidence (lesson log, chats), not from what another app does. Gamification stays where it costs nothing (XP, streaks), never where it changes what is practiced.

### P2. Four strands, not pure comprehensible input (2026-10-28)

Nation's four strands: meaning-focused input, meaning-focused output, language-focused learning, fluency, about a quarter of the time each. Research note: [research/comprehensible-input.md](research/comprehensible-input.md).

**Why:** a learner who reads well but produces beginner endings is the documented failure mode of pure input (the Swain immersion finding), so the app keeps explicit instruction and output. Before this rule the app was about 76% form-focused, 12% input, 12% output, 0% fluency.

**How to apply:** the daily plan keeps one task per strand (Review, Lesson, Listen or Watch, Speak, Read) before any second drill. The strand balance under the daily plan shows this week's minutes against a quarter each. Input tasks stay easy at the word level (93% to 98% known words); difficulty lives in output and study.

### P3. Desirable difficulty: learning must be hard (2026-10-28)

Owner's rule: things should be hard and the learner should face struggle, because that is where learning happens, even though people like to think they can speedrun. Research note: [research/desirable-difficulties.md](research/desirable-difficulties.md).

**How to apply:** every rep is retrieval first. Help is allowed but graded, visible and priced in XP or rating, never free. Recognition only to meet a form; production to prove it. Difficulty rises with mastery (a completed unit is practiced production-only with the meaning hidden). Concretely: first miss shows the smallest cue only, rule and bridges open after the second miss; a missed choice retries typed; Review hints cap the rating; Listen shows the text only after a second listen and a peeked sentence does not count as understood; Watch shows the meaning only after the Slovak text. "I don't know" is on every lesson rep (not in the blitz sprint) and is never free: the answer shows at once, the rep counts as a miss with no XP, skips the cue, and comes back once at the end. It is the lesson's version of the Review deck's "I don't know" (2026-10-28, after the learner reported having to type random text to leave a rep they did not know).

Listen gained a typed mode on 2026-10-31: the owner found pick-a-meaning "way too easy for the level", so a Pick / Type switch asks for the Slovak as heard (dictation, graded like a lesson's listening rep, accents-only earns half XP). Pick stays the default. Typed reps are kept out of the speed measure, because typing time is not listening time. Superseded on 2026-11-03 (E38): typing is the only way to answer, and a typed sentence is timed by its clip.

### P4. Meet a form in a sentence before being tested on it (2026-10-28)

A new unit's first lesson opens with two "What does it mean?" reps (sentence spoken, target form marked, pick the meaning from three) before any production.

**Why:** input before output, from the same research note as P2.

### P5. Answer first, reasoning optional (2026-10-27)

Every practice and story session in the first week was abandoned at a field labeled "Your thinking". Confidence sliders were left at the default 18 of 24 times.

**How to apply:** one tap or one number key answers; confidence and thinking sit behind "Explain my reasoning". Short loops. Show evidence (the sentences behind a placement), not a verdict.

### P6. Bridges from every language the learner knows (2026-10-26, widened 2026-10-28)

The original spec locked Estonian as the bridge language (Estonian cases make Slavic morphology intuitive). The rule was widened to every language the learner knows, and to up to two explanation languages, on the reasoning that the more a learner sees their languages side by side, the more they can learn.

**How to apply:** every grammar unit carries bridge lines for the learner's known languages, best-known first. The tutor explains in the first explanation language and adds the key line and grammar terms in the second, never a full second copy. A language known at A1 or A2 gets short lines only. A parallel is one line in Why? and hints when a Slovak rule mirrors a known one, never a lesson in that language, and Settings → Learning can switch parallels off (PR #10).

### P7. Measure cheaply, spend the model on the edge (2026-10-28)

Goal and level discovery through tutor chats was judged ancient and inefficient. The model is welcome where it is used precisely and Socratically to understand the learner's understanding; wasteful chat is not.

**How to apply:** setup is four screens with no model call; the tutor gets a "This learner" block and probes only shaky strands with one to three Socratic questions. The level check works the same way since PR #9: an adaptive ladder with no model call on a match, the Cheap slot judging only typed answers the dictionary did not expect, the Strong slot asking a handful of Socratic questions at the edge; see [research/level-assessment-audit.md](research/level-assessment-audit.md).

### P8. Honest numbers (2026-10-27 onward)

Estimates say what they assume: the hours sheet names its sources and the head start it credits; the milestones page labels an assumed speed as assumed; the placement result shows the sentences as evidence. Do not overstate dictionary accuracy either (4 words hand-checked against JÚĽŠ, 2,958 rule-generated and verified, the rest unknown).

### P9. Time counts while you practice, and says what it assumed (2026-10-29)

Minutes were one wall-clock number a day. A lesson resumed after thirty minutes away, or a card left open, counted in full up to a cap (on the first profile one lesson was logged as exactly 60 minutes, 81% of everything recorded), which made the pace and the ETA too optimistic, and the strand balance ignored measured time for count × planned-minutes guesses.

**How to apply:** a task counts the time the learner was active, per activity. Lesson, Blitz, Review, the level check, Speak and Speed count the gaps between actions, each capped at 90 seconds; Read and Listen count the time the tab is visible and focused, since they are passive by design; Watch counts the time its video plays, the time a paused line waits for the learner's decision (up to 2 minutes a line), and the questions; with no action for 90 seconds the clock stops, as the exercises do. Nothing counts before the video is loaded (`src/core/active-time.ts`, `components/use-active-time.ts`). Time is kept per activity (`minutesBy` in progress.json; `minutes` stays the sum) and sent as a delta, so the time sent when an unfinished session is left (`POST /api/progress/time`) and the final send never count the same seconds. The wall-clock `ms` stays in the logs, because the speed measures and the milestones page read it. The strand balance counts measured minutes and falls back to the plan's estimate per activity for Talk, Story and tutor sessions (no timer) and for days before this; the card says how many of its minutes were estimated (P8). Open: timers for tutor sessions; each finish or leave can carry up to one 90-second gap of trailing time. Talk and Story are timed as Speak and Read now (E8).

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

### E4a. One button family, one answer first, labeled cues (2026-10-29)

**Why:** the owner: "the UX here of our app is so freaking bad and it's hard to use the controls." Today showed the same next step three times (Continue card, plan, mode tiles), every learning screen carried its own button styles (the uppercase 3D Check on Review, small ghost links elsewhere), and cues such as a lone "still" under a lesson sentence read as stray words.

**How to apply:**
- Buttons on learning screens come from `components/ui/learn-buttons.ts` (`PRIMARY`, `SECONDARY`, `QUIET`, `SMALL`, `KBD`): flat, sentence case, 48px. No uppercase, no faux-3D bottom edge.
- Strand colors come from `components/strand-style.ts` (input sky, output xp, form go, fluency gold), so a strand looks the same on Today, in the plan and in the week card.
- Today answers first: the next undone task is drawn large with one Start (Enter starts it); everything else is grouped below by strand. Only one card says what to do next.
- Every cue chip carries a label ("means", "base form"); a key that does something is shown as a key (`Enter` to check, `1`–`4` to pick), shown only where a fine pointer is the main input (`pointer-fine:`, E20), so a touch screen never shows a key it does not have.
- Leaving a lesson that has answers asks first (X or Escape); staying is the default.
- The sidebar is language-first: language, the four destinations, then the tutor and its chats. Search and the Learn/Practice filter sit behind one search button. Background agents show only while one runs. Below `md` in the browser the sidebar is a drawer over the page, closed on load and on navigation.
- Minimum text size is 12px (`--text-xs`); `--text-sm` is 13px.

### E5. Keep API keys out of chat (2026-10-26)

Keys go in `.env` or environment variables, never in a thread. Each key only goes to its own service and is never logged in full.

### E6. Tests never touch the real profile (2026-10-28)

A full test run on the PC once wrote fixture chats into the real session list and ran a paid Opus placement turn. Under `NODE_ENV=test` with no `LH_DATA_DIR`, data goes to a temp folder. The key file follows the same fence (2026-11-06): with no `LH_AUTH_FILE`, a test run uses `auth.json` inside that data folder, never the repo-root one. Before this, `tests/speak.test.ts` deleted and restored the real speech keys, and a fixture var (`"B": "2"`) reached a real key file. An unknown var held in the file can now be deleted from Settings → API keys; `tests/auth-fence.test.ts` pins both. Always test in the cloud copy with `LH_DATA_DIR` pointed at scratch. Run with `NODE_ENV=test npx tsx --test tests/<file>.test.ts`. The suite is green on Node 26, the version CI runs (2807 tests). Under Node 22 the pi-ai package-exports test in `tests/subscription-auth.test.ts` fails; that is environment-bound, not a regression. On the PC (Eastern time) one sidebar test, "awaiting meta keeps the existing date", fails because it expects a UTC date; it passes with `TZ=UTC`.

### E7. Local only, no sync (2026-10-26)

Data lives in `data/` next to the app and is gitignored. The Electron app and `npm run dev` share it. No installer yet; the app runs with `bun run desktop:dev` on port 3010 (port 3000 belongs to another project on the same machine).

### E8. One screen per task, one scene list (2026-10-30)

**Why:** Talk ran twice. The chat version (2026-10-27) and the spoken Speak screen (2026-10-28) shared the same six scenes, copied into two lists. The curriculum's goal scenes still opened the chat, so one scene could be spoken or typed depending on where you clicked. A chat Talk credited output minutes when it opened, before anything was said, and kept the day active for the streak. Story had a chat version beside Read, and the plan had stopped producing it.

**How to apply:** each task has one screen and one scene list. Talk and Talk in writing are `/speak` (`?mode=typed` opens it with the keyboard on), Story is `/read`, and a goal's scene opens `/speak?scene=`. The scenes are `SPEAK_SCENES` in `src/core/speak.ts`. Chats are for what a screen cannot do: tutor units, Why? and the placement follow-up. Old Talk and Story chats still open, and the usage and corpus exports still classify them by title. A learning screen's "Set up a model" or "Settings → API keys" line opens the settings dialog (`components/settings/settings-link.tsx`).

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

**Why:** The settings dialog had grown names only its author could read (Providers, Learner, Prompts). Rare knobs such as the background color, heading weight, compaction thresholds and system prompts sat beside everyday ones. A switch that was on looked disabled, and the Azure speech region had no field. On Review the page painted a skeleton, then the card, then the mode toggle. The owner saw that as a flicker, and it counted as layout shift (CLS, E4).

**How to apply:**
- The nav reads Keys, Tutor, Learning, Appearance, Skill map, Keyboard, Spending, General, Data, in that order. Keys opens first. (Order and names replaced by E22.) Storage and Reset are sections of Data.
- Rare settings sit under a closed **Advanced** disclosure (`SettingsDisclosure` in `components/settings/controls.tsx`). Tutor has long chats and system prompts. Appearance has the background, the heading weight and the bold and italic colors. Skill map has the map update size. An empty field's hint names the factory default, never the stored value.
- Values that are not secrets are plain settings and show in their field: the Azure speech region (`plain: true` in `src/core/auth-keys.ts`). Keys stay masked and out of chat (E5).
- A switch is green with a white knob when on and gray when off. A choice among a few values is a segmented control (playback speed, quiz mechanics). The chosen font is marked with a tick and `aria-current`, not a fill.
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
- The first try is the first answer, before any help: no cue, no peek, the first ask of the sentence — never the end-of-lesson retry, and only where a form is asked (a meaning check tests the sentence, a word bank the order). `src/core/first-try.ts` is the measure; the lesson player holds the first answer while the cue shows and sends it as `first`, and lessons, Review and Speak record it on the drill the rep practiced (`progress.json` units: the `first` tally and its `byGender` split). A review answer counts too, unless a hint came first; it never joins the unit's `reps`.
- A wrong first try gets a slip named from the dictionary (`src/core/form-slip.ts`): `base` (the dictionary form, no ending), `same-word` (another ending of the same word), `other`, `blank`. The verdict does not change; accents-only is still its own verdict and never a slip.
- The grammar atlas cell and the tutor's "Measured weak points" read first tries, with the slips behind the wrong ones; under six first tries the tutor falls back to the lesson answers, labeled as such. The unit's `reps`/`correct` — XP, the path, the weak-spot mend rule — still read the final answer. The two measures answer different questions; do not mix them.
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
- Choose by pointer, not by width, for touch behavior: `pointer-coarse:` for 44 px targets and the press-and-hold microphone, `pointer-fine:` for keycap hints (E4a), and `touch-narrow:` (a coarse pointer below `lg`) for the sidebar drawer.
- Every tappable control is at least 44 px tall on touch (the Apple HIG minimum). The sidebar gets this from one rule in `app/globals.css` (`[data-sidebar]`); reader and lesson controls carry `pointer-coarse:min-h-11`. A word inside a sentence keeps its line height, because inline padding does not grow the line box, so its tap area is 39 px tall on a phone. Do not make it taller: the lines would move on touch.
- Pad for the safe areas with `env(safe-area-inset-*)` on the shell and the drawer. The bottom navigation was removed on 2026-11-02 with the Quiet tool redesign. `viewport-fit=cover` and `theme-color` come from `app/layout.tsx`.
- Installable: `app/manifest.ts` (standalone, starts at `/`, the app's colors) and `app/apple-icon.png`, rendered from `build/mark.svg` by `scripts/make-pwa-icons.mjs`. `app/layout.tsx` sets `apple-mobile-web-app-capable` explicitly: Next 16 emits only the standard `mobile-web-app-capable`, and iOS reads the Apple name for a full-screen launch.
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

### E22. Settings reads like any other app: everyday first, AI setup below (2026-11-01)

**Why:** The owner looked for a volume control and found playback speed under Tutor, next to the AI models. A learner does not know what "Tutor" or "Keys" means in settings, and the dialog opened on API keys. Three error lines also sent people to "Settings → Models", a section that did not exist.

**How to apply:**
- The nav reads General, Learning, Sound, Appearance, Keyboard, Skill map, Devices, then a divider, then AI models, API keys, Spending, Data. Settings opens on General. Setup links still open API keys directly.
- Sound holds volume, playback speed and lesson sounds. Quiz style is under Learning. AI models holds only the models, tools, long chats and prompts, the settings that need an API key. "Tutor" is a feature name (Ask the tutor), not a settings name: nothing under Sound, Learning or Appearance needs a key.
- A setting goes where a learner would look for it, not where its value is stored: quiz style is saved with the tutor's tools but shown under Learning.
- Volume is a slider, not steps, and the speaker button in a lesson or Review opens it on hover, focus, right-click or long press; a click still mutes. Moving it while muted turns sound back on.
- Clips play as recorded at 1× (0.75×, 1×, 1.25× around it). Two attempts to speed the slovak.wiki clips to a "normal" pace by a fixed rate failed (1.136× sounded slow on one clip, 1.319× too fast on another, 0.99× right). The cause is the recording: slovak.wiki generates its voice with ElevenLabs speed 0.88 (`content/audio/config.json`), so its sentences are about 1.2× longer than the same voice read at default speed, and their pace varies clip to clip (3.6 to 5.6 syllables a second). No single rate fits all of them, and a slowed-in-the-model read does not become natural when sped up. Each source has a measured pace in `src/server/tts.ts` (`paceRate`): slovak.wiki and Edge 4.55, ElevenLabs 5.0, measured on the clips kept in `data/audio`. The owner heard the wiki clips at 1× as slow (they are recorded at 0.88× for learners, and slovak.wiki itself plays them as recorded).
- Every "Settings → …" line in the app names a section that exists. The stored settings key stays `agent` (and `/api/settings/agent`) so saved data and the API do not change; only the dialog's own section id became `ai`.

### E23. Full grammar words and one spelling (2026-11-01)

**Why:** the owner read "acc-fem is locked, I'll use loc as the weak spot" and found it unclear, and saw the same short forms around the app: N/G/D/A/L/I in the grammar atlas, "fem. G/D/L" in a rule, "1st person sg." in the word bank. The app also mixed British and American spelling ("Practise" next to "Practice").

**How to apply:**
- Anything a learner reads, and anything the tutor is given to repeat, names grammar in full words: feminine accusative, locative, genitive plural, 1st person singular. Unit ids (`acc-fem`, `loc`) are code and stay out of prose; where a model must answer with an id, give it the id and the full name side by side, and tell it to say the name.
- The app is written in American English: practice (noun and verb), color, behavior, recognize, analyze, neighbor, favorite, gray. Stored ids keep their old spelling so saved progress does not move (`lx-colours`). `cancelled` stays: it is the one spelling the app uses, and Electron passes it as an error code.
- The lexicon's English glosses come from slovak.wiki through `scripts/merge-lexicon.mjs`, so their spelling is fixed there, not here.

### E24. Mix-ups are kept per pair of words, predicted, then tested (2026-11-01)

**Why:** the owner typed "Niekto" for "Nikto" and asked whether the app keeps its mistakes, so it can find the pain points, predict similar ones and practice them. The answers were logged, but only units were measured, so a confusion between two words disappeared into an accuracy figure and the tutor never heard of it. Research note: [research/mixups.md](research/mixups.md).

**How to apply:**
- A mix-up is a wrong first try (the E18 rule) whose answer is another lexicon word, not a form of the wanted one (that is a slip). It is kept per pair of entries in progress.json (`mixups`): both lemmas, the family, the misses, the right first tries since the last miss and the last three misses as evidence. Lessons, Blitz and Review (without a hint) count. `src/core/mixups.ts` is pure; `src/server/mixups.ts` reads the answers in.
- Families are data, not code: `curriculum/slovak/mixups.json` (id, title, one English rule, one Estonian bridge, twins by lexicon slug). A twin missing from the lexicon, or a pair with fewer than three verified sentences that hold only one twin, is dropped, as in E11.
- A mix-up predicts up to three pairs: its family's others, else the same small edit applied to other lemmas (`ruleNeighbours`). A prediction is a probe, shown as "not tested yet", never taught as a fact. It is tested as a two-way choice; two right first tries clear it, a miss makes it a mix-up.
- A mix-up is mended after three right first tries since its last miss; a miss opens it again. The record keeps 40 pairs at most and never drops an open one.
- The Mix-ups lesson (`/lesson?mode=mixups`): open pairs typed on both sides in turn, probes as a choice, each rep a verified sentence with the pair's rule after a miss. It counts XP, the day's minutes and `day.mixups`, never a unit or the atlas. A regular lesson rep of a word in an open mix-up carries the pair's rule too, unless it names a form.
- Today shows "Words you mix up" beside the weak spots. Strengthen takes the Mix-ups lesson when no weak spot is on record. The tutor's "This learner" block names the open pairs and their probes.

### E25. My mistakes: analyzed locally, saved with its time, guide on request (2026-11-01)

**Why:** after E24 the owner asked whether the analysis is batched, and where the latest results, the personal plan and the time of the last analysis can be seen.

**How to apply:**
- `/mistakes` (Today's "My mistakes" row, and "All my mistakes" under Words you mix up) reads `src/core/mistakes.ts`: first tries only (E18), per unit with a trend (last 14 days against the days before, six first tries each side, and a difference past chance), the words missed most, week by week, and the mix-ups (E24). A Mix-ups lesson, placement and Speak stay out of the unit figures.
- Nothing is batched and no model runs for the analysis. A visit shows the saved snapshot in `analysis.json` with its time; "Analyze now" reads the lesson log again and saves a new one. The first visit takes one.
- The guide is optional and the only model call: one Cheap-slot call from the snapshot's facts (`guideFacts`), three fixed sections, never a fact outside them. It is kept in `analysis.json` with its model and tokens (E1), reused while the facts' digest stands, and marked "your answers have changed since" when they do not. Without a model the page works and the button says what is missing.
- The page stays out of the sidebar's four destinations (E4a).
- Thresholds, so a handful of answers is never read as a finding (2026-11-01, after the owner saw "63% right" named as the lesson to do from eight answers). A unit's score carries its 95% Wilson range, shown under twenty first tries ("few answers, likely 31–86%"). A unit is called weak only when the top of that range is under 85%. A trend is better or worse only past a two-proportion z-test at the 5% level. A word is "missed most" from its second miss; one miss is a slip, and the lesson already sent it to review. The guide waits for 30 first tries with 5 mistakes among them, shows how far off that is, and its prompt says a pattern needs two misses behind it. A mix-up still opens on one miss: a specific wrong word is stronger evidence than a percentage, and it is mended after three right answers.
- AI is what makes the read deeper, and the page says so (2026-11-01). The local analysis counts; the guide reads the latest 15 wrong first tries (the sentence, the form wanted, what was written) and returns JSON that the page shows as patterns (what, evidence, why, fix), guesses and a plan whose steps open the app. A reply that is not that JSON is shown as written. The same sentences the learner practiced go to the Cheap-slot provider, as with Why?; nothing else leaves the machine.
- "Is AI ready" is a slot set and the provider's key present (`src/server/ai-status.ts`); a slot with no key looks set in Settings and fails at the first call. While it is not ready, a feature that needs it shows `components/ai-callout.tsx`: what is missing, what AI adds, that the rest works without it, and a button that opens Settings on API keys or AI models. A provider's "not configured" or key-refused error is turned into the same plain message (`friendlyAiError`). Custom milestones use the same status.
- The analysis acts on the plan (2026-11-01): a lesson renews a snapshot older than six hours, and Strengthen takes a unit whose first-try accuracy fell (trend "worse") after a weak spot on record and an open mix-up, never the Continue unit. "Do this next" on the page is worked out from the figures, not from the guide's text, so it is there without a model: the Mix-ups lesson, a lesson on the weakest or slipping unit, and "Add to review" for the words missed most (one word, or all). The guide stays text.

### E26. The personal lesson: the model picks the targets, the lexicon builds the reps (2026-11-01)

**Why:** the owner asked whether analyzing yourself with AI creates anything personal in the learning journey, and whether a stronger model should do it. It should choose and explain; it should not write the sentences a learner practices, because a wrong form in a drill is learned as right at A1–A2 (P8).

**How to apply:**
- The guide runs on the Strong slot, else Cheap, with the slot's own thinking level (`aiStatus("strong")`). It runs a few times a week, so the cost is small and the reasoning is worth it.
- Its reply carries `practice`: up to six words (lemmas from the facts), three unit ids and three pairs. `resolvePractice` (`src/core/personal.ts`) keeps only what the lexicon backs: a word with a verified sentence, a lesson unit with three sentences, a pair both of whose twins exist with three sentences that hold only one of them. What survives is kept with the guide in `analysis.json`.
- The pairs become mix-up probes (`from: "guide"`, "suggested by your guide"), tested before they are taught, like a family's.
- `/lesson?mode=personal` builds twelve reps from those targets with the existing builders: pair reps (typed when the pair is an open mix-up, a choice when not), a typed cloze per word, typed reps per unit. Targets take turns, so the lesson is interleaved. It counts XP, the day's minutes and `day.personal`, never a unit or the atlas, and logs `mode: "personal"`.
- Strengthen takes it for seven days after the guide, after a weak spot on record and before mix-ups and slipping units: "Strengthen: Your plan · <the guide's first pattern>".
- The model never writes a sentence for a drill. Sentences the lexicon lacks may later come from a model into a queue that a check other than the learner approves; that queue is not built.

### E27. Lexicon sentences come from Tatoeba or the owner's curated text, never from a model (2026-11-01)

**Why:** the mix-up families could not drill nikde, sem, aj and similar words, because slovak.wiki's frequency lists are open-class and never made them rows. Filling the gap is a data change, so it has to meet P8 and E26: no sentence a learner drills comes from a model.

**How to apply:**
- Examples are Tatoeba sentences (CC BY 2.0 FR, with the tatoebaId kept) or the owner's own curated sentences. `scripts/dictionary/tatoeba-api-examples.ts` in slovak.wiki applies the wiki's gates: the token must be the word, the sentence must pass the corpus-quality check, reviewer rejects stay rejected, and an English translation is required.
- Verbs are not filled that way. A stem search returns homographs (the stem of vládať also gives vláda, the government), and Tatoeba has few sentences for most verbs. Verb coverage needs its own method.
- A word the owner blocks in `src/lib/catalog/frequency/blocklist.ts` stays out, even when its sentences exist (pohlavie, členný, posledne, naviac, vše, pro, mam, cup, sex).
- A word with fewer than three usable sentences is not a drill. It is a row, not a lesson, and the thin-word count in the lexicon says so.

### E28. Verb blanks come from the UD treebank's forms, not a dictionary's paradigm (2026-11-01)

**Why:** 102 verbs had fewer than three sentences the lexicon could blank. For 79 of them the wiki had no verified forms, so the export could not blank their sentences, and Tatoeba had too few sentences per form to fill them (it matches whole words, and its Slovak corpus is thin for these verbs). A paradigm from the Hunspell spelling dictionary would have matched 300 sentences, but that dictionary is built to accept words, not to say which forms a learner should drill: its affix rules generate every form a verb might take, rare and bookish ones included (the transgressive dosiahnuc), while the treebank lists only forms annotators found in real sentences.

**How to apply:**
- `curriculum/slovak/ud-verb-forms.json` lists, for each verb lemma, the forms the Universal Dependencies Slovak SNK treebank gives it (`scripts/build-ud-verb-forms.mjs`). Its README says lemmas and morphology were assigned manually and only sentences where two annotators agreed are kept. A form is used only when it is a verb wherever it occurs and has one lemma.
- The cloze step of `scripts/export-slovakwiki-lexicon.mjs` blanks a verb's sentence with those forms as well as the wiki's own.
- `scripts/merge-lexicon.mjs` gives a blank to a shipped sentence that has none. Text, position and the rejected flag do not change. 161 sentences gained a blank, all for verbs; 28 of the 102 thin verbs now have three usable sentences.
- The forms file is licensed CC BY-SA 4.0, the treebank's license, and names that license and its source in its header. It is derived data, so the share-alike term applies to it. The owner chose to keep it in the repo (2026-11-01).
- The other verbs stay thin until a verified source exists, for example JÚĽŠ.

### E29. Certain rules are checked in code, and every tutor verdict says what backs it (2026-11-01)

**Why:** the owner wants a tutor that "very rarely misleads the student". The accuracy eval ([research/slovak-accuracy-eval.md](research/slovak-accuracy-eval.md)) found three things:
- Haiku accepted *s sestrou* with the `so` rule in its context.
- Sonnet at low and medium rejected curated, correct sentences.
- Both models were confident when wrong, so a confidence number from the model would mislead too.

**How to apply:**
- **`src/core/slovak-check.ts` checks what a program can check for certain:**
  - vocalized prepositions (`so/zo/ku/vo`)
  - `nie je`
  - Czech letters
  - `budem` with a common perfective infinitive
  - `dva/dve/dvaja` against a gender the lexicon is sure of

  A sentence equal to a curated lexicon example is verified correct. Every rule has a test against the correct sentences models rejected.
- **Every Slovak practice answer reaches the model with a `[Checker …]` note** when the checker has something certain to say (`withSlovakEvidence`, `src/server/chat-handler.ts`). The learner's card shows only what they typed.
- **The tutor has `check_slovak` and `slovak_reference`** (the slovak-language skill's chapters, `.claude/skills/slovak-language`) beside `lookup_word`. `prompts/language/10-slovak.md` tells it to check before marking Slovak wrong, and never to fix a correct alternative.
- **`conclude` carries `evidence`.** `checked` means a tool confirmed the forms the verdict rests on; `judgment` means the tutor's reading, said in the verdict. The concluded card shows "Checked in the dictionary" or "Tutor's judgment, not checked". The label comes from what backs the verdict, never from the model's own confidence.

### E30. The trail design: four marks, one gold, a climb (2026-11-02)

**Why:** the owner wanted the app to feel like a language app, but not a copy of the best-known one, and rejected both a Duolingo-like build and a flat editorial one. The direction has to be the app's own and still keep what works: one next step, a visible path, streaks and XP, feedback in a fixed place. Research and sources: [research/trail-design.md](research/trail-design.md).

**How to apply:**
- The four kinds of practice (Nation's strands) are the four Slovak trail colors, carried by the trail mark (`components/trail.tsx`): input red, speaking blue, words & rules green, speed yellow. Strand colors come from `components/strand-style.ts` only.
- One action color, the sun (`--lh-sun`): the main button (`components/ui/learn-buttons.ts`), the streak (a flag, not a flame), XP, the Review badge, every finished stop and the walked stretch of any progress bar. Right answers are the trail green, wrong ones the trail red; nothing else is saturated.
- The path is the climb (`components/climb.tsx`): levels as stretches of a mountain read from the bottom up, chapters as stops on a switchback trail, done in solid gold, ahead dotted, the current stop ringed. Today shows the current stage; `/curriculum` the whole mountain. No winding road of icons, no list of dots.
- Flat tonal surfaces (ground, card, raised, edge), hairlines, radii 12–24 px, no gradients, no drop shadows except on menus. The chrome font is Bricolage Grotesque; prose stays Source Sans 3.
- Copy stays short and plain; the design's words are "climb", "stop", "days in a row", never a metaphor the learner has to decode. The mountain is kept to the climb card and the ridge line; nowhere else.

### E31. Stamps mark outcomes, carry no XP, and four indicators sit at the top (2026-11-02)

**Why:** the owner asked for the app to be "drastically gamified in ways that make sense". The evidence ([research/gamification.md](research/gamification.md)) says gamification helps learning modestly when it is themed and lasting, that badges work for those who see them, that points, leagues and leaderboards raise output but not motivation and can lower both, that rewards experienced as the reason to act crowd out the real one, and that streaks work best with forgiveness. The design keeps to what that supports.

**How to apply:**
- Stamps (`src/core/stamps.ts`, `components/stamp.tsx`) are the app's badges: a summit stamp per level, a stamp per chapter, and a fixed list of deeds. Every stamp is earned by an **outcome on record** (words known, lessons finished without a miss, a chapter done, days in a row), never by an action (a lesson started, a button pressed, minutes alone). A stamp carries no XP, buys nothing and unlocks nothing. Once earned it keeps its day in `progress.json` and is never taken back.
- Stamps are judged in `progressSummary` (`src/server/stamps.ts`), so any path that moves the record (a lesson, Review, a story, a scene) can earn one. A lesson reports the stamps it earned on its end screen, once.
- The top of Today shows four indicators and no more: days in a row (flag), today's minutes against the daily goal (ring), words known, XP. The level is on the ridge; nothing is repeated.
- The This week card names the target (the goal's days a week) and says when it is met; rest days inside it are not failures.
- No leaderboards, leagues, hearts, lives, currency, chests, variable rewards, purchasable streak freezes, confetti or notifications. Any new reward mechanic is checked against `.claude/skills/gamification-loops/references/validations.md` and recorded in the research note before it is built.

### E32. No AI-slop defaults (2026-11-02)

**Why:** agents build most screens, and left to defaults they produce the same page every AI tool produces: Inter, a lavender accent, gradients, glows, glass cards, colored card edges, icon-card rows, stat banners and all-caps labels. Research: [research/design-slop.md](research/design-slop.md).

**How to apply:**
- Before designing or restyling a screen, read `.claude/skills/anti-slop-design/SKILL.md`; `AGENTS.md` points every agent there.
- One layout primitive and one bold choice per screen; body text passes WCAG AA in both themes; shadcn components are restyled to the app's tokens before they ship.
- Run the skill's diff checks before calling a UI change done. A hit on an added line needs a reason or a fix.

### E33. The Quiet tool design: one teal, Geist and a rail (2026-11-02, branch `feat/quiet-tool-redesign`)

**Why:** the owner compared three full-app redesigns, each built from concept mockups. This one is the "Quiet tool" (mockups in `r3-3-quiet`: Today on desktop and phone, and a Review screen). It is a calm, dense tool look with one accent.

**How to apply:**
- Tokens are the mockup's own. Day values are copied from its `base.css` into `app/globals.css` as `--q-*`; the old semantic tokens (`--background`, `--card`, `--sun`, `--lh-go`…) map onto them, so older classes keep working. Night is derived from Day (grounds swap to near-black at the same gaps, ink steps invert, teal lifted for the same contrast, shadows black). `--q-card` is the raised surface: white in Day, a lighter step in Night.
- Day or Night follows the system unless Settings → Appearance → Mode says otherwise (`localStorage` key `lh:theme`; a script in `app/layout.tsx` sets the `dark` class before paint).
- The mockup's component CSS is `app/quiet.css` (in the `components` layer, so utilities override it): `.q-btn`, `.q-card`, `.q-sh`, `.q-well`, `.q-segc`, `.q-jump`, the rail, and the practice-screen pieces. Icons are the mockup's set (`components/quiet/icon.tsx`).
- One font: Geist (JetBrains Mono for code). The four strands are told apart by icon, not color, so the four trail colors are one neutral grey. Done and right are teal; wrong is a muted red (`--q-miss`), which the mockups never draw.
- There is no search bar on any screen (owner, 2026-11-03: it was not useful). Ctrl or Cmd K still opens a palette of every route and curriculum unit; the Slovak letter keys sit inside the exercises that need them, not in a pinned bar. The sidebar is a permanent column from 768 px up, with no collapse; below that it is a drawer opened by a menu button. On a phone the jump bar replaces the bottom tabs.
- Today is a plan, not a strip: one list of tasks with a word label, minutes and state, the next one large with one Start. Charts (`components/quiet/charts.tsx`) read only the progress summary and draw an intentional empty state, never invented figures. Tutor tasks are hidden while no AI key is set. Read is the episode only; there is no sentence-by-sentence mode.
- No word is marked with a tinted pill or a curved underline. A blank is a straight writing line (`.q-blank`, `.q-write`); a marked or answered word is weight and color with a straight text underline (`text-decoration`, 2 px, offset 6 to 8 px). No frosted glass (`backdrop-blur`) and no all-caps labels.
- Mockup copy the app cannot back does not ship: the sample sentence and the rule note with the Estonian bridge on the Review card, "Add 3 minutes of Say it faster", "Not today", "Why? Ask the tutor", and invented shortcuts.

### E50. Cheatsheets: one line per phrase, kept as JSON, words to Review on request (2026-11-06, branch `feat/cheatsheets`)

**Why:** the owner wanted a Russian phrase list for a co-op game played in Russian only, as a feature under Words. A list written by a chat assistant is reference text for a situation the course does not cover. The first version parsed Markdown, because assistants answer in it; the owner asked why the app needed it at all ("we are doing all this parsing shit"). The app does not: a phrase is one line.

**How to apply:**
- The table is the editor (owner, 2026-11-06: "maybe it would be simpler to edit it as a table view"): a section name, then one row per phrase with Phrase, Say it, Meaning and Note fields, and Add phrase, Add section and remove buttons. Say it is a column of its own, because the owner adds pronunciation when writing by hand. The **Text** view is for pasting a list, such as an assistant's answer, and is one line per phrase: `phrase | say it | meaning | note`; a line with no `|` starts a section. Empty fields are allowed (`голова |  | head`). Phrases above the first section go to "Phrases". A section with no phrase is dropped. Pasted table headers and their `|---|` line are skipped, and bold marks are stripped. There is no other syntax. `formatSheetText` writes the same format, so Edit shows what Save reads back (`src/core/cheatsheets.ts`, pinned by `tests/cheatsheets.test.ts`).
- The chat-assistant lines of a pasted answer ("I put this together…") are not filtered out any more. Each one becomes a section name, and the dialog lists the section names under the count, so a stray line shows up before it is saved. Deleting it is one edit.
- Where you are decides the action (owner, 2026-11-06: "why are we importing instead of just adding or editing?"). The list has **New cheatsheet**; an open sheet has **Add phrases** and **Edit**. One dialog serves all three; the app never guesses which sheet a paste belongs to.
- **Add phrases** keeps one phrase in one place: the paste is compared with the sheet (`phraseKey`: case, ё and punctuation do not count; "a / b" is covered when both parts are), the dialog says "9 new · 40 already here", and only the new phrases are added. A phrase goes to the section it names (a number or the title matches, `sameSection`), else to a new section at the end. Nothing is written when nothing is new.
- The table scales (owner, 2026-11-06: "make sure that it scales well"). Rows and sections are memoised, so a keystroke rebuilds one section; sections in the editor and on the sheet use `content-visibility: auto`, so only what is on screen is painted. Before that, every keystroke repainted the whole window: 92 ms a key for 173 phrases and 113 ms for 720, at 4× CPU throttling on a production build. After: 173 phrases open in about 0.5 s and type at 20 to 32 ms a key; 720 open in about 1 s and type at 39 to 47 ms. A test that reads section titles off the page must use `textContent`, since `innerText` is empty for an unpainted section.
- Keys and guards in the table: Enter goes to the next phrase and past the last one adds a phrase; Enter never submits; Ctrl or Cmd+Enter saves. Removing a section that has phrases asks first. Closing with unsaved changes asks "Discard your changes?". The header and the Save bar stay put while the table scrolls, and a Jump to a section menu appears once there are more than three sections. New and Edit open on the table, Add phrases on the Text view, since adding is mostly pasting.
- Sheets can live in the repo (owner, 2026-11-06: "we could save cheatsheets to the repo"). App data stays local (E7), so the app does not commit anything: a sheet in the repo is a file, `curriculum/<language>/cheatsheets/<name>.txt`, in the same text format with `# Title` on its first line (`parseRepoSheet`, `formatRepoSheet`). The list shows local and repo sheets together; a repo sheet's id is `repo-<name>` and no local id starts that way. Edit and Add phrases write the file in place with no trash copy, since git is its history; the app never deletes a repo file (DELETE answers 409). **Move to repo** writes a local sheet out under its title's slug and puts the local copy in trash. Tests never touch the repo folder: under the test fence `repoCheatsheetsDir()` points into the throwaway data folder, and `LH_REPO_CHEATSHEETS_DIR` overrides it. `tests/cheatsheets.test.ts` parses every shipped `curriculum/*/cheatsheets/*.txt`, so a broken file fails the suite instead of vanishing from the list.
- Each change keeps the version before in `trash/` (E1). A removed sheet moves there too. The corpus export writes `cheatsheets.json`.
- The sheet is the learner's own curated text. Its words go to Review through the dictionary (`cheatsheetToReview`, 30 at a time), so a mistake in a generated line never becomes a drill; the merge does not judge a phrase, so a wrong one comes in like a right one.
- Open: a "write me a cheatsheet for…" request inside the app (Cheap slot, cached, priced), and a custom Speak scene from a sheet.
### E54. Today's line is heard cold, heard again after practice, and counts rather than grades (2026-11-05, branch `feat/daily-hooks`)

**Why:** the creator research ([research/creator-hooks.md](research/creator-hooks.md), proposal 1) found that a payoff which arrives after an attempt holds attention, and that a before-and-after from the learner's own record shows change without a grade. The line is a daily first listen of about a minute, with no text shown before the answer.

**How to apply:**
- One sentence a day, from the dictionary's verified examples: five to twelve words, one or two glossed words the learner has not met (`src/core/line.ts`, `pickLine`). The day's sentence is seeded by language and day, and once heard it is kept in `line/log.jsonl`, so it never changes within the day. A sentence heard in the last fourteen days is not picked again.
- Nothing is shown before the answer, except the play buttons. The audio is the shared Listen audio (E1), and no model is called.
- The evening replay is offered only after the learner has practiced that day (XP, reps or a review), so the line never asks for a return visit by itself.
- The score counts words typed exactly. A word typed without its accent is marked apart and is not counted as caught. It is shown as "3 of 9 words", never as a grade or XP (E31).
- Time on the page counts as listening minutes (P9).
- The line is a task in the same frame as Listen and the lessons (`/line`, 2026-11-06): the sentence plays as the card opens, nothing is shown before the answer, and the result is the count as the figure with every word marked (caught in full, missed faded, a missing mark underlined). On Today it is a row above the plan, not a card, so the plan's Start stays the one next step (E4a).
- The last 14 days are a chart of two marks a day, the morning in the app's de-emphasis gray and the evening in the teal, joined when both are in. That is the emphasis form of the dataviz method: the pair passes the CVD and normal-vision separation checks on both themes, and the legend and today's direct labels carry identity besides the color. The same numbers sit in a table behind one button, so nothing is reachable only through the chart.

### E55. The stage sentence names the limit with the milestones' own numbers, and says when a number is an estimate (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 4 of the same research: the learner should be able to see which gap limits them without reading a table. The milestones already measure the words gap and the speed gap; they did not say which one binds on Today.

**How to apply:**
- One sentence on Today, built from `estimateMilestone` for the nearest unreached milestone (`src/core/stage.ts`). It adds no measurement of its own.
- A speed that comes from the level's ladder, not from the learner's Listen or Watch sessions, is said to be an estimate in a second line (P8).
- When every milestone is reached, the sentence says so and names nothing. With no milestones at all, it says there is nothing to measure yet.
- The sentence sits in one "Where you are" card on Today (2026-11-06) with two meters under it, words and speed, that carry the same numbers: the binding gap is the teal one, the need is the marker on the track (the `.q-bar` meter the week's balance already uses), and an estimated speed is marked "est." on the meter as well as in the line. A dated scene (E52) sits in the same card. The card has no primary button; "See the evidence" is a ghost link to Milestones.

### E56. Watch lines come back in Listen (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 7 in [research/creator-hooks.md](research/creator-hooks.md): a line the learner missed in a video is the most useful Listen sentence they can get, and spacing brings it back while it can still be learned.

**How to apply:**
- A line not understood on the first unaided listen in Watch is queued per profile (`data/profiles/<language>/watch-reps.json`, `src/store/watch-reps.ts`). It comes back tomorrow, then in 3 and 7 days. An understood answer moves it on; a miss or a peeked answer sends it back to tomorrow; the third understood answer, at the 7-day check, retires it (`src/core/watch-reps.ts`).
- At most three due lines join a Listen session, oldest due first. They are typed like any Listen sentence, labelled "From a video you watched", and graded against the stored line.
- Lines from foreign captions (Czech for Slovak, E41) do not come back: they would be played in another language.
- The audio is the existing Listen path (E1). No model is called, and no near-miss meaning is asked for.
- In Listen the line carries its source (`ListenItem.source`): a "From a video you watched" pill and the video's title, in place of the new-words line.

### E57. Catch the mistake: a separate exercise, not a planted slip in episodes (2026-11-06, branch `feat/daily-hooks`)

**Why:** proposal 6 wanted the learner's own confusion to show up in a story. A wrong word inside a Read episode teaches the wrong form to anyone who skims, and the episode should be correct Slovak. So the mistake moved out of the stories into an exercise of its own.

**How to apply:**
- The pair comes from the learner's mix-ups on record (E24) that are verified pairs (E11), missed at least twice, and not used in the last five items (`chooseCatch` in `src/core/catch-pair.ts`). Each answer is read like a lesson first try: catching the word and typing the right one is a hit, typing the other word or letting the wrong word pass is a miss.
- The Cheap slot writes a three-sentence item with the wrong word, and `verifyCatch` must accept it before it is kept (E29). Kept items live in `data/profiles/<language>/catch-mistake.json`; a waiting item is served with no new call.
- The learner presses Start, taps the wrong word, types the right one, and then sees the whole item with its translations and the rule. The typed word is graded with `compareAnswer`. The page is `/catch`, linked from "Words you mix up" on Today.
- Read episodes carry no planted mistake. An episode written with a slip earlier still reads normally.
- The series lead is Martin ("Martin in Bratislava", `curriculum/slovak/world.json`). The internal `robo` series id is unchanged.

### E58. A scene with a date: a custom milestone with a day and a line after it, never an invented speed (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 3: a dated, concrete scene makes the future self visible. The app must not invent a speed or a date to give one.

**How to apply:**
- A dated scene is a custom milestone with a `date` (`src/core/dated-scene.ts`). Days left come from the learner's own day key. "On track" or "behind" compares the milestone's estimate at the measured pace with the date. With no measured speed or pace, the app gives no date and says what measures it.
- The date is chosen with quick choices and a month-and-year stepper, with no native date input (E4). A date in the past is refused before anything runs.
- The line after the date is written once, with no XP and no stamp (E31). The words are mapped by the cheap model, as for any custom milestone, so adding a scene needs an AI key.
- On Today the scene is a row inside the "Where you are" card (E55): the days left as the figure, the status as a word next to the title, the app's line under it, and links to Speak and, once the date has passed with no line written, to Milestones. Weekly rehearsal is not built yet.

### E63. Every task shows the research behind it: what it found, what it did not show, and which numbers are the app's own (2026-11-06, branch `feat/sources-and-speed`)

**Why:** the owner asked to link the sources the exercises rest on and to fix whatever an analysis found. The analysis (research/evidence-audit.md) found claims stronger than their sources, features that go past what any source covers, and numbers that read like research and are the app's own. P8 (honest numbers) covers research claims too. The owner also decided to keep the Speed page and its shrinking window ("the time pressure makes sense"), so the page has to say plainly what the research does and does not support.

**How to apply:**
- One registry, `src/core/sources.ts`: SOURCES (cite, title, venue, DOI, kind and an honesty level: `read`, `doi`, `listed`) and FEATURES (what was found, what was not shown, the app's own choices, and the source ids). The `SourcesNote` component folds a feature's text under its screen; `/sources` lists all of it. A new task, or a new research claim in copy, adds a FEATURE entry in the same PR. `tests/sources.test.ts` fails on an unknown id, a source no feature cites, a missing "did not show" paragraph, or a feature whose page does not exist.
- A link is added only for a DOI that `npm run sources:check` finds on Crossref with that title and first author. `read` is claimed only for an abstract actually read against the claim made here. Books and anything without a confirmed DOI are `listed`, unlinked, and the page says so. Nothing sends the owner's email or other contact details to Crossref.
- Speed keeps its shrinking window. The note says the research supports the repetition of the same lines (de Jong & Perfetti 2011; Lambert, Kormos & Minn 2017; Thai & Boers 2016), not the window, and that Boers (2014) found tight time limits did not add fluency and could cost accuracy. So a spoken pass counts only when it was also clear and when the microphone heard a voice; a self-timed round says it is self-timed and that nothing checked what was said; the pace shown (words a second, first pass to last) is repetition on the same lines and says so.
- Numbers that are the app's own are named as such where they are shown: targets per level, the windows, the 93% listening floor, the 70 and 85 clarity cutoffs, the unit-completion thresholds, the milestone lemma factor and speed ladder, the hour figures.
- Where the app counted something other than its label (a typed match called "understood", review-deck cards called "words known", a morning/evening replay that shows the sentence in between), the label changed, not only a footnote.

## Working rules (how work reaches the repo)

### E34. One name per page: route, nav label and page title (2026-11-03, branch `feat/quiet-tool-redesign`)

- A page has one name, and the route, the sidebar label and the page title all say it. The table is `lib/nav.ts`; the sidebar, the jump palette and the document titles read it, and `tests/nav.test.ts` fails when a page under `app/` is missing from it or a label and a title differ.
- The names: Today, Curriculum, Review; Practice: Read, Listen, Watch, Speak, Fluency (now Speed, E48); Understand: Words, Grammar, Map; Track: Progress, Milestones, Mistakes, Log. Lesson, Exam, the Tutor chats and Set up are reached from inside other pages and keep their own one-word titles. The Curriculum page's second view is called Mountain; "Your climb to B2" is its subtitle, not its name.
- The Progress page was `/plan`; `/plan` redirects to `/progress`. A subtitle may carry the old, longer name ("When can I…?" under Milestones).

### E35. One motion system: a timing scale, transform-only, press that shrinks (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner asked for a drastic UX improvement guided by four animation skills. The audit ([research/motion.md](research/motion.md)) found eleven bars animating `width`, fifteen `transition-all`, a `box-shadow` animated forever, nine durations and five easings for the same kind of move, a press that looked like a disabled button, and a Review card with no motion on a verdict.

**How to apply:**
- Durations are `--dur-press` (100 ms), `--dur-fast` (160), `--dur-base` (220) and `--dur-slow` (320); the curve is `--ease-out`. Tailwind's own `ease-out` and default transition are overridden with them in `app/globals.css`, so a bare utility is already right. Nothing a learner waits on runs past 400 ms; reps and anything the keyboard triggers stay at the short end.
- Animate `transform` and `opacity` only. A progress bar is `.lh-fill` with `fillStyle(share)` (`components/ui/fill.ts`), inside a track with `overflow-hidden`. No `transition-all`, no animated `width`, `height`, `left` or `box-shadow`; a ring or glow is a pseudo-element scaled and faded.
- A pressed control shrinks: `.lh-press` (learn buttons, option tiles, play buttons) or `.q-btn` scale to 0.97. Links and rows dim as before.
- A popover or dialog uses `.lh-menu-in` with an `origin-*` toward its trigger, a backdrop `.lh-fade`. No overshoot on anything that is not a result.
- A result moves: a miss shakes, a right answer pops into its slot, new content in the same place settles (`components/motion.ts`, Web Animations, so nothing remounts).
- Hover styles live behind `(hover: hover)`; every animation has a reduced-motion end state, and a global rule catches the ones that forget.

### E36. Keep the browser bundle small, give every tab an instant response, measure a build (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner found clicking tabs "very very slow". The causes ([research/slow-tabs.md](research/slow-tabs.md)) were dev mode, 900 KB of KaTeX and Markdown parsing in every route, and a tab click with no response until the server finished.

**How to apply:**
- A client component imports `@/src/core` only for light things. Anything heavy lives behind `@/src/core/tutor` (KaTeX and the Markdown parsers in `math-delims` and `answer-presentation`, TypeBox's validator in `tool-parts`), which only a tutor component imports. The TypeBox schemas are in `question-schemas.ts` and `contracts/probe-schema.ts` (agent and tests only). Do not re-export any of them from `src/core/index.ts`; ESLint allows the two entry points and no other path.
- A tab you press lights at once (`components/language-switcher.tsx`), before the route changes.
- `app/loading.tsx` costs about 300 ms of extra long tasks on a full page load at 4x CPU (the fallback and the page hydrate separately) and nothing on a client navigation; it was kept because the click is what the owner feels. Next.js 16.4's Partial Prefetching with Cache Components was tried and not adopted: it fails on 72 `force-dynamic` exports and would bake per-request file reads into the build unless each is audited (see slow-tabs.md).
- Every page is server-rendered per request, so `app/loading.tsx` must exist: a tab click changes the URL and shows the page's shape at once (production build; dev mode does not prefetch).
- Judge speed on `npm run desktop:prod` or `node scripts/perf-check.mjs --cpu 4`, never on `desktop:dev`. A change that adds a large dependency to the shell shows up as long tasks in that table.

### E37. Clips play as recorded: the pace is not normalised at playback (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner asked what speed the voice runs at and whether the setting is accurate. On 40 slovak.wiki sentences the pace runs 2.3 to 5.4 syllables a second ([research/voice-pace.md](research/voice-pace.md)), so "1×" is not one speed. A per-clip correction toward a fixed pace was built and then reverted: the voice is generated at ElevenLabs speed 0.88 and its pace depends on the sentence, a full correction (1.58× on a slowly read proverb) made it sound rushed, and a capped one (0.8–1.3×) still fights the recording. The same approach had already failed twice in November (`6ed7944`, and the E22 note on clips).

**How to apply:**
- `audio.playbackRate` is the setting (0.75, 1, 1.25) or the snail (`slowRate`), nothing computed from the clip. Do not add a per-clip or per-source rate; if a voice is too slow or fast, change how it is generated (the ElevenLabs speed, the Edge `EDGE_RATE`), which splits the cache key and is the owner's call.
- `scripts/audio-pace.ts` and `countSyllables` (`src/core/pace.ts`) measure a profile's clips; they change nothing.

### E38. Listening is read from the typed sentence: the cause of each miss, and its trend (2026-11-03, branch `feat/listening-trends`)

**Why:** the owner wants to see trends in what they cannot hear and why. Reasoning and limits: [research/listening-trends.md](research/listening-trends.md).

**How to apply:**
- Listen is typing-only (owner, 2026-11-03: the causes need typed sentences, and picking was already too easy). "Didn't catch it" is a miss without typing something random; a sentence with nothing typed is not read for causes. "pick" stays in the types for the sessions logged before.
- A typed sentence is timed for the speed measure by its clip, as Watch is: words over the clip's length times the plays it took (`src/server/milestones.ts`). The answer time is mostly typing.
- Only a typed sentence (dictation) has a cause. A difference on the sentence's stretch word is vocabulary; on any other word it is hearing, grammar (the right word, the wrong ending), spelling (i and y, or a consonant written as it is said: *had* for *hat*) or typing (`src/core/listen-analysis.ts`). Add a cause there, with its label and one line, not in the page.
- Missing marks are hearing only when the learner types marks: a sentence typed with none is compared without them. A sentence with only its marks off counts as understood, and one typed after the text was shown is neither understood nor read.
- Nothing is called from a handful of sentences (owner, 2026-11-03: "make sure we have enough data points before analysis"). The causes wait for 50 typed sentences, 15 of them missed, over 3 sessions. A cause is listed from 4 sentences in 2 sessions. A trend needs 30 sentences from 3 sessions in each window and 5 expected sentences with and without the cause, and must pass Holm's correction across all the causes tested together. A change that does not pass reads "no clear change", never "about the same". Fast against slow clips is said only when the z-test passes with 20 sentences in each group; a week under 10 sentences shows no share. The numbers are constants at the top of `src/core/listen-analysis.ts`.
- A Listen rep logs `stretch`, the unmet words as they stand in the sentence. A typed miss without it is not read.
- `/api/listen` passes `answer` through: without it a typed sentence is not graded again, is logged as a meaning, and loses its accents-only half credit.
- The result is `MistakeAnalysis.listening`, shown as a section on My mistakes, from the snapshot; it is local and free. The optional deep read (E40) is the one model call over it.

### E39. The XP goal is not a setting: it follows the minutes (2026-11-03, branch `feat/settings-goals-and-time-studied`)

**Why:** the learner picks how long to study. The XP goal was a second number, fixed at 50 with no screen to change it, and one lesson cleared it against a plan of 90 minutes, so "goal met" said nothing. The owner: it should be calculated from what the learner already chose.

**How to apply:** `dailyGoal` in the progress summary is the plan's `minutesPerDay` at the learner's own XP an hour (`xpForPlan`, `src/core/onboarding.ts`), to the nearest 10 between 10 and 500. The rate is measured: XP over the days that have measured minutes, once there is an hour of them, else 120 XP an hour (`DEFAULT_XP_PER_HOUR`). It is not stored, `PUT /api/progress {dailyGoal}` is gone, and Settings → Learning shows the number as a line under the minutes. A change to the minutes moves it at once.

### E40. A deep read of the listening: the model explains the figures, it adds none (2026-11-03, branch `feat/listening-trends`)

**Why:** the owner wants a deeper analysis and better trends. The causes and their trends are rules and tests, which is what keeps them honest, but they cannot connect two findings (short words dropped and a worse second half) or say what to practice. A model can, if it is held to the figures. Reasoning and limits: [research/listening-trends.md](research/listening-trends.md).

**How to apply:**
- The deep read is one optional model call (Strong slot, else Cheap) from `listenGuideFacts` in `src/core/listen-guide.ts`. It is written to `analysis.json` beside the guide, reused until the figures change (digest), kept by a new snapshot, and shown stale, not dropped, when new sentences arrive. It needs the same floor as the causes (`analysis.listening.ready`).
- Every trend in the facts is already called, or not, by the page's test. The prompt says "no clear change" is never "the same", weekly counts are described and never called, and hearing is kept apart from grammar, spelling and typing, so a miss that is not the ear is sent to the practice that fits it.
- `analyzeListening` keeps three more cuts for it, each past chance or silent: first against second half of a session, short against long sentences (`SHORT_WORDS`, `LONG_WORDS`), and the sentences with each cause by week. The page shows the cuts only through the deep read.
- The page also shows **things you may not have noticed**, found locally by a test stricter than the trends' (`INSIGHT_Z` 2.58, a 1% test, because five are looked for at once): the ends or the starts of sentences lost (where the differences fall against where the words are), a new word costing the words around it, a session that warms up or tires, and words that keep going wrong across sessions (`REPEAT_*`). The deep read gets them as facts and may explain them but not add to them.
- The deep read also gives `noticed` (links between figures the learner could not see one at a time; a link the facts do not state must be marked a guess) and `tips` (things to try, each saying which pattern, cause or finding it answers; ordinary listening technique is allowed, a promised result or an invented number is not).
- It sends the figures and the latest typed misses with what was typed to the model provider, and the card says so. `writeListenGuide` takes a `say` function in place of the model for tests.

### E41. Watch takes Czech captions when a video has no Slovak ones (2026-11-03, branch `feat/czech-captions`)

**Why:** the owner pasted a Czech cooking video into Watch and got "This video has captions in cs but none in Slovak." Czech is near enough to Slovak to follow, and many useful videos have no Slovak track at all. The owner asked to allow it.

**How to apply:**
- Slovak always comes first, in any form (made by people or automatic). Czech is used only when the video has no Slovak track, and a human Czech track beats an automatic one, as for Slovak. The order is `captionFallbacks` on the profile in `src/core/language.ts`; a language is added there, not in the Watch code.
- The track's language is kept in `source.trackLang`; the record's `lang` stays the learner's (`sk`). The preview names the language ("YouTube's automatic captions in Czech"), the translation prompt says the subtitles are Czech, and the error names every language tried ("none in Slovak or Czech").
- The on-screen labels "Slovak" (show the Slovak, T) and the Slovak word tags stay as they are. On a Czech video they show Czech text; the preview names the language so the learner knows which it is.
- Open, not decided here: Czech words are read against the Slovak lexicon, so a tapped Czech word can be queued into the Slovak deck, and a Czech watching counts toward the Slovak listening speed. See the November changelog.

### E42. Aspect and demonstratives: drilled only from verified rows, a pair needs both aspects, explanations are static and reachable from the Dvojičky steps (2026-11-04, branch `feat/aspect-demonstrative-drills`)

**Why:** the research note (`docs/research/aspect-and-demonstratives.md`) found that the aspect and demonstrative practice ran as tutor chats, where a model wrote the sentences and nothing measured a first try (P8, E26). The practice moves into the mix-up families (E24) and the verified lexicon. The owner's rules and the verifier's review set the limits: 18 rows approved of 60 proposed (`/mnt/project-files/council/verifier-rows-1.md`), and the verifier's second review (`verifier-findings-2.md`) and the critic's blockers (`critic-findings-3.md`) set the rest.

**How to apply:**
- **Aspect is a family.** `aspect` in `curriculum/slovak/mixups.json` covers the 12 imperfective/perfective pairs (one family, not one per chapter, because the twins span chapters). Its probes are an allowlist: a row is drilled only if it is a verified lexicon sentence, names its twin, carries a cue type the family licenses for that twin, and has an approval. Shipped: 18 rows, 16 imperfective and 2 perfective, from 9 of the 12 pairs.
- **Balance gate (unchanged).** A pair is drilled and recorded only with approved rows of both aspects (`probeSentences`, `tallyMixups`). No shipped pair has both, so **no aspect pair is drilled or recorded yet**. The aspect mix-up code is inert until the owner's sentences (D2) supply the missing side. The form-reading tasks below do not need that side, so they run now.
- **Parallel forms.** The distractor is the other twin in the same slot: the infinitive by lemma (písať ↔ napísať); any other form by index, when both paradigms are verified or accepted by the family, have the same number of slots, and mark the past in the same slots (`parallelForm`, `choiceFor`). A probe whose sentence has the dictionary form gets the other twin's lemma (`plain`). Usable rows: 18 of 18 have a choice. Before this round 8 did: the infinitive had no slot, and citat, precitat and pomahat were not flagged verified. The handback's "18 usable items" was wrong until this round.
- **Verifier acceptance is family data (B3).** The verifier accepted the paradigms of čítať, prečítať and pomáhať (`verifier-rows-1.md`, and the verifier's message on the critic's blockers). They are recorded on the family as `formsAccepted` (`citat`, `precitat`, `pomahat`) with `formsAcceptedBy` citing both; `lexicon.json` does not get `formsVerified` for them.
- **brať and vziať pair by grammatical tag, and the lexicon is untouched.** brať lists 12 forms (present, two imperatives, past), vziať 10 (present, past). Each form is tagged present, imperative or past (past by form; of the rest, the first six are present); a form pairs with the twin's form of the same tag and ordinal, so bral ↔ vzal and brala ↔ vzala. The imperatives ber and berte have no counterpart on vziať: they are dropped (no parallel), and a row whose only choice is one of them is refused. A list must be in the lexicon's order (present, imperatives, past) and share its present and past slots with the twin's (a past before the imperatives gives no parallel). `curriculum/slovak/lexicon.json` is not edited: it is the owner's verified data (E27), and the family layer is where the verifier's acceptances belong.
- **Mend across both aspects (S2).** A probe family's pair is mended or cleared only after right first tries on both twins (`won`, two distinct slugs). A missing `won` counts as none, so a probe pair with no `won` is never mended. One aspect never mends it. Demonstratives keep the old rule.
- **Visible misses (S1).** A Dvojičky pick shows both words, so a miss on it opens its pair even where the family cannot drill it yet (`MixupEvent.visible`, set by `lessonMixupEvent` for `pairs-*` units). The drop for undrillable probe pairs stays for every other event. Task reps are never mix-up events.
- **Shadow ids (S4).** A probe row the family adds past an entry's own examples gets the id `slug#p<index>` (`pairSentenceId`). Its index is past the entry's own examples, so it never names a lexicon example. The review deck's ids (`slug#<index>`) are unchanged.
- **Item bank (the hour question).** The 18 rows give 18 unique items and 16 distinct (pair, cue type, phrase), so the first repeat comes at the 19th choice rep: about 3 minutes at 10 s a rep, about 6 if typed (20 s, an assumption). An hour without a repeat needs about 360 distinct rows, so the supply is about 5 percent of that. `tests/aspect-families.test.ts` runs the simulator on the rows, and the real builder over 50 seeds on the shipped state, which gives 0 sentences.
- **Form-reading tasks (B1; N1 to N11).** The six aspect chapters (everyday, health, shopping, plans, moving, stories) put up to three tasks at slots 3, 7 and 11 of their 12-rep Dvojičky lesson (`PAIRS_TASK_SLOTS`, `src/core/aspect-tasks.ts`). The other reps are as before. Two kinds:
  - a **grid** (`components/lesson/task-grid.tsx`): one pair's table, with the tenses as the rows (past, present, future) and the two aspects as the columns. The cells are empty and only their labels show. The question names a form ("Which cell does napíšem belong in?") and the learner picks that cell's label from three. Once answered, the forms fill in, the asked cell is marked in the teal token with weight and a 2 px underline at 7 px offset (E33), and the notes appear in one caption line under the grid. Nothing about a cell's form is on the page before the answer. Each note starts with its form, so the caption names its cell: "napíšem: present form = future meaning" for the perfective present, and "perfective future: no such form" for the perfective future. budem + a perfective is never offered. Five formed cells per pair: 60 grid tasks.
    - **Layout (N7).** `table-fixed`; every cell and label is 56 px high, the caption is a reserved 40 px line, and the td and th classes are the same before and after the answer. Forms are 16 px on a phone and 18 px from the small breakpoint. Measured in the live lesson (`/lesson?unit=pairs-plans`, 390 px and 1280 px, Day and Night): the table, the cells, the caption and the options have identical boxes before and after the answer; the page does not scroll sideways; every form lies inside its cell; the asked cell is on screen.
    - **Deviation from the spec (N7), for the coordinator to confirm.** The spec asked for one label column and three equal columns. At 16 px, six single-word forms are wider than a third of a 390 px grid (pripravujem 92 px, pripravoval 86 px, predávam 76 px, pomôžem 76 px, pomáham 76 px, pripravím 73 px; measured in the browser), so three columns clip them. The tenses therefore run down the rows, and each aspect column is 106 px on a phone (measured). Three equal columns would need 13 px forms, which still clip pripravujem.
  - a **cue** (`cueTasks`, `cueQuestion`): one approved row's own sentence, asking "Which word made it robiť and not urobiť?" (N10). The question names the verb the sentence holds and its twin: the parallel form for a finite row ("kúpil and not kupoval"), the two lemmas for an infinitive row. The learner picks the span among same-length windows of the same sentence (`cueWindowReport`). A window is dropped, with its reason, when it overlaps or repeats the span, contains the row's form, touches it, crosses a comma, holds a cue word of the verifier's list, or is made only of function words (`STOPWORDS`, which now also has ach and čo); or when it repeats another window. A row's keep list (`cueKeep` in `curriculum/slovak/mixups.json`) lets the named words past the cue-word drop only; the other drops still apply. The cue words (`cueMarks`): habit and frequency (každý, každá, každé, každú, každoročne, denne, vždy, často, zvyčajne, obvykle, bežne, občas; každom only with a time noun next); duration (dlho; celý, celú, celé with any time noun next; a number with hodiny, hodín, hodinu, minúty, minút, dni or dní); phase verbs (budem, budeš, bude, budeme, budete, budú; začať, prestať (prestaň too), skončiť and končiť by stem); perfective (nakoniec, konečne; za with a time noun within two words; podari-, podarí and stih- by stem); and práve. Time nouns (`TIME_NOUNS`) include the genitive plurals dní, týždňov, mesiacov, rokov and sekúnd, and chvíľu and polhodinu. The span itself is never a window, so it is never dropped as a cue word.
    - **Counts (N9, N11).** Six of the 18 approved rows make a cue rep: bežne, začala, začal (čítať), budeme, začal (hovoriť), and nakoniec (row 21). Row 53 ("Hovorím po francúzsky každý deň v práci") is an approved probe row with no span, so it has no cue rep: každý deň is a second answer (the verifier's ruling). Row 21 has two windows once "Dlho" is dropped as a duration cue. The verifier ruled that Dlho governs odolával and not kúpil, so it is not a second answer: the row's keep list keeps it, and the row has three windows. Nakoniec is the one perfective cue. Eight rows give no cue rep (fewer than three windows): za necelý mesiac, prestal, v každej trafike, bude, celú noc, budeš, Budete, pohŕdavo. The verifier's span corrections still stand (po francúzsky and pohŕdavo are the cue words of their rows; three other rows have no single cue).
  - Tasks are never a first try (E18), a mix-up or a retry. The Why? panel never shows a task as a "Same pattern" example, and a task rep has none (`patternExamples`, N2). A task's own Why? panel shows its pair's explanation only.
  - **Recent first (N4).** A task seen in the last lesson goes to the back of its chapter's pool (`aspectTasks`, `recent`). The pools per chapter are everyday 10, health 5, shopping 17, plans 12, moving 11, stories 11: 66 in all (60 grid, 6 cue). A lesson takes at most three, so a learner sees one chapter's pool once in 2 to 6 lessons. At about 10 s a rep (an assumption), all 66 tasks are about 11 minutes of aspect-specific work in one pass, not an hour. The hour requirement stays unmet until D2 and D4.
- **Dvojičky step (S3: left unchanged).** The Dvojičky pairs step (E11) still drills the 12 aspect pairs from raw verified sentences: 167 of its 230 sentences, in the everyday, health, shopping, plans, moving and stories decks. Those reps do not use the approved rows or the balance gate, so the verifier's rulings do not reach their choice. They do now carry the family's cue and the static explanation (`pairInfo`, shown after a miss). Gating them would leave five chapter steps empty (everyday, health, shopping, plans, stories), so the coordinator chose to leave them and say so here.
- **Explanations are static and never drills.** Each family has an `explain` (contrast, timeline, three cue points for aspect, trap, one slovak.wiki link), shown under "Parallels and examples" in the Why? panel after a miss (`LessonItem.pair.explain`). Worked examples never enter a drill, the first try (E18) or the mix-up record. The timeline is labeled as an example. Every Slovak line is marked `checked: "pending verifier"` until the verifier signs the commit; the verifier also checks the 18 spans.
- **Demonstratives.** `this-vs-that` (tento/ten) has 4 + 4 whole-word sentences in the lexicon and no approved rows, so nothing is drilled: the English gloss must decide. Every `tento` cell is a form the reference names or a verified sentence has, and the grid has no gaps: the dative plural is `týmto` (the cell that said "not yet"). The reading map (`GRAMMAR_WORDS`) names every `tento` and `tamten` form. Per-cell counts (whole word, case-sensitive, "to" skipped) are in the PR: most `ten` cells have 3 or more sentences, `tomuto` has 1.
- **Links go to a listed page under `/grammar/`, or a verified section of one.** `src/core/reference-pages.ts` allows only `/grammar/aspect`, `/grammar/demonstratives`, `/grammar/motion-verbs`, `/grammar/future-tense` and `/grammar/cases-overview` on `https://www.slovak.wiki` (the bare domain redirects there with a 308). Anchors are allowed only where `REFERENCE_ANCHORS` lists them: `#contrasts` and `#rule` on the aspect and demonstratives pages. All five pages and the four anchors were fetched on 2026-11-05. The two explanations link to `#contrasts`. A test holds every link to the list, refuses unlisted anchors and the bare domain.
- **Frames (D4).** The mechanism exists and holds no rows: `curriculum/slovak/aspect-frames.json` (empty), `src/server/aspect-frames.ts` (a switch, and a row is read only with a recorded approval and `src: "frame"`). Deleting the file or setting the switch off leaves the app working. **Recommendation:** author no frames until the owner has curated sentences (D2); if frames are wanted, each row needs the owner's approval and a verifier approval, and it is counted apart from the verified pool.
- **Skill move.** The `slovak-language` skill lives at `.claude/skills/slovak-language`, mirrored to `.agents/skills/slovak-language`, with the copies pinned by `tests/slovak-skill-copies.test.ts` (commit 20d99f1). It is not recreated under `skills/`.
- **Not built, with reasons:** a Cheap-slot judge for typed lesson answers (only placement judges, after a string miss).
- **Screenshots (S5).** Taken from the real Dvojičky lesson (`/lesson?unit=pairs-plans`) in the dev server, Day and Night, phone (390 px) and desktop (1280 px), at 2×, in `docs/assets/aspect-explain/`: `aspect-explain-<theme>-<view>.png` (the explanation under "Parallels and examples", opened by a miss), `aspect-grid-<theme>-<view>.png` (the grid task before the answer: cells empty, labels only) and `aspect-grid-answered-<theme>-<view>.png` (the same grid after the answer: forms and notes shown). The grid shots were retaken after N7 (the tenses as rows, 390 px and 1280 px) and again after the caption began each note with its form; the explanation shots are unchanged. The timeline in the explanation is labeled as an example. Not taken on a device.

**Owner decisions, open:** D1 the two tutor units stay unchanged until the families run in use (recommended). D2 who writes the aspect sentences (9 pairs have one aspect, 3 have none, and none has both), and the demonstrative sentences (Tatoeba is not reachable from the build container). D3 aspect families stay in the A2 chapter. D4 authored frames: see above.

### E43. A language is added from the app, from open data, without a model writing words (2026-11-05, branch `feat/add-language-button`)

**Why:** the owner asked to make adding a language smoother, "less dev work or completely eliminate the need for that", and to have it all done in the background behind a button that shows in the Background section.

**How to apply:**
- The list of profiles is built-in (`LANGUAGE_PROFILES` in `config.ts`, pinned to `LANGUAGES` in `src/core/language.ts`) plus every `data/languages/<id>/` that has a `language.json`. A language is added there, not in code. `curriculumFile(profile, name)` reads a language's file from `curriculum/<id>/` when the app ships one, else from `data/languages/<id>/`.
- Words come from Wiktionary (kaikki.org), frequency from FrequencyWords, sentences only from Tatoeba (E27). The homograph guard of E28 applies to every added language. The rules are pure, in `src/core/language-build.ts`.
- One model call is allowed: a grammar map draft on the Cheap slot, checked (unknown keys and loops dropped), labeled "(model draft)" in the skill map, and counted in Spending. It never writes a sentence or a form.
- The tutor's language segment is a template that states nothing about the language a model would have to know.
- The work is a background task (`src/server/tasks.ts`, kind `language`); each step is kept under `build/`, and `language.json` is written last.
- **No hardcoded target language (owner, 2026-11-05: "stop hardcoding stuff").** A prompt, a screen or a list never names Slovak when it can take the name from the running profile (`activeLanguage()`, `useActiveLanguage()`), and neutral wording is preferred where it reads naturally. A Slovak example in a prompt is `promptExamples` data and disappears for another language. Slovak story content (Robo, Bratislava, the Read settings, the Speak scenes) lives in `curriculum/slovak/world.json`. A list of the learner's own languages leaves out the one being learned. The lessons stay Slovak (`LESSON_LANGUAGE`).
- **Removing.** An added language is removed from Settings → Learning; its words go, the learner's progress stays. The language menu had a bin too until 2026-11-07, when the owner asked for it to go ("Remove the delete button from the language selector dropdown").

### E44. An added language gets a whole generated course; the model writes the rules, never the sentences (2026-11-05, branch `feat/generated-courses`)

**Why:** the owner switched to Estonian and got Slovak lessons: "The point of adding a language is to have everything fully done and ready for me to use."

**How to apply:**
- The course is data (`<data>/languages/<id>/course.json`, shape in `src/core/course.ts`): grammar units, word themes, tutor sessions, goals and chapters. The Strong slot writes it (the Cheap one stands in), one call for the course and one for the story bible, both counted in Spending. Slovak's course stays hand-written in code.
- A grammar unit selects Tatoeba sentences by the Wiktionary tags on the blanked form, plus optional trigger words before the blank. A dictionary form never counts as a case form; without a trigger the form must be unambiguous. Sentences are never written by a model (E27).
- Everything the model writes is checked against the dictionary before it is kept, and a unit with fewer than 12 sentences is dropped. A course with fewer than three chapters or three grammar units is refused.
- The running language's course is set by `config.ts` on the server and by a before-interactive script in the browser. Superseded by E45: the server changes it in place on a switch, and the browser reloads.
- Slovak-only content (the grammar atlas, Dvojičky, aspect tasks, the unit bridges and parallels) does not appear in a generated course.
- Who builds it is chosen in the add dialog, once per language, not in Settings: the Strong or Cheap model, priced per model and thinking level from earlier runs and capped per call; or the dictionary alone, free (`src/core/course-procedural.ts`).

### E45. A language switch happens in place, with no restart (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** the owner studies Russian, Slovak and Estonian every day and found the restart on every switch in the way; it also made a plan across languages impossible.

**How to apply:**
- The running language is per request since E75 (`config.ts`: `activeProfile()`); the process keeps a default on `globalThis`, per data folder (`defaultProfile()`, `switchProfile()`), because `next dev` evaluates a module once per route. Nothing may copy it at module load: read `activeProfile()` and `PATHS.*` (getters) when they are used, and give a module-level cache the file it was read from as part of its key.
- The core's course tables are functions memoized per course object (`perCourse` in `src/core/course.ts`): `allUnits()`, `allChapters()`, `curriculumUnits()`, `placementTiers()`, `placementLadder()`, `lessonLanguage()`, `lessonsHaveBridges()`. Do not add a module-level constant built from the course.
- `withProfile(id, fn)` reads another language's records for the daily plan across languages. `fn` must be synchronous, so no other request runs while the language is borrowed.
- ~~A switch waits (409 with the reason) while a tutor turn, a skill-map update or a video preparation is running.~~ Dropped with E75: work in flight keeps the language of the request that started it, so a switch no longer waits. The browser then loads the page again (`window.location.assign`), on the same page when it means the same thing in every language, else on Today. There is no confirm step and no relaunch; the Electron relaunch and the desktop:dev restart that existed only for switching are gone.
- ~~Open: a model call started by a page that is still in flight during a switch writes into the new language's folder.~~ Closed by E75: the call keeps its request's language.

### E46. One plan for the day across languages; the split is each language's own minutes (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** the owner learns Russian, Slovak and Estonian at once, with no fixed limit on the day: "a unified daily plan is literally my dream". They think in minutes for the day and a share per language.

**How to apply:**
- Today's plan, with more than one language, is each language's own daily plan (the same `dailyPlan` Today shows when it runs), read with `withProfile` (E45) by `languageDay()` in `src/server/day-plan.ts`. Languages are ordered by their minutes a day, largest first; the next step is the first undone one in that order. One list, as E33 asks: a language is a heading over its rows, not a card of its own.
- The split of the day is not stored apart. A language's share is its `goal.minutesPerDay`, so the plan's budget, the pace, the hours sheet and the milestones all read one number. **Split the day** turns the day's minutes and whole-percent shares into those minutes (`minutesFromShares`, at least 5 a language) and saves them (`PUT /api/day`).
- A step in another language switches (E45) and lands on the step's page; a tutor step, which has no page, lands on Today. A language not set up has one step, its setup.
- The rail, the score, the weak spots and the week stay the running language's.

### E47. What the learner knows is kept once; bridges come from the learner's own languages (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** the bridges were written for one learner. The Slovak tutor was told "He knows Estonian" and leaned on Estonian cases for everyone, the probe asked every language's learner about Estonian, and three Slovak tutor briefs carried Estonian lines. The owner is learning Estonian (A2), not native in it, and with three languages they would have entered the languages they know three times, with levels that went stale.

**How to apply:**
- The learner's fields of the goal (`LEARNER_FIELDS` in `src/core/onboarding.ts`: the languages known with levels, the explanation languages, the parallels switch) live once in `<data>/learner.json` (`src/store/learner.ts`). The progress store lays them over every language's goal on read and takes them out on write; a goal made fresh for a new language never wipes them. Before the file exists, the first goal that has them hands them over. A new language's setup starts from them (`defaultGoal()`).
- A language's own pickers leave it out, so a list saved there keeps the running language and its level if the shared list had it (Slovak listed in a Russian setup stays when the Slovak profile saves). Its rows and its "Explain to me in" choices leave it out too, so a language is never asked to know itself.
- Prompts never assume a language. The Slovak doctrine names Estonian and Slavic parallels only "when it is listed" in "This learner"; the probe asks about "a language they know"; tutor briefs carry no bridge line.
- "This learner" also says which other languages are studied in the app and where each works on its own map ("Also studying in this app: Slovak (working at A1 on its map, aiming at B1)"), read by borrowing them (E45). The level the learner gave stays theirs; the measured one is said apart, never overwrites it. A language is never its own explanation language.
- The hand-written bridge lines in the Slovak lessons (Estonian, Finnish, Russian, German) stay: they are chosen by the learner's languages already.

### E48. Fluency is called Speed, at `/speed`; the B2 stage is Argument; no redirect (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** "Fluency" is Paul Nation's name for the fourth strand, and the practice page took the word from the research note. A learner hears it as speaking smoothly, but the drill is speed on sentences they already know. The same strand was already called Speed in the strand bars, the stamps and the log, and the B2 stage on the map was also called Fluency.

**How to apply:**
- The practice page is Speed in the sidebar, the page title, the jump palette, the plan's strand labels and the week chart. Its route is `/speed`. `/fluency` no longer opens: the owner chose no redirect. E34 still holds: route, label and title say the same name.
- The exercises are "Speed" (said out loud, formerly "Say it faster"; renamed by the owner on 2026-11-07) and "Read it faster".
- The B2 stage (`src/core/curriculum.ts`) is Argument. Its blurb is unchanged.
- Internal names stay: the `fluency` strand id, `data/profiles/<lang>/fluency/`, `src/server/fluency.ts` and `/api/fluency`. Renaming them would move learner data for no visible gain.

### E49. The placement tutor checks the rung the level rests on (2026-11-05, branch `feat/placement-luck-check`)

**Why:** the owner asked whether the AI tells knowing from a lucky guess, and decided it should. The ladder does not. A rung counts as held after two right answers, and every rung below the highest held one is credited without being asked. One lucky pair at the floor therefore lifts the whole placement. The Socratic stage already separated slip from gap, but it was offered only the misses and the tier above. It was also told not to re-ask what the drill had shown twice, so the floor was never checked.

**How to apply:**
- `luckRung` (`src/core/placement-ladder.ts`) is the floor when drill answers hold it; a re-check's starting floor has no answers and is not checked. `probeUnits` puts it after the misses, and it is never cut by the eight-unit cap.
- The tutor's brief marks it CHECK FOR LUCK and gives the seconds of every answer. The prompt asks for the form in a new frame with a different word, then why, and does not close the stage before that unit has a verdict unless the questions run out.
- Its verdict goes through the existing path: held keeps the level; slip keeps it and records a weak spot; gap moves the bracket below it, so the rungs between are no longer credited.
- No copied-hint signal: in 4,800 generated items across the sixteen rungs, no typed item asked for the form shown in its hint, so copying the hint cannot score.
- No new model call on the ladder: P7 still holds. The check costs one or two of the stage's existing six questions.

### E50. Watch picks: saved creators, the learner's own YouTube read in a window of the app's own, every video checked for free before it is offered (2026-11-05, branch `feat/watch-creators`)

**Why:** the owner asked to connect their YouTube account, use the history and recommendations to pick or find videos, and save creators so adding videos is "easier or more automatic". YouTube's API returns neither the history nor the recommendations, and a video with Slovak subtitles is often German or Polish speech with translated subtitles. Research and the live trial: [research/watch-picks.md](research/watch-picks.md). (E49 is taken by `feat/placement-luck-check`.)

**How to apply:**
- A creator is a channel id, saved from a channel link, an @handle or one of their videos. Its newest uploads come from the channel's feed, or its videos tab when the feed fails. No key, no model.
- The account is read in the desktop app only, through a sign-in window with its own session (`electron/youtube.cjs`, partition `persist:lh-youtube`): the history, the home page's recommendations and the subscribed channels. Only the page text leaves the main process, and only the lists of videos and channels are kept (`videos/discover/youtube.json`). No cookie, token or password is ever written to `data/` or logged. The window may go to Google's and YouTube's hosts only and has no preload. Outside the desktop app, or when Google refuses the window, a Takeout export (`watch-history` JSON or HTML, `subscriptions.csv`) is parsed in the browser and gives the same lists.
- Who is signed in (2026-11-07, the owner: "It should say the user I am signed in as with my profile picture"): after the lists, the desktop app reads YouTube's account switcher through the same session (`getAccountSwitcherEndpoint`), and the server keeps the selected account's name, @handle and picture link in `youtube.json` (`account`); the email in that answer is never read. When the switcher cannot be read, the picture from a page's top bar stands in. The YouTube card shows "Signed in as <name>" with the picture; Sign out drops it (`forget-account`), Forget what was read drops it with the lists.
- Every candidate is checked before it is offered, once, with no model call: its caption tracks, whether it is spoken in the language (`judgeSpoken`: the automatic track first; then the original title and description against the lexicon; a set of five uploaded subtitle languages or more never counts as proof), its speech density, and the known-word share of its captions. The rules and numbers are in `src/core/discover.ts`; change them there, not in the page.
- The offer is ranked by fit, not by recency: 93–98% known first. When none is at the learner's level, the page says so.
- The model is used in one place only: the cheap slot writes six searches in the language from the learner's interests, kept with their cost and written again when the interests change or after two weeks.
- "Keep one ready" (on, needs a model) prepares the best pick in the background when no video waits: spoken in the language, 88% known or more, 50 words a minute or more. Today's plan then has a Watch task with no paste. Turning it off stops all spending here except the searches.
- The picks refresh when the Watch page or Today's plan is opened and they are over six hours old, and on "Check again".

### E51. The miss judge reads the check so far, and names a repeated mistake (2026-11-05, branch `feat/placement-repeated-mistakes`)

**Why:** the owner asked whether their answers reach the AI for a real analysis rather than right and wrong. The judge of a typed miss saw only that one item, so its note could explain the miss but could never say it was the same mistake as two answers ago.

**How to apply:**
- `judgeAnswer` gets the check's earlier answered items (the last twelve): each with its rung, sentence, meaning, what was typed, the form, right or MISS, and the earlier note. The item being judged is never in its own history.
- The prompt decides `accept` on this answer alone. The note names a repeated mistake only with the earlier form it repeats ("as with <form>"), so the learner can check the claim. One miss of another kind is no pattern, and an earlier right answer on the same form counts against one.
- Still one cheap call per typed miss and none on a match (P7). The note may run to 200 characters (it was 160) to fit the earlier form.
- The judge also returns `repeat`, the earlier miss as typed. The server keeps it only when it matches a miss the learner really typed in this check, so an invented pattern never reaches a weak spot.
- The edge tutor's brief carries each miss's judge note and its REPEATS mark, and the prompt treats a repeat as a likely misconception worth a question. Its verdict then counts toward the level as before.
- A weak spot's evidence is the note of a miss that repeats an earlier one, when there is one; else the first miss's note; the tutor's verdict still wins over both.

### E52. Watch fragments: pick a stretch of a video, ranked locally for the learner's level (2026-11-06, branch `feat/watch-fragments`)

**Why:** the owner asked to pick fragments of a video and to build comprehensible input from a smart analysis, to learn faster. Whole videos are mostly over the learner's level (80% known is common at A1), but two minutes of them may be at 93%. Research and numbers: [research/watch-picks.md](research/watch-picks.md), "Fragments".

**How to apply:**
- A fragment is a run of whole caption lines of 45 to 180 seconds, or a stretch the learner drags (20 seconds to 8 minutes). The analysis (`src/core/fragments.ts`, `src/server/fragments.ts`) uses no model: the same local gloss as the picks, so it costs nothing and repeats as the learner learns.
- The score is the product of comprehension (the known-word share, full at 93–97%, nothing under 85%), speech density, length, and the square root of what the new words are worth (common, said more than once inside it). A stretch weak in one loses. When none is close, the page says so; do not offer noise.
- Captions in another language than the video's (Czech for Slovak) are not measured; the learner can still drag a stretch by ear.
- `prepareVideo(url, { range })` translates and questions only the stretch. The record keeps the video's id, with `fragment` {startSec, endSec, ofSec}; its `durationSec`, lines and coverage are the stretch's, so the plan's minutes and the library line are right without change. One cut per video: preparing another stretch, or the whole video, replaces the record. Watch history stays in `watches.jsonl`.
- The 90-minute limit (was 75, raised so a 76-minute video from a saved creator is not left out) and the line limit (1,100) apply to whole videos. The time one Watch session can add follows it (90 minutes).
- The caption lines of an analysed video are kept in `videos/discover/lines/<id>.json` (E1); a video in the library is read from its kept caption track.

### E53. Watch measures real speech against what the learner knows, and shows what the level expects beside it (2026-11-06, branch `feat/watch-known-share`)

**Why:** the owner questioned the 80–84% "known" on Watch for a learner with 48 studied words. It was not a calculation error but a setting: `KNOWN_RANK.A1 = 500` is a rank *within each part of speech*, so the app counted about 1,980 words (2,113 with the beginner set and place names) as known at A1, against a comment that said "about 500 words" and CEFR figures of 500–800. The learner's real share of the Avocast podcast was 38.8%. Research: [research/watch-picks.md](research/watch-picks.md), "Fragments".

**How to apply:**
- Watch and Discover measure two shares. **Known** (`coverage`) counts the words the learner has studied (the deck and finished word units) plus grammar words, names and numbers. **Expected** (`expected`) adds the words the Milestones page credits at this point: `creditedWords` (the word check's estimate, else the band of the level completed plus the progress made in the current one; `LEVEL_VOCAB`, A1 1,200 at its end), taken as the commonest words by use (`frequencyOrder`, one order for Watch, Milestones and placement), plus the beginner set and place names. So a learner at the start of A1 is credited almost nothing and the figure grows with the course; the three places that count "words the level knows" can no longer disagree. Both are shown ("you know 39%", "78% expected at A1"). Everything is ranked and banded on *known*, never on expected.
- A word the level expects but the learner has not studied is `assumed` on its token; `fresh` now means beyond even the level. Pre-teach and the new-words list offer assumed words too, since they are new to the learner. A fragment line carries `fresh` (not studied) and `beyond` (beyond the level).
- When no stretch is within reach (88% known), the fragments panel says so, lists "the nearest stretches" and points to graded stories and Listen. The comprehension score keeps a sliver under 85% so the order is by nearness; Discover's fit does the same under 80%.
- How common a word is (what a new word is worth, what to pre-teach) reads `commonness`, a word's place in `frequencyOrder`, the same in every language. Estonian and Russian lexicons rank every word on one list (ranks to 25,000), Slovak restarts per part of speech (`isOneList`, `rankShare`); thresholds written for Slovak ranks no longer apply to raw ranks. For a one-list lexicon the Read tolerance (`known`) is the level's whole `LEVEL_VOCAB` band instead of "rank 500".
- A kept video carries `measure` (`MEASURE_VERSION`); one kept under an older rule is glossed again from its stored lines when the library or the video is opened (`remeasureVideo`, local, no model call). Foreign-caption videos keep their estimate. Bump `MEASURE_VERSION` when what `coverage` means changes again.
- Read's word card says "not studied yet" for a word its tolerance counts as known but the learner has not met; nothing is underlined, and story coverage is unchanged.
- `KNOWN_RANK` is otherwise unchanged, and its comment now says what it is: a per-part-of-speech tolerance for texts the model writes at the level (Read, Listen, Speed). Narrowing it would make drafts fail the 92% coverage floor and cost extra model calls; it is not a claim about the learner. Do not show it as one.
- Videos kept before this change carry the old `coverage` until they are prepared again; Discover's scans are measured again on refresh.

### E59. The mark is a cursor at an empty answer line, for any language (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner asked for a new app icon and a better brand. The old mark, two speech bubbles, came from the upstream app and looked like any chat app. A first draft, an `š` cut from Geist Bold, was dropped when the owner pointed out that this is a language tutor for any language, not a Slovak app. A háček over a line was dropped too, because it read as a download icon. Details and name ideas: [brand.md](brand.md).

**How to apply:**
- The mark is a text cursor (ink) waiting at an empty answer line (teal): two rounded rectangles in a 1024 box, cursor 262,212 116×600 and line 418,696 344×116, radius 22 (bolder since 2026-11-07: the first bars, 72 wide, were too thin to read in a taskbar). It says what every task asks for: the blank first, your answer next (P3). It reads as an L.
- No letter, script, flag or diacritic goes into the mark, so it fits every language the app can add (E43).
- In the app, the cursor is `currentColor` and the line is `var(--q-teal)` (`components/lh-mark.tsx`), so the mark follows Day and Night like the wordmark ("Lang" in ink, "Harness" in teal). The app icon is a teal tile (#0D6764) with a white cursor and a pale teal line (#9FE3DE); the first ink tile disappeared on a dark taskbar.
- One geometry, kept in step by hand: `build/mark.svg`, `build/icon-flat.svg`, `app/icon.svg`, `components/lh-mark.tsx` and the Icon Composer layers in `build/icon.icon`. After changing it, run `node scripts/make-icons.mjs` and `node scripts/make-pwa-icons.mjs`.
- The name stays LangHarness (owner, 2026-11-06: "Let's keep LangHarness for now"). The name ideas in brand.md are kept for later; a rename is its own piece of work (app id, window title, PWA, repo).

### E60. One text field style, set once in global CSS (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner could hardly see the Creators field on Watch in Night ("Stuff like this should be fixed in global styles so we don't have to be redundant"). The Night well (#1a1d1f) is almost the card (#1b1e21), and every form field carried its own border, background, focus and placeholder classes.

**How to apply:**
- A typed field outside an exercise uses `.q-field` (`app/quiet.css`): its own surface `--q-field` (the well in Day, #23272a in Night), the checkbox grey `--q-box` as a 1 px inset outline (the hairline `--q-line-2` is 1.5:1 on a Night card), and a 1.5 px teal ring on focus. Height, padding, radius and font stay on the element.
- Placeholders get one color in the base layer: `--q-ink-3`, opacity 1 (4.9:1 in Day, 5.2:1 in Night). Utilities still override it.
- Answer fields inside exercises (lesson, placement, Read, Catch the mistake's answer states) keep their own right and wrong colors; they are not form fields.

### E61. A saved creator can be searched and listed newest first (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner: "I should be able to search their channels and just see their latest videos or sort by that." A creator's row showed only its four best picks.

**How to apply:**
- A creator's panel has a search of the channel and a Best for you / Newest order (`CreatorVideos` in `components/watch/discover.tsx`, `POST /api/watch/discover {action: "creator-videos", id, query?}`).
- Newest reads the channel's videos tab (`channelUploads`): the feed lists only a few uploads. The feed's exact dates win; otherwise the date comes from the English page's relative date ("3 weeks ago", `agoToIso`), which is only as exact as that text. Titles come from the page in the language, because an English page translates them.
- Each listed video is checked as a pick is (`scanVideo`: captions and the known-word share, free, no model), and the check is kept, so it feeds the picks too. A video that cannot be offered stays in the list and says why (`creatorVideoRows`): no captions yet, not spoken in the language, too long or too short, live, unavailable, already in your videos, or marked not for you.
- Best for you sorts offered videos by the pick score, then the rest by date; Newest sorts by date alone, undated last (`sortCreatorVideos`).

### E62. Study sections: a model picks the parts and the words, the program builds the exercises from the real lines (2026-11-07, branch `feat/watch-ai-sections`)

**Why:** the owner: "This is currently only manual, but I think we should have a feature that uses AI to do a smart analysis and auto generate a section(s) and create that into exercises that we could do." Research: [research/watch-sections.md](research/watch-sections.md).

**How to apply:**
- On a prepared video's preview (captions in the language only), **Find sections** makes one Cheap-slot request (`src/server/watch-sections.ts`). The model sees the numbered lines with their English, with the words not studied marked, up to 400 lines. It returns up to three sections of 3 to 20 lines, each with a title, why it is worth studying, and 2 to 6 words, at most one per line.
- The answer is held against the video (`parseSections`, `src/core/watch-sections.ts`): ranges must be real and must not overlap, too-long ranges are cut, and a word must be a word of its line exactly as written (case aside, accents not). Anything else is dropped, and so is a section with no word left. The model never writes language (E27, E44).
- Kept in `videos/sections/<id>.json` with the model, the lines it saw and the cost (E1). It is asked again only with **Find new sections**.
- **Practice** turns each word into a typed gap in its real line, spoken with the Listen voice. The first miss shows the first letter and the line's English; the second shows the answer and the word's meaning. "I don't know" is a miss (P3). Stop part way saves the gaps answered.
- A finished section: XP as a lesson's typed rep (`repXp("type", …)`, half when accents only or helped), the gaps as the day's reps, and the active time as Watch minutes (P9). A missed or helped word goes to Review when the dictionary has it, and its line joins the Watch lines that come back in Listen (E56).
- Enter in the preview starts the video, except in a field: the gap's Enter checks the answer.

### W1. Take over, do not ask (2026-10-27, repeated 2026-10-28)

Pick the recommended option, build it, verify it in the live app, deploy, then send one short report with screenshots. Do not ask for confirmation, choices or approval. The only exceptions are things impossible from the cloud (creating a GitHub repo, approving a device card). `AGENTS.md` carries the upstream "No guessing, always ask" rule; for LangHarness the owner's standing rule overrides it.

### W2. Descriptive branch names, no merging to main (2026-10-28)

Branches are named after the work (`feat/desirable-difficulty`, `setup/cefr-language-levels`, `docs/project-learnings`), never generated names. Open the PR, assign the owner, request their review, deploy the branch to the PC for verification, and stop. The owner merges. PRs #1 to #5 were merged before this rule; #5 landed minutes before it. Since then the owner has merged #6 and #8 to #11 themselves.

### W3. Deploying to the PC

The code lives at `C:\Users\Stream\Projects\langharness-2` (rename to `langharness` deferred; it needs the app closed). The dev server hot-reloads, so a deploy is a `git fetch` plus checkout of the PR branch on a clean tree, done from a Remote Control session (the device shell cannot reach GitHub, delete files, or commit). A dev server started by a Remote Control session dies with it; restart it afterwards. GitHub Actions never runs on this repo (owner-side setting), so red CI there is not a code failure.

### W4. Research notes live in the repo (2026-10-28)

Every research pass goes to `docs/research/` in Markdown with its sources, and the index in [research/README.md](research/README.md) is updated. Decisions go in this file, in the same PR as the work.


### W5. A pull request shows the change before it asks for a review (2026-11-08, branch `docs/pr-descriptions`)

The owner, after the slovak.wiki PRs: a first description had no screenshots and no links to the changed code ("we used to have it"), a body went on describing drawings that had been redrawn, and a preview is not always up (a screenshot costs nothing). This app has no preview URL and no CI (W3), so the description carries what a preview would.

**How to apply** (the steps and commands are the `pr-description` skill, `.claude/skills/pr-description/SKILL.md`; the shape is `.github/pull_request_template.md`):
- A description has these parts, in this order: **What changes for the learner**, **Screenshots**, **Try it**, **Where**, **Removed** (only when something is), **Checked**. It names only what the diff contains, and is reread against the diff after the last push.
- **Screenshots** of every learner-facing change, Day and Night, 1280 and 390 px (E4), of the state the PR is about, taken with `scripts/pr-shots.mjs` from `npm run dev:sandbox -- --seed` (E6). Every image is opened before it goes in, and **Checked** says which were looked at.
- They live on the `pr-assets` branch, one folder per PR (`pr-<number>/<name>-<theme>-<width>.png`), and are embedded with `https://github.com/Xurify/langharness/blob/pr-assets/pr-<number>/<file>.png?raw=true` (the repo is private, so a raw.githubusercontent link would not render). Pictures that document a decision stay in `docs/assets/` (S5).
- **Try it** is the sandbox route and what to do and see, one checkbox per thing, for the owner's deploy to the PC (W3).
- **Where** is one link per part of the diff to the file and lines at the head commit (a SHA, not a branch), the part the learner sees first.
- **Checked** gives the real counts from the run, then what was looked at (page, theme, width) and **Not looked at:**. A PR that adds or changes a drawn explanation says how it was blind-reviewed (the `ink-drawing` skill).
- The body is written from a file (`--body-file`) in UTF-8; PowerShell here-strings mangle Slovak letters.

### E64. The Watch shelf is one card in four tabs, and what was asked once is kept (2026-11-07, branch `feat/watch-layout-and-cache`)

**Why:** the owner: the Watch page "could be definitely improved and turned into something that is much easier to navigate", plus "find ways to optimize requests and implement some sort of caching". The shelf was one column about 1,800 px tall: link form, a text list of picks, the library, creators and the YouTube link, all at the same weight, so a learner with a video ready had to scroll past the picks to find it, and every list row hid its actions in a narrow strip.

**How to apply:**
- One layout primitive: the video card (`components/watch/video-card.tsx`): a 16:9 poster with its length and a bar for the known share along its foot, the title, the channel, one line of facts, and the actions at the foot. A pick, a creator's video and a video of yours are the same card.
- The link field stays at the top, always; `/` focuses it. Under it, the one next step when there is one (`UpNext`): the newest video not yet watched, else the best pick at the level (88% known or more). It is not repeated in the list below it. Then four tabs, a segmented control that sticks under the header: **For you** (picks, at your level first; when none is, "Closest so far" with one line saying so), **My videos**, **Creators** (a list of creators beside the selected one's videos; chips along the top when narrow; suggestions last, four at a time), **YouTube**. The tab that was open is kept when you come back from a video.
- The grid follows the width of the shelf, not the window (container queries, `@container` on `main`), because the sidebar takes 288 px of a window.
- "Pick a stretch" opens in a sheet over the shelf (`stretch-dialog.tsx`): in a grid a panel has no row of its own. Escape closes the sheet and stops there; on this screen Escape otherwise leaves Watch.
- Caching, by what is slow. YouTube's listing of a creator's newest uploads or a search is kept 10 minutes on the server, shared by simultaneous callers, and cleared by "Check again" (`src/server/discover.ts`); the fragments analysis (glossing up to 6,000 lines) is kept 2 minutes, with "is it prepared" read fresh each time. The browser keeps the same two for the session (`components/watch/caches.ts`), keyed so a new "Check again" is a new key, and forgets them when a video is prepared or deleted. All through `TtlMemo` (`src/core/ttl-memo.ts`): a fresh result is returned, callers share a running load, a failed load is never kept. Thumbnails are the best YouTube has (`components/watch/thumb.tsx`): 1280×720 `maxresdefault`, else `sddefault`, else `hqdefault` (4:3 with black bars that `object-cover` in the 16:9 box crops exactly), else an icon. A size a video lacks is not an error: YouTube sends a 120×90 grey stand-in with status 404 that the browser reports as loaded, so a width of 120 or less counts as missing (checked: all three sizes of a made-up id load as 120×90). The picture fades in; a picture that finished before the page was interactive is picked up on mount. The page no longer waits up to 4 seconds on Google for channel pictures: the fill runs behind it, and the picks ask once more after 3.5 seconds if a picture was missing.
- A creator's list or the analysis is a short-lived copy of what the learner's words said at that moment; do not make the times longer without making them expire when the learner's level changes.

### E65. Speak is a scene board: the list and the sheet of the scene in hand (2026-11-07, branch `feat/speak-scene-board`)

**Why:** the owner did not like the Speak picker: nine identical cards in two columns, each with a "for you" pill (six of nine carried it, so it said nothing) and a "Step by step" half that looked like a second card. The page did not say who you meet, what you are there to do, or when you last said a scene.

**How to apply:**
- One list on the left, grouped by why a scene is offered: **This chapter** (the current chapter's scene), **For your goals** (the purposes' scenes), **More scenes**. The groups come from `speakState` (`why` on each `SpeakSceneEntry`, `src/core/speak.ts`), not from the client. A row is the title in the language, one line in English, and how many times it was said.
- Beside it, the sheet of the selected scene (`components/speak/scene-board.tsx`): the title, who you meet (the brief's first clause), your part (the scene's `task`), how it opens when the language has a script (the script's first tutor line, with an empty answer line for yours), the ways in, and the last time it was said. Below the sheet's container breakpoint the sheet opens inside the list, under its row, without repeating the title.
- One main button: "Speak it", or "Type it" when the page was opened typed or there is no speech-to-text key (the mic is not offered then). "Step by step" shows only for a scene that has a script in the running language (`scripted`); `/speak?mode=script` now looks the script up in that language, so a Russian or Estonian profile no longer opens a Slovak script.
- An unfinished scene is selected first and its main button is "Carry on". Keys: ↑ ↓ pick, Enter starts, Escape leaves.

### E66. Night surfaces are seen by being lighter; letter keys are keycaps (2026-11-07, branch `feat/speak-scene-board`)

**Why:** the owner could not see the Speed windows on the Night card. The Night well (#1a1d1f) was 1.01:1 against the card (#1b1e21), so every tile, stat cell, chip and hover drawn with `bg-well` inside a card vanished; lines were 1.14:1 on the card, `ink-4` text 3.5:1, and black shadows do nothing on a dark ground.

**How to apply:**
- Night wells sit above the card: card #1c1f22, well #24282c, well-2 #2d3236, line #2f3438, line-2 #454b51. Each step is at least 1.12:1 from its neighbour. A raised surface in Night carries a faint light hairline (`--q-raise`, `--q-raise-hi`). The selected segment of `.q-segc` uses `--q-seg-on`, lighter than its track in Night. The two Night blocks in `app/globals.css` (`.dark` and the media query) must stay identical.
- `ink-4` passes 4.5:1 on the card in both themes (Day #70757b, Night #858b92), because it is used for text ("To do", "not yet", placeholders). Text is not dimmed with an opacity utility (`text-foreground/50`); it takes an ink step.
- The special-letter keys are fixed 40 px keycaps (44 px under a finger), never stretched to the card's width; rows stay even.
- The word popover lines its content on one edge: the header icons sit flush right, the links are 12 px with one Wiktionary link when the language's own reference is already Wiktionary.
- ElevenLabs reads every language with `eleven_v4` (owner, 2026-11-07: "use the latest for all languages"); `ELEVENLABS_MODEL_ID` still overrides it. If the account refuses a model with a 4xx (not on the plan), it is skipped for an hour and the line goes to the next that reads the language: `eleven_v3`, then `eleven_multilingual_v2` (29 languages, no Estonian), then Edge (`elevenLabsModelsFor`, `src/server/tts.ts`; language lists from elevenlabs.io/docs/overview/models, read 2026-11-07). `language_code` is sent to every model but multilingual v2. Each ElevenLabs clip records its model in the audio index; a clip from before that is taken as multilingual v2's, so cached Slovak clips are kept and Estonian ones, which v2 could not read, are made again. Why: a story's narrator and cast carry ElevenLabs voice ids, so an Estonian episode went to multilingual v2 while single words went to Edge and sounded right.
- Kept audio moves to the newest model on request, never silently: `npm run audio:regen` (`src/server/audio-regen.ts`) lists the clips, their characters and the cost at one credit a character; `-- --yes` spends it. A clip is replaced only after its new audio arrived, the old file moves to `audio/replaced/<stamp>/` (E1), and a clip already made by the newest model is skipped, so a stopped run can be run again.
- The Watch coverage ring draws its track in well-2 and its floor tick across the track in ink-2; on the Night card the old track (`text-accent`) vanished and the tick read as a stray stroke.
- The desktop window has a right-click menu (`electron/context-menu.cjs`): a link to another site gets "Copy link" and "Open in browser", selected text gets Copy, a text field the editing items. Electron shows no menu by default, so a YouTube card could only be opened in the default browser (owner, 2026-11-07). A page that handles its own right-click keeps it.
- Watch's Prepare answers as soon as the captions are in and the lines are being translated (`prepareVideoInBackground`, `src/server/watch.ts`); a kept video or a captions error still comes back as the answer. The route used to ignore `background: true` and hold the request through the whole translation, so the shelf showed its own "Adding <link>" row beside the task's row for the same video, and the card gave no sign. Now the shelf's row shows only until the task exists, and the card's Prepare (and Up next's Add video) reads "Preparing…" while that video is being prepared (`components/watch/preparing.ts`).
- In a video, X and Escape go back to the shelf (owner, 2026-11-07); the separate Videos button is gone. On the shelf, Escape goes to Today.
- A sidebar shown on a task page with its open button folds again once you leave that page; before, the reveal stuck to the route.

### E67. One word for each thing the learner sees (2026-11-07, branch `fix/copy-audit-and-desktop-audio`)

**Why:** the owner: "Check our whole app for wording and text that doesn't make sense." A copy audit of every screen found one concept under several names (a chat was also a "session"; the curriculum was also "the path" and "the map", though Map is the rules page), internal names on screen (prober, extraction, compacting, cheap slot, chains, propositions), all-caps labels, errors with no next step, and claims the code did not keep ("the first sentences appear in a few seconds" for an episode that is not streamed).

**How to apply:** new copy uses these words, and a screen that says otherwise is a bug.
- A conversation with the tutor is a **chat**, never a session. The tutor is the **tutor**, never the teacher or an agent; background work is a **helper**.
- Courses: **Curriculum** (not the path, not the map); its hours are **guided hours**. A goal unit is a **can-do goal**, not a milestone (Milestones is a page).
- Settings sections are named as the dialog names them: **Settings → API keys**, **Settings → AI models**. On learner screens, say "AI key" or "AI model", never "slot", "tier" or "provider key".
- The diacritic is an **accent**. Saving a word for Review is **Add to Review** / **In Review**; a starred word is a **favorite**.
- The drill said out loud is **Speed**; the re-read is **Read it faster**. A heard sentence is heard the **first** or **second** time, not "cold".
- Errors say what to do next ("Couldn't save the key. Try again."). Sentence case everywhere, no all-caps labels. The owner's tool labels stay (Probe and Recall in a chat, 2026-10-09).

### E70. Get ready: a hard video is briefed before it is watched, content first, then its keys typed into their lines (2026-11-07, branch `feat/watch-get-ready`)

**Why:** the owner, on a podcast episode rated "Too hard for now" (41% known): "What if we used AI to analyze and make pre-content for me to use and learn from. I do the content and then once I feel a bit more comfortable I finally watch the video… I should be drastically so much better at hearing what is being said and noticing what the speaker(s) are talking about." Research: [research/pre-listening.md](research/pre-listening.md): before a hard listening, knowing what it is about helped more than being taught its words (Chang & Read 2006), and a short description of what a video will show, as statements, raised comprehension of it (Herron 1994; Herron et al. 1998).

**How to apply:**
- On a prepared video's preview (captions in the language only), **Get ready** makes one Cheap-slot request (`src/server/watch-prep.ts`). The model sees the numbered lines with their English and the words not studied marked, up to 400 lines, and returns `about` (what the video is and who speaks, English), `parts` (ranges of lines in order, each with one English statement of what is said), `keys` (6 to 12 words or phrases of up to three words, each copied from a line) and `summary` (5 to 8 short sentences in the language at the learner's level, each with its English).
- The answer is held against the video (`parsePrep`, `src/core/watch-prep.ts`): a part must be a real range, in order, not overlapping another; a key must be a run of words of its line exactly as written (case aside, accents not, no punctuation inside); the rest is dropped. The model never writes or corrects a caption line (E27, E44). The summary is the one text it writes, and it is graded input like a Read episode: glossed with the video's own known-words estimate, measured (what the learner knows, what the level expects with the keys counted as taught), written again once under the 92% floor with the hard words named, kept whatever comes back, with both shares shown.
- Kept in `videos/prep/<id>.json` with the model, the lines it saw and the cost (E1; counted under Videos at Settings → Spending, with the study sections). Made again only with **Get ready again**.
- The preview shows it as three steps under the coverage cards: **What it's about**, **The short version** (spoken by the Listen voice, every word tappable, the English behind a switch), **Words to listen for** (each with its meaning and its line; **Type them** runs the shared gap drill, `components/watch/gap-drill.tsx`, which the study sections use too). A finished drill earns XP as a lesson's typed reps (half when accents only or helped), counts as Watch minutes (P9), sends misses to Review and, as for a watching, their lines to Listen (E56) unless the captions are foreign or automatic, and marks the briefing done with the score and the day. On screen the keys are "words to listen for", never "keys".
- Under 88% known the offer leads (teal card, primary button) and the hard bands' lines say "get ready first"; at or above it is a quiet offer. Nothing is gated: the video can always be watched without it.
- Foreign captions (Czech, E41) are briefed from their rendering in the language, the one the known-word share is measured on (E53). The rendering is now kept on each line (`VideoSegment.rendered`) at prepare time, so the briefing glosses it with no model call; a video kept before that is rendered once more on the briefing's cost. The briefing keeps those lines (`PrepRecord.lines`), the words are copied from them, the gaps fall on them, the prompt and the screen say the speaker says the Czech, and no line goes to Listen.
- Regenerate on the preview says what it is doing: the button spins with the preparation's step, the page opens the new version when the background task is done, and shows the task's error when it failed. Before, the task ran in the sidebar and the preview did not change.
- Pictures per part, and a measure of whether a briefed video is understood better, are open (the research note says what to compare).

### E71. A word can be marked as known, and it counts everywhere what you know is measured (2026-11-07, branch `feat/watch-get-ready`)

**Why:** the owner, on a Watch preview whose "Meet these first" listed že, nie, dobrý, dosť, mať, to, môcť and už: "I actually do know all of these. Is it possible to mark words as known in our app or something?" Since E53, "known" is what the learner studied (the deck and finished word units) plus grammar words, names and numbers, so a learner who knows the basics but did not study them in the app sees them as new, and the shares read low. A suspended review card did not count as known either.

**How to apply:**
- One list per profile, `data/profiles/<language>/known.json` (`src/store/known-words.ts`): the lexicon slug, its dictionary form and when it was marked, plus `updatedAt`. Only a word the dictionary has can be marked (`POST /api/words/known {slug, known}`), and marking again or unmarking is the same door.
- `knownWords()` adds the marked words to `met` (so to `known` and `expected`) and to the story brief's sample. So they count in Watch's and the picks' known share, the pre-teach list, Read and Listen's coverage, the fragments and the brief, with no second rule.
- A kept measure follows the list: a video carries `measuredAt` and is glossed again from its stored lines when opened after a mark (`remeasureVideo`; foreign captions on their kept rendering), and a pick measured before a mark is measured again on the next refresh. No model call either way.
- Where to mark: the tick on each "Meet these first" card (the share and the list follow at once) and **I know this** in the word popover, beside Add to Review, which also undoes it. On screen the word is "known", never "mastered" or "learned": it is the learner's say, not a measure.
- Marked words are not review cards and earn nothing; the Milestones "words you can recall" count does not read them (it is the word check's estimate). Open: a place to see and edit the list (the Words page could list them).
### E68. A long day goes to input, and listening outside the app is logged apart (2026-11-07, branch `feat/input-after-plan`)

**Why:** the owner asked what ten hours of Russian listening a day would do and whether the app should apply it. A goal can be 600 minutes, but the plan holds about 35 to 45, and once it was done Today offered "One more lesson", deliberate study, already the strand over its quarter (P2). Listening done elsewhere had nowhere to go, and counting it like measured time would break P8 and P9. Research: [research/outside-listening.md](research/outside-listening.md).

**How to apply:**
- Once the plan is done, the next step is input: a video added and not watched, else ten more Listen sentences (`afterPlan` in `src/core/after-plan.ts`, served as `afterPlan` in the progress summary). Enter starts it. "One more lesson" stays, as the second choice. Do not make a drill the step after the plan.
- Listening outside the app is logged by hand on Today (`components/outside-listening.tsx`, `/api/outside`), focused or background, and kept in `outside-listening.json`. It never enters `minutes`, `minutesBy`, XP, the streak, stamps or the strand balance.
- The milestones page shows it only in its own row, "Speed with outside listening": focused minutes at `OUTSIDE_WEIGHT.focused` (0.5), background at 0, added to the measured real pace. On the learner's own Listen trend it adds nothing and says why (the slope is per hour in the app, so it already holds what outside listening did). The weights are the app's own and say so (E63, the `outside` feature in `src/core/sources.ts`). Change them only with new evidence, in the research note first.
- No hours target, challenge or stamp for hours of listening.

### E69. Comments only for what lives outside the repo (2026-11-07, branch `fix/review-miss-reason`)

Owner's rule: "Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from)."

**How to apply:** the full rule is in [AGENTS.md](../AGENTS.md) under **Code style → Comments**, and `CLAUDE.md` points to it. The product why belongs here, in the changelog and in commit messages, not in the code. Code you add or change follows it; an older comment goes when the code around it is next changed.

### E72. A session closes to the page it was opened from (2026-11-07, branch `feat/session-close-to-origin`)

The owner closed a grammar drill mid-way and expected to land back on the Grammar atlas; every player's X and Escape went to Today.

**How to apply:** a full-screen session (lesson, listen, speak, watch, the speed strand) keeps the page its session was opened from (`components/origin.tsx` stamps the route on every navigation and skips the session routes themselves) and its close (X, Escape, leave after done) returns there. A lesson paused and rejoined (tutor chat, Today, a reload) keeps the page it was first opened from: the origin rides in the saved lesson. A lesson opened from nowhere keeps Today. The finish screens' own next steps (the score grid, speak's scene board, watch's shelf) stay where they point by themselves.

### E73. A grammar lesson opens on a click-through sketch, drawn in ink (2026-11-07, branch `feat/ink-case-sketches`)

The owner: grammar "feels like review, it should feel like we are learning", then "make them look more like ink graphics, like riddled.ai does".

**How to apply:**
- A unit lesson that has a case sketch opens on it before rep 1 (`components/lesson/lesson-intro.tsx`): one drawing per preposition’s job, a real sentence with only the case ending lit, one line on why that ending (the noun’s pattern picks it, not the preposition), and a last step with the exceptions and the case page on slovak.wiki. Nothing in it is graded. A restored session and a unit with no sketch skip it. A grammar unit’s first lesson then asks the form first (`GRAMMAR_FIRST_PATTERN`), vocabulary units keep meaning first.
- Every case with all three genders (genitive, locative, instrumental, dative) has a step for a masculine, a feminine and a neuter word, because the ending follows the word’s gender and a learner who only sees feminine examples will think the rule is about -a. The last step is a table with one row for each kind of word (masculine person, masculine thing, feminine, neuter), not paragraphs: a rule with several parallel cases is shown as a table. Every form was checked against the slovak.wiki case page of its case (2026-11-07; the dative of a neuter word is -u).
- The drawings are ink, not diagrams: strokes are pen paths with a seeded wobble (`components/lesson/ink-paths.ts`, pure, the same on server and client), a displacement filter roughens the edge, and each stroke draws itself in order (`ink-draw` in `app/globals.css`, off under reduced motion). Line ink is the text color, so Night inverts it; the one thing that matters gets the teal ink and a soft highlighter patch. The lit ending is underlined with the pen, not a CSS underline.
- The look and the checks are written down as the `ink-drawing` skill (`.claude/skills/ink-drawing/SKILL.md`), with `scripts/ink-contact-sheet.tsx` to see every sketch in Day and Night. Audited 2026-11-07: no two meanings share a picture (k, mám and vidím are three drawings; u has no arrow), an office is not a house, and each object can be named without its caption.
- A new scene is built from the kit in `components/lesson/ink.tsx` (Figure, House, Box, Loop, Curve, Arrow, Patch, Dot, Note), with a seed per stroke and a delay per layer: scenery, actors, patch, arrow, label. No new font: labels are the app’s own.
- The visual-maker sub-agent’s prompt asks for the same look (thin near-black strokes, round caps, curved arrows with two-stroke heads, one teal accent and one highlighter patch), on the white background the figure card and its invert switch rely on.

### E74. A grammar claim is sourced, complete, labeled and plain (2026-11-08, branch `feat/ink-case-sketches`)

The owner, after the case walk-throughs: a letter list had come from memory, three genders were shown where Slovak has more patterns (feminine nouns in a consonant, the other neuter patterns), "hard noun" and "men" meant nothing to a learner, "learn which with each word" was said of a rule, and `do Žiliny, v Žiline, Žilinu` read as one case.

**How to apply:**
- The checklist is the `grammar-explanations` skill (`.claude/skills/grammar-explanations/SKILL.md`): source every form (slovak.wiki case page, then the Wikipedia paradigm tables, then JÚĽŠ), cover each pattern (masculine person and thing, feminine in -a hard and soft, feminine in a consonant, neuter), state the rule before its exceptions, name the case of every example, use only words the learner has, say why a cell is empty.
- `tests/case-forms.test.ts` holds every walk-through sentence and table row to a paradigm table, requires each rule line to name its case, and fails on terms the learner was not given. Add a word to `FORMS` when you add a form.
- A masculine rule that covers people and animals says "masculine person or animal" (the animate masculine nouns), never "male person" and never plain "masculine" (masculine things such as dom do not change in the accusative). A unit id is code: prose, captions and chat use the full name (E23).
- What no source gives is written in the changelog, not in the app. The same checklist is in the slovak.wiki authoring reference (`slovak-wiki-authoring.md`).

### E75. Each device runs its own language, and a page writes into the language it shows (2026-11-08, branch `fix/per-device-language`, PR #145)

**Why:** remote access (E20, E21) puts a phone or an iPad on the same server as the PC, and the running language was one value for the whole process (E45). A switch on one device reloaded only that device, and a page left open on another kept showing the old language while its writes went to the new one. Reproduced in the sandbox with two browser contexts, Slovak and an added Czech: a lesson started in Slovak and left after the switch wrote its minutes into `profiles/czech/progress.json`, and the finished Slovak lesson was refused ("unit and reps are required", since Czech has no such unit) and stayed in the outbox with no reason given. A first fix refused such writes with a 409 and a notice. The owner asked for the best of both: a phone and the PC each in their own language, and no write refused or lost.

**How to apply:**
- A request's language is, in order: a borrowed one (`withProfile`, still synchronous), the page's (`x-lh-language`), the device's (the `lh-language` cookie), then the default (`defaultProfile()`, the last language chosen anywhere, kept in `profile.json`). `activeProfile()` reads it on every call, so `PATHS.*` and the course follow it. The core's course on `globalThis.__lhCourse` is a getter that follows `activeProfile()`.
- The page and the device come from Next's request store (`workUnitAsyncStorage`, read synchronously in `src/server/request-language.ts`, resolved once per request). Next keeps one store per process under a global symbol, so every bundle reads the same one; checked in `next dev` and `next start`. It is an internal Next module: after a Next upgrade, `tests/language-guard.test.ts` is the check.
- Work a request starts (a tutor turn, a skill-map update, a video preparation, a model call) runs in that request's async context and keeps its language after any switch. A switch no longer waits for it. A module-level in-flight promise shared between requests is keyed by language (`nextCatchItem`).
- The page names its language. `app/layout.tsx` writes `activeProfile()` into `<html data-lh-language>`; `components/language-gone-notice.tsx` reads it once when the page loads and wraps `window.fetch` (`lib/shown-language.ts`), so every same-origin request carries `x-lh-language`, including the router's own requests for a client-side navigation. A tab keeps its language until it loads in full; then it takes the device's.
- The device chooses with its cookie. `POST /api/profile` sets it (HttpOnly, SameSite=Lax, 400 days, Secure over HTTPS) and makes the language the default. `proxy.ts` sets it to the default on a device's first page, and again when it names a language that was removed, so a device keeps what it started in when another device switches.
- One refusal is left: a write from a page whose language was removed gets 409 `language_gone`, and the page says so and offers Today.
- Tests: `tests/language-guard.test.ts` runs the proxy and the routes inside a request store on a scratch data folder, for two devices at once, an old tab, in-flight work across a switch, the cookie, and a removed language.

### E76. The tutor chat is a plain conversation: short replies, one question, drawings in the reply (2026-11-08, branch `feat/light-tutor-chat`)

**Why:** the owner: the chat is "way too clunky" and slow, "from picking a model, to sending a chat, to the thinking, to the large responses that it sends, the visualizations and drawings". A free question ("Explain demonstratives with examples and visualizations") started the prober, which tests before it answers, on the strong slot at a high thinking level, then a plan map, question cards and a figure from a background job. riddled.ai teaches the same point in two short paragraphs with a drawing in the reply and one question at the end. The owner: "take major inspiration from Riddled.ai", "it should just feel very easy to follow along and not overwhelming at all". Research note: [research/riddled-chat.md](research/riddled-chat.md).

**How to apply:**
- **A third kind of chat, `kind: "chat"`** (`ChatKind`, `src/core/contracts/chat.ts`). New chat creates it (`/chat/new`; `?mode=teach` and `?mode=practice` still open the probed lesson and practice), and so does Why? (`openWhy`). Tutor units and the placement follow-up keep their kinds for now. Older chats keep theirs.
- **The agent** is `createChatAgent` (`src/agent/teacher-agent.ts`): its prompt is `src/agent/prompts/chat/` plus the language section, the voice and the accuracy rule, and the "This learner" block; its tools are only the silent checks (`lookup_word`, `check_slovak`, `slovak_reference`, `add_to_review`, `review_status`), with no `send_to_user`. No probe, plan, question cards, problems or background jobs.
- **Fast by default.** A chat is born on the strong slot's model (the cheap slot's for Why?) at `CHAT_THINKING_LEVEL` ("low"), whatever the slot's level. The chat shows no model picker, no token or cost figures and no "Show working"; a checking tool never shows a live card. Spending is still at Settings → Spending (mode "Chat").
- **A reply** (`10-chat.md`): at most two short paragraphs (about 90 words), plain prose, every form followed by its meaning, one question at the end. A first answer answers (no test first). One thing changes per question (contrast, generalization, then both and a new word: variation theory), hints fade, a miss comes back later. A lost learner gets a new representation, shorter. Grading keeps P3 (a cue first, the form after the second miss) and E29 (check before marking wrong).
- **Drawings in the reply** (`20-drawing.md`): a ` ```svg ` fence after the prose, 320 wide, colors only through `var(--ink|--graphite|--faint|--rule|--mark|--wash)` and `var(--font-sans)`. `src/core/sketch.ts` rebuilds it from an allowlist (shapes, text, groups; no scripts, links, images, `url()`, ids or classes; hard-coded colors read for lightness so Night still shows them) and maps the names to the app's tokens; `components/sketch-figure.tsx` draws it in the page with the ink wobble filter, draws the strokes in order on a drawing that arrives live (not on history), and steps through `<g data-step data-caption>` groups with Back and Next. A failed drawing says "This drawing could not be shown." Every form in a drawing must also be in the prose.
- **One-tap replies** under the tutor's last message (`src/core/chat-replies.ts`): Hint, I don't know, Explain it another way when the reply ends on a question; Quiz me, Explain it another way, Draw it otherwise. They send plain text the prompt knows.
- **A notebook page, not a chat window** (the owner, second round: "completely revamp the UI and the layout … and how you get to it … even the default empty state"). **Ask** is a main destination in the sidebar under Today (`lib/nav.ts`, lights on every `/chat` page); the chats list below is headed **Chats** with a + button. `/chat/new` is `components/chat-draft.tsx`: a large heading, the question typed straight onto a dotted line, outline suggestions, no box and no model control. In a chat the header is a bare line with the title small; the learner's lines are large sans with a dotted underline and no bubble; the tutor's replies are in a serif (Source Serif 4, `--font-voice`, the one exception to E33's single family, at the owner's ask) with an ink blot in the margin; the composer is a hairline field. The probed lesson and practice keep their look. (The serif, the ink blot and the dotted underline were removed in E77.)
- **Our own desk, not a copy** (the owner, third round: "I didn't say we should copy them completely", "fix up the spacing and layout", "full creative control"). `/chat/new` opens on an ink sketch from the lesson kit, "What's on your mind?" with one line naming what a learner brings (a word they keep forgetting, a sentence they got wrong, a rule that won’t stick; the first copy listed the tutor’s features in the order riddled.ai’s landing does), a card field with dictation and the send button inside it, and two labeled lists: **From your mistakes** (the three weakest units by first tries, `weakestTopics`, the same measure as the tutor's "Measured weak points"; generic ideas when there is no evidence yet) and **Pick up again** (the last three chats). On a wide screen a chat has **the board** beside it (`components/chat-board.tsx`): the latest drawing stays pinned while you answer, and every form the tutor glossed (`say: …` = "…") is listed with its play button. The sidebar's chats header holds Select, Search and New chat on one line. The chat's answer field is one card: the text on top, and below it the microphone (an icon), the language's letters and the send button; no letter strip floating above it, no stats row under it, no line across the page, only a quiet "Enter to send · Shift+Enter for a new line" where a keyboard is the main input.
- **Measured, committed, checked** (the owner, fourth round: "did we lose any features?"). Before a question with a right answer the tutor calls `pose` with the answer and what it tests; after the learner answers it calls `grade` (right, slip, wrong, dont_know, hinted). Both are hidden. Every grade is kept in `data/profiles/<language>/chats/answers.jsonl` (`src/store/chat-answers.ts`, E1), and the board shows "N of M right on the first try" and what was missed, from the transcript (`chatScore`). An open question is a pose with no grade after it (`questionOpen`), so Hint and I don't know show even when the question ends without "?". **Drill this** (on the board, and under the reply below the xl width) opens a practice session on the missed focuses or the chat's topic. The learner's typed text gets the `[Checker …]` note in the model's copy only (`withLearnerNotes` over `toLlmMessages`); the record and the bubble are unchanged.
- **Their own material and the open web.** The chat has `read`, `ls`, `find`, `grep`, the `pdf` job and the `research` job (for usage the dictionary and the reference do not settle). The `visual` job stays out: the drawing is written in the reply.
- **Checked against real models** (`scripts/eval-chat.ts`, four runs on 2026-11-08, Haiku 5.5 and Sonnet 5.5): every Slovak claim read correct except one Sonnet line ("do … answers from what?"); every drawing passed the allowlist; Haiku at low thinking answered a follow-up in about 1.4 to 5 s to the first text and the first reply in 7 to 10 s (it calls the reference first); medium thinking was no shorter or more compliant. The runs found, and the prompt now forbids: `say:` written without backticks, a question about a form printed just above it, an answer shown while its question was open, two questions in one reply, talk about the tools, and the reply written twice around a tool call (the view also shows a repeated text block once, `repeatsEarlierText`). Still seen in the last run: a first reply that runs one idea further than it taught.

### E77. Every end screen scrolls, keeps its buttons in the dock, and shows the session as a record (2026-11-08, branch `fix/lesson-end-layout`)

**Why:** the owner, on a screenshot of the lesson end screen: "The layout here is messed up. There's no room. I can't even scroll, things aren't full aligned as they should be. Everything is so cramped", and "Don't be afraid to change the layout entirely." Then: "audit other end screens and have another agent(s) review your work". All eight end screens (lesson, Listen, Speak, the scripted scene, the chapter exam, Read it faster, Speed, Read, Watch) were centered in a fixed frame with no scroll area, so a long result hid its buttons. They were built four different ways, and Read and Watch had a row of stat boxes. A review with the `better-*` skills found, among others: the keyboard could not reach the secondary buttons or scroll; a failed save left the lesson waiting forever, and Listen, Read and Watch showed unsaved XP as earned; right and missed tiles differed by color alone.

**How to apply:**
- **One layout.** Every end screen is `TaskEnd` (`components/task-frame.tsx`): the result scrolls in its own area (`flex-1 overflow-y-auto`, the content `my-auto`), the actions sit in the `Dock` where the task's own buttons were, and both share one width (`max-w-2xl`; `max-w-5xl` from 1024 px for a lesson with misses). The heading is the eyebrow (`q-date` with the task's icon) and `q-hello`; the facts are `Stats` rows at full width; a list of sentences is `SentenceRows` and `SentenceRow` (a play button named after its sentence, the sentence, its meaning, a note). No stat boxes, no big centered icon.
- **Keys.** Enter does what the filled button does (the next lesson, Today, Next story), except on a focused button or link, which keeps its own Enter, on a held key, or in the first second after the screen opens (`endEnterBlocked`), so a quick second press after the last answer cannot skip the result. Escape still goes back where the task was opened (E72). The scroll area takes focus when the screen opens, so Space, Page Down and the arrows scroll it, and a screen reader hears it as a region. On an end screen Tab moves through the buttons and links: an exception to the dead Tab of 2026-09-17 (`components/keyboard-shortcuts.tsx`), because the secondary actions have no other key.
- **The lesson.** From 1024 px with misses: the score on the left (it stays in view while the list scrolls), the missed sentences on the right; one column below that. The score is the share right the first time (E18: a comeback or a second try does not count), over one tile per answer in the order asked, by its first try: filled for right, half-filled for an accent slip, hollow for a miss or a help, so the shape says it without the color. The comebacks are their own group ("Came back: 3 of 4 right"). The tiles replay in order when the screen opens (transform and opacity, under half a second, none with reduced motion). The rows: XP, today's goal, days in a row, words added to Review (Blitz adds Best). The line under the heading says "Lesson 1 of 3 · Up next: <unit>" when the next lesson is in another unit; the button always says "Next lesson". The list beside it is "Not right the first time" (misses, accent slips and help, matching the score); each sentence says what was answered and how it went when it came back.
- **A new stamp** sits beside the heading from 640 px (the `.lh-end` grid areas in `app/globals.css`); the heading column keeps 23rem, so a stamp that arrives with the server's answer does not rewrap the title. Several stamps are small overlapping discs with their names on one line. Below 640 px the stamp follows the score, and the list under it moves down when the stamp arrives: the one shift left.
- **A failed save says so.** The lesson outbox tells every waiting end screen when the server cannot be reached or does not answer in 15 seconds, and keeps trying (`settleWaiting`); the dock says "Not saved yet. The app keeps trying." with Try again ("Trying…" while it runs), the XP and the server's rows say "Not counted yet", and Next lesson works. Listen, Read and Watch keep an ended session in their own outbox (`components/session-save.ts`, `lh-session-outbox` in local storage) until the server has it, send it again on a growing timer (2 s, doubling up to a minute) and when the app regains focus or the network returns (only for the language it was made in), and say the same "Not saved yet. The app keeps trying." with Try again; until it lands, XP shows "Not counted yet", and when a later send lands the open end screen switches to the saved values (`onSessionSaved`). Their routes record a session once per id (`recordOnce`, `src/server/session-acks.ts`, kept in `progress.json` as `sessionAcks`), so a resend cannot count XP twice. A refused session (4xx) is dropped, and the screen says so: "Not saved: the app refused this session, so it is not counted." with no Try again.
- **Words.** "Added to Review" and "in Review" (E67), never "your deck"; the list is "Missed" on Listen and the exam and "Not right the first time" on the lesson, where the score counts first tries. Teal marks only a success: a number that is not one stays ink.

### E78. Exclamations are said in the language being learned, from one checked table (2026-11-08, branch `fix/lesson-end-layout`)

**Why:** the owner: "Also should some of the text be in Slovak?" Repeated meetings build word knowledge, fixed phrases are worth learning whole, and a gloss keeps them comprehensible; no study tested an app's interface language. The Slovak praise was hardcoded, so an Estonian lesson praised in Slovak. Research note: [research/target-language-ui.md](research/target-language-ui.md).

**How to apply:**
- Only fixed, frequent exclamations are in the language being learned: the praise after a right answer (lesson, Listen, Speak) and the heading of the lesson end screen ("Je to hotové!", "Bez chyby!", "Koniec!", "Nový rekord!"). Labels, numbers, instructions and buttons stay in English.
- The heading carries its English gloss beside it in the label style ("it's done"); the praise has none, since the verdict around it says what it means.
- The phrases live in `src/core/cheers.ts`, per language code, and are picked from the active language (`praiseFor`, `cheersFor`); a language without a set gets English. Slovak, Estonian and Russian have sets, each form backed by the lexicon or Wiktionary as the research note lists. No model writes them. A new set needs the same sources.

### E79. A chat starts in place, a reply is one model call, and the tutor links the app's own lessons (2026-11-08, branch `feat/instant-chat`)

**Why:** the owner: starting a chat "is so slow and not as seamless as Riddled.ai … make it almost instant"; the ink blot in the margin "is literally copied from them. We shouldn't copy like this"; drop the serif so the view is "nicer to read and less boring"; and make the chat "able to direct us to certain pieces of content, lessons, exercises" (it had answered "I can't see the app's full lesson list"). Measured on 2026-11-08 with Haiku 5.5 at low thinking, the strong slot's model:

| | Before | After |
|---|---|---|
| Model calls per reply | 2 or 3 (a check, then `pose` before any text, then the text) | 1 (2 when the tutor checks a rule first) |
| First text, first reply (the agent alone) | 2.8 to 6.9 s | 3.2 to 6.0 s |
| First text, follow-up | 1.4 to 5 s (E76's runs) | 1.7 to 2.8 s |
| Enter to the chat on screen (production build) | a page load of `/chat/<id>` (not timed) | 50 to 70 ms |
| Enter to the first tutor text (production build) | not timed | 2.7 to 6.4 s (one cold outlier at 18.6 s, not reproduced) |

**How to apply:**
- **No page load to start.** `/chat/new` creates the chat (`createChatSession`, POST `/api/chats`) and renders `Chat` in place, then `history.replaceState` puts `/chat/<id>` in the address bar (`components/new-session.tsx`). The chat's code is loaded while the draft is open. Going to `/chat/new` again resets the page to the draft (a render-time check of the pathname). The probed lesson and practice drafts still navigate.
- **Text first, the record last.** The chat prompt (`10-chat.md`, "Checks, then the reply, then the record") asks for any check first, then the whole reply, then `grade` and `pose` as the last calls. A chat turn ends when its message has text and only record calls (`closesChatReply`: `pose`, `grade`, `add_to_review`), in `makeQuestionStopper`, and `needsContinuation` owes nothing after such a message. A record call that fails is not retried: a retry made the model write the whole reply again (seen in the sandbox, a malformed `pose`), and one lost record costs less than a reply shown twice. The failed call stays in the record, so the next turn sees it, the server logs it, and the chat shows no "Retrying…" for it. A dispatched `research` or `pdf` job only acknowledges, so it closes a reply too; a file read does not.
- **The drawing comes after the reply** (from riddled.ai's `/write`, inspected live: text at 3.3 s, the drawing 7.4 s later from a second call; [research/riddled-chat.md](research/riddled-chat.md)). The tutor never writes SVG: it writes a reply that stands on its own and calls `draw` with a brief (what the picture shows, the layout, the forms with their meanings, all from the reply). `drawForReply` (`src/server/drawing.ts`) runs one call on the chat's own model with `src/agent/prompts/drawing/10-drawing.md`, given the reply and the brief, and keeps the drawing only if it passes the sketch allowlist (`svgOf`). The SVG is the tool result's `details` (the transcript and the board draw it under the reply; "Drawing…" while it runs); the model's copy says only "Drawn under the reply: <brief>", so later turns do not pay for the SVG. Measured in the production build: before, a drawing reply showed its first text after 11.2 s (the model planned the SVG in 1,414 thinking tokens, then posed before writing); after, the text at 6.7 s and the drawing about 21 s later. The drawer stays at low thinking: at `off` it took 4 to 6 s but labels overlapped and a caption was wrong.
- **What the learner sends during a turn is held** and sent when the turn ends ("Sends when the tutor is done" under it, `heldAnswer` in `components/chat.tsx`). A steer would wait for the next run, because a chat turn ends right after its record calls; in the sandbox the answer typed while the drawing was made was lost before this.
- **Links are sorted by origin** (`chatLinkTarget`): same origin opens in place, `/api/` and `/_next/` stay text, a tutor unit opens its chat, other sites open in a new window with an arrow, other schemes stay text.
- **Back and Forward.** Next's `replaceState` stores the draft page's tree under `/chat/<id>`, so returning to that entry showed the draft; the page now renders nothing there and refreshes, which loads the chat's own page. A chat whose creation returns after the learner left `/chat/new` does not take over the address.
- **`pose` takes its other answers as one string** (`accept`, " | " between them): Haiku 5.5 wrote the array form without quotes (`"accept": Mesta`) in about half the runs, which failed the call.
- **Thinking stays at low.** `off` gave the first text in about 0.5 s but wrong Slovak (`túto autu` for a neuter noun, self-corrections in the reply, a check called after the text); `minimal` was no faster and posed twice. A warm prompt cache saves only 0.4 to 0.6 s on a 20,000-token prompt, so the cache is not pre-warmed.
- **What the app has.** The chat agent's system prompt carries a map between the doctrine and "This learner" (`appContentText` in `src/core/app-content.ts`, gathered per turn by `appContentNow` in `src/server/app-content.ts`): the pages from `lib/nav.ts`, every chapter and unit with its tagline, its link and this learner's state (written per unit only in open chapters), the spoken scenes, the learner's cheatsheets and the last 12 stories. About 15,000 characters. The prompt ("The app's own lessons") says: answer "do we have…" from the map with links, offer at most one fitting link per reply otherwise, copy links exactly, never say the lessons cannot be seen.
- **Links open in place.** `components/chat-link.tsx` renders a reply's links: an app address with Next's `Link`; a tutor unit's address (`/lesson?unit=<tutor unit>`, `tutorUnitAt`) starts that tutor chat, as the Curriculum does; anything else opens in a new window with an arrow. Links are teal with a straight underline (E33).
- **Our own reading view.** The tutor's text is Geist at 17 px with a 1.7 line height, like the rest of the app (E33 again has one family; Source Serif 4 and `--font-voice` are gone). The ink blot in the margin and the dotted underline under the learner's line are removed; the learner's line is a semibold heading with space above it.
- **American spelling** is in the chat prompt: a reply said "practise".
- **Export across formats.** The chat header features an **Export** menu (`components/chat-export.tsx`, `src/core/chat-export.ts`):
  - **Markdown (`.md`)**: Instant "Copy as Markdown" with visual clipboard toast, or download `.md` file with clean dialogue, glossed forms, and code-fenced SVGs.
  - **Anki Deck (`.tsv`)**: Direct download of Anki-ready flashcards (`#separator:tab`, `#html:true`, `#tags column:3`) extracting all glossed Slovak vocabulary and posed quiz questions.
  - **Print / PDF**: `@media print` print styles in `app/globals.css` that hide sidebar, composer, and header buttons to print or save directly to PDF.
  - **Session Data (`.json`)**: Raw backup of transcript, metadata, and turns.
- Tests: `tests/fast-chat.test.ts` (one model call for a closed reply, also with a failed record or a dispatched job; a second call after a check, a file read or a record before text; the map's links, states and lists; link sorting; the drawer's input, its kept and failed results, the allowlist), `tests/chat-kind.test.ts` (the chat prompt asks for `draw`, the drawer's prompt carries the six colors), `tests/chat-export.test.ts` (Markdown, Anki TSV cards, JSON export, and title slugification).

### E80. Estonian and Russian ship a course written by hand, and the Grammar page shows each course's cases (2026-11-08, branch `feat/estonian-russian-courses`)

**Why:** the owner, on the Grammar page for Estonian ("The case and gender table is built for Slovak only"): audit the Estonian and Russian content, research each language, "make sure that we have fully got the content covered. Every aspect of the language", and have other agents, Gemini among them, review it until nothing is left. The model-drafted courses taught a fraction of each language: Estonian had 15 drills (no negation, no plural, no ablative, no conditional, no impersonal, though its chapter taglines promised them), Russian 14 (no present beyond я and ты, no gender, no agreement, no genitive plural; a drill that asked for the dictionary form while showing it). Research notes: [research/estonian-coverage.md](research/estonian-coverage.md), [research/russian-coverage.md](research/russian-coverage.md).

**How to apply:**
- **The course is data written by hand.** `curriculum/<id>/course.json` and `world.json` ship with the app and win over the copies built when the language was added (`curriculumFile`; `readCourse` in `config.ts`). Adding a language that ships a course makes no model call for the course or the story world, and the add dialog says so. The model still never writes a sentence (E27): a drill takes Tatoeba sentences by the Wiktionary tags of the blanked form.
- **A drill can take several tag sets** (`variants`: the plural place cases, every person of a tense), **rule a trigger word out** (`notAfter`: the imperative without the ei of a negative), **leave out forms** (`skipForms`: Church Slavonic есмь, еси, суть listed under быть; lexicalized words such as asjata, in vain, or the postposition asemel) and **keep to a list of words** (`lemmas`). A course can drop a Tatoeba sentence that is not standard (`badSentences`, with the reason). Two standard forms of one cell are both right (Estonian majja and majasse, maju and majasid): the lesson accepts either.
- **The Grammar page for a course** is its cases down the side and singular and plural across (`src/core/course-grammar.ts`, `components/grammar/case-table.tsx`). The rows are the course's `cases` (name in the language, what the case does, why a cell has no drill, the tutor session that covers it); a course without them gets rows from the cases its drills cover. A cell opens the drill that covers the fewest cells, and shows first tries for that cell (`byForm` on the unit's record, beside the Slovak `byGender`). Slovak keeps its case × gender atlas (E12).
- **Every drill has its sentences before it ships.** `scripts/check-course.ts` runs the shipped course against a language's dictionary: what the checker would drop, how many sentences each drill draws, and samples with the blank. A drill under 12 sentences is not shipped; a cell with too few sentences says so and names its tutor session (the Estonian essive has one sentence in Tatoeba). `tests/course-cases.test.ts` holds both courses to their shape: one chapter per unit, a goal at each end, no field the checker would cut, a story beat per chapter, no unit id in what a learner reads.
- **The word list was rebuilt.** After a word's first five sentences (kept, so a review card keeps its sentence) it gets more for the forms it lacks, up to 24: Estonian went from 4,503 to about 6,000 sentences, Russian from 14,667 to about 38,000, and the plural and rare cases became drillable. A capital inside a sentence is a name (Russian "Тома" was Tom, filed under том, a volume). A form that a word outside the list also owns, or a word joined by a hyphen, is not blanked (достигнут, a participle, had been drilled as "they will reach"; по-другому). An adjective used as a noun no longer hides the adjective (красный, must, valge were missing). A word written with ё ranks by the е spelling of subtitles. The words a course's themes name stay in the list past the 3,000 (зима, весна, вокзал). `scripts/rebuild-lexicon.ts` builds an added language's list again from its kept downloads.
- **Levels follow the official standards:** Harno and Keeleklikk for Estonian, ТРКИ for Russian, as the research notes give them, not the four-stage split a model guessed.
- **Reviewed until clean:** Gemini 3.8 Flash and Claude reviewed both courses in rounds, each round given the last round's findings and what was done with them, until neither found a content problem.
- **Estonian skill (`eesti-language`):** Ships complete skill documentation and 12 modular references in `.agents/skills/eesti-language/` and `.claude/skills/eesti-language/` (covering core grammar, nouns, gradation, modifiers, verb forms, aspect and object, valency and prepositions, syntax and style, phonology and orthography, spoken Estonian and particles, communication vocabulary, and CEFR progression with diagnostics). Sourced from Erelt & Metslang *Eesti keele süntaks*, *EKKR*, *Eesti keele grammatika tabelid*, Keeleklikk, and Harno descriptors. Pinned by `tests/eesti-skill-copies.test.ts`.
- **Russian skill (`russian-language`):** Ships complete skill documentation and 12 modular references in `.agents/skills/russian-language/` and `.claude/skills/russian-language/` (covering core grammar, 3 declensions, modifiers, verb morphology, aspect and verbs of motion with direction prefixes, participles and gerunds, valency and prepositions, syntax and FSP, phonology and orthography with 7/5-letter rules and stress notation, spoken Russian and particles, situational communication and naming customs, and ТРКИ/TORFL progression with diagnostic error taxonomy). Sourced from *Грамматика-80*, ТРКИ state standards, Lopatin 2006 orthographic rules, and Russian National Corpus. Pinned by `tests/russian-skill-copies.test.ts`.
- **Not solved:** no drill can test the choice between two verbs (Russian aspect, motion verbs), because a drill shows the dictionary form of the blanked word and the pairs drill (E11) is built for Slovak; Wiktionary lists every person's pronoun forms under each pronoun, so pronoun cases cannot be drilled either. Tutor sessions teach them. Crude words from subtitle frequency (хуй, пиздец) still have sentences; dropping them needs Wiktionary's sense tags, which the kept downloads do not hold. A word that shares its spelling with a particle can lose its sentences to it (Russian чай, tea, is filed under the particle "methinks"). Most Russian nouns have no gender in the dictionary, so the case table has no gender columns.

### E81. Zvuk: shadowing with the tutorial's timing, verified lines, one listening check (2026-11-08, branch `t3/pronunciation-principles-review`)

**Why:** the owner asked whether the app's way of thinking matches Kjellin's pronunciation tutorial and Krashen's book, and then to start the sound step (phase 7). The comparison is in [research/shadowing.md](research/shadowing.md). The app takes Kjellin's timing and his short-line rule. It does not take his advice to hold back all writing, or his repeat-one loop.

**How to apply:**
- The sounds are data: `curriculum/slovak/sounds.json` (chapter, a rule and a bridge, two twins, four verified lines). `src/core/sounds.ts` is pure: `checkSound` is the drop rule (the twins differ in exactly one sound, every line is a verified example of one twin, at most six words), `listenOrder` draws the four-item check, and `shadowVerdict` reads the Speak bar (`PRON_CLEAR`, unchanged).
- `/sound?id=<id>` runs the screen. A listening check comes first: choose the word heard, two of each twin, capped at four items. Then shadowing: a line plays, the learner has a 700 ms gap (`SHADOW_GAP_MS`), then says it. The recording goes through the same transcript and clarity score as Speak (`/api/stt`, `/api/pronounce`), so no Azure key is needed. Three tries per line, then the line is left as not yet.
- Without a microphone the line is said aloud and not scored. Without speech-to-text the screen says so and links to Settings → API keys.
- The twins meet only in the listening check. The soft consonant pair (de, te, ne) from the plan is not built: the lexicon has no verified twins for it, and it is not invented.
- Two vowel-length pairs so far: pas/pás (chapter "moving") and rad/rád (chapter "people"), each line taken from the lexicon's own verified examples.
- Not saved yet: the screen keeps its result on the page (E1 says learner-produced data is kept, so saving comes next). The sound step is not on the path yet either (`chapterArc` still says "not yet"), so the screen is reached by its link until the arc names it.


### E82. An automated single-case experiment arm: input-first Russian vs Slovak control (2026-11-08, branch `t3/pronunciation-principles-review`)

**Why:** the owner asked to test whether listening-first improves listening faster than the normal plan ("take me out of the loop"), comparing Russian on the input-first arm against Slovak on the normal control over a 42-day study (2026-11-09 to 2026-12-20). Single-case interrupted time-series design (SCED v3, [docs/experiments/input-first-russian.md](experiments/input-first-russian.md)) with randomized onset (uniform draw between days 12 and 22).

**How to apply:**
- `INPUT_FIRST_TASKS = ["review", "listen", "words", "read", "watch"]` (`src/core/curriculum.ts`). Drops `lesson`, `strengthen`, `blitz`, `speak`, and `fluency` (which records mic output).
- Deterministic PRNG (`mulberry32` with seed `20261108`) draws Day 15 (2026-11-23) as onset day. Baseline runs Days 1–14; intervention runs Days 15–42.
- Automation engine (`src/core/experiment.ts`, `src/server/experiment.ts`):
  - In `src/server/lesson.ts`, `progressSummary` automatically assigns `arm: "input-first"` on and after the onset day for Russian without manual settings changes.
  - Automatically logs daily first-play understanding share, dictation reps, minutes, covariates, and task compliance to `daily.jsonl`, regenerating `summary.md`.
  - Weekly checks on Sundays (10 listening dictation probes + 5 spoken production prompts) are served via `/experiments/input-first/check` (with API `/api/experiments/input-first/check`) and saved to `checks.jsonl`.
  - Dashboard at `/experiments/input-first` (linked in sidebar navigation under Track with `FlaskConicalIcon`) displays timeline, current phase, regression level shift $b_2$, permutation randomization $p$-value, weekly checks, and a reset endpoint (`POST /api/experiments/input-first/reset`). Backward-compatible redirects maintained from `/experiment` and `/experiments`.
- Protocol provenance (commit `8e767a9f`, SHA-256 `1c9f0bd5e4fb093c8beae59e1207a6db9edf5572b9d1889f146f70e7dd7829d1`) and decision rules are fixed in `experiment.json`. Final `verdict.json` written after Day 42.


### E83. Krashen SLA-aligned Roadmap: CI tuning, silent period, and conversational recasting (2026-11-09, branch `t3/pronunciation-principles-review`)

**Why:** To address the cognitive gaps identified in early language acquisition: authentic video overwhelming working memory (<90% coverage), premature oral production triggering high affective filters and L1 syntax crutches, and schoolmaster-style error correction paralyzing conversational spontaneity.

**How to apply:**
- **Roadmap spec:** Documented in [docs/plans/comprehensible-input-roadmap.md](plans/comprehensible-input-roadmap.md).
- **Track A (CI Tuning in Watch/Read):** Lexical pre-priming to raise authentic video coverage to ≥94% before play; line-level tempo adaptation (0.85× WPM normalization); interlinear i+1 smart glossing; multi-pass reading (immersion → tap-noticing → fluency).
- **Track B (Onboarding Silent Period):** A0/A1 phase deactivating microphone and typed cloze in favor of receptive meaning-matching and auditory discrimination until a 250-word / 85% comprehension gate is cleared.
- **Track C (Immediate Visual Diff / High-Noticing Recast):** Instead of burying errors in a hidden drawer or lecturing with paragraphs of grammatical taxonomy, the tutor highlights mistakes front-and-center using an immediate, high-contrast visual diff (`~~mistake~~ → correct (rule cue)`). The conversational reply answers the learner's idea right beneath it in natural target language without pausing momentum or forcing re-typing.

### E84. The Study views are a page and a task like any other (2026-11-09, branch `t3/pronunciation-principles-review`)

**Why:** the first Study screens were built from raw Tailwind colors (`neutral-950`, `emerald-600`), so they were dark in Day, shouted in capitals, used native selects and looked like another app. The owner: "This design doesn't match our app at all."

**How to apply:**
- `/experiments/input-first` is a page in the Milestones frame (`components/experiment/study-page.tsx`): the nav word as the title (Study), the question, and one sentence that says where the study stands today. When a weekly check is open it is the one filled button, in a band above the figure.
- **The page is one figure** (`components/experiment/study-chart.tsx`): the 42 days run left to right once, and everything that has a date sits on that axis. Each language is a lane of dots (a day's share of sentences understood on the first play), the listening-first days are a pale teal band that starts at a line marked "the switch", today is a hairline, and each week ends in its check result under its own lane. When both sides of the switch have enough days, the two fitted lines are drawn, so the jump the study looks for is the gap between them. A day with practice but too few sentences is a hollow ring on the floor of the lane.
- **The figure reads without a pointer.** A line under it reads the day you point at, tap, or reach with the arrow keys (the day, then both languages); it has a fixed height, so nothing moves. The days are also listed below as text, the latest fourteen first and the rest behind "Earlier".
- Two quiet panels follow: "Does today count yet?" (typed sentences today against the five a day needs, with a link to Listen) and "Result so far" (the verdict in words, the jump, and how many days count on each side of the switch against the eight needed).
- `/experiments/input-first/check` is a task in the Listen frame (`TaskFrame`, `PracticeCard`, `Dock`, `TaskEnd`), with `ChoiceMenu` for the language and the week (E4).
- **The check's progress bar is its record** (`components/experiment/check-track.tsx`): one cell per sentence, ten to hear and five to write, shown on the first screen as what is coming, along the top while answering, and on the end screen as the result. A right answer is a full cell, a partly right one a thin bar, a miss a hollow cell, so the three differ by shape and not only by color.
- **One play looks like one play.** The play button is a disc inside a ring; the ring empties as the sentence plays and stays empty, and the words beside it say the same. With reduced motion the ring is full, then empty.
- Colors come from the tokens only, and the figure has two inks: the dots are the text grey in both lanes, and teal means listening first (the band, the switch line, the fitted lines) and the one main button. Marks are 8 px dots on a desktop and 5 px on a phone, where 42 days share about 230 px.
- The study's terms stay out of the screen: "the switch" for onset, "jump at the switch" for the level shift, "listening first" for the arm. The seed, the test and the protocol file are named once, under "How the result is decided".
- A weekly check opens on its day and is offered once: a finished check shows its result and has no link back in, because a second sitting would be a second measurement. An item answered twice counts once, with its latest answer (`weeklyCheckRows`, `src/core/experiment.ts`).
- The listening items are graded by the Listen rule (`judgeTyped`), as the protocol says, and a sentence whose audio failed does not count as heard.
- **The study's files stay under the data root.** `src/server/experiment.ts` used to copy every file it wrote into `C:/Users/Stream/Projects/langharness/data/` and to fall back to that folder's lesson logs, progress and Russian word list. A test run, a build or a sandbox therefore rewrote the owner's real study files. Those paths are gone and a test (`tests/experiment.test.ts`) fails if a folder outside the data root is named there again (E6).
- Not built: the protocol asks for the five production prompts to be spoken, and the screen takes them typed (`engine: "typed"`). The screen says "Write this in …", so it does not claim otherwise.


### E85. The chat reads seamlessly: the tutor in Fira Sans, no boxes around words or lines, answers marked in place (2026-11-09, branch `feat/chat-seamless`)

**Why:** the owner: the chat "feels too much like a generic chat app", also while it generates, and "pick a more fitting font". Two tries that changed the layout (a bounded sheet, and five mock-ups: open page, two voices, a trail, an answer inside the sentence, an open book) were turned down: "what we currently have (main) is better than all of these … redesign some pieces to make it feel more seamless". What read as boxes on `main`: a tinted pill around every `say:` form, a bordered input card with a hint line under it, a rule between the tutor's steps, outlined pills for the replies, every learner line drawn as a heading, and a spinner while it thinks.

**How to apply:**
- **The tutor's voice is Fira Sans** (`--font-read`, `app/layout.tsx`, 400 and 600 with a true italic, latin, latin-ext and cyrillic, `preload: false`), set at 18 px with a 1.68 line height in `.lh-voice .lh-prose`. Chosen against Geist, Golos Text, Wix Madefor Text, Onest and Source Sans 3 on the same Slovak, Estonian and Russian sample: a humanist face reads warmer over long text than the grotesques, pairs by contrast with Geist (which keeps every label, button and learner line), draws the carons apart (ľ, ť, ď), and has a real italic for the single words the tutor sets in italics. It is the second family next to Geist (E33), for the chat's reading text only; the serif it replaces was removed in E79.
- **Forms without a pill.** In a chat a `say:` form is semibold text with a teal play button (`.lh-voice .lh-spoken`); `SpokenPhrase` keeps its pill everywhere else.
- **Four kinds of learner line** (`learnerLines`, `src/core/chat-lines.ts`): the first is the title (28 px); a new question is a section heading; a tapped reply is a small quiet line; a line sent while a posed question is open is an **answer**, shown as plain semibold text with its mark beside it: a pen tick, cross or dash and a word (`answerMark`: "Right" only for an unhinted right answer, as the first-try count does; "Right with help", "Almost, check the spelling", "Not quite", "Skipped"). The words are the ones lessons and Review already use for the same outcomes (`components/review-session.tsx`); a first draft said "Not yet", which echoed the tutor's own first words and read as "nearly there" even when the answer was right Slovak for a different question. No rule, no box. The bar's title shows only once the page's title scrolls away.
- **The composer floats.** One card with the app's raised shadow (`shadow-raise-hi`) and no border (a hairline outline appears while it has focus), at the column's width (42 rem, so the tutor's lines stay near 70 characters); the hint line under it is gone; the page behind it is not painted, and the transcript fades out under it (`.lh-fade-out`, a mask on the scroll element only). The placeholder says whose turn it is: "Write your answer", "Ask something else", or "Write ahead while the tutor writes".
- **Writing looks like writing.** In place of the spinner and "Thinking…", a pen stroke draws itself over a faint trace beside "Writing…" (`TutorWriting`), and everything above the learner's current line steps back to 65 % (body text still passes 4.5:1) until the turn ends (`.lh-recede`, full again on hover). A reply that streams in pieces ends in a short teal pen stroke (`.lh-writing`). All of it is still under reduced motion.
- No rule between the tutor's steps in a chat; the replies under the text are the app's quiet buttons.
- Lessons and practice sessions are unchanged.

### E86. The ear gym is a task screen like the others, and length is drawn one way (2026-11-09, branch `feat/rhythmic-law-suprasegmentals`)

**Why:** the owner asked for the ear gym, the rhythm page and the sound notes on the Speak end screen to "feel better and match our app's feel". They had their own card, pills and buttons in raw Tailwind colors, all-caps labels, and a default "ear-first" mode that hid both answers, so a trial could only be guessed (review of 2026-11-09).

**How to apply:**
- **One task language.** `/phonology` uses `TaskFrame`, `TaskTop`, `PracticeCard`, `OptionTile`, `Dock` and `TaskEnd` (`components/task-frame.tsx`), the same play and Slowly buttons as Listen, and the same keys (1 and 2 pick, Space plays again, Enter continues, Escape leaves). A round is ten trials (`earGymRound`, `src/core/phonology.ts`) with a progress bar and an end screen that lists the missed pairs with both words to play. A round is not saved and earns no XP, and the end screen says so.
- **Both words are always shown, in the same order** (the pair's first word left, its second right), and the word played is picked at random. There is no mode that hides the answers. "I can't tell" counts as a miss.
- **No empty band, no second row of buttons.** After an answer the two tiles play their own word (a tap, or 1 and 2) and show the sound in brackets; the line under them changes from the hint to the cue. The card keeps one height before and after an answer, so it sits a little above the middle of the screen (two parts of space above, three below), not at the top with a gap under it. The owner, on the first version, which kept an empty band in the card for what came after the answer: "this spacing feels so odd, like all the whitespace".
- **A task screen with a second view** puts a segmented switch (`.q-segc`) in the top band, right after the exit (`TaskBar`, or `TaskTop`'s `lead`). The rhythm page is that second view; it is a page to read and try, with section rules (`.q-sh`), not cards.
- **Length is drawn one way:** a bar under a long syllable, a dot under a short one, the label under it naming the vowel that makes it long ("long ie"). The mark's color means length only (teal long, grey short). Two long syllables that clash get a red × between their bars and red letters; an allowed exception keeps ink letters and a grey verdict.
- **Blind-read before shipping.** The length marks were shown without explanation to a fresh Claude and to Gemini 3.8 Flash; both read the rule correctly, and their misreadings (color meant two things, "long" was not tied to a vowel, the gap read as a space, an exception looked like a rule-follower) led to the four choices above.
- **Fixed after the review (2026-11-09).** The pair file holds only true minimal pairs that sound different (27, checked one by one; pairs that sound the same at the end of a word and pairs that differed in two sounds are gone), and a contrast is named by its letters ("t and ť"), a cue in plain words. A plain `t` no longer gets the note for `ť`. A trial is played in one of two voices. The checker treats `ô` and a word-final `ou` as one vowel, `ch`, `dz` and `dž` as one consonant, allows verbs in -ia after a long syllable (*chvália*, *slúžia*), puts the stress on a one-syllable preposition (*ˈna sto-le*), explains in plain words, and shows the form the rule gives (*krásný* → *krásny*). The claim about stress deafness (Dupoux) was backwards and is corrected in the note, the sources and the research file.
- **Still open:** no pair for `l` and `ĺ` (none is known); the checker's other exceptions are a short list, and it cannot tell loanwords or compounds; nobody has listened to the 27 pairs in both voices. The page showing Slovak pairs whatever language is active is fixed in E87.

### E87. The ear gym follows the active language (2026-11-09, branch `feat/ear-gym-per-language`)

**Why:** `/phonology` loaded the Slovak pairs whatever language was active, so a learner of Russian saw Slovak words read by the Russian voice (E86, still open). The owner asked whether the ear gym existed for Russian, then: "Let's fix all of these issues." Russian is studied to understand speech, which is what the ear gym trains.

**How to apply:**
- **A language's pairs live in `curriculum/<language id>/phonology-pairs.json`:** its `families` (id and label, shown in the contrast menu after "All contrasts") and its `pairs`. `getPhonologyData(languageId)` (`src/core/phonology.ts`) returns the file or null; nothing falls back to another language. A new language is one file and one line in `BUNDLED_DATASETS`.
- **The page gets the language from the server** (`activeLanguage()` in `app/phonology/page.tsx`) and is keyed by it. Switching language reloads the page (`components/switch-language.ts`), so a round never mixes two languages.
- **No pairs, no round.** A language without a file gets the empty state "No pairs for <language> yet" with one button to Today. No word of another language is shown or played.
- **The Rhythm view is Slovak grammar** (`hasRhythmPage` in `src/core/rhythm.ts`); other languages have no switch in the top band.
- **Three kinds of pair never go in a file:** pairs that differ only in stress (*замок*: spelled the same, and the voice cannot be told which one to say), pairs that sound the same (*луг* and *лук*, *dub* and *dup*), and pairs that differ in more than one sound. The tests check that the two words and their two sound transcriptions differ, and that every family is declared and has at least three pairs.
- **A contrast is named by its letters** ("т and ть", "и and ы") and the cue is one or two plain sentences, as in E86. A form that is not the dictionary form says so in full words ("he ate (past tense of есть)"). Each example sentence holds the word in exactly that form (checked by script when the files were written).
- **Russian has 21 pairs:** ten for hard and soft consonants at the end of a word, six for и and ы, five for ш and щ. In the и and ы pairs the consonant before the vowel differs too (soft before и, hard before ы); the two cannot be separated in Russian, and the cue says so.
- **How it was made:** Gemini 3.8 Flash wrote the code and the Russian file from a brief; Claude read the whole diff. Corrected in review: language names and codes written into the screen as fallbacks, two unused aliases, a reset effect (the page key does it), two example sentences that held another form of the word, *щёлк* used as a noun, and cues full of phonetics terms.
- **Still open:** Estonian has no pairs yet (short and long sounds are spelled differently and would work; the second and third length are spelled the same and would not); Russian stress pairs need audio that can be told where the stress is; nobody has listened to the Russian pairs; the words were checked against Wiktionary by Gemini and read by Claude, not by a Russian speaker; the sound notes on the Speak end screen (`ARTICULATORY_CUES`) are still Slovak only.

### E88. In the ear gym the two words are the largest thing on the screen, and the letters that differ are marked (2026-11-09, branch `feat/ear-gym-per-language`)

**Why:** the owner, after E86 and E87: "Get more creative with it. Don't be afraid to change the layout entirely." A review of the screens (layout and polish) found three things: the two words, which are the task, were set smaller than the question above them; nothing showed where the two words differ, so the learner did not know what to listen for; and the progress bar said how many pairs were done, not which ones were heard right.

**How to apply:**
- **The pair is the stage.** Each answer is a large tile with its word at 40 px (28 px on a phone, where the two tiles sit one above the other), the meaning under it, and its key in the corner. The letters the contrast names are underlined in both words (`contrastSpans` in `src/core/phonology.ts`, tested over every pair of every language). The underline is grey before an answer, because teal and red mean right and wrong here and nowhere else.
- **The top band is the round.** Ten segments in place of one bar: filled teal for a pair heard right, a hollow red ring for a miss, pale teal for the pair on screen. A miss differs in shape as well as color. The same marks are the strip under the result on the end screen and the marks in its rows.
- **The play button shows that sound is playing:** the speaker turns into the waveform while the word plays and back when it ends; after an answer the speaker on a tile does the same. The two icons cross-fade in 200 ms, and not at all with reduced motion.
- **The end screen says what to train next.** Under the result, a row per contrast that came up in the round, the weakest first, with its marks and "2 of 4"; a row starts a round of that contrast. It is shown only after a round of all contrasts.
- **The rhythm page shows the result above the field,** like the display over the keys of a calculator: the syllables with their marks first, then the field, the example words, and the letter keys last. The result always carries one line of explanation, also for a word that follows the rule, and keeps one height on a desktop while you type. The list of forms has two column headings (short stem, long ending; long stem, short ending) in place of the same note under each of ten words; on a phone the note stays under each word.
- **Kept from E86:** the frame, the dock, the tokens, one height for the card before and after an answer, and the card a little above the middle.
- **Removed from the shared frame:** the `lead` slot of `TaskTop` and the `trail` of `OptionTile`, added in E86 for this screen and no longer used.
- **Not changed, on purpose:** the press scale stays the app's 0.97 (`.lh-press`); a reviewer's rule asks for 0.96, and the value is one token for the whole app.
## Dropped or deferred

- **Clozemaster integration (dropped 2026-10-28).** Its terms forbid automated access; the official CLI's MCP server only edits collections. The in-app Review deck is the replacement, and the aim is to be better than it.
- **Russian profile (closed 2026-11-05).** The built-in Russian profile, which shipped prompts and no words, is gone: Russian is added from the app like any other language, and keeps its hand-written tutor doctrine.
- **Folder rename** langharness-2 → langharness: wanted, deferred until the app can be closed.
- **Windows installer and sync:** not built; data is local only.
