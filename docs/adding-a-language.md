# Adding a language

Since 5 November 2026 a language is added from the app, not in code. In the sidebar, open the language menu, choose **Add a language…**, pick one, and press **Add**. The work runs in the background: the sidebar's Background section and the Tasks page (`/tasks`) show each step, and a card says when it is ready, with a button to switch to it. The Tasks page keeps the finished add with the same switch or try-again button.

## What the app builds

Everything lands in `<data>/languages/<id>/`, shared by every profile. The steps, in order, each kept under `build/` so a failed or stopped add continues where it ended:

| Step | Source | Kept in |
|---|---|---|
| Example sentences with English translations | Tatoeba per-language exports (CC BY 2.0 FR), bzip2 | `build/sentences.json` |
| Which words are common | FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0); a language it lacks would be ranked from its Tatoeba sentences | `build/frequency.json` |
| Words, glosses, gender, inflected forms | Wiktionary as extracted by kaikki.org (CC BY-SA 4.0), streamed with gzip and filtered line by line | `build/words.json` |
| The word list (about 3,000 lemmas, commonest first, each with up to five sentences blanked at a form) | the three above | `lexicon.json` |
| The tutor's language segment | a template, no model | `prompt.md` |
| The course: grammar lessons, word themes, tutor sessions, goals, chapters | one call on the Strong slot (the Cheap one when no Strong is set), checked against the dictionary, asked once more if it fails | `course.json`, cost in `build/course-draft.json` |
| The story bible: series, city, cast, places, a beat per chapter, Read settings, Speak scenes | one more call on the same slot, checked | `world.json`, cost in `build/world-draft.json` |
| The skill map | derived from the course: one node per grammar lesson, chained in teaching order | `seed.json` |
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

The catalog is `LANGUAGE_CATALOG` in `src/core/language.ts`: seven languages for now (Bulgarian, Czech, Estonian, Norwegian, Polish, Romanian and Russian), each with its Tatoeba code, its kaikki.org name, its FrequencyWords code and two Edge voices. All four sources were checked to exist on 5 November 2026. To add one to the catalog, add a row and check the same four things.

Russian is in the catalog although its profile is built in: the profile has its prompt but ships no words, so adding it downloads them into `<data>/languages/russian/`.

## The generated course

Adding a language needs a model: without one there is no course, so the add does not start and the dialog says why.

- **Grammar lessons select real sentences by their form's tags.** Wiktionary labels each form ("kávu": accusative singular). A lesson names the tags it drills and, when the rule depends on it, the words that come right before the blank (a preposition). A sentence counts when its blank carries every tag. With no trigger word, the form must mean only that (Czech "kávě" is dative or locative, so it needs "v" or "na" before it to count as a locative). A dictionary form never counts as a case form ("Dobrý den" is not an accusative). The model never writes a sentence (E27).
- **What the model writes is checked** against the language's own dictionary (`checkCourse`, `checkWorld` in `src/core/course.ts`): a tag the dictionary does not use, a word theme whose words are not in it, a lesson with fewer than 12 sentences, a chapter that does not end on a goal are dropped. When too little is left, the model is asked once more; a second failure ends the task with "Try again", which keeps the downloads.
- **The course runs the whole app.** The server reads `course.json` at start (`config.ts`), the browser gets the same course before the page loads (`app/layout.tsx`), and the lesson units, the map, the chapters and the placement tiers are the course's (`src/core/lesson.ts`, `curriculum.ts`, `onboarding.ts`). First words and the frequency bands come with every course.
- **Not generated:** the grammar atlas (a Slovak case × gender table), the Dvojičky pairs and the aspect tasks are Slovak content. Parallels from the learner's languages exist only in the Slovak lessons.
- A language added before courses were generated shows "Needs its course" in the dialog; **Finish** builds it from the kept downloads. The running language picks up its new course on a restart.

## Removing a language

In the language menu, hover an added language and press the bin. Its words, sentences and grammar map (`<data>/languages/<id>/`) are deleted. The learner's progress in it (`<data>/profiles/<id>/`) stays, so adding it again picks up where they were. The running language cannot be removed; switch first.

## Where the code is

- `src/core/language.ts`: the built-in languages, the catalog, and the run-time registry for added ones.
- `config.ts`: `languageProfiles()` lists built-in and added profiles; `curriculumFile(profile, name)` finds a language's file, the shipped copy first.
- `src/server/active-language.ts`: which language the running profile is.
- `src/server/language-add.ts`: the background task.
- `app/api/languages/route.ts`: the catalog and the start.
- `components/add-language-dialog.tsx`, `components/task-notice.tsx`, `components/activity-dock.tsx`: the dialog, the ready card, the Background row.
