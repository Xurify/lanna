# Where this skill comes from

Copied from the slovak.wiki repository, `.agents/skills/slovak-language/`, at commit `337d5fc1` (2026-10-30). slovak.wiki is the source of truth: change the skill there, commit, then run `npm run skill:sync` here.

The copy lives in `.claude/skills/slovak-language` (where Claude Code loads it) and is mirrored to `.agents/skills/slovak-language` (where agents that read that folder look). The two hold the same files; `npm run skill:sync` writes both, and `tests/slovak-skill-copies.test.ts` fails if they differ.

## Keeping it in step

`scripts/sync-slovak-skill.ts` compares three versions of every file: this copy, slovak.wiki at the commit above, and slovak.wiki now.

- A file changed only in slovak.wiki is updated, and the commit above is rewritten.
- A file changed only here stops the sync, because copying would undo a fix slovak.wiki never got. Port it there and sync again, or pass `--force` to drop it.
- An uncommitted skill in slovak.wiki stops it too, so the commit above always holds exactly what was copied.

The tutor reads these files at runtime (`slovak_reference`), so a new version reaches learners as soon as it is merged. Measure it before merging: run `scripts/eval-slovak-accuracy.ts` with `EVAL_BUDGET_USD` set, as described in `docs/research/slovak-accuracy-eval.md`.

Two edits here are not yet in slovak.wiki. Both come from mistakes the accuracy eval traced to the text:

- `references/adjectives-pronouns-numerals.md`: the numerals table labeled `dvaja/traja/štyria` "m. anim.", and a model read that as including animals (_dvaja psi_). It now says "male persons", with _dva_ for animals.
- `references/syntax-and-style.md`: one line making the reflexive-before-dative order explicit (`Páči sa mi`, never `*mi sa`).

## Paths that differ

Paths in `SKILL.md` and `references/slovak-wiki-authoring.md` (`content/dictionary/words.json`, `src/lib/catalog/entries.ts`) are slovak.wiki's. In Lanna the same dictionary is `curriculum/slovak/lexicon.json`, and the tutor reaches it through its `lookup_word` tool.
