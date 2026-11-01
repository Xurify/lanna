# How often does the tutor mislead? Haiku, Sonnet and the slovak-language skill

Date: 2026-11-01. Question from the owner: could the slovak.wiki `slovak-language` skill make the tutor more accurate, does Haiku 5.5 do better at higher reasoning, how does Sonnet 5.5 compare, and what setup "very rarely misleads the student"?

## What was measured

`scripts/eval-slovak-accuracy.ts` asks each model a fixed set of items and grades the answers against a checked key. Two sets:

- **Base set** (`scripts/eval/slovak-accuracy.json`): 59 items. 22 learner sentences (10 with one error, 12 correct; 6 of the correct ones are curated examples from `curriculum/slovak/lexicon.json`), 8 rule questions with four options, 12 inflected forms, 14 short translations with a checked key form, and 3 free explanations for an A1 learner. 56 are graded by the script. The 3 explanations were graded by hand.
- **Hard set** (`scripts/eval/slovak-accuracy-hard.json`): 18 items aimed at known weak spots (clitic order, `s/so` and `z/zo`, masculine-person plurals, numerals with people, animals in the plural), each asked 3 times.

The answers were checked against the skill's own references (`skills/slovak-language/references`), which state each rule tested here.

"With skill" means the system prompt carried `SKILL.md` and the one reference file a tutor would read for that item, routed by hand per item (about 6–9k extra input tokens). The models answered as JSON. The prompt told them that a wrong correction is worse than saying they are unsure.

Raw answers, grades and costs for every run are in [slovak-accuracy-eval/](slovak-accuracy-eval/).

## Results: base set

Errors are counts out of 56 auto-graded items. "Rejected correct" is the subset where a correct sentence was marked wrong, the error that misleads most, because the learner unlearns something right. Explanations are out of 3, graded by hand. A hedge is a refusal that does not mislead but does not teach either.

| Config | Errors /56 | Rejected correct | Explanations wrong | Cost (56 items) |
|---|---|---|---|---|
| Haiku medium | 1 | 0 | **3 of 3** | $0.008 |
| Haiku medium + skill | 2 | 1 | 0 | $0.024 |
| Haiku high | 0 | 0 | 0 (1 hedge) | $0.009 |
| Haiku high + skill | 1 | 0 | 0 | $0.014 |
| Haiku xhigh | 0 | 0 | 1 vague (and a hedge) | $0.012 |
| Haiku xhigh + skill | **0** | 0 | **0** | $0.018 |
| Sonnet low | 2 | 2 | 0 | $0.081 |
| Sonnet low + skill | 1 (muddled) | 0 | 0 | $0.360 (first run, cache write) |
| Sonnet medium | 3 | 2 | 0 | $0.084 |
| Sonnet medium + skill | 3 | 3 | 0 | $0.119 |
| Sonnet high | 1 | 1 | 0 (1 doubtful line) | $0.133 |
| Sonnet high + skill | **0** | 0 | **0** | $0.139 |

**Not measured:** Haiku and Sonnet at `max`, and Sonnet `xhigh`. The key reached its spending limit while those runs were in flight ("You have reached your specified API usage limits. You will regain access on 2026-12-01"). Their partial costs are not in the table.

## Results: hard set (3 runs each)

| Config | Real errors /51 | What |
|---|---|---|
| Haiku medium | 1 | accepted *Išiel som s sestrou* |
| Haiku medium + skill | 3 | accepted *s sestrou* all three times, with the rule `so sestrou` in its context |
| Haiku high | 1 | accepted *s sestrou* once |

Haiku's other hard-set "misses" were the grader's fault: it corrected *k doktor* to *k lekárovi* and named *doktorovi*, which is right. The other levels and Sonnet did not run before the limit.

## What the errors were

Each one would mislead a learner:

- **Invented rules.** Haiku said *s sestrou* needs no *so* "because sestrou starts with a vowel". It also "corrected" the right *Pri čítaní sa mi vynárali…* to *mi sa*, claiming the dative goes first. Both came with confident reasons.
- **Rejecting correct Slovak (Sonnet's main failure).** Sonnet called *Nevlastní auto* Czech (*vlastniť* is ordinary Slovak). It wanted *jazdí na bicykli* changed to *bicyklom* (both are standard) and *Hlavnými aktérmi … sú* changed to the nominative (the instrumental predicate is standard). It also called *Cestou vlakom ušetríme…* unnatural. At low and medium it sometimes reasoned in the visible answer and contradicted itself.
- **Animals as people.** *dva psy* came out as *dva psi* (Haiku medium, Sonnet medium) or *dvaja psi* (Haiku with the skill).
- **Wrong explanations without the skill.** Haiku medium said 2–4 take "the singular", described the rhythmic law as long and short syllables alternating in speech, and gave *dvaja* for animals. The first tutor test of the day made the same rhythmic-law mistake. At high and xhigh, Haiku without the skill hedged ("I am not confident enough…") instead.

## What the skill did

- **It fixed free explanations.** With the skill, every Haiku level explained the rhythmic law with *krásny*, the 2–4 / 5+ rule, and *dvaja* for male persons only. This is what the tutor actually says to a learner, and where Haiku without the skill was weakest.
- **It did not fix mechanical forms on its own.** The `s/so` rule and its exact example were in the routed reference, and Haiku medium still accepted *s sestrou* 3 of 3 times.
- **The skill's wording leaks into answers.** The numerals table labeled *dvaja* "m. anim.", and animals are masculine animate. With the skill, Haiku translated "two dogs" as *dvaja psi*, and Sonnet wrote "animate males". Fixed in this repo's copy (see `skills/slovak-language/SOURCE.md`).
- **Routing matters.** The skill does state the clitic order (`syntax-and-style.md`), only hedged ("use idiomatic patterns rather than forcing an abstract sequence"). The item where Haiku invented "dative before reflexive" was routed to a different chapter, so the rule was not in its context. This repo's copy now adds one explicit line (`Páči sa mi`, never `*mi sa`).
- **On *dva psi*:** the lexicon's forms for *pes* (not marked verified) include *psi*. The skill's nouns chapter gives *psy* as the standard plural. The key follows the skill. *dvaja psi* is wrong either way.
- **Cost:** 2–3× the input of a bare prompt for Haiku. Most of it is cacheable when the core is a fixed prefix.

## Caveats

One run per config on the base set, and a handful of errors in each. A difference of one or two errors is noise. The clear signals are: the skill and Haiku's explanations; Sonnet rejecting correct sentences at low and medium; and Haiku's `s/so` blind spot. The key was written by one person, and every item has a source in the skill's references.

## Recommendation: what rarely misleads

Points 1–3 and 5 were built the same day ([../DECISIONS.md](../DECISIONS.md) E27). The checker runs on every Slovak practice answer, and the tutor has `check_slovak` and `slovak_reference`. Every verdict now says whether a tool checked it.

The model is not the main lever. The best configs measured (Haiku xhigh + skill, Sonnet high + skill) made no auto-graded errors on the base set. But both models invented rules in other runs, and the skill was ignored on a mechanical rule. A learner app should not rely on any one answer being right.

1. **Check mechanical rules in code, not in the model.** These are cheap to check without a model, deterministic, and testable:
   - `s/so` and `z/zo` before *s, z, š, ž*, and `nie je`
   - Czech letters (ř, ě, ů)
   - `budem` + a perfective (aspect is in the lexicon)
   - *dva / dve / dvaja* against the noun's gender and person-ness

   Run the checker on the tutor's corrections and on generated stories.
2. **Never mark a learner's sentence wrong on the model's word alone.** If it matches a curated lexicon example, it is right. Otherwise, the correction must point at a form `lookup_word` confirms, or the tutor says it is unsure. Rejecting correct Slovak was the commonest misleading error.
3. **Put the skill's production pass and "verify instead of guessing" into the Slovak prompt fragment** (`src/agent/prompts/language/10-slovak.md`). Give the tutor the unit's reference: by static routing per curriculum unit, or a `slovak_reference` tool beside `lookup_word`.
4. **Model choice for the tutor (Strong slot):**
   - Sonnet high + skill, or Haiku xhigh + skill at about one tenth of the price.
   - Not Haiku medium without the skill: it got every explanation wrong.
   - Not Sonnet low or medium: it rejects correct sentences.
   - Keep Haiku with thinking off for stories (Cheap slot), with the checker from point 1.
5. **Fix the two skill gaps upstream in slovak.wiki first,** then copy (see [../../skills/slovak-language/SOURCE.md](../../skills/slovak-language/SOURCE.md)): label *dvaja* "male persons" with *dva psy* in the table, and state the clitic order (auxiliary or *by* → *sa/si* → dative → accusative).
6. **Measure again when the key works:**
   - `max` for both models, and Opus 5.5
   - three runs of every config
   - the same set after points 1–3, to see the checker's effect

## Where else the skill helps

- **Story writing (Read, Watch).** The production pass as the writer's checklist, and the Czech-interference list.
- **Judges.** The placement Socratic stage and typed answers the dictionary did not expect: give the judge the reference for accepted alternatives (`slovak-wiki-authoring.md` covers `acceptedAnswers`).
- **Distractors and contrast pairs.** The authoring rules for options that are really wrong.
- **Mistake analysis.** The error categories in `practice-and-progression.md` (case frame, agreement, aspect, verb form, word order/clitic, orthography, register, lexis).
- **Agents writing curriculum or lexicon content in this repo** use `skills/slovak-language` directly.
