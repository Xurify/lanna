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
});
