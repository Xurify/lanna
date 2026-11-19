import type { Bucket } from "./cloud-backup.ts";
import { mediaBackupPath } from "../core/media-path.ts";

export async function migrateMediaBackup(bucket: Bucket): Promise<number> {
	const files = await bucket.list();
	const legacy = files.filter((file) => mediaBackupPath(file.path) !== file.path);
	if (!legacy.length) return 0;
	const remove = bucket.remove?.bind(bucket);
	if (!remove) throw new Error("This backup cannot remove legacy media files.");
	const existing = new Map(files.map((file) => [file.path, file]));
	for (const file of legacy) {
		const target = existing.get(mediaBackupPath(file.path));
		if (target && (target.size !== file.size || target.md5 !== file.md5))
			throw new Error(`Cannot migrate media backup: conflicting file "${target.path}". Both copies were kept.`);
	}
	for (const file of legacy) {
		const target = mediaBackupPath(file.path);
		const data = await bucket.get(file.path);
		if (!existing.has(target)) await bucket.put(target, data);
		const copy = await bucket.get(target);
		if (!copy.equals(data)) throw new Error(`Media backup verification failed for "${target}". Legacy copy kept.`);
	}
	let moved = 0;
	for (const file of legacy) {
		await remove(file.path);
		moved++;
	}
	return moved;
}
