# Working on LangHarness

LangHarness is a Slovak-learning fork of LearnHarness. Read these before changing anything:

1. This file: the product principles (P) and working rules (W) below.
2. [docs/learner.md](docs/learner.md): what the app assumes about its learners and what makes them drop off.
3. [docs/research/README.md](docs/research/README.md): the evidence behind every task. New research goes there.
4. [docs/corpus.md](docs/corpus.md): where generated data lives and the rules for adding more.
5. [README.md](README.md): how to run it, the keys and commands, and the limits worth knowing.

There is no decisions file and no changelog. Why something was built, what was checked and what is not verified yet goes in the pull request's description and the commit message. A rule the owner sets that every future change must follow goes in this file. An id such as E38 in an older comment or note points to `docs/DECISIONS.md` in git history (removed 2026-11-11): `git show 5ff5eb25:docs/DECISIONS.md`.

## Product principles

- **P1. Effective, not a clone.** Every task starts from a research note in `docs/research/` and from the learner's own evidence (lesson log, chats), not from what another app does. Gamification stays where it costs nothing (XP, streaks), never where it changes what is practiced.
- **P2. Four strands.** Nation's meaning-focused input, meaning-focused output, language-focused learning and fluency, about a quarter of the time each. The daily plan keeps one task per strand before any second drill. Input stays easy at the word level (93% to 98% known words); difficulty lives in output and study.
- **P3. Desirable difficulty.** Every rep is retrieval first. Help is graded, visible and priced in XP or rating, never free. Recognition only to meet a form; production to prove it. Difficulty rises with mastery.
- **P4. Meet a form in a sentence before being tested on it.** A new unit's first lesson opens with "What does it mean?" reps before any production.
- **P5. Answer first, reasoning optional.** One tap or one number key answers; confidence and thinking sit behind "Explain my reasoning". Show evidence, not a verdict.
- **P6. Bridges from every language the learner knows**, best-known first, one line each, never a lesson in that language.
- **P7. Measure cheaply, spend the model on the edge.** No model call where code can decide; the Cheap slot for everything but Learn; the Strong slot only for the few Socratic questions at the edge.
- **P8. Honest numbers.** Estimates say what they assume. Never overstate dictionary accuracy.
- **P9. Time counts while you practice.** A task counts active time per activity, capped gaps of 90 seconds, and says what it assumed.

## Working rules

- **W1. Take over, do not ask.** Pick the recommended option, build it, verify it in the running app, then send one short report with screenshots. This overrides the upstream "No guessing, always ask" rule in `AGENTS.md`.
- **W2. Descriptive branch names; the owner merges.** Name branches after the work (`feat/desirable-difficulty`), never generated names. Open the PR, assign the owner, and stop, unless the owner says to merge.
- **W3. Deploying to the PC.** The dev server hot-reloads, so a deploy is a `git fetch` plus checkout of the PR branch on a clean tree. GitHub Actions never runs on this repo, so red CI there is not a code failure.
- **W4. Research notes live in the repo**, in `docs/research/` with their sources, and the index in `docs/research/README.md` is updated in the same PR.
- **W5. A pull request shows the change before it asks for a review.** The description follows `.github/pull_request_template.md`: what changes for the learner, screenshots of every learner-facing change in Day and Night at 1280 and 390 px attached via `gh pr create/edit --attach`, how to try it, commit-pinned links to the changed code, and what was and was not checked. The steps are the `pr-description` skill.
- **Keys stay out of chat.** A key is entered in Settings or `.env.local`, never pasted into a conversation.

## Engineering rules

Every task is retrieval-first with graded, priced help; cache every model or TTS output to `data/` before calling an API; custom UI with no native widgets and no layout shift; full grammar words (accusative, not acc.); test with `NODE_ENV=test` and `LH_DATA_DIR` set to a scratch folder, never the real profile.

- **Comments**: Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from). Full rule in [AGENTS.md](AGENTS.md) under **Code style → Comments**.
