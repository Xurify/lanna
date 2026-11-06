# The data corpus: everything the app generates stays on disk

Rule E1 in [DECISIONS.md](DECISIONS.md): anything the app pays for (audio, tutor turns, explanations, stories, translations) and anything the learner produces (answers, recordings) is written under `data/` in open formats, indexed, and reused before it is ever regenerated. The owner wants it "extremely organized, even overly organized and easy to find" so it can seed a future app. Built 2026-10-27 in the "Save all generated content for reuse" thread.

`data/` is gitignored. Every folder gets a README written by the app at boot (`ensureReadmes`), so `data/README.md` is the place to start on a real profile.

## Layout

| Path | What | Written by |
|---|---|---|
| `data/audio/<lang>/<voice>/<slug>-<key12>.mp3` + `data/audio/index.jsonl` | The audio library: one clip per text and voice, named after what it says. Legacy `data/cache/audio/<sha256>.mp3` clips were migrated once and their texts recovered by hashing known sentences | `src/store/corpus.ts` |
| `data/profiles/<lang>/progress.json` | XP, streak, days (with minutes per activity), unit evidence, the learner goal (level, minutes, purposes, languages, levels, placement) | `src/server/lesson.ts` |
| `data/profiles/<lang>/lessons/<day>.jsonl` | Every rep of every lesson, placement and Listen session: sentence, answer, given, verdict, hint, timing | lesson log |
| `data/profiles/<lang>/lessons/why-index.json` | Why? explanations by sentence + answer, so a repeat Why? reopens the chat with no model call | `src/server/why.ts` |
| `data/profiles/<lang>/chats/` and `chats/trash/` | Tutor chats with per-turn token usage (`turns`); deleted chats move to trash | `src/store/chats.ts` |
| `data/profiles/<lang>/review/` | FSRS-5 cloze deck and `log.jsonl` (with `hints` and `picked` since the difficulty pass) | review store |
| `data/profiles/<lang>/stories/<id>.json` + `index.jsonl` + `reads.jsonl` | Robo in Bratislava episodes with glossed tokens, questions, cost, every read | `src/store/stories.ts` |
| `data/profiles/<lang>/videos/<id>.json` + `index.jsonl` + `captions/` + `watches.jsonl` + `sentences.jsonl` | Watch task: raw caption track, lines, translations, questions, every watching with per-line stats, the model's verdict on each sentence written at the end | `src/store/videos.ts` |
| `data/profiles/<lang>/speak/<id>.json` + `<id>/NN.wav` + `index.jsonl` | Spoken scenes with the learner's own recordings | `src/store/speak.ts` |
| `data/profiles/<lang>/fluency/log.jsonl` | Say-it-faster and re-read rounds (words a minute, clarity) | `src/server/fluency.ts` |
| `data/profiles/<lang>/cheatsheets/<id>.json` + `trash/` | Cheatsheets: title, sections and their phrases; every version an edit or an add replaced goes to `trash/`; exported as `cheatsheets.json` | `src/store/cheatsheets.ts` |
| `data/profiles/<lang>/milestones.json` | Custom "When can I…?" situations mapped once by the cheap slot | `src/server/milestones.ts` |
| `data/export/<stamp>/` | `npm run corpus:export`: summary, audio, sentences, lessons, dialogues, explanations, review, stories, spoken, with a README | `src/server/corpus-export.ts` |

## Rules for new features

- Cache to `data/` before calling an API; a second request for the same thing makes no model or TTS call (Read reuses the newest unread episode, Watch never re-prepares a video, Why? reuses by sentence + answer).
- Keep the TTS cache key (`audioKey`) stable or old clips become unreachable.
- Add an index line and a README entry, and extend the export.
- Keep log line shapes stable: the milestones page reads Listen timing and `videos/watches.jsonl`; Speak and Watch add their own day counters next to `speaks`, `rereads`, `fasts`, `watches`.
- Cost truth is each chat's `turns` log priced at read time (`src/server/pricing.ts`), shown at Settings → Spending. Story episodes, speak scenes and custom milestones are counted; check new model calls appear there.
- Tests use a throwaway data folder (`NODE_ENV=test` + `LH_DATA_DIR`), never the real profile.
- The Slovak lexicon (`curriculum/slovak/lexicon.json`) changes only through `scripts/merge-lexicon.mjs <shipped> <fresh>`. Card and lesson ids are `word#position`: a raw export that reorders or drops examples points existing cards at other sentences, and one that drops `rejected` flags puts reviewed sentences back in use (what PR #60 did, restored 2026-11-01).
