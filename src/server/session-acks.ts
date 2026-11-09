import { progressStore } from "../store/progress.ts";

const ACK_CAP = 200;
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

export function sessionClientId(v: unknown): string | undefined {
	return typeof v === "string" && CLIENT_ID.test(v) ? v : undefined;
}

export function recordOnce<T>(kind: string, clientId: string | undefined, record: () => T): T {
	if (!clientId) return record();
	const id = `${kind}:${clientId}`;
	const prior = progressStore.read().sessionAcks?.find((a) => a.id === id);
	if (prior) return prior.outcome as T;
	const outcome = record();
	const p = progressStore.read();
	p.sessionAcks = [...(p.sessionAcks ?? []), { id, outcome }].slice(-ACK_CAP);
	progressStore.write(p);
	return outcome;
}
