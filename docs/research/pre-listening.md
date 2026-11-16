# Get ready: what to study before a video you cannot yet follow (2026-11-07)

**Question.** The owner, looking at a 7-minute podcast episode the app rated "Too hard for now" (41 of every 100 words known, 118 lines, 1,127 words, 284 not studied): "What if we used AI to analyze and make pre-content for me to use and learn from. I do the content and then once I feel a bit more comfortable I finally watch the video, and of course I won't magically understand everything, but I should be drastically so much better at hearing what is being said and noticing what the speaker(s) are talking about."

Watch already had two things to do before a video: the pre-teach list (the unknown words that recur, by frequency, E53) and the study sections (a model picks parts and words to type, E62). Neither says what the video is about. What should a model write before a hard video, in what order, and what should the learner do with it?

## What the evidence says

- **Knowing the topic helps more than knowing the words.** Chang and Read (2006) gave 160 Taiwanese learners of English one of four kinds of support before a listening test: a preview of the questions, hearing the passage twice, information about the topic given in advance, or the passage's key words taught beforehand. Information about the topic gave the largest gain, hearing it twice the next; the key words taught first gave the least, and the weaker listeners gained most from the topic. Chang (2007, _System_ 35) looked at vocabulary preparation alone and found a small gain in comprehension and a larger one in confidence, and only the learners given a week with the words did better than those given half an hour.
- **A short description of what the video will show, read before it, lifts comprehension.** Herron (1994): an "advance organizer", a few sentences describing the video's main scenes, read before each video in a French class, raised comprehension of the video. Herron, Cole, York and Linden (1998): an organizer made of statements beat one made of questions for what students retained. Herron, Hanley and Cole (1995) found a description with pictures beat the description alone. Chung (1999): organizers and captions together beat either alone for Chinese college students watching English video.
- **Predicting, then checking, is a listening skill that can be taught.** Vandergrift and Tafaghodtari (2010): a semester of a cycle that starts with predicting what will be said, then listening, checking the prediction and listening again, improved listening more than the same listening without the cycle, most for the less skilled listeners.
- **Below the coverage floor the speech is noise.** About 95% of the words known is where listening works on its own (van Zeeland & Schmitt 2013); the app's Listen floor is 93%. At 41% no amount of preparation makes the video comprehensible input in that sense. What preparation can do is turn parts of it from noise into speech the ear can anchor: the topic, the order of what is said, and a handful of words to listen for.
- **Graded input about the same content.** A short version of the video written at the learner's level is comprehensible input about the content the video carries (the Read task's rule: written against the learner's words, measured after, written again when too hard). No study tested a level-graded summary written by a model before an authentic video; this is the app's own combination of topic preparation and graded reading, and the note on the Watch screen says so.

## What this means for the app

1. **Lead with the content, in English.** What the video is, who speaks, what they talk about, part by part in order, as statements (Herron et al. 1998), each part anchored to real lines so it has a time range. This is the topic preparation that helped most and the prediction the learner then checks against the video.
2. **Then the content in the language, at the level.** Five to eight short sentences, spoken by the Listen voice, every word tappable, the English behind a switch (hear it first). Glossed and measured like a Read episode; written again once when under the 92% floor the Read task uses, with the hard words named; kept whatever comes back, with its shares shown (what the learner knows, what the level expects).
3. **Then the words to listen for, typed.** Six to twelve words or short phrases that carry the video, each copied from a real line (the program checks it is there), each heard in its line and typed into it (retrieval first, P3; the shared gap drill of the study sections). Misses go to Review and the lines come back in Listen, so the words get the time Chang (2007) found they need.
4. **Then the video, line by line.** The briefing is offered first when the video is under 88% known (the app's own line between "within reach" and "hard"), and as a quiet offer otherwise. Nothing is gated: a learner can watch without it.

What the model is for: judging what the video is about and which words carry it, and writing a short graded text. What it is not for: it never writes or corrects a caption line (E27, E44); a key that is not a run of words of its line, as written, is dropped; a part whose lines do not exist, overlap another or come out of order is dropped.

## What was built

- **Get ready**, on a prepared video's preview (captions in the language only), under the coverage cards: one cheap-slot request (`src/server/watch-prep.ts`, `src/core/watch-prep.ts`) returns `about`, `parts`, `keys` and `summary`. A second request, for the summary only, when the first is under the floor. Kept in `videos/prep/<id>.json` with its cost (E1, counted under Videos at Settings → Spending), made again only with "Get ready again".
- **Three steps on the preview:** What it's about (the English, then the parts with their times), The short version (spoken, tappable, the English behind a switch, the two shares named), Words to listen for (each with its meaning and its line, spoken; "Type them" runs the gap drill). A finished drill earns XP as a lesson's typed reps, counts as Watch minutes, sends misses to Review and their lines to Listen, and marks the briefing done with the score and the day.
- The hard bands' lines on every video card now say "get ready first".
- The Watch sources note carries the before-listening studies, what they did not show, and which numbers are the app's own.

## Not built, and open

- **Pictures.** Herron, Hanley and Cole (1995) found pictures added to the description. A frame of the video per part would need the video's frames, which the app does not fetch; the card shows YouTube's thumbnail only. Deferred.
- **Czech captions** (E41) are briefed from the Slovak rendering of the lines (E53), which is now kept on each line when a video is prepared. The words to listen for are Slovak words a speaker would use where the video's speaker says the Czech; the screen says so, and those lines do not go to Listen.
- **Does it work?** The watch log keeps the lines got on the first unaided listen (`gotFirst`). After a few briefed and unbriefed watchings at similar coverage, compare them; nothing in the app claims the gain yet.
- **The summary can be wrong.** A model's short version may misstate what the video says. The parts in English sit above it and the lines are a tap away in the video, so it can be checked; the screen says the model wrote it.

## Sources

- Chang, A. C.-S., & Read, J. (2006). The effects of listening support on the listening performance of EFL learners. _TESOL Quarterly_, 40(2), 375–397. https://doi.org/10.2307/40264527
- Chang, A. C.-S. (2007). The impact of vocabulary preparation on L2 listening comprehension, confidence and strategy use. _System_, 35(4), 534–550. (Not in the sources registry: Crossref lists the author under a name the checker does not match.)
- Herron, C. (1994). An investigation of the effectiveness of using an advance organizer to introduce video in the foreign language classroom. _The Modern Language Journal_, 78(2), 190–198. https://doi.org/10.1111/j.1540-4781.1994.tb02032.x
- Herron, C., Hanley, J. E. B., & Cole, S. P. (1995). A comparison study of two advance organizers for introducing beginning foreign language students to video. _The Modern Language Journal_, 79(3), 387–395.
- Herron, C., Cole, S. P., York, H., & Linden, P. (1998). A comparison study of student retention of foreign language video: declarative versus interrogative advance organizer. _The Modern Language Journal_, 82(2), 237–247. https://doi.org/10.1111/j.1540-4781.1998.tb01197.x
- Chung, J.-M. (1999). The effects of using video texts supported with advance organizers and captions on Chinese college students' listening comprehension: an empirical study. _Foreign Language Annals_, 32(3), 295–308. https://doi.org/10.1111/j.1944-9720.1999.tb01342.x
- Vandergrift, L., & Tafaghodtari, M. H. (2010). Teaching L2 learners how to listen does make a difference: an empirical study. _Language Learning_, 60(2), 470–497. https://doi.org/10.1111/j.1467-9922.2009.00559.x
- van Zeeland, H., & Schmitt, N. (2013). Lexical coverage in L1 and L2 listening comprehension: the same or different from reading comprehension? _Applied Linguistics_, 34(4), 457–479. https://doi.org/10.1093/applin/ams074
