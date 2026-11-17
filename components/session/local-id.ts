const LOCAL_ID_PREFIX = "c_";

let sequence = 0;

export function localId(): string {
	const next = sequence;
	sequence += 1;
	return `${LOCAL_ID_PREFIX}${Date.now().toString(36)}_${next.toString(36)}`;
}

export function isLocalId(id: unknown): boolean {
	return typeof id === "string" && id.startsWith(LOCAL_ID_PREFIX);
}
