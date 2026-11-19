# The Watch task: a YouTube video as guided comprehensible input

_Lanna, 2026-10-28. Thread "Turn YouTube videos into guided comprehension", PRs #3 and #4. Code: `src/core/watch.ts`, `src/server/watch.ts`, `src/store/videos.ts`, `components/watch/watch-player.tsx`, `app/watch`._

## Why

The first learner's goal is to follow Slovak YouTube, and the gap is assembling meaning fast enough, not vocabulary ([../learner.md](../learner.md)). The ask was "double subtitles, so I see both as I watch". Authentic video is the input strand's natural material, but only if it is made comprehensible: the research threshold for listening is about 93 to 95% known words, and the useful signal is whether a line was understood on the first unaided hearing.

## Design

- Paste a Slovak YouTube link. The app fetches the Slovak captions (YouTube's own, manual or automatic; yt-dlp when the app cannot reach them; with yt-dlp and a Deepgram key, a video with no captions can be transcribed from audio on request), cuts them into lines the ear can hold, translates them once on the Cheap slot, glosses every word against the lexicon with the same known-words estimate Read and Listen use, and writes a comprehension check at the learner's level. A second prepare of the same video makes no model call.
- Before watching: how much of the video is known (93% is where listening works alone) and the unknown words worth meeting first, with audio.
- The video plays in YouTube's own embedded player (youtube-nocookie); nothing is downloaded for playback.
- **Line by line** (default): each line plays with the text hidden and the video pauses; replay (R), slow down (S), show the Slovak (T), show the meaning (M, only after T per the difficulty rule), then Got it (Enter) or Not yet (N). A black band covers YouTube's own subtitle area for the whole mode, because YouTube shows a viewer's remembered captions regardless of the embed settings.
- **Straight through:** both subtitles live, the transcript below, click a line to jump. Every word tappable.
- End screen: lines got on the first unaided listen, words a minute of that speech (the listening-speed signal the milestones page reads), the check, and the words now in the deck.
- A video added waits on Today's plan as a Watch task until watched; watching counts toward the input strand (8 minutes).
- Everything is kept under `data/profiles/<lang>/media/` (caption track as fetched, lines, questions, `watches.jsonl` with per-line stats; the line shape is promised stable to the milestones page).

## Status

Verified live on the PC with an "Učíme sa slovenčinu" video (manual Slovak captions, 108 lines, 75% coverage, about 15 s to prepare). The cloud container cannot reach YouTube, so caption fetching is only testable on the PC. Unverified by the owner.
