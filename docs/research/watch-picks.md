# Watch picks: finding videos from the learner's YouTube and saved creators

*LangHarness, 2026-11-05. Branch `feat/watch-creators`. Code: `src/core/discover.ts`, `src/server/discover.ts`, `src/store/discover.ts`, `electron/youtube.cjs`, `components/watch/discover.tsx`, `app/api/watch/discover`.*

## The ask

The owner: "connect our YouTube account and analyze your YouTube history and/or our recommended and then pick videos or find videos based off that", and "import and save creators so the process of adding YouTube videos [is] easier or more automatic". Until now, Watch only took a pasted link, so most of the effort was finding a video worth pasting.

## What YouTube allows

| Route | History | Recommendations | Subscriptions | Setup | Verdict |
|---|---|---|---|---|---|
| YouTube Data API with Google sign-in | no (the watch history and watch later lists have returned empty since 2016) | no (`activities.list` lost `home`) | yes | a Google Cloud project, a consent screen, a sensitive scope | rejected: the most setup for the least data |
| yt-dlp with browser cookies (`:ythistory`, `:ytrec`, `:ytsubs`) | yes | yes | yes | Firefox only on Windows: Chrome's app-bound cookie encryption (2024) blocks reading its cookies; YouTube rotates cookies on open tabs | rejected as the main path: it reads every cookie of the learner's browser |
| A signed-in window of the app's own (what 4K Video Downloader does) | yes | yes | yes | sign in once, inside the desktop app | **chosen** for the desktop app |
| Google Takeout export | yes | no | yes | download, then add two files | **chosen** as the fallback, and for the browser |
| A channel's Atom feed (`/feeds/videos.xml?channel_id=`) | | | | none, no key | **chosen** for saved creators (the 15 newest uploads) |
| YouTube's own web API (`youtubei/v1`: `search` with the subtitles filter, `browse`, `navigation/resolve_url`) | | | | none, no key | **chosen** for search, a channel's videos when the feed fails, and @handles |

The signed-in window uses its own Electron session (`persist:lh-youtube`), so nothing is shared with the app window and the cookies never leave Electron's storage. The main process fetches three pages through that session with `session.fetch(..., { credentials: "include" })`: `/feed/history`, the home page and `/feed/channels`. Only the page text goes to the renderer, which hands it to the server; the server keeps the lists of videos and channels (`videos/discover/youtube.json`), never a cookie.

## What the live trial showed (the owner's PC, 2026-11-05)

- Every route above answered without a key. Search with the subtitles filter returned 20 videos for "varenie recept", but **YouTube translates the titles into the viewer's language**: a German channel ("Leicht & lecker") and a Polish one showed Slovak titles.
- **Slovak subtitles do not mean Slovak speech.** The German video had uploaded subtitle tracks in 56 languages, Slovak among them. A cooking channel with a Slovak name had tracks in 10 languages and a Polish automatic track.
- **YouTube does make Slovak automatic captions now** (`sk` with kind `asr`). A Slovak speaker's automatic track was once labeled Polish.
- The player answer (`videoDetails.title`) gives the **original** title, not the translated one, even with `hl=en`.
- Cooking channels run 10 to 73 caption words a minute: a video captioned only with its on-screen text is mostly music. Speech runs 120 to 180.
- Two creators and five history items: 23 videos checked in 12 seconds, about 3 requests each (player data, the caption track; the feed once per channel).
- The Electron session fetch works: YouTube's home page came back with its `ytInitialData`, and a signed-out page says so (`responseContext.mainAppWebResponseContext.loggedOut`). Google's sign-in page loads in the window. **Not tried:** signing in, which needs the owner's account. Google may refuse a window it does not recognize as a browser. The user agent has no Electron token (the same fix Watch's embedded player already needed), and Takeout is the way round a refusal.

## The rules that came out of it

- **Spoken in the language** (`judgeSpoken`): yes when YouTube's automatic track is in the language or one of its caption fallbacks. Otherwise the original title and description decide: half their words or more found in the lexicon's forms is yes, a fifth or less is no. A video with uploaded subtitles in five languages or more is a translated set and stays "unsure" whatever its title says. An unsure video is offered at 0.7 of its score and labeled "may not be spoken in Slovak".
- **Speech density**: under 30 caption words a minute is "little speech" (the score × 0.3); under 50, × 0.85. Such a channel is never suggested, and such a video is never prepared on its own.
- **Fit**: the known-word share of the real captions, glossed locally with the same estimate Read, Listen and Watch use, with no model call. 93–98% known is where listening works (van Zeeland & Schmitt 2013, the Watch task's `LISTEN_FLOOR`); 88–93% is a stretch the line-by-line mode carries; 98% and up is easy and still useful. Captions by people beat automatic ones (× 0.85); a creator the learner saved counts a little more; fresh uploads get a small bonus.
- **Kept once**: a video is checked once (`scans.json`), its caption lines kept (`text/`), and its share measured again from those lines when the learner's level changes or a week passes. No second request to YouTube.
- **Searches from interests**: with a model set, the cheap slot writes six searches in the language from the titles and channels of the history, recommendations and subscriptions. They are kept with their cost and written again only when those change, or after two weeks.
- **Keep one ready** (on by default, needs a model): when no video waits, the best pick that is spoken in the language, 88% known or more, and 50 words a minute or more is prepared in the background, so Today has a Watch task. A prepare that fails marks the video unavailable instead of trying again on every visit.

## Fragments: watching a stretch of a video (2026-11-06)

The owner asked to pick fragments of a video, with a smart analysis that builds comprehensible input to learn faster. A 45-minute vlog the learner knows 70% of is noise as a whole; two minutes of it may sit at 93%, the range where listening works.

- **What the trial showed, and what it got wrong (corrected 2026-11-06).** The first trial reported that the learner's Slovak (A1) "knew" 80–84% of three long Slovak videos, and that the best two-minute stretches reached 88–91%. Those figures counted a word as known if a learner at A1 is *assumed* to know it: the 500 commonest words of each part of speech, about 2,000 words, 3–4 times the 500–800 the usual CEFR figures give. The learner had studied 48 words. Measured on what they had studied (plus grammar words, names and numbers), the Avocast podcast (46 minutes) was 38.8% known; counting the words the Milestones page credits at the learner's point in the course it is 58.6% expected (it was 83.9% with the 2,000-word assumption). Its nearest two-minute stretches are 42–45% known. So the tool will mostly say "nothing is within reach yet" to a beginner: it must say so rather than offer noise, and send the learner to graded stories and Listen first. For the Estonian profile, five vlogs of one creator sat at 69–71% under the old assumption.
- **What a fragment is.** A run of whole caption lines, 45 to 180 seconds, starting after a pause and stopping before one when the captions have pauses (automatic captions that run on get any line as a cut). The learner may also drag out their own, 20 seconds to 8 minutes.
- **The score** (`src/core/fragments.ts`) is the product of four things, so a stretch weak in any one loses:
  1. *Comprehension*: a sliver under 85% known (at most 0.05, rising with the share, so that when nothing is in reach the stretches still sort by nearness), rising to 0.6 at 90% and 1 at 93% (LISTEN_FLOOR) through 97%, down to 0.2 at 100%, where nothing is new. "Known" here is what the learner has studied, never the level's assumed words.
  2. *Density*: 0 under 40 words a minute (music, a title card), full from 90 to 200.
  3. *Length*: 1 at about 110 seconds, never under 0.7.
  4. *What the new words are worth*, by its square root: each new word that has a dictionary entry counts by how common it is (rank 1,500 or under counts fully, rare words 0.3), by how many times it is said inside the fragment (a second meeting counts 1.35 times, up to four), and the 15th counts about a third of the first. The square root keeps a stretch at 92% with five new words ahead of one at 89% with nine.
  The weights are design choices, not measurements: the comprehension band comes from the sources of the picks above; that a repeated word inside two minutes sticks better than two single ones is an assumption of the design, not something this trial tested.
- **No model call.** The captions are glossed against the learner's words as they stand now. The first look downloads a video's captions (kept under `videos/discover/lines/`), later looks need no YouTube. 600 to 1,400 lines are measured in under two seconds.
- **Cheaper too.** Preparing a stretch translates and questions only its 20 to 60 lines, whatever the video's length (the 90-minute limit applies to whole videos only; fragments are found in videos up to 3 hours). The library keeps one cut per video: a different stretch replaces it, and the learner's watching history stays.
- **Not tested here:** the YouTube player stopping at the end of a stretch (the `end` player parameter), and a real preparation of a stretch with a model. The stretch is cut from captions only; scenes the captions do not describe (a silent demonstration) are not seen.

## Sources

- YouTube Data API revision history (2016: watch history and watch later lists return empty): https://developers.google.com/youtube/v3/revision_history
- YouTube Data API, `activities.list` (the `home` parameter deprecated): https://developers.google.com/youtube/v3/docs/activities/list
- 4K Download, "How to log in to a YouTube account in-app": https://www.4kdownload.com/faq/faq-howto-log-into-youtube-in-app ; "Why sign in to YouTube in 4K Download apps?": https://www.4kdownload.com/faq/faq-why-sign-in-to-youtube-in-4k-download-apps
- yt-dlp FAQ, passing cookies and YouTube's cookie rotation: https://github.com/yt-dlp/yt-dlp/wiki/FAQ ; Chrome's app-bound encryption breaking cookie reads on Windows: https://github.com/yt-dlp/yt-dlp/issues/10927
- Electron, `ses.fetch` and `credentials`: https://www.electronjs.org/docs/latest/api/session
- Google Takeout: https://takeout.google.com/
- van Zeeland, H., & Schmitt, N. (2013). Lexical coverage in L1 and L2 listening comprehension: The same or different from reading comprehension? *Applied Linguistics*, 34(4), 457–479.
