# E1. Save every generated artifact to `data/` in open formats (2026-10-27)

**Why:** everything the app pays for is worth keeping, both to avoid paying twice and so the corpus can seed a future app of the owner's own. The ask was for it to be "extremely organized, even overly organized and easy to find."

**How to apply:** any new AI or TTS feature caches to `data/` before calling an API and reuses on a repeat. Audio library with an index, lesson log per day, Why? index, stories, videos, speak sessions with recordings, fluency log, milestones. A README next to every data folder, and `npm run corpus:export` for a snapshot. Deleted chats move to `chats/trash/` instead of being unlinked. Details: [corpus.md](../corpus.md).
