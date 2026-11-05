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
import { GRAMMAR_WORDS } from "../src/core/reading.ts";

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
/** The slugs the verifier accepted without a formsVerified flag (family data). */
const accepted = new Set(aspect.formsAccepted ?? []);
const verifiedOrAccepted = (e: LexiconEntry) => (e as { formsVerified?: boolean }).formsVerified === true || accepted.has(e.slug);
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

test("every approved row is a verified lexicon sentence, with its cue type on the right side of the license", () => {
	const sentences = new Set(entries.flatMap((e) => e.examples.filter((x) => x.cloze && !x.rejected).map((x) => exampleText(x))));
	for (const row of rows) {
		assert.ok(row.approved && row.approved.trim().length > 0, `${row.slug}: approved`);
		assert.equal(row.src, "verified-pool", `${row.slug}: from the verified pool`);
		const pair = aspect.pairs.find((p) => p.includes(row.slug));
		assert.ok(pair, `${row.slug} is a twin of an aspect pair`);
		const side = pair[0] === row.slug ? "first" : "second";
		assert.ok(aspect.license?.[side]?.includes(row.type), `${row.slug}: "${row.type}" is licensed for the ${side} twin`);
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
	const family = "aspect";
	assert.equal(mixupStatus({ misses: 1, hits: 3, won: ["pisat"], family }), "active");
	assert.equal(mixupStatus({ misses: 1, hits: 3, won: ["pisat", "napisat"], family }), "mended");
	assert.equal(mixupStatus({ misses: 1, hits: 3, won: ["pisat", "pisat"], family }), "active", "one aspect twice is still one side");
	assert.equal(mixupStatus({ misses: 1, hits: 3, family }), "active", "S2: a probe family with no won counts as empty, not as both sides");
	assert.equal(mixupStatus({ misses: 1, hits: 3 }), "mended", "a pair outside a probe family keeps the old rule");
	assert.equal(mixupStatus({ misses: 0, hits: 2, won: ["pisat"], family }), "probe");
	assert.equal(mixupStatus({ misses: 0, hits: 2, won: ["pisat", "napisat"], family }), "cleared");
	assert.equal(mixupStatus({ misses: 0, hits: 2, family }), "probe", "S2: no won, no clear");
});

test("the lesson for an undrillable aspect pair has no items, for every seed", () => {
	const record = openAspect("pisat", "napisat");
	for (let seed = 1; seed <= 50; seed++) {
		assert.equal(buildMixupLesson(entries, record, { seed }).items.length, 0, `seed ${seed}`);
	}
});

test("the parallel form: index pairs the paradigm, the lemma pairs the infinitive, unverified lists give none", () => {
	assert.equal(parallelForm(E("pisat"), E("napisat"), "písal"), "napísal");
	assert.equal(parallelForm(E("pisat"), E("napisat"), "písať"), "napísať", "the infinitive pairs with the other lemma");
	assert.equal(parallelForm(E("citat"), E("precitat"), "čítal", accepted), "prečítal", "citat's paradigm is accepted by the family");
	assert.equal(parallelForm(E("pomahat"), E("pomoct"), "pomáhal", accepted), "pomohol", "pomahat's paradigm is accepted by the family");
	assert.equal(parallelForm(E("citat"), E("precitat"), "čítal"), null, "without the family's acceptance an unverified list gives none");
	assert.equal(parallelForm({ ...E("citat"), formsVerified: undefined } as LexiconEntry, E("precitat"), "čítal", accepted), "prečítal");
	assert.equal(parallelForm({ ...E("citat"), formsVerified: undefined } as LexiconEntry, E("precitat"), "čítal", new Set()), null, "an unverified list gives none");
});

test("brať and vziať pair by grammatical tag: the present and the past line up (bral is paired with vzal, not vzalo)", () => {
	const brat = E("brat");
	const vziat = E("vziat");
	assert.equal(brat.forms!.length, 12, "brať lists two imperatives");
	assert.equal(vziat.forms!.length, 10, "vziať lists none (the lexicon is not edited for it)");
	assert.equal(parallelForm(brat, vziat, "bral"), "vzal");
	assert.equal(parallelForm(brat, vziat, "brala"), "vzala");
	assert.equal(parallelForm(vziat, brat, "vzal"), "bral", "and the other way round");
	assert.equal(parallelForm(vziat, brat, "vzalo"), "bralo");
	assert.equal(parallelForm(brat, vziat, "beriem"), "vezmem", "the 1sg present pairs with the 1sg present");
	assert.equal(parallelForm(brat, vziat, "brať"), "vziať", "the infinitive");
	assert.equal(parallelForm(E("pisat"), E("napisat"), "píš"), "napíš", "the 2sg imperative of písať");
	assert.equal(parallelForm(E("pisat"), E("napisat"), "píšte"), "napíšte", "the 2pl imperative of písať");
});

test("the unmatched imperatives are dropped: ber and berte have no counterpart on vziať, so they give no parallel", () => {
	const brat = E("brat");
	const vziat = E("vziat");
	assert.ok(brat.forms!.includes("ber") && brat.forms!.includes("berte"), "brať lists both imperatives");
	assert.equal(parallelForm(brat, vziat, "ber"), null, "ber is dropped");
	assert.equal(parallelForm(brat, vziat, "berte"), null, "berte is dropped");
	assert.equal(parallelForm(brat, vziat, "beriu"), null, "a form not in the list gives none");
});

test("alignment over all twelve aspect pairs: each form pairs with the twin's form of the same tag and ordinal, an imperative with no counterpart is dropped, and a short list gives null", () => {
	const isPast = (f: string) => /l(?:a|o|i)?$/iu.test(f);
	/** The tag a slot has in the lexicon's order: past by form, then the first six non-past are present, the rest imperative. */
	const tagsOf = (forms: string[]) => {
		let nonPast = 0;
		return forms.map((f) => (isPast(f) ? "past" : nonPast++ < 6 ? "present" : "imperative"));
	};
	const checked: string[] = [];
	for (const [a, b] of aspect.pairs) {
		const ea = E(a);
		const eb = E(b);
		assert.ok(verifiedOrAccepted(ea) && verifiedOrAccepted(eb), `${a}/${b}: both paradigms are verified or accepted by the family`);
		const fa = ea.forms!;
		const fb = eb.forms!;
		const ta = tagsOf(fa);
		const tb = tagsOf(fb);
		assert.equal(ta.filter((t) => t === "present").length, tb.filter((t) => t === "present").length, `${a}/${b}: the same present slots`);
		assert.equal(ta.filter((t) => t === "past").length, tb.filter((t) => t === "past").length, `${a}/${b}: the same past slots`);
		assert.deepEqual(ta.filter((t) => t !== "imperative"), tb.filter((t) => t !== "imperative"), `${a}/${b}: present and past sit in the same order`);
		for (let i = 0; i < fa.length; i++) {
			if (fa.indexOf(fa[i]!) !== i) continue;
			const ordinal = ta.slice(0, i).filter((t) => t === ta[i]).length;
			const counterpart = tb.flatMap((t, j) => (t === ta[i] ? [j] : []))[ordinal];
			const expected = counterpart === undefined ? null : fb[counterpart]!;
			assert.equal(parallelForm(ea, eb, fa[i]!, accepted), expected, `${a}/${b}: slot ${i} (${fa[i]}) pairs with ${expected ?? "nothing"}`);
		}
		checked.push(`${a}/${b}`);
	}
	assert.equal(checked.length, 12, "all twelve pairs are checked");
	const short = { ...E("citat"), forms: E("citat").forms!.slice(0, 9) } as LexiconEntry;
	assert.equal(parallelForm(short, E("precitat"), "čítal", accepted), null, "a short list is out of shape: null");
});

test("a misaligned pairing is refused: the past must sit in the same slots on both sides", () => {
	const make = (forms: string[]) => ({ slug: "x", sk: "x", lemma: "x", forms, formsVerified: true, examples: [] }) as unknown as LexiconEntry;
	const present = ["p1", "p2", "p3", "p4", "p5", "p6"];
	const twoImperatives = make([...present, "imp1", "imp2", "bral", "brala", "bralo", "brali"]);
	const pastEarly = make([...present, "vzal", "vzala", "vzalo", "vzali", "imp1", "imp2"]);
	const misordered = make([...present, "imp1", "vzal", "imp2", "vzala", "vzalo", "vzali"]);
	const pastSame = make([...present, "imp1", "imp2", "vzal", "vzala", "vzalo", "vzali"]);
	assert.equal(parallelForm(twoImperatives, pastEarly, "bral"), null, "the past is in other slots: no distractor");
	assert.equal(parallelForm(twoImperatives, pastSame, "bral"), "vzal", "the same slots: the parallel is given");
	assert.equal(parallelForm(twoImperatives, misordered, "bral"), null, "a past between imperatives is out of order: refused");
	assert.equal(parallelForm(pastEarly, twoImperatives, "vzal"), null, "and from the other side");
});

test("every approved row has a parallel form, so every row can be drilled", () => {
	for (const row of rows) {
		const pair = aspect.pairs.find((p) => p.includes(row.slug))!;
		const other = pair[0] === row.slug ? pair[1] : pair[0];
		assert.ok(parallelForm(E(row.slug), E(other), row.form!, accepted) !== null, `${row.slug}: ${row.form} has a parallel form`);
	}
});

test("the reading map names every tento and tamten form", () => {
	const tento = { tomuto: "tento", túto: "tento", touto: "tento", týchto: "tento", týmito: "tento", týmto: "tento", tohto: "tento" };
	for (const [form, lemma] of Object.entries(tento)) assert.equal(GRAMMAR_WORDS[form]?.[0], lemma, form);
	const tamten = ["tamten", "tamtá", "tamto", "tamtí", "tamtie", "tamtoho", "tamtej", "tamtomu", "tamtom", "tamtým", "tamtú", "tamtou", "tamtých", "tamtými"];
	for (const form of tamten) assert.equal(GRAMMAR_WORDS[form]?.[0], "tamten", form);
	assert.equal(GRAMMAR_WORDS.vtomto, undefined, "the typo is gone");
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

test("every allowed reference slug starts with /grammar/, and every explanation's link is one of them (B2)", () => {
	for (const slug of REFERENCE_PAGES) assert.ok(slug.startsWith("/grammar/"), `${slug} is under /grammar/`);
	assert.ok(REFERENCE_PAGES.includes("/grammar/aspect") && REFERENCE_PAGES.includes("/grammar/demonstratives"));
	for (const f of MIXUP_FAMILIES.filter((x) => x.explain)) {
		const slug = new URL(f.explain!.wiki).pathname;
		assert.ok(slug.startsWith("/grammar/"), `${f.id}: ${slug} is under /grammar/`);
		assert.ok(REFERENCE_PAGES.includes(slug), `${f.id}: ${slug} is on the list`);
	}
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

test("the demonstrative tables have one cell per column", () => {
	for (const grid of thisThat.explain!.tables!) {
		for (const row of grid.rows) assert.equal(row.cells.length, grid.cols.length, `${grid.title}: ${row.case}`);
	}
	const tento = thisThat.explain!.tables![1]!;
	assert.equal(tento.title, "tento (this)");
	assert.equal(tento.rows[2]!.cells[3], "týmto", "the D plural: tým + -to");
	assert.ok(!tento.rows.some((row) => row.cells.includes("not yet")), "every tento cell is a form the reference or a verified sentence has");
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
	// Only rows with a parallel form can be drilled: the supply is the usable rows.
	const usable = rows.filter((r) => {
		const pair = aspect.pairs.find((p) => p.includes(r.slug))!;
		const other = pair[0] === r.slug ? pair[1] : pair[0];
		return parallelForm(E(r.slug), E(other), r.form!, accepted) !== null;
	});
	assert.equal(usable.length, rows.length, "every approved row is usable");
	const unique = new Set(usable.map((r) => `${r.slug}|${r.sk}`)).size;
	const triples = new Set(usable.map((r) => `${mixupKey(...(aspect.pairs.find((p) => p.includes(r.slug)) as [string, string]))}|${r.type}|${r.phrase}`)).size;
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
