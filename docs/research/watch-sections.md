# Study sections: turning part of a video into practice (2026-11-07)

**Question.** The owner: "This is currently only manual, but I think we should have a feature that uses AI to do a smart analysis and auto generate a section(s) and create that into exercises that we could do." Watch already ranks stretches of a video without a model (E52), but a stretch is only listened to. What should a model add, and what should the exercises be?

## What the evidence says

- **Language-focused learning belongs next to input, not instead of it.** Nation's four strands give it about a quarter of the time ([comprehensible-input.md](comprehensible-input.md)). A video is meaning-focused input. A few minutes spent on the forms of one of its parts is the language-focused strand, with the context the learner just heard.
- **Focus on form inside meaning.** Long's "focus on form" (1991) and the work that followed it find form-focused work most useful when it is attached to input the learner has just processed for meaning. Isolated drill is less useful. The section is that input.
- **Retrieval beats re-exposure.** Producing a word from memory is the stronger test and the stronger practice. Help must be graded and priced ([desirable-difficulties.md](desirable-difficulties.md), P3). A typed gap in the real line is retrieval with the full sentence as context.
- **Involvement load.** Laufer and Hulstijn (2001): a task that makes the learner need the word, search for it and fit it into a context leads to more retention than reading it. Typing the missing word of a heard line covers need and evaluation.
- **Spacing.** A miss is worth seeing again at a gap. The app already has two spacers: the Review deck (words) and Watch lines in Listen (E56). Section misses should feed both, not a third queue.

## What the model is for, and what it is not for

A model can judge what a stretch is about, and which few words in it are worth a beginner's effort: words that carry the meaning, come back, and fit the level. Word frequency alone does not see that. The local fragment score (E52) cannot name a topic or say why a stretch is worth the time.

A model is **not** trusted to write the language (E27, E44). Every exercise is built by the program from the real caption lines and their glossed tokens. The model only returns line numbers and the words to practice, and each word must be a word of that line, or it is dropped.

## What was built

- **Find sections** on a prepared video's preview (captions in the language only). One request on the Cheap slot sees the numbered lines, their English and the words the learner has not met. It returns up to three sections, each with a title, one line on why it is worth studying, and the words to practice. The answer is checked against the lines, kept under `media/sections/<id>.json` with its cost, and never asked again unless the learner asks to find new ones.
- **Practice a section:** each word becomes a typed gap in its real line, with the line spoken. The first miss shows the first letter and the line's English. The second miss shows the answer and the word's meaning. "I don't know" is a miss. XP follows the lesson rule for a typed rep (half when accents only or helped).
- **Misses come back:** missed words go to the Review deck (when the dictionary has them), and their lines join the Watch lines that come back in Listen.

## Sources

- Nation, I.S.P. (2007). The four strands. _Innovation in Language Learning and Teaching_, 1(1), 2–13.
- Long, M.H. (1991). Focus on form: A design feature in language teaching methodology. In de Bot, Ginsberg & Kramsch (eds.), _Foreign Language Research in Cross-Cultural Perspective_, 39–52.
- Laufer, B. & Hulstijn, J. (2001). Incidental vocabulary acquisition in a second language: the construct of task-induced involvement. _Applied Linguistics_, 22(1), 1–26.
- Karpicke, J.D. & Roediger, H.L. (2008). The critical importance of retrieval for learning. _Science_, 319, 966–968.
