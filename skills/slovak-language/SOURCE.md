# Where this skill comes from

Copied from the slovak.wiki repository, `.agents/skills/slovak-language/`, at commit `337d5fc1` (2026-10-30). The owner keeps both projects; change the skill there first and copy it here, so the two do not drift.

Two edits here are not yet in slovak.wiki. Both come from mistakes the accuracy eval traced to the text:
- `references/adjectives-pronouns-numerals.md`: the numerals table labeled `dvaja/traja/štyria` "m. anim.", and a model read that as including animals (*dvaja psi*). It now says "male persons", with *dva* for animals.
- `references/syntax-and-style.md`: one line making the reflexive-before-dative order explicit (`Páči sa mi`, never `*mi sa`).

Paths in `SKILL.md` and `references/slovak-wiki-authoring.md` (`content/dictionary/words.json`, `src/lib/catalog/entries.ts`) are slovak.wiki's. In LangHarness the same dictionary is `curriculum/slovak/lexicon.json`, and the tutor reaches it through its `lookup_word` tool.

`scripts/eval-slovak-accuracy.ts` measures how often a model misleads a learner with and without this skill. The results are in `docs/research/slovak-accuracy-eval.md`.
