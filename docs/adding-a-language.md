# Adding a language

Since 5 November 2026 a language is added from the app, not in code. In the sidebar, open the language menu, choose **Add a language…**, pick one, and press **Add**. The work runs in the background: the sidebar's Background section shows each step, and a card says when it is ready, with a button to switch to it.

## What the app builds

Everything lands in `<data>/languages/<id>/`, shared by every profile. The steps, in order, each kept under `build/` so a failed or stopped add continues where it ended:

| Step | Source | Kept in |
|---|---|---|
| Example sentences with English translations | Tatoeba per-language exports (CC BY 2.0 FR), bzip2 | `build/sentences.json` |
| Which words are common | FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0); for Irish and Welsh, which it lacks, counts from the Tatoeba sentences | `build/frequency.json` |
| Words, glosses, gender, inflected forms | Wiktionary as extracted by kaikki.org (CC BY-SA 4.0), streamed with gzip and filtered line by line | `build/words.json` |
| The word list (about 3,000 lemmas, commonest first, each with up to five sentences blanked at a form) | the three above | `lexicon.json` |
| The tutor's language segment | a template, no model | `prompt.md` |
| A grammar map for the skill map | one Cheap-slot call, only when a model is set; checked before it is kept | `seed.json`, cost in `build/seed-draft.json` |
| The language itself (tag, names, voices, letters) | the catalog in `src/core/language.ts` | `language.json`, written last |

`language.json` is what makes the language appear in the menu, so a half-built folder is never offered as a profile. Measured on 5 November 2026: Czech took 12 seconds (2,823 of 3,000 words with sentences), Russian 29 seconds (2,972 of 3,000); peak memory of the process was about 550 MB for Russian.

## The rules for words

The rules are in `src/core/language-build.ts` and pinned by `tests/language-add.test.ts`:

- Sentences come only from Tatoeba (E27). A model never writes one.
- A form is blanked only when one word owns it. When several do, the word whose dictionary form it is wins ("prosím" is "please" before it is a form of prosit), and the commoner one when two share that spelling. This is the homograph guard of E28.
- Forms come from Wiktionary's inflection tables only. Dated and pre-reform forms (кошкѣ), romanizations, rare forms and related words (diminutives, aspect partners) are left out.
- Entries that do not inflect and share a spelling ("co" as pronoun, conjunction and particle) become one row. A noun, verb or adjective that shares its spelling with a common word ranks by its own other forms ("jak", the yak, does not ride on "jak", how).
- Letter names ("the name of the Cyrillic letter Я") and proper names are not words.

## Which languages

The catalog is `LANGUAGE_CATALOG` in `src/core/language.ts`: 32 languages, each with its Tatoeba code, its kaikki.org name, its FrequencyWords code and two Edge voices. All four sources were checked to exist on 5 November 2026. To add one to the catalog, add a row and check the same four things.

Russian is in the catalog although its profile is built in: the profile has its prompt but ships no words, so adding it downloads them into `<data>/languages/russian/`.

## What works in an added language

- Review, Words and the tutor work: they read the lexicon and the language segment.
- Lessons and the curriculum path are built for Slovak (`src/core/lesson.ts`).
- Read, Watch, Speak, the placement check and the custom milestones still have Slovak written into their model prompts, so they produce Slovak. Making them follow the active language is the next step.

## Where the code is

- `src/core/language.ts`: the built-in languages, the catalog, and the run-time registry for added ones.
- `config.ts`: `languageProfiles()` lists built-in and added profiles; `curriculumFile(profile, name)` finds a language's file, the shipped copy first.
- `src/server/active-language.ts`: which language the running profile is.
- `src/server/language-add.ts`: the background task.
- `app/api/languages/route.ts`: the catalog and the start.
- `components/add-language-dialog.tsx`, `components/task-notice.tsx`, `components/activity-dock.tsx`: the dialog, the ready card, the Background row.
