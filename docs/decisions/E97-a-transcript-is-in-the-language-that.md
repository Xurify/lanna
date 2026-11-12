# E97. A transcript is in the language that is heard, never the profile's: a track in another language is refused, not stored under the profile's language (2026-11-10, branch `fix/spotify-track-language`, PR #182)

**Why:** Whisper forced to the profile's language writes speech it does not understand in that language's spelling, so a Russian track became plausible Slovak text. The text would then be translated, questioned and read aloud as Slovak, with no error to show it. Refusing costs the learner one message, and a YouTube video in another language was already refused this way.

**How to apply:**
- Detect the spoken language before any text is decoded (`scripts/spotify_helper.py`); pass only the profile's languages, its Czech fallback included, as the ones accepted.
- A transcript in another language is refused through `notThisLanguage` in `src/server/watch.ts`, naming the profile it belongs in when that profile has its words.
- The ElevenLabs and Deepgram paths still take the profile's language until someone runs them with a key.
