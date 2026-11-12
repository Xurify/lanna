# Working on LangHarness

LangHarness is a Slovak-learning fork of LearnHarness. Read these before changing anything:

1. [docs/decisions/README.md](docs/decisions/README.md): the product principles (P) and working rules (W) to read first, and how decisions are kept: one file per decision in `docs/decisions/`, with the date and the why. Search that folder for the feature or file you are about to change. The working rules (take over, do not ask; descriptive branch names; never merge to main; keys out of chat) override the upstream "No guessing, always ask" rule in `AGENTS.md`.
2. [docs/learner.md](docs/learner.md): what the app assumes about its learners and what makes them drop off.
3. [docs/research/README.md](docs/research/README.md): the evidence behind every task. New research goes there.
4. [docs/corpus.md](docs/corpus.md): where generated data lives and the rules for adding more.
5. [LANGHARNESS.md](LANGHARNESS.md): how to run it, the keys and commands, and the limits worth knowing.

A new decision is a new file in `docs/decisions/`, never an edit to a shared list. There is no changelog: what was built, what was checked and what is not verified yet goes in the pull request's description.

Short version of the rules: every task is retrieval-first with graded, priced help; one task per Nation strand in the daily plan; cache every model or TTS output to `data/` before calling an API; Cheap slot for everything but Learn; custom UI with no native widgets and no layout shift; test with `NODE_ENV=test` and `LH_DATA_DIR` set to a scratch folder, never the real profile; name branches after the work, open a PR whose description follows `.github/pull_request_template.md` (MUST include images and screenshots of the changed thing in Day and Night attached via `gh pr create/edit --attach` before asking for review: W5 and the `pr-description` skill), do not merge.

- **Comments**: Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from). Full rule in [AGENTS.md](AGENTS.md) under **Code style → Comments**.
