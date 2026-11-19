# Watch: write a sentence with the video's words

Status: agreed in chat on 2026-11-03 (the owner said yes to the recommended options). Built on branch `feat/watch-sentences`, stacked on `feat/czech-captions` because the Slovak-only rule depends on the caption language check there. Not merged.

## What the learner does

When a Slovak video ends, a step "Use the words" appears above the end-screen buttons. It shows up to three words from the video. For each word:

1. The Slovak line where the learner met the word is shown (the video's own text).
2. The learner writes one sentence that uses the word, in any form. No translation is shown yet.
3. The sentence is checked. The English meaning appears after the first try, whatever the result.
4. A rejected sentence shows one plain English reason and the corrected sentence, and the learner may try again. An accepted word locks.

## Decisions (the recommended options)

- **Where:** only at the end of a watching, not on its own page.
- **How many:** three words per video, at most.
- **Which words:** the words the learner tapped during the video first, in the order they appear in the video, then the video's pre-teach words. Duplicates are dropped.
- **Slovak videos only.** A video whose captions are Czech (`source.trackLang` differs from the profile) gives no words, so the step is not shown.
- **Checking:** first the program checks what it can see for certain (the sentence has two or more words, uses the word or a form of it by its stem, and the Slovak checker in `src/core/slovak-check.ts` finds no issue). Then one call to the cheap model slot judges the rest. A sentence that the program rejects never reaches the model.
- **Model rule when unsure:** the model answers `ok: true` and says in `why` what to check. It rejects only when it is sure the sentence is wrong. This is because of the accuracy risk in `docs/research/slovak-accuracy-eval.md`, where a strong model rejected correct Slovak.
- **XP:** five XP the first time a word is accepted for a video. Nothing for a repeat, a rejected try, or a cached answer. The meaning is shown only after a try, so there is no free help to price.

## Data

- Every model verdict is appended to `data/profiles/<lang>/media/sentences.jsonl`: `videoId`, `lemma`, `sentence`, `ok`, `corrected`, `why`, `model`, `at`.
- The same sentence for the same word on the same video is answered from that file. No second model call.
- Program-rejected sentences are not stored. They cost nothing.

## Out of scope for this step

- Review cards for the sentences. The words still reach the Review deck through the existing watch queue.
- Output minutes for the daily plan's strand balance. Watch minutes stay input.
- Cost accounting for the sentence checks in the usage report. The verdicts record their model, so this can be added later.
- Inflection checks from the lexicon. The stem match is approximate, and the model judges the rest.

## How it is verified

- Pure rules (target choice, the program checks, parsing the model's answer) in `tests/watch-sentences.test.ts`.
- The server step on a scripted engine: model call, cache hit, XP granted once, Czech video refused.
- Live check by the owner on the PC, because the cloud container cannot reach YouTube. The owner should check a Slovak video, a word, a correct sentence, and a wrong one.
