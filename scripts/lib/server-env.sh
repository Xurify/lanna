#!/usr/bin/env bash
# Sourced by update-server.sh and backup-data.sh. Needs LANNA_REPO.

env_value() {
	local key="$1" value="${!1-}"
	if [ -z "$value" ] && [ -f "$LANNA_REPO/.env" ]; then
		value="$(sed -n -E "s/^${key}=//p" "$LANNA_REPO/.env" | tail -n 1 | sed -E "s/^[\"']//; s/[\"']\$//")"
	fi
	printf '%s' "$value"
}
