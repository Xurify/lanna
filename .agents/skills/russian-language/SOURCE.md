# Where this skill comes from

Synthesized directly from foundational linguistic sources, state standards, and official Russian pedagogical corpora for Lanna:

1. **Государственный образовательный стандарт по русскому языку как иностранному (ТРКИ / TORFL)** (Минобрнауки РФ, ред. «Златоуст», 2001–2015): The official certification standards, situational competencies, grammatical lists, and lexical minimums (780 for A1, 1300 for A2, 2300 for B1, 5000+ for B2).
2. **_Русская грамматика_ (Грамматика-80)** (Академия наук СССР, Институт русского языка, ред. Н. Ю. Шведова, 1980): The exhaustive two-volume descriptive standard for Russian phonology, inflectional morphology, syntax, and intonational constructions (Е. А. Брызгунова).
3. _**Правила русской орфографии и пунктуации. Полный академический справочник**_ (РАН, ред. В. В. Лопатин, 2006): Definitive normative reference for Cyrillic spelling rules, stress notation in pedagogical texts (§ 116), mandatory `ё` usage (§ 5), and consonant voicing/assimilation.
4. **National Corpus of the Russian Language (НКРЯ / Ruscorpora)**: Spontaneous spoken Russian frequencies, case distribution analysis (Макарова & Сай 2007), and authentic conversational collocations.
5. **_A Comprehensive Russian Grammar_ (Terence Wade)** & standard Russian pedagogical paradigms for foreign learners.

## Keeping it in step

The copy lives in `.claude/skills/russian-language` (where Claude Code loads it) and is mirrored to `.agents/skills/russian-language` (where agents that read that folder look). The two hold identical files, verified by automated unit tests in `tests/russian-skill-copies.test.ts`.

## Structure

- `SKILL.md`: Core directives, verification hierarchy, mandatory production pass, reference routing, and teaching defaults.
- `references/`: Modular, token-minimized deep linguistic and communicative references for all aspects of Russian from A1 through C1.
