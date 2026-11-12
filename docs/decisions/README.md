# LangHarness decisions

The product principles, working rules and engineering decisions behind LangHarness, each with the day it was set and why. Newest wins where two conflict. Before changing how a task teaches, where data goes or how work reaches the repo, search this folder for the feature or file you are about to touch.

"The owner" is the person who owns the repo and set these rules. "The learner" is whoever is using the app; the app is meant for more than one.

## One file per decision

- **A new decision is a new file** in this folder, named after what it decides: lowercase, words joined by hyphens, no number (`review-miss-contrast.md`). Branches run in parallel, so a shared list or a running number collides at every merge; a new file never does.
- **The first line** is `# <what was decided> (<YYYY-MM-DD>, branch `<branch>`)`. Then the owner's words that started it, **Why:**, **How to apply:**, and what was not changed.
- **Changing an older decision:** say so in the new file's first paragraph, and add one line at the end of the older file: `Changed by [<new file>](<new file>) on <date>.`
- **Referring to one:** by its file name. Decisions written before 2026-11-11 keep their id at the front of the name, so "E38" in a comment is `E38-*.md` here. Two ids were given twice before the split (E50, E86); their file names tell them apart.
- **Dropped or put off:** [dropped-or-deferred.md](dropped-or-deferred.md). A TODO in code becomes a line there.
- **No changelog.** What was built, what was checked and what is not verified yet goes in the pull request's description. Git history keeps the old monthly changelogs (`docs/CHANGELOG-2026-10.md`, `docs/CHANGELOG-2026-11.md`, removed 2026-11-11).

## Product principles

Read these first.

- [P1. Effective, not a clone](P1-effective-not-a-clone.md)
- [P2. Four strands, not pure comprehensible input](P2-four-strands-not-pure-comprehensible-input.md)
- [P3. Desirable difficulty: learning must be hard](P3-desirable-difficulty-learning-must-be-hard.md)
- [P4. Meet a form in a sentence before being tested on it](P4-meet-a-form-in-a-sentence-before.md)
- [P5. Answer first, reasoning optional](P5-answer-first-reasoning-optional.md)
- [P6. Bridges from every language the learner knows](P6-bridges-from-every-language-the-learner-knows.md)
- [P7. Measure cheaply, spend the model on the edge](P7-measure-cheaply-spend-the-model-on-the.md)
- [P8. Honest numbers](P8-honest-numbers.md)
- [P9. Time counts while you practice, and says what it assumed](P9-time-counts-while-you-practice-and-says.md)

## Working rules

How work reaches the repo. These override the upstream "No guessing, always ask" rule in `AGENTS.md`.

- [W1. Take over, do not ask](W1-take-over-do-not-ask.md)
- [W2. Descriptive branch names, no merging to main](W2-descriptive-branch-names-no-merging-to-main.md)
- [W3. Deploying to the PC](W3-deploying-to-the-pc.md)
- [W4. Research notes live in the repo](W4-research-notes-live-in-the-repo.md)
- [W5. A pull request shows the change before it asks for a review](W5-a-pull-request-shows-the-change-before.md)

## Decisions before the split

Every decision kept in `docs/DECISIONS.md` until 2026-11-11, by id. Newer decisions are not listed here: they are the other files in this folder.

- [E1. Save every generated artifact to `data/` in open formats](E1-save-every-generated-artifact-to-data-in.md)
- [E2. Cheap and Strong model slots](E2-cheap-and-strong-model-slots.md)
- [E3. Unit completion rule](E3-unit-completion-rule.md)
- [E4. Custom UI, no native widgets, no layout shift](E4-custom-ui-no-native-widgets-no-layout.md)
- [E4a. One button family, one answer first, labeled cues](E4a-one-button-family-one-answer-first-labeled.md)
- [E5. Keep API keys out of chat](E5-keep-api-keys-out-of-chat.md)
- [E6. Tests never touch the real profile](E6-tests-never-touch-the-real-profile.md)
- [E7. Local only, no sync](E7-local-only-no-sync.md)
- [E8. One screen per task, one scene list](E8-one-screen-per-task-one-scene-list.md)
- [E9. Every chapter has the same seven steps](E9-every-chapter-has-the-same-seven-steps.md)
- [E10. A chapter opens with its own story episode](E10-a-chapter-opens-with-its-own-story.md)
- [E11. Contrast pairs are a choice between two real forms](E11-contrast-pairs-are-a-choice-between-two.md)
- [E12. The grammar atlas shows the map before it is full](E12-the-grammar-atlas-shows-the-map-before.md)
- [E13. A scripted scene walks the rails before it goes live](E13-a-scripted-scene-walks-the-rails-before.md)
- [E14. The chapter exam is recorded before it gates](E14-the-chapter-exam-is-recorded-before-it.md)
- [E15. The chapter exam lives on the path](E15-the-chapter-exam-lives-on-the-path.md)
- [E16. Settings → Data measures what is kept, and clears only the cache](E16-settings-data-measures-what-is-kept-and.md)
- [E17. Settings names what it does, rare controls sit under Advanced, and Review holds still](E17-settings-names-what-it-does-rare-controls.md)
- [E18. The first try is the measure of a form](E18-the-first-try-is-the-measure-of.md)
- [E19. A spoken line is 16 kHz mono WAV, captured through the worklet](E19-a-spoken-line-is-16-khz-mono.md)
- [E20. Phone and iPad: a responsive installable web app, served from the PC](E20-phone-and-ipad-a-responsive-installable-web.md)
- [E21. Remote access is off by default, and a phone pairs with a code](E21-remote-access-is-off-by-default-and.md)
- [E22. Settings reads like any other app: everyday first, AI setup below](E22-settings-reads-like-any-other-app-everyday.md)
- [E23. Full grammar words and one spelling](E23-full-grammar-words-and-one-spelling.md)
- [E24. Mix-ups are kept per pair of words, predicted, then tested](E24-mix-ups-are-kept-per-pair-of.md)
- [E25. My mistakes: analyzed locally, saved with its time, guide on request](E25-my-mistakes-analyzed-locally-saved-with-its.md)
- [E26. The personal lesson: the model picks the targets, the lexicon builds the reps](E26-the-personal-lesson-the-model-picks-the.md)
- [E27. Lexicon sentences come from Tatoeba or the owner's curated text, never from a model](E27-lexicon-sentences-come-from-tatoeba-or-the.md)
- [E28. Verb blanks come from the UD treebank's forms, not a dictionary's paradigm](E28-verb-blanks-come-from-the-ud-treebank.md)
- [E29. Certain rules are checked in code, and every tutor verdict says what backs it](E29-certain-rules-are-checked-in-code-and.md)
- [E30. The trail design: four marks, one gold, a climb](E30-the-trail-design-four-marks-one-gold.md)
- [E31. Stamps mark outcomes, carry no XP, and four indicators sit at the top](E31-stamps-mark-outcomes-carry-no-xp-and.md)
- [E32. No AI-slop defaults](E32-no-ai-slop-defaults.md)
- [E33. The Quiet tool design: one teal, Geist and a rail](E33-the-quiet-tool-design-one-teal-geist.md)
- [E34. One name per page: route, nav label and page title](E34-one-name-per-page-route-nav-label.md)
- [E35. One motion system: a timing scale, transform-only, press that shrinks](E35-one-motion-system-a-timing-scale-transform.md)
- [E36. Keep the browser bundle small, give every tab an instant response, measure a build](E36-keep-the-browser-bundle-small-give-every.md)
- [E37. Clips play as recorded: the pace is not normalised at playback](E37-clips-play-as-recorded-the-pace-is.md)
- [E38. Listening is read from the typed sentence: the cause of each miss, and its trend](E38-listening-is-read-from-the-typed-sentence.md)
- [E39. The XP goal is not a setting: it follows the minutes](E39-the-xp-goal-is-not-a-setting.md)
- [E40. A deep read of the listening: the model explains the figures, it adds none](E40-a-deep-read-of-the-listening-the.md)
- [E41. Watch takes Czech captions when a video has no Slovak ones](E41-watch-takes-czech-captions-when-a-video.md)
- [E42. Aspect and demonstratives: drilled only from verified rows, a pair needs both aspects, explanations are static and reachable from the Dvojičky steps](E42-aspect-and-demonstratives-drilled-only-from-verified.md)
- [E43. A language is added from the app, from open data, without a model writing words](E43-a-language-is-added-from-the-app.md)
- [E44. An added language gets a whole generated course; the model writes the rules, never the sentences](E44-an-added-language-gets-a-whole-generated.md)
- [E45. A language switch happens in place, with no restart](E45-a-language-switch-happens-in-place-with.md)
- [E46. One plan for the day across languages; the split is each language's own minutes](E46-one-plan-for-the-day-across-languages.md)
- [E47. What the learner knows is kept once; bridges come from the learner's own languages](E47-what-the-learner-knows-is-kept-once.md)
- [E48. Fluency is called Speed, at `/speed`; the B2 stage is Argument; no redirect](E48-fluency-is-called-speed-at-speed-the.md)
- [E49. The placement tutor checks the rung the level rests on](E49-the-placement-tutor-checks-the-rung-the.md)
- [E50. Cheatsheets: one line per phrase, kept as JSON, words to Review on request](E50-cheatsheets-one-line-per-phrase-kept-as.md)
- [E50. Watch picks: saved creators, the learner's own YouTube read in a window of the app's own, every video checked for free before it is offered](E50-watch-picks-saved-creators-the-learner-s.md)
- [E51. The miss judge reads the check so far, and names a repeated mistake](E51-the-miss-judge-reads-the-check-so.md)
- [E52. Watch fragments: pick a stretch of a video, ranked locally for the learner's level](E52-watch-fragments-pick-a-stretch-of-a.md)
- [E53. Watch measures real speech against what the learner knows, and shows what the level expects beside it](E53-watch-measures-real-speech-against-what-the.md)
- [E54. Today's line is heard cold, heard again after practice, and counts rather than grades](E54-today-s-line-is-heard-cold-heard.md)
- [E55. The stage sentence names the limit with the milestones' own numbers, and says when a number is an estimate](E55-the-stage-sentence-names-the-limit-with.md)
- [E56. Watch lines come back in Listen](E56-watch-lines-come-back-in-listen.md)
- [E57. Catch the mistake: a separate exercise, not a planted slip in episodes](E57-catch-the-mistake-a-separate-exercise-not.md)
- [E58. A scene with a date: a custom milestone with a day and a line after it, never an invented speed](E58-a-scene-with-a-date-a-custom.md)
- [E59. The mark is a cursor at an empty answer line, for any language](E59-the-mark-is-a-cursor-at-an.md)
- [E60. One text field style, set once in global CSS](E60-one-text-field-style-set-once-in.md)
- [E61. A saved creator can be searched and listed newest first](E61-a-saved-creator-can-be-searched-and.md)
- [E62. Study sections: a model picks the parts and the words, the program builds the exercises from the real lines](E62-study-sections-a-model-picks-the-parts.md)
- [E63. Every task shows the research behind it: what it found, what it did not show, and which numbers are the app's own](E63-every-task-shows-the-research-behind-it.md)
- [E64. The Watch shelf is one card in four tabs, and what was asked once is kept](E64-the-watch-shelf-is-one-card-in.md)
- [E65. Speak is a scene board: the list and the sheet of the scene in hand](E65-speak-is-a-scene-board-the-list.md)
- [E66. Night surfaces are seen by being lighter; letter keys are keycaps](E66-night-surfaces-are-seen-by-being-lighter.md)
- [E67. One word for each thing the learner sees](E67-one-word-for-each-thing-the-learner.md)
- [E68. A long day goes to input, and listening outside the app is logged apart](E68-a-long-day-goes-to-input-and.md)
- [E69. Comments only for what lives outside the repo](E69-comments-only-for-what-lives-outside-the.md)
- [E70. Get ready: a hard video is briefed before it is watched, content first, then its keys typed into their lines](E70-get-ready-a-hard-video-is-briefed.md)
- [E71. A word can be marked as known, and it counts everywhere what you know is measured](E71-a-word-can-be-marked-as-known.md)
- [E72. A session closes to the page it was opened from](E72-a-session-closes-to-the-page-it.md)
- [E73. A grammar lesson opens on a click-through sketch, drawn in ink](E73-a-grammar-lesson-opens-on-a-click.md)
- [E74. A grammar claim is sourced, complete, labeled and plain](E74-a-grammar-claim-is-sourced-complete-labeled.md)
- [E75. Each device runs its own language, and a page writes into the language it shows](E75-each-device-runs-its-own-language-and.md)
- [E76. The tutor chat is a plain conversation: short replies, one question, drawings in the reply](E76-the-tutor-chat-is-a-plain-conversation.md)
- [E77. Every end screen scrolls, keeps its buttons in the dock, and shows the session as a record](E77-every-end-screen-scrolls-keeps-its-buttons.md)
- [E78. Exclamations are said in the language being learned, from one checked table](E78-exclamations-are-said-in-the-language-being.md)
- [E79. A chat starts in place, a reply is one model call, and the tutor links the app's own lessons](E79-a-chat-starts-in-place-a-reply.md)
- [E80. Estonian and Russian ship a course written by hand, and the Grammar page shows each course's cases](E80-estonian-and-russian-ship-a-course-written.md)
- [E81. Zvuk: shadowing with the tutorial's timing, verified lines, one listening check](E81-zvuk-shadowing-with-the-tutorial-s-timing.md)
- [E82. An automated single-case experiment arm: input-first Russian vs Slovak control](E82-an-automated-single-case-experiment-arm-input.md)
- [E83. Krashen SLA-aligned Roadmap: CI tuning, silent period, and conversational recasting](E83-krashen-sla-aligned-roadmap-ci-tuning-silent.md)
- [E84. The Study views are a page and a task like any other](E84-the-study-views-are-a-page-and.md)
- [E85. The chat reads seamlessly: the tutor in Fira Sans, no boxes around words or lines, answers marked in place](E85-the-chat-reads-seamlessly-the-tutor-in.md)
- [E86. A page is rendered while the pointer rests on its link, and "instant" is a check](E86-a-page-is-rendered-while-the-pointer.md)
- [E86. The ear gym is a task screen like the others, and length is drawn one way](E86-the-ear-gym-is-a-task-screen.md)
- [E87. The ear gym follows the active language](E87-the-ear-gym-follows-the-active-language.md)
- [E88. In the ear gym the two words are the largest thing on the screen, and the letters that differ are marked](E88-in-the-ear-gym-the-two-words.md)
- [E89. A chat exports sentences for Clozemaster, not Anki cards, and its Markdown reads the same outside the app](E89-a-chat-exports-sentences-for-clozemaster-not.md)
- [E90. Estonian pairs, sound notes that stay in their language, and what two blind readers changed](E90-estonian-pairs-sound-notes-that-stay-in.md)
- [E91. The server runs as a container on an always-on machine; it updates only to a build that checks itself, and its data is backed up and read back](E91-the-server-runs-as-a-container-on.md)
- [E92. What the app fetches for someone else goes through one guard, every body has a cap, keys never leave in an error, and production sends a content security policy](E92-what-the-app-fetches-for-someone-else.md)
- [E93. The app can be served at a public address behind a password, and the proxy proves itself with a secret](E93-the-app-can-be-served-at-a.md)
- [E94. Sound guide, mouth cross-section drawings, and articulatory contrast notes grounded in phonological research](E94-sound-guide-mouth-cross-section-drawings-and.md)
- [E95. A cheatsheet's own lines can be practiced by ear, and that practice is kept apart from everything measured](E95-a-cheatsheet-s-own-lines-can-be.md)
- [E96. In Listen the answer is written on a line, the top band is the round, and an open cheatsheet is a page of its own](E96-in-listen-the-answer-is-written-on.md)
- [E97. A transcript is in the language that is heard, never the profile's: a track in another language is refused, not stored under the profile's language](E97-a-transcript-is-in-the-language-that.md)
- [E98. A review card can hide up to three words, once the word has been answered](E98-a-review-card-can-hide-up-to.md)
- [E99. A graded chat answer is evidence: two misses on one unit in three weeks make it a weak spot, and the analysis reads chats beside lessons](E99-a-graded-chat-answer-is-evidence-two.md)
- [E100. Review is written on the page: no card, a dock for the buttons, and today's answers under the sentence](E100-review-is-written-on-the-page-no.md)
- [E101. Task screens are written on the page, letter keys come in families and fix the letter you just typed, and flags fill their box](E101-task-screens-are-written-on-the-page.md)
- [E102. A longer blank hides words from anywhere in the sentence, and the day's list never gives the open card away](E102-a-longer-blank-hides-words-from-anywhere.md)
- [E103. In Listen a missed word shows what you typed under it, and a missed segment is solid red](E103-in-listen-a-missed-word-shows-what.md)
