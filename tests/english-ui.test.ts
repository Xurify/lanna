import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * All interface text is English; only learning content (sentences, words, story titles) is Slovak.
 * This flags Slovak words and diacritics in the UI code so a leftover cannot come back (it did once:
 * "V procese", "Začať čítať", "Knižnica" on the Words and Read pages).
 */

const ROOTS = ["app", "components", "lib"];

/** Files that hold Slovak on purpose, with the reason. Everything else must be English. */
const SLOVAK_ON_PURPOSE: Record<string, string> = {
	"components/lesson/lesson-player.tsx": "praise words spoken in Slovak after a right answer",
	"components/listen/listen-player.tsx": "praise words spoken in Slovak after a right answer",
	"components/speak/speak-player.tsx": "praise words spoken in Slovak after a right answer",
	"components/new-session.tsx": "example prompts that name Slovak grammar",
	"components/onboarding/start.tsx": "an example place name in a placeholder",
	"components/quiet/jump.tsx": "the Slovak letter shortcuts",
	"components/diacritic-bar.tsx": "the Slovak letter keys",
	"components/milestones/milestones-page.tsx": "examples of Slovak words in a sentence",
	"components/speech.tsx": "a Slovak example in a doc comment",
};

/** Common Slovak interface words. Whole words, case-insensitive. */
const SLOVAK_UI = [
	"V procese",
	"Začať",
	"Začať čítať",
	"Knižnica",
	"Slovník",
	"Preklad",
	"Preklad vypnutý",
	"Prečítané",
	"Otázky",
	"Nové slová",
	"Uložiť",
	"Zavrieť",
	"Späť",
	"Ďalej",
	"Nastavenia",
	"Hotovo",
	"Dobré ráno",
	"Dobrý deň",
	"Dobrý večer",
	"Nedeľa",
	"Pondelok",
	"Utorok",
	"Streda",
	"Štvrtok",
	"Piatok",
	"Sobota",
];

function files(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) return e.name === "node_modules" || e.name === ".next" ? [] : files(p);
		return /\.(ts|tsx)$/.test(e.name) ? [p.replace(/\\/g, "/")] : [];
	});
}

const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const sources = ROOTS.flatMap(files).map((f) => ({ file: f, code: withoutComments(fs.readFileSync(f, "utf8")) }));

describe("the interface is English", () => {
	it("no common Slovak interface word appears in the UI code", () => {
		const hits: string[] = [];
		for (const { file, code } of sources) {
			if (SLOVAK_ON_PURPOSE[file]) continue;
			for (const w of SLOVAK_UI) {
				const re = new RegExp(`(?<![\\p{L}])${w.replace(/ /g, "\\s+")}(?![\\p{L}])`, "iu");
				if (re.test(code)) hits.push(`${file}: "${w}"`);
			}
		}
		assert.deepEqual(hits, []);
	});

	it("no Slovak diacritic appears in a string or text of the UI code, outside the files that teach Slovak", () => {
		const hits: string[] = [];
		for (const { file, code } of sources) {
			if (SLOVAK_ON_PURPOSE[file]) continue;
			code.split("\n").forEach((line, i) => {
				if (/[áäčďĺľňôŕšťýžÁČĎĽŇŠŤÝŽ]/u.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
			});
		}
		assert.deepEqual(hits, []);
	});

	it("the allowlist names only files that exist", () => {
		for (const f of Object.keys(SLOVAK_ON_PURPOSE)) assert.ok(fs.existsSync(f), f);
	});
});
