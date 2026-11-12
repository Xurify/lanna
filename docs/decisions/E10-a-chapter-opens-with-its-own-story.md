# E10. A chapter opens with its own story episode (2026-10-30)

**Why:** the arc's story step was "not yet", and the Read shelf picked purely by word-fit scoring, so "today" never read as "day 3 of At the doctor's". The story bible (`curriculum/slovak/world.json`: six cast members with Robo the lead, six Bratislava places from the Speak scenes, one English plot beat per chapter) now seeds the episodes, and a chapter without one gets it written first on the cheap slot, cached under `data/` (E1).

**How to apply:**
- The bible is data, not code: edit `world.json`, never the brief. `tests/reading.test.ts` validates it against `CHAPTERS` (one beat per chapter, six cast, six places).
- `pickStory` prefers the current chapter's unread episodes in written order, even when another story fits better; the gate that rejects a low-coverage story does not apply there, so the shelf never chases a hard chapter episode with a second write. The shelf writes the chapter's episode before generic top-ups, within the day's cap.
- `StoryRecord.chapter` already existed; the index lines carry it now too. No migration: older episodes without it keep working.
