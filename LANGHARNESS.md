# LangHarness

A fork of LearnHarness 0.3.8 for learning Slovak (and later Russian) from
English and Estonian. Built on branch `slovak` from the plan in
`wayfinder-slovak-harness-spec.md`.

## What it adds

| Area | What you get |
|---|---|
| Language profiles | Slovak and Russian. Each keeps its own sessions, graph and review deck under `data/profiles/<language>/`. Switch with the toggle at the top of the sidebar. The desktop app restarts itself; under `npm run dev`, restart the server. |
| Seeded grammar graph | A fresh Slovak profile starts with 53 grammar nodes (phonetics, cases, verbs, aspect, word order…) and 40 vocabulary clusters, linked by 57 prerequisite chains. Every grammar node carries an Estonian bridge. Seeding runs once; nodes you delete stay deleted. |
| Prompts | `src/agent/prompts/language/10-<language>.md` joins every agent's prompt. It covers the English and Estonian bridges (with where each breaks), adaptive immersion, grading diacritic slips apart from grammar, Russian false friends, and the `lookup_word` rule. Prober, teacher and practice each get a language fragment too. Edit them all in Settings → Prompts. |
| Dictionary-checked forms | `lookup_word` searches the 7,074-word Slovak lexicon exported from slovak.wiki, by form, by unaccented spelling, or by English gloss. The tutor is told to look a word up before it states a form. |
| Audio | Any Slovak in a tutor reply written as `` `say: Dobrý deň` `` gets a play button. Speech tries ElevenLabs, then Microsoft Edge voices, then Piper, then the browser's own voice. Every clip is kept in `data/audio/<lang>/<voice>/<text-slug>-<key>.mp3` and listed in `data/audio/index.jsonl`, so a sentence is paid for once. Speed is 0.75×, 1× or 1.25×. |
| Letter bar | One click types á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž into whichever field you used last. Shift types the capital. It folds away. |
| Spaced review | The **Review** page in the sidebar is a Clozemaster-style deck: a real Tatoeba sentence with one word blanked, typed or multiple choice, scheduled with FSRS-5. Missing only accents counts as Hard, not wrong. New words come in frequency order, beginner words first, 10 a day by default. The tutor can add words from a lesson to the deck (`add_to_review`) and see how the deck is going (`review_status`). |

## The redesign (October 2026)

Built after a UX audit of a real 70-minute session, which spent 23 minutes
on placement, 37 minutes waiting at the plan approval and 9 minutes teaching.

| Area | What changed |
|---|---|
| Today (`/`) | The home screen. It shows a greeting, your streak and XP, one Continue button for the next unit, a daily goal ring, a week strip, and tiles for Review, Blitz, Talk and Story. A skill path of 10 units runs down the side. The old graph home moved to `/map`. |
| Lessons (`/lesson?unit=`) | A full-screen lesson of 12 reps built from the lexicon on the spot, so no rep waits on a model. Reps mix choose (keys 1–4), type, build the sentence, and listen. Each answer gets green, amber or red feedback with the rule and a Why? button that asks the tutor. Combos, sounds, confetti and XP. Missed words go into the review deck. |
| Blitz (`/lesson?mode=blitz`) | 60 seconds of choose reps across the units you have started, with a best score. |
| Progress | `data/profiles/<language>/progress.json` holds XP, days, unit levels and the streak. One rest day is forgiven after six active days. |
| Review | A single Continue button takes the suggested rating (Enter). The four ratings stay as a quiet override row. Reviews earn XP. |
| Tutor chat | Agent machinery (file reads, map lookups, reasoning) is hidden behind a Working toggle. Answers are one tap or one number key; confidence and thinking sit behind "Explain my reasoning". Placement is capped at about 5 questions, a question you write in the thinking field gets answered first, and teaching starts without a plan approval. |
| Talk and Story | Talk opens a role-play in Slovak (6 scenes) with corrections only when you write `koniec`. Story tells a short Robo episode, then poses three problems. |

Originals of every file the redesign changed are in
`_backup-before-redesign/` in the PC folder. The full diff is
`redesign.patch` next to this file.

| Your data, kept | Everything the app generates or you produce stays on disk in open formats, with a README in every folder: `data/README.md` is the map. Tutor chats (with token usage per turn) in `data/profiles/<language>/chats/` (deleted ones move to `chats/trash/`), every finished lesson with every answer in `lessons/<day>.jsonl`, a repeat "Why?" reopens its earlier chat (`lessons/why-index.json`), the review deck and its answer log in `review/`. `npm run corpus:export` writes a clean, app-independent snapshot to `data/export/<stamp>/` (sentences, lessons, dialogues, explanations, audio catalog, review history, usage summary). |

## Run it

```
npm install
npm run dev          # http://localhost:3010
```

Add a model key in Settings → Keys as in LearnHarness.

Optional speech keys (Settings → Keys → Speech, or `.env.local`):

- `ELEVENLABS_API_KEY`: the best voice. Change it with `ELEVENLABS_VOICE_ID_SK` or `ELEVENLABS_VOICE_ID`.
- Edge voices need no key, only internet.
- Piper works offline: set `PIPER_PATH` to the binary and `PIPER_MODEL_SK` to a Slovak `.onnx` voice.

On Windows, `npm test` and `npm run desktop:dev` use Unix-style env syntax
inherited from upstream. Run them from Git Bash, or once run
`npm config set script-shell "C:\Program Files\Git\bin\bash.exe"`.

## Refresh the curriculum

```
npm run lexicon:export   # reads ../slovak.wiki, writes curriculum/slovak/lexicon.json
npm run seed:build       # curriculum/slovak/seed-source.json → seed.json
```

The seed source is hand-written. Edit nodes, chains, clusters or goals
there, then rebuild. An existing profile is not re-seeded. To start
fresh, delete `data/profiles/slovak/`.

## Limits worth knowing

- Only 4 words (from slovak.wiki's hand-checked set) have full declension tables checked against JÚĽŠ. 2,958 more have rule-generated form sets that slovak.wiki verified. For the rest, `lookup_word` says plainly that the form is not in the dictionary.
- Russian has prompts and a profile, but no lexicon, seed or review deck yet.
- Edge speech could not be tested in the build sandbox (no network there). The fallback to the next tier was tested.
- Example sentences come from Tatoeba (CC BY 2.0 FR). The review page credits them.

## Tests

`tests/lesson.test.ts` covers the lesson builder, XP and streaks. `tests/corpus.test.ts` covers the audio library, the lesson log, Why? reuse, chat trash and the export. `tests/langharness.test.ts` covers answer comparison, FSRS-5, the lexicon,
cloze cards, seed integrity (no cycles), prompt composition and the review
service. The full suite passes except one Pi loader test that also fails
on untouched upstream under Node 22.
