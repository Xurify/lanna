#!/usr/bin/env bash
# Bring the server to the newest commit of a branch without taking it down:
# build an image, boot-check it, switch to it only when the check passes, and
# keep a few earlier images to roll back to.
#
#   update-server.sh [update] [--ref main] [--dry-run] [--force] [--no-sheets]
#   update-server.sh rollback [image-tag]
#   update-server.sh status
#
# Settings come from the environment, else from KEY=value lines in $LANNA_REPO/.env:
#   LANNA_HOME               required: the folder with data/, keys/, sheets/ (state/ and logs/ are made here)
#   LANNA_REPO               the git checkout (default: the folder above this script)
#   LANNA_REMOTE             git remote to follow (default: origin)
#   LANNA_IMAGE_NAME         image repository name (default: lanna)
#   LANNA_KEEP_IMAGES        how many built images to keep (default: 3)
#   LANNA_DOCKER_BUILD_ARGS  extra `docker build` arguments, for example --build-arg NODE_IMAGE=...
#
# Exit codes: 0 done or nothing to do, 1 usage, 2 missing tool or setting,
# 3 the checkout has local changes, 4 build failed, 5 boot check failed,
# 6 the new container did not become healthy (rolled back), 75 another run is active.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANNA_REPO="${LANNA_REPO:-$(cd "$HERE/.." && pwd)}"

. "$HERE/lib/server-env.sh"

LANNA_HOME="$(env_value LANNA_HOME)"
LANNA_REMOTE="$(env_value LANNA_REMOTE)"; LANNA_REMOTE="${LANNA_REMOTE:-origin}"
LANNA_IMAGE_NAME="$(env_value LANNA_IMAGE_NAME)"; LANNA_IMAGE_NAME="${LANNA_IMAGE_NAME:-lanna}"
LANNA_KEEP_IMAGES="$(env_value LANNA_KEEP_IMAGES)"; LANNA_KEEP_IMAGES="${LANNA_KEEP_IMAGES:-3}"
LANNA_DOCKER_BUILD_ARGS="$(env_value LANNA_DOCKER_BUILD_ARGS)"

COMMAND="update"
REF="main"
DRY_RUN=0
FORCE=0
PUSH_SHEETS=1
ROLLBACK_TO=""

while [ $# -gt 0 ]; do
	case "$1" in
		update|rollback|status) COMMAND="$1" ;;
		--ref) REF="${2:?--ref needs a branch}"; shift ;;
		--dry-run) DRY_RUN=1 ;;
		--force) FORCE=1 ;;
		--no-sheets) PUSH_SHEETS=0 ;;
		-h|--help) sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
		-*) echo "update-server: unknown option $1" >&2; exit 1 ;;
		*) if [ "$COMMAND" = "rollback" ] && [ -z "$ROLLBACK_TO" ]; then ROLLBACK_TO="$1"; else echo "update-server: unexpected argument $1" >&2; exit 1; fi ;;
	esac
	shift
done

[ -n "$LANNA_HOME" ] || { echo "update-server: set LANNA_HOME (in $LANNA_REPO/.env or the environment)" >&2; exit 2; }
for tool in git docker flock; do
	command -v "$tool" >/dev/null || { echo "update-server: $tool is not installed" >&2; exit 2; }
done
[ -d "$LANNA_REPO/.git" ] || { echo "update-server: $LANNA_REPO is not a git checkout" >&2; exit 2; }

STATE="$LANNA_HOME/state"
LOG="$LANNA_HOME/logs/update.log"
mkdir -p "$STATE" "$LANNA_HOME/logs" "$LANNA_HOME/sheets"

log() {
	local line
	line="$(date -u +%FT%TZ) $*"
	echo "$line"
	echo "$line" >>"$LOG"
}

BUILD_CONTEXT=""
cleanup() {
	if [ -n "$BUILD_CONTEXT" ]; then rm -rf "$BUILD_CONTEXT"; fi
}
trap cleanup EXIT

exec 9>"$STATE/update.lock"
if ! flock -n 9; then
	log "another update-server run is active; leaving it alone"
	exit 75
fi

compose() {
	docker compose --project-directory "$LANNA_REPO" -f "$LANNA_REPO/compose.yaml" "$@"
}

set_image_in_env() {
	local tag="$1" file="$LANNA_REPO/.env"
	touch "$file"
	if grep -q '^LANNA_IMAGE=' "$file"; then
		sed -i -E "s|^LANNA_IMAGE=.*|LANNA_IMAGE=${tag}|" "$file"
	else
		printf 'LANNA_IMAGE=%s\n' "$tag" >>"$file"
	fi
}

image_exists() {
	docker image inspect "$1" >/dev/null 2>&1
}

short() {
	printf '%s' "${1:0:12}"
}

wait_healthy() {
	local container status i
	container="$(compose ps -q lanna | head -n 1)"
	[ -n "$container" ] || return 1
	for i in $(seq 1 60); do
		status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"
		[ "$status" = "healthy" ] && return 0
		sleep "${LANNA_HEALTH_POLL_SECONDS:-2}"
	done
	return 1
}

switch_to() {
	local tag="$1" sha="$2"
	set_image_in_env "$tag"
	git -C "$LANNA_REPO" checkout -q "$sha"
	LANNA_IMAGE="$tag" compose up -d --remove-orphans
}

record_deployed() {
	local sha="$1" tag="$2"
	if [ -f "$STATE/deployed" ]; then
		cp "$STATE/deployed" "$STATE/previous"
		cp "$STATE/deployed-image" "$STATE/previous-image" 2>/dev/null || true
	fi
	printf '%s\n' "$sha" >"$STATE/deployed"
	printf '%s\n' "$tag" >"$STATE/deployed-image"
	printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$sha" "$tag" >>"$STATE/history"
}

prune_images() {
	local keep="$LANNA_KEEP_IMAGES" count=0 tag current previous
	current="$(cat "$STATE/deployed-image" 2>/dev/null || true)"
	previous="$(cat "$STATE/previous-image" 2>/dev/null || true)"
	while read -r tag; do
		[[ "$tag" =~ ^[0-9a-f]{12}$ ]] || continue
		count=$((count + 1))
		[ "$count" -le "$keep" ] && continue
		[ "$LANNA_IMAGE_NAME:$tag" = "$current" ] && continue
		[ "$LANNA_IMAGE_NAME:$tag" = "$previous" ] && continue
		log "removing old image $LANNA_IMAGE_NAME:$tag"
		docker image rm "$LANNA_IMAGE_NAME:$tag" >/dev/null || log "could not remove $LANNA_IMAGE_NAME:$tag"
	done < <(docker image ls "$LANNA_IMAGE_NAME" --format '{{.Tag}}')
}

sheet_hash() {
	sha256sum "$1" | cut -d' ' -f1
}

push_sheet_edits() {
	local base="$LANNA_REMOTE/$REF" pending=() file lang name rel hash remote_hash
	local pushed_list="$STATE/sheets-pushed"
	touch "$pushed_list"
	for file in "$LANNA_HOME"/sheets/*/*.txt; do
		[ -f "$file" ] || continue
		name="$(basename "$file")"
		lang="$(basename "$(dirname "$file")")"
		rel="curriculum/$lang/cheatsheets/$name"
		hash="$(sheet_hash "$file")"
		remote_hash="$(git -C "$LANNA_REPO" show "$base:$rel" 2>/dev/null | sha256sum | cut -d' ' -f1 || true)"
		if git -C "$LANNA_REPO" cat-file -e "$base:$rel" 2>/dev/null && [ "$hash" = "$remote_hash" ]; then
			continue
		fi
		grep -qxF "$rel $hash" "$pushed_list" && continue
		pending+=("$file")
	done
	if [ "${#pending[@]}" -eq 0 ]; then
		return 0
	fi
	local branch="sheets/$(date -u +%F)" n=1
	while git -C "$LANNA_REPO" ls-remote --exit-code --heads "$LANNA_REMOTE" "$branch" >/dev/null 2>&1 \
		|| git -C "$LANNA_REPO" show-ref --verify --quiet "refs/heads/$branch"; do
		n=$((n + 1))
		branch="sheets/$(date -u +%F)-$n"
	done
	if [ "$DRY_RUN" = 1 ]; then
		log "dry run: would push ${#pending[@]} edited cheatsheet(s) to $LANNA_REMOTE $branch"
		return 0
	fi
	local tree
	tree="$(mktemp -d)"
	git -C "$LANNA_REPO" worktree add -q -b "$branch" "$tree" "$base"
	for file in "${pending[@]}"; do
		name="$(basename "$file")"
		lang="$(basename "$(dirname "$file")")"
		mkdir -p "$tree/curriculum/$lang/cheatsheets"
		cp "$file" "$tree/curriculum/$lang/cheatsheets/$name"
	done
	git -C "$tree" add curriculum
	git -C "$tree" -c user.name="Lanna server" -c user.email="server@lanna.invalid" commit -q -m "Save the cheatsheets edited on the server

The server writes a cheatsheet edit to its own folder. This branch holds
those edits so they can be merged into the repo."
	if git -C "$tree" push -q "$LANNA_REMOTE" "$branch"; then
		for file in "${pending[@]}"; do
			name="$(basename "$file")"
			lang="$(basename "$(dirname "$file")")"
			printf '%s %s\n' "curriculum/$lang/cheatsheets/$name" "$(sheet_hash "$file")" >>"$pushed_list"
		done
		log "pushed ${#pending[@]} edited cheatsheet(s) to $LANNA_REMOTE $branch"
	else
		log "WARNING: could not push $branch; the edits stay on the server and are tried again next run"
	fi
	git -C "$LANNA_REPO" worktree remove --force "$tree"
}

pull_sheets_from_repo() {
	local sha="$1" prev="$2" rel lang name target new_hash cur_hash old_hash
	while read -r rel; do
		[[ "$rel" =~ ^curriculum/([^/]+)/cheatsheets/([^/]+\.txt)$ ]] || continue
		lang="${BASH_REMATCH[1]}"
		name="${BASH_REMATCH[2]}"
		target="$LANNA_HOME/sheets/$lang/$name"
		mkdir -p "$LANNA_HOME/sheets/$lang"
		new_hash="$(git -C "$LANNA_REPO" show "$sha:$rel" | sha256sum | cut -d' ' -f1)"
		if [ ! -f "$target" ]; then
			git -C "$LANNA_REPO" show "$sha:$rel" >"$target"
			continue
		fi
		cur_hash="$(sheet_hash "$target")"
		[ "$cur_hash" = "$new_hash" ] && continue
		old_hash=""
		if [ -n "$prev" ]; then
			old_hash="$(git -C "$LANNA_REPO" show "$prev:$rel" 2>/dev/null | sha256sum | cut -d' ' -f1 || true)"
		fi
		if [ "$cur_hash" = "$old_hash" ]; then
			git -C "$LANNA_REPO" show "$sha:$rel" >"$target"
		fi
	done < <(git -C "$LANNA_REPO" ls-tree -r --name-only "$sha" -- curriculum)
}

run_boot_check() {
	docker run --rm --network none --read-only \
		--tmpfs /tmp:exec,mode=1777 --tmpfs /app/.next/cache:mode=1777 \
		--cap-drop ALL --security-opt no-new-privileges:true --user 10001:10001 \
		--entrypoint node "$1" /app/boot-check.mjs --standalone /app --image-checks
}

do_status() {
	echo "deployed:  $(cat "$STATE/deployed" 2>/dev/null || echo none) ($(cat "$STATE/deployed-image" 2>/dev/null || echo no image))"
	echo "previous:  $(cat "$STATE/previous" 2>/dev/null || echo none) ($(cat "$STATE/previous-image" 2>/dev/null || echo no image))"
	echo "images:    $(docker image ls "$LANNA_IMAGE_NAME" --format '{{.Tag}}' | tr '\n' ' ')"
	echo "container: $(compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null | head -n 1)"
	echo "log:       $LOG"
}

do_rollback() {
	local tag="${ROLLBACK_TO:-}" sha
	[ -z "$tag" ] && tag="$(cat "$STATE/previous-image" 2>/dev/null || true)"
	[ -n "$tag" ] || { log "nothing to roll back to"; exit 1; }
	[[ "$tag" == *:* ]] || tag="$LANNA_IMAGE_NAME:$tag"
	image_exists "$tag" || { log "image $tag is not on this machine"; exit 1; }
	sha="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$tag")"
	[ -n "$sha" ] || { log "image $tag has no revision label"; exit 1; }
	local from
	from="$(cat "$STATE/deployed" 2>/dev/null || true)"
	log "rolling back to $tag ($(short "$sha"))"
	[ -n "$from" ] && [ "$from" != "$sha" ] && : >"$STATE/failed-$from"
	switch_to "$tag" "$sha"
	if wait_healthy; then
		record_deployed "$sha" "$tag"
		log "rollback done; $(short "$from") will not be deployed again until --force"
	else
		log "ERROR: $tag did not become healthy after the rollback"
		exit 6
	fi
}

do_update() {
	if [ -n "$(git -C "$LANNA_REPO" status --porcelain --untracked-files=no)" ]; then
		log "the checkout at $LANNA_REPO has local changes; commit or discard them first"
		exit 3
	fi
	git -C "$LANNA_REPO" fetch -q --prune "$LANNA_REMOTE" "$REF"
	local new new_short tag deployed prev_deployed
	new="$(git -C "$LANNA_REPO" rev-parse "$LANNA_REMOTE/$REF^{commit}")"
	new_short="$(short "$new")"
	tag="$LANNA_IMAGE_NAME:$new_short"
	deployed="$(cat "$STATE/deployed" 2>/dev/null || true)"
	prev_deployed="$deployed"

	[ "$PUSH_SHEETS" = 1 ] && push_sheet_edits

	if [ "$new" = "$deployed" ] && [ "$FORCE" = 0 ] && image_exists "$tag"; then
		if [ -z "$(compose ps -q --status running 2>/dev/null)" ]; then
			log "$new_short is deployed but not running; starting it"
			[ "$DRY_RUN" = 1 ] || LANNA_IMAGE="$tag" compose up -d --remove-orphans
		fi
		exit 0
	fi
	if [ -e "$STATE/failed-$new" ] && [ "$FORCE" = 0 ]; then
		log "WARNING: $new_short failed before; waiting for a newer commit (use --force to try again)"
		exit 0
	fi
	if [ "$DRY_RUN" = 1 ]; then
		log "dry run: would build $tag from $LANNA_REMOTE/$REF, boot-check it and switch to it (now: $(short "${deployed:-none}"))"
		exit 0
	fi

	log "updating ${deployed:+$(short "$deployed") }to $new_short"
	if ! image_exists "$tag"; then
		BUILD_CONTEXT="$(mktemp -d)"
		git -C "$LANNA_REPO" archive "$new" | tar -x -C "$BUILD_CONTEXT"
		# shellcheck disable=SC2086
		if ! docker build $LANNA_DOCKER_BUILD_ARGS --label "org.opencontainers.image.revision=$new" -t "$tag" "$BUILD_CONTEXT" >>"$LOG" 2>&1; then
			: >"$STATE/failed-$new"
			log "ERROR: the build failed; the running version is untouched (details in $LOG)"
			exit 4
		fi
	fi

	if ! run_boot_check "$tag" >>"$LOG" 2>&1; then
		: >"$STATE/failed-$new"
		log "ERROR: the boot check failed for $tag; the running version is untouched (details in $LOG)"
		exit 5
	fi

	local previous_tag
	previous_tag="$(cat "$STATE/deployed-image" 2>/dev/null || true)"
	switch_to "$tag" "$new"
	if wait_healthy; then
		record_deployed "$new" "$tag"
		pull_sheets_from_repo "$new" "$prev_deployed"
		prune_images
		log "now running $tag"
	else
		: >"$STATE/failed-$new"
		log "ERROR: $tag did not become healthy"
		if [ -n "$previous_tag" ] && image_exists "$previous_tag"; then
			switch_to "$previous_tag" "$prev_deployed"
			log "went back to $previous_tag"
		fi
		exit 6
	fi
}

case "$COMMAND" in
	update) do_update ;;
	rollback) do_rollback ;;
	status) do_status ;;
esac
