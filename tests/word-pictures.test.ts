import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FOOD_SCENES, HOME_SCENES, SCENE_SETS, WEATHER_SCENES, pictureFor } from "../src/core/word-pictures.ts";
import { WORD_CLUSTERS } from "../src/core/word-clusters.ts";

const courseUnit = (language: string, unit: string): string[] =>
	(
		JSON.parse(fs.readFileSync(`curriculum/${language}/course.json`, "utf-8")) as {
			units: Array<{ id: string; lemmas?: string[] }>;
		}
	).units.find((u) => u.id === unit)!.lemmas!;

const courseWeather = (language: string): string[] => courseUnit(language, "lx-words-weather");

const UNITS: ReadonlyArray<{ language: string; unit: string; lemmas: readonly string[] }> = [
	{ language: "slovak", unit: "lx-weather", lemmas: WORD_CLUSTERS["lx-weather"]!.lemmas },
	{ language: "slovak", unit: "lx-food", lemmas: WORD_CLUSTERS["lx-food"]!.lemmas },
	{ language: "slovak", unit: "lx-drinks", lemmas: WORD_CLUSTERS["lx-drinks"]!.lemmas },
	{ language: "slovak", unit: "lx-home", lemmas: WORD_CLUSTERS["lx-home"]!.lemmas },
	{ language: "slovak", unit: "lx-meals", lemmas: WORD_CLUSTERS["lx-meals"]!.lemmas },
	...["russian", "estonian"].flatMap((language) =>
		["lx-words-weather", "lx-words-food", "lx-words-home"].map((unit) => ({
			language,
			unit,
			lemmas: courseUnit(language, unit),
		})),
	),
];

const sceneOf = (unit: string, lemma: string) => {
	const picture = pictureFor(unit, lemma);
	return picture?.kind === "scene" ? `${picture.set}:${picture.scene}` : undefined;
};

test("colors keep their paint through the picture registry", () => {
	assert.deepEqual(pictureFor("lx-colours", "červený"), { kind: "paint", paint: "red" });
	assert.deepEqual(pictureFor("lx-words-colors", "голубой"), { kind: "paint", paint: "lightblue" });
	assert.equal(pictureFor("lx-colours", "farba"), undefined);
});

test("every weather word but weather, sky, cold, warm, hot and umbrella has a drawing, in all three languages", () => {
	const undrawn = new Set([
		"počasie",
		"погода",
		"ilm",
		"небо",
		"taevas",
		"studený",
		"холодно",
		"külm",
		"teplý",
		"teplo",
		"тепло",
		"soe",
		"жарко",
		"kuum",
		"vihmavari",
	]);
	for (const lemma of WORD_CLUSTERS["lx-weather"]!.lemmas)
		assert.equal(sceneOf("lx-weather", lemma)?.startsWith("weather:"), undrawn.has(lemma) ? undefined : true, lemma);
	for (const language of ["russian", "estonian"])
		for (const lemma of courseWeather(language)) {
			const scene = sceneOf("lx-words-weather", lemma);
			if (undrawn.has(lemma)) assert.equal(scene, undefined, lemma);
			else assert.ok(scene?.startsWith("weather:"), `${language} ${lemma}`);
		}
});

test("the same word means the same picture in every language", () => {
	assert.equal(sceneOf("lx-weather", "dážď"), "weather:rain");
	assert.equal(sceneOf("lx-words-weather", "дождь"), "weather:rain");
	assert.equal(sceneOf("lx-words-weather", "vihm"), "weather:rain");
	assert.equal(sceneOf("lx-words-weather", "Снег"), "weather:snow");
	const concepts: ReadonlyArray<[string, string, string, string]> = [
		["chlieb", "хлеб", "leib", "bread"],
		["syr", "сыр", "juust", "cheese"],
		["vajce", "яйцо", "muna", "egg"],
		["jablko", "яблоко", "õun", "apple"],
		["polievka", "суп", "supp", "soup"],
		["voda", "вода", "vesi", "water"],
		["káva", "кофе", "kohv", "coffee"],
		["mlieko", "молоко", "piim", "milk"],
		["pivo", "пиво", "õlu", "beer"],
		["víno", "вино", "vein", "wine"],
	];
	for (const [sk, ru, et, scene] of concepts) {
		const slovak = sceneOf(
			(WORD_CLUSTERS["lx-food"]!.lemmas as readonly string[]).includes(sk) ? "lx-food" : "lx-drinks",
			sk,
		);
		assert.equal(slovak, sceneOf("lx-words-food", ru), `${sk} and ${ru}`);
		assert.equal(slovak, sceneOf("lx-words-food", et), `${sk} and ${et}`);
		if (slovak) assert.equal(slovak, `food:${scene}`, sk);
	}
	assert.equal(sceneOf("lx-words-food", "рыба"), sceneOf("lx-words-food", "kala"));
});

test("every mapped word is a word of its unit, and no unit shows one scene for two words", () => {
	for (const { set, units, of } of SCENE_SETS) {
		const lemmas = new Set(UNITS.filter((u) => units.includes(u.unit)).flatMap((u) => u.lemmas));
		for (const lemma of Object.keys(of))
			assert.ok(lemmas.has(lemma), `${set}: ${lemma} is in none of ${units.join(", ")}`);
	}
	for (const { language, unit, lemmas } of UNITS) {
		const seen = new Map<string, string>();
		for (const lemma of lemmas) {
			const scene = sceneOf(unit, lemma);
			if (!scene) continue;
			assert.equal(
				seen.get(scene),
				undefined,
				`${language} ${unit}: ${lemma} and ${seen.get(scene)} both show ${scene}`,
			);
			seen.set(scene, lemma);
		}
	}
});

test("every drawn scene is used, and each food scene in every language that has the word", () => {
	const used = new Set(UNITS.flatMap((u) => u.lemmas.map((l) => sceneOf(u.unit, l))).filter(Boolean));
	assert.deepEqual(
		[...used].sort(),
		[
			...WEATHER_SCENES.map((s) => `weather:${s}`),
			...FOOD_SCENES.map((s) => `food:${s}`),
			...HOME_SCENES.map((s) => `home:${s}`),
		].sort(),
	);
	for (const language of ["slovak", "russian", "estonian"]) {
		const foodUnits = UNITS.filter(
			(u) => u.language === language && ["lx-food", "lx-drinks", "lx-words-food"].includes(u.unit),
		);
		const scenes = new Set(foodUnits.flatMap((u) => u.lemmas.map((l) => sceneOf(u.unit, l))).filter(Boolean));
		assert.ok(scenes.size >= 8, `${language} pictures only ${scenes.size} food words`);
	}
});

test("meat, categories, meals, sugar, sai and the road-or-tea tee keep the English", () => {
	const notDrawn: ReadonlyArray<[string, string]> = [
		["lx-food", "mäso"],
		["lx-words-food", "мясо"],
		["lx-words-food", "liha"],
		["lx-food", "zelenina"],
		["lx-food", "ovocie"],
		["lx-words-food", "сахар"],
		["lx-words-food", "suhkur"],
		["lx-words-food", "еда"],
		["lx-words-food", "toit"],
		["lx-words-food", "завтрак"],
		["lx-words-food", "обед"],
		["lx-words-food", "ужин"],
		["lx-words-food", "hommikusöök"],
		["lx-words-food", "õhtusöök"],
		["lx-words-food", "sai"],
		["lx-words-food", "tee"],
	];
	for (const [unit, lemma] of notDrawn) assert.equal(pictureFor(unit, lemma), undefined, lemma);
});

test("a picture word outside its own units keeps the English", () => {
	assert.equal(pictureFor("lx-nature", "slnko"), undefined);
	assert.equal(pictureFor("lx-meals", "chlieb"), undefined);
	assert.equal(pictureFor("lx-animals", "ryba"), undefined);
	assert.equal(pictureFor("lx-words-travel", "tee"), undefined);
	assert.equal(pictureFor("lx-cafe", "káva"), undefined);
});

test("a scene shows only when the sentence means the pictured thing", () => {
	assert.equal(pictureFor("lx-words-food", "muna", "Mary kicked Tom in the nuts.")?.kind, undefined);
	assert.deepEqual(pictureFor("lx-words-food", "muna", "I had two eggs for breakfast."), {
		kind: "scene",
		set: "food",
		scene: "egg",
	});
	assert.equal(pictureFor("lx-drinks", "čaj", "The team ate a steak."), undefined);
	assert.equal(pictureFor("lx-drinks", "čaj", "Would you like some tea?")?.kind, "scene");
	assert.equal(pictureFor("lx-weather", "dážď", "It is raining again.")?.kind, "scene");
	assert.equal(pictureFor("lx-colours", "červený", "Anything at all.")?.kind, "paint");
});

test("no unit belongs to two picture sets", () => {
	const units = SCENE_SETS.flatMap((s) => s.units);
	assert.equal(new Set(units).size, units.length);
});

test("every mapped Slovak word has dictionary sentences that keep its picture", () => {
	const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as {
		words: Array<{ sk?: string; lemma?: string; examples: Array<{ en?: string; rejected?: boolean }> }>;
	};
	for (const { language, unit, lemmas } of UNITS) {
		if (language !== "slovak") continue;
		for (const lemma of lemmas) {
			if (!sceneOf(unit, lemma)) continue;
			const entry = lexicon.words.find((w) => (w.lemma ?? w.sk) === lemma);
			const kept = (entry?.examples ?? []).filter((e) => !e.rejected && pictureFor(unit, lemma, e.en ?? ""));
			assert.ok(kept.length > 0, `${unit} ${lemma}: no sentence keeps the picture`);
		}
	}
});

test("home words show the same scene in all three languages", () => {
	const concepts: ReadonlyArray<[string, string, string, string]> = [
		["dom", "дом", "maja", "house"],
		["dvere", "дверь", "uks", "door"],
		["okno", "окно", "aken", "window"],
		["posteľ", "кровать", "voodi", "bed"],
	];
	for (const [sk, ru, et, scene] of concepts) {
		assert.equal(sceneOf("lx-home", sk), `home:${scene}`, sk);
		assert.equal(sceneOf("lx-words-home", ru), `home:${scene}`, ru);
		assert.equal(sceneOf("lx-words-home", et), `home:${scene}`, et);
	}
	assert.equal(sceneOf("lx-meals", "stôl"), "home:table");
	assert.equal(sceneOf("lx-words-home", "стол"), "home:table");
	assert.equal(sceneOf("lx-words-home", "laud"), "home:table");
	for (const [ru, et, scene] of [
		["стул", "tool", "chair"],
		["ключ", "võti", "key"],
		["диван", "diivan", "sofa"],
	] as const) {
		assert.equal(sceneOf("lx-words-home", ru), `home:${scene}`, ru);
		assert.equal(sceneOf("lx-words-home", et), `home:${scene}`, et);
	}
	assert.equal(sceneOf("lx-words-home", "шкаф"), "home:wardrobe");
});

test("flat, room, home, wall, floor, kitchen, bathroom, plate and the meals keep the English", () => {
	const notDrawn: ReadonlyArray<[string, string]> = [
		["lx-home", "byt"],
		["lx-home", "izba"],
		["lx-words-home", "квартира"],
		["lx-words-home", "комната"],
		["lx-words-home", "стена"],
		["lx-words-home", "пол"],
		["lx-words-home", "kodu"],
		["lx-words-home", "tuba"],
		["lx-words-home", "korter"],
		["lx-home", "kuchyňa"],
		["lx-words-home", "кухня"],
		["lx-words-home", "köök"],
		["lx-home", "kúpeľňa"],
		["lx-meals", "tanier"],
		["lx-meals", "raňajky"],
		["lx-meals", "obed"],
		["lx-meals", "večera"],
		["lx-meals", "jesť"],
		["lx-meals", "piť"],
		["lx-meals", "variť"],
	];
	for (const [unit, lemma] of notDrawn) assert.equal(pictureFor(unit, lemma), undefined, lemma);
	assert.equal(pictureFor("lx-city", "dom"), undefined);
	assert.equal(pictureFor("lx-words-food", "стол"), undefined);
});

test("a home scene shows only when the English names the drawn thing", () => {
	const shows = (unit: string, lemma: string, en: string) => pictureFor(unit, lemma, en)?.kind === "scene";
	assert.ok(shows("lx-home", "dom", "Our house is small."));
	assert.ok(!shows("lx-words-home", "дом", "Where's home?"));
	assert.ok(!shows("lx-words-home", "дом", "The lighthouse is far."));
	assert.ok(shows("lx-home", "dvere", "Please shut the doors."));
	assert.ok(!shows("lx-home", "dvere", "We played outdoors."));
	assert.ok(!shows("lx-home", "dvere", "The doorbell rang."));
	assert.ok(shows("lx-home", "okno", "Someone opened the window."));
	assert.ok(shows("lx-meals", "stôl", "This table is heavy."));
	assert.ok(!shows("lx-words-home", "стол", "This is a desk."));
	assert.ok(!shows("lx-meals", "stôl", "Check the timetable."));
	assert.ok(shows("lx-words-home", "стул", "That's my chair."));
	assert.ok(!shows("lx-words-home", "стул", "She is the chairman."));
	assert.ok(shows("lx-home", "posteľ", "The bed's not made."));
	assert.ok(!shows("lx-home", "posteľ", "The bedroom is upstairs."));
	assert.ok(shows("lx-words-home", "ключ", "Where are the keys?"));
	assert.ok(!shows("lx-words-home", "võti", "A monkey took it."));
	assert.ok(!shows("lx-words-home", "võti", "Type it on the keyboard."));
	assert.ok(shows("lx-words-home", "диван", "Lie down on the couch."));
	assert.ok(shows("lx-words-home", "diivan", "It's on the sofa."));
	assert.ok(shows("lx-words-home", "шкаф", "It's in the closet."));
	assert.ok(shows("lx-words-home", "шкаф", "Open the wardrobe."));
});
