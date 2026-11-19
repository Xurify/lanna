import fs from "node:fs";
import path from "node:path";

// Remove this migration and src/server/media-backup.ts after all local profiles and backups
// are verified on media/. Keep src/core/media-path.ts so older backups still restore correctly.
function checkMerge(source: string, target: string): void {
	const from = fs.lstatSync(source);
	const to = fs.existsSync(target) ? fs.lstatSync(target) : null;
	if (from.isDirectory() && (!to || to.isDirectory())) {
		for (const name of fs.readdirSync(source)) checkMerge(path.join(source, name), path.join(target, name));
		return;
	}
	if (from.isFile()) {
		if (!to) return;
		if (to.isFile() && fs.readFileSync(source).equals(fs.readFileSync(target))) return;
	}
	throw new Error(`Cannot migrate media library: resolve conflicting paths "${source}" and "${target}" first.`);
}

function mergeDirectory(source: string, target: string): void {
	fs.mkdirSync(target, { recursive: true });
	for (const name of fs.readdirSync(source)) {
		const from = path.join(source, name);
		const to = path.join(target, name);
		if (!fs.existsSync(to)) fs.renameSync(from, to);
		else if (fs.lstatSync(from).isDirectory()) mergeDirectory(from, to);
		else fs.unlinkSync(from);
	}
	fs.rmdirSync(source);
}

export function mediaDirectory(profileRoot: string): string {
	const target = path.join(profileRoot, "media");
	const legacy = path.join(profileRoot, "videos");
	if (!fs.existsSync(legacy)) return target;
	if (!fs.existsSync(target)) fs.renameSync(legacy, target);
	else {
		checkMerge(legacy, target);
		mergeDirectory(legacy, target);
	}
	return target;
}

export function migrateMediaLibraries(dataRoot: string): string[] {
	const profiles = path.join(dataRoot, "profiles");
	if (!fs.existsSync(profiles)) return [];
	const migrated: string[] = [];
	for (const profile of fs.readdirSync(profiles, { withFileTypes: true })) {
		if (!profile.isDirectory()) continue;
		const root = path.join(profiles, profile.name);
		if (!fs.existsSync(path.join(root, "videos"))) continue;
		mediaDirectory(root);
		migrated.push(profile.name);
	}
	return migrated;
}
