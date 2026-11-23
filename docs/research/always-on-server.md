# Away from the PC: where the server runs, and what each option costs

Date: 2026-11-08. Plan: [../plans/always-on-server.md](../plans/always-on-server.md). Builds on [mobile-ipad.md](mobile-ipad.md) (E20) and [remote-access.md](remote-access.md) (E21). Owner's question: "Currently we only use our app in dev mode, locally, which is also a desktop app. But we want to turn our app into a web app and/or mobile out? Because obviously I can't also be at the PC. How seamless would this approach be? What would the costs be?"

## Answer

The phone and iPad app already exists. Lanna is an installable web app with phone and tablet layouts (E20), and a phone can reach it over Tailscale after pairing with a code (E21). What is missing is a server that keeps running when the PC is off. Every screen calls the Next server, and that server holds the data (E7) and the keys (E5). Today it runs only on the PC, in dev mode, so the phone works only while the PC is awake and Lanna is running.

So the real choice is where the server runs. A store app would not change that, because it would still need the same server.

Recommended order:

1. **Now, at no cost:** run the production build on the PC (`bun run desktop:prod`) with remote access on, and check the app on the phone and the iPad (route 1).
2. **If the PC being off is the problem:** move the server to an always-on machine at home, such as an old laptop or a mini PC (route 2).
3. **Rent a cloud server (route 3) only if** the app must keep working when the home power or internet is down. That means accepting that Watch probably cannot prepare new videos, and that the keys live on a rented machine.

## Routes

| Route | Works when | Watch: new videos | Data and keys | Setup | Cost |
| --- | --- | --- | --- | --- | --- |
| 1. Phone to the PC over Tailscale (built, E21) | the PC is awake and Lanna runs | works | stay on the PC | about 5 minutes, once ([remote-access.md](../remote-access.md)) | $0; about $5–10 a month of power if the PC stays on around the clock (estimate) |
| 2. Always-on machine at home, over Tailscale | home power and internet are up | works (home connection) | stay at home, on that machine | an afternoon: install it, move `data/` and the key files | an old laptop $0; a 16 GB N150 mini PC about $250–400 in 2026; under $1.50 a month of power (estimate) |
| 3. Rented cloud server, reached only over Tailscale | always | probably fails (see below) | on a rented machine; reverses E7 and E21's rejection of third parties | an afternoon, plus backups | Hetzner CX23 about €6 a month with IPv4 |
| 4. Store app (Capacitor or native) | only with route 1, 2 or 3 underneath | as underneath | as underneath | weeks, plus App Review | Apple $99 a year, Google Play $25 once; App Store guideline 4.2 risk (E20) |

Not costed: a multi-user web app that other learners sign up for. That is a separate project. It needs accounts, a data folder per user, and a data folder per user (E75 gives each device its own language, but one server still has one data folder). It needs keys or billing per user, and it cannot serve other people through the owner's ChatGPT, Copilot or Grok subscription.

## What costs the same everywhere

AI and voice spending does not depend on where the server runs. It is whatever Settings → Spending shows, and it grows only if you practice more. Lessons, Blitz, Review, Listen and Fluency make no model call (E2). Tailscale's Personal plan is free (up to 6 users since April 2026, according to secondary sources).

## What every route needs

- **A production build, not dev mode.** Dev mode compiles each route the first time it opens and ships unminified React (E36), which is worse over a phone connection. `bun run desktop:prod` builds once and serves the build on 127.0.0.1:3010 with the desktop window, so `tailscale serve --bg 3010` works with it. `LANNA_TAILNET_HOST` is needed in dev mode only. The packaged installer is still not a Serve target, because its port changes on every start (E21). The cost: every update needs a rebuild and a restart.
- **Each device runs its own language (E75).** The page and a cookie decide a request's language, so a phone and the PC can study different languages at the same time, and a write is never refused or lost for it. Nothing to build for this.
- **Checks on the devices.** Still unverified from E20 and E21: pairing in Safari, whether the Home Screen icon keeps Safari's cookie, the microphone over HTTPS, and press-and-hold. One more: sound that starts on its own when a card opens may stay silent on iOS until the learner taps. iOS blocks playback that does not follow a tap, and `components/speech.tsx` ends a rejected `play()` without showing anything. Also unverified.
- **Pair two devices.** If iOS clears a Home Screen app's storage after seven days without use (WebKit bug 237350, unverified on current iOS), the device has to pair again. Only this computer or a paired device can make a code. With both the iPhone and the iPad paired, each can make a code for the other while away from home.

## Route notes

### 1. The PC as the server

The steps are in [remote-access.md](../remote-access.md). Use `bun run desktop:prod` instead of `desktop:dev`. The PC must not go to sleep. A desktop that idles at 40 to 80 W uses roughly 30 to 60 kWh a month, which is about $5 to $10 at $0.17 a kWh (an assumed rate; use your own).

### 2. An always-on machine at home

- **Move the data, do not copy it.** `data/`, `auth.json`, `subscriptions.json` and `.env.local` go to the new machine. The PC stops running its own server and opens the new machine's address instead. There is no sync (E7), and only one server may write to a data folder, so two copies would drift apart.
- **First pairing on a machine with no screen.** "This computer" means a request over loopback. An SSH tunnel from the PC (`ssh -L 3010:127.0.0.1:3010 <machine>`) makes `http://localhost:3010` on the PC count as that machine. Make the code there, then pair the PC and the phones through the tailnet name.
- **ChatGPT sign-in.** The sign-in callback listens on a random port of 127.0.0.1 on the server's own machine ([development.md](../development.md)). On a machine with no screen, signing in needs a tunnel to that port, or the credentials file moved over from the PC. Neither is built or tested. Copilot and Grok sign in with device codes, which work from any device.
- **Some desktop-only features are lost.** These work only in the Electron window, so a browser on another machine goes without them: the YouTube sign-in window (Takeout works instead, E50 Watch picks), clearing the window's cache (E16), and the full list of installed reading fonts.
- **The machine.** Any 64-bit machine that runs Node and Chromium will do. A mini PC idles at a few watts, about 4 to 7 kWh a month, under $1.50 (estimate). The DRAM shortage pushed 16 GB mini PCs from about $160–220 in 2025 to about $250–400 in 2026 (Tom's Hardware and store listings). An 8 GB box or an old laptop should be enough for one learner (an assumption, not measured). A Raspberry Pi 5 runs ARM. The native renderers (`@napi-rs/canvas`, `@resvg/resvg-js`) and the headless browser have not been tried there.
- **Updates.** Each update is a `git pull`, a build and a restart on that machine, run by hand or by a small script after each merge to main.

### 3. A rented cloud server

- **YouTube refuses cloud addresses.** The cloud machine this app is built on already ran into it: "YouTube refuses player data to the cloud machine, so every video read there as 'Not available'" (the changelog of 6 November, `docs/CHANGELOG-2026-11.md` in git history). Feeds and search worked there, but the player data, which holds the caption tracks, did not. Public reports say YouTube's bot check judges the IP's reputation and hits datacenter ranges first. The workarounds are a residential proxy, cookies or tokens, and none of them is reliable. Watch, Watch picks and Keep one ready would get no new videos. Videos already prepared would still play from `data/`.
- **The keys and data leave the house.** E7 keeps the data local, and E21 rejected any third party in the path of the keys and the learning data. A rented server reverses both, so it is the owner's call.
- **Keep it off the internet.** Run Tailscale on the server and open no public port except SSH. The E21 gate then works as it does on the PC.
- **Backups.** Use the provider's backup option, or copy `data/` to the PC every night.
- **Price.** Hetzner raised cloud prices twice in 2026, in April and in June. Since 15 June the CX23 is €5.49 a month without VAT, plus €0.50 for an IPv4 address, and the CX33 is €8.49 (secondary sources from October 2026; not checked on hetzner.com).

### 4. A store app

E20 decided against it, and nothing here changes that. It would still need a server from route 1, 2 or 3. Apple charges $99 a year and Google Play $25 once. A thin wrapper around a remote page is the weakest case under App Store guideline 4.2. Revisit it only for a feature the browser cannot give.

## Not verified

- Every price above comes from secondary sources dated 2026; none was checked on the vendor's own page.
- The power figures are estimates from typical idle draw, not measured on the owner's PC.
- How YouTube treats a rented server other than the build machine.
- Nothing has been tried on a phone or an iPad, as in E20 and E21.

## Sources

- Tailscale's Personal plan, raised from 3 to 6 users in April 2026 (secondary sources citing tailscale.com/pricing): https://www.activepieces.com/blog/tailscale-pricing-plans-costs-and-features-2026, https://thisisanitsupportgroup.beehiiv.com/p/tailscale-s-free-tier-just-doubled-if-you-ve-been-putting-it-off-today-s-the-morning; the vendor page, not opened: https://tailscale.com/pricing/
- Hetzner's 2026 price changes: https://www.bitdoze.com/es/hetzner-cloud-precios-2026/, https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do, https://www.tomshardware.com/tech-industry/hetzner-to-raise-prices-by-up-to-37-percent-from-april-1
- YouTube's bot check on datacenter addresses (an issue thread, blog posts and a project wiki; no official statement): https://github.com/yt-dlp/yt-dlp/issues/10128, https://dev.to/osovsky/i-was-building-a-cloud-video-service-youtube-turned-me-into-an-ip-trafficker-1l9o, https://github.com/umutxyp/MusicBot/wiki/YouTube-Access
- Mini PC and Raspberry Pi prices in 2026: https://www.tomshardware.com/raspberry-pi/raspberry-pi-and-mini-pc-home-lab-prices-hit-parity-as-dram-costs-skyrocket-price-hikes-force-hobbyists-to-weigh-up-performance-versus-power-consumption
- Store fees (third-party summaries): https://playcode.io/blog/how-much-does-it-cost-to-publish-an-app, https://magora-systems.com/google-play-developer-account-cost/
- This repo: [development.md](../development.md) (subscription sign-in), `config.ts` (the running language), `scripts/desktop-dev.mjs` (`--prod`), and decisions E2, E5, E7, E16, E20, E21, E36, E45 and E50 (Watch picks).
