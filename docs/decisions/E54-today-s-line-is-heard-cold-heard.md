# E54. Today's line is heard cold, heard again after practice, and counts rather than grades (2026-11-05, branch `feat/daily-hooks`)

**Why:** the creator research ([research/creator-hooks.md](../research/creator-hooks.md), proposal 1) found that a payoff which arrives after an attempt holds attention, and that a before-and-after from the learner's own record shows change without a grade. The line is a daily first listen of about a minute, with no text shown before the answer.

**How to apply:**
- One sentence a day, from the dictionary's verified examples: five to twelve words, one or two glossed words the learner has not met (`src/core/line.ts`, `pickLine`). The day's sentence is seeded by language and day, and once heard it is kept in `line/log.jsonl`, so it never changes within the day. A sentence heard in the last fourteen days is not picked again.
- Nothing is shown before the answer, except the play buttons. The audio is the shared Listen audio (E1), and no model is called.
- The evening replay is offered only after the learner has practiced that day (XP, reps or a review), so the line never asks for a return visit by itself.
- The score counts words typed exactly. A word typed without its accent is marked apart and is not counted as caught. It is shown as "3 of 9 words", never as a grade or XP (E31).
- Time on the page counts as listening minutes (P9).
- The line is a task in the same frame as Listen and the lessons (`/line`, 2026-11-06): the sentence plays as the card opens, nothing is shown before the answer, and the result is the count as the figure with every word marked (caught in full, missed faded, a missing mark underlined). On Today it is a row above the plan, not a card, so the plan's Start stays the one next step (E4a).
- The last 14 days are a chart of two marks a day, the morning in the app's de-emphasis gray and the evening in the teal, joined when both are in. That is the emphasis form of the dataviz method: the pair passes the CVD and normal-vision separation checks on both themes, and the legend and today's direct labels carry identity besides the color. The same numbers sit in a table behind one button, so nothing is reachable only through the chart.
