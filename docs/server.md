# Running LangHarness on an always-on machine

This guide puts the server on a machine that stays on, so the phone and the iPad work while the PC is off. The plan and the reasons are in [plans/always-on-server.md](plans/always-on-server.md) and [research/always-on-server.md](research/always-on-server.md). The decision is E91 in [DECISIONS.md](DECISIONS.md).

The server runs as a container. The image holds the app, Chromium and yt-dlp. Your data, keys and cheatsheets stay in three folders on the machine and never go into the image.

```
/srv/langharness/            LH_HOME: everything that is yours
  data/  keys/  sheets/      mounted into the container
  backups/  state/  logs/    made by the scripts
  repo/                      the git checkout (compose.yaml, scripts, .env)
```

## 0. Three checks first (about 10 minutes)

Run these before you set anything up. They decide where the server goes.

1. **YouTube from the VPS.** Watch needs YouTube to accept the machine's address. On the VPS:

   ```bash
   curl -L -o /tmp/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && chmod +x /tmp/yt-dlp
   ```

   ```bash
   /tmp/yt-dlp --skip-download --list-subs "https://www.youtube.com/watch?v=jNQXAC9IVRw"
   ```

   A table of subtitle languages means YouTube accepts the address today. "Sign in to confirm you're not a bot" means it does not, and Watch could not prepare new videos from that machine (videos already prepared still play). Run it two or three times over a day, because an address's reputation changes. Home addresses (the NAS) are usually accepted.
2. **Memory on the VPS.** Run `free -h` and read the `available` column. The app uses about 260 MiB idle (measured, with no browser open). While the tutor builds a demo, Chromium adds several hundred MiB more (not measured). The compose file caps the container at 2 GB. Building the image needs about 3 GB, so build elsewhere if `available` is under that (section 2, step 8 shows how).
3. **The NAS model.** In DSM open Control Panel → Info Center and note the model and the memory. Then open Package Center and look for **Container Manager**. If it is not offered, the NAS cannot run the server. Most Plus models can; j and value models often cannot. An ARM model needs the image built for arm64 (section 2, step 8).

## 1. The VPS

1. **Docker.** Install Docker Engine and the compose plugin from Docker's own instructions for your distribution. Check with `docker compose version`.
2. **A user for the server.** One user owns the files and runs the scripts. Its number is 10001, the same as the user inside the container, so no file ever needs a different owner.

   ```bash
   sudo useradd --system --uid 10001 --create-home --home-dir /srv/langharness --shell /usr/sbin/nologin langharness
   sudo usermod -aG docker langharness
   sudo -u langharness mkdir -p /srv/langharness/data /srv/langharness/keys /srv/langharness/sheets
   ```

   Membership of the `docker` group is the same as root on this machine. If flags.games runs here, keep that in mind; rootless Docker avoids it but is a separate setup.
3. **The code.**

   ```bash
   sudo -u langharness git clone https://github.com/Xurify/langharness.git /srv/langharness/repo
   ```

   If the repository is private, the server needs a read-only deploy key (GitHub → the repository's Settings → Deploy keys), and the clone uses the `git@github.com:` address.

4. **Settings.** Create `/srv/langharness/repo/.env` (it is not in git):

   ```
   LH_HOME=/srv/langharness
   TZ=Europe/Bratislava
   ```

   Other settings, all optional: `LH_PORT` (default 3010), `LH_MEM_LIMIT` (default 2g), `LH_UPDATE_YTDLP=1` (update yt-dlp each time the container starts, instead of using the version pinned in the image), `LH_DOCKER_BUILD_ARGS` (extra `docker build` arguments, such as `--build-arg NODE_IMAGE=mirror.gcr.io/library/node:26-bookworm-slim` when Docker Hub refuses with "429 Too Many Requests").
5. **First start.** The update script builds the image, runs the boot check, and starts the container:

   ```bash
   sudo -u langharness /srv/langharness/repo/scripts/update-server.sh
   ```

   The first build takes several minutes. Afterwards, `sudo -u langharness /srv/langharness/repo/scripts/update-server.sh status` shows what runs.
6. **The port.** The container's port is published on the VPS's loopback only (`127.0.0.1:3010`). Never change that to `3010:3010`: Docker writes its own firewall rules, so ufw would not stop the world from reaching it.
7. **Reaching it.** Two ways.

   **a. Over Tailscale (works now).** Install Tailscale on the VPS and sign in, then run `tailscale serve --bg 3010`. The first pairing code has to come from "this computer", and the VPS has no window. Open an SSH tunnel from the PC, and use the app through it once:

   ```bash
   ssh -L 3010:127.0.0.1:3010 you@your-vps
   ```

   Open `http://localhost:3010` on the PC, go to Settings → Devices, turn on Remote access, and make a code. Then pair the phone and the iPad through the Tailscale address, as in [remote-access.md](remote-access.md). Once the sign-in work is merged, `npm run remote:code` replaces the tunnel.

   **b. A public address (after the sign-in work).** Do not point a public name at the server before the sign-in page and the public-host gate are merged (work items W1 and W2 in the plan). Until then the app answers every request addressed to a public name with 403, which is safe but not usable. When they are merged, add the name to the reverse proxy flags.games already uses. The headers matter, see "How the app sees a request" below.

   Caddy:

   ```
   learn.example.com {
   	reverse_proxy 127.0.0.1:3010 {
   		header_up Host {host}
   		header_up X-Real-IP {remote_host}
   		header_up X-Forwarded-For {remote_host}
   		header_up X-Forwarded-Proto {scheme}
   	}
   }
   ```

   nginx (certificates from certbot):

   ```
   server {
   	listen 80;
   	server_name learn.example.com;
   	return 301 https://$host$request_uri;
   }
   server {
   	listen 443 ssl;
   	http2 on;
   	server_name learn.example.com;
   	ssl_certificate     /etc/letsencrypt/live/learn.example.com/fullchain.pem;
   	ssl_certificate_key /etc/letsencrypt/live/learn.example.com/privkey.pem;
   	client_max_body_size 12m;
   	location / {
   		proxy_pass http://127.0.0.1:3010;
   		proxy_http_version 1.1;
   		proxy_set_header Host $host;
   		proxy_set_header X-Real-IP $remote_addr;
   		proxy_set_header X-Forwarded-For $remote_addr;
   		proxy_set_header X-Forwarded-Proto $scheme;
   		proxy_set_header Connection "";
   		proxy_buffering off;
   		proxy_read_timeout 300s;
   	}
   }
   ```

   `proxy_buffering off` and the long read timeout are for the tutor's streaming answers. `client_max_body_size` is above the 8 MB cap on a spoken line.
8. **Updates and backups on a timer.** As root, create these four files.

   `/etc/systemd/system/langharness-update.service`:

   ```
   [Unit]
   Description=Update LangHarness to the newest main
   After=docker.service network-online.target
   Wants=network-online.target

   [Service]
   Type=oneshot
   User=langharness
   ExecStart=/srv/langharness/repo/scripts/update-server.sh
   SuccessExitStatus=75
   ```

   `/etc/systemd/system/langharness-update.timer`:

   ```
   [Unit]
   Description=Check for a newer LangHarness every 10 minutes

   [Timer]
   OnBootSec=5min
   OnUnitActiveSec=10min

   [Install]
   WantedBy=timers.target
   ```

   `/etc/systemd/system/langharness-backup.service`:

   ```
   [Unit]
   Description=Back up the LangHarness data

   [Service]
   Type=oneshot
   User=langharness
   ExecStart=/srv/langharness/repo/scripts/backup-data.sh backup --push-to nas-user@your-nas:/volume1/langharness-backups
   ```

   `/etc/systemd/system/langharness-backup.timer`:

   ```
   [Unit]
   Description=Back up the LangHarness data every night

   [Timer]
   OnCalendar=*-*-* 03:30:00
   RandomizedDelaySec=15min
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

   Then `sudo systemctl daemon-reload && sudo systemctl enable --now langharness-update.timer langharness-backup.timer`. The `--push-to` part copies the snapshots to the NAS over ssh; it needs a key for the `langharness` user that the NAS accepts (`ssh-copy-id`). Leave `--push-to` out for a local-only backup. Read the results with `journalctl -u langharness-update` and `/srv/langharness/logs/update.log`.

## 2. The Synology NAS

Everything in section 1 applies, with these changes. Nothing here has been run on a NAS yet.

1. **Packages.** In Package Center install Container Manager, Tailscale, and Git Server (it provides `git`). Sign Tailscale in to your account.
2. **A shared folder.** In Control Panel → Shared Folder create `langharness`. Turn on snapshots for it in Snapshot Replication (daily, keep 14 or more). Inside it make `data`, `keys`, `sheets` and `backups`.
3. **Who owns the files.** Over SSH, run `id your-user` and note the numbers. Put them in `.env` as `LH_UID` and `LH_GID`, and make that user the owner of the three folders. The container starts with an error that names the folder when it cannot write to one.
4. **The code.** Clone the repo into `/volume1/docker/langharness-repo` and create `.env` there with `LH_HOME=/volume1/langharness`, `LH_UID`, `LH_GID` and `TZ`.
5. **Docker needs root on DSM.** Run the scripts as root (`sudo -i`). The first start is `bash scripts/update-server.sh`.
6. **Tailscale.** The package's command is `/var/packages/Tailscale/target/bin/tailscale`. Run `serve --bg 3010` with it, and pair as in section 1, step 7a.
7. **Timers.** Systemd is not available to you. In Control Panel → Task Scheduler create two scheduled tasks, run as root. The first runs every 10 minutes: `cd /volume1/docker/langharness-repo && bash scripts/update-server.sh`. The second runs daily at 03:30: `cd /volume1/docker/langharness-repo && bash scripts/backup-data.sh backup`. Add a Hyper Backup task for `langharness/backups` to an external disk or cloud if you want a copy off the box.
8. **If the NAS is too small to build.** Build on the PC (Docker Desktop), then load the image on the NAS. Use `linux/arm64` for an ARM model:

   ```bash
   docker buildx build --platform linux/amd64 -t langharness:manual --output type=docker,dest=langharness.tar .
   ```

   Copy `langharness.tar` to the NAS, run `docker load -i langharness.tar` there, then put `LH_IMAGE=langharness:manual` in `.env` and run `docker compose up -d`. The update script is not used in this case, so updates are manual.

## 3. Moving your data from the PC

The order matters. The point is that two copies never run at the same time, and the PC's copy is the last thing to change.

1. Quit LangHarness on the PC, including the desktop window.
2. Copy these from the PC's project folder to your own login on the server (PowerShell has `scp`), because the `langharness` user cannot log in:
   - the `data` folder;
   - `auth.json`;
   - `chatgpt-credentials.json`, `github-copilot-credentials.json` and `xai-credentials.json`, but only if they exist.

   ```powershell
   ssh you@your-vps mkdir lh-import
   scp -r data auth.json you@your-vps:lh-import/
   ```

   Then on the server, put them in place:

   ```bash
   sudo cp -a ~/lh-import/data/. /srv/langharness/data/
   sudo cp ~/lh-import/auth.json /srv/langharness/keys/auth.json
   ```

   Keys that exist only in `.env.local` do not move. Enter them in Settings → API keys on the server afterwards. Do not paste keys into a chat (E5).
3. Give the files to the container's user, then delete the import folder:

   ```bash
   sudo chown -R 10001:10001 /srv/langharness/data /srv/langharness/keys
   rm -r ~/lh-import
   ```
4. Start the server (section 1, step 5) and open it. Check Today, your streak and one lesson.
5. Only then, on the PC, rename the `data` folder to `data-moved-<date>`, so nothing on the PC can write to it again.

## 4. Rollback and the restore drill

**Roll back an update.** `scripts/update-server.sh rollback` switches to the previous image and checks out its commit. The commit you rolled back from is not deployed again until a newer commit arrives, or you run the update with `--force`. `rollback <tag>` picks an older image from the three that are kept (`update-server.sh status` lists them).

**What happens by itself.** A build that fails, a boot check that fails, and a container that never turns healthy all leave the old version running (the last one switches back to it). The reason is in `logs/update.log`.

**Restore drill.** Do this once, now, and again after any change to the backup:

```bash
sudo -u langharness /srv/langharness/repo/scripts/backup-data.sh list
```

```bash
sudo -u langharness /srv/langharness/repo/scripts/backup-data.sh restore latest --into /srv/langharness/restore-test
```

The restore reads every JSON file back and prints the count with problems. To see it in the app, start a throwaway container on the restored copy and open it through an SSH tunnel to port 3020:

```bash
docker run --rm -p 127.0.0.1:3020:3010 --read-only --tmpfs /tmp:exec,mode=1777 --tmpfs /app/.next/cache:mode=1777 -v /srv/langharness/restore-test/data:/data -v /srv/langharness/restore-test/keys:/keys -v /srv/langharness/restore-test/sheets:/sheets langharness:local
```

Use the image tag `update-server.sh status` shows if `langharness:local` does not exist. Delete `restore-test` afterwards.

**Reading the backup's exit code.** 0 is done. 3 means a JSON file stopped parsing since the night before; the snapshot is kept, and `DAMAGED` inside it names the files. 4 means the copy to the other machine failed while the local snapshot is fine. Damage the app already tolerated (it skips unreadable lines) does not raise 3 again, only new damage does.

## 5. How the app sees a request

Read this before you make the server public.

- The container sees every connection from Docker's bridge address (`172.17.0.1` here), whatever the real sender. The app never uses the sender's address.
- The app decides from two things only: the `Host` header, and headers a proxy adds (`Forwarded`, `X-Real-IP`, Tailscale's identity headers). A request with a loopback `Host` and none of those headers is treated as coming from this computer, and is let in without pairing.
- So a reverse proxy that sends `Host: 127.0.0.1:3010` and no `X-Real-IP` would present the whole internet as this computer. nginx does exactly that when you leave out `proxy_set_header Host $host`, because its default is the address in `proxy_pass`. Both snippets above set `Host` and `X-Real-IP`, and replace any value the visitor sent.
- A request addressed to a public name is refused (403) today, whether remote access is on or off. So is a request with a loopback `Host` that carries `X-Real-IP` or `Forwarded`. The boot check tests both, and the update script will not switch to an image that fails them.
- The public-host gate and the sign-in page (work items W1 and W2) are meant to change this so that a visitor signs in. Read this section again against what they actually do before you rely on it, and keep the outside test below.

**After you point a name at the server, test it from a machine outside the VPS, such as your phone on mobile data:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://learn.example.com/api/settings
```

It must print 401, 403 or a redirect (301 to 308), never 200. Do the same for `/`.

## 6. What is not verified

Checked on the build machine (Docker 29, Debian-based image, x86-64): the image builds; the boot check passes inside it with no network, a read-only filesystem, no capabilities and user 10001; compose starts it healthy with the port on loopback only; a connection through the host's other address is refused; the container refuses to start with a clear message when a mounted folder is not writable; `update-server.sh` runs update, a second update, rollback and the skip after a rollback against real Docker; backup and restore run on real files; the tests in `tests/server-scripts.test.ts` run the scripts against temporary git repos, a stand-in `docker` and real rsync.

Not checked:

- A real NAS: Container Manager, the Tailscale package's command, `flock` and `rsync` on DSM, Task Scheduler, snapshots, Hyper Backup.
- Anything on the VPS: your Docker version, a reverse proxy in front of the container (the Caddy and nginx snippets were not run), certbot, and whether YouTube accepts the address.
- An arm64 image. The Dockerfile has a checksum for the arm64 yt-dlp (read from the release's checksum list, not downloaded), and the lockfile has the arm64 native packages, but no arm64 build was made.
- The systemd units. There is no systemd here.
- `LH_UPDATE_YTDLP=1` when it succeeds. Here the update failed because this machine's network replaces TLS certificates, so only the fallback to the pinned version ran.
- `--push-to` over ssh. It ran against a local folder; the ssh path was only run to the point of failing.
- Memory while the tutor drives Chromium, and how a 2 GB cap fares under that.
- Moving real data. Nothing was moved from the PC.
- The public address, sign-in and the public-host gate: they are other work items.
