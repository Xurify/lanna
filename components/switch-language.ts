"use client";

/** Run another language from now on. The server switches in place; the page
 *  then loads again from the server, since the browser's copy of the course
 *  is read once per page load. `to` is where it lands, Today by default.
 *  Throws with the server's reason when the switch has to wait. */
export async function switchLanguage(id: string, english: string, to = "/"): Promise<void> {
	const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: id }) });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? `Could not switch to ${english}.`);
	}
	window.location.assign(to);
}

/** Pages that mean the same thing in every language. Any other page holds
 *  something of the old language (a chat, a lesson, an exam), so a switch
 *  from it lands on Today. */
const SAME_IN_EVERY_LANGUAGE = new Set(["/", "/review", "/listen", "/read", "/speak", "/watch", "/words", "/speed", "/progress", "/milestones", "/mistakes", "/curriculum", "/map", "/tasks", "/log"]);

export function landingAfterSwitch(pathname: string): string {
	return SAME_IN_EVERY_LANGUAGE.has(pathname) ? pathname : "/";
}

/** Start adding a language in the background; the error says why not. */
export async function addLanguage(id: string, slot?: "strong" | "cheap" | "dictionary"): Promise<void> {
	const res = await fetch("/api/languages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", id, ...(slot ? { slot } : {}) }) });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? "Could not start adding the language");
	}
}
