/**
 * Before the rename to Lanna these keys started with "lh". Lessons and
 * sessions not yet sent to the server, and an uploaded reminder sound, would
 * be lost under the new keys, so each moves over once. Remove this file when
 * every browser and the desktop app have opened Lanna once.
 */

const QUEUES: Array<[former: string, current: string]> = [
	["lh-outbox", "lanna-outbox"],
	["lh-session-outbox", "lanna-session-outbox"],
];

const VALUES: Array<[former: string, current: string]> = [
	["lh:custom-reminder-sound-data", "lanna:custom-reminder-sound-data"],
	["lh:custom-reminder-sound-name", "lanna:custom-reminder-sound-name"],
];

function list(raw: string | null): unknown[] {
	try {
		const parsed: unknown = JSON.parse(raw ?? "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function adoptFormerStorage(storage: Storage | null | undefined): void {
	if (!storage) return;
	try {
		for (const [former, current] of QUEUES) {
			const kept = storage.getItem(former);
			if (kept === null) continue;
			storage.setItem(current, JSON.stringify([...list(storage.getItem(current)), ...list(kept)]));
			storage.removeItem(former);
		}
		for (const [former, current] of VALUES) {
			const kept = storage.getItem(former);
			if (kept === null) continue;
			if (storage.getItem(current) === null) storage.setItem(current, kept);
			storage.removeItem(former);
		}
	} catch {
		// Blocked or full storage: the former keys stay and the next read tries again.
	}
}
