import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { isLanguageProfile, setRequestProfile, type LanguageProfile } from "../../config.ts";
import { DEVICE_LANGUAGE_COOKIE, SHOWN_LANGUAGE_HEADER } from "../core/language-guard.ts";

interface Hints {
	headers: { get(name: string): string | null };
	cookies: { get(name: string): { value: string } | undefined };
}

export function languageOf(hints: Hints, isLanguage: (id: string) => boolean = isLanguageProfile): LanguageProfile | undefined {
	const shown = hints.headers.get(SHOWN_LANGUAGE_HEADER);
	if (shown && isLanguage(shown)) return shown;
	const device = hints.cookies.get(DEVICE_LANGUAGE_COOKIE)?.value;
	return device && isLanguage(device) ? device : undefined;
}

const resolved = new WeakMap<object, LanguageProfile | null>();

// Next keeps the request it is serving (a page render, a route handler, and
// everything they start) in an AsyncLocalStorage; `headers()` and `cookies()`
// read the same store, but only asynchronously.
function requestProfile(): LanguageProfile | undefined {
	const store = workUnitAsyncStorage.getStore();
	if (store?.type !== "request") return undefined;
	let profile = resolved.get(store);
	if (profile === undefined) {
		profile = languageOf(store) ?? null;
		resolved.set(store, profile);
	}
	return profile ?? undefined;
}

setRequestProfile(requestProfile);
