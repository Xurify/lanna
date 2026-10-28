# LangHarness decisions

The product principles and working rules behind LangHarness, with the date each was set and why. Newest rules win where two conflict. A future session should read this before changing how a task teaches, where data goes, or how work reaches the repo.

Companion documents: [learner.md](learner.md) (who this is built for), [research/README.md](research/README.md) (the evidence), [CHANGELOG-2026-10.md](CHANGELOG-2026-10.md) (what was built when).

## Product principles

### P1. Effective, not a clone (2026-10-27)

Xurify: "I don't want you to make this just like every other language learning app. I want to make something effective. You should conduct research on language learning in general so that you understand and also look through my chats and see if you can find any pain points."

**Why:** the first redesign copied the Duolingo shape (streaks, XP, tiles). That made the app feel like a language app, but the research pass that followed showed form-focused drilling was taking three quarters of the planned minutes.

**How to apply:** every new task starts from a research note in `docs/research/` and from the learner's own evidence (lesson log, chats), not from what another app does. Gamification stays where it costs nothing (XP, streaks), never where it changes what is practised.

### P2. Four strands, not pure comprehensible input (2026-10-28)

Nation's four strands: meaning-focused input, meaning-focused output, language-focused learning, fluency, about a quarter of the time each. Research note: [research/comprehensible-input.md](research/comprehensible-input.md).

**Why:** Xurify reads at B1 but produces A1 to A2 endings. That is the documented failure mode of pure input (the Swain immersion finding), so the app keeps explicit instruction and output. Before this rule the app was about 76% form-focused, 12% input, 12% output, 0% fluency.

**How to apply:** the daily plan keeps one task per strand (Review, Lesson, Listen or Watch, Speak, Read) before any second drill. The strand balance under the daily plan shows this week's minutes against a quarter each. Input tasks stay easy at the word level (93% to 98% known words); difficulty lives in output and study.

### P3. Desirable difficulty: learning must be hard (2026-10-28 03:44Z)

Xurify: "things should be hard and the user should face struggle because that is where the learning happens... even though people like to think they can speedrun." Research note: [research/desirable-difficulties.md](research/desirable-difficulties.md).

**How to apply:** every rep is retrieval first. Help is allowed but graded, visible and priced in XP or rating, never free. Recognition only to meet a form; production to prove it. Difficulty rises with mastery (a completed unit is practised production-only with the meaning hidden). Concretely: first miss shows the smallest cue only, rule and bridges open after the second miss; a missed choice retries typed; Review hints cap the rating; Listen shows the text only after a second listen and a peeked sentence does not count as understood; Watch shows the meaning only after the Slovak text.

### P4. Meet a form in a sentence before being tested on it (2026-10-28)

A new unit's first lesson opens with two "What does it mean?" reps (sentence spoken, target form marked, pick the meaning from three) before any production.

**Why:** input before output, from the same research note as P2.

### P5. Answer first, reasoning optional (2026-10-27)

Every practice and story session Xurify ran was abandoned at a field labelled "Your thinking". Confidence sliders were left at the default 18 of 24 times.

**How to apply:** one tap or one number key answers; confidence and thinking sit behind "Explain my reasoning". Short loops, show evidence (Xurify asked "why do you think I am at B1?" and wanted the sentences, not a verdict).

### P6. Bridges from every language the learner knows (2026-10-26, widened 2026-10-28)

The original spec locked Estonian as the bridge language (Estonian cases make Slavic morphology intuitive). Xurify later asked for every language they know, not only Estonian, and for up to two explanation languages: "the more I see the language(s) the more I can learn."

**How to apply:** every grammar unit carries bridge lines for the learner's known languages, best-known first. The tutor explains in the first explanation language and adds the key line and grammar terms in the second, never a full second copy. A language known at A1 or A2 gets short lines only.

### P7. Measure cheaply, spend the model on the edge (2026-10-28)

Xurify found goal and level discovery through tutor chats "ancient and inefficient", but is fine with AI used precisely and Socratically to understand their understanding: "I just don't want wasteful chat."

**How to apply:** setup is four screens with no model call; the tutor gets a "This learner" block and probes only shaky strands with one to three Socratic questions. The level check is being rebuilt the same way (cheap drill first, model judges non-matching typed answers, then an adaptive Socratic stage); see [research/level-assessment-audit.md](research/level-assessment-audit.md).

### P8. Honest numbers (2026-10-27 onward)

Estimates say what they assume: the hours sheet names its sources and the head start it credits; the milestones page labels an assumed speed as assumed; the placement result shows the sentences as evidence. Do not overstate dictionary accuracy either (4 words hand-checked against JÚĽŠ, 2,958 rule-generated and verified, the rest unknown).

## Engineering rules

### E1. Save every generated artifact to `data/` in open formats (2026-10-27)

Xurify: "if I have all this data I could use it to build a language learning app and I can save at least some money by not having to regenerate everything again." They asked for it "extremely organized, even overly organized and easy to find."

**How to apply:** any new AI or TTS feature caches to `data/` before calling an API and reuses on a repeat. Audio library with an index, lesson log per day, Why? index, stories, videos, speak sessions with recordings, fluency log, milestones. A README next to every data folder, and `npm run corpus:export` for a snapshot. Deleted chats move to `chats/trash/` instead of being unlinked. Details: [corpus.md](corpus.md).

### E2. Cheap and Strong model slots (2026-10-27)

Xurify: "'Why?' and stuff like that should use 'Cheap' though, no?"

**How to apply:** Why?, Talk, Story, Practice, Read episodes, Speak scenes, Watch translations and custom milestones run on the Cheap slot. Learn (teaching) stays on Strong. Cheap falls back to Strong if empty. Lessons, Blitz, Review, Listen and Fluency are local and cost nothing. Prompts were condensed (practice composition 37k to 24k chars); the doctrine paragraphs are pinned by tests, keep them verbatim. Spending is visible at Settings → Spending, priced from each chat's `turns` log at read time.

### E3. Unit completion rule (2026-10-27)

A unit is done after 3 lessons at 80% or better, or after 6 lessons. One lesson at 95% or better tests out. Tutor units need 2 sessions.

**Why:** Xurify asked "when does a lesson ever get completed?" and the answer was nowhere in the UI.

### E4. Custom UI, no native widgets, no layout shift (2026-10-27)

Xurify: "custom UI, not default HTML"; "make sure there are no CLS issues or FOUC issues. The content should load quickly and fast."

**How to apply:** no native `<select>`; chips, steppers and searchable panels instead. Sidebar state lives in a cookie, appearance variables are server-rendered on `<html>`, the Today summary is SSR'd. Xurify reviews screenshots closely: run every state at both window sizes (about 1400×890 and 1133×700, or 1280 and 390 px wide) before calling a UI pass done. They want Duolingo-like structure and alignment and find unlabelled prose lines "odd and unstructured": label the chips.

### E5. Keep API keys out of chat (2026-10-26)

Keys go in `.env` or Windows environment variables, never in a thread. Each key only goes to its own service and is never logged in full.

### E6. Tests never touch the real profile (2026-10-28)

A full test run on the PC once wrote fixture chats into Xurify's real session list and ran a paid Opus placement turn. Under `NODE_ENV=test` with no `LH_DATA_DIR`, data goes to a temp folder. Always test in the cloud copy with `LH_DATA_DIR` pointed at scratch. Run with `NODE_ENV=test npx tsx --test tests/<file>.test.ts`. A few tests fail on main in the cloud regardless of changes (desktop payload trace, pi-ai package exports, one Pi loader test under Node 22); they are environment-bound, not regressions.

### E7. Local only, no sync (2026-10-26)

Data lives in `data/` next to the app and is gitignored. The Electron app and `npm run dev` share it. No installer yet; the app runs with `bun run desktop:dev` on port 3010 (port 3000 belongs to another project of Xurify's).

## Working rules (how work reaches the repo)

### W1. Take over, do not ask (2026-10-27, repeated 2026-10-28 01:21Z)

Xurify: "Take over and stop asking me for confirmation on this and that. You are smart enough to understand what I want. Only come back once you have built or done the thing and you want me to verify."

**How to apply:** pick the recommended option, build it, verify it in the live app, deploy, then send one short report with screenshots. The only exceptions are things impossible from the cloud (creating a GitHub repo, approving a device card). Note that `AGENTS.md` carries the upstream "No guessing, always ask" rule; for LangHarness Xurify's standing rule overrides it.

### W2. Descriptive branch names, no merging to main (2026-10-28 04:00Z)

Xurify: "Stop making random branch names. They should be based on the context. Also stop auto merging until we are ready."

**How to apply:** branches are named after the work (`feat/desirable-difficulty`, `setup/cefr-language-levels`, `docs/project-learnings`). Open the PR, assign Xurify, request their review, deploy the branch to the PC for verification, and stop. Xurify merges. PRs #1 to #5 were merged before this rule; #5 landed minutes before it and Xurify may ask for a revert.

### W3. Deploying to the PC

The code lives at `C:\Users\Stream\Projects\langharness-2` (rename to `langharness` deferred by Xurify; it needs the app closed). The dev server hot-reloads, so a deploy is a `git fetch` plus checkout of the PR branch on a clean tree, done from a Remote Control session (the device shell cannot reach GitHub, delete files, or commit). A dev server started by a Remote Control session dies with it; restart it afterwards. GitHub Actions never runs on this repo (owner-side setting), so red CI there is not a code failure.

### W4. Research notes live in the repo (2026-10-28)

Xurify on the comprehensible-input write-up: "This is a great writeup", and asked for it to be saved. Every research pass goes to `docs/research/` in Markdown with its sources, and the index in [research/README.md](research/README.md) is updated.

## Dropped or deferred

- **Clozemaster integration (dropped 2026-10-28 01:17Z).** Its terms forbid automated access; the official CLI's MCP server only edits collections. Xurify: "Nevermind the Clozemaster thing if we don't need it and we can make our app better than it." The Review deck is the in-app replacement.
- **Russian profile.** Prompts and a profile exist; no lexicon, seed or review deck. Not started.
- **Folder rename** langharness-2 → langharness: wanted, deferred until the app can be closed.
- **Windows installer and sync:** not built; data is local only.
