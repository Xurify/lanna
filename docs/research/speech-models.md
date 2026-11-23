# Which speech models should Lanna use for Slovak?

_Lanna, 2026-11-17. Question from the owner, with two links to Cekura's voice benchmarks: "Research the best model for our app Slovak." Code: `src/server/speak.ts` (speech-to-text), `src/server/tts.ts` (speech), `src/server/pronounce.ts` (clarity)._

## Short answer

- **Speech-to-text was the one to change, and is changed.** ElevenLabs was already the default with the key already held, so the cheapest real gain was one line: `scribe_v2` → `scribe_v3`, which makes 27% fewer word errors than v2 across 102 languages. On the only Slovak benchmark that exists, Scribe v2 sits third at 9.15% WER, behind Microsoft MAI-Transcribe-2 (6.54%) and Google Chirp 3 (8.14%). MAI-Transcribe-2 is also the cheapest at $0.10 an hour, but it is public preview.
- **The Deepgram fallback was behind.** It called `nova-2`; Nova-3 has a Slovak model, retrained in August 2026. Both call sites now ask for `nova-3`.
- **Speech stays as it is.** ElevenLabs v4 reads Slovak and is the strongest documented option; there is no Slovak text-to-speech benchmark to say otherwise, and Cekura's board cannot answer it. Clips are cached and paid for once, so switching models re-renders the whole library for evidence we do not have.
- **Clarity stays on Azure**, with the claim removed: prosody (stress and rhythm) is `en-US` only, so a Slovak line has no prosody score. The research note and the code comment now say so.
- **Do not move to speech-to-speech.** The app is not a phone agent; its transcripts are the product, and it runs a text tutor with the Slovak skill.

## What changed (2026-11-17)

Built from this note, in two files:

- `model_id` `scribe_v2` → `scribe_v3` in both transcription paths: `transcribe` in `src/server/speak.ts` (Speak, dictation) and the episode transcription in `src/server/watch.ts`.
- Deepgram `model=nova-2` → `model=nova-3` in the same two paths, so the fallback stops asking for the older Slovak model.
- [speak-fluency.md](speak-fluency.md) no longer claims a prosody score for Slovak, and the `assess` header in `src/core/pronounce.ts` states what Microsoft actually returns for `sk-SK`: accuracy, fluency and completeness.

Not changed, deliberately: the speech engine (ElevenLabs v4), the clarity engine (Azure), the engine order, and speech-to-speech. MAI-Transcribe-2 stays a candidate until it is measured on our own recordings, because it is public preview.

### Not checked

The change is two model ids per file plus documentation. No typecheck, lint or test ran: the worktree has no `node_modules`. Nothing was sent to ElevenLabs, Deepgram or Azure, so the claimed improvement is still the vendors' figures and the Slovak benchmark, not our own audio. The recording check below is what would settle it.

## What the Cekura boards actually measure

All three boards are English. This is the part that matters before using any of them for Slovak.

| Board | What ran | Language |
| --- | --- | --- |
| Speech to speech | 82 simulated calls (59 booking, 23 Medicare), 14 realtime models, 3 runs each, same Pipecat agent | English callers, English agent; the cascade reference is `flux-general-en → gpt-4.1 → eleven_flash_v2_5` |
| Speech to text | 1,000 Pipecat clips + 300 licensed Ocular calls, WER against reference transcripts | English |
| Text to speech | 104 sentences a phone agent says, one stock voice per model, "reads it right" scored by transcribers | English sentences, English voices |

So Cekura answers "which realtime model handles a booking call without going quiet", which is a real question with real numbers (Phonic v1 90.2% pass³, Grok Voice 3.0 81.7%, GPT Realtime 2.1 79.3%; cascade 82.9% unranked). It answers nothing about Slovak. Its own cascade row is the useful part for us: the three-step setup ranked second on that board, ahead of twelve native speech-to-speech models, so a cascade is not a handicap for turn-based use. That is the architecture Lanna already has.

## The Slovak evidence

The Slovak Language AI Hub (SLAIH, KInIT and partners) publishes the first Slovak-only ASR benchmark: 39 hours of Slovak audio in eight domains, 31 models, published 2026-06-26 and updated 2026-11-11. It is the only published head-to-head Slovak speech data found.

| Model | Kind | WER | CER | Notes for us |
| --- | --- | --- | --- | --- |
| Microsoft MAI-Transcribe-2 | commercial API | **6.54%** | 3.29% | Public preview, $0.10/hr, 60 languages, `sk` listed |
| Google Chirp 3 | commercial API | 8.14% | 4.28% | `sk-SK` is Preview in the Speech-to-Text V2 API |
| ElevenLabs Scribe v2 | commercial API | 9.15% | 5.07% | What the app used before this change |
| OpenAI GPT Realtime Whisper | commercial API | 10.94% | 5.33% | — |
| Microsoft Azure Speech | commercial API | 13.29% | 6.04% | — |
| OpenAI Whisper Large v3 | open weights | 16.22% | 7.90% | — |
| OpenAI Whisper Large v3 Turbo | open weights | 18.35% | 9.11% | What the Groq fallback runs |
| OpenAI GPT-4o Transcribe | commercial API | 21.76% | 15.11% | Deletes a lot (13.27%) |

The audio is 11.9 h parliament, 11.7 h municipal hearings, 3.8 h telco customer service, 4.5 h read literature, 2.1 h Common Voice, 2.1 h TEDx and Jump lectures, 1.5 h read speech, 1.5 h FLEURS.

Two things to read out of it:

- **Vendors' Slovak numbers are flattering.** ElevenLabs advertises Slovak at 3.1% WER on FLEURS and 5.5% on Common Voice; the Slovak benchmark, which includes FLEURS but mostly does not look like FLEURS, puts Scribe v2 at 9.15%. The gap is the benchmark, not a mistake: read speech and parliament are easier than hearings and call audio.
- **Everyone is much worse at Slovak than at English.** Cekura's best English model is 1.89% WER. The best Slovak number anyone publishes is 6.54%. A learner-recognition score built on transcripts inherits that.

## Model choices, job by job

### Speech-to-text (Speak, Listen, mistakes, review cards)

Current order: ElevenLabs `scribe_v2` → Groq `whisper-large-v3-turbo` → Deepgram `nova-2`.

1. **`scribe_v3` now.** Released 2026-11-10, a one-line change to `model_id`, 27% fewer word errors than v2 across 102 languages, 90+ languages, $0.20 an audio hour (v2 is priced the same). Slovak is one of the 102. Applying the vendor's average to the Slovak number is arithmetic, not evidence: 9.15% × 0.73 ≈ 6.7%, which would put it level with MAI-Transcribe-2. It should be measured, not assumed.
2. **MAI-Transcribe-2 is the model to test next**, not to adopt blind. It is first on Slovak, half the price, and reachable through the same Azure Speech resource the clarity scorer already uses (`enhancedMode.enabled: true`, `enhancedMode.model: "MAI-Transcribe-2"`). It is public preview without an SLA, which is a fair reason for a local-first app to wait a month.
3. **Deepgram fallback: `nova-2` → `nova-3`.** Nova-3 lists `sk`, and Deepgram shipped retrained Slovak Nova-3 models for both batch and streaming on 2026-08-17. The fallback was asking for the older model.
4. **Groq stays last.** Whisper large v3 turbo is 18.35% on Slovak, roughly twice Scribe's error rate. It is a free-ish safety net, not a contender.

### Speech (every line the app says)

There is no Slovak text-to-speech benchmark. SLAIH publishes SkMTEB, the ASR board and skLEP, no TTS. Cekura's TTS board is English voices reading English sentences, and its "reads it right" metric is scored by transcribing English numbers, codes and drug names, so it cannot rank Slovak.

What exists, from vendor documentation rather than measurement:

- **ElevenLabs v4** reads Slovak (90+ languages, `sk` listed), and the app already uses it with the slovak.wiki narrator voice. Cekura ranks v4's English reading at 93.8%, the highest on that board, but the voices and sentences are English.
- **Google Chirp 3: HD** has `sk-SK` (GA), **Azure** has `sk-SK-ViktoriaNeural` and `sk-SK-LukasNeural` (the two the Edge fallback already uses), **Deepgram Flux TTS** has Slovak in early access (`flux-dominika-sk`, `flux-juraj-sk`).

Keeping ElevenLabs v4 is the evidence-based choice: it is the strongest documented reader, Slovak is supported, the narrator voice was picked by the owner, and `data/audio/` means each clip was paid for once. A switch would re-render the library to chase a ranking nobody has published.

### Clarity (pronunciation scores)

Azure pronunciation assessment covers Slovak (`sk` is one of its 33 locales) at phoneme-level accuracy, plus fluency and completeness. Three limits are worth writing down, because the app's own note claims more:

- **Prosody is `en-US` only.** `EnableProsodyAssessment: true` is sent for `sk-SK`; no `ProsodyScore` comes back. [speak-fluency.md](speak-fluency.md) says the Slovak path includes "prosody (stress and rhythm, the nearest honest measure of accent)" — that is not true for Slovak.
- **Phoneme names are `en-US` (IPA and SAPI) and `zh-CN` (SAPI) only.** Other locales return the phoneme score without the label. `pronReport` builds its "sounds that keep scoring low" list from phoneme labels, so on Slovak that list may legitimately come back empty while word-level misses still work. Worth one real recording to confirm rather than assume either way.
- **Syllable groups and spoken-phoneme candidates are `en-US` only**, so the sound-by-sound detail is coarser than the English documentation suggests.

None of this argues for a different engine. It argues for saying less about what the engine gives a Slovak learner.

## Why not speech-to-speech

Cheap to answer, so answered: no. The recorder is press-and-hold, the reply is a teacher's line with a correction and a rule, and the transcript is what becomes a review card, a mistake and a listening-difference cause. A realtime audio model would delete all of that and replace a Slovak-aware text tutor with an English-tuned voice model whose Slovak behaviour is unmeasured. Cekura's cascade row also shows the tested penalty for staying cascaded is small.

## What to measure, on our own audio

The Slovak benchmark is native read, parliamentary and call audio. Lanna hears A1 learners: short, hesitant, accented, one line at 16 kHz. The ranking above is a prior, not the answer.

A cheap check settles it: 30–50 recorded learner lines with hand-written references, scored as WER per engine for `scribe_v2`, `scribe_v3`, `nova-3` and (if a preview endpoint is acceptable) MAI-Transcribe-2. Recordings already sit under `data/profiles/<lang>/speak/`, so the corpus exists. The same recording read by two or three voices is the only honest test of the speech side, since no Slovak TTS benchmark exists at all.

## Sources

- Cekura, speech-to-speech benchmark (English calls, 14 models, 82 scenarios): <https://benchmarks.cekura.ai/speech-to-speech>, read 2026-11-17.
- Cekura, speech-to-text benchmark (English, 20 models): <https://benchmarks.cekura.ai/stt>, read 2026-11-17.
- Cekura, text-to-speech benchmark (English, 29 models, 104 sentences): <https://benchmarks.cekura.ai/text-to-speech>, read 2026-11-17.
- SLAIH, Slovak Speech Recognition (ASR) Benchmark, 38.9 h, 31 models, published 2026-06-26, updated 2026-11-11: <https://slaih.sk/en/benchmarks/speech-to-text>.
- SLAIH benchmarks index (SkMTEB, ASR, skLEP; no Slovak TTS board): <https://slaih.sk/en/benchmarks>.
- ElevenLabs, Scribe v3 and v3 Live launch, 2026-11-10 (27% fewer word errors than v2 across 102 languages): <https://elevenlabs.io/blog/scribe-v3>.
- ElevenLabs, changelog 2026-11-09 (`scribe_v3`, `scribe_v3_live`, `numbers_format`, `secondary_language_codes`): <https://elevenlabs.io/docs/changelog/2026/11/9>.
- ElevenLabs, models and their languages (v4 90+, multilingual v2 29 including Slovak): <https://elevenlabs.io/docs/models>.
- ElevenLabs, Slovak speech-to-text page (vendor claim: 3.1% WER FLEURS, 5.5% Common Voice): <https://elevenlabs.io/speech-to-text/slovak>.
- ElevenLabs API pricing, Scribe v3 $0.20 and v3 Live $0.22 per audio hour, read 2026-11-15: <https://weneedai.net/elevenlabs-scribe-v3-pricing/>.
- Microsoft, MAI-Transcribe-2 in Speech Service (parameters, 60 languages, `sk` supported): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-transcribe>.
- Microsoft AI, MAI-Transcribe-2 announcement, 2026-09-03 ($0.10 per hour, first on FLEURS across 60 languages, public preview): <https://microsoft.ai/news/mai-transcribe-2>.
- Microsoft, Azure Speech language support (sk-SK in speech to text, fast transcription, MAI-Transcribe-2; TTS voices; 33 pronunciation-assessment locales including `sk`): <https://learn.microsoft.com/azure/ai-services/speech-service/language-support>.
- Microsoft, Use pronunciation assessment (prosody `en-US` only; syllable groups, phoneme names and spoken phonemes `en-US`/`zh-CN` only): <https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment>.
- Deepgram, models and languages (Nova-3 includes `sk`): <https://developers.deepgram.com/docs/models-languages-overview>.
- Deepgram changelog 2026-08-17 (improved Nova-3 Slovak models, batch and streaming): <https://developers.deepgram.com/changelog/2026/8/17>.
- Deepgram Flux TTS voices (Slovak early access): <https://developers.deepgram.com/docs/flux-tts/voices>.
- Google Cloud, Chirp 3 transcription model (`chirp_3`, `sk-SK` Preview): <https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3>.
- Google Cloud, Chirp 3: HD voices (`sk-SK`): <https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd>.
