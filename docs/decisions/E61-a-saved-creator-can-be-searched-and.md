# E61. A saved creator can be searched and listed newest first (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner: "I should be able to search their channels and just see their latest videos or sort by that." A creator's row showed only its four best picks.

**How to apply:**
- A creator's panel has a search of the channel and a Best for you / Newest order (`CreatorVideos` in `components/watch/discover.tsx`, `POST /api/watch/discover {action: "creator-videos", id, query?}`).
- Newest reads the channel's videos tab (`channelUploads`): the feed lists only a few uploads. The feed's exact dates win; otherwise the date comes from the English page's relative date ("3 weeks ago", `agoToIso`), which is only as exact as that text. Titles come from the page in the language, because an English page translates them.
- Each listed video is checked as a pick is (`scanVideo`: captions and the known-word share, free, no model), and the check is kept, so it feeds the picks too. A video that cannot be offered stays in the list and says why (`creatorVideoRows`): no captions yet, not spoken in the language, too long or too short, live, unavailable, already in your videos, or marked not for you.
- Best for you sorts offered videos by the pick score, then the rest by date; Newest sorts by date alone, undated last (`sortCreatorVideos`).
