export const SHOWN_LANGUAGE_HEADER = "x-lh-language";

export const DEVICE_LANGUAGE_COOKIE = "lh-language";

export const LANGUAGE_GONE = "language_gone";

export interface LanguageGone {
	error: typeof LANGUAGE_GONE;
	shown: string;
	message: string;
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

export function languageGone(request: { method: string; pathname: string; shown: string | null }, isLanguage: (id: string) => boolean): LanguageGone | null {
	const { method, pathname, shown } = request;
	if (!shown || !pathname.startsWith("/api/") || READS.has(method.toUpperCase()) || isLanguage(shown)) return null;
	return { error: LANGUAGE_GONE, shown, message: "This page's language was removed, so it saved nothing. Reload the page to continue." };
}

export function isLanguageGone(body: unknown): body is LanguageGone {
	return !!body && typeof body === "object" && (body as { error?: unknown }).error === LANGUAGE_GONE;
}

export function isSameOrigin(url: string, origin: string): boolean {
	try {
		return new URL(url, origin).origin === origin;
	} catch {
		return false;
	}
}

// RFC 6265bis caps a cookie's lifetime at 400 days, and browsers clamp anything longer.
const COOKIE_MAX_AGE_S = 400 * 86_400;

export function deviceLanguageCookie(profile: string, secure: boolean): string {
	const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${COOKIE_MAX_AGE_S}`];
	if (secure) attributes.push("Secure");
	return [`${DEVICE_LANGUAGE_COOKIE}=${encodeURIComponent(profile)}`, ...attributes].join("; ");
}
