# E98. A review card can hide up to three words, once the word has been answered (2026-11-11, branch `feat/review-longer-blank`)

The owner: the blank is only one word; make it one to three words as a harder option, where the sentence has them.

**Why:** a blank of one word tests the ending. A blank of "od stanice" also tests the preposition that decides the case, and a phrase cannot be answered by recognizing one familiar form. It is desirable difficulty (P3) that the learner chooses, and it costs nothing, because the sentences are already in the deck.

**How to apply:**
- **Setting:** Review's dock has Blank: 1 word, 1–2, 1–3 (`blankWords` in the deck's settings, default 1, so nothing changes until it is turned up). It applies from the next card.
- **Length per rep:** a card that is new always hides one word (it is met before it is tested, and may be answered by choosing). After that each rep hides between 1 and the limit words, picked from the card id and its rep count, so the same rep always shows the same blank and the next rep may differ.
- **Which words:** the card's word plus neighbors, left or right alternating, never across a comma or other clause end; a short sentence or a word beside a comma gets a shorter blank (`blankAround`, `src/core/review.ts`). The card still stores one word; the blank is computed from it, so no card changes.
- **Grading:** the whole blank is graded as one answer, rated and scheduled as before. The grammar bookkeeping (first tries, mix-ups, weak spots, the "why" under a miss) looks only at the card's own word, found by position in what was typed; a wrong neighbor misses the card but does not count against the drill. The log line carries `words` when more than one.
- **Letter keys open on a key (owner, 2026-11-11):** on Review the row of special letters is closed by default where a keyboard is the main input, and the key left of 1 (`Backquote`, whatever it types on the layout) opens and closes it; the choice is kept in this browser (`lh-review-letters`). The row's space stays reserved, with a line saying which key opens it, so opening it moves nothing. Under a finger (`pointer-coarse`) the row is always shown. The other screens that type (lessons, Listen, placement) keep their always-shown row.
- **Not changed:** Choosing, the hints, FSRS, the daily budget.
