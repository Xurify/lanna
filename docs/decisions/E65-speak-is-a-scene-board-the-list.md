# E65. Speak is a scene board: the list and the sheet of the scene in hand (2026-11-07, branch `feat/speak-scene-board`)

**Why:** the owner did not like the Speak picker: nine identical cards in two columns, each with a "for you" pill (six of nine carried it, so it said nothing) and a "Step by step" half that looked like a second card. The page did not say who you meet, what you are there to do, or when you last said a scene.

**How to apply:**
- One list on the left, grouped by why a scene is offered: **This chapter** (the current chapter's scene), **For your goals** (the purposes' scenes), **More scenes**. The groups come from `speakState` (`why` on each `SpeakSceneEntry`, `src/core/speak.ts`), not from the client. A row is the title in the language, one line in English, and how many times it was said.
- Beside it, the sheet of the selected scene (`components/speak/scene-board.tsx`): the title, who you meet (the brief's first clause), your part (the scene's `task`), how it opens when the language has a script (the script's first tutor line, with an empty answer line for yours), the ways in, and the last time it was said. Below the sheet's container breakpoint the sheet opens inside the list, under its row, without repeating the title.
- One main button: "Speak it", or "Type it" when the page was opened typed or there is no speech-to-text key (the mic is not offered then). "Step by step" shows only for a scene that has a script in the running language (`scripted`); `/speak?mode=script` now looks the script up in that language, so a Russian or Estonian profile no longer opens a Slovak script.
- An unfinished scene is selected first and its main button is "Carry on". Keys: ↑ ↓ pick, Enter starts, Escape leaves.
