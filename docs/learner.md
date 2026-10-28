# The learner this app is built for

LangHarness has one real user so far: Xurify, who is also its owner. Everything in the daily plan, the bridges and the difficulty rules was shaped by their profile and by what their own sessions showed. A second learner would need the same evidence gathered before the defaults are trusted.

## Profile

| | |
|---|---|
| Target language | Slovak (Russian is a placeholder profile only) |
| Languages known | Estonian (native), English (explanation language), some Russian; the setup lets them pick more and rate each on the CEFR |
| Explanation languages | Up to two. Xurify asked for this on 2026-10-28: "the more I see the language(s) the more I can learn" |
| Reads | About B1 (placement 2026-10-26) |
| Produces | A1 to A2 endings. Case endings come from pattern memory, not rule |
| Typical misses | Genitive after *do* / *z*, animate accusative, numbers 5 and up, imperfective aspect |
| Target | B2 (the default goal; about 650 guided hours from zero) |
| Time | Set in setup; the 90-minute cap was removed because "the 90-minute cap is bad for power learners" (max now 600) |

## The parsing-speed gap

Xurify's own diagnosis (2026-10-28, the milestones thread): "I get a lot of words, but I can't put them together into meaning fast enough, unless it's something I heard countless times or something basic."

That is a speed gap, not a vocabulary gap, and the app treats the two apart: the milestones page measures words (coverage) and speed (words a minute of understanding from Listen and Watch) separately and reports which one is binding. The fluency strand (Say it faster, Read it faster) and the Listen and Watch tasks exist for this gap.

## Drop-off evidence

From a review of their real sessions on 2026-10-27:

- Every practice and story session stopped at a field labelled "Your thinking" that asked for reasoning. Answer-first, reasoning optional, is now the rule.
- The confidence slider was left at its default 18 of 24 times. Confidence is now behind "Explain my reasoning".
- After about 15 placement questions they asked "Can we do something fun?". Placement is capped and the chat placement was replaced by a four-screen setup with a short drill.
- They asked "why do you think I am at B1?" and wanted evidence, not a verdict. Results now show the sentences.
- A 70-minute session spent 23 minutes on placement, 37 waiting at the plan approval and 9 teaching. The plan approval gate is gone.
- A "Why?" that left the lesson and wiped it on return was hated ("I want it to still be there"). Why? opens in place and lesson state persists until finished or closed.

## What they value

- Voice and audio (ElevenLabs; an earlier voice-first app of their own). Every sentence has a play button and the Speak task is spoken.
- Sentences in context (they used Clozemaster). The Review deck is a cloze over real sentences.
- Struggle. "Things should be hard and the user should face struggle because that is where the learning happens." See [DECISIONS.md](DECISIONS.md) P3.
- Honest estimates with sources, and a cost view (they were pleased cost is tracked: "I love that. Where can I view that myself?" → Settings → Spending).
- Precise, Socratic use of the model to understand their understanding, not chatty tutoring. They found chat-based goal discovery "ancient and inefficient" and the fixed grammar placement "clearly wrong... I don't even think it uses AI when this test should be dynamic and kinda Socratic."
- Everything saved for reuse in a future app of their own.

## How they review

They skim, then look at screenshots closely and notice small things (a button's bottom border, a sparkles icon, an answer box too small, unlabelled prose chips). They want structure and alignment like Duolingo's, custom controls rather than native widgets, no layout shift, and they will say "you missed so much" when a UI pass was not walked state by state. Run every screen state at both window sizes before reporting.

## Status of their own profile (2026-10-28)

Their PC profile had not yet gone through the new setup (the home page redirects to `/start`), so the Today screen, daily plan and most tasks built on 2026-10-28 are unverified by them. See the unverified list in [CHANGELOG-2026-10.md](CHANGELOG-2026-10.md).
