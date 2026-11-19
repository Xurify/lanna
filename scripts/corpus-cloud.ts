import { PATHS } from "../config.ts";
import { migrateMediaBackup } from "../src/server/media-backup.ts";
import {
	BACKUP_BUCKET,
	cloudflareBucket,
	leftOut,
	localFiles,
	pull,
	pullPlan,
	push,
	pushPlan,
	totalBytes,
	type BackupFile,
} from "../src/server/cloud-backup.ts";

const [mode, ...args] = process.argv.slice(2);
const yes = args.includes("--yes");
const megabytes = (files: BackupFile[]) => `${(totalBytes(files) / 1_000_000).toFixed(1)} MB`;

if (mode !== "push" && mode !== "pull") {
	console.error("Use `npm run corpus:push` or `npm run corpus:pull`.");
	process.exit(1);
}

const root = PATHS.base;
const bucket = await cloudflareBucket();
if (mode === "push" && yes) await migrateMediaBackup(bucket);
const local = await localFiles(root);
const remote = await bucket.list();
console.log(`${root}: ${local.length} files, ${megabytes(local)}`);
console.log(`${BACKUP_BUCKET} bucket: ${remote.length} files, ${megabytes(remote)}`);
console.log(`Left out: ${leftOut().join("; ")}`);

let count = 0;
const progress = (total: number) => () => {
	count++;
	if (count % 100 === 0 || count === total) console.log(`  ${count} of ${total}`);
};

let failed: string[] = [];
if (mode === "push") {
	const plan = pushPlan(local, remote);
	console.log(`\n${plan.upload.length} to upload (${megabytes(plan.upload)}), ${plan.same} already the same.`);
	if (plan.onlyInCloud.length > 0)
		console.log(`${plan.onlyInCloud.length} in the bucket that are no longer here; they stay in the bucket.`);
	if (!yes) console.log("\nNothing was uploaded. Run `npm run corpus:push -- --yes` to upload.");
	else failed = await push(root, bucket, plan.upload, progress(plan.upload.length));
} else {
	const plan = pullPlan(local, remote);
	console.log(`\n${plan.download.length} to download (${megabytes(plan.download)}), ${plan.same} already the same.`);
	if (plan.different.length > 0) {
		console.log(`${plan.different.length} differ from the bucket; the files here are kept:`);
		for (const file of plan.different.slice(0, 20)) console.log(`  ${file}`);
		if (plan.different.length > 20) console.log(`  and ${plan.different.length - 20} more`);
	}
	if (!yes) console.log("\nNothing was written. Run `npm run corpus:pull -- --yes` to download.");
	else failed = await pull(root, bucket, plan.download, progress(plan.download.length));
}

for (const line of failed) console.error(`  FAILED ${line}`);
if (failed.length > 0) console.error(`${failed.length} failed. Run the command again to retry them.`);
process.exit(failed.length > 0 ? 1 : 0);
