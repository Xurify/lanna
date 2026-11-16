export interface PendingSession {
	id: string;
	lang: string;
	url: string;
	body: string;
}

const KEY = "lh-session-outbox";

function read(): PendingSession[] {
	try {
		const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
		return Array.isArray(list) ? (list as PendingSession[]) : [];
	} catch {
		return [];
	}
}

function write(list: PendingSession[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		// storage blocked: the session can still be sent from its own screen
	}
}

function newSessionId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function keepSession(lang: string, url: string, payload: Record<string, unknown>): PendingSession {
	const id = newSessionId();
	const session = { id, lang, url, body: JSON.stringify({ ...payload, clientId: id }) };
	write([...read(), session]);
	return session;
}

export class RefusedError extends Error {}

const listeners = new Map<string, Set<(outcome: unknown) => void>>();

export function onSessionSaved(id: string, listener: (outcome: unknown) => void): () => void {
	const set = listeners.get(id) ?? new Set();
	set.add(listener);
	listeners.set(id, set);
	return () => {
		set.delete(listener);
	};
}

let failures = 0;
let retry: ReturnType<typeof setTimeout> | undefined;

function retryLater(lang: string): void {
	failures++;
	clearTimeout(retry);
	retry = setTimeout(
		() => {
			retry = undefined;
			void flushSessions(lang);
		},
		Math.min(60_000, 2_000 * 2 ** (failures - 1)),
	);
}

export async function sendSession<T>(session: PendingSession): Promise<T> {
	let res: Response;
	try {
		res = await fetch(session.url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: session.body,
			signal: AbortSignal.timeout(15_000),
		});
	} catch (err) {
		retryLater(session.lang);
		throw err;
	}
	if (res.status >= 400 && res.status < 500) {
		write(read().filter((s) => s.id !== session.id));
		throw new RefusedError(`HTTP ${res.status}`);
	}
	if (!res.ok) {
		retryLater(session.lang);
		throw new Error(`HTTP ${res.status}`);
	}
	const outcome = (await res.json()) as T;
	write(read().filter((s) => s.id !== session.id));
	failures = 0;
	for (const listener of listeners.get(session.id) ?? []) listener(outcome);
	listeners.delete(session.id);
	return outcome;
}

export function _resetSessionsForTests(): void {
	clearTimeout(retry);
	retry = undefined;
	failures = 0;
	listeners.clear();
}

let flushing = false;

async function flushSessions(lang: string): Promise<void> {
	if (flushing) return;
	flushing = true;
	try {
		for (const session of read().filter((s) => s.lang === lang)) {
			try {
				await sendSession(session);
			} catch (err) {
				if (!(err instanceof RefusedError)) return;
			}
		}
	} finally {
		flushing = false;
	}
}

export function watchSessions(lang: () => string | null): () => void {
	const again = () => {
		const code = lang();
		if (code) void flushSessions(code);
	};
	window.addEventListener("focus", again);
	window.addEventListener("online", again);
	again();
	return () => {
		window.removeEventListener("focus", again);
		window.removeEventListener("online", again);
	};
}
