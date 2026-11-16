---
name: grammar-explanations
description: "How LangHarness writes an explanation of a Slovak grammar rule (a case walk-through, a table, a rule line, a Why? line, a chat answer): every form and rule comes from a source, the whole paradigm is covered, a rule is stated as a rule with its exceptions, every example says its case, and no word is used that the learner was not given. Use before and after writing or changing any rule text, example form, table row or grammar claim, in the app, on slovak.wiki or in chat."
---

# Grammar explanations

The owner's rule (2026-11-08, rule E74): the grammar text must be right, complete and clear, and a missed case is a bug, not a polish item. The case walk-throughs shipped with all of these wrong at first: a letter list written from memory, three genders where the language has more patterns, "hard noun" and "men" with no meaning for a learner, "learn which with each word" for something that has a rule, and an unlabeled `do Žiliny, v Žiline, Žilinu` that read as one case.

Use it twice: once **before** you write (sources, scope), once **after** (the checks at the bottom).

## 1. Source every form and rule

- Order of sources: the case page on slovak.wiki (`/grammar/cases/<case>`, source in the slovak.wiki repo `src/lib/catalog/reference/cases.ts`), then the paradigm tables of English Wikipedia "Slovak declension", then the JÚĽŠ norm. Never write a form or a rule from memory.
- A claim only a weaker source gives is written, and the pull request's description says which source and that slovak.wiki does not have it. A claim with no source is not written.
- When the wiki and the app disagree, one of them is wrong: fix the wiki (it is the owner's site) on its own branch, or say so.
- Say in the answer what you did not verify. "Checked" means a page was read, not that it is probably right.

## 2. Cover the whole paradigm

A rule that holds for "most" words is incomplete until its patterns are listed. For nouns, every table has a row for each of these, or says why it has none:

| Row                                                | Test word                                            |
| -------------------------------------------------- | ---------------------------------------------------- |
| masculine animate (životný: a person or an animal) | brat, lekár, pes (and the few in -a: hrdina, kolega) |
| masculine inanimate (neživotný: a thing)           | dom, stôl                                            |
| feminine in -a after a hard consonant              | škola, ruka, Žilina                                  |
| feminine in -a after a soft consonant              | ulica, práca                                         |
| feminine ending in a consonant                     | noc, radosť, pieseň                                  |
| neuter                                             | mesto, srdce, námestie, dievča                       |

Run every test word through the table you wrote, in every case it covers, before you call it done. Audit **every** unit that shares the pattern, not only the one you were editing. List what is left out on purpose (plural, dievča) in the pull request's description.

## 3. A rule is a rule

- Write the rule and then its exceptions. "Learn it with each word" is only for a list with no rule, and then say "no rule".
- An exception says it is one: "večera is declined like ulica".
- Masculine words for people **and animals** (animate) share a pattern in the singular: brata, psa. Do not write "male person" for a rule that covers animals, or "masculine" for one that leaves out things (dom stays dom). In the plural animals are usually treated like things, so say "people" there.
- The letter that decides is the one right before the ending (Žilina: n, so Žiliny; the Ž does not count).

## 4. Name the case, always

When several forms of one word appear together, each carries its case: `do Žiliny` (genitive), `v Žiline` (locative), `Žilinu` (accusative). A rule line says which case it is about ("In the genitive, the ending depends on the word's gender"). A table of one word across cases is a table with the case in the first column.

## 5. Only words the learner has

- Say feminine, masculine, neuter, male person, dictionary form. Do not say hard noun, soft stem, men, -a words (when gender is the reason), paradigm, declension pattern.
- A technical term is defined on the same screen the first time (soft letters are listed, not only named).
- No ASCII arrows in running text for a rule: use the table.
- Sentence-case, American spelling, full grammar words (E23). A unit id (`acc-people`, `gen`) is code: in prose, in chat and in captions say the full name (the accusative of masculine people and animals, the genitive).

## 6. Say why a cell is empty

"Not yet" means the thing will exist. A cell that never will says why ("dictionary form: the word does not change"). Never one word for both.

## 7. Show it

A rule with parallel cases is a table, not paragraphs. A spatial idea is an ink sketch (the `ink-drawing` skill). Show the picture in chat too.

## Check before you finish

1. Is every Slovak form in the diff in a source, and which one?
2. Did I run the test words (Žilina, ulica, noc, srdce, večera) through each table?
3. Does each example say its case?
4. Would a learner who has only seen this app understand every word?
5. Did I audit the other units and the wiki, not only the one in front of me?
6. Is each "exception" really an exception, and each "learn it" really without a rule?
7. Did the pull request's description say what is unverified and what has no wiki source?

`tests/case-forms.test.ts` holds the forms of the case tables to a paradigm table and fails on a missing row. Add a word to it when you add a form.

## Mistakes already made

- A soft-letter list written from memory, then "verified" from a page that only covered the hard side.
- "Words ending in -a" as the reason for -y; the reason is gender and the consonant before -a.
- "Learn which with each word" for práca → práce; the rule is the soft consonant.
- A table with feminine words only in -a: noc, pieseň, srdce, námestie were missing.
- "A few men end in -a": male-person words (hrdina, kolega).
- "A male person as the object" for a rule about masculine animate nouns: it also covers animals (Vidím psa) and leaves out masculine things.
- `do Žiliny, v Žiline, Žilinu` with no cases, read as three genitives.
- "no ending to practice" for the nominative, which read as "the nominative does not exist".
- "Not yet" for a cell that will never have a drill.
