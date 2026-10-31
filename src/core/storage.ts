/**
 * Settings → Storage: the report's shape and the size formatter. Pure (no
 * fs): the server measures (src/server/storage.ts, GET /api/storage) and the
 * browser section shows (components/settings/storage-section.tsx).
 */

/** One folder the app keeps for the learner, measured on disk. */
export interface StorageArea {
	id: "clips" | "progress" | "backups";
	label: string;
	/** Where it lives on this computer, so the learner can find it. */
	path: string;
	bytes: number;
	files: number;
}

export interface StorageReport {
	/** The active language's English name, for the progress row. */
	language: string;
	areas: StorageArea[];
}

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
