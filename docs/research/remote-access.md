# Remote access: how a phone reaches LangHarness without exposing this PC

Date: 2026-11-01. Rule: [E21](../DECISIONS.md). Owner steps: [remote-access.md](../remote-access.md).

## The question

The first phone and iPad slice made the layouts work, but the server listens on 127.0.0.1 on purpose, so a phone cannot reach it. What is the smallest route that lets the owner's own phone and tablet reach the app, keeps the keys and the learner's data on this PC, and never opens the app to the network by accident?

## Options

| Route | Verdict | Why |
|---|---|---|
| Bind the server to the LAN or to the tailnet address, plain HTTP | No | Pairing codes and session cookies would cross the network in clear text. Any device on the same Wi-Fi could reach the pairing page. |
| Tailscale Serve (HTTPS on the tailnet, proxied to 127.0.0.1) | Yes | Serve connects from this computer, so the server keeps its loopback bind. Tailnet traffic is encrypted, with a certificate from the tailnet's own name. Only signed-in tailnet devices can reach it. |
| Tailscale Funnel | No | Publishes the service to the public internet. Funnel traffic carries no identity headers, so nothing but the device gate would stand between the app and strangers. |
| A cloud tunnel or hosted relay | No | Puts a third party in the path of the keys and the learning data (E5, E7). |
| A store app wrapping a remote page | No | Same trust problem as a relay, and an App Store review risk (see [mobile-ipad.md](mobile-ipad.md)). |

## What Tailscale documents (checked 2026-11-01)

- `tailscale serve <port>` proxies HTTPS on the tailnet to `http://127.0.0.1:<port>`. The CLI opens a foreground session; the background flag keeps it running. Stop with `tailscale serve reset`. Sources: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
- Serve adds identity headers to tailnet traffic: `Tailscale-User-Login`, `Tailscale-User-Name`, `Tailscale-User-Profile-Pic`, and `Tailscale-App-Capabilities` when `--accept-app-caps` is set. Serve removes incoming copies of them. Funnel traffic and tagged-device traffic get none.
- The docs say nothing about `Host`, `X-Forwarded-*` or `Forwarded` headers through Serve. Treated as unknown.

## What Next does to every request (checked in node_modules/next, 16.3.2)

- The base server sets `x-forwarded-host`, `x-forwarded-port`, `x-forwarded-proto` and `x-forwarded-for` on every request it handles, filling only the ones that are missing (`??=` in `base-server.js`). So an `x-forwarded-*` header proves nothing about a proxy. The first draft of the gate used them and refused every local request.
- The dev router can hand the app worker a request whose `request.url` is a bare path. `new URL(path)` throws there, so a redirect must build its URL from `request.nextUrl`.
- The proxy adapter parses a middleware redirect's `Location` with no base URL. A relative `Location` becomes a 500. The redirect has to be absolute. Its scheme follows the name: a `.ts.net` host is HTTPS (Serve), anything else is HTTP.

## The gate

Off (the default): the rules the app always had, plus two refusals. A request carrying `Forwarded`, `X-Real-IP` or a Tailscale identity header is refused, so a running Serve cannot leak in while the switch is off. Both names the request was addressed by must be loopback (`Host`, and `x-forwarded-host` when the router set it). Otherwise the existing checks run unchanged.

On: this computer's own requests come first. A request with no proxy marker (`Forwarded`, `X-Real-IP`, a Tailscale identity header, or a tailnet name in `Host` or `x-forwarded-host`) that names only loopback (`localhost`, `127.0.0.1`, `[::1]`) gets the same answer as with the switch off: pages pass, and the API passes the desktop check. So this computer's browser never asks for a code. Any other request came through a proxy or names a tailnet host. Then every name must be loopback or a `.ts.net` name, and the packaged desktop window (its per-launch secret), a live paired-device session, or a public path passes. Public while on: `/pair`, its one `POST`, and the static assets and icons (the matcher skips them). Everything else goes to pairing: a page gets a redirect, an API call gets `401 pairing_required`.

Trust comes from the device's own cookie (`lh_device`, HttpOnly, SameSite=Lax, Secure when HTTPS), never from a header. Tailscale identity headers are not used to grant access: they are missing for tagged devices and for Funnel, so a missing header must never mean "trusted".

## Threats and what stops them

| Threat | Stopped by |
|---|---|
| Someone on the same Wi-Fi reaches the server | The bind stays on 127.0.0.1. Nothing listens on the LAN. |
| A web page on another site reaches the server through DNS rebinding | The name check (both names must be loopback or `.ts.net`) and the device cookie, which is scoped to the host that set it, so a rebound name never carries it. |
| A web page makes the browser send a request with the device cookie (CSRF) | SameSite=Lax: cross-site `POST`s do not carry the cookie. The pairing `POST` takes JSON and needs a code. |
| A guessed pairing code | Six digits, five minutes, five wrong tries, and one code at a time. Codes are created only by the desktop window or a paired device. The counter runs under a lock, so parallel guesses cannot exceed five (tested with eight at once). |
| A stolen session token from the file | Only SHA-256 digests are stored. Sessions last 180 days, and each device can be signed out. Turning remote access off signs everything out. |
| Serve is running while the switch is off | The proxy refusals above. Limit: a Serve setup that sends none of the marked headers and keeps the Host as loopback would look local. Serve does not document that case. The guide tells the owner to turn the switch on first, and the gate is still on the device cookie while it is on. |
| Serve is on and the switch is on, and Serve sends no marked header and rewrites `Host` to loopback | Not stopped. Such a request looks like this computer and passes. Serve documents neither behaviour, so this is the one open gap. The guide keeps Funnel off, and the owner checks the `Host` a request arrives with on the PC before relying on the switch. A stronger later step is a second loopback listener for Serve that always asks for a device. |
| Funnel is enabled by accident | Not supported. Funnel traffic has no identity headers, and while the switch is on it still needs a paired device, as long as Serve keeps the tailnet name as `Host` (undocumented; see the row above). The guide says to leave Funnel off. |
| Locked out, after a bad revoke or a corrupt file | A corrupt file reads as "on, no devices" (fail closed). `npm run remote:off` on the PC turns remote access off and signs everything out. |

## Not verified

- Tailscale Serve on the owner's PC, and the headers it actually sends: the sandbox has no Tailscale, so the tests send the headers by hand.
- The iPhone and iPad, Safari's cookie handling, and whether a Home Screen app shares cookies with Safari (the guide says so as unverified).
- The packaged desktop app with remote access on. Its port changes on each start, so Serve needs a fixed port first (a later slice). The desktop window's own requests pass by the secret, which the code path shows but no test drives.
- Dev hot reload through a tailnet name: Next's cross-site dev rule blocks the HMR websocket unless the name is in `allowedDevOrigins`. Pages and the API are not affected.

## Next steps (not built)

- A fixed port for the packaged app when remote access is on, so Serve has a stable target.
- Name the tailnet address in Settings, so the Serve command and the pairing page show the exact address.
- A visible "last seen" device list that refreshes on its own (the list refreshes on focus today).
