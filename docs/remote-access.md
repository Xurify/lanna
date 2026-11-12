# Remote access: LangHarness on a phone or iPad

This guide is for the owner. It turns on the app for your own phone and iPad while LangHarness runs on this PC. Your keys and your learning data stay on this PC. Nothing is published to the internet.

To keep the server running while the PC is off, see [server.md](server.md).

The rules behind it are in [E21](decisions/E21-remote-access-is-off-by-default-and.md) and the research in [research/remote-access.md](research/remote-access.md).

To serve the app at a public address of its own, behind a password, with no Tailscale on the phone, see [At a public address](#at-a-public-address-a-server-with-a-domain) at the end.

## Before you start (once)

1. Install Tailscale on this PC, on the iPhone and on the iPad. Sign in to the same Tailscale account on all three.
2. In the Tailscale admin console, turn on **MagicDNS** and **HTTPS certificates** (the DNS page). Serve needs both.
3. Leave **Funnel** off. Funnel publishes a service to the whole internet. LangHarness is built for your own tailnet only.

## Set it up (about five minutes)

1. Name this computer's address for the phone. In the project folder, create a file named `.env.local` with one line: `LH_TAILNET_HOST=` followed by the name in your phone's address, without `https://` and without a path. The file is never committed. Then start LangHarness on this PC with `bun run desktop:dev`. It listens on port 3010. Restart it after you change `.env.local`.
2. In LangHarness, open **Settings → Devices** and turn on **Remote access**. This window is signed in automatically, as "This computer".
3. In a terminal on this PC (PowerShell on Windows), run the command Settings shows:

   ```
   tailscale serve --bg 3010
   ```

   `--bg` keeps it running after the terminal closes. Without it, Serve stays in the foreground. Check it with `tailscale serve status`, which prints your `https://` address. If your Tailscale version rejects `--bg`, run `tailscale serve --help` and use the form it lists.
4. On the phone, open that `https://` address in Safari. The app sends you to **Pair this device**.
5. On the PC, in **Settings → Devices**, choose **Make a code**. Type the six digits on the phone within five minutes, and give the device a name such as "iPhone".
6. On the iPhone or iPad, tap Share, then **Add to Home Screen**, and open LangHarness from its icon.

## Day to day

Nothing to do. The app works while this PC is awake, LangHarness is running, and Serve is set up. After a restart, start LangHarness again; Serve keeps its setting.

## Sign a device out, or turn everything off

- **One device:** Settings → Devices, then **Sign out** beside it.
- **Everything:** turn **Remote access** off. Every device is signed out, and the app answers this PC only again. To stop Serve too, run `tailscale serve reset`.

## If every device is locked out

Run this in the project folder on this PC:

```
npm run remote:off
```

It turns remote access off and signs every paired device out. It does not touch anything else. Turn remote access on again from Settings → Devices.

## Troubleshooting

- **"This computer's browser asks for a code."** It should never. Open http://localhost:3010 on the PC. A tailnet address goes through Serve, and that one asks for a code.
- **"Remote access is off" on the phone.** Serve is running, but the switch in Settings → Devices is off. Turn it on.
- **"This address is not allowed."** The phone used an address other than your tailnet name. Use the `https://` address from `tailscale serve status`.
- **"That code has expired."** A code lasts five minutes and works once. Make a new one.
- **The Home Screen icon asks for a code again.** iOS may keep a Home Screen app's cookies apart from Safari's. This is not verified. Pair from the Home Screen icon if it asks.
- **The installed (packaged) desktop app does not work here.** Its port changes on every start, and Serve needs a fixed one. Use `bun run desktop:dev` for now. A fixed port for the installed app is a later step.
- **The PC terminal says "Blocked cross-origin request to Next.js dev resource", and Pair does nothing on the phone.** The page never started, because Next refused its scripts from your tailnet name. Check that `.env.local` has `LH_TAILNET_HOST` set to that name (step 1), then restart `bun run desktop:dev`.

## What is checked, and what is not

Checked in the cloud sandbox with a throwaway data folder: the switch, this computer's own browser at `localhost` opening the app with no code (switch on and off), pairing with a code and its tries and expiry, sign-out, turning off, the refusals for other host names and for proxy headers, and the recovery command.

Not checked: Tailscale itself, Serve on your PC, the iPhone and iPad, Safari's handling of the cookie, the Home Screen app, and the phone's page after the `LH_TAILNET_HOST` fix. The owner has to check those on the devices.

## At a public address (a server with a domain)

For a server that is always on, such as a VPS: the app at `https://learn.example.com`, a password instead of a pairing code, and no Tailscale app on the phone. The rules are in [E93](decisions/E93-the-app-can-be-served-at-a.md). Everything below was run locally against nginx 1.24 on plain HTTP; a real domain, certificate and phone have not been tried.

1. **Keep the app on the server's own loopback.** It listens on `127.0.0.1:3010`; only the reverse proxy reaches it. Do not publish the port.
2. **Make a secret for the proxy** and set both variables where the app starts (the environment, or `.env.local` beside it). The secret is at least 32 characters, and only the proxy and the app know it:

   ```
   openssl rand -hex 32
   ```

   ```
   LH_PUBLIC_HOST=learn.example.com
   LH_PROXY_SECRET=<the 64 characters from the command above>
   ```

3. **Set the proxy.** nginx, inside the `server` block that already holds the certificate for the name:

   ```
   location / {
       proxy_pass http://127.0.0.1:3010;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Host $host;
       proxy_set_header X-Forwarded-Proto https;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-LH-Proxy-Secret "<the same 64 characters>";
       proxy_buffering off;
       proxy_read_timeout 3600s;
   }
   ```

   Every line matters. Without `proxy_set_header Host $host`, nginx sends `127.0.0.1:3010` as the host, and the app refuses the request. Without the secret line, every request is refused. `proxy_buffering off` and the long read timeout keep the app's live updates from stalling (not tried under load). If you use Caddy, `reverse_proxy 127.0.0.1:3010 { header_up X-LH-Proxy-Secret "<the same 64 characters>" }` should be all it needs, since Caddy passes the host and sets the forwarded headers itself; that has not been run.
4. **Set the password** on the server, in the project folder. It asks twice and shows nothing as you type. The first password also turns web access on:

   ```
   npm run web:password
   ```

5. **Open the address** in a browser, sign in, and on the phone choose Share, then Add to Home Screen. The browser stays signed in for 180 days.

**Sign out.** Settings → Devices lists every signed-in browser. "Sign out" on the one you are using returns to the sign-in page.

**Change the password.** Run `npm run web:password` again. Every device is signed out, and the limits on wrong tries are cleared.

**Locked out.** Five wrong tries in a minute lock an address for 15 minutes, and 40 an hour lock everyone for 15 minutes. `npm run web:password` on the server clears the lock.

**Turn it off.** Settings → Devices, or `npm run remote:off` on the server. Every browser is signed out and the address answers 403.

**Both ways in at once.** Tailscale and the public address can be used together. A request addressed by a tailnet name is handled as before (pairing code, `tailscale serve`), whether or not `LH_PUBLIC_HOST` is set. Both share one switch: the first `npm run web:password` turns remote access on, and turning it off in Settings or with `npm run remote:off` signs out the public sign-ins and the paired Tailscale devices alike.

**A machine with no screen** cannot make a pairing code in Settings. `npm run remote:code` prints one (`npm run remote:code -- --enable` turns remote access on first); it is for pairing a tailnet device, not for the public address.

**Troubleshooting.** The refusal says what is wrong: "answers only through its reverse proxy" is a missing or wrong secret, "Use the public address" is a wrong `Host`, "needs HTTPS" is a missing `X-Forwarded-Proto https`, "not set up" is a missing or short variable, and "Web access is off" means run `npm run web:password` or turn it on in Settings.
