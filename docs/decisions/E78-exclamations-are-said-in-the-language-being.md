# E78. Exclamations are said in the language being learned, from one checked table (2026-11-08, branch `fix/lesson-end-layout`)

**Why:** the owner: "Also should some of the text be in Slovak?" Repeated meetings build word knowledge, fixed phrases are worth learning whole, and a gloss keeps them comprehensible; no study tested an app's interface language. The Slovak praise was hardcoded, so an Estonian lesson praised in Slovak. Research note: [research/target-language-ui.md](../research/target-language-ui.md).

**How to apply:**
- Only fixed, frequent exclamations are in the language being learned: the praise after a right answer (lesson, Listen, Speak) and the heading of the lesson end screen ("Je to hotové!", "Bez chyby!", "Koniec!", "Nový rekord!"). Labels, numbers, instructions and buttons stay in English.
- The heading carries its English gloss beside it in the label style ("it's done"); the praise has none, since the verdict around it says what it means.
- The phrases live in `src/core/cheers.ts`, per language code, and are picked from the active language (`praiseFor`, `cheersFor`); a language without a set gets English. Slovak, Estonian and Russian have sets, each form backed by the lexicon or Wiktionary as the research note lists. No model writes them. A new set needs the same sources.
