// electron-builder beforePack hook: refuse to package a version older than the
// latest published GitHub release. electron-updater never downgrades, so such a
// build can never reach an installed copy. Offline builds only get a warning.
let verdict = null;

module.exports = async function beforePack(context) {
	if (process.env.LANNA_ALLOW_OLD_VERSION === "1") return;
	verdict ??= judge(context.packager.appInfo.version);
	const result = await verdict;
	if (result && !result.ok) throw new Error(result.message);
};

async function judge(version) {
	const { judgeVersion, latestPublishedVersion } = await import("./release-version.mjs");
	let latest;
	try {
		latest = await latestPublishedVersion();
	} catch (error) {
		console.warn(`[before-pack] could not read published releases (${error.message}); building ${version} unchecked`);
		return null;
	}
	const result = judgeVersion(version, latest);
	if (result.ok) console.log(`[before-pack] ${result.message}`);
	return result;
}
