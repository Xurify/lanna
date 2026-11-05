"use client";

/** Select a language profile for the next start and restart into it. The
 *  desktop app relaunches itself; a browser on `next dev` gets the line to
 *  show instead. */
export async function switchLanguage(id: string, english: string): Promise<{ restartNote: string | null }> {
	const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: id }) });
	if (!res.ok) throw new Error(`Could not switch to ${english}`);
	const next = (await res.json()) as { restartRequired?: boolean; active?: string };
	// Already running it: a course just finished for it loads only on a restart.
	const reload = next.active === id;
	if (!next.restartRequired && !reload) return { restartNote: null };
	if (window.lh?.relaunch) {
		window.lh.relaunch();
		return { restartNote: null };
	}
	return { restartNote: `Restart LangHarness to switch to ${english}.` };
}

/** Start adding a language in the background; the error says why not. */
export async function addLanguage(id: string, slot?: "strong" | "cheap" | "dictionary"): Promise<void> {
	const res = await fetch("/api/languages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", id, ...(slot ? { slot } : {}) }) });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? "Could not start adding the language");
	}
}
