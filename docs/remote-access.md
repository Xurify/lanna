# Remote access: LangHarness on a phone or iPad

This guide is for the owner. It turns on the app for your own phone and iPad while LangHarness runs on this PC. Your keys and your learning data stay on this PC. Nothing is published to the internet.

The rules behind it are in [DECISIONS.md, E21](DECISIONS.md) and the research in [research/remote-access.md](research/remote-access.md).

## Before you start (once)

1. Install Tailscale on this PC, on the iPhone and on the iPad. Sign in to the same Tailscale account on all three.
2. In the Tailscale admin console, turn on **MagicDNS** and **HTTPS certificates** (the DNS page). Serve needs both.
3. Leave **Funnel** off. Funnel publishes a service to the whole internet. LangHarness is built for your own tailnet only.

## Set it up (about five minutes)

1. Start LangHarness on this PC with `bun run desktop:dev`. It listens on port 3010.
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
- **The PC terminal says "Blocked cross-origin request to Next.js dev resource".** Only hot reload is affected: the page still works. To allow hot reload through your tailnet name, add that name to `allowedDevOrigins` in `next.config.ts` and restart.

## What is checked, and what is not

Checked in the cloud sandbox with a throwaway data folder: the switch, this computer's own browser at `localhost` opening the app with no code (switch on and off), pairing with a code and its tries and expiry, sign-out, turning off, the refusals for other host names and for proxy headers, and the recovery command.

Not checked: Tailscale itself, Serve on your PC, the iPhone and iPad, Safari's handling of the cookie, and the Home Screen app. The owner has to check those on the devices.
