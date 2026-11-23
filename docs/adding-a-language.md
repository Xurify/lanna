# Adding a language

Since 5 November 2026 a language is added from the app, not in code. In the sidebar, open the language menu, choose **Add a language…**, pick one, and press **Add**. The work runs in the background: the sidebar's Background section and the Tasks page (`/tasks`) show each step, and a card says when it is ready, with a button to switch to it. The Tasks page keeps the finished add with the same switch or try-again button.

## What the app builds

Everything lands in `<data>/languages/<id>/`, shared by every profile. The steps, in order, each kept under `build/` so a failed or stopped add continues where it ended:

| Step | Source | Kept in |
| --- | --- | --- |
| Example sentences with English translations | Tatoeba per-language exports (CC BY 2.0 FR), bzip2 | `build/sentences.json` |
| Which words are common | FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0); a language it lacks would be ranked from its Tatoeba sentences | `build/frequency.json` |
| Words, glosses, gender, inflected forms | Wiktionary as extracted by kaikki.org (CC BY-SA 4.0), streamed with gzip and filtered line by line | `build/words.json` |
| The word list (about 3,000 lemmas) | the three above | `lexicon.json` |
| The tutor's language segment | a template, no model | `prompt.md` |
| The course: grammar lessons, word themes, tutor sessions, goals, chapters | one call on the Strong slot (the Cheap one when no Strong is set), checked against the dictionary, asked once more if it fails | `course.json`, cost in `build/course-draft.json` |
| The story bible: series, city, cast, places, a beat per chapter, Read settings, Speak scenes | one more call on the same slot, checked | `world.json`, cost in `build/world-draft.json` |
| The skill map | derived from the course: one node per grammar lesson, chained in teaching order | `seed.json` |
| The language itself (tag, names, voices, letters) | the catalog in `src/core/language.ts` | `language.json`, written last |

The word list is the commonest lemmas first, plus the words a written course's themes name. Each lemma keeps its first five sentences, then up to 24, with one or two for each form it lacks.

`language.json` is what makes the language appear in the menu, so a half-built folder is never offered as a profile. Measured on 5 November 2026: Czech took 12 seconds (2,823 of 3,000 words with sentences), Russian 29 seconds (2,972 of 3,000); peak memory of the process was about 550 MB for Russian.

## The rules for words

The rules are in `src/core/language-build.ts` and pinned by `tests/language-add.test.ts`:

- Sentences come only from Tatoeba (E27). A model never writes one.
- A word keeps its first five sentences in the order they arrived (a review card points at one by its place), then gets sentences for the forms those lack: a case is drilled only through sentences that hold it.
- A spelling written with a capital inside sentences more often than without is a name (Russian "Тома", Tom), not the common word that shares it (том, a volume).
- A noun spelled like an adjective in every form (Russian красный, "a Red") is that adjective; kept apart, neither would rank. A word with ё ranks by the е spelling subtitles use.
- A form is blanked only when one word owns it. When several do, the word whose dictionary form it is wins ("prosím" is "please" before it is a form of prosit), and the commoner one when two share that spelling. This is the homograph guard of E28.
- Forms come from Wiktionary's inflection tables only. Dated and pre-reform forms (кошкѣ), romanizations, rare forms and related words (diminutives, aspect partners) are left out.
- Entries that do not inflect and share a spelling ("co" as pronoun, conjunction and particle) become one row. A noun, verb or adjective that shares its spelling with a common word ranks by its own other forms ("jak", the yak, does not ride on "jak", how).
- Letter names ("the name of the Cyrillic letter Я") and proper names are not words.

## Which languages

The catalog is `LANGUAGE_CATALOG` in `src/core/language.ts`: seven languages for now (Bulgarian, Czech, Estonian, Norwegian, Polish, Romanian and Russian), each with its Tatoeba code, its kaikki.org name, its FrequencyWords code and two Edge voices. All four sources were checked to exist on 5 November 2026. To add one to the catalog, add a row and check the same four things.

Russian is an added language like the others. Its tutor doctrine is hand-written (`src/agent/prompts/language/10-russian.md`) and replaces the template prompt once Russian is added.

## The generated course

The dialog asks who builds the course and shows the price of each choice before anything is spent:

- **The Strong or the Cheap model** writes it (two calls). The price is the median of earlier calls on that same model and thinking level, or a first guess the dialog labels as one. Each call is capped (room for the answer plus twice the thinking the level allows, at least twice the longest answer that model has given, never past the model's limit); an answer cut at its cap is asked again with twice the room, so the most is known before it starts.
- **From the dictionary only** builds it for free and in seconds (`src/core/course-procedural.ts`): a lesson per common grammar cell (cases by number, verb forms by tense and person), its rule a template with a real sentence as the example, a case's prepositions found from the sentences. No word themes, general tutor sessions, no story world. Czech gave 13 lessons in 7 chapters, Estonian 17 in 9.

- **Grammar lessons select real sentences by their form's tags.** Wiktionary labels each form ("kávu": accusative singular). A lesson names the tags it drills and, when the rule depends on it, the words that come right before the blank (a preposition). A sentence counts when its blank carries every tag. With no trigger word, the form must mean only that (Czech "kávě" is dative or locative, so it needs "v" or "na" before it to count as a locative). A dictionary form never counts as a case form ("Dobrý den" is not an accusative). The model never writes a sentence (E27).
- **What the model writes is checked** against the language's own dictionary (`checkCourse`, `checkWorld` in `src/core/course.ts`): a tag the dictionary does not use, a word theme whose words are not in it, a lesson with fewer than 12 sentences, a chapter that does not end on a goal are dropped. When too little is left, the model is asked once more; a second failure ends the task with "Try again", which keeps the downloads.
- **The course runs the whole app.** The server reads `course.json` at start (`config.ts`), the browser gets the same course before the page loads (`app/layout.tsx`), and the lesson units, the map, the chapters and the placement tiers are the course's (`src/core/lesson.ts`, `curriculum.ts`, `onboarding.ts`). First words and the frequency bands come with every course.
- **A written course wins.** Estonian and Russian ship theirs in `curriculum/<id>/` (`course.json`, `world.json`, rule E80). Adding them makes no model call for the course or the story world; the dialog says so. `npx tsx scripts/check-course.ts <id>` runs a written course against a language's dictionary, and `npx tsx scripts/rebuild-lexicon.ts <id>` builds an added language's word list again from its kept downloads.
- **Grammar page:** every course gets a case table (its cases down the side, singular and plural across), from the course's `cases` or from the cases its drills cover. The Dvojičky pairs and the aspect tasks are Slovak content. Parallels from the learner's languages exist only in the Slovak lessons.
- A folder without `course.json` (a language added before courses were generated) is not listed as a language; adding it again builds the course from the kept downloads.

## Removing a language

In Settings → Learning, press the bin next to an added language. Its words, sentences and grammar map (`<data>/languages/<id>/`) are deleted. The learner's progress in it (`<data>/profiles/<id>/`) stays, so adding it again picks up where they were. The running language cannot be removed; switch first.

## Where the code is

- `src/core/language.ts`: the built-in languages, the catalog, and the run-time registry for added ones.
- `config.ts`: `languageProfiles()` lists built-in and added profiles; `curriculumFile(profile, name)` finds a language's file, the shipped copy first.
- `src/server/active-language.ts`: which language the running profile is.
- `src/server/language-add.ts`: the background task.
- `app/api/languages/route.ts`: the catalog and the start.
- `components/add-language-dialog.tsx`, `components/task-notice.tsx`, `components/activity-dock.tsx`: the dialog, the ready card, the Background row.
