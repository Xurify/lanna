/**
 * Artifact download helpers (release polish, 2026-10-07): the tiny
 * save-a-blob seam shared by the figure cards. downloadFile touches the DOM
 * and only runs on click.
 */

/** Save text as a downloaded file. The blob URL is revoked right after the
 *  click — Chromium keeps the download alive past the revoke. */
export function downloadFile(name: string, text: string, mime: string): void {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}
