/**
 * What the app keeps on this computer (Settings → Data): the report's shape,
 * the saved areas and the size formatter. Pure: the server measures
 * (src/server/storage.ts), the browser shows (storage-section.tsx).
 */

/** One folder the app keeps for the learner, measured on disk. */
export interface StorageArea {
	id: "clips" | "progress" | "backups";
	label: string;
	path: string;
	bytes: number;
	files: number;
}

export interface StorageReport {
	/** The active language's English name, for the progress row. */
	language: string;
	areas: StorageArea[];
}

/** The saved areas in the order Settings shows them. The browser draws every row before the measure lands, so nothing shifts. */
export const STORAGE_AREAS: readonly { id: StorageArea["id"]; label: string }[] = [
	{ id: "clips", label: "Voice clips" },
	{ id: "progress", label: "Learning progress" },
	{ id: "backups", label: "Backups" },
];

/** "0 B", "512 B", "1.5 KB", "210 MB", "1.4 GB". */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
