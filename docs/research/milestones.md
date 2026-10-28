# When can I…? — the research behind the milestones page

*LangHarness, 2026-10-28. Code: `src/core/milestones.ts` (the model), `src/server/milestones.ts` (the evidence), `components/milestones/milestones-page.tsx` (the page).*

Xurify asked for a calculator that "has a memory and a brain, so it knows what we know" and says when they will "understand most of what I hear when I watch a Slovak YouTube video. Right now I get a lot of words, but I can't put them together into meaning fast enough, unless it's something I heard countless times or something basic."

That sentence names two different gaps, and the research treats them separately.

## 1. Words: lexical coverage

Comprehension rises roughly in a straight line with the share of running words a reader or listener knows (Schmitt, Jiang & Grabe 2011). The thresholds that matter:

| Material | 95% of running words | 98% | Source |
|---|---|---|---|
| Everyday conversation | ~2,000–2,500 word families | ~6,500 | Adolphs & Schmitt 2003 (CANCODE); Nation 2006 |
| TV programmes (incl. vlogs) | 3,000 (+ proper nouns) | 7,000 | Webb & Rodgers 2009a, 88 programmes |
| Films | 3,000 | 6,000 | Webb & Rodgers 2009b, 318 films |
| Newspapers | 4,000 | 8,000 | Nation 2006 |
| Novels | 4,000 | 8,000–9,000 | Nation 2006 |

How much coverage is "enough": van Zeeland & Schmitt (2013) found listeners followed informal narratives adequately at 95% and many at 90%; listening tolerates a little less than reading because intonation and context carry meaning. For unassisted reading the figure is 98% (Hu & Nation 2000; Laufer & Ravenhorst-Kalovski 2010), 95% with help such as a dictionary tap.

**Slovak adjustment.** All of those counts are English *word families*. A Slovak lemma is finer (národ / národný / národne are three lemmas; each aspect pair is two verbs), and Slavic frequency dictionaries show the top 5,000 lemmas covering about five points less of running text than the top 5,000 English lemmas. The app raises every count by a quarter (`INFLECTION_FACTOR`). This is an assumption and the page says so.

**What the learner has.** The deck and the word lessons give the words *met* (with FSRS stability for the *solid* ones). The level — placement when there was one, else the map — credits the commonest words up to Milton's vocabulary size for that level (Milton 2009: A2 1,500–2,500, B1 2,750–3,250, B2 3,250–3,750 lemmas; raised a quarter here). "Commonest" is by how often each dictionary word's forms occur in the dictionary's own 30,000 example sentences (170,000 running words), a unified order the per-part-of-speech ranks cannot give. The Listen task also reports how many of its fully-known sentences were in fact understood, so the credit can be seen earning (or losing) its trust.

A measurement tried and dropped: coverage of the dictionary's sentences by the whole 7,000-word dictionary is only 91% (Tatoeba sentences reach outside it), so it cannot stand in for the published genre curves; it is used only for the frequency order and the "next words" list.

## 2. Speed: parsing automaticity

Knowing a word is not retrieving it inside the ~400 ms a speaker gives you. Segalowitz (2010) separates *fluent* processing (fast and stable) from merely correct processing; this is exactly the gap Xurify describes — familiar phrases are automatic, the rest is not. DeKeyser (1997) shows processing speed improving with practice along a power law over weeks.

The app measures it as **words a minute of understanding**: in the Listen task, the words of a sentence divided by the time from its first sound to the right meaning picked (never less than the audio itself; replays and a peek at the text count against it; wrong and peeked answers do not count at all). In the Watch task, the segments understood on the first unaided pass at the speaker's real rate. Natural Slovak speech runs about 150 words a minute (Slovak words are longer than English ones, so fewer of them per minute).

Each situation demands the speaker's rate discounted for its support: pictures and action (×0.9; CEFR B1: "films in which visuals and action carry much of the storyline"), subtitles (×0.75), a live conversation where you can ask again (×0.7).

**Hours to a speed.** Until the learner's own Listen sessions give a trend (eight sessions across a week; least-squares slope of words a minute per study hour, clamped to half and twice the prior), speed follows a ladder anchored to the CEFR listening descriptors and the app's guided-hours table: A1 35, A2 60, B1 95, B2 135 ("the majority of films in standard dialect"), C1 160 words a minute.

## 3. The date

Words grow at the deck's new words a day plus about five from Listen and Read (planned), or at the deck's measured growth over the last two weeks. Speed grows with study hours at the planned minutes × days, or at the real minutes a day over the last two weeks. The milestone's date is the later of the two, and the page names which gap decides — for a reader who "gets the words" it is speed, and the advice is input at pace (Listen, Watch), not more vocabulary.

## Sources

- Adolphs, S. & Schmitt, N. (2003). Lexical coverage of spoken discourse. *Applied Linguistics* 24(4).
- Council of Europe (2020). *CEFR Companion Volume*: listening and reading descriptors.
- DeKeyser, R. (1997). Beyond explicit rule learning: automatizing second language morphosyntax. *SSLA* 19(2).
- Hu, M. & Nation, P. (2000). Unknown vocabulary density and reading comprehension. *Reading in a Foreign Language* 13(1).
- Laufer, B. & Ravenhorst-Kalovski, G. (2010). Lexical threshold revisited. *Reading in a Foreign Language* 22(1).
- Milton, J. (2009). *Measuring Second Language Vocabulary Acquisition*. Multilingual Matters.
- Nation, I.S.P. (2006). How large a vocabulary is needed for reading and listening? *Canadian Modern Language Review* 63(1).
- Schmitt, N., Jiang, X. & Grabe, W. (2011). The percentage of words known in a text and reading comprehension. *Modern Language Journal* 95(1).
- Segalowitz, N. (2010). *Cognitive Bases of Second Language Fluency*. Routledge.
- Tegge, F. (2017). The lexical coverage of popular songs in English language teaching. *System* 67.
- van Zeeland, H. & Schmitt, N. (2013). Lexical coverage in L1 and L2 listening comprehension. *Applied Linguistics* 34(4).
- Webb, S. & Rodgers, M.P.H. (2009a). The vocabulary demands of television programs. *Language Learning* 59(2). (2009b). Vocabulary demands of movies. *Applied Linguistics* 30(3).
