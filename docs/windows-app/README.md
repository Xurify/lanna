# Windows app: build, release, update

The Windows app is an installed copy of Lanna. It does not follow `main`. It updates only when a **GitHub Release** with a higher version number is published. Merging to `main` changes nothing for an installed app until a release is out.

## How updates reach an installed app

- The app checks `https://github.com/Xurify/lanna` for releases at startup and every 24 hours (`electron/main.cjs`, `checkForUpdates`). The **Check for Updates…** item in the app menu (press Alt to show the menu) checks now.
- It reads `latest.yml` from the latest published release. If that version is higher than the installed one, it downloads the installer in the background and installs it the next time you quit Lanna.
- Turn automatic checks off with Settings → General → automatic updates. That is stored as `general.autoUpdate` in `settings.json`.
- Draft releases are invisible to installed apps. A release only reaches installed copies after you publish it.

If an installed app logs `No published versions on GitHub` (in `%APPDATA%\Lanna\logs\main.log`), no published release exists yet. That was the state before 0.1.1.

## Where things live on Windows

| What | Path |
| --- | --- |
| Installed program | `%LOCALAPPDATA%\Programs\lanna\Lanna.exe` |
| Your data and logs | `%APPDATA%\Lanna\` (`data\`, `logs\main.log`) |
| Staged update | `%LOCALAPPDATA%\lanna-updater\pending\` |
| Installer from a build | `dist\Lanna-<version>-x64-setup.exe` in the repo |

The installer is per-user and needs no administrator rights. It is unsigned, so Windows SmartScreen may warn on first install: **More info → Run anyway**.

## Build the installer

GitHub Actions does not run on this repository, so the Windows installer is built on this PC. Run these from Git Bash in a clean checkout of `main`:

```sh
npm ci
bun run build
node scripts/build-server.mjs
node scripts/smoke-server.mjs --electron
npx electron-builder --win --x64 --publish never
```

Output in `dist\`:

- `Lanna-<version>-x64-setup.exe` (the installer, about 180 MB)
- `Lanna-<version>-x64-setup.exe.blockmap`
- `latest.yml` (the update feed; its `version` must match the installer)

The `bun run build` step takes a few minutes. The last electron-builder step takes about 5 minutes, and it sits on `building block map` for a while before it finishes. Wait for `dist\latest.yml` to appear before you move on.

Before publishing, also run the project gates: `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `bun run test` (with `NODE_ENV=test` and `LANNA_DATA_DIR` set to a scratch folder).

## Publish a release

Each release needs a new version number. Installed copies compare versions, so the same number never updates.

Run `bun run release:publish` on a clean, up-to-date `main`. It picks the version, runs the gates, tags, waits for GitHub Actions to build the installers and publishes the release. `docs/desktop-release.md` → **Make a release** has the details.

To put a build on this PC without publishing, run `bun run desktop:install`.

## Test an update

### Without publishing: local feed

This runs the real updater against a folder on your PC.

1. Build an older version and a newer one (see the `-c.extraMetadata.version` trick below). Put the newer `latest.yml`, the installer and the blockmap in one folder.
2. Serve that folder on `http://127.0.0.1:8765/` with any static server.
3. Quit Lanna. Start it with `LANNA_UPDATE_FEED=http://127.0.0.1:8765/` set in the environment.
4. Check `%APPDATA%\Lanna\logs\main.log` for `update downloaded: <new version>`.
5. Quit Lanna. The installer runs silently. Start Lanna again and confirm the version.

### With the real GitHub feed

1. Install an older version (below).
2. Start Lanna with no `LANNA_UPDATE_FEED` set.
3. Wait for `update downloaded: <new version>` in the log, or use the app menu's **Check for Updates…**
4. Quit Lanna. Start it again and confirm the new version in `%LOCALAPPDATA%\Programs\lanna\Lanna.exe` (Properties → Details → Product version).

Pass criteria: the log shows `Found version <new>`, the download completes, and the installed `Lanna.exe` reports the new version after the quit.

To build an older version for testing without touching `package.json`:

```sh
npx electron-builder --win --x64 --publish never -c.extraMetadata.version=0.1.0 -c.directories.output=dist-baseline
```

`extraMetadata.version` changes the version the app reports and the version in the feed name. Build the baseline with the same code the newer build uses. Delete `dist-baseline\` after testing.

## Known harmless log lines

- `Cannot download differentially, fallback to full download` appears when the old version's blockmap is not published. The update still downloads the full installer.
- `disableWebInstaller is set to false` is an electron-updater warning. It changes nothing for this app.
