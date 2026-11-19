# Lanna

Version 0.1.0 — a local-first, agent-assisted language learning harness (Slovak built in, plus any language added from the app), with bridges from the languages you already know.

What each page does is on the page, and the research behind each task is on **Sources** (`/sources`). This file holds what the app cannot show you: how to run it, keys, commands and limits. The rules for working on it are in [CLAUDE.md](CLAUDE.md).

## Pages

| Page                         | Route                                      |
| ---------------------------- | ------------------------------------------ |
| Today                        | `/`                                        |
| Setup                        | `/start`                                   |
| Lesson, Blitz                | `/lesson?unit=<id>`, `/lesson?mode=blitz`  |
| Chapter exam                 | `/exam?chapter=<id>`                       |
| Curriculum                   | `/curriculum`                              |
| Review                       | `/review`                                  |
| Words, Phrases, Cheatsheets  | `/words`, `/words?tab=cheatsheets`         |
| Grammar                      | `/grammar`                                 |
| Mistakes                     | `/mistakes`                                |
| Catch the mistake            | `/catch`                                   |
| Listen                       | `/listen`                                  |
| Today's line                 | `/line`                                    |
| Read                         | `/read`                                    |
| Speak, Talk in writing       | `/speak`, `/speak?mode=typed`              |
| Speed                        | `/speed`                                   |
| Sound                        | `/sound?id=<id>`                           |
| Ear gym                      | `/phonology`                               |
| Media (Watch, Get ready)     | `/watch`                                   |
| Notes                        | `/notes`, `/notes?id=<id>`, `/notes?new=1` |
| Chat                         | `/chat/new`, `/chat/<id>`                  |
| When can I…?                 | `/milestones`                              |
| Progress, Stamps             | `/progress`, `/progress#stamps`            |
| Sources                      | `/sources`                                 |
| Tasks                        | `/tasks`                                   |
| Log (what was done each day) | `/log`                                     |
| Pair a device                | `/pair`                                    |

**Read** holds the story library and your own articles and newsletters (a link or pasted text), retold at your level or left as they are.

Languages: Slovak is built in. Every other language is added from the language menu, **Add a language…**, which builds its course in the background ([docs/adding-a-language.md](docs/adding-a-language.md)). Each language keeps its own data under `data/profiles/<language>/`, and each device keeps its own language.

## Your data

Everything the app generates or you produce stays on disk in open formats, with a README in every folder: `data/README.md` is the map, and [docs/corpus.md](docs/corpus.md) the rules. `npm run corpus:export` writes a clean, app-independent snapshot to `data/export/<stamp>/` (sentences, lessons, dialogues, explanations, audio catalog, review history, usage summary).

`npm run corpus:push` copies the data folder to your own private Cloudflare R2 bucket named `lanna`, one object per file, and `npm run corpus:pull` brings it to another computer. Both list what they would do and do nothing until you add `-- --yes`; they need `npx wrangler login` on this computer, or a `CLOUDFLARE_API_TOKEN` in `.env.local`. A push only adds and replaces objects, never deletes one; a pull only writes files that are missing and never replaces one that is here. `access.json` (the paired devices) and `export/` are left out. Your recordings, chats and answers are in that copy, so the bucket must stay private.

Settings → Backup does all of it without a terminal: how many files are here, how many are in the copy, when it was last checked, and a button each to check again, upload what is new or changed, and bring back what is missing on this computer. The copy goes to a **folder on this computer** or to the **bucket**, one control at the top of the section: a folder needs no account and no key at all, and is offered at `~/Lanna backup` until you pick another — an external drive, or a folder OneDrive or Google Drive already syncs, is safer than this disk alone. Below that, each part of the folder (voice clips, language data, learning progress, backups) shows the share it takes. For the bucket, the row carries the way in: **Get a key** opens Cloudflare's own token page with the R2 permissions already chosen and the token named `Lanna backup`, and paste the token back into the field that appears; the app reads the bucket, creates `lanna` on the first upload when the account has none yet, and copies both ways. **Sign in** still runs wrangler's browser sign-in. Each way in has its own way out: Sign out for a wrangler login, Remove token for the token pasted here (the same key as Settings → API keys), and nothing for a token from `.env.local`, which is removed there.

## Phone and iPad

A phone or iPad reaches the app over your own Tailscale network. It is off by default.

1. In Settings → Devices, turn on **Remote access**.
2. On this computer, run `tailscale serve --bg 3010` once (Tailscale signed in, HTTPS certificates on).
3. Choose **Make a code** and type the six digits on the phone within five minutes.
4. On the phone, Share → Add to Home Screen opens it full screen.

The server still listens on this computer only, and Funnel stays off. Full steps: [docs/remote-access.md](docs/remote-access.md). An always-on server: [docs/server.md](docs/server.md).

## Where the thinking lives

- [CLAUDE.md](CLAUDE.md): the product principles and working rules.
- [docs/learner.md](docs/learner.md): the learner it is built for and what made them drop off.
- [docs/research/README.md](docs/research/README.md): the research note behind each task.
- `.claude/skills/gamification-loops/`: the agent skill behind the stamps and streaks, with its origin in `SOURCE.md`; read it before changing any reward mechanic.
- [docs/corpus.md](docs/corpus.md): where every generated thing is kept under `data/`.
- [docs/development.md](docs/development.md), [docs/adding-a-language.md](docs/adding-a-language.md), [docs/desktop-release.md](docs/desktop-release.md): development, language-addition, and desktop-release guides.

## Run it

```
npm install
npm run dev          # http://localhost:3010
```

Add an AI key or connect a subscription directly in Settings → API keys (AI keys and Subscriptions both work directly).

Optional speech keys (Settings → API keys → Speech, or `.env.local`):

- `ELEVENLABS_API_KEY`: the best voice, and speech-to-text for the Speak task (Scribe).
  - Voice: `ELEVENLABS_VOICE_ID_SK` or `ELEVENLABS_VOICE_ID`. For another language, `ELEVENLABS_VOICE_ID_<CODE>` (for example `ELEVENLABS_VOICE_ID_ET`); without one, single words and the tutor's lines in that language use Edge.
  - Model: `eleven_v4` for every language (`ELEVENLABS_MODEL_ID` for another). An account without it falls back to `eleven_v3`, then `eleven_multilingual_v2` (29 languages).
  - `npm run audio:regen` lists the kept clips the newest model would make better (an older model, or an Edge clip in a voice ElevenLabs has), with characters and cost, and spends nothing. `npm run audio:regen -- --yes` remakes them (`--max-chars` caps the spend). Replaced files move to `data/audio/replaced/<stamp>/`. `npm run audio:sounds` does the same for the words the Sound guide plays, whether or not a clip exists yet; the guide also asks ElevenLabs for a word the first time it is played with a key set, so both words of a contrast are one voice. `npm run audio:sounds:push -- --yes` uploads those clips to the public `lanna-public` R2 bucket and writes `curriculum/<language>/sound-audio.json`; an install with no key downloads a Sound guide word from there once. Only audio of shipped curriculum text goes in that bucket: it is public as a whole. The `lanna` bucket is private.
  - Stories: **Read → Make audio for every story** (or `npm run audio:stories`, `-- --yes` to spend) makes the ElevenLabs clip for every story sentence the reader has not played yet, in each speaker's voice, after showing the characters and cost.
- `DEEPGRAM_API_KEY`: speech-to-text for the Speak task when there is no ElevenLabs key (and the composer's dictation).
- `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`: Azure Speech pronunciation assessment (Slovak is covered) for Speak and Speed — a phoneme-level score for every spoken line. Without them clarity is judged from the transcript alone.
- `LANNA_PRON_SCRIPT=1`: dev only — a made-up pronunciation score for working on the screens without a key.
- `LANNA_STT_SCRIPT=<text>`: dev only — every recording transcribes to that text.
- `LANNA_SPEAK_SCRIPT=<file>`: dev only — a JSON array of scripted tutor replies for working on the Speak screen without a model.
- Edge voices need no key, only internet.
- Piper works offline: set `PIPER_PATH` to the binary and `PIPER_MODEL_SK` to a Slovak `.onnx` voice.

On Windows, `npm test` and `npm run desktop:dev` use Unix-style env syntax. Run them from Git Bash, or once run `npm config set script-shell "C:\Program Files\Git\bin\bash.exe"`.

## Refresh the curriculum

```
npm run lexicon:export   # reads ../slovak.wiki, writes curriculum/slovak/lexicon.json
npm run seed:build       # curriculum/slovak/seed-source.json → seed.json
```

The seed source is hand-written. Edit nodes, chains, clusters or goals there, then rebuild. An existing profile is not re-seeded. To start fresh, delete `data/profiles/slovak/`.

## Limits worth knowing

- Only 4 words (from slovak.wiki's hand-checked set) have full declension tables checked against JÚĽŠ. 2,958 more have rule-generated form sets that slovak.wiki verified. For the rest, `lookup_word` says plainly that the form is not in the dictionary.
- Slovak is the only built-in language. Russian, Estonian and the others are added from **Add a language…**.
- Estonian and Russian come with a course written by hand (`curriculum/estonian/`, `curriculum/russian/`): every case and verb form is drilled where Tatoeba has the sentences, and the rest is covered by tutor sessions. Another added language gets a course generated when it is added. The Dvojičky pairs and the aspect tasks are Slovak content and do not appear for the others.
- Edge speech could not be tested in the build sandbox (no network there). The fallback to the next tier was tested.
- Example sentences come from slovak.wiki's curated set or from Tatoeba (CC BY 2.0 FR). The review page credits them, and each card names which one it is.

## Tests

`npm test` runs every file in `tests/`. Run it with `NODE_ENV=test` and `LANNA_DATA_DIR` set to a scratch folder, never the real profile.

## License

[AGPL-3.0](LICENSE).
