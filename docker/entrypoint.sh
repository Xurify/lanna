#!/bin/sh
set -eu

for dir in "$LANNA_DATA_DIR" "$(dirname "$LANNA_AUTH_FILE")" "$LANNA_REPO_CHEATSHEETS_DIR"; do
	if [ ! -w "$dir" ]; then
		echo "lanna-entrypoint: $dir is not writable by uid $(id -u). Give that folder to the user the container runs as: chown -R $(id -u):$(id -g) <the folder on the host>, or set LANNA_UID and LANNA_GID in .env to the folder's owner." >&2
		exit 78
	fi
done

if [ "${LANNA_UPDATE_YTDLP:-0}" = "1" ]; then
	mkdir -p /tmp/lanna-bin
	cp /usr/local/bin/yt-dlp /tmp/lanna-bin/yt-dlp
	if /tmp/lanna-bin/yt-dlp -U >/tmp/lanna-bin/update.log 2>&1; then
		PATH="/tmp/lanna-bin:$PATH"
		export PATH
		echo "lanna-entrypoint: yt-dlp $(yt-dlp --version)"
	else
		echo "lanna-entrypoint: yt-dlp update failed, using the pinned version ($(/usr/local/bin/yt-dlp --version)). $(tail -n 1 /tmp/lanna-bin/update.log)" >&2
	fi
fi

exec "$@"
