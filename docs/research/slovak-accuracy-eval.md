# How often does the tutor mislead? Haiku, Sonnet and the slovak-language skill

Date: 2026-11-01. Question from the owner: could the slovak.wiki `slovak-language` skill make the tutor more accurate, does Haiku 5.5 do better at higher reasoning, how does Sonnet 5.5 compare, and what setup "very rarely misleads the student"?

## What was measured

`scripts/eval-slovak-accuracy.ts` asks each model a fixed set of items and grades the answers against a checked key. Two sets:

- **Base set** (`scripts/eval/slovak-accuracy.json`): 59 items. 22 learner sentences (10 with one error, 12 correct; 6 of the correct ones are curated examples from `curriculum/slovak/lexicon.json`), 8 rule questions with four options, 12 inflected forms, 14 short translations with a checked key form, and 3 free explanations for an A1 learner. 56 are graded by the script. The 3 explanations were graded by hand.
- **Hard set** (`scripts/eval/slovak-accuracy-hard.json`): 18 items aimed at known weak spots (clitic order, `s/so` and `z/zo`, masculine-person plurals, numerals with people, animals in the plural), each asked 3 times.

The answers were checked against the skill's own references (`.claude/skills/slovak-language/references`), which state each rule tested here.

"With skill" means the system prompt carried `SKILL.md` and the one reference file a tutor would read for that item, routed by hand per item (about 6–9k extra input tokens). The models answered as JSON. The prompt told them that a wrong correction is worse than saying they are unsure.

Raw answers, grades and costs for every run are in [slovak-accuracy-eval/](slovak-accuracy-eval/).

## Results: base set

Errors are counts out of 56 auto-graded items. "Rejected correct" is the subset where a correct sentence was marked wrong, the error that misleads most, because the learner unlearns something right. Explanations are out of 3, graded by hand. A hedge is a refusal that does not mislead but does not teach either.

| Config | Errors /56 | Rejected correct | Explanations wrong | Cost (56 items) |
| --- | --- | --- | --- | --- |
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

**The first round hit the key's limit.** The `max` runs were in flight when the key reached its spending limit ("You have reached your specified API usage limits"), and the script then recorded cost only at the end of a config, so their partial cost is unknown. After the owner raised the limit, a second round ran with the script recording cost per call and stopping at `EVAL_BUDGET_USD=2`. It stopped at $2.30: calls already in flight carried it past the cap.

| Config (second round) | Errors /56 | Rejected correct | Cost (56 items) | Seconds per answer |
| --- | --- | --- | --- | --- |
| Haiku max | 0 | 0 | $0.077 | 12.6 |
| Haiku max + skill | 0 | 0 | $0.093 | 12.1 |
| Sonnet max | 0 | 0 | $0.669 | 9.4 |
| Sonnet max + skill | 0 of 43 asked (stopped at the budget) | 0 | $0.845 | 9.4 |

## Results: hard set (3 runs each)

| Config | Errors /51 | What |
| --- | --- | --- |
| Haiku medium | 1 | accepted _Išiel som s sestrou_ |
| Haiku medium + skill | 3 | accepted _s sestrou_ all three times, with the rule `so sestrou` in its context |
| Haiku high | 1 | accepted _s sestrou_ once |
| Haiku high + skill | 3 | accepted _s sestrou_ all three times |
| Haiku xhigh | 2 | accepted _Páči mi sa ten film_; "three dogs" as _traja psi_ |
| Haiku xhigh + skill | 3 | accepted _s sestrou_ twice; _tri psi_ |
| Haiku max | 3 | accepted _s sestrou_ twice and _Páči mi sa_ |
| Haiku max + skill | 1 | _tri psi_ |
| Sonnet high | 1 | _traja psi_ |
| **Sonnet high + skill** | **0** | — |

Seconds per answer on the hard set: Haiku xhigh about 3.5, Haiku max about 13, Sonnet high about 2.5–2.9.

The hard set's _k doktor_ item was graded too strictly in the first round: Haiku corrected it to _k lekárovi_ and named _doktorovi_, which is right. The key now accepts both. _tri psi_ is counted wrong because the skill gives _psy_; the lexicon lists _psi_ among the unverified forms of _pes_, so that one is the least certain miss.

## What the errors were

Each one would mislead a learner:

- **Invented rules.** Haiku said _s sestrou_ needs no _so_ "because sestrou starts with a vowel". It also "corrected" the right _Pri čítaní sa mi vynárali…_ to _mi sa_, claiming the dative goes first. Both came with confident reasons.
- **Rejecting correct Slovak (Sonnet's main failure).** Sonnet called _Nevlastní auto_ Czech (_vlastniť_ is ordinary Slovak). It wanted _jazdí na bicykli_ changed to _bicyklom_ (both are standard) and _Hlavnými aktérmi … sú_ changed to the nominative (the instrumental predicate is standard). It also called _Cestou vlakom ušetríme…_ unnatural. At low and medium it sometimes reasoned in the visible answer and contradicted itself.
- **Animals as people.** _dva psy_ came out as _dva psi_ (Haiku medium, Sonnet medium) or _dvaja psi_ (Haiku with the skill).
- **Wrong explanations without the skill.** Haiku medium said 2–4 take "the singular", described the rhythmic law as long and short syllables alternating in speech, and gave _dvaja_ for animals. The first tutor test of the day made the same rhythmic-law mistake. At high and xhigh, Haiku without the skill hedged ("I am not confident enough…") instead.

## What the skill did

- **It fixed free explanations.** With the skill, every Haiku level explained the rhythmic law with _krásny_, the 2–4 / 5+ rule, and _dvaja_ for male persons only. This is what the tutor actually says to a learner, and where Haiku without the skill was weakest.
- **It did not fix mechanical forms on its own.** The `s/so` rule and its exact example were in the routed reference, and Haiku medium still accepted _s sestrou_ 3 of 3 times.
- **It did not lower Haiku's graded errors.** Without the skill, Haiku high and xhigh also made no error on the base set. With it, Haiku made more errors on the hard set at medium, high and xhigh (3, 3 and 3, against 1, 1 and 2) and fewer only at max (1 against 3). The counts are small (see Caveats), but nothing here shows the skill helping on forms.
- **The skill's wording leaks into answers.** The numerals table labeled _dvaja_ "m. anim.", and animals are masculine animate. With the skill, Haiku translated "two dogs" as _dvaja psi_, and Sonnet wrote "animate males". Fixed in this repo's copy (see `.claude/skills/slovak-language/SOURCE.md`).
- **Routing matters.** The skill does state the clitic order (`syntax-and-style.md`), only hedged ("use idiomatic patterns rather than forcing an abstract sequence"). The item where Haiku invented "dative before reflexive" was routed to a different chapter, so the rule was not in its context. This repo's copy now adds one explicit line (`Páči sa mi`, never `*mi sa`).
- **On _dva psi_:** the lexicon's forms for _pes_ (not marked verified) include _psi_. The skill's nouns chapter gives _psy_ as the standard plural. The key follows the skill. _dvaja psi_ is wrong either way.
- **Cost:** 2–3× the input of a bare prompt for Haiku. Most of it is cacheable when the core is a fixed prefix.

## Caveats

One run per config on the base set, and a handful of errors in each. A difference of one or two errors is noise. The clear signals are: the skill and Haiku's explanations; Sonnet rejecting correct sentences at low and medium; and Haiku's `s/so` blind spot. The key was written by one person, and every item has a source in the skill's references.

## Recommendation: what rarely misleads

Points 1–3 and 5 were built the same day (E29). The checker runs on every Slovak practice answer, and the tutor has `check_slovak` and `slovak_reference`. Every verdict now says whether a tool checked it.

The model is not the main lever. Eight configs made no auto-graded error on the base set: Haiku high, xhigh and max; Haiku xhigh + skill and max + skill; Sonnet high + skill; Sonnet max; and Sonnet max + skill on the 43 items it reached. Of those also run on the hard set, only Sonnet high + skill had no error there. But both models invented rules in other runs, and the skill was ignored on a mechanical rule. A learner app should not rely on any one answer being right.

1. **Check mechanical rules in code, not in the model.** These are cheap to check without a model, deterministic, and testable:
   - `s/so` and `z/zo` before _s, z, š, ž_, and `nie je`
   - Czech letters (ř, ě, ů)
   - `budem` + a perfective (aspect is in the lexicon)
   - _dva / dve / dvaja_ against the noun's gender and person-ness

   Run the checker on the tutor's corrections and on generated stories.

2. **Never mark a learner's sentence wrong on the model's word alone.** If it matches a curated lexicon example, it is right. Otherwise, the correction must point at a form `lookup_word` confirms, or the tutor says it is unsure. Rejecting correct Slovak was the commonest misleading error.
3. **Put the skill's production pass and "verify instead of guessing" into the Slovak prompt fragment** (`src/agent/prompts/language/10-slovak.md`). Give the tutor the unit's reference: by static routing per curriculum unit, or a `slovak_reference` tool beside `lookup_word`.
4. **Model choice for the tutor (Strong slot): Sonnet high + skill.**
   - It was the only config with no error on either set: 0 of 107 graded answers, all explanations right. It cost about $0.003–0.005 per answer here, at 2.5 s.
   - Haiku xhigh + skill, at about a tenth of the price, was clean on the base set but missed 3 of 51 on the hard set. The checker now catches the two _s sestrou_ misses; it cannot catch animal plurals (_tri psi_).
   - `max` is not worth it. Haiku max is 4× slower than xhigh for no gain on the hard set. Sonnet max matched Sonnet high on the base set at about five times the cost.
   - Not Haiku medium without the skill: it got every explanation wrong.
   - Not Sonnet low or medium: it rejects correct sentences.
   - Keep Haiku with thinking off for stories (Cheap slot), with the checker from point 1.
5. **Fix the two skill gaps upstream in slovak.wiki first,** then copy (see [../../.claude/skills/slovak-language/SOURCE.md](../../.claude/skills/slovak-language/SOURCE.md)): label _dvaja_ "male persons" with _dva psy_ in the table, and state the clitic order (auxiliary or _by_ → _sa/si_ → dative → accusative).
6. **Measure again when the key works:**
   - `max` for both models, and Opus 5.5
   - three runs of every config
   - the same set after points 1–3, to see the checker's effect

## Where else the skill helps

- **Story writing (Read, Watch).** The production pass as the writer's checklist, and the Czech-interference list.
- **Judges.** The placement Socratic stage and typed answers the dictionary did not expect: give the judge the reference for accepted alternatives (`slovak-wiki-authoring.md` covers `acceptedAnswers`).
- **Distractors and contrast pairs.** The authoring rules for options that are really wrong.
- **Mistake analysis.** The error categories in `practice-and-progression.md` (case frame, agreement, aspect, verb form, word order/clitic, orthography, register, lexis).
- **Agents writing curriculum or lexicon content in this repo** use `.claude/skills/slovak-language` directly.
