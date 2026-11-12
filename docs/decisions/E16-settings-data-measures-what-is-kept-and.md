# E16. Settings → Data measures what is kept, and clears only the cache (2026-10-30)

**Why:** nothing in the app showed what it kept, so a stale copy could only be fixed by hand. The one thing that is safe to clear is the copy of audio and pages the desktop app keeps for speed, which downloads again. Voice clips are generated once and kept, so clearing them would mean generating them again. Progress and backups are the learner's own work.

**How to apply:**
- `GET /api/storage` (`src/server/storage.ts`) is read-only. It measures three areas on disk: voice clips (`data/audio`), the active language's progress (its folder under `data/profiles/`) and backups (`data/backups`). Each row shows its path and size. Saved areas never offer a clear.
- Only the desktop app clears anything, and only its HTTP cache. `electron/storage-ipc.cjs` answers `lh:storage:cache-size` and `lh:storage:clear-cache` for the app's own window. The web build cannot clear the browser's cache, so its row says where to find it.
- The section sits in Settings → Data, above Reset (`components/settings/storage-section.tsx`). Reset is still the only way to start over, and it moves progress into backups rather than deleting it.
