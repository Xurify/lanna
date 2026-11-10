import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string; homepage: string };

const production = process.env.NODE_ENV === "production";

const GOOGLE_AVATAR_HOSTS = ["yt3.ggpht.com", "yt4.ggpht.com", "yt3.googleusercontent.com", "yt4.googleusercontent.com", "lh3.googleusercontent.com", "lh4.googleusercontent.com", "lh5.googleusercontent.com", "lh6.googleusercontent.com"];

// Next writes inline scripts for hydration and the theme, and a static header cannot carry the
// per-request nonce that would replace 'unsafe-inline' (that needs the proxy). The directives
// that stop a page from sending data out or loading code from elsewhere are enforced.
const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
	"style-src 'self' 'unsafe-inline'",
	`img-src 'self' data: blob: https://i.ytimg.com ${GOOGLE_AVATAR_HOSTS.map((host) => `https://${host}`).join(" ")}`,
	"media-src 'self' blob: data:",
	"font-src 'self' data:",
	"connect-src 'self' wss://api.deepgram.com",
	"frame-src https://www.youtube-nocookie.com https://www.youtube.com",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Cross-Origin-Resource-Policy", value: "same-origin" },
	{ key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=(), serial=(), bluetooth=()" },
	...(production
		? [
				{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
				{ key: "Strict-Transport-Security", value: "max-age=31536000" },
			]
		: []),
];

const nextConfig: NextConfig = {
	// The Progress page was /plan; old links and bookmarks keep working.
	async redirects() {
		return [{ source: "/plan", destination: "/progress", permanent: false }];
	},
	async headers() {
		return [{ source: "/:path*", headers: SECURITY_HEADERS }];
	},
	experimental: {
		// Next buffers a request body for the proxy up to this size and silently cuts off the rest.
		proxyClientMaxBodySize: "10mb",
		// A page rendered before the click (components/instant-navigation.tsx) is reused by
		// the router for `static` seconds. Next's default is 300; 30 is the lowest it takes.
		// lib/render-ahead.ts counts on this number.
		staleTimes: { static: 30 },
	},
	// Public build metadata only; no new runtime Electron version API.
	env: { LH_VERSION: pkg.version, LH_HOMEPAGE: pkg.homepage },
	// Desktop target (Electron wrapper, 2026-09-17): standalone output = a
	// self-contained .next/standalone/server.js the Electron shell spawns
	// on 127.0.0.1. Harmless for plain web deploys (extra build output).
	// The manual copies the docs require — public/ and .next/static — are
	// done by scripts/build-server.mjs.
	output: "standalone",
	// The dev "N" bubble sat on top of the sidebar's Settings button in
	// desktop:dev; build errors still show as an overlay.
	devIndicators: false,
	// Tailscale Serve (E21): a phone loads this dev server's chunks from its tailnet
	// name. Next refuses a dev resource from any origin not listed here, so the page
	// never hydrates and pairing does nothing. The name lives in .env.local, which is
	// not committed, and only the dev server reads it, so a build never carries it.
	allowedDevOrigins: process.env.NODE_ENV === "development" && process.env.LH_TAILNET_HOST ? [process.env.LH_TAILNET_HOST] : undefined,
	// SAFETY (empirically verified 2026-09-17): without this, output file
	// tracing sweeps the repo's real data/ — chat records, graph ledgers —
	// INTO the standalone bundle. A shipped desktop app would carry the
	// developer's session data inside it.
	//
	// SECRETS (2026-10-08, caught in the payload audit): the same sweep
	// ships the repo-root auth.json — the DEV BYOK key store — byte-identical
	// into the DMG (the packaged app never reads it: the shell passes
	// LH_AUTH_FILE → userData). Excluded here; build-server.mjs also REFUSES
	// to package any standalone still containing it. .env* belt-and-braces
	// the same class. Next also copies loaded bare .env after tracing;
	// the build-server refusal remains required even with these excludes.
	//
	// ⚠ EXCLUDE PATTERNS ARE LOAD-BEARING IN WAYS THE DOCS DON'T DESCRIBE
	// (empirically established 2026-10-08): adding dir excludes like
	// "dist/**/*" / "./dist/**/*" for repo-root output dirs STRIPPED THE
	// server-external packages (pi-ai / pi-agent-core lost everything
	// under their dist/ — the traced copy collapsed to a bare package.json
	// and the packaged server died on ERR_MODULE_NOT_FOUND; openai/
	// @anthropic-ai — pi-ai's deps — vanished from the trace entirely).
	// Anchored "./"-prefixed forms behave the same. **/data/**/* fixes
	// suffix matching in Next's JavaScript collector, but NOT its native
	// Turbopack tracer: that still prunes gcp-metadata and its private deps.
	// Keep the narrow closure workaround below AND the native runtime gate.
	// Real SDK data/ directories still need their explicit includes too.
	// The recursive-DMG payload (repo dist/ swept into the bundle, shipping
	// the previous build inside the next) is instead prevented by the
	// desktop:dist clean step AND targeted post-trace curation in
	// scripts/build-server.mjs (2026-10-11): remove standalone-root dist/
	// and node_modules/electron/ (the demo helper's DEV runtime; packaged
	// helpers use the app's own binary). Runtime dependencies' dist/ dirs
	// stay intact, and the script guards against leaked data/keys.
	outputFileTracingExcludes: {
		"*": [
			"**/data/**/*",
			"auth.json",
			"chatgpt-credentials.json*",
			"github-copilot-credentials.json*",
			"xai-credentials.json*",
			".env*",
		],
	},
	// Empirically verified gaps (2026-09-17 standalone smoke): the tracer
	// misses JSON loaded via `import ... with { type: "json" }` attributes —
	// pi-ai's provider catalog (39 JSON files) vanished from the trace and
	// the server 500s on module load. Include the whole data dirs of the
	// runtime-loaded engine packages.
	// pdfjs-dist (sources v0 live smoke, 2026-09-19): its legacy build loads
	// the node fake worker (pdf.worker.mjs) and our standard_fonts dir via
	// runtime-resolved paths — invisible to the tracer. Bundling (without
	// serverExternalPackages below) additionally breaks the worker's
	// import.meta.url resolution inside .next/dev chunks — the live smoke
	// caught it; unit tests run unbundled and never see it.
	outputFileTracingIncludes: {
		"*": [
			"curriculum/**/*",
			"src/agent/prompts/**/*",
			// The standalone trace omitted this entire runtime-imported directory
			// in 0.3.0, so importing puppeteer-core failed before browser startup.
			"node_modules/@puppeteer/browsers/lib/browser-data/**/*.js",
			"node_modules/pdfjs-dist/legacy/**/*",
			"node_modules/pdfjs-dist/standard_fonts/**/*",
			// Wave E (2026-10-10): pdf_render paints via @napi-rs/canvas — its
			// platform binary (@napi-rs/canvas-<platform>-<arch>) is a dynamic
			// optional-dep require the tracer cannot see. Builds run per-OS and
			// npm installs only the current platform's binary, so this glob
			// resolves to exactly one Skia binary per build.
			"node_modules/@napi-rs/canvas-*/**/*",
			// Wave E stage 2: resvg rasterizes visual-maker SVGs natively; same
			// per-platform-binary story as the canvas above (one per build).
			"node_modules/@resvg/resvg-js-*/**/*",
			"node_modules/@earendil-works/pi-ai/dist/providers/data/**/*",
			// Public native OAuth factories load these flows through variable imports.
			// Electron main uses the same standalone SDK; the offline runtime gate
			// evaluates their real toAuth paths without login or provider requests.
			"node_modules/@earendil-works/pi-ai/dist/auth/oauth/{load,github-copilot,xai,device-code}.js",
			"node_modules/@earendil-works/pi-ai/dist/utils/sleep.js",
			"node_modules/@earendil-works/pi-agent-core/dist/**/*.json",
			// Next 16.3.2 native Turbopack applies unanchored excludes while
			// traversing modules; **/data/**/* still prunes gcp-metadata and
			// its private runtime chain. Includes are applied after traversal.
			// This is the verified GoogleAuth closure, not a general dep copy;
			// the offline native Pi gate must catch future SDK closure changes.
			"node_modules/gcp-metadata/**/*",
			"node_modules/json-bigint/**/*",
			"node_modules/bignumber.js/**/*",
		],
	},
	// Framework-free core lives in src/ (plain TS, imported by routes and CLI alike).
	// The pi engine must stay external: its providers are runtime-loaded Node
	// code (undici streams, catalog data) that breaks when bundled into routes.
	serverExternalPackages: [
		"@earendil-works/pi-ai",
		"@earendil-works/pi-agent-core",
		"pdfjs-dist", // sources v0: bundling breaks its node fake-worker path
		"@napi-rs/canvas", // native binding — bundling breaks the .node require
		"@resvg/resvg-js", // native binding — same
	],
};

export default nextConfig;