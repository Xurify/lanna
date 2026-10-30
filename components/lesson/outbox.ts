/**
 * The lesson outbox (LangHarness, 2026-10-30). A finished lesson is written
 * here before its end screen waits on anything, then sent to POST /api/lesson
 * in the background. An entry leaves the outbox only once the server has
 * recorded it, so a window closed mid-save, a dropped connection or a restart
 * cannot lose a lesson. The server answers a retry of an id it has already
 * recorded without counting the lesson again (src/server/lesson.ts).
 *
 * The outbox lives in localStorage: the write is synchronous, so a lesson is
 * kept the moment it is finished and the end screen never waits for a request.
 */

import type { UnitId } from "@/src/core";

export interface Recorded {
	queued: string[];
	newBest?: number;
	summary: {
		streak: { days: number; activeToday: boolean };
		todayXp: number;
		dailyGoal: number;
		next: UnitId;
		bestBlitz: number;
		units: Array<{ id: UnitId; title: string; lessons: number; done: boolean; accuracy: number | null }>;
	};
}

export interface Pending {
	id: string;
	/** The language profile the lesson was finished in ("sk", "ru"). */
	lang: string;
	at: string;
	/** The POST /api/lesson body, without the id. */
	body: Record<string, unknown>;
	/** The status the server refused it with. A refused lesson stays in the outbox. */
	refused?: number;
}

const KEY = "lh-outbox";

function storage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

function read(): Pending[] {
	try {
		const list = JSON.parse(storage()?.getItem(KEY) ?? "[]") as unknown;
		return Array.isArray(list) ? (list as Pending[]) : [];
	} catch {
		return [];
	}
}

function write(list: Pending[]): void {
	try {
		storage()?.setItem(KEY, JSON.stringify(list));
	} catch {
		// Storage full or blocked: the lesson is still sent now, just not kept.
	}
}

function newId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Keep a finished lesson. Synchronous: once this returns, the lesson is in the outbox. */
export function enqueueLesson(lang: string, body: Record<string, unknown>): Pending {
	const entry: Pending = { id: newId(), lang, at: new Date().toISOString(), body };
	write([...read(), entry]);
	return entry;
}

type Settle = (recorded: Recorded | null) => void;
const waiters = new Map<string, Set<Settle>>();

/** Called with the server's answer once the entry is recorded, or with null
 *  when the server refuses it for good (the entry is then dropped). */
export function onSettled(id: string, settle: Settle): () => void {
	const set = waiters.get(id) ?? new Set<Settle>();
	set.add(settle);
	waiters.set(id, set);
	return () => {
		set.delete(settle);
	};
}

function settle(id: string, recorded: Recorded | null): void {
	const set = waiters.get(id);
	waiters.delete(id);
	for (const s of set ?? []) s(recorded);
}

let running: Promise<void> | null = null;
let failures = 0;
let retry: ReturnType<typeof setTimeout> | undefined;

function retryLater(lang: string): void {
	failures++;
	const delay = Math.min(60_000, 2_000 * 2 ** (failures - 1));
	clearTimeout(retry);
	retry = setTimeout(() => {
		retry = undefined;
		void flushOutbox(lang);
	}, delay);
}

async function drain(lang: string): Promise<void> {
	// A refused lesson is skipped for the rest of this run, so it cannot loop.
	const refusedNow = new Set<string>();
	for (;;) {
		const next = read().find((p) => p.lang === lang && !refusedNow.has(p.id));
		if (!next) {
			failures = 0;
			return;
		}
		let res: Response | null = null;
		try {
			res = await fetch("/api/lesson", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ...next.body, clientId: next.id }),
			});
		} catch {
			res = null;
		}
		if (res?.ok) {
			let recorded: Recorded;
			try {
				recorded = (await res.json()) as Recorded;
			} catch {
				return retryLater(lang);
			}
			write(read().filter((p) => p.id !== next.id));
			failures = 0;
			settle(next.id, recorded);
			continue;
		}
		if (res && res.status >= 400 && res.status < 500) {
			// Never dropped: a lesson stays until the server records it. It is marked and sent again on a later run.
			const status = res.status;
			refusedNow.add(next.id);
			write(read().map((p) => (p.id === next.id ? { ...p, refused: status } : p)));
			settle(next.id, null);
			continue;
		}
		return retryLater(lang);
	}
}

/** Send this language's waiting lessons, oldest first, until none are left or
 *  the server cannot be reached. Two calls at once share one run. */
export function flushOutbox(lang: string): Promise<void> {
	running ??= drain(lang).finally(() => {
		running = null;
	});
	return running;
}

/** Send what is waiting now, and again whenever the app comes back to life:
 *  the window gains focus, or the network returns. */
export function watchOutbox(lang: () => string | null): () => void {
	const again = () => {
		const code = lang();
		if (code) void flushOutbox(code);
	};
	window.addEventListener("focus", again);
	window.addEventListener("online", again);
	again();
	return () => {
		window.removeEventListener("focus", again);
		window.removeEventListener("online", again);
	};
}

/** Test seam: forget the in-memory state (timers, waiters, the failure count). */
export function _resetOutboxForTests(): void {
	clearTimeout(retry);
	retry = undefined;
	failures = 0;
	running = null;
	waiters.clear();
}
