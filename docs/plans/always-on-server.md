# Using LangHarness away from the PC: the plan

Status: **proposed; revised 2026-11-09: the owner wants a web app at its own address (route W), and each device already runs its own language (E75).** Nothing in this plan is built yet. The evidence, prices and sources are in [../research/always-on-server.md](../research/always-on-server.md). The rules it builds on are E7 (local data), E20 (an installable web app), E21 (Tailscale and pairing) and E45 (one running language).

## The goal

The owner can study on the iPhone and the iPad from anywhere, with the PC switched off. Progress, keys and recordings stay in one place, and nothing about learning changes: the same screens, the same data and the same costs.

**Done means:** a full week of normal study on the phone and the iPad with the PC off for most of it, with no lost answers, no answer recorded under the wrong language and no re-pairing.

## What is already true

- **LangHarness already is a web app.** The phone uses the same pages in Safari, installed to the Home Screen (E20). There is no second app to build. The only open question is which machine runs the server behind those pages. Today that machine is the PC, so the phone works only while the PC is on.
- **The owner already has three machines that are always on: the Synology NAS, the VPS that runs flags.games, and the router.** Using one of them adds no new device that has to keep running. The old laptop and the Raspberry Pi are not needed.
- **The app cannot go on a serverless host such as Vercel.** It writes plain files from one long-running process (E7, `docs/architecture.md`), keeps each request's language in Next's request store (E75), and runs yt-dlp and a headless Chromium. It needs an ordinary machine with a disk.

## Routes

| Route | In one line | Watch: new videos | Monthly cost | Status |
|---|---|---|---|---|
| **W. A web app at its own address (the owner's pick, 2026-11-08)** | `https://learn.<your domain>` on the flags.games VPS, with a sign-in page; open it in any browser, with no Tailscale | works if YouTube accepts the VPS (check 2); otherwise through the NAS | $0, plus a domain if you want a new one | full steps under "Route W" below |
| N. The Synology NAS | Run the server in Container Manager, reached over the Tailscale package | works (home connection) | $0 | needs the model and its memory (check 1) | Run the server in Container Manager, reached over the Tailscale package | works (home connection) | $0 | needs the model and its memory (check 1) |
| **V. The flags.games VPS** | Run the server beside flags.games, reached over Tailscale or at a public address | works only if YouTube accepts the VPS address (check 2) | $0 if it has spare memory | needs checks 2 and 3 |
| B. The PC, woken from the phone | The PC sleeps; the router's app wakes it (Wake-on-LAN) before a session | works | $0 | fallback |
| D. A store app | Wrap the web app for the App Store | as the server behind it | Apple $99 a year | not recommended (E20) |

A web app at a public address (open `https://langharness.<your domain>` in any browser, with no Tailscale app on the phone) is a choice of how to reach the server, not a separate route. It works with V, and with N through the router; see decision 2.

## Three checks first (owner, about 10 minutes)

1. **The NAS.** In DSM, open Control Panel → Info Center and note the model and its memory. Then search the Package Center for **Container Manager** and **Tailscale**. If Container Manager installs, the NAS can run the app. With 2 GB of memory it can run the app but not build it, so the image would be built on the PC or the VPS; 4 GB or more is comfortable. Many Plus models take a memory upgrade. j and value models often cannot run Container Manager at all.
2. **YouTube from the VPS.** On the VPS, run:

   ```
   curl -L -o /tmp/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && chmod +x /tmp/yt-dlp
   /tmp/yt-dlp --skip-download --list-subs "https://www.youtube.com/watch?v=jNQXAC9IVRw"
   ```

   A list of subtitle languages means YouTube accepts the address, today. "Sign in to confirm you're not a bot" means it refuses it, and Watch could not prepare new videos from there. Run it two or three times over a day. An address's reputation can change later, so a pass is not a guarantee.
3. **Memory on the VPS.** `free -h` on the VPS. LangHarness needs about 1 GB free to run, plus a few hundred MB more while the tutor's headless browser is open (an estimate), and a few GB to build. The image can be built elsewhere.

## Decisions for the owner

Each decision has a recommendation, and work can start on the recommended option unless the owner says otherwise (W1).

1. **Where the server runs.** The owner chose a web app at its own address (route W, 2026-11-08), so the server goes on **the VPS**, and the NAS is the relay for YouTube if check 2 fails. The NAS reasoning below still applies if the owner later prefers a private setup: the **NAS** if check 1 passes. It is already on, it is at home (E7 and E21 stand unchanged), YouTube works there, and DSM already has snapshots and Hyper Backup for the data. Choose **the VPS** if the NAS cannot run containers and check 2 passes. If neither works, fall back to **B**. Combining them is possible but has more parts: the VPS runs the app and sends only YouTube requests through the NAS over the tailnet. That is an option only if the VPS is wanted for another reason.
2. **How the phone reaches it.**
   - Recommended: **Tailscale**, as built. Leave the Tailscale app connected on the phone (iOS "VPN On Demand"); after that, nothing changes day to day.
   - Alternative: **a public address with the pairing code as the login.** The app then opens in any browser with no Tailscale app. It needs a small change to the gate, because today E21 accepts only tailnet names (work item 1h). The server and its keys would also be reachable from the internet, so only the pairing gate protects them. That reverses part of E21, so it is the owner's call. On the VPS this means a subdomain behind the reverse proxy that already serves flags.games. On the NAS it means a port forward on the router or a tunnel, which is not recommended for a box that also holds your files.
3. **Where real study happens, and where branches are tested.** Today agents deploy pull-request branches to the PC's dev server, which uses the real profile (W3). Recommended: **the server runs `main` and holds the real profile. The PC's dev server tests branches on a copy of the server's data, refreshed each night** (`LH_DATA_DIR` pointed at the copy). The cost: an answer given while testing a branch does not count toward real progress.
4. **Cheatsheets in the repo.** The app writes repo sheets in place (`curriculum/<language>/cheatsheets/`, E50 Cheatsheets). Recommended: **mount that folder from the NAS share or the server's disk, and have the update script push edits to a branch named `sheets/<date>` for the owner to merge.**
5. **How updates reach the server.** Recommended: **a timer checks `main` every 10 minutes, then builds a new image and switches over only when the build and a boot check pass**, keeping the last three images. The owner keeps merging pull requests as today (W2).

The ChatGPT, Copilot and Grok connections in Settings → API keys are optional ways to pay for models with a subscription instead of an API key. The owner does not use them, so they need no step here.

## Phase 0: the phone against the PC (this week; owner, about 30 minutes)

This tries the real phone experience before anything moves. The checks below apply to every route.

1. Pull `main` and start the production build: `bun run desktop:prod`. Dev mode is too slow to judge on a phone (E36). The production build serves the fixed port 3010, so Tailscale works with it.
2. Follow [../remote-access.md](../remote-access.md): install Tailscale on the PC, iPhone and iPad, turn on MagicDNS and HTTPS certificates, then turn on Settings → Devices → Remote access, run `tailscale serve --bg 3010`, and pair the **iPhone and the iPad**. Pairing both means either one can make a code for the other later.
3. Add LangHarness to the Home Screen from Safari on both devices.

| Check | Where | Pass if |
|---|---|---|
| Pairing, then opening from the Home Screen icon | iPhone, iPad | no second pairing is asked for |
| A lesson with typing, Slovak letters and Enter | iPhone | the keyboard does not cover the answer, and the page does not jump |
| Sound when a card opens (Today's line, Listen, Review) | iPhone | it plays without an extra tap, or the tap it needs is obvious |
| Speak: press and hold the microphone, then release | iPhone | the line is heard and scored |
| Watch: play a prepared video | iPad | it plays, and the lines follow |
| Read: tap a word | iPhone | the card stays on screen |
| Leave the phone unused for 8 days, then open the icon | iPhone | still signed in (WebKit bug 237350) |
| Switch language on the phone while the PC has a lesson open | both | each device keeps its own language and neither lesson is lost (E75) |

**Phase 0 is done when** every check has a result, even a failing one.

## Phase 1: make the server ready to live somewhere else (agents in the cloud, alongside phase 0)

Each item is its own branch and pull request, tested on a scratch data folder (E6) and its reasons are written in its description.

| # | Work | Why | Size |
|---|---|---|---|
| 1a | **Already on `main`:** each device runs its own language, and a page writes into the language it shows (E75). Nothing to build. | – | – |
| 1b | **`npm run remote:code`** prints a pairing code in the terminal | a NAS or a VPS has no "this computer" window to make the first code | small |
| 1c | **A container image** (`Dockerfile`, `compose.yaml`): Node 26, Chromium and yt-dlp; `data/` and the key files on a mounted volume, never in the image; serves 127.0.0.1:3010 inside the box; a boot check like `scripts/smoke-server.mjs`; builds for x86-64 and, if the NAS needs it, ARM | the same image runs on the NAS and the VPS, and one image is what gets updated and rolled back | medium |
| 1d | **The guide (`docs/server.md`):** Synology steps (Container Manager, the Tailscale package, the share for the data, Hyper Backup) and VPS steps (a separate user, Tailscale, no new public ports, staying clear of flags.games's ports) | setup from one page | small |
| 1e | **The update script:** check `main`, build the image, run the boot check, switch only when it passes, keep three images, push repo-cheatsheet edits (decision 4) | an update never takes the app down | medium |
| 1f | **Backups:** on the NAS, a share with snapshots plus Hyper Backup; on the VPS, a nightly copy to the NAS over the tailnet. Either way, a check that every JSON file parses, and one restore drill | the server becomes the only copy of the learner's work | small |
| 1g | **Fixes from phase 0,** such as unlocking iOS sound on the first tap if autoplay fails | only what the device checks find | depends |
| 1h | **Only if decision 2 picks a public address:** `LH_PUBLIC_HOST` lets the gate accept one named host over HTTPS, always behind pairing; pairing is limited per address as well as per code; the guide covers the reverse proxy | the public option | small to medium |
| 1i | **Settings → Devices shows the server's address and the exact Serve command** | setup without reading | small |

**Phase 1 is done when** 1b to 1f are merged, and the image boots in the cloud sandbox on a scratch data folder with fake keys.

## Phase 2: move the server (owner with the guide, about an hour; an agent can help through Remote Control)

**On the NAS:**

1. Install Container Manager and Tailscale from the Package Center, and sign Tailscale in to your account.
2. Make a shared folder `langharness` with snapshots turned on, and subfolders `data` and `keys`.
3. Load the image (built on the NAS if it has the memory, otherwise on the PC) and start it with the compose file from the guide.
4. Turn on Tailscale Serve for port 3010 on the NAS, as the guide shows for the Synology package.

**On the VPS:**

1. Install Docker, if it is not there already, and Tailscale. Open no new public port.
2. Clone the repo into its own user's home, build the image, and start it with the compose file.
3. Run `tailscale serve --bg 3010` (or, with a public address, add the subdomain to the existing reverse proxy, after 1h).

**Then, either way:**

1. **Move the data:**
   - Quit LangHarness on the PC.
   - Copy `data/`, `auth.json` and the keys in `.env.local` to the server's `data` and `keys` folders.
   - Start the server, and only then rename the PC's `data/` to `data-moved-<date>`, so the PC can never write to it by accident.
2. Run `npm run remote:code` inside the container (1b), turn remote access on, and pair the PC's browser, the iPhone and the iPad.
3. On the PC, install the server's address as an app (Edge or Chrome: install as app). From now on, that window is where you study on the PC.
4. Point the PC's dev server at the nightly copy (decision 3).
5. Turn on the update timer (decision 5), and do one restore drill.

**Phase 2 is done when** the PC is off and a lesson, a Review, a Listen, a Speak line and a new Watch video all work from the iPhone, and a merge to `main` shows up within 15 minutes.

## Phase 3: a week of real use

Study as normal for seven days, mostly on the phone and the iPad. Agents read the server's log once at the end of the week; the owner reports anything odd as it happens. The fallbacks are `npm run remote:off` inside the container and a switch back to the previous image.

**Phase 3 is done when** the "Done means" line at the top holds. Then record where the server lives in `README.md`.

## Costs

| Item | NAS | VPS |
|---|---|---|
| Machine | $0 (already on) | $0 (already paid for), if it has the memory |
| Memory upgrade, if the NAS has 2 GB | about $30–60 for a module (estimate; depends on the model) | – |
| Tailscale Personal | $0 | $0 |
| Backups | $0 (snapshots, Hyper Backup) | $0 (a nightly copy to the NAS) |
| AI and voice | unchanged (Settings → Spending) | unchanged |

## Risks

| Risk | Cover |
|---|---|
| Home power or internet goes down while away (NAS) | nothing; the VPS route covers this, if YouTube accepts it |
| YouTube starts refusing the VPS later | prepared videos keep working; send YouTube requests through the NAS over the tailnet |
| The VPS app is reachable from the internet (public address only) | the pairing gate, HTTPS and per-address limits (1h); keys never in the image; the default stays Tailscale only |
| A slow NAS makes pages slow | measure with `node scripts/perf-check.mjs --cpu 4` (E36) before moving the data; if it is too slow, use the VPS or B |
| An update breaks the app | the boot check before switching, and three images to roll back to (1e) |
| The server's disk fails | snapshots and Hyper Backup, or the nightly copy; at most one day is lost |

## Route W: a web app at its own address

**What the owner gets:** LangHarness at `https://learn.<your domain>`, like flags.games. Open it on the iPhone, the iPad, the PC or any other browser, sign in once per device, and add it to the Home Screen. There is no Tailscale, the PC can be off, and every device sees the same progress.

**What it takes:** the app's screens and data stay as they are. Three things change:

1. **Where it runs:** the flags.games VPS, in its own container, beside flags.games.
2. **How it is reached:** a subdomain behind the reverse proxy that already serves flags.games, with HTTPS from Let's Encrypt.
3. **Who gets in:** a real sign-in page. The app has had no login, because until now only the PC or a paired phone could reach it (E21).

The pieces already in place carry most of the weight. The device session from E21 (a random token, only its SHA-256 digest stored, 180 days, HttpOnly and Secure) becomes what a sign-in creates. API keys never reach the browser: `GET /api/keys` returns the last four characters and the length only.

### W, phase 1: the app work (agents in the cloud; one pull request each)

| # | Work | Size |
|---|---|---|
| W1 | **Sign-in page and password.** `/login` with one owner password, hashed with scrypt and set from the terminal with `npm run web:password`. A correct password creates an E21 device session, which Settings → Devices lists and can sign out. Wrong tries are limited per address (5 a minute, then a 15-minute wait). Turning web access off signs every device out. | medium |
| W2 | **The gate for a public address.** `LH_PUBLIC_HOST` names the one host the app answers. Requests must arrive from the local reverse proxy with HTTPS; any other host is refused. Everything except `/login`, its POST and the static assets needs a session. A POST must come from the app's own page (an Origin check, on top of SameSite=Lax). The E21 Tailscale path keeps working beside it. | medium |
| W3 | **A security pass before the address goes live:** response headers (HSTS, CSP, frame-ancestors none), size limits on every upload route, a check that the URLs Watch and the tutor's web tools fetch cannot reach the VPS's own services (localhost, the metadata address, the private ranges), and a check that no API route returns a secret. Each finding is fixed or recorded with its reason. | medium |
| W4 | **Already on `main`:** each device runs its own language (E75). Nothing to build. | – |
| W5 | **Container image and compose file** (1c), **update script** (1e), and **a nightly backup** from the VPS to the NAS or the PC over the tailnet, or to off-site storage (1f) | medium |
| W6 | **Watch if YouTube refuses the VPS:** an optional `LH_YOUTUBE_PROXY` that sends only YouTube requests, including yt-dlp, through a small proxy on the NAS over the tailnet. Off by default, and built only if check 2 fails. | small |
| W7 | **Fixes from the phone checks** (phase 0, run against the web address instead of the PC) | depends |

### W, phase 2: going live (owner, about an hour, with `docs/server.md`)

1. Run checks 2 and 3 on the VPS.
2. Add a DNS record for `learn.<your domain>` pointing at the VPS.
3. Start the container on the VPS, bound to 127.0.0.1:3010, so only the reverse proxy can reach it.
4. Add the subdomain to the reverse proxy flags.games uses (nginx, Caddy or similar), with HTTPS, proxying to 127.0.0.1:3010.
5. Set the password with `npm run web:password` inside the container.
6. **Move the data:**
   - Quit LangHarness on the PC.
   - Copy `data/`, `auth.json` and the keys in `.env.local` to the container's volume.
   - Start the container, and only then rename the PC's `data/` to `data-moved-<date>`.
7. Sign in on the iPhone, the iPad and the PC, and add the app to each Home Screen or taskbar.
8. Turn on the update timer and the nightly backup, and do one restore drill.

**Done when** the "Done means" line at the top holds, and from outside the VPS every page and API route except `/login` answers a request without a session with a sign-in redirect or a 401.

### W, what it costs

| Item | Cost |
|---|---|
| Hosting | $0 on the existing VPS, if `free -h` shows about 1–2 GB spare |
| Address | $0 as a subdomain of a domain you own; about $10–15 a year for a new one |
| HTTPS | $0 (Let's Encrypt) |
| AI and voice | unchanged (Settings → Spending) |
| YouTube relay (W6) | $0 through the NAS, if it is needed |
| Owner's time | about an hour, plus the phone checks |

### W, what changes in the rules

E7 (data stays local) and E21 (no public address; Funnel refused; no third party holding the keys and data) are reversed for this deployment. The keys and the data move to the owner's own VPS, and the app becomes reachable from the internet behind a sign-in. When W ships, record in its pull request: why, what protects it (W1–W3), and that Tailscale stays available.

### W, for other learners later

The steps above are for one learner, the owner. Opening sign-ups to other people is a separate project:

- accounts with a data folder each, and a data folder and a default language per person (E75 gives each device its own language, but one server still has one data folder);
- each person's own API keys, or the owner paying for their AI use, with limits against abuse;
- a privacy policy;
- under the AGPL, a link to the source for every user, which the public GitHub repo covers.

Plan it after the owner has used W for a while.

## Route B: the PC, woken from the phone

This is for the case where neither the NAS nor the VPS can run the app.

1. Run phase 0.
2. Turn on Wake-on-LAN in the PC's BIOS and its network adapter (Ethernet is the reliable case). Let Windows sleep as usual.
3. Before a session, wake the PC from the router's app, if the router has a Wake-on-LAN button. Many do; check the router's app or web page. It takes about half a minute. `bun run desktop:prod` survives sleep, so LangHarness comes back with the PC.
4. Add a Task Scheduler entry that starts `bun run desktop:prod` at log-in, so a restart brings the app back.

**Cost:** $0. **Limit:** a wake before every session; if Windows restarts for an update or the PC hangs, the phone is down until someone is home.

## Route D: a store app

Not recommended (E20). It is a shell around one of the servers above. It needs the Apple Developer Program ($99 a year) and passing App Review under guideline 4.2, and Google Play costs $25 once. Revisit it only for something the browser cannot do, such as background audio with the screen locked.

## What happens next

1. The owner runs checks 2 and 3 on the VPS and sends the yt-dlp output, `free -h`, and the domain to use.
2. Agents start W1, W2 and W5 now; W3 runs before the address goes live; W6 only if check 2 fails.
3. If the VPS lacks the memory, W moves to the NAS behind the router, which needs a port forward or a tunnel. Discuss that before doing it.
