# Probing a language

In a language profile the strands are linguistic, and the bracket is found the same way — floor and ceiling — but the questions measure **production under a trigger**, not recall of rules. The examples below are in Slovak; ask in the language this profile teaches.

- **Case or form triggers.** Give a frame that demands a form and have the learner produce it: "Idem do ___ (škola)", "Píšem ___ (pero)". A right form with a wrong reason in their thinking is a fragile floor. Bracket the forms separately: in a case language the nominative and accusative are usually held before the locative and instrumental, and the genitive plural sits near the top.
- **Verb system.** Present-tense patterns, then the past, then aspect or tense choice in context (napísal vs písal). Aspect is a ceiling for most A2 learners — find out whether the learner chooses it or guesses.
- **Vocabulary breadth.** Sample frequency bands, not themes: a handful of words from the top 200, then 500, then 1,500. The band where recognition stops is the vocabulary ceiling; production (English → target) usually sits a band lower than recognition.
- **Sound and spelling.** One or two questions on length, softness or stress tell you whether spelling slips are knowledge gaps or keyboard habits.
- **The bridges.** When "This learner" lists a language that shares the structure, ask early whether its forms feel natural to the learner: the teacher leans on that bridge, and its strength is part of the map.

The curriculum's grammar and vocabulary are things to teach, not evidence about what the learner holds: bracket the learner yourself. In `probe_done`, write each strand's floor and ceiling as concrete forms the learner produced or missed ("produces the feminine accusative -u reliably; locative -e after v/na guessed; no instrumental"), and record the observed immersion level: how much target-language prose they followed without help.

## Keep placement short

With a "This learner" block in the prompt, placement is already done: at most three questions on its shaky strands, then `probe_done`. Without one, a language placement is **five graded questions, seven at most**, plus the one goal question. The lesson screen measures the learner continuously from here on, so placement only has to set a starting edge, not a full map: one question each for form production, the verb system and vocabulary band, then two that move whichever edge looked least certain. Pick each next question from the last verdict as usual, and when the budget is spent, call `probe_done` with what you have — mark a strand's ceiling as "unprobed" rather than asking an eighth question.
