/**
 * THE DEEP READ OF LISTENING (LangHarness, 2026-11-03): the facts handed to the
 * model, its reply read back safely, the extra cuts the analysis keeps for it
 * (place in the session, sentence length, causes by week), and the service that
 * writes it once per set of figures. The model is a stub. Runs under an isolated
 * LH_DATA_DIR, so every app-module import is dynamic.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-listen-guide-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { analyzeListening, CUT_MIN_REPS } = await import("../src/core/listen-analysis.ts");
const { listenGuideFacts, parseListenGuide } = await import("../src/core/listen-guide.ts");
const { digest } = await import("../src/core/mistakes.ts");
const { appendLessonLog } = await import("../src/store/corpus.ts");
const { analysisStore } = await import("../src/store/analysis.ts");
const { analyzeNow, mistakesReport, writeListenGuide } = await import("../src/server/mistakes.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

type LoggedListen = import("../src/core/listen-analysis.ts").LoggedListen;
type Rep = LoggedListen["reps"][number];

const SAID = "Žila som v Ríme.";
const DROPPED = "Žila som Ríme.";
const LONG = "Peter varil večeru a pritom telefonoval s mamou celý večer.";
const rep = (sentence: string, given: string, extra: Partial<Rep> = {}): Rep => ({
	kind: "dictation",
	sentence,
	given,
	verdict: given === sentence ? "exact" : "wrong",
	stretch: [],
	...extra,
});
const session = (at: string, reps: Rep[]): LoggedListen => ({ at, mode: "listen", reps });
const NOW = new Date("2026-11-20T12:00:00Z");

describe("the cuts the deep read follows", () => {
	it("sees a session that goes worse in its second half only past chance and with enough sentences in each half", () => {
		const day = (d: string) => session(`${d}T10:00:00Z`, [...Array.from({ length: 10 }, () => rep(SAID, SAID)), ...Array.from({ length: 10 }, (_, i) => (i < 6 ? rep(SAID, DROPPED) : rep(SAID, SAID)))]);
		const a = analyzeListening(["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07"].map(day), NOW);
		assert.deepEqual(a.session?.first, { reps: 40, right: 40 });
		assert.deepEqual(a.session?.second, { reps: 40, right: 16 });
		assert.equal(a.session?.tiring, true);
		assert.equal(analyzeListening([day("2026-11-01")], NOW).session, null, "ten sentences a half is too few");
		assert.ok(CUT_MIN_REPS > 10);
	});

	it("does not call a session tiring when the two halves are alike", () => {
		const day = (d: string) => session(`${d}T10:00:00Z`, Array.from({ length: 20 }, (_, i) => (i % 5 === 0 ? rep(SAID, DROPPED) : rep(SAID, SAID))));
		const a = analyzeListening(["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07"].map(day), NOW);
		assert.equal(a.session?.tiring, false);
	});

	it("compares short and long sentences, long ones harder only past chance", () => {
		const reps = [...Array.from({ length: 30 }, () => rep(SAID, SAID)), ...Array.from({ length: 30 }, (_, i) => (i < 15 ? rep(LONG, "Peter varil večeru.") : rep(LONG, LONG)))];
		const a = analyzeListening([session("2026-11-01T10:00:00Z", reps)], NOW);
		assert.deepEqual(a.length?.short, { reps: 30, right: 30 });
		assert.deepEqual(a.length?.long, { reps: 30, right: 15 });
		assert.equal(a.length?.longHarder, true);
		assert.equal(analyzeListening([session("2026-11-01T10:00:00Z", reps.slice(0, 40))], NOW).length, null, "not enough long ones");
	});

	it("counts the sentences with each cause by week", () => {
		const a = analyzeListening(
			[
				session("2026-11-02T10:00:00Z", [rep(SAID, DROPPED), rep(SAID, DROPPED), rep(SAID, SAID)]),
				session("2026-11-10T10:00:00Z", [rep(SAID, SAID), rep(SAID, DROPPED)]),
			],
			NOW,
		);
		assert.deepEqual(
			a.causeWeeks.map((w) => [w.week, w.read, w.causes["small-word"] ?? 0]),
			[
				["2026-11-02", 3, 2],
				["2026-11-09", 2, 1],
			],
		);
	});
});

describe("the facts and the reply", () => {
	const build = () => {
		const earlier = ["2026-10-20", "2026-10-22", "2026-10-25"].map((d) => session(`${d}T10:00:00Z`, [...Array.from({ length: 12 }, () => rep(SAID, DROPPED)), ...Array.from({ length: 8 }, () => rep(SAID, SAID))]));
		const recent = ["2026-11-10", "2026-11-14", "2026-11-18"].map((d) => session(`${d}T10:00:00Z`, [...Array.from({ length: 2 }, () => rep(SAID, DROPPED)), ...Array.from({ length: 18 }, () => rep(SAID, SAID))]));
		return analyzeListening([...earlier, ...recent], NOW);
	};

	it("states a called trend as called and everything else as no clear change, and is stable for the same figures", () => {
		const a = build();
		const facts = listenGuideFacts(a);
		assert.match(facts, /Short words dropped \[Hearing\]: 42 words; 60 before, 10 lately; less often \(called\)/);
		assert.match(facts, /which is not "the same"/);
		assert.match(facts, /Miss: "Žila som v Ríme\." typed "Žila som Ríme\."/);
		assert.equal(digest(facts), digest(listenGuideFacts(build())));
	});

	it("reads a JSON reply inside prose, caps it, and gives up on a reply that is not one", () => {
		const text = 'Here you go:\n```json\n{"summary":"  Going ok. ","patterns":[{"title":"Short words","evidence":"v Ríme","why":"They are quick.","fix":"Type slowly."},{"title":"","why":"x"},{"title":"No why"}],"trends":[{"what":"Short words","read":"Less often."},{"what":"x"}],"next":["Listen, typed","",3],"limits":"Small sample."}\n```';
		const d = parseListenGuide(text)!;
		assert.equal(d.summary, "Going ok.");
		assert.equal(d.patterns.length, 1, "a pattern needs a title and a why");
		assert.equal(d.trends.length, 1);
		assert.deepEqual(d.next, ["Listen, typed"]);
		assert.equal(d.limits, "Small sample.");
		assert.equal(parseListenGuide("no json here"), null);
		assert.equal(parseListenGuide('{"patterns":[]}'), null);
	});
});

describe("the service", () => {
	const reply = JSON.stringify({ summary: "Short words are going.", patterns: [{ title: "Short words dropped", evidence: "v Ríme", why: "They are quick and unstressed.", fix: "Replay and type every word." }], trends: [{ what: "Short words", read: "Less often." }], next: ["Listen, typed, twice this week."], limits: "Sixty sentences." });
	const logRep = (sentence: string, given: string) => ({
		itemId: "x#0",
		kind: "dictation",
		unit: "listen",
		slug: "x",
		lemma: "x",
		gloss: "",
		sentence,
		translation: "t",
		answer: sentence,
		given,
		verdict: (given === sentence ? "exact" : "wrong") as "exact" | "wrong",
		assisted: false,
		ms: 5000,
		heardMs: 2500,
		replays: 0,
		peeked: false,
		words: 4,
		stretch: [] as string[],
	});
	const log = (day: string, missed: number) =>
		appendLessonLog({ id: `l-${day}`, at: `${day}T10:00:00Z`, day, unit: "listen", mode: "listen", xp: 0, correct: 0, total: 20, perfect: false, queued: [], reps: Array.from({ length: 20 }, (_, i) => (i < missed ? logRep(SAID, DROPPED) : logRep(SAID, SAID))) });

	it("refuses to read a handful of sentences and says how far off it is", async () => {
		log("2026-10-20", 5);
		await assert.rejects(() => writeListenGuide({ now: NOW, say: async () => reply }), /needs 50 typed Listen sentences, 15 of them with a miss, over 3 sessions; you have 20, 5 and 1/);
	});

	it("writes once, reuses the same figures without a call, writes again on force or new figures, and survives a new snapshot", async () => {
		for (const d of ["2026-10-22", "2026-10-25", "2026-11-10", "2026-11-14", "2026-11-18"]) log(d, d < "2026-11-01" ? 10 : 1);
		analyzeNow(NOW);
		let calls = 0;
		const say = async () => (calls++, reply);
		const first = await writeListenGuide({ now: NOW, say });
		assert.equal(calls, 1);
		assert.equal(first.listenGuide?.data?.patterns[0]?.title, "Short words dropped");
		assert.equal(first.listenGuideCurrent, true);
		assert.equal(analysisStore.read().listenGuide?.digest, first.listenGuide?.digest, "kept on disk");

		await writeListenGuide({ now: NOW, say });
		assert.equal(calls, 1, "the same figures reuse the saved read");
		await writeListenGuide({ now: NOW, force: true, say });
		assert.equal(calls, 2);

		const after = analyzeNow(new Date("2026-11-20T13:00:00Z"));
		assert.equal(after.listenGuide?.digest, first.listenGuide?.digest, "a new snapshot keeps the read");
		assert.equal(mistakesReport().listenGuideCurrent, true);

		log("2026-11-19", 3);
		const changed = analyzeNow(new Date("2026-11-20T14:00:00Z"));
		assert.equal(changed.listenGuideCurrent, false, "new sentences make it stale");
		assert.ok(changed.listenGuide, "but it is still there");
	});

	it("keeps the mistakes guide and the newer snapshot that were saved while the deep read waited on the model", async () => {
		const before = analysisStore.read();
		type Guide = NonNullable<typeof before.guide>;
		const otherGuide = { text: "The guide that finished first.", data: null, at: NOW.toISOString(), digest: "other", model: "faux:faux", usage: { model: "faux:faux", steps: [] } } as unknown as Guide;
		let newerSnapshotAt = "";
		const say = async () => {
			const meanwhile = analyzeNow(new Date("2026-11-20T15:00:00Z"));
			newerSnapshotAt = meanwhile.analysis?.at ?? "";
			analysisStore.write({ ...analysisStore.read(), guide: otherGuide });
			return reply;
		};
		const written = await writeListenGuide({ now: NOW, force: true, say });
		const onDisk = analysisStore.read();
		assert.equal(onDisk.guide?.digest, "other", "the guide another writer saved is still there");
		assert.equal(written.guide?.digest, "other");
		assert.ok(newerSnapshotAt, "the snapshot taken meanwhile has a time");
		assert.equal(onDisk.analysis?.at, newerSnapshotAt, "the newer snapshot is not rolled back");
		assert.equal(onDisk.listenGuide?.text, written.listenGuide?.text, "and the deep read is saved too");
	});
});

describe("the findings no single figure shows", () => {
	const NINE = "Dnes ráno som videl veľký modrý dom pri rieke.";
	const days = ["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07"];
	const ids = (a: ReturnType<typeof analyzeListening>) => a.insights.map((i) => i.id);

	it("finds that the ends of sentences are lost, and the starts, only when the misses cluster there and there are enough", () => {
		const endsLost = days.map((d) => session(`${d}T10:00:00Z`, Array.from({ length: 12 }, (_, i) => (i < 11 ? rep(NINE, "Dnes ráno som videl veľký modrý dom pri.") : rep(NINE, NINE)))));
		const ends = analyzeListening(endsLost, NOW);
		assert.ok(ids(ends).includes("ends"));
		assert.match(ends.insights.find((i) => i.id === "ends")!.line, /of the words you miss are in the last third/);
		const startsLost = days.map((d) => session(`${d}T10:00:00Z`, Array.from({ length: 12 }, (_, i) => (i < 11 ? rep(NINE, "ráno som videl veľký modrý dom pri rieke.") : rep(NINE, NINE)))));
		assert.ok(ids(analyzeListening(startsLost, NOW)).includes("start"));
		assert.deepEqual(ids(analyzeListening(endsLost.slice(0, 1), NOW)), [], "11 differences are too few to place");
		const spread = days.map((d) => session(`${d}T10:00:00Z`, [rep(NINE, "ráno som videl veľký modrý dom pri rieke."), rep(NINE, "Dnes ráno som videl modrý dom pri rieke."), rep(NINE, "Dnes ráno som videl veľký modrý dom pri."), ...Array.from({ length: 9 }, () => rep(NINE, NINE))]));
		assert.ok(!ids(analyzeListening(spread, NOW)).some((i) => i === "ends" || i === "start"), "misses spread over the sentence say nothing about its place");
	});

	it("finds that a new word costs the words around it, and not when sentences with and without one go alike", () => {
		const WITH = "Na stole ležala obálka dnes ráno.";
		const lost = (n: number, total: number, sentence: string, given: string, stretch: string[]) => Array.from({ length: total }, (_, i) => rep(sentence, i < n ? given : sentence, { stretch }));
		const costly = [session("2026-11-01T10:00:00Z", [...lost(18, 30, WITH, "Na stole obálka dnes ráno.", ["obálka"]), ...lost(3, 30, NINE, "Dnes ráno som videl veľký modrý dom pri.", [])])];
		const a = analyzeListening(costly, NOW);
		assert.ok(ids(a).includes("spillover"));
		assert.match(a.insights.find((i) => i.id === "spillover")!.line, /60% of sentences with a new word had another word wrong, against 10%/);
		const alike = [session("2026-11-01T10:00:00Z", [...lost(6, 30, WITH, "Na stole obálka dnes ráno.", ["obálka"]), ...lost(6, 30, NINE, "Dnes ráno som videl veľký modrý dom pri.", [])])];
		assert.ok(!ids(analyzeListening(alike, NOW)).includes("spillover"));
	});

	it("says a session warms up when its second half is understood far better, and tiring when it is far worse", () => {
		const shape = (firstRight: number, secondRight: number) => days.map((d) => session(`${d}T10:00:00Z`, [...Array.from({ length: 10 }, (_, i) => (i < firstRight ? rep(SAID, SAID) : rep(SAID, DROPPED))), ...Array.from({ length: 10 }, (_, i) => (i < secondRight ? rep(SAID, SAID) : rep(SAID, DROPPED)))]));
		assert.ok(ids(analyzeListening(shape(4, 9), NOW)).includes("warm-up"));
		assert.ok(ids(analyzeListening(shape(9, 4), NOW)).includes("tiring"));
		assert.ok(!ids(analyzeListening(shape(7, 7), NOW)).some((i) => i === "warm-up" || i === "tiring"));
	});

	it("lists a word that goes wrong again and again across sessions, with what was typed, and ignores one-off misses", () => {
		const LINE = "Dnes jem dobrý obed.";
		const one = (right: boolean) => rep(LINE, right ? LINE : "Dnes jem dobrý obet.");
		const a = analyzeListening([session("2026-11-01T10:00:00Z", [one(false), one(false), one(false), one(true), one(true)]), session("2026-11-03T10:00:00Z", [one(false), one(false), one(true)])], NOW);
		assert.equal(a.repeats[0]?.word, "obed");
		assert.deepEqual([a.repeats[0]?.appeared, a.repeats[0]?.missed, a.repeats[0]?.sessions], [8, 5, 2]);
		assert.deepEqual(a.repeats[0]?.typedAs, ["obet"]);
		assert.ok(ids(a).includes("repeat"));
		const scattered = analyzeListening([session("2026-11-01T10:00:00Z", [rep("Dnes jem dobrý obed.", "Dnes jem dobrý obet."), rep("Dnes pijem teplý čaj.", "Dnes pijem teplý čaje."), rep("Dnes čítam dlhú knihu.", "Dnes čítam dlhú knihe."), rep("Dnes jem dobrý obed.", "Dnes jem dobrý obed.")])], NOW);
		assert.deepEqual(scattered.repeats, []);
		const oneSession = analyzeListening([session("2026-11-01T10:00:00Z", [one(false), one(false), one(false), one(true)])], NOW);
		assert.deepEqual(oneSession.repeats, [], "one bad session is not a habit");
	});

	it("puts the findings and the repeated words in the facts, and reads tips and noticed from a reply", () => {
		const LINE = "Dnes jem dobrý obed.";
		const one = (right: boolean) => rep(LINE, right ? LINE : "Dnes jem dobrý obet.");
		const a = analyzeListening([session("2026-11-01T10:00:00Z", [one(false), one(false), one(false), one(true), one(true)]), session("2026-11-03T10:00:00Z", [one(false), one(false), one(true)])], NOW);
		const facts = listenGuideFacts(a);
		assert.match(facts, /Findings the app made by a test stricter than the trends'/);
		assert.match(facts, /Keeps going wrong: "obed", wrong in 5 of 8 sentences it was in, over 2 sessions, typed as "obet"/);
		const d = parseListenGuide(
			JSON.stringify({ summary: "ok", patterns: [], noticed: [{ what: "Ends go first", why: "This may be the clip fading." }, { what: "", why: "x" }], tips: [{ tip: "Write the first word before replaying.", why: "Answers the dropped starts." }, { tip: "" }], trends: [], next: [], limits: "" }),
		)!;
		assert.equal(d.noticed.length, 1);
		assert.equal(d.tips.length, 1);
		assert.equal(d.tips[0]?.why, "Answers the dropped starts.");
		assert.deepEqual(parseListenGuide('{"summary":"x","patterns":[]}')!.tips, []);
	});
});
