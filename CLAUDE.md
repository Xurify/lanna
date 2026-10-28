# Working on LangHarness

LangHarness is a Slovak-learning fork of LearnHarness owned by Xurify. Read these before changing anything:

1. [docs/DECISIONS.md](docs/DECISIONS.md): product principles, engineering rules and working rules, with dates and the why. The working rules there (take over, do not ask; descriptive branch names; never merge to main; keys out of chat) override the upstream "No guessing, always ask" rule in `AGENTS.md`.
2. [docs/learner.md](docs/learner.md): who this is built for and what made them drop off.
3. [docs/research/README.md](docs/research/README.md): the evidence behind every task. New research goes there.
4. [docs/CHANGELOG-2026-10.md](docs/CHANGELOG-2026-10.md): what was built when, and what Xurify has not verified yet.
5. [docs/corpus.md](docs/corpus.md): where generated data lives and the rules for adding more.
6. [LANGHARNESS.md](LANGHARNESS.md): the user-facing description of every feature, keys and commands.

Short version of the rules: every task is retrieval-first with graded, priced help; one task per Nation strand in the daily plan; cache every model or TTS output to `data/` before calling an API; Cheap slot for everything but Learn; custom UI with no native widgets and no layout shift; test with `NODE_ENV=test` and `LH_DATA_DIR` set to a scratch folder, never the real profile; name branches after the work, open a PR, do not merge.
