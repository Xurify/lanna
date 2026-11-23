import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { WEATHER_SCENES, pictureFor } from "../src/core/word-pictures.ts";
import { WORD_CLUSTERS } from "../src/core/word-clusters.ts";

const courseWeather = (language: string): string[] =>
	(
		JSON.parse(fs.readFileSync(`curriculum/${language}/course.json`, "utf-8")) as {
			units: Array<{ id: string; lemmas?: string[] }>;
		}
	).units.find((u) => u.id === "lx-words-weather")!.lemmas!;

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
		assert.equal(pictureFor("lx-weather", lemma)?.kind, undrawn.has(lemma) ? undefined : "weather", lemma);
	for (const language of ["russian", "estonian"])
		for (const lemma of courseWeather(language)) {
			const picture = pictureFor("lx-words-weather", lemma);
			if (undrawn.has(lemma)) assert.equal(picture, undefined, lemma);
			else assert.equal(picture?.kind, "weather", `${language} ${lemma}`);
		}
});

test("the same word means the same picture in every language", () => {
	const scene = (unit: string, lemma: string) => {
		const picture = pictureFor(unit, lemma);
		return picture?.kind === "weather" ? picture.scene : undefined;
	};
	assert.equal(scene("lx-weather", "dážď"), "rain");
	assert.equal(scene("lx-words-weather", "дождь"), "rain");
	assert.equal(scene("lx-words-weather", "vihm"), "rain");
	assert.equal(scene("lx-words-weather", "Снег"), "snow");
});

test("a weather word outside a weather unit keeps the English, and every scene is used", () => {
	assert.equal(pictureFor("lx-nature", "slnko"), undefined);
	const used = new Set(
		[...WORD_CLUSTERS["lx-weather"]!.lemmas.map((l) => pictureFor("lx-weather", l))]
			.concat(["russian", "estonian"].flatMap((l) => courseWeather(l).map((w) => pictureFor("lx-words-weather", w))))
			.flatMap((p) => (p?.kind === "weather" ? [p.scene] : [])),
	);
	assert.deepEqual([...used].sort(), [...WEATHER_SCENES].sort());
});
