import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	ANIMAL_SCENES,
	BODY_SCENES,
	CLOTHES_SCENES,
	FOOD_SCENES,
	HOME_SCENES,
	NATURE_SCENES,
	SCENE_SETS,
	TRANSPORT_SCENES,
	WEATHER_SCENES,
	pictureFor,
} from "../src/core/word-pictures.ts";
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
	{ language: "slovak", unit: "lx-nature", lemmas: WORD_CLUSTERS["lx-nature"]!.lemmas },
	{ language: "slovak", unit: "lx-animals", lemmas: WORD_CLUSTERS["lx-animals"]!.lemmas },
	{ language: "slovak", unit: "lx-body", lemmas: WORD_CLUSTERS["lx-body"]!.lemmas },
	{ language: "slovak", unit: "lx-transport", lemmas: WORD_CLUSTERS["lx-transport"]!.lemmas },
	{ language: "slovak", unit: "lx-clothes", lemmas: WORD_CLUSTERS["lx-clothes"]!.lemmas },
	...["russian", "estonian"].flatMap((language) =>
		[
			"lx-words-weather",
			"lx-words-food",
			"lx-words-home",
			"lx-words-nature",
			"lx-words-health",
			"lx-words-places",
			"lx-words-travel",
			"lx-words-clothes",
		].map((unit) => ({
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
			...NATURE_SCENES.map((s) => `nature:${s}`),
			...ANIMAL_SCENES.map((s) => `animal:${s}`),
			...BODY_SCENES.map((s) => `body:${s}`),
			...TRANSPORT_SCENES.map((s) => `transport:${s}`),
			...CLOTHES_SCENES.map((s) => `clothes:${s}`),
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
	assert.equal(pictureFor("lx-food", "ryba"), undefined);
	assert.equal(pictureFor("lx-weather", "strom"), undefined);
	assert.equal(pictureFor("lx-words-food", "лес"), undefined);
	assert.equal(pictureFor("lx-words-travel", "meri"), undefined);
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

test("no word of a unit is mapped by two picture sets", () => {
	for (const unit of new Set(SCENE_SETS.flatMap((s) => s.units))) {
		const words = SCENE_SETS.filter((s) => s.units.includes(unit)).flatMap((s) => Object.keys(s.of));
		assert.equal(new Set(words).size, words.length, unit);
	}
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

test("the wardrobe scene is a clothes wardrobe, not a cupboard", () => {
	assert.equal(pictureFor("lx-words-home", "шкаф", "The cups are in the cupboard."), undefined);
	assert.equal(pictureFor("lx-words-home", "шкаф", "My coat is in the wardrobe.")?.kind, "scene");
	assert.equal(pictureFor("lx-words-home", "ключ", "Where's the key?")?.kind, "scene");
});

test("nature words show the same scene in all three languages, and nature itself keeps the English", () => {
	const concepts: ReadonlyArray<[string, string, string, string]> = [
		["strom", "дерево", "puu", "tree"],
		["les", "лес", "mets", "forest"],
		["hora", "гора", "mägi", "mountain"],
		["rieka", "река", "jõgi", "river"],
		["more", "море", "meri", "sea"],
		["jazero", "озеро", "järv", "lake"],
		["kvet", "цветок", "lill", "flower"],
	];
	for (const [sk, ru, et, scene] of concepts) {
		assert.equal(sceneOf("lx-nature", sk), `nature:${scene}`, sk);
		assert.equal(sceneOf("lx-words-nature", ru), `nature:${scene}`, ru);
		assert.equal(sceneOf("lx-words-nature", et), `nature:${scene}`, et);
	}
	assert.equal(pictureFor("lx-nature", "príroda"), undefined);
});

test("animal words show their animal, and the animals' fish is the food fish", () => {
	for (const [sk, scene] of [
		["pes", "dog"],
		["mačka", "cat"],
		["kôň", "horse"],
		["krava", "cow"],
		["vták", "bird"],
	] as const)
		assert.equal(sceneOf("lx-animals", sk), `animal:${scene}`, sk);
	assert.equal(sceneOf("lx-animals", "ryba"), "food:fish");
	assert.equal(sceneOf("lx-animals", "ryba"), sceneOf("lx-words-food", "рыба"));
});

test("a nature or animal scene shows only when the English names the drawn thing", () => {
	const shows = (unit: string, lemma: string, en: string) => pictureFor(unit, lemma, en)?.kind === "scene";
	assert.ok(shows("lx-nature", "strom", "Plant a tree."));
	assert.ok(!shows("lx-nature", "strom", "We sat in the treehouse."));
	assert.ok(shows("lx-nature", "les", "He walked through the forest."));
	assert.ok(shows("lx-words-nature", "mets", "We got lost in the woods."));
	assert.ok(!shows("lx-nature", "les", "You can't see the wood for the trees."));
	assert.ok(shows("lx-nature", "hora", "Look at the mountains covered with snow."));
	assert.ok(!shows("lx-nature", "hora", "Podgorica is the capital of Montenegro."));
	assert.ok(shows("lx-nature", "rieka", "This river flows rapidly."));
	assert.ok(!shows("lx-nature", "rieka", "We walked along the riverside."));
	assert.ok(shows("lx-nature", "more", "You can see the sea on your right."));
	assert.ok(!shows("lx-nature", "more", "We collected seashells."));
	assert.ok(!shows("lx-words-nature", "meri", "Seattle is far."));
	assert.ok(shows("lx-nature", "jazero", "The lake was frozen."));
	assert.ok(shows("lx-nature", "kvet", "A rose is a beautiful flower."));
	assert.ok(!shows("lx-nature", "kvet", "Water the flowerpot."));
	assert.ok(shows("lx-animals", "pes", "The dog is white."));
	assert.ok(!shows("lx-animals", "pes", "I ate a hotdog."));
	assert.ok(shows("lx-animals", "mačka", "My cat looks sad."));
	assert.ok(!shows("lx-animals", "mačka", "Look in the catalog."));
	assert.ok(shows("lx-animals", "kôň", "The horse is black."));
	assert.ok(!shows("lx-animals", "kôň", "The car has 90 horsepower."));
	assert.ok(shows("lx-animals", "krava", "How do you milk a cow?"));
	assert.ok(!shows("lx-animals", "krava", "He is a cowboy."));
	assert.ok(shows("lx-animals", "vták", "The bird flew high."));
	assert.ok(shows("lx-animals", "ryba", "The fish is fresh."));
});

test("a picture never stands for a verb or a material that only looks like its word", () => {
	assert.equal(pictureFor("lx-animals", "ryba", "The weather was fine, so we went fishing."), undefined);
	assert.equal(pictureFor("lx-animals", "ryba", "Fish swim.")?.kind, "scene");
	assert.equal(pictureFor("lx-nature", "les", "We took a walk in the wood."), undefined);
	assert.equal(pictureFor("lx-nature", "les", "We took a walk in the woods.")?.kind, "scene");
});

test("body words show the same part in all three languages; head, leg, body, throat and illness keep the English", () => {
	const concepts: ReadonlyArray<[string | undefined, string, string, string]> = [
		["ruka", "рука", "käsi", "hand"],
		["oko", "глаз", "silm", "eye"],
		["zub", "зуб", "hammas", "tooth"],
		["srdce", "сердце", "süda", "heart"],
		[undefined, "лицо", "nägu", "face"],
		[undefined, "спина", "selg", "back"],
		[undefined, "живот", "kõht", "belly"],
	];
	for (const [sk, ru, et, scene] of concepts) {
		if (sk) assert.equal(sceneOf("lx-body", sk), `body:${scene}`, sk);
		assert.equal(sceneOf("lx-words-health", ru), `body:${scene}`, ru);
		assert.equal(sceneOf("lx-words-health", et), `body:${scene}`, et);
	}
	assert.equal(sceneOf("lx-body", "ucho"), "body:ear");
	assert.equal(sceneOf("lx-body", "ústa"), "body:mouth");
	for (const [unit, lemma] of [
		["lx-body", "telo"],
		["lx-body", "hlava"],
		["lx-body", "noha"],
		["lx-words-health", "голова"],
		["lx-words-health", "нога"],
		["lx-words-health", "pea"],
		["lx-words-health", "jalg"],
		["lx-words-health", "горло"],
		["lx-words-health", "kurk"],
		["lx-words-health", "больной"],
		["lx-words-health", "боль"],
		["lx-words-health", "haige"],
		["lx-words-health", "valu"],
	] as const)
		assert.equal(pictureFor(unit, lemma), undefined, lemma);
});

test("transport words show their vehicle in every unit that has them; stations and airports keep the English", () => {
	for (const [sk, scene] of [
		["auto", "car"],
		["autobus", "bus"],
		["vlak", "train"],
		["lietadlo", "plane"],
		["električka", "tram"],
		["bicykel", "bicycle"],
	] as const)
		assert.equal(sceneOf("lx-transport", sk), `transport:${scene}`, sk);
	for (const unit of ["lx-words-places", "lx-words-travel"]) {
		assert.equal(sceneOf(unit, "автобус"), "transport:bus", unit);
		assert.equal(sceneOf(unit, "поезд"), "transport:train", unit);
		assert.equal(sceneOf(unit, "buss"), "transport:bus", unit);
		assert.equal(sceneOf(unit, "rong"), "transport:train", unit);
		assert.equal(sceneOf(unit, "lennuk"), "transport:plane", unit);
		assert.equal(sceneOf(unit, "auto"), "transport:car", unit);
	}
	assert.equal(sceneOf("lx-words-places", "машина"), "transport:car");
	assert.equal(sceneOf("lx-words-places", "самолёт"), "transport:plane");
	for (const [unit, lemma] of [
		["lx-transport", "stanica"],
		["lx-transport", "letisko"],
		["lx-words-places", "вокзал"],
		["lx-words-places", "метро"],
		["lx-words-travel", "jaam"],
		["lx-words-travel", "tee"],
	] as const)
		assert.equal(pictureFor(unit, lemma), undefined, lemma);
});

test("clothes words show the same garment in all three languages; clothes in general keep the English", () => {
	const concepts: ReadonlyArray<[string | undefined, string, string | undefined, string]> = [
		["košeľa", "рубашка", "särk", "shirt"],
		["nohavice", "брюки", undefined, "trousers"],
		["šaty", "платье", "kleit", "dress"],
		["kabát", "пальто", "mantel", "coat"],
		["čiapka", "шапка", "müts", "cap"],
		[undefined, "куртка", "jope", "jacket"],
		[undefined, "сумка", "kott", "bag"],
	];
	for (const [sk, ru, et, scene] of concepts) {
		if (sk) assert.equal(sceneOf("lx-clothes", sk), `clothes:${scene}`, sk);
		assert.equal(sceneOf("lx-words-clothes", ru), `clothes:${scene}`, ru);
		if (et) assert.equal(sceneOf("lx-words-clothes", et), `clothes:${scene}`, et);
	}
	assert.equal(pictureFor("lx-clothes", "oblečenie"), undefined);
	assert.equal(pictureFor("lx-words-clothes", "одежда"), undefined);
});

test("a body picture shows only for the part it draws", () => {
	const shows = (unit: string, lemma: string, en: string) => pictureFor(unit, lemma, en)?.kind === "scene";
	assert.ok(shows("lx-body", "ruka", "Your hand is as cold as ice."));
	assert.ok(shows("lx-words-health", "рука", "Did you wash your hands?"));
	assert.ok(!shows("lx-body", "ruka", "Tom's arm hurts."));
	assert.ok(!shows("lx-words-health", "käsi", "Tom held Mary in his arms."));
	assert.ok(!shows("lx-words-health", "рука", "Use what is at hand."));
	assert.ok(!shows("lx-words-health", "рука", "He is very handsome."));
	assert.ok(shows("lx-words-health", "спина", "My back hurts."));
	assert.ok(shows("lx-words-health", "спина", "He slept on his back."));
	assert.ok(shows("lx-words-health", "selg", "She turned her back on Tom."));
	assert.ok(!shows("lx-words-health", "спина", "Come back soon."));
	assert.ok(!shows("lx-words-health", "спина", "I'll call you back."));
	assert.ok(!shows("lx-words-health", "selg", "He pushed his hat back on his head."));
	assert.ok(!shows("lx-words-health", "спина", "Sit in the back seat."));
	assert.ok(!shows("lx-words-health", "спина", "He went back and forth."));
	assert.ok(shows("lx-body", "srdce", "Here is my heart."));
	assert.ok(!shows("lx-words-health", "сердце", "She learned the poem by heart."));
	assert.ok(!shows("lx-words-health", "сердце", "Tom is young at heart."));
	assert.ok(!shows("lx-words-health", "сердце", "I wholeheartedly agree."));
	assert.ok(shows("lx-words-health", "лицо", "Go wash your face."));
	assert.ok(shows("lx-words-health", "nägu", "I'm happy to see so many friendly faces."));
	assert.ok(!shows("lx-words-health", "лицо", "We must face the facts."));
	assert.ok(!shows("lx-words-health", "лицо", "I can't face him today."));
	assert.ok(shows("lx-body", "zub", "Does your tooth hurt?"));
	assert.ok(shows("lx-words-health", "зуб", "I brush my teeth."));
	assert.ok(!shows("lx-body", "zub", "I've got a toothache."));
	assert.ok(shows("lx-body", "oko", "I have something in my eye."));
	assert.ok(!shows("lx-words-health", "глаз", "It's an eyesore."));
	assert.ok(shows("lx-body", "ucho", "I'm all ears."));
	assert.ok(!shows("lx-body", "ucho", "We got up early."));
	assert.ok(shows("lx-body", "ústa", "Open your mouth!"));
	assert.ok(shows("lx-words-health", "живот", "My stomach hurts."));
	assert.ok(shows("lx-words-health", "живот", "She's a belly dancer."));
	assert.ok(!shows("lx-words-health", "kõht", "Right now, I'm not hungry."));
});

test("a transport or clothes picture shows only for the vehicle or garment it draws", () => {
	const shows = (unit: string, lemma: string, en: string) => pictureFor(unit, lemma, en)?.kind === "scene";
	assert.ok(shows("lx-transport", "auto", "This car is black."));
	assert.ok(shows("lx-words-places", "машина", "There were a lot of cars."));
	assert.ok(!shows("lx-transport", "auto", "Send me a card."));
	assert.ok(!shows("lx-transport", "auto", "Can you carry this?"));
	assert.ok(shows("lx-transport", "autobus", "The bus was full."));
	assert.ok(shows("lx-words-travel", "buss", "How often do the buses run?"));
	assert.ok(!shows("lx-transport", "autobus", "That's none of your business."));
	assert.ok(shows("lx-transport", "vlak", "Our train stopped suddenly."));
	assert.ok(shows("lx-words-travel", "поезд", "There aren't as many trains at night."));
	assert.ok(!shows("lx-transport", "vlak", "I train every morning."));
	assert.ok(!shows("lx-transport", "vlak", "You need to train harder."));
	assert.ok(!shows("lx-transport", "vlak", "The training was long."));
	assert.ok(shows("lx-transport", "lietadlo", "The airplane was flown by two monkeys."));
	assert.ok(shows("lx-words-places", "самолёт", "I can't sleep on planes."));
	assert.ok(!shows("lx-transport", "lietadlo", "Mars is a planet."));
	assert.ok(!shows("lx-words-places", "самолёт", "He hates air travel."));
	assert.ok(shows("lx-transport", "električka", "The last tram leaves at midnight."));
	assert.ok(shows("lx-transport", "bicykel", "I've got a brand new bike."));
	assert.ok(shows("lx-clothes", "košeľa", "The shirt must be ironed."));
	assert.ok(!shows("lx-words-clothes", "рубашка", "Tom is shirtless."));
	assert.ok(shows("lx-clothes", "nohavice", "I bought myself new jeans."));
	assert.ok(shows("lx-words-clothes", "брюки", "Put your pants on."));
	assert.ok(shows("lx-clothes", "šaty", "Where did you buy that dress?"));
	assert.ok(!shows("lx-clothes", "šaty", "The emperor doesn't have any clothes on."));
	assert.ok(!shows("lx-clothes", "šaty", "She got dressed quickly."));
	assert.ok(!shows("lx-clothes", "šaty", "We have to dress up tonight."));
	assert.ok(shows("lx-clothes", "kabát", "In winter I wear an overcoat."));
	assert.ok(shows("lx-words-clothes", "пальто", "Take off your coat."));
	assert.ok(!shows("lx-clothes", "kabát", "The coating is thin."));
	assert.ok(!shows("lx-clothes", "kabát", "Take your raincoat."));
	assert.ok(shows("lx-words-clothes", "куртка", "Take off your jacket."));
	assert.ok(shows("lx-clothes", "čiapka", "Put your cap on, it's windy outside."));
	assert.ok(shows("lx-words-clothes", "müts", "Paulina has a pink hat."));
	assert.ok(!shows("lx-words-clothes", "шапка", "Paris is the capital of France."));
	assert.ok(!shows("lx-words-clothes", "шапка", "That's what I hate."));
	assert.ok(shows("lx-words-clothes", "сумка", "Are those your bags?"));
	assert.ok(!shows("lx-words-clothes", "сумка", "Where is the baggage claim?"));
	assert.ok(!shows("lx-words-clothes", "kott", "She lost her handbag."));
});
