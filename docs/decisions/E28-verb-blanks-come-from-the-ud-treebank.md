# E28. Verb blanks come from the UD treebank's forms, not a dictionary's paradigm (2026-11-01)

**Why:** 102 verbs had fewer than three sentences the lexicon could blank. For 79 of them the wiki had no verified forms, so the export could not blank their sentences, and Tatoeba had too few sentences per form to fill them (it matches whole words, and its Slovak corpus is thin for these verbs). A paradigm from the Hunspell spelling dictionary would have matched 300 sentences, but that dictionary is built to accept words, not to say which forms a learner should drill: its affix rules generate every form a verb might take, rare and bookish ones included (the transgressive dosiahnuc), while the treebank lists only forms annotators found in real sentences.

**How to apply:**
- `curriculum/slovak/ud-verb-forms.json` lists, for each verb lemma, the forms the Universal Dependencies Slovak SNK treebank gives it (`scripts/build-ud-verb-forms.mjs`). Its README says lemmas and morphology were assigned manually and only sentences where two annotators agreed are kept. A form is used only when it is a verb wherever it occurs and has one lemma.
- The cloze step of `scripts/export-slovakwiki-lexicon.mjs` blanks a verb's sentence with those forms as well as the wiki's own.
- `scripts/merge-lexicon.mjs` gives a blank to a shipped sentence that has none. Text, position and the rejected flag do not change. 161 sentences gained a blank, all for verbs; 28 of the 102 thin verbs now have three usable sentences.
- The forms file is licensed CC BY-SA 4.0, the treebank's license, and names that license and its source in its header. It is derived data, so the share-alike term applies to it. The owner chose to keep it in the repo (2026-11-01).
- The other verbs stay thin until a verified source exists, for example JÚĽŠ.
