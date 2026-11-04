/**
 * ASPECT AND DEMONSTRATIVE DRILLS (LangHarness, 2026-11-04). Pins what ships:
 * the aspect family's twelve pairs and the verifier's eighteen approved rows
 * (two perfective, sixteen imperfective); the balance gate (a pair is drilled
 * and recorded only with rows of both aspects, so the shipped data drills
 * none); the mend rule across both aspects; the excluded sentences; the
 * whole-word ten/tento counts; the parallel-form rule; the frame file's read
 * rule; the explanation links (page-level, on the allowlist); the explanation
 * never entering a drill, the record or the first try; and a simulator of the
 * eighteen rows' supply, with the real builder run over fifty seeds for the
 * shipped state. No network: every source is a file in the repository.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { exampleText, type LexiconEntry } from "../src/core/review.ts";
import { formsOfEntry, twinSentences } from "../src/core/pairs.ts";
import {
	buildMixupLesson,
	drillable,
	familyOf,
	MIXUP_FAMILIES,
	mixupKey,
	mixupLexicon,
	mixupStatus,
	parallelForm,
	tallyMixups,
	twinsOf,
	type MixupFamily,
	type MixupRecord,
} from "../src/core/mixups.ts";
import { isAllowedReferenceUrl, REFERENCE_PAGES, referencePageUrl } from "../src/core/reference-pages.ts";
import { aspectFrames, parseFrameRows } from "../src/server/aspect-frames.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] }).words;
const lex = mixupLexicon(entries);
const E = (slug: string) => {
	const e = lex.bySlug.get(slug);
	assert.ok(e, `lexicon has ${slug}`);
	return e;
};
const aspect = MIXUP_FAMILIES.find((f) => f.id === "aspect") as MixupFamily;
const thisThat = MIXUP_FAMILIES.find((f) => f.id === "this-vs-that") as MixupFamily;
const pairsFile = JSON.parse(fs.readFileSync("curriculum/slovak/pairs.json", "utf-8")) as { excluded: Array<{ slug: string; sk: string; why: string }> };

const rows = aspect.probes ?? [];
const perfectiveOf = (pair: [string, string]) => pair[1];
const at = (n: number) => new Date(Date.UTC(2026, 10, 4, 9, n)).toISOString();

/** A record entry for an aspect pair, as tallyMixups would write it after a miss. */
function openAspect(a: string, b: string, misses = 1, hits = 0, won?: string[]): MixupRecord {
	return {
		[mixupKey(a, b)]: {
			a,
			b,
			words: [entryWord(a), entryWord(b)],
			family: "aspect",
			since: at(0),
			lastAt: at(0),
			misses,
			hits,
			...(won ? { won } : {}),
		},
	};
}
const entryWord = (slug: string) => E(slug).forms?.[0] ?? slug;

test("the aspect family lists twelve pairs, each with both twins in the lexicon", () => {
	assert.equal(aspect.pairs.length, 12);
	for (const [a, b] of aspect.pairs) {
		E(a);
		E(b);
		assert.equal(familyOf(a, b)?.id, "aspect", `${a}/${b} belongs to the aspect family`);
	}
});

test("the aspect family holds the verifier's eighteen rows: two perfective, sixteen imperfective", () => {
	assert.equal(rows.length, 18);
	const perfective = rows.filter((r) => aspect.pairs.some((p) => perfectiveOf(p) === r.slug));
	assert.equal(perfective.length, 2, "two perfective rows (kupit, pripravit)");
	assert.equal(rows.length - perfective.length, 16, "sixteen imperfective rows");
});

test("every approved row is a verified lexicon sentence, with its cue type on the right side of the licence", () => {
	const sentences = new Set(entries.flatMap((e) => e.examples.filter((x) => x.cloze && !x.rejected).map((x) => exampleText(x))));
	for (const row of rows) {
		assert.ok(row.approved && row.approved.trim().length > 0, `${row.slug}: approved`);
		assert.equal(row.src, "verified-pool", `${row.slug}: from the verified pool`);
		const pair = aspect.pairs.find((p) => p.includes(row.slug));
		assert.ok(pair, `${row.slug} is a twin of an aspect pair`);
		const side = pair[0] === row.slug ? "first" : "second";
		assert.ok(aspect.licence?.[side]?.includes(row.type), `${row.slug}: "${row.type}" is licensed for the ${side} twin`);
		assert.ok(sentences.has(row.sk), `${row.slug}: "${row.sk}" is a verified lexicon sentence`);
		if (row.form) assert.ok(row.sk.includes(row.form), `${row.slug}: the form "${row.form}" is in the sentence`);
	}
});

test("balance gate: no aspect pair is drillable in the shipped data, so none is drilled or recorded", () => {
	for (const [a, b] of aspect.pairs) {
		assert.equal(drillable(lex, a, b), false, `${a}/${b} is not drillable`);
		assert.equal(twinsOf(lex, a, b).length, 0, `${a}/${b} has no drill sentences`);
	}
});

test("a wrong first try between aspect twins records nothing while the pair is undrillable", () => {
	const event = { slug: "napisat", answer: "napísať", given: "písať", verdict: "wrong" as const, sentence: "Chcem napísať knihu.", at: at(1) };
	const { record, found } = tallyMixups({}, [event], lex);
	assert.deepEqual(record, {});
	assert.deepEqual(found, []);
});

test("the mend rule: three right first tries on one aspect do not mend; both aspects do", () => {
	const key = mixupKey("pisat", "napisat");
	let record = openAspect("pisat", "napisat");
	const right = (slug: string, n: number) => ({ slug, answer: slug, given: slug, verdict: "exact" as const, sentence: "", at: at(n) });
	record = tallyMixups(record, [right("pisat", 2), right("pisat", 3), right("pisat", 4)], lex).record;
	assert.deepEqual(record[key]!.won, ["pisat"]);
	assert.equal(record[key]!.hits, 3);
	assert.equal(mixupStatus(record[key]!), "active", "one side is not enough");
	record = tallyMixups(record, [right("napisat", 5)], lex).record;
	assert.equal(mixupStatus(record[key]!), "mended", "a right first try on the other aspect mends it");
});

test("the mend and clear rules use both aspects when a family lists probes, and one aspect otherwise", () => {
	assert.equal(mixupStatus({ misses: 1, hits: 3, won: ["pisat"] }), "active");
	assert.equal(mixupStatus({ misses: 1, hits: 3, won: ["pisat", "napisat"] }), "mended");
	assert.equal(mixupStatus({ misses: 1, hits: 3 }), "mended", "a family without probes keeps the old rule");
	assert.equal(mixupStatus({ misses: 0, hits: 2, won: ["pisat"] }), "probe");
	assert.equal(mixupStatus({ misses: 0, hits: 2, won: ["pisat", "napisat"] }), "cleared");
});

test("the lesson for an undrillable aspect pair has no items, for every seed", () => {
	const record = openAspect("pisat", "napisat");
	for (let seed = 1; seed <= 50; seed++) {
		assert.equal(buildMixupLesson(entries, record, { seed }).items.length, 0, `seed ${seed}`);
	}
});

test("the parallel form pairs písal with napísal; unverified paradigms give none", () => {
	assert.equal(parallelForm(E("pisat"), E("napisat"), "písal"), "napísal");
	assert.equal(parallelForm(E("pisat"), E("napisat"), "písať"), null, "an infinitive is not in the paradigm list");
	assert.equal(parallelForm(E("citat"), E("precitat"), "čítal"), null, "citat has no verified paradigm");
	assert.equal(parallelForm(E("pomahat"), E("pomoct"), "pomáhal"), null, "pomahat has no verified paradigm");
});

test("the pinned perfective futures are verified forms of their twins", () => {
	const pinned: Array<[string, string]> = [
		["vstat", "vstanem"],
		["pripravit", "pripravím"],
		["pomoct", "pomôžem"],
		["vziat", "vezmem"],
		["kupit", "kúpim"],
		["predat", "predám"],
		["napisat", "napíšem"],
		["precitat", "prečítam"],
		["urobit", "urobím"],
		["dat", "dám"],
		["uvidiet", "uvidím"],
		["povedat", "poviem"],
	];
	for (const [slug, form] of pinned) assert.ok(formsOfEntry(E(slug)).includes(form.toLowerCase()), `${slug} has ${form}`);
});

test("the excluded sentences never reach their pair", () => {
	assert.ok(pairsFile.excluded.length >= 4, "the four verifier exclusions are recorded");
	for (const { slug, sk, why } of pairsFile.excluded) {
		assert.ok(why.length > 0, `${slug}: a reason is recorded`);
		const pair = aspect.pairs.find((p) => p.includes(slug));
		assert.ok(pair, `${slug} is in an aspect pair`);
		const other = pair[0] === slug ? pair[1] : pair[0];
		assert.ok(entries.find((e) => e.slug === slug)!.examples.some((x) => exampleText(x) === sk), `the excluded sentence is in the lexicon: ${sk}`);
		const raw = twinSentences(E(slug), E(other));
		assert.ok(!raw.some((x) => exampleText(x.entry.examples[x.index]!) === sk), `excluded from ${slug}/${other}: ${sk}`);
	}
});

test("ten and tento: whole-word matching gives four sentences for each, never the other's form", () => {
	const s = twinSentences(E("ten"), E("tento"));
	assert.equal(s.filter((x) => x.member === "a").length, 4, "ten");
	assert.equal(s.filter((x) => x.member === "b").length, 4, "tento");
	for (const x of s) {
		const text = exampleText(x.entry.examples[x.index]!);
		const other = x.member === "a" ? "tento" : "ten";
		assert.ok(!new RegExp(`(?<![\\p{L}])${other}(?![\\p{L}])`, "iu").test(text), `no ${other} in: ${text}`);
	}
});

test("the this-vs-that family drills nothing until it lists approved rows", () => {
	assert.equal(familyOf("ten", "tento")?.id, "this-vs-that");
	assert.deepEqual(thisThat.probes, []);
	assert.equal(twinsOf(lex, "tento", "ten").length, 0);
	assert.equal(drillable(lex, "tento", "ten"), false);
});

test("parallel-form alignment is not used by the demonstrative family", () => {
	assert.equal(thisThat.probeForm, "lemma");
	assert.equal(aspect.probeForm, "parallel");
});

test("the frame file holds no rows, and a row is read only with a recorded approval and src frame", () => {
	assert.deepEqual(aspectFrames(), [], "the shipped frame file is empty");
	const row = { slug: "pisat", sk: "Tom bude písať list.", type: "budem + inf", phrase: "budem + inf", src: "frame" };
	assert.deepEqual(parseFrameRows(null), []);
	assert.deepEqual(parseFrameRows({}), []);
	assert.deepEqual(parseFrameRows({ rows: [{ ...row, approved: null }] }), [], "no approval, no row");
	assert.deepEqual(parseFrameRows({ rows: [{ ...row, src: "verified-pool", approved: "verifier" }] }), [], "only src frame");
	assert.equal(parseFrameRows({ rows: [{ ...row, approved: "verifier 2026-11-04" }] }).length, 1);
});

test("every explanation link is a page-level slovak.wiki page on the allowlist", () => {
	const withExplain = MIXUP_FAMILIES.filter((f) => f.explain);
	assert.equal(withExplain.length, 2, "the aspect and demonstrative explanations");
	for (const f of withExplain) {
		assert.ok(isAllowedReferenceUrl(f.explain!.wiki), `${f.id}: ${f.explain!.wiki} is allowed`);
	}
	assert.equal(referencePageUrl("/grammar/aspect"), "https://slovak.wiki/grammar/aspect");
	assert.equal(referencePageUrl("/not-listed"), null);
	assert.equal(isAllowedReferenceUrl("https://www.slovak.wiki/grammar"), false, "the root is not an allowed page");
	assert.ok(REFERENCE_PAGES.every((p) => p.startsWith("/") && !p.endsWith("/")));
});

test("the explanations are marked pending verifier until the verifier signs them off", () => {
	assert.equal(aspect.explain?.checked, "pending verifier");
	assert.equal(thisThat.explain?.checked, "pending verifier");
});

test("the explanations' example sentences are never drill sentences or approved rows", () => {
	const contrast = [aspect.explain!.contrast.first.sk, aspect.explain!.contrast.second.sk];
	for (const sk of contrast) assert.ok(!rows.some((r) => r.sk === sk), `${sk} is not an approved row`);
	for (const [a, b] of aspect.pairs) {
		const sentences = twinsOf(lex, a, b).map((x) => exampleText(x.entry.examples[x.index]!));
		for (const sk of contrast) assert.ok(!sentences.includes(sk), `${sk} is not a drill sentence`);
	}
});

test("the demonstrative tables have one cell per column and name every missing form", () => {
	for (const grid of thisThat.explain!.tables!) {
		for (const row of grid.rows) assert.equal(row.cells.length, grid.cols.length, `${grid.title}: ${row.case}`);
	}
	const tento = thisThat.explain!.tables![1]!;
	assert.equal(tento.rows[2]!.cells[3], "not yet", "a form neither the reference nor a verified sentence has is never filled in");
});

test("every filled demonstrative cell is a form the reference names or a verified sentence has", () => {
	const words = new Set(entries.flatMap((e) => e.examples.filter((x) => x.cloze && !x.rejected).flatMap((x) => exampleText(x).toLowerCase().match(/\p{L}+/gu) ?? [])));
	const named = new Set(["ten", "tá", "to", "tí", "tie", "toho", "tej", "tomu", "tom", "tým", "tou", "tých", "tými", "tú", "tento", "tohto", "tomuto", "túto", "týmto", "títo", "tieto"]);
	for (const grid of [...thisThat.explain!.tables!, ...aspect.explain!.tables ?? []]) {
		for (const row of grid.rows) {
			for (const cell of row.cells) {
				if (cell === "not yet") continue;
				for (const part of cell.replace(/\([^)]*\)/g, "").split("/").map((x) => x.trim())) {
					assert.ok(named.has(part) || words.has(part.toLowerCase()), `${grid.title}: "${part}" is backed`);
				}
			}
		}
	}
});

test("simulator: the eighteen rows' supply, sessions of twelve, and minutes until the first repeat", () => {
	const LESSON = 12;
	const CHOICE_SECONDS = 10;
	const TYPED_SECONDS = 20;
	const unique = new Set(rows.map((r) => `${r.slug}|${r.sk}`)).size;
	const triples = new Set(rows.map((r) => `${mixupKey(...(aspect.pairs.find((p) => p.includes(r.slug)) as [string, string]))}|${r.type}|${r.phrase}`)).size;
	assert.equal(unique, 18, "expected unique items");
	// Two pairs of rows share a triple (predávajú / predáva generic; hovoril / hovorila "vždy + manner").
	assert.equal(triples, 16, "distinct (pair, cue type, phrase)");
	const firstRepeat = unique + 1; // the 19th rep is the first repeat
	assert.equal(Math.ceil(firstRepeat / LESSON), 2, "the first repeat falls in the second session");
	assert.equal(((firstRepeat - 1) % LESSON) + 1, 7, "at its seventh rep");
	assert.equal((unique * CHOICE_SECONDS) / 60, 3, "three minutes of choice reps before a repeat");
	assert.equal((unique * TYPED_SECONDS) / 60, 6, "six minutes if every rep were typed");
});

test("simulator: the shipped state, the real builder over fifty seeds, gives no sentence and no repeat", () => {
	const record = openAspect("pisat", "napisat");
	const seen = new Set<string>();
	let sessionsWithItems = 0;
	for (let seed = 1; seed <= 50; seed++) {
		const plan = buildMixupLesson(entries, record, { seed });
		if (plan.items.length) sessionsWithItems++;
		for (const item of plan.items) seen.add(item.id);
	}
	assert.equal(sessionsWithItems, 0);
	assert.equal(seen.size, 0, "distinct sentences in fifty sessions");
});
