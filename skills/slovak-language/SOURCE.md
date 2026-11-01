# Where this skill comes from

Copied from the slovak.wiki repository, `.agents/skills/slovak-language/`, at commit `337d5fc1` (2026-10-30). The owner keeps both projects; change the skill there first and copy it here, so the two do not drift.

Paths in `SKILL.md` and `references/slovak-wiki-authoring.md` (`content/dictionary/words.json`, `src/lib/catalog/entries.ts`) are slovak.wiki's. In LangHarness the same dictionary is `curriculum/slovak/lexicon.json`, and the tutor reaches it through its `lookup_word` tool.

`scripts/eval-slovak-accuracy.ts` measures how often a model misleads a learner with and without this skill. The results are in `docs/research/slovak-accuracy-eval.md`.
