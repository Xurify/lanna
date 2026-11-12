# E19. A spoken line is 16 kHz mono WAV, captured through the worklet (2026-10-31)

**Why:** Speak asked the browser for WebM/Opus and fell back to MP4, so a line could be kept as a video container, and speech-to-text always got that compressed clip — the WAV was built only when Azure scored pronunciation. Every engine a line goes to (ElevenLabs, Deepgram, Azure) accepts WAV, and a line is a few seconds (about 1 MB per 30 s, well under the 8 MB cap). The upload name was fixed at the same time: every clip was called `line.webm`, even when it was MP4.

**How to apply:**
- `components/speak/recorder.ts` captures through the same AudioWorklet dictation uses (`public/worklets/pcm-capture.js`): 16 kHz, mono, 16-bit PCM, encoded once into a WAV. There is no MediaRecorder, no container choice and no MP4 path.
- The worklet answers a `flush` message with its trailing partial frame, then `flushed`, so a stopped line loses nothing (a frame is posted only when 2048 samples are full).
- The worklet's per-quantum RMS is the meter and the stop-on-silence clock; the level mapping is unchanged.
- A recording is `{ wav, ms, spokeAt }`, and `ms` comes from the samples. The WAV goes to `/api/stt`, to pronunciation scoring and with the line to `/api/speak` (kept beside the scene), so the engine and the archive see the same bytes.
- The file name is always `line.wav` on upload and `NN.wav` in the scene: WAV is the only format the path handles, so there is no type-to-extension mapping and no non-WAV branch left anywhere (the former `audioExt` helper is gone).
- Azure's scoring path needs no conversion: it already asks for `audio/wav` PCM at 16 kHz.
