#!/usr/bin/env bash
# Keep dated copies of the server's data, keys and sheets, and check that the
# copy still reads. Each snapshot is a plain folder; files that did not change
# are hard links to the night before, so 14 snapshots cost little more than one
# plus what changed (the audio library is large and rarely changes).
#
#   backup-data.sh [backup] [--keep 14] [--push-to user@host:path] [--no-verify]
#   backup-data.sh list
#   backup-data.sh verify <snapshot>
#   backup-data.sh restore <snapshot> --into <empty folder>
#
# <snapshot> is a folder name under $LH_HOME/backups, "latest", or a path.
# Settings come from the environment, else from KEY=value lines in $LH_REPO/.env:
#   LH_HOME          required: the folder with data/, keys/ and sheets/
#   LH_REPO          the git checkout (default: the folder above this script)
#   LH_KEEP_BACKUPS  snapshots to keep (default: 14)
#   LH_IMAGE         the image to read files with when node is not installed on this machine
#
# Exit codes: 0 done, 1 usage, 2 missing tool or setting, 3 the copy has JSON
# files that do not parse and did not before (the snapshot is kept, named in
# DAMAGED), 4 the copy to the other machine failed (the local snapshot is fine),
# 75 another run is active.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LH_REPO="${LH_REPO:-$(cd "$HERE/.." && pwd)}"
. "$HERE/lib/server-env.sh"

LH_HOME="$(env_value LH_HOME)"
LH_KEEP_BACKUPS="$(env_value LH_KEEP_BACKUPS)"; LH_KEEP_BACKUPS="${LH_KEEP_BACKUPS:-14}"
LH_IMAGE="$(env_value LH_IMAGE)"

COMMAND="backup"
PUSH_TO=""
VERIFY=1
TARGET=""
SNAPSHOT=""

while [ $# -gt 0 ]; do
	case "$1" in
		backup|list|verify|restore) COMMAND="$1" ;;
		--keep) LH_KEEP_BACKUPS="${2:?--keep needs a number}"; shift ;;
		--push-to) PUSH_TO="${2:?--push-to needs user@host:path}"; shift ;;
		--no-verify) VERIFY=0 ;;
		--into) TARGET="${2:?--into needs a folder}"; shift ;;
		-h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
		-*) echo "backup-data: unknown option $1" >&2; exit 1 ;;
		*) if [ -z "$SNAPSHOT" ]; then SNAPSHOT="$1"; else echo "backup-data: unexpected argument $1" >&2; exit 1; fi ;;
	esac
	shift
done

[ -n "$LH_HOME" ] || { echo "backup-data: set LH_HOME (in $LH_REPO/.env or the environment)" >&2; exit 2; }
command -v rsync >/dev/null || { echo "backup-data: rsync is not installed" >&2; exit 2; }
command -v flock >/dev/null || { echo "backup-data: flock is not installed" >&2; exit 2; }

BACKUPS="$LH_HOME/backups"
PARTS=(data keys sheets)
STAMP_PATTERN='[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z'

log() {
	echo "$(date -u +%FT%TZ) $*"
}

snapshots() {
	local dir
	for dir in "$BACKUPS"/$STAMP_PATTERN; do
		if [ -d "$dir" ]; then basename "$dir"; fi
	done
}

resolve_snapshot() {
	local name="$1"
	if [ "$name" = "latest" ]; then
		name="$(snapshots | tail -n 1)"
		[ -n "$name" ] || { echo "backup-data: there is no snapshot yet" >&2; exit 1; }
	fi
	if [ -d "$BACKUPS/$name" ]; then
		printf '%s' "$BACKUPS/$name"
	elif [ -d "$name" ]; then
		printf '%s' "$name"
	else
		echo "backup-data: no snapshot named $name" >&2
		exit 1
	fi
}

run_verify() {
	if command -v node >/dev/null; then
		node "$HERE/verify-data.mjs" "$1"
	elif [ -n "$LH_IMAGE" ] && command -v docker >/dev/null; then
		docker run --rm --network none --user "$(id -u):$(id -g)" -v "$1:/snapshot:ro" --entrypoint node "$LH_IMAGE" /app/verify-data.mjs /snapshot
	else
		echo "backup-data: reading the copy needs node, or docker with LH_IMAGE set" >&2
		exit 2
	fi
}

# rsync exits 24 when a file disappeared between listing and copying, which
# happens when the app rewrites a file during the copy.
copy_parts() {
	local destination="$1" base="${2:-}" part link rc
	for part in "${PARTS[@]}"; do
		[ -d "$LH_HOME/$part" ] || continue
		link=()
		[ -n "$base" ] && [ -d "$base/$part" ] && link=("--link-dest=$base/$part")
		rc=0
		rsync -aH --delete ${link[@]+"${link[@]}"} "$LH_HOME/$part/" "$destination/$part/" || rc=$?
		if [ "$rc" != 0 ] && [ "$rc" != 24 ]; then
			echo "backup-data: copying $part failed (rsync exit $rc)" >&2
			return 1
		fi
	done
}

new_damage() {
	local current="$1" previous="$2"
	awk -F'\t' '
		FILENAME == ARGV[1] { if ($0 !~ /^#/) before[$1 FS $2] = $3; next }
		$0 !~ /^#/ { key = $1 FS $2; if (!(key in before) || $3 + 0 > before[key] + 0) print $1 " (" $2 ", " $3 ")" }
	' "$previous" "$current"
}

do_list() {
	local name summary
	while read -r name; do
		summary="$(grep '^#' "$BACKUPS/$name/VERIFY.tsv" 2>/dev/null | tail -n 1 || true)"
		[ -f "$BACKUPS/$name/DAMAGED" ] && summary="DAMAGED; $summary"
		echo "$name  ${summary:-not verified}"
	done < <(snapshots)
}

do_verify() {
	local dir
	dir="$(resolve_snapshot "${SNAPSHOT:?verify needs a snapshot}")"
	run_verify "$dir"
}

do_restore() {
	local dir
	dir="$(resolve_snapshot "${SNAPSHOT:?restore needs a snapshot}")"
	[ -n "$TARGET" ] || { echo "backup-data: restore needs --into <empty folder>" >&2; exit 1; }
	mkdir -p "$TARGET"
	local target_real home_real
	target_real="$(cd "$TARGET" && pwd -P)"
	home_real="$(cd "$LH_HOME" && pwd -P)"
	case "$target_real/" in
		"$home_real"/data/*|"$home_real"/keys/*|"$home_real"/sheets/*|"$home_real"/)
			echo "backup-data: restore into a scratch folder, not into the live data" >&2
			exit 1 ;;
	esac
	if [ -n "$(ls -A "$TARGET")" ]; then
		echo "backup-data: $TARGET is not empty" >&2
		exit 1
	fi
	local part
	for part in "${PARTS[@]}"; do
		if [ -d "$dir/$part" ]; then rsync -aH "$dir/$part/" "$TARGET/$part/"; fi
	done
	log "restored $(basename "$dir") into $TARGET"
	if [ "$VERIFY" = 1 ]; then
		run_verify "$TARGET" | tail -n 1
	fi
}

do_backup() {
	umask 077
	mkdir -p "$BACKUPS"
	chmod 700 "$BACKUPS"
	local stamp partial latest damage=0 push_failed=0 previous_report=""
	stamp="$(date -u +%Y%m%dT%H%M%SZ)"
	partial="$BACKUPS/$stamp.partial"
	latest="$(snapshots | tail -n 1)"
	[ -n "$latest" ] && latest="$BACKUPS/$latest"
	rm -rf "$partial"
	mkdir -p "$partial"
	copy_parts "$partial" "$latest" || { rm -rf "$partial"; exit 1; }

	if [ "$VERIFY" = 1 ]; then
		[ -n "$latest" ] && [ -f "$latest/VERIFY.tsv" ] && previous_report="$latest/VERIFY.tsv"
		[ -n "$previous_report" ] || previous_report=/dev/null
		run_verify "$partial" >"$partial/VERIFY.tsv"
		local found
		found="$(new_damage "$partial/VERIFY.tsv" "$previous_report")"
		if [ -n "$found" ]; then
			log "files that did not parse; copying again in case the app was writing"
			sleep "${LH_BACKUP_RETRY_SECONDS:-5}"
			copy_parts "$partial" "$latest"
			run_verify "$partial" >"$partial/VERIFY.tsv"
			found="$(new_damage "$partial/VERIFY.tsv" "$previous_report")"
		fi
		if [ -n "$found" ]; then
			damage=1
			printf '%s\n' "$found" >"$partial/DAMAGED"
			log "WARNING: new damage in the copy: $(printf '%s' "$found" | tr '\n' ';')"
		fi
		log "$(grep '^#' "$partial/VERIFY.tsv" | tail -n 1)"
	fi

	mv "$partial" "$BACKUPS/$stamp"
	ln -sfn "$stamp" "$BACKUPS/latest"
	log "snapshot $stamp written"

	local count=0 name
	while read -r name; do
		count=$((count + 1))
		if [ "$count" -gt "$LH_KEEP_BACKUPS" ]; then
			rm -rf "${BACKUPS:?}/$name"
			log "removed old snapshot $name"
		fi
	done < <(snapshots | sort -r)

	if [ -n "$PUSH_TO" ]; then
		if rsync -aH --delete --exclude='*.partial' --exclude='.lock' -e "ssh -o BatchMode=yes" "$BACKUPS/" "$PUSH_TO/"; then
			log "copied the snapshots to $PUSH_TO"
		else
			push_failed=1
			log "ERROR: copying to $PUSH_TO failed; the snapshot on this machine is fine"
		fi
	fi

	[ "$damage" = 1 ] && exit 3
	[ "$push_failed" = 1 ] && exit 4
	return 0
}

if [ "$COMMAND" = "backup" ] || [ "$COMMAND" = "restore" ]; then
	mkdir -p "$BACKUPS"
	exec 9>"$BACKUPS/.lock"
	if ! flock -n 9; then
		log "another backup-data run is active; leaving it alone"
		exit 75
	fi
fi

case "$COMMAND" in
	backup) do_backup ;;
	list) do_list ;;
	verify) do_verify ;;
	restore) do_restore ;;
esac
