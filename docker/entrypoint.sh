#!/bin/sh
set -eu

for dir in "$LH_DATA_DIR" "$(dirname "$LH_AUTH_FILE")" "$LH_REPO_CHEATSHEETS_DIR"; do
	if [ ! -w "$dir" ]; then
		echo "lh-entrypoint: $dir is not writable by uid $(id -u). Give that folder to the user the container runs as: chown -R $(id -u):$(id -g) <the folder on the host>, or set LH_UID and LH_GID in .env to the folder's owner." >&2
		exit 78
	fi
done

if [ "${LH_UPDATE_YTDLP:-0}" = "1" ]; then
	mkdir -p /tmp/lh-bin
	cp /usr/local/bin/yt-dlp /tmp/lh-bin/yt-dlp
	if /tmp/lh-bin/yt-dlp -U >/tmp/lh-bin/update.log 2>&1; then
		PATH="/tmp/lh-bin:$PATH"
		export PATH
		echo "lh-entrypoint: yt-dlp $(yt-dlp --version)"
	else
		echo "lh-entrypoint: yt-dlp update failed, using the pinned version ($(/usr/local/bin/yt-dlp --version)). $(tail -n 1 /tmp/lh-bin/update.log)" >&2
	fi
fi

exec "$@"
