import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { standardFontsDir } from "./pdf-ops";

/**
 * Verification engines for sub-agents. PDFs render natively (pdfjs + Skia, no
 * browser). `available()` probes for the app's browser helper or a system
 * Chrome; nothing here launches one.
 *
 * Test seam: `headlessOverride.current` replaces the whole API (tests inject
 * a fake; nothing here touches a real browser). Builders call `getHeadless()`.
 */

export interface RenderPdfOptions {
	/** Render DPI — 72 is 100% zoom; the skill's guidance is 100/150/200. */
	dpi?: number;
}

export interface RenderedPdfPage {
	page: number;
	png: Buffer;
}

export interface HeadlessApi {
	/** True when a browser helper or Chrome is resolvable (cheap, no launch). */
	available(): boolean;
	/** Why not — for error messages. */
	unavailableReason(): string | null;
	/** Render PDF pages to PNGs natively (pdfjs + Skia) for the pdf-reader. */
	renderPdfPages(pdfPath: string, pages: number[], opts?: RenderPdfOptions): Promise<RenderedPdfPage[]>;
}

/** Test seam — undefined in production. */
const headlessOverride: { current?: HeadlessApi } = {};

export function getHeadless(): HeadlessApi {
	return headlessOverride.current ?? realHeadless;
}

// ─── Chrome resolution ───────────────────────────────────────────────────────

const CHROME_CANDIDATES = [
	...(process.platform === "win32"
		? [
				path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
				path.join(
					process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)",
					"Google",
					"Chrome",
					"Application",
					"chrome.exe",
				),
				...(process.env.LOCALAPPDATA
					? [path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")]
					: []),
			]
		: []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
];

function resolveChromeExecutablePath(): string | null {
	const candidates = [process.env.CHROME_PATH, ...CHROME_CANDIDATES].filter(
		(p): p is string => typeof p === "string" && p.length > 0,
	);
	for (const candidate of candidates) {
		try {
			if (fs.existsSync(candidate)) return candidate;
		} catch {
			/* not readable — try the next */
		}
	}
	return null;
}

const NO_CHROME_MESSAGE =
	"No render engine available: the app's own browser helper failed to start and no system Chrome/Chromium was found. " +
	"Install Google Chrome or set CHROME_PATH to a Chrome executable. " +
	"(Verification is mandatory — figures are never delivered unverified.)";

// ─── The app's own Chromium as a browser service (Wave E stage 3) ────────────

/** Handshake line parser (pure; exported for tests). */
export function parseBrowserServiceLine(line: string): number | null {
	const m = line.match(/^BROWSER_SERVICE_CDP (\d+)$/);
	if (!m) return null;
	const port = Number(m[1]);
	return port >= 1 && port <= 65535 ? port : null;
}

/** Spawn env sanitizer (pure; exported for tests): the helper must run as a
 *  FULL Electron app — ELECTRON_RUN_AS_NODE must not leak — and must not
 *  inherit the dev-shell userData redirect. */
export function browserServiceSpawnEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = { ...env };
	delete out.ELECTRON_RUN_AS_NODE;
	delete out.LH_DEV_URL;
	// The artifact renderer is not an authorized app API client.
	delete out.LH_DESKTOP_API_SECRET;
	delete out.LH_DESKTOP_SERVER;
	return out;
}

/** The helper binary: inside the packaged app the server runs under
 *  ELECTRON_RUN_AS_NODE so process.execPath IS the app binary; in dev
 *  (plain node) the electron package resolves to the dev binary path. */
function browserServiceBinary(): string | null {
	if (process.versions.electron) return process.execPath;
	try {
		const req = createRequire(import.meta.url);
		const p = req("electron") as unknown as string;
		return typeof p === "string" && p.length > 0 ? p : null;
	} catch {
		return null;
	}
}

// ─── PNG canonical form ──────────────────────────────────────────────────────

/** Canonicalize a raw Chrome screenshot for the model's eyes (2026-09-19 fix).
 *
 *  WHY: Chrome writes PNGs with a SPLIT IDAT stream (4KB chunks) — and
 *  Alibaba's vision decoder (behind OpenRouter's qwen3.8-flash, the
 *  visual-maker's look-model) rejected those outright during the
 *  2026-09-18/19 window: "The image format is illegal and cannot be opened",
 *  deterministically, at every size (50–800px) — while every single-IDAT
 *  form passed (a handcrafted 1×1, and sharp re-encodes). On a later re-test
 *  raw Chrome PNGs passed too (the upstream decoder was fixed or is flaky
 *  per backend), but the canonical form stays: PNG spec says the IDAT chunks
 *  are an arbitrary SPLIT of one zlib stream, so merging them is the more
 *  standard shape, byte-identical stream, zero re-encoding.
 *
 *  Pure Node on purpose (no sharp): historically the process already carried
 *  a native image lib via @huggingface/transformers' nested sharp + libvips,
 *  and importing the root sharp (Next's optional dependency) put a SECOND
 *  libvips into the process — macOS's ObjC runtime warns (duplicate
 *  GNotificationCenterDelegate, "mysterious crashes"). The transformers
 *  embedder died with wave 6 (2026-09-23) but the rule lives on: one native
 *  image lib per process; app code carries none. */
export function providerSafePng(png: Buffer): Buffer {
	const SIG_LEN = 8;
	if (png.length < SIG_LEN + 12 || png.subarray(0, SIG_LEN).toString("hex") !== "89504e470d0a1a0a") return png;
	// Walk the chunks once, merging the IDAT split into its canonical
	// single-chunk form (first IDAT's position, concatenated payload).
	const parts: Array<{ type: string; data: Buffer }> = [];
	let off = SIG_LEN;
	while (off + 12 <= png.length) {
		const len = png.readUInt32BE(off);
		if (off + 12 + len > png.length) break; // truncated tail — leave as-is
		parts.push({ type: png.subarray(off + 4, off + 8).toString("ascii"), data: png.subarray(off + 8, off + 8 + len) });
		off += 12 + len;
	}
	const idats = parts.filter((p) => p.type === "IDAT");
	if (idats.length < 2) return png; // already canonical
	const merged = Buffer.concat(idats.map((p) => p.data));
	let emittedIdat = false;
	const out: Buffer[] = [png.subarray(0, SIG_LEN)];
	for (const p of parts) {
		if (p.type !== "IDAT") out.push(chunk(p.type, p.data));
		else if (!emittedIdat) {
			out.push(chunk("IDAT", merged));
			emittedIdat = true;
		}
	}
	return Buffer.concat(out);
}

/** One PNG chunk (length + type + data + CRC32) — the spec's exact layout. */
function chunk(type: string, data: Buffer): Buffer {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, "ascii");
	data.copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

/** CRC-32 (PNG's polynomial, table-less) for chunk checksums. */
function crc32(buf: Buffer): number {
	let c = ~0;
	for (const byte of buf) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

// ─── PDF page rasterization (pdfjs paints, Skia hosts) ─────────────────

/** Render PDF pages to PNGs — the sources-v0 pdf-reader's eyes.
 *
 *  History: pdfjs ALWAYS painted the pages (scale = dpi/72, the skill's
 *  zoom arithmetic) — first inside a headless Chrome tab (canvas shim,
 *  toDataURL, 2026-09-19), now into @napi-rs/canvas in this process (Wave
 *  E, 2026-10-10). The paint engine never changed; only the canvas host:
 *  Skia in-process via pdfjs-dist v6's own Node integration. No browser,
 *  no temp files, no base64 hop. */
async function renderPdfPages(
	pdfPath: string,
	pages: number[],
	opts: RenderPdfOptions = {},
): Promise<RenderedPdfPage[]> {
	const dpi = opts.dpi ?? 150;
	// NATIVE CANVAS (Wave E, owner 2026-10-10): pdfjs paints into
	// @napi-rs/canvas in this process — no browser involved. pdfjs-dist v6's
	// own Node integration IS @napi-rs/canvas (its optionalDependency: the
	// NodeCanvasFactory requires it), so the paint engine is the exact code
	// that used to run in the Chrome shim tab; only the canvas host changed
	// (Skia in-process instead of a DOM canvas). Text-side pdf tools never
	// needed a browser; now renders don't either.
	const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const { createCanvas } = await import("@napi-rs/canvas");
	const data = new Uint8Array(fs.readFileSync(path.resolve(pdfPath)));
	// Standard-font data as a directory path (live-smoke finding 2026-09-19:
	// without it pdfjs renders non-embedded standard fonts via fallback);
	// verbosity 0 = errors only (JBIG2 noise on scanned PDFs).
	const loadingTask = pdfjs.getDocument({ data, standardFontDataUrl: standardFontsDir(), verbosity: 0 });
	const doc = await loadingTask.promise;
	try {
		const out: RenderedPdfPage[] = [];
		for (const pageNo of pages) {
			if (pageNo < 1 || pageNo > doc.numPages) continue;
			const pg = await doc.getPage(pageNo);
			const vp = pg.getViewport({ scale: dpi / 72 });
			const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
			const ctx = canvas.getContext("2d");
			// pdfjs's render types speak the DOM context; @napi-rs/canvas's
			// context is the same 2D API implemented over Skia.
			await pg.render({
				canvasContext: ctx as unknown as CanvasRenderingContext2D,
				canvas: canvas as unknown as HTMLCanvasElement,
				viewport: vp,
			}).promise;
			out.push({
				page: pageNo,
				// Skia-encoded PNG → providerSafePng for the same single-IDAT
				// canonical form every other vision-model image gets.
				png: providerSafePng(canvas.toBuffer("image/png")),
			});
		}
		return out;
	} finally {
		await loadingTask.destroy().catch(() => {});
	}
}

// ─── the real API ────────────────────────────────────────────────────────────

export const realHeadless: HeadlessApi = {
	available() {
		// The helper binary exists by construction in the packaged app; in dev
		// it resolves via the electron package. System Chrome widens coverage.
		return browserServiceBinary() !== null || resolveChromeExecutablePath() !== null;
	},
	unavailableReason() {
		return browserServiceBinary() === null && resolveChromeExecutablePath() === null ? NO_CHROME_MESSAGE : null;
	},
	renderPdfPages,
};
