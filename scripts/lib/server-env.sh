#!/usr/bin/env bash
# Sourced by update-server.sh and backup-data.sh. Needs LH_REPO.

env_value() {
	local key="$1" value="${!1-}"
	if [ -z "$value" ] && [ -f "$LH_REPO/.env" ]; then
		value="$(sed -n -E "s/^${key}=//p" "$LH_REPO/.env" | tail -n 1 | sed -E "s/^[\"']//; s/[\"']\$//")"
	fi
	printf '%s' "$value"
}
