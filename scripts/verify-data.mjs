import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(root)) {
	console.error(
		"usage: verify-data.mjs <folder>\nPrints one tab-separated line (path, json or jsonl, broken lines) for each JSON file that does not parse, then a # summary line. Changes nothing.",
	);
	process.exit(2);
}

function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile()) yield full;
	}
}

async function brokenLines(file) {
	let broken = 0;
	const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
	for await (const line of lines) {
		if (!line.trim()) continue;
		try {
			JSON.parse(line);
		} catch {
			broken += 1;
		}
	}
	return broken;
}

let files = 0;
let problems = 0;
for (const file of walk(root)) {
	const relative = path.relative(root, file).split(path.sep).join("/");
	if (file.endsWith(".jsonl")) {
		files += 1;
		const broken = await brokenLines(file);
		if (broken > 0) {
			problems += 1;
			console.log(`${relative}\tjsonl\t${broken}`);
		}
	} else if (file.endsWith(".json")) {
		files += 1;
		try {
			JSON.parse(fs.readFileSync(file, "utf8"));
		} catch {
			problems += 1;
			console.log(`${relative}\tjson\t1`);
		}
	}
}
console.log(`# ${files} JSON files read, ${problems} with problems`);
