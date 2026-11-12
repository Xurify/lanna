# E51. The miss judge reads the check so far, and names a repeated mistake (2026-11-05, branch `feat/placement-repeated-mistakes`)

**Why:** the owner asked whether their answers reach the AI for a real analysis rather than right and wrong. The judge of a typed miss saw only that one item, so its note could explain the miss but could never say it was the same mistake as two answers ago.

**How to apply:**
- `judgeAnswer` gets the check's earlier answered items (the last twelve): each with its rung, sentence, meaning, what was typed, the form, right or MISS, and the earlier note. The item being judged is never in its own history.
- The prompt decides `accept` on this answer alone. The note names a repeated mistake only with the earlier form it repeats ("as with <form>"), so the learner can check the claim. One miss of another kind is no pattern, and an earlier right answer on the same form counts against one.
- Still one cheap call per typed miss and none on a match (P7). The note may run to 200 characters (it was 160) to fit the earlier form.
- The judge also returns `repeat`, the earlier miss as typed. The server keeps it only when it matches a miss the learner really typed in this check, so an invented pattern never reaches a weak spot.
- The edge tutor's brief carries each miss's judge note and its REPEATS mark, and the prompt treats a repeat as a likely misconception worth a question. Its verdict then counts toward the level as before.
- A weak spot's evidence is the note of a miss that repeats an earlier one, when there is one; else the first miss's note; the tutor's verdict still wins over both.
