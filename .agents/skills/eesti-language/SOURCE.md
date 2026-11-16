# Where this skill comes from

Synthesized directly from foundational linguistic sources and official Estonian pedagogical corpora for LangHarness:

1. **Erelt & Metslang (eds.), _Eesti keele süntaks_** (Eesti keele varamu III, Tartu Ülikooli Kirjastus 2017): The definitive academic reference on Estonian syntax, clause structures, secondary predicates, converbs, information structure, and word order.
2. _**Eesti keele grammatika tabelid**_: Standard paradigm tables for noun declensions (14 cases, grade alternation patterns) and verb conjugations.
3. **_Eesti keele käsiraamat_ (EKKR)** (Mati Erelt, Tiiu Erelt, Kristiina Ross; Institute of the Estonian Language / EKI): Normative reference for phonology, morphology, syntax, and orthography.
4. **Keeleklikk & Keeletee** (Ministry of Education and Research / Hydrargyrum): Modern communicative curriculum maps, thematic situational dialogues, and practical frequency-based structures (A1–B1).
5. **Harno (Haridus- ja Noorteamet) Reference Level Descriptions**: Official CEFR exam specifications and empirical learner error profiles (_Algaja keelekasutaja. A2-taseme eesti keele oskus_, _Iseseisev keelekasutaja. B1- ja B2-taseme eesti keele oskus_).

## Keeping it in step

The copy lives in `.claude/skills/eesti-language` (where Claude Code loads it) and is mirrored to `.agents/skills/eesti-language` (where agents that read that folder look). The two hold the identical files, verified by automated unit tests in `tests/eesti-skill-copies.test.ts`.

## Structure

- `SKILL.md`: Core directives, verification hierarchy, mandatory production pass, reference routing, and teaching defaults.
- `references/`: Modular, token-minimized deep linguistic and communicative references for all aspects of Estonian from A1 through C1.
