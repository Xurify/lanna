/**
 * Recordings and their file names (Speak, 2026-10-31): ONE mapping from a
 * clip's MIME type to the extension it is sent and kept under. Every clip
 * used to be called `line.webm`, even when the browser had recorded MP4, so
 * the name now follows the type. Speak records WAV; the older containers
 * (WebM, Ogg, MP4) still map correctly, because clips already on disk and
 * older clients must keep working.
 */

export type AudioExt = "wav" | "ogg" | "m4a" | "webm";

/** The extension for `mime` — "wav" for audio/wav, "webm" when unknown. */
export function audioExt(mime: string): AudioExt {
	const base = (mime || "").split(";")[0]!.trim().toLowerCase();
	if (base.includes("wav")) return "wav";
	if (base.includes("ogg")) return "ogg";
	if (base.includes("mp4") || base.includes("m4a") || base.includes("aac")) return "m4a";
	return "webm";
}
