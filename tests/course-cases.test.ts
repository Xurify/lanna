import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { CASE_TAGS, checkCourse, courseUnitsFor, formCaseCell, sameCellForms, unitCaseCells, type Course, type CourseUnit } from "../src/core/course.ts";
import { caseTable } from "../src/core/course-grammar.ts";
import { SPEAK_SCENES } from "../src/core/speak.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const unit = (u: Partial<CourseUnit> & Pick<CourseUnit, "id">): CourseUnit => ({ kind: "grammar", title: u.id, tagline: "", rule: "", glyph: "book", ...u });

const entry = (lemma: string, formTags: Record<string, string[]>, sentences: Array<[string, string]>, cat = "Nouns"): LexiconEntry => ({
	slug: lemma,
	lemma,
	en: lemma,
	cat,
	rank: 1,
	forms: Object.keys(formTags).filter((f) => f !== lemma),
	formTags,
	related: [],
	examples: sentences.map(([text, answer]) => ({ text, en: text, src: "tatoeba", cloze: { answer, at: text.indexOf(answer) } })),
});

const MAJA = entry(
	"maja",
	{
		maja: ["nominative singular", "accusative nominative singular", "accusative genitive singular", "genitive singular", "partitive singular"],
		majad: ["nominative plural", "accusative nominative plural", "accusative genitive plural"],
		majja: ["illative singular"],
		majasse: ["illative singular"],
		majas: ["inessive singular"],
		majades: ["inessive plural"],
	},
	[
		["Majad on suured.", "Majad"],
		["Ma lähen majja.", "majja"],
		["Ma olen majas.", "majas"],
		["Nad elavad majades.", "majades"],
	],
);

const TEA = entry("tee", { tee: ["nominative singular"], teed: ["partitive singular"] }, [
	["Ma joon teed.", "teed"],
	["Kaks teed, palun.", "teed"],
]);

const units = (e: LexiconEntry, us: CourseUnit[], tag = "et-EE") => e.examples.map((ex) => courseUnitsFor(us, e, ex, tag));

describe("a course unit's tag sets", () => {
	test("the object's second name for a form does not make it ambiguous: majad is a nominative plural", () => {
		const nominativePlural = unit({ id: "nom-pl", cat: "Nouns", tags: ["nominative", "plural"] });
		assert.deepEqual(units(MAJA, [nominativePlural])[0], ["nom-pl"]);
	});

	test("a unit with variants drills any of its sets, and names the cell each form fills", () => {
		const places = unit({ id: "places", cat: "Nouns", tags: ["inessive", "singular"], variants: [["inessive", "singular"], ["illative", "singular"], ["inessive", "plural"]] });
		assert.deepEqual(units(MAJA, [places]).map((u) => u.length), [0, 1, 1, 1]);
		assert.deepEqual(unitCaseCells(places).sort(), ["illative singular", "inessive plural", "inessive singular"]);
		assert.equal(formCaseCell(places, MAJA, "majades", "et-EE"), "inessive plural");
		assert.equal(formCaseCell(places, MAJA, "majja", "et-EE"), "illative singular");
	});

	test("a unit without a number covers both numbers in the case table", () => {
		assert.deepEqual(unitCaseCells(unit({ id: "x", cat: "Nouns", tags: ["genitive"] })).sort(), ["genitive plural", "genitive singular"]);
		assert.deepEqual(unitCaseCells(unit({ id: "y", cat: "Adjectives", tags: ["genitive"] })), []);
	});

	test("a trigger word can also rule a sentence out", () => {
		const partitive = unit({ id: "part", cat: "Nouns", tags: ["partitive", "singular"], notAfter: ["kaks"] });
		const afterNumbers = unit({ id: "num", cat: "Nouns", tags: ["partitive", "singular"], after: ["kaks"] });
		assert.deepEqual(units(TEA, [partitive, afterNumbers]), [["part"], ["num"]]);
	});

	test("a unit can leave out forms it should not drill", () => {
		const present = unit({ id: "present", cat: "Verbs", tags: ["present", "second-person", "singular"], skipForms: ["еси"] });
		const byt = entry("быть", { еси: ["present second-person singular"] }, [["Пригож еси.", "еси"]], "Verbs");
		assert.deepEqual(units(byt, [present], "ru-RU"), [[]]);
	});

	test("a unit can be kept to a few words", () => {
		const onlyTea = unit({ id: "tea", cat: "Nouns", tags: ["partitive", "singular"], lemmas: ["tee"] });
		assert.deepEqual(units(TEA, [onlyTea]), [["tea"], ["tea"]]);
		assert.deepEqual(units(TEA, [{ ...onlyTea, lemmas: ["kohv"] }]), [[], []]);
	});

	test("two standard forms of one cell are both accepted", () => {
		assert.deepEqual(sameCellForms(MAJA, "majja", "et-EE"), ["majasse"]);
		assert.deepEqual(sameCellForms(MAJA, "majas", "et-EE"), []);
	});
});

describe("the case table of a course", () => {
	const course: Course = {
		language: "estonian",
		code: "et",
		tag: "et-EE",
		version: 1,
		draft: true,
		cases: [
			{ tag: "nominative", native: "nimetav", means: "the subject", noDrill: { singular: { short: "dictionary form", why: "The dictionary gives it." } } },
			{ tag: "inessive", native: "seesütlev", means: "in", tutor: "tutor-places" },
		],
		units: [
			unit({ id: "nom-pl", cat: "Nouns", tags: ["nominative", "plural"] }),
			unit({ id: "inner", cat: "Nouns", tags: ["inessive", "singular"], variants: [["inessive", "singular"], ["illative", "singular"]] }),
			unit({ id: "in", cat: "Nouns", tags: ["inessive", "singular"] }),
		],
		tutors: [{ id: "tutor-places", title: "Places", tagline: "", glyph: "map-pin", brief: "Teach me." }],
		goals: [{ id: "can-go", title: "Can go", tagline: "" }],
		chapters: [{ id: "town", stage: "a1", title: "Town", tagline: "", units: ["nom-pl", "inner", "in", "tutor-places", "can-go"] }],
	};

	test("rows are the course's cases; a cell opens the lesson that drills only it before a lesson that mixes it, and counts the first tries of both", () => {
		const rows = caseTable(course, { in: { first: { reps: 4, right: 3, accents: 0, slips: {} } }, inner: { byForm: { "inessive singular": { reps: 2, right: 1, accents: 0, slips: {} } } } });
		assert.deepEqual(rows.map((r) => r.tag), ["nominative", "inessive"]);
		const [nomSg, nomPl] = rows[0]!.cells;
		assert.equal(nomSg!.unit, null);
		assert.equal(nomSg!.noDrill?.short, "dictionary form");
		assert.equal(nomPl!.unit, "nom-pl");
		assert.equal(nomPl!.accuracy, null);
		const [inSg, inPl] = rows[1]!.cells;
		assert.equal(inSg!.unit, "in");
		assert.equal(inSg!.reps, 6);
		assert.equal(inSg!.right, 4);
		assert.equal(inPl!.unit, null);
		assert.equal(inPl!.tutor?.title, "Places");
	});

	test("a course without its own case list gets one from its lessons, in the usual case order", () => {
		const { cases: _cases, ...bare } = course;
		assert.deepEqual(caseTable(bare, {}).map((r) => r.tag), ["nominative", "illative", "inessive"]);
	});
});

const REPO = path.resolve(import.meta.dirname, "..");
const shipped = (id: string, name: string) => JSON.parse(fs.readFileSync(path.join(REPO, "curriculum", id, name), "utf-8"));

for (const id of ["estonian", "russian"]) {
	describe(`the ${id} course that ships with the app`, () => {
		const course = shipped(id, "course.json") as Course;
		const world = shipped(id, "world.json") as { beats: Record<string, string> };
		const ids = [...course.units, ...course.tutors, ...course.goals].map((x) => x.id);

		test("every lesson, tutor session and goal sits in exactly one chapter, and each chapter ends on its goal", () => {
			const placed = course.chapters.flatMap((c) => c.units);
			assert.deepEqual([...placed].sort(), [...ids].sort());
			const goals = new Set(course.goals.map((g) => g.id));
			for (const c of course.chapters) assert.ok(goals.has(c.units.at(-1)!), `${c.id} ends on ${c.units.at(-1)}`);
		});

		test("the checker keeps it whole against a dictionary with every tag it names", () => {
			const tags = new Set(course.units.flatMap((u) => [...(u.tags ?? []), ...(u.variants ?? []).flat()]));
			const lemmas = course.units.flatMap((u) => u.lemmas ?? []);
			const fake: LexiconEntry[] = lemmas.map((l) => entry(l, { [l]: [[...tags].join(" ")] }, []));
			const checked = checkCourse(course, id, fake, course.tag, SPEAK_SCENES.map((s) => s.id), 0);
			assert.ok(checked);
			assert.deepEqual(checked.dropped, []);
			assert.equal(checked.course.units.length, course.units.length);
			assert.equal(checked.course.cases?.length, course.cases?.length);
			const text = (c: Course) => [
				...c.units.map((u) => [u.id, u.title, u.tagline, u.rule, u.grammarTerm, u.nativeTerm]),
				...c.tutors.map((t) => [t.id, t.title, t.tagline, t.brief]),
				...c.goals.map((g) => [g.id, g.title, g.tagline, g.scene]),
				...c.chapters.map((ch) => [ch.id, ch.title, ch.tagline]),
				...(c.cases ?? []).map((k) => [k.tag, k.native, k.means, JSON.stringify(k.noDrill ?? {})]),
			];
			assert.deepEqual(text(checked.course), text(course), "the checker cuts nothing short");
		});

		test("its case rows name real cases and tutor sessions it has", () => {
			const tutors = new Set(course.tutors.map((t) => t.id));
			for (const c of course.cases ?? []) {
				assert.ok((CASE_TAGS as readonly string[]).includes(c.tag), c.tag);
				if (c.tutor) assert.ok(tutors.has(c.tutor), c.tutor);
			}
		});

		test("its story world has one beat for every chapter", () => {
			assert.deepEqual(Object.keys(world.beats).sort(), course.chapters.map((c) => c.id).sort());
		});

		test("no line a learner reads names a lesson by its id", () => {
			const prose = [...course.units.map((u) => `${u.title} ${u.tagline} ${u.rule}`), ...course.tutors.map((t) => `${t.title} ${t.tagline} ${t.brief}`), ...course.goals.map((g) => `${g.title} ${g.tagline}`)].join("\n");
			for (const x of ids) if (x.includes("-")) assert.ok(!prose.includes(x), x);
		});
	});
}
