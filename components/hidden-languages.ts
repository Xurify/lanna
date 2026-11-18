"use client";

/**
 * Target languages kept off the language menu on this device, so the app can be
 * shown to someone without listing every language studied. The language being
 * studied right now always shows: every page is in it.
 */

import { useSyncExternalStore } from "react";

const KEY = "lanna-hidden-languages";
const NONE: readonly string[] = [];
const listeners = new Set<() => void>();
let cached: { raw: string | null; ids: readonly string[] } = { raw: null, ids: NONE };

function read(): readonly string[] {
	let raw: string | null;
	try {
		raw = localStorage.getItem(KEY);
	} catch {
		return NONE;
	}
	if (raw === cached.raw) return cached.ids;
	let ids: readonly string[] = NONE;
	try {
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string");
	} catch {
		ids = NONE;
	}
	cached = { raw, ids };
	return ids;
}

export function setLanguageHidden(id: string, hidden: boolean): void {
	const rest = read().filter((other) => other !== id);
	try {
		localStorage.setItem(KEY, JSON.stringify(hidden ? [...rest, id] : rest));
	} catch {
		return;
	}
	for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	window.addEventListener("storage", cb);
	return () => {
		listeners.delete(cb);
		window.removeEventListener("storage", cb);
	};
}

export function useHiddenLanguages(): readonly string[] {
	return useSyncExternalStore(subscribe, read, () => NONE);
}

/** The languages a menu may list: hidden ones drop out, the active one never does. */
export function shownLanguages<T extends { id: string }>(
	profiles: readonly T[],
	active: string,
	hidden: readonly string[],
): T[] {
	return profiles.filter((p) => p.id === active || !hidden.includes(p.id));
}

/** The day across languages without the hidden ones, its totals summed again from what is left. */
export function shownDay<
	D extends { minutes: number; practiced: number; languages: L[] },
	L extends { id: string; running: boolean; minutes: number; practiced: number },
>(day: D, hidden: readonly string[]): D {
	if (!day.languages.some((l) => !l.running && hidden.includes(l.id))) return day;
	const languages = day.languages.filter((l) => l.running || !hidden.includes(l.id));
	return {
		...day,
		languages,
		minutes: languages.reduce((n, l) => n + l.minutes, 0),
		practiced: languages.reduce((n, l) => n + l.practiced, 0),
	};
}
