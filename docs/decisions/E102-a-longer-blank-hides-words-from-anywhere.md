# E102. A longer blank hides words from anywhere in the sentence, and the day's list never gives the open card away (2026-11-11, branch `fix/review-answered-hides-blank`)

The owner, on a screenshot of a relearning card: "it literally tells us the answer here" (Answered today showed "záujem" under the blank asking for it); then "that one was 2 words 'záujem medzi', so we should fix the history"; then, on E98's blanks: "Is it always like this? Together or will it even be missing words that are split up? I feel like the latter would be better… Like more random and not always the same".

**Why:** a missed card comes back minutes later in the same sentence, and the list under it showed the missed answer, so the second try was reading, not recall. The list also marked only the card's own word, so a two-word miss looked like a one-word one. And E98's blank was always the card's word and its neighbors, so a card showed the same phrase shape every time and the sentence around it gave the rest away.

**How to apply:**
- **Which words:** the card's word plus up to two other words of the sentence, picked at random (seeded by the card and its rep count, so a reload shows the same blank and the next rep a new one), on either side of a comma, adjacent or not. Numbers and punctuation are never hidden (`blankAround`, `src/core/review.ts`).
- **One field per hidden word,** in the sentence where the word was. Space moves to the next field, Backspace in an empty field and the arrow keys at a field's edge move back and forth. The fields are joined by spaces and graded as one answer, so the rating, the grammar bookkeeping by the card's word (E98) and the server are unchanged. After the answer each word is colored on its own, so the wrong one shows.
- **The log keeps where the words were** (`spans` beside `words`), and Answered today marks every hidden word. A line logged before this, or whose sentence changed, marks the card's word alone.
- **While a card is open, Answered today hides its words:** every whole word of the open blank, in every line, is a shaded box of the same width until the answer is checked, so nothing moves when it appears. Screen readers hear "hidden".
- **Not changed:** the Blank setting and its limits, a new card's single word, Choosing.
