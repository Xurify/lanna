# syntax=docker/dockerfile:1
# docker buildx build --platform linux/amd64,linux/arm64 -t lanna:local .
# The base image comes from Docker Hub, which rate-limits shared addresses:
# --build-arg NODE_IMAGE=mirror.gcr.io/library/node:26-bookworm-slim uses Google's mirror of it.
ARG NODE_IMAGE=node:26-bookworm-slim

FROM ${NODE_IMAGE} AS ytdlp
ARG YTDLP_VERSION=2026.10.26
ARG YTDLP_SHA256_AMD64=767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795
ARG YTDLP_SHA256_ARM64=e87e9533e89fe5889abaa21f5114dfe7756d6aa6219b83551add04d48b18e483
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN set -eu; \
	case "$(dpkg --print-architecture)" in \
		amd64) asset=yt-dlp_linux; sum="$YTDLP_SHA256_AMD64" ;; \
		arm64) asset=yt-dlp_linux_aarch64; sum="$YTDLP_SHA256_ARM64" ;; \
		*) echo "no yt-dlp build for $(dpkg --print-architecture)" >&2; exit 1 ;; \
	esac; \
	curl -fsSL -o /yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${asset}"; \
	echo "${sum}  /yt-dlp" | sha256sum -c -; \
	chmod 0755 /yt-dlp

FROM ${NODE_IMAGE} AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# Electron's install script only downloads the desktop binary, which the server does not use.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build \
	&& node scripts/smoke-provider-runtime.mjs \
	&& node scripts/build-server.mjs \
	&& npx esbuild scripts/web-password.ts scripts/remote-code.ts --bundle --platform=node --format=esm --target=node22 --out-extension:.js=.mjs --outdir=/src/cli

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 10001 lh \
	&& useradd --uid 10001 --gid 10001 --home-dir /home/lh --create-home --shell /usr/sbin/nologin lh \
	&& chmod 0777 /home/lh \
	&& mkdir -p /data /keys /sheets \
	&& chown 10001:10001 /data /keys /sheets
COPY --from=ytdlp /yt-dlp /usr/local/bin/yt-dlp
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3010 \
	HOSTNAME=0.0.0.0 \
	HOME=/home/lh \
	LANNA_DATA_DIR=/data \
	LANNA_AUTH_FILE=/keys/auth.json \
	LANNA_REPO_CHEATSHEETS_DIR=/sheets \
	CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.claude/skills/slovak-language ./.claude/skills/slovak-language
COPY --from=build /src/scripts/boot-check.mjs /src/scripts/verify-data.mjs ./
COPY --from=build /src/cli ./cli
COPY docker/entrypoint.sh /usr/local/bin/lh-entrypoint
RUN chmod 0755 /usr/local/bin/lh-entrypoint \
	&& mkdir -p /app/.next/cache \
	&& chmod 1777 /app/.next/cache
USER 10001:10001
EXPOSE 3010
ENTRYPOINT ["lh-entrypoint"]
CMD ["node", "server.js"]
