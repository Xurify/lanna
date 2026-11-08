# Using LangHarness away from the PC: the plan

Status: **proposed, 2026-11-08.** Nothing in this plan is built yet. The evidence, prices and sources are in [../research/always-on-server.md](../research/always-on-server.md). The rules it builds on are E7 (local data), E20 (an installable web app), E21 (Tailscale and pairing) and E45 (one running language).

## The goal

The owner can study on the iPhone and the iPad from anywhere, with the PC switched off. Progress, keys and recordings stay in one place, and nothing about learning changes: the same screens, the same data and the same costs.

**Done means:** a full week of normal study on the phone and the iPad with the PC off for most of it, with no lost answers, no answer recorded under the wrong language and no re-pairing.

## Four routes

| Route | In one line | Choose it when | Monthly cost | One-off cost |
|---|---|---|---|---|
| **A. PC now, home server next (recommended)** | Use the phone against the PC this week, then move the server to an always-on machine at home | you want it to work with the PC off, with Watch intact and the keys at home | about $1 of power | $0 with an old laptop; about $250–400 for a new 16 GB mini PC |
| B. PC only | Keep the PC awake and serve the phone from it | you are usually near home, or the PC stays on anyway | about $5–10 of power if it never sleeps | $0 |
| C. Cloud server | Rent a small server and reach it over Tailscale | it must keep working through home power or internet outages | about €6 for the server, plus a few dollars if Watch gets a proxy | $0 |
| D. Store app | Wrap the web app for the App Store and Play Store | only for a feature the browser cannot give, or if a store listing is wanted | Apple $99 a year | Google $25, plus weeks of work |

Every route starts with phase 0 below. B is phase 0 plus a few settings, and A and C share the same server steps, so starting with A keeps every other route open.

## Decisions for the owner

Each decision has a recommendation, and work can start on the recommended option unless the owner says otherwise (W1).

1. **Route.** Recommended: **A.** It keeps the data at home as E7 and E21 require, it keeps Watch working because YouTube refuses cloud addresses, and it is close to free. Choose C over A only if outages at home are the bigger worry.
2. **The machine (A only).** Recommended: **an old laptop you already have**, with Ubuntu Server 24.04 LTS. A laptop has its own battery, which works as a free UPS. Otherwise get a mini PC with at least 8 GB of memory. The Raspberry Pi is not recommended until someone tries the native renderers on ARM.
3. **Where real study happens, and where branches are tested.** Today agents deploy pull-request branches to the PC's dev server, which uses the real profile (W3). Once the server holds the real data, the PC must not write into it as well. Recommended: **the server runs `main` and holds the real profile. The PC's dev server tests branches on a copy of the server's data, refreshed each night** (`LH_DATA_DIR` pointed at the copy). The cost: an answer given while testing a branch does not count toward real progress.
4. **Cheatsheets in the repo.** The app writes repo sheets in place (`curriculum/<language>/cheatsheets/`, E50 Cheatsheets), so a sheet edited on the server leaves changes in the server's checkout. Recommended: **the update script commits those edits to a branch named `sheets/<date>` and pushes it before it updates**, so the owner merges them like any other change. The alternative is to keep sheets as local data on the server.
5. **How updates reach the server.** Recommended: **a timer on the server checks `main` every 10 minutes, then builds and switches over only when the build passes.** The owner keeps merging pull requests as today (W2), and the server picks up each merge. The alternative is to run one command by hand after each merge.
6. **ChatGPT connection (only if you use it).** Sign-in has to happen on the server's own machine. Recommended: **sign in once over an SSH tunnel during setup.** If that fails, move `chatgpt-credentials.json` over from the PC while the PC's server is stopped.

## Route A, step by step

### Phase 0: the phone against the PC (this week; owner, about 30 minutes)

On the PC:

1. Pull `main` and start the production build: `bun run desktop:prod`. Dev mode is too slow to judge on a phone (E36). The production build serves the fixed port 3010, so Tailscale works with it.
2. Follow [../remote-access.md](../remote-access.md): install Tailscale on the PC, iPhone and iPad, turn on MagicDNS and HTTPS certificates, then turn on Settings → Devices → Remote access, run `tailscale serve --bg 3010`, and pair the **iPhone and the iPad**. Pairing both means either one can make a code for the other later.
3. Add LangHarness to the Home Screen from Safari on both devices.

Check on the devices, and send the results back (a screenshot of anything that looks wrong):

| Check | Where | Pass if |
|---|---|---|
| Pairing, then opening from the Home Screen icon | iPhone, iPad | no second pairing is asked for |
| A lesson with typing, Slovak letters and Enter | iPhone | the keyboard does not cover the answer, and the page does not jump |
| Sound when a card opens (Today's line, Listen, Review) | iPhone | it plays without an extra tap, or the tap it needs is obvious |
| Speak: press and hold the microphone, then release | iPhone | the line is heard and scored |
| Watch: play a prepared video | iPad | it plays, and the lines follow |
| Read: tap a word | iPhone | the card stays on screen |
| Leave the phone unused for 8 days, then open the icon | iPhone | still signed in (checks WebKit bug 237350) |
| Switch language on the phone while the PC has a lesson open | both | see 1a below: today this probably records into the wrong language |

**Phase 0 is done when** every check has a result, even a failing one. The phase-1 fixes are chosen from those results.

### Phase 1: make the server ready to live somewhere else (agents in the cloud, alongside phase 0)

Each item is its own branch and pull request, tested on a scratch data folder (E6) and recorded in DECISIONS.md.

| # | Work | Why | Size |
|---|---|---|---|
| 1a | **Every write carries the language its page showed.** The server refuses a mismatch with 409, and the page says the language changed (already queued as a task: "Stop a second device writing into the wrong language") | with one running language per server, a second device writes into the wrong one (E45) | medium |
| 1b | **`npm run remote:code`** prints a pairing code in the terminal | a server with no screen has no "this computer" window to make the first code; until this exists, the fallback is an SSH tunnel | small |
| 1c | **Server mode and its guide (`docs/server.md`):** a start command that sets `LH_DATA_DIR`, `LH_AUTH_FILE` and `CHROME_PATH`, checks for yt-dlp and Chromium at boot and says what is missing, plus a systemd unit file | so the server can be set up from one page, with no guessing | small |
| 1d | **The update script:** fetch `main`, build into a new release folder, switch a `current` link only when the build passes, restart, and keep the last three releases to roll back to; it also commits repo cheatsheets (decision 4) | an update never takes the app down, and a broken build never ships | medium |
| 1e | **Nightly backup:** copy `data/` and the key files to a dated folder, keep 14, and check that every JSON file parses; also a restore drill | the server becomes the only copy of the learner's work | small |
| 1f | **Fixes from phase 0,** such as unlocking iOS sound on the first tap if autoplay fails | only what the device checks find | depends |
| 1g | **Settings → Devices shows the tailnet address and the exact Serve command** (a next step already listed in E21's research) | so setup on a new machine needs no reading | small |

**Phase 1 is done when** 1a to 1e are merged, and `docs/server.md` has been followed end to end in the cloud sandbox (Ubuntu, a scratch data folder, fake keys, no Tailscale).

### Phase 2: the home server (owner with the guide, about an afternoon; an agent can help through Remote Control)

1. Install Ubuntu Server 24.04 LTS on the machine. Set it to stay awake with the lid closed, and to power back on after a power cut if the BIOS allows it.
2. Install Tailscale, Node 26 (the version CI uses), git, Chromium and yt-dlp, as `docs/server.md` lists. Install nothing else.
3. Clone the repo, run the first build with the update script (1d) and start the service. The app answers on `127.0.0.1:3010` on that machine only.
4. **Move the data:**
   - Quit LangHarness on the PC.
   - Copy `data/`, `auth.json`, the three `*-credentials.json` files and the keys in `.env.local` to the server's data and key folders.
   - Start the server, and only then rename the PC's `data/` to `data-moved-<date>`, so the PC can never write to it by accident.
5. Turn remote access on with `npm run remote:code` (1b), or over an SSH tunnel. Then run `tailscale serve --bg 3010` on the server and pair the PC's browser, the iPhone and the iPad.
6. On the PC, add the server's address as an app (Edge or Chrome: install as app). From now on, that window is where you study on the PC.
7. Point the PC's dev server at the nightly copy of the data (decision 3), so testing branches never touches the real profile.
8. Turn on the update timer (decision 5) and the nightly backup (1e). Do one restore drill: restore last night's copy into a scratch folder and open it in the sandbox.

**Phase 2 is done when** the PC is switched off and a lesson, a Review, a Listen, a Speak line and a new Watch video all work from the iPhone, and a merge to `main` shows up on the server within 15 minutes.

### Phase 3: a week of real use (owner; agents fix what comes up)

- Study as normal for seven days, mostly on the phone and the iPad.
- Agents read the server's log for errors once at the end of the week; the owner reports anything odd as it happens.
- If anything breaks: open the app on the PC by browsing to the server; `npm run remote:off` on the server signs every device out; and the previous release is one link switch away (1d).

**Phase 3 is done when** the "Done means" line at the top holds. Then record the route in DECISIONS.md, amending E7, E20 and E21 so they say where the server lives.

### Route A costs

| Item | Cost |
|---|---|
| Tailscale Personal | $0 |
| Machine | $0 with an old laptop; about $250–400 for a 16 GB mini PC in 2026 (less with 8 GB) |
| Power | about $1 a month (estimate) |
| Backups | $0 to the PC's disk; an external disk if you want a second copy |
| AI and voice | unchanged (Settings → Spending) |
| Owner's time | about 30 minutes for phase 0, an afternoon for phase 2, and a week of normal use |

### Risks and what covers them

| Risk | Cover |
|---|---|
| Home internet or power goes down while away | the laptop battery covers short power cuts; for longer outages, nothing (route C covers this, at the cost of Watch) |
| An update breaks the app | the build must pass before the switch, and the last three releases are kept (1d) |
| The server's disk fails | the nightly backup on the PC (1e) loses at most one day |
| A phone loses its pairing while away | the other paired device makes a code; `npm run remote:code` over Tailscale SSH works from either one |
| Answers recorded under the wrong language | 1a, before phase 2 |
| Tailscale Serve sends a loopback `Host` (the one open gap in E21) | check the headers on the real machine during phase 2; Funnel stays off |

## Route B: the PC only

Phase 0, then:

1. In Windows power settings, set sleep to **Never** while plugged in, and set the screen to turn off on its own.
2. Add a Task Scheduler entry that starts `bun run desktop:prod` at log-in, so a restart brings the app back.
3. Change W3: after a deploy, a branch needs a rebuild (`desktop:prod` builds on every start), not just a hot reload. Agents restart it through Remote Control.
4. Ship 1a and 1g from phase 1. The others are not needed while the PC is the server.

**Cost:** $0, plus about $5–10 a month of power if the PC never sleeps (estimate). **Limit:** if Windows restarts for an update or the PC hangs, the phone is down until someone is home.

## Route C: a cloud server

Phases 0 and 1 as in route A, then phase 2 on a rented server:

1. **Server.** A Hetzner CX23 (4 GB of memory) is about €6 a month with IPv4. The CX line may only be offered in Europe; Hetzner's US sites (Ashburn, Hillsboro) have other plans at other prices. A European server is fine for this app (about 100 ms from the US East Coast).
2. **No public ports.** Close everything in the provider's firewall, and use Tailscale for SSH (`tailscale up --ssh`) as well as for the app. The E21 gate then works as it does on the PC.
3. **Same steps as route A, phase 2,** from step 2 on.
4. **Watch needs one of these**, because YouTube refuses player data from cloud addresses:
   - accept that new videos cannot be prepared (videos already prepared keep working);
   - add a residential proxy only for YouTube requests (`LH_YOUTUBE_PROXY`, passed to the YouTube fetches and to yt-dlp). Caption files are small, so this should cost a few dollars a month or less. That figure is an estimate, and it puts one more third party in the path, though only for YouTube traffic;
   - route YouTube requests through a home device over the tailnet. This works only while that device is on.
   Recommended, if C is chosen: **the proxy, behind a switch that is off by default**, with the owner's decision recorded.
5. **Record the reversal.** In DECISIONS.md, record that the keys and data now live on a rented machine (amending E7 and E21's "no third party" line), and say why.

**Cost:** about €6 a month for the server, about €1 for the provider's backups (or $0 to the PC), and the proxy if used.

## Route D: a store app

Not recommended (E20). If it is ever wanted:

1. Choose route A, B or C first. A store app is only a shell around the same server.
2. Wrap the web app in Capacitor. Native work is limited to what the browser cannot do: background audio while the screen is locked, and notifications ("your review is due") if a plain web push is not enough.
3. Enroll in the Apple Developer Program ($99 a year, owner only); write a privacy policy and a support page; pass App Review. A thin wrapper around a remote page is the weakest case under guideline 4.2. TestFlight avoids review for personal use, but each build expires after 90 days.
4. Google Play: $25 once, with a lighter review.

**Cost:** $99 a year and $25 once, plus weeks of work that duplicate what the Home Screen web app already does.

## What happens next

1. The owner picks a route (decision 1). With no answer, A is assumed (W1).
2. The owner runs phase 0 and reports the results.
3. Agents start 1a, 1b, 1c and 1e right away. These do not depend on the phase 0 results. 1d waits for decisions 4 and 5, and 1f for the phase 0 results.
