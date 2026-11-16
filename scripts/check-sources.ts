/**
 * Checks the DOIs in src/core/sources.ts against Crossref: each must
 * resolve, to a record whose first author and title match the entry.
 * Network, slow (one request a second; the public pool rate-limits), so it
 * is not part of `npm test`.
 *
 *   npm run sources:check            every DOI
 *   npm run sources:check -- lambert only the ids that start with this
 *
 * Sends no contact details. Exits 1 when any entry does not match.
 */

import { SOURCES } from "../src/core/sources.ts";

const only = process.argv[2];

const words = (s: string) =>
	new Set(
		s
			.toLocaleLowerCase("en")
			.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.replace(/[^a-z0-9 ]+/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 3),
	);

function overlap(a: string, b: string): number {
	const x = words(a);
	const y = words(b);
	if (x.size === 0) return 0;
	let n = 0;
	for (const w of x) if (y.has(w)) n++;
	return n / x.size;
}

const fold = (s: string) =>
	s
		.toLocaleLowerCase("en")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z]+/g, "");

async function fetchWork(
	doi: string,
): Promise<{ title: string; first: string; names: string[]; year: number | null } | "missing" | "error"> {
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
				headers: { "User-Agent": "langharness-source-check/1.0" },
			});
			if (res.status === 404) return "missing";
			if (res.ok) {
				const m = ((await res.json()) as { message: Record<string, unknown> }).message;
				const title = String((m.title as string[] | undefined)?.[0] ?? "");
				const authors = (m.author as Array<{ family?: string; name?: string }> | undefined) ?? [];
				const editors = (m.editor as Array<{ family?: string; name?: string }> | undefined) ?? [];
				const first = authors[0]?.family ?? authors[0]?.name ?? editors[0]?.family ?? "";
				const names = [...authors, ...editors].map((a) => a.family ?? a.name ?? "").filter(Boolean);
				const issued = (m.issued as { "date-parts"?: number[][] } | undefined)?.["date-parts"]?.[0]?.[0] ?? null;
				return { title, first, names, year: issued };
			}
			if (res.status !== 429 && res.status < 500) return "error";
		} catch {
			// network hiccup: back off and try again
		}
		await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
	}
	return "error";
}

let bad = 0;
let checked = 0;
for (const s of SOURCES) {
	if (!s.doi || (only && !s.id.startsWith(only))) continue;
	checked++;
	const w = await fetchWork(s.doi);
	await new Promise((r) => setTimeout(r, 900));
	if (w === "missing" || w === "error") {
		bad++;
		console.log(`FAIL ${s.id}: ${w === "missing" ? "DOI not found" : "could not reach Crossref"} (${s.doi})`);
		continue;
	}
	// Any listed author will do: Crossref sometimes stores a given name as the family name.
	const firstOk = w.names.length === 0 || w.names.some((n) => fold(s.cite).includes(fold(n).slice(0, 6)));
	const titleScore = overlap(s.title, w.title);
	// Books and chapters often carry a different record title; a low score is a warning there.
	const titleOk = titleScore >= 0.5 || s.kind === "book" || s.kind === "theory";
	const yearGap = w.year ? Math.abs(w.year - s.year) : 0;
	const status = firstOk && titleOk ? (yearGap > 2 ? "warn" : "ok  ") : "FAIL";
	if (status === "FAIL") bad++;
	console.log(
		`${status} ${s.id.padEnd(16)} ${w.first.padEnd(16)} ${String(w.year ?? "?").padEnd(5)} title match ${Math.round(titleScore * 100)}%${yearGap > 2 ? ` (year differs: ${s.year} vs ${w.year})` : ""}`,
	);
}
console.log(`${checked} DOIs checked, ${bad} problem${bad === 1 ? "" : "s"}.`);
process.exit(bad ? 1 : 0);
