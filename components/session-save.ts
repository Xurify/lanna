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

export async function sendSession<T>(session: PendingSession): Promise<T> {
	const res = await fetch(session.url, { method: "POST", headers: { "content-type": "application/json" }, body: session.body, signal: AbortSignal.timeout(15_000) });
	const refused = res.status >= 400 && res.status < 500;
	if (res.ok || refused) write(read().filter((s) => s.id !== session.id));
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as T;
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
				if (!(err instanceof Error && /^HTTP 4/.test(err.message))) return;
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
