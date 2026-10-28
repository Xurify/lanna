# Speak and fluency: the two missing strands, and honest pronunciation scores

*LangHarness, 2026-10-28. Thread "Build speaking and fluency tasks". Code: `src/core/speak.ts`, `src/core/fluency.ts`, `src/core/pronounce.ts`, their `src/server/` counterparts, `components/speak/`, `app/speak`, `app/fluency`.*

## Why

Before this pass the app had no meaning-focused output strand and no fluency strand (see [comprehensible-input.md](comprehensible-input.md)). The first learner's profile is input-strong and output-weak, with parsing speed as the stated gap. Later the same day the owner asked for "accuracy, pronunciation, accent" as well.

## Evidence

- **Prompts beat recasts.** Corrective feedback that makes the learner self-repair moves grammar; recasts (the teacher just says it right) are mostly not noticed (Lyster & Ranta 1997; Lyster & Saito 2010).
- **Fluency practice** is Nation's fourth strand: nothing new, only faster, on material the learner already knows fully. Repeated timed readings and the 4/3/2 technique (the same thing said in four, then three, then two minutes; here a shrinking window) are the standard forms.
- **Pronunciation assessment** needs a phoneme-level engine to say anything about accent; a transcript match can only say whether the words were recognisable.

## Speak (`/speak`)

- Six scenes from the learner's purposes (café, asking the way, a new colleague, the shop, the doctor, family); the chapter's own scene and the purposes' scenes come first; the daily plan rotates them by day once no tutor unit is open.
- The learner holds Space or taps the mic; recording stops on silence. Speech-to-text is ElevenLabs Scribe if that key exists, else Deepgram nova-2; typing is always there.
- The tutor plays the other person on the Cheap slot, in Slovak audio and text with the meaning a tap away. A slip in a case ending, verb ending or aspect comes back as a prompt to repair ("do škol…? skús ešte raz"), never a recast; a repaired turn earns extra XP; everything else waits.
- After about eight lines, or *Koniec*: at most three corrections (yours → the right line, the rule in a few words, played aloud), two phrases to keep, the slips' words into the review deck.
- Sessions and recordings are kept under `data/profiles/<lang>/speak/`. Cost shows under Spending as "Speaking".

## Fluency (`/fluency`)

- **Say it faster:** six sentences the learner knows 100% (ones answered right in lessons first), each heard once and said three times in a shrinking window (for example 3.5 s → 2.7 s → 2.2 s). Mic optional.
- **Read it faster:** a timed re-read of an episode read on an earlier day, words a minute against the last time or the level target (A1 60, A2 80, B1 100, B2 130), one of the episode's own questions as the check.
- The plan alternates: re-read on odd days once an earlier episode exists, otherwise say it faster. Both feed the Speed strand. Log: `data/profiles/<lang>/fluency/log.jsonl`.

## Clarity scoring

- Engine "azure" when `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are set (Settings → Keys → Speech; Slovak is covered; the free tier is 5 hours a month): accuracy, fluency, completeness and prosody (stress and rhythm, the nearest honest measure of accent), sound by sound.
- Engine "match" otherwise: the words speech-to-text could make out against the expected words.
- Say it faster: a pass counts only if it was inside the window **and** clear (70 or more), so a fast mumble does not pass; the verdict waits for the score.
- Speak: each spoken line gets a chip ("Mostly clear · 83"); a line at 85 or more earns +2 XP; the end screen shows the scene's average.
- Both end screens list the sounds and words that keep scoring low across recent lines, with playback.

## Status

No Azure key was set at deploy time, so the live scores are "match" until one is set. Cloud screenshots used made-up scores from the dev seam (`LH_PRON_SCRIPT=1`), so their numbers are not real. Unverified by the owner.
