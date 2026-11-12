# E72. A session closes to the page it was opened from (2026-11-07, branch `feat/session-close-to-origin`)

The owner closed a grammar drill mid-way and expected to land back on the Grammar atlas; every player's X and Escape went to Today.

**How to apply:** a full-screen session (lesson, listen, speak, watch, the speed strand) keeps the page its session was opened from (`components/origin.tsx` stamps the route on every navigation and skips the session routes themselves) and its close (X, Escape, leave after done) returns there. A lesson paused and rejoined (tutor chat, Today, a reload) keeps the page it was first opened from: the origin rides in the saved lesson. A lesson opened from nowhere keeps Today. The finish screens' own next steps (the score grid, speak's scene board, watch's shelf) stay where they point by themselves.
