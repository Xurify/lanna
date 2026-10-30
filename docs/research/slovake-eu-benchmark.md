# slovake.eu: what a free course does that we don't

Date: 2026-10-30. Question: what should LangHarness copy from the structure of slovake.eu's course, and what should it leave alone? Rule W4 in [../DECISIONS.md](../DECISIONS.md): sources are listed here, and the index in [README.md](README.md) is updated.

## Sources and method

Read on 2026-10-30, all public pages:

- Course list: https://slovake.eu/courses
- Chapter and step lists: https://slovake.eu/courses/a1, /a2, /b1, /b2
- Grammar: https://slovake.eu/grammar, /grammar/classes/cases, /grammar/classes/verbs, /grammar/pronunciation/rhythm
- Introduction: https://slovake.eu/intro, /intro/language/how_to_learn
- Background: https://slovake.eu/about

Not read: the lesson pages. https://slovake.eu/courses/a2/2/4 returns a login page. No account was created, so exercises are described only by their step titles. The exercise types in the first analysis (dialogue, drag and drop, matching, dictation) were not checked on the site and are not claimed here.

Counts come from the course pages above. Each step shows a counter such as "0 / 40". The page does not say what it counts, so this note doesn't interpret it.

## What the course is

- Partners include Comenius University in Bratislava and the JÚĽŠ institute of the Slovak Academy of Sciences. Supported by the European Commission's KA2 Lifelong Learning programme, coordinated by Education@Internet in Partizánske. It is based on Lernu.net, an Esperanto course that has run since 2002 (About page).
- The footer says "© 2026 slovake.eu". No open licence appears on the pages read.

## What it contains

| Level | Chapters | Steps | Chapter titles (examples) |
|---|---|---|---|
| A1 | 17 | 209 | Alphabet and pronunciation; Family; Travelling; Clothing and colours |
| A2 | 15 | 157 | Communication; Children, come play!; We are going on a trip; Customs and traditions |
| B1 | 5 | 53 | Family; Travelling; At the doctor's, health care |
| B2 | 7 | 71 | Škola a práca; Ľudské práva; Ekológia naša každodenná |

Total: 44 chapters and 490 steps. Steps per chapter: A1 6 to 16, A2 9 to 13, B1 10 to 11, B2 8 to 12. The grammar index links 33 pages, and the introduction 12.

Two corrections to my first answer. I said "roughly 60 chapters"; the count is 44. I called "Draw a turtle" a B-level lesson; it is an A2 step (Computers and Internet, step 7).

## What it does well

1. **The same arc in every chapter.** Every chapter read ends the same way: new words, a story with named characters, topic vocabulary, grammar points, a situational communication exercise, pronunciation practice, "What have we learned?", and a final test. A learner always knows what comes next.
2. **Grammar lives inside a topic.** The imperative is step 7 of "Children, come play!" (A2). The conditional is step 4 of "Health and prevention" (A2). The future of perfective verbs is step 5 of "Professions" (A2).
3. **Contrast pairs get their own steps.** A1 "Clothing and colours": "Difference between radi – rady" (step 3) and "Difference between aký – ktorý" (step 4). A1 "Housing" repeats aký/ktorý at step 6. A2 "Slovakia's school system": "Difference between ísť and chodiť" (step 6) and "Reflexive possessive pronoun svoj" (step 7). These are the confusions that teachers of Slovak know learners make.
4. **Culture is content, not decoration.** A2 "Castles and manor houses" (Červený kameň, the Maiden's Well in Piešťany). A2 "Customs and traditions" (Christmas, St Lucy's Day, Easter, proverbs and forecasts). A2 "Slovakia" (flag, anthem, Great Moravia). A2 "Nature" (Aesop's fables).
5. **The interface follows the level.** The B2 step titles are in Slovak: "Nové slová", "Úvodné cvičenia", "Záverečný test".
6. **Each step shows a size counter**, such as "0 / 40" or "0 / 160". Its unit is not labelled.
7. **A grammar reference separate from the course**, public and short. The rhythmic-rule page gives the rule and its exemption lists. The cases page gives the six cases with their question words and example sentences.

## What it doesn't do

- No spaced repetition, no adaptive order, no plan built for the learner, no spoken feedback, no estimate of hours. Progress is the counter on each step.
- Lessons sit behind a login. The grammar and the introduction are public.

## Where we stand

Our engine is stronger on everything the course lacks: FSRS review, the adaptive placement, graded help, the four strands, and honest numbers ([../DECISIONS.md](../DECISIONS.md) P1 to P9). The curriculum is weaker. Units are named after grammar IDs (`acc-fem`, `loc`). The 19 chapters are labels over drill types. Talk and Story had two implementations, which PR #37 fixes. There is no pronunciation track, no contrast pair drill and no grammar reference.

## Mapping

| slovake.eu | LangHarness today | Gap | Idea (plan phase) |
|---|---|---|---|
| A fixed arc in every chapter | 19 chapters over 120 units (`src/core/curriculum.ts`) | no shared shape per chapter | A. Chapter arc |
| A story with named characters | Read episodes of Robo in Bratislava (`src/core/reading.ts`), not tied to chapters | no cast shared across tasks | B. Story bible |
| Contrast pairs as steps | none | pairs are not drilled | C. Dvojičky |
| A situational exercise | six Speak scenes (`src/core/speak.ts`), one per goal | no scripted version before the live one | D. Scripted scenes |
| A pronunciation step per chapter | Speak and Say it faster score clarity (Azure, or transcript matching; LANGHARNESS.md) | no sound-focused item | E. Zvuk |
| A final test | unit completion, E3 in [../DECISIONS.md](../DECISIONS.md) | no mixed chapter test | F. Skúška and passport |
| A grammar reference | none; `/map` is a concept graph | no reference page | G. Grammar atlas |
| Culture texts | none | no calendar or culture content | H. Calendar |
| Slovak interface at higher levels | English interface with bridges (P6) | not used as input | H. Calendar (quick win) |
| A size counter per step | unit progress on the path, not per step | counters are per unit | Quick win |

## Ideas

- **A. Chapter arc.** Every chapter has the same steps: Príbeh (story, input), Slová (words, form), Tvary (forms, form), Dvojičky (pairs, form), Scéna (scene, output), Zvuk (sound, fluency), Skúška (exam, all strands). No model calls. Plan phase 1.
- **B. Story bible.** One cast, places and running plot in `curriculum/slovak/world.json`. Read episodes, Listen sentences, Speak scenes and new review sentences draw from it. One cheap-model episode per chapter, cached under `data/` (E1, E2). Plan phase 2.
- **C. Dvojičky.** Contrast pairs as their own drill: ísť/chodiť, aký/ktorý, svoj/môj, radi/rady, kam/kde. Each rep is a choice between two forms in a real sentence. Local, no model. Fits P3 (retrieval, not recognition). Plan phase 3.
- **D. Scripted scenes.** A branching dialogue per scene, generated once and cached. The learner answers each branch, graded locally, and then the same scene runs live in Speak. This gives B1 and B2 structure instead of open chats. Plan phase 5.
- **E. Zvuk.** One sound per chapter: soft de/te/ne, syllabic r and l, ä, vowel length, the rhythmic rule, voicing. Minimal pairs (pas/pás, rad/rád) and shadowing with the existing clarity score. Plan phase 7.
- **F. Skúška and passport.** A short mixed exam at the end of each chapter, scored honestly. A passport of "I can" lines, paraphrased from the CEFR descriptors, each linked to the sentences that show it. This also covers what the placement audit found missing: nothing measures listening or free production. Plan phase 6.
- **G. Grammar atlas.** A reference built from the lexicon and the learner's own sentences. Each cell of the case × gender table shows the learner's accuracy and a button to drill that cell. The rhythmic rule gets a checker. No model calls. Plan phase 4.
- **H. Calendar and immersion.** Seasonal episodes from the Slovak calendar: Dušičky (2 November), Mikuláš, Lucia (13 December), Vianoce, Veľká noc. The interface switches its button labels to Slovak at A2 and above, with the meaning shown until the learner has seen each one a few times (E4a). Plan phase 8.
- **Quick wins.** A counter on each step; situation titles ("Kde bývaš?") as the headline and the grammar name as the subtitle; a printable syllabus page.

## What we should not copy

- The login wall. The app is local only (E7).
- Points as the only measure of progress (P8).
- The interface in sixteen languages. P6 covers the explanation languages better.
- Their texts, exercises and audio. The site has copyright notice and no open licence. This is the same reasoning that dropped Clozemaster on 2026-10-28.

## What happens next

The implementation plan is in [../plans/chapter-arc.md](../plans/chapter-arc.md). Its first PR (#37) fixes the Talk duplicate and the settings links that were found while mapping the app. The rest waits for the owner's decisions listed in the plan.
