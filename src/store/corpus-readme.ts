/**
 * The README files the corpus store writes next to the data (store/corpus.ts
 * ensureReadmes). Plain Markdown, no app knowledge needed to read the
 * folders: this is the map someone opening <data>/ for the first time
 * (or Xurify in a year, building something new from it) should find.
 */

const ROOT = `# LangHarness data

Everything the app generates or the learner produces lives in this folder,
in open formats (JSON, JSON Lines, MP3). Nothing here is regenerated when it
already exists: audio is spoken once per sentence, a repeated "Why?" reopens
its chat, and every lesson, answer and tutor turn is written down. This folder
is the corpus for whatever you build next.

## Where things are

| Folder / file | What it holds | Format |
|---|---|---|
| \`audio/\` | Every spoken clip, named after its text, with \`index.jsonl\` listing text, voice, engine and date per clip | MP3 + JSON Lines |
| \`profiles/slovak/\` | Everything about learning Slovak (one folder per language) | see its README |
| \`profiles/slovak/chats/\` | Every tutor session: Learn, Talk, Story, Why?, Practice. Full transcript, tool calls, token usage per turn | one JSON per chat |
| \`profiles/slovak/chats/trash/\` | Sessions you deleted in the app. Kept here, never destroyed | one JSON per chat |
| \`profiles/slovak/lessons/\` | Every finished lesson and blitz: every sentence shown, your answer, the verdict, the hint used | JSON Lines per day |
| \`profiles/slovak/lessons/why-index.json\` | Which chat answered "Why?" for which sentence, so the question is paid for once | JSON |
| \`profiles/slovak/stories/\` | Every graded story episode written for the Read task, with every word glossed, the questions and what it cost; \`index.jsonl\` lists them, \`reads.jsonl\` logs every reading | JSON + JSON Lines |
| \`profiles/slovak/videos/\` | Every YouTube video prepared for the Watch task: the caption track as fetched (\`captions/\`), every line with its times, translation and glossed words, the pre-teach words and the questions; \`index.jsonl\` lists them, \`watches.jsonl\` logs every watching (lines understood on the first listen, replays, the check) | JSON + JSON Lines |
| \`profiles/slovak/speak/\` | Every spoken scene from the Speak task: each line (the tutor's with its meaning, yours with how it arrived), every repair prompt, the end summary and what it cost; your own recordings in \`<id>/\`; \`index.jsonl\` lists the scenes | JSON + WebM/Opus + JSON Lines |
| \`profiles/slovak/fluency/\` | The speed strand's log: every timed re-read (words a minute) and every "say it faster" round (each pass's time, window, what was heard, how clearly it was said) | JSON Lines |
| \`profiles/slovak/review/\` | The spaced-review deck: \`cards.json\` (every card and its memory state), \`log.jsonl\` (every answer), \`meta.json\` (settings) | JSON + JSON Lines |
| \`profiles/slovak/progress.json\` | XP, days practised, each unit's lessons and accuracy | JSON |
| \`profiles/slovak/graph/\` | The knowledge graph the tutor extracted from your sessions (nodes, chains, sources) | JSON Lines ledgers |
| \`profiles/slovak/jobs/\` | Background agent jobs (research, extraction) and their usage | JSON |
| \`profiles/slovak/debug/\` | Raw provider stream recordings, only when debug recording is on | JSON Lines |
| \`export/\` | Clean, app-independent snapshots made by \`npm run corpus:export\` (see below) | JSON |
| \`settings.json\`, \`profile.json\`, \`prompts/\` | Your preferences, the active language, and prompt overrides. No secrets | JSON / Markdown |

API keys are never in this folder (they live in \`auth.json\` / \`.env.local\`
next to the app).

## Getting a clean copy for reuse

\`\`\`
npm run corpus:export
\`\`\`

writes \`export/<date>/\` with one normalized file per kind of content
(sentences, lessons, dialogues, explanations, audio catalog, review history,
a usage summary) and a README describing each field. The raw folders above
stay untouched; the export is a view you can hand to another program.

## Keeping it safe

This folder is the only copy. Back it up (it is small apart from \`audio/\`).
Deleting \`profiles/slovak/\` starts Slovak from scratch; deleting \`audio/\`
means paying for every clip again.
`;

const AUDIO = `# audio/

Every clip the app ever spoke, kept for good. A sentence is synthesized once
per (language, voice, exact text) and replayed from here afterwards, offline.

- \`index.jsonl\`: one JSON object per line, one per clip:
  \`key\` (sha256 of language + voice + text; the cache key),
  \`lang\` (\`sk\`, \`ru\`), \`voice\` (\`female\` | \`male\`),
  \`tier\` (which engine spoke it: \`elevenlabs\`, \`edge\`, \`piper\`;
  \`unknown\` for clips moved from the old cache without a record),
  \`text\` (exactly what was spoken; \`null\` only when an old clip's text
  could not be recovered), \`file\` (path below this folder), \`bytes\`,
  \`createdAt\`.
- \`<lang>/<voice>/<text-slug>-<key12>.mp3\`: the clips, named after their
  text so you can find "dobry-den" by eye. \`unknown-<key12>.mp3\` is a
  clip whose text is not known.

To reuse: read \`index.jsonl\`, pick the lines whose \`text\` you need, play
the \`file\`. ElevenLabs clips are the best quality; filter on \`tier\`.
`;

const PROFILE = `# One language profile

Everything about learning this language. Each sub-folder has its own README
where the format is not obvious.

- \`chats/\`: every tutor session (one JSON per chat). See \`chats/README.md\`.
- \`lessons/\`: every finished lesson with every answer. See \`lessons/README.md\`.
- \`stories/\`: every story episode written for the Read task. See \`stories/README.md\`.
- \`videos/\`: every YouTube video prepared for the Watch task. See \`videos/README.md\`.
- \`speak/\`: every spoken scene from the Speak task, with your recordings. See \`speak/README.md\`.
- \`fluency/\`: the speed strand's log (timed re-reads, "say it faster"). See \`fluency/README.md\`.
- \`review/\`: the spaced-review deck. \`cards.json\` is every card with its
  FSRS memory state; \`log.jsonl\` is one line per answer (card, what you
  typed, verdict, rating, when); \`meta.json\` holds settings and how many
  new cards each day introduced.
- \`progress.json\`: XP, streak days, and per unit how many lessons, reps and
  correct answers.
- \`graph/\`: the tutor's knowledge graph of what you know (append-only
  JSON Lines ledgers: nodes, chains, sessions, coverage; plus sources.json,
  positions.json, render-settings.json).
- \`jobs/\`: background agent jobs and their token usage.
- \`debug/\`: raw provider streams when debug recording is enabled.
`;

const LESSONS = `# lessons/

One file per local day, \`YYYY-MM-DD.jsonl\`, one JSON object per line, one
per finished lesson or blitz. Each holds:

- \`id\`, \`at\` (ISO time), \`day\`, \`unit\`, \`mode\` (\`lesson\` | \`blitz\` |
  \`placement\` | \`listen\` | \`speak\` | \`fluency\`), \`ms\`
- \`xp\`, \`correct\`, \`total\`, \`perfect\`, \`queued\` (words sent to review)
- \`reps\`: every exercise in order. Per rep: \`kind\` (\`choose\`, \`type\`,
  \`build\`, \`listen\`), \`unit\`, \`slug\`, \`lemma\`, \`gloss\`, \`sentence\`
  (the full Slovak sentence), \`translation\`, \`answer\` (the blanked form),
  \`given\` (what you wrote or picked), \`verdict\` (\`exact\`, \`accents\`,
  \`wrong\`), \`assisted\` (right only after the hint), \`trigger\` (the
  preposition that decides the case, when there is one), \`options\` (the
  four choices shown), \`mixed\` (from another unit), \`again\` (a miss asked
  again at the end).

\`why-index.json\` maps a (sentence, answer) pair to the chat that explained
it (\`chatId\`), with the answer you gave when you first asked and how often
the chat was reopened instead of regenerated. The explanation itself is in
\`../chats/<chatId>.json\`.

Lessons are built locally from the dictionary (no model call), so this log
is a record of what you practised and how it went, not of paid content.
`;

const CHATS = `# chats/

One JSON file per tutor session, named by its id. Fields:

- \`title\`, \`kind\` (\`practice\` for Talk, Story, Why? and Practice; absent
  for a Learn course), \`createdAt\`, \`updatedAt\`
- \`messages\`: the full transcript in order. \`role\` is \`user\`,
  \`assistant\`, \`toolResult\` or \`custom\`; assistant \`content\` is a list
  of blocks (\`text\`, \`thinking\`, \`toolCall\`). Slovak the tutor meant to be
  heard is written as \`\\\`say: …\\\`\` inside the text; those phrases are the
  ones in \`../../../audio/\`.
- \`turns\`: token usage per model turn (input, output, cache reads and
  writes, reasoning) with the model that ran it. Cost is derived from this
  at read time.
- \`tree\`: the lesson plan for a Learn course, when there is one.
- \`extractions\`: usage of the background graph extraction on this chat.

\`trash/\` holds sessions deleted in the app, unchanged. Move a file back up
one level to restore it.
`;

const STORIES = `# stories/

Graded reading texts written for the Read task: episodes of an ongoing
story at your level, each paid for once and kept here for good.

- \`<id>.json\` (e.g. \`ep-003-robo-na-trhu.json\`): one episode as written.
  \`title\`, \`episode\`, \`series\`, \`level\` (the level it was written for),
  \`chapter\`, \`theme\` (the setting it was asked to use), \`createdAt\`;
  \`sentences[]\`: \`sk\`, \`en\` and \`tokens[]\` (every word with the
  dictionary's \`slug\`, \`lemma\`, \`gloss\`, \`cat\`, \`gender\`, and \`fresh\`
  when you had not met it); \`questions[]\` (Slovak, three options, the
  \`answer\` index); \`newWords[]\` (the words it introduces on purpose);
  \`recap\` (one English line, used to write the next episode);
  \`coverage\` (share of running words you were expected to know),
  \`wordCount\`, \`drafts\` (2 when the first draft was too hard and was
  redone), \`usage\` (the model and tokens it cost; priced at read time in
  Settings → Spending).
- \`index.jsonl\`: one line per episode (id, title, level, theme, date, word
  count, coverage, new words, model), so the library lists without opening
  every file.
- \`reads.jsonl\`: one line per reading: \`storyId\`, \`at\`, \`day\`, \`ms\`,
  \`correct\`/\`total\` on the comprehension check, \`answers\` (the option
  picked per question, -1 = skipped), \`tapped\` (the words you looked up),
  \`queued\` (the words sent to the review deck), \`xp\`.

The sentences\' audio is in \`../../../audio/\` like every other clip.
`;

const SPEAK = `# speak/

Spoken scenes from the Speak task: a role-play said out loud with the
tutor, one file per scene, kept for good.

- \`<id>.json\` (e.g. \`sp-2026-10-28-cafe-k3f9ab.json\`): \`scene\`,
  \`sceneTitle\`, \`level\`, \`chapter\`, \`startedAt\`, \`endedAt\`, \`ms\`;
  \`turns[]\` in order: \`role\` (\`tutor\` | \`learner\`), \`text\` (Slovak),
  \`en\` (the tutor's meaning), \`prompt\` (a repair prompt on your last
  line: \`yours\`, \`hint\`, \`kind\` = case | verb | aspect), \`repaired\`
  (your next line fixed it), \`via\` (\`voice\` | \`typed\`), \`audio\` (your
  recording's file name in \`<id>/\`), \`pron\` (how clearly the line was
  said: \`engine\` = azure | match, \`accuracy\`, \`fluency\`, \`completeness\`,
  \`prosody\`, \`overall\` 0–100, \`words[]\` each with \`score\`, \`error\`
  and, from Azure, \`phonemes[]\`), \`at\`; \`summary\`: \`corrections[]\`
  (\`yours\` → \`right\`, \`rule\`, \`kind\`, \`lemma\`, \`slug\`), \`keep[]\`
  (phrases worth remembering), \`note\`; \`xp\`, \`queued\` (words sent to
  the review deck), \`usage\` (the model and every call's tokens; priced
  at read time in Settings → Spending), \`pron\` (the scene's average,
  lines scored, lines clear).
- \`<id>/01.webm\`, \`02.webm\`…: your own voice, line by line, as the
  browser recorded it (Opus). The transcript the app used is \`turns[].text\`.
- \`index.jsonl\`: one line per finished scene (lines said, prompts,
  repairs, corrections, model, XP).

The tutor's lines are spoken from \`../../../audio/\` like every other clip.
`;

const FLUENCY = `# fluency/

The speed strand: work on what you already know, against the clock.

\`log.jsonl\` holds one JSON object per line, one per round:

- \`mode: "reread"\`: a timed re-read of an episode from \`../stories/\`:
  \`storyId\`, \`at\`, \`day\`, \`words\`, \`ms\`, \`wpm\` (words a minute),
  \`question\` (which of the episode's questions was asked), \`right\`, \`xp\`.
- \`mode: "fast"\`: a "say it faster" round: \`reps[]\` per sentence
  (\`itemId\`, \`slug\`, \`sentence\`, \`translation\`, \`passes[]\` with each
  pass's \`ms\`, \`window\`, \`inWindow\`, \`made\` (in the window AND
  clear), and \`heard\`/\`match\`/\`pron\` (the pronunciation score, same
  shape as a spoken turn's) when the microphone was on), \`passesMade\`,
  \`sentencesMade\`, \`xp\`.
`;

const VIDEOS = `# videos/

YouTube videos prepared for the Watch task. The video itself is never
downloaded or stored (it plays in YouTube's own player); what is kept is
everything the app made of its captions, paid for once.

- \`<id>.json\` (the YouTube video id): \`title\`, \`channel\`, \`url\`,
  \`durationSec\`, \`source\` (\`captions\` = made by people,
  \`auto-captions\` = YouTube's automatic ones, \`transcription\` = the
  audio transcribed because the video had none; and how it was fetched),
  \`level\` (yours when it was prepared); \`segments[]\`: every line with
  \`start\`/\`end\` (seconds), \`sk\`, \`en\` (the translation) and
  \`tokens[]\` (every word with the dictionary's \`slug\`, \`lemma\`,
  \`gloss\`, \`cat\`, \`gender\`, and \`fresh\` when you had not met it);
  \`preTeach[]\` (the unknown words worth meeting first, with how often
  each appears); \`questions[]\` (Slovak, the \`answer\` index, the
  \`kind\`); \`coverage\` (share of running words you were expected to
  know), \`wordCount\`, \`unknownCount\`, \`usage\` (the model and
  tokens the translation and questions cost).
- \`captions/<id>.<lang>.<json|xml|vtt>\`: the caption track exactly as
  YouTube served it, so the lines can be cut again without fetching.
- \`index.jsonl\`: one line per video (id, title, channel, length, level,
  date, coverage, word count, line count, pre-teach words, source, model).
- \`watches.jsonl\`: one line per watching: \`videoId\`, \`at\`, \`day\`,
  \`ms\`, \`mode\` (\`step\` = one line at a time, \`flow\` = straight
  through), \`segments\`, \`gotFirst\` (lines understood on the first
  unaided listen), \`gotAfter\` (after a replay, slow-down or the text),
  \`missed\`, \`replays\`, \`slowed\`, \`correct\`/\`total\` on the check,
  \`answers\`, \`tapped\` (words looked up), \`queued\` (words sent to the
  review deck), \`xp\`, and \`stats[]\` per line (\`i\`, \`words\`, \`sec\`,
  \`replays\`, \`slow\`, \`revealed\`, \`got\`) — words a second of the
  lines got first time is the listening-speed signal.
`;


const DISTRACTORS = `# Distractors

Wrong answers for the meaning questions (Lesson meaning reps and Listen),
written once by the cheap model and kept so a sentence is paid for once.

- \`near-misses.jsonl\`: one line per Slovak sentence: \`sk\`, \`en\` (its right
  translation), \`near[]\` (two English meanings that differ from it in one
  thing a form carries: person, tense, number, polarity), \`model\`,
  \`createdAt\`.
`;

export const DATA_READMES = { root: ROOT, audio: AUDIO, profile: PROFILE, lessons: LESSONS, chats: CHATS, stories: STORIES, speak: SPEAK, fluency: FLUENCY, videos: VIDEOS, distractors: DISTRACTORS } as const;
