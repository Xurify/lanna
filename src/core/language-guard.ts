export const SHOWN_LANGUAGE_HEADER = "x-lh-language";

export const LANGUAGE_CHANGED = "language_changed";

export interface LanguageChanged {
	error: typeof LANGUAGE_CHANGED;
	shown: string;
	running: string;
	message: string;
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

const NAMES_ITS_OWN_LANGUAGE = new Set(["/api/profile", "/api/progress/time"]);

export function languageChanged(request: { method: string; pathname: string; shown: string | null }, running: string): LanguageChanged | null {
	const { method, pathname, shown } = request;
	if (!pathname.startsWith("/api/") || READS.has(method.toUpperCase()) || NAMES_ITS_OWN_LANGUAGE.has(pathname)) return null;
	if (!shown || shown === running) return null;
	return {
		error: LANGUAGE_CHANGED,
		shown,
		running,
		message: "The language was switched in another window or on another device, so this page saved nothing. Reload it to continue.",
	};
}

export function isLanguageChanged(body: unknown): body is LanguageChanged {
	return !!body && typeof body === "object" && (body as { error?: unknown }).error === LANGUAGE_CHANGED;
}

export function isOwnApiCall(url: string, origin: string): boolean {
	try {
		const u = new URL(url, origin);
		return u.origin === origin && u.pathname.startsWith("/api/");
	} catch {
		return false;
	}
}
