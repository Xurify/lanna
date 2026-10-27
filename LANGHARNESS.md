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
| Audio | Any Slovak in a tutor reply written as `` `say: Dobrý deň` `` gets a play button. Speech tries ElevenLabs, then Microsoft Edge voices, then Piper, then the browser's own voice. Clips are cached in `data/cache/audio/`. Speed is 0.75×, 1× or 1.25×. |
| Letter bar | One click types á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž into whichever field you used last. Shift types the capital. It folds away. |
| Spaced review | The **Review** page in the sidebar is a Clozemaster-style deck: a real Tatoeba sentence with one word blanked, typed or multiple choice, scheduled with FSRS-5. Missing only accents counts as Hard, not wrong. New words come in frequency order, beginner words first, 10 a day by default. The tutor can add words from a lesson to the deck (`add_to_review`) and see how the deck is going (`review_status`). |

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

`tests/langharness.test.ts` covers answer comparison, FSRS-5, the lexicon,
cloze cards, seed integrity (no cycles), prompt composition and the review
service. The full suite passes except one Pi loader test that also fails
on untouched upstream under Node 22.
