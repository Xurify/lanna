/**
 * Listening outside the app (2026-11-07): log, list and remove the stretches
 * the learner logs by hand (src/core/outside.ts, src/store/outside.ts).
 */

import crypto from "node:crypto";
import { BACKDATE_DAYS, outsideSummary, parseEntry, type OutsideEntry, type OutsideSummary } from "../core/outside.ts";
import { PACE_WINDOW_DAYS } from "../core/curriculum.ts";
import { dayKey } from "../core/review.ts";
import { outsideStore } from "../store/outside.ts";

/** The day keys of the pace window, today last. */
export function paceWindow(now: Date, tz?: number): string[] {
	const keys: string[] = [];
	for (let i = PACE_WINDOW_DAYS - 1; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * 86_400_000), tz));
	return keys;
}

export interface OutsideState {
	/** The last seven days' entries, newest first. */
	recent: OutsideEntry[];
	summary: OutsideSummary;
	/** Days an entry can be dated to, today first. */
	days: string[];
}

export function outsideState(now = new Date(), tz?: number): OutsideState {
	const entries = outsideStore.read().entries;
	const days = paceWindow(now, tz).slice(-BACKDATE_DAYS).reverse();
	const shown = new Set(days);
	return {
		recent: entries.filter((e) => shown.has(e.day)).sort((a, b) => b.at.localeCompare(a.at)),
		summary: outsideSummary(entries, paceWindow(now, tz)),
		days,
	};
}

export function outsideSummaryNow(now = new Date(), tz?: number): OutsideSummary {
	return outsideSummary(outsideStore.read().entries, paceWindow(now, tz));
}

export type LogResult = { ok: true; entry: OutsideEntry; state: OutsideState } | { ok: false; status: number; message: string };

export function logOutside(body: { minutes?: unknown; attention?: unknown; what?: unknown; day?: unknown } | null, now = new Date(), tz?: number): LogResult {
	const parsed = parseEntry(body);
	if (!parsed.ok) return { ok: false, status: 400, message: parsed.message };
	const allowed = paceWindow(now, tz).slice(-BACKDATE_DAYS);
	const day = body?.day === undefined ? allowed.at(-1)! : body.day;
	if (typeof day !== "string" || !allowed.includes(day)) return { ok: false, status: 400, message: `day must be one of the last ${BACKDATE_DAYS} days` };
	const entry: OutsideEntry = { id: crypto.randomUUID(), day, at: now.toISOString(), minutes: parsed.minutes, attention: parsed.attention, ...(parsed.what ? { what: parsed.what } : {}) };
	const file = outsideStore.read();
	file.entries.push(entry);
	outsideStore.write(file);
	return { ok: true, entry, state: outsideState(now, tz) };
}

export function removeOutside(id: string, now = new Date(), tz?: number): { ok: boolean; state: OutsideState } {
	const file = outsideStore.read();
	const kept = file.entries.filter((e) => e.id !== id);
	const ok = kept.length !== file.entries.length;
	if (ok) outsideStore.write({ entries: kept });
	return { ok, state: outsideState(now, tz) };
}
