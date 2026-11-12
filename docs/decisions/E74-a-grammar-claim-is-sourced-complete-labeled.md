# E74. A grammar claim is sourced, complete, labeled and plain (2026-11-08, branch `feat/ink-case-sketches`)

The owner, after the case walk-throughs: a letter list had come from memory, three genders were shown where Slovak has more patterns (feminine nouns in a consonant, the other neuter patterns), "hard noun" and "men" meant nothing to a learner, "learn which with each word" was said of a rule, and `do Žiliny, v Žiline, Žilinu` read as one case.

**How to apply:**
- The checklist is the `grammar-explanations` skill (`.claude/skills/grammar-explanations/SKILL.md`): source every form (slovak.wiki case page, then the Wikipedia paradigm tables, then JÚĽŠ), cover each pattern (masculine person and thing, feminine in -a hard and soft, feminine in a consonant, neuter), state the rule before its exceptions, name the case of every example, use only words the learner has, say why a cell is empty.
- `tests/case-forms.test.ts` holds every walk-through sentence and table row to a paradigm table, requires each rule line to name its case, and fails on terms the learner was not given. Add a word to `FORMS` when you add a form.
- A masculine rule that covers people and animals says "masculine person or animal" (the animate masculine nouns), never "male person" and never plain "masculine" (masculine things such as dom do not change in the accusative). A unit id is code: prose, captions and chat use the full name (E23).
- What no source gives is written in the pull request's description, not in the app. The same checklist is in the slovak.wiki authoring reference (`slovak-wiki-authoring.md`).
