# Shadowing and the sound step (Zvuk)

*LangHarness research note, 8 November 2026.*

The question: how should the sound step (Zvuk, `docs/plans/chapter-arc.md` phase 7) train a learner's ear and mouth for one contrast, given what Olle Kjellin's tutorial *Quality Practise Pronunciation with Audacity* (v1.8.1, 2018) and Stephen Krashen's *Principles and Practice in Second Language Acquisition* (1982) say?

**Short answer.** Kjellin gives concrete settings and a clear method, but no controlled data: the tutorial says so itself (section 5). Krashen says little about pronunciation as such, but his affective-filter and comprehension points argue for short, low-pressure listening before speaking. The app adopts Kjellin's timing and his short-line rule, keeps a listening check before any repetition, and scores each line with the clarity bar Speak already uses. It does not adopt his advice to hold back all writing, or his "repeat-one" loop, for reasons below.

## What the tutorial says

- **Hear before you speak.** The learner saturates the ears with the model first, then repeats it aloud. Kjellin says the imitation circuits (mirror neurons) then guide the mouth. This is a neuroscience argument, and the tutorial gives no test of it.
- **Prosody first.** Rhythm and melody carry more of a listener's judgment than single vowels and consonants, so the learner should aim at them before the sounds (sections 2 and 3).
- **Short lines.** About two seconds is the best length for a practice sentence (section 16).
- **Gaps.** Between repetitions, 600 to 800 milliseconds of silence, "neither longer nor shorter", gives a comfortable rhythm to answer in unison (section 16, hint).
- **Repeat until it is automatic.** Kjellin's Repeat 1 setting loops one sentence hundreds of times; he keeps a six-times-in-a-row export for review (sections 4 and 16).
- **Few sentences.** For prosody, 20 to 30 sentences heard hundreds of times, not a long list (section 2).
- **Do not drill look-alikes in pairs.** "They should never be automated pairwise," because the twins then arrive together as a multiple choice (section 7). Put two similar things in their own contexts on different days.
- **Keep off the writing until you can speak** (section 8). Spelling misleads the ear in English, French, Swedish and Tibetan. Kjellin's own examples of regular spelling are Finnish, Hungarian, Spanish, Serbo-Croat and Japanese.

## What Krashen says

- **Comprehension first.** Output follows acquired competence and is not its cause (Chapter II). Listening to a message the learner can follow is what drives acquisition. That supports short, meaningful listening before any production.
- **The affective filter.** Anxiety blocks input. A required spoken answer, with a score, raises the filter for many learners. Krashen's Natural Approach (Chapter V) keeps the learner silent until ready and does not correct speech in conversation.
- **Error correction** is not a route to acquisition (Chapters II and III). The 2009 introduction to the book cites Truscott (1996, 1999) for that. Later meta-analyses of corrective feedback found it helps under some conditions. This note does not settle that, and the app's own correction design is covered in [desirable-difficulties.md](desirable-difficulties.md).
- **Minimal pairs** are warned against in Chapter IV, citing the same Hebbian reasoning as Kjellin. Chapter IV also says that a learned rule often does not reach unmonitored speech, so drilling a rule is weak evidence that the learner will say the sound.

## The evidence level

Kjellin's method rests on his teaching and on the mirror-neuron literature he cites. The tutorial's section 5 says plainly that "there are no hard data" on this method in classrooms. Krashen's claims about input are better tested (see [comprehensible-input.md](comprehensible-input.md)), but his book was not written about pronunciation. So the timing settings are a practical starting point, not a measured optimum, and the app should measure its own result before treating them as proven.

## What the app does

- **Timing from the tutorial.** A two-second model, a 700 ms gap (`SHADOW_GAP_MS`, inside Kjellin's 600 to 800), a recording cap of 6 seconds, three tries per line before it is left as not yet.
- **Short, verified lines.** At most six words, each a verified example sentence from the lexicon (P8), each holding exactly one of the two twins. The test `tests/sounds.test.ts` checks all of this.
- **A listening check first, capped at four items.** The twins meet only there, and only in a short, low-stakes check: a choice of the word heard, with the bridge line after a miss. This follows Kjellin's warning: the twins are not drilled as a pair after the check.
- **Scoring with the Speak bar.** The shadowed line is scored by transcript matching (`/api/pronounce`), so no Azure key is needed. "Clear" uses the same `PRON_CLEAR` threshold as Speak. Those thresholds are not changed here.
- **No writing first.** Shadowing is spoken and heard. The lines are shown as text while the learner says them, because the Slovak spelling is regular, so the case for hiding it is weaker than in Kjellin's examples. This is a judgment, not a tested result.

## What the app does not do, and why

- **No repeat-one loop.** The loop plays one line again and again without the learner choosing when. The app asks for three tries, then moves on, which keeps the learner answering rather than listening. Kjellin's loop is a good match for a self-study recording; the app's line-by-line flow is a better fit for an app that scores each attempt.
- **No drilled pairs.** The twins appear together only in the listening check. Mix-ups (E24) drill look-alike pairs on purpose, and the reason for that is in [mixups.md](mixups.md): contrast known confusions, do not introduce look-alikes together on day one. Kjellin and Krashen warn against the opposite, and the two positions are not reconciled here.
- **Only the vowel-length pairs so far.** The plan also asked for the soft consonant pair (de, te, ne). The lexicon has no verified twins for it (`ň`, `ď`, `ť` do not appear as entries), so the app does not invent one. It is left for when a verified pair exists.

## Open questions

- Does the 700 ms gap improve vowel-length accuracy for an adult in this app? That needs the scores logged over weeks, which the current build does not save. The result is on screen only.
- Is the clarity score sensitive to vowel length? Transcript matching only tells whether a word was recognized. It may not register a short á that the recognizer reads as a. Azure scoring would be the sound-level check, and it needs a key.
- Estonian also marks vowel length. The bridge line says so in general terms. A checked Estonian example pair would make the bridge concrete.

## Sources

- Kjellin, O. (2018). *Quality Practise Pronunciation with Audacity: The Best Method!* (version 1.8.1). Sections 2, 3, 4, 5, 7, 8, 16.
- Krashen, S. (1982). *Principles and Practice in Second Language Acquisition*. Chapters I to V. Revised introduction (2009).
- Russell, J. & Spada, N. (2006) and Li, S. (2010) on corrective feedback: cited from memory in the text above and not checked here; verify before relying on them.
