import { paintFor, type Paint } from "./color-words.ts";

export const WEATHER_SCENES = ["sun", "rain", "snow", "wind", "cloud"] as const;

export type WeatherScene = (typeof WEATHER_SCENES)[number];

export type WordPicture = { kind: "paint"; paint: Paint } | { kind: "weather"; scene: WeatherScene };

const WEATHER_UNITS: ReadonlySet<string> = new Set(["lx-weather", "lx-words-weather"]);

const SCENE_OF: Readonly<Record<string, WeatherScene>> = {
	slnko: "sun",
	dážď: "rain",
	sneh: "snow",
	vietor: "wind",
	солнце: "sun",
	дождь: "rain",
	снег: "snow",
	ветер: "wind",
	облако: "cloud",
	päike: "sun",
	vihm: "rain",
	lumi: "snow",
	tuul: "wind",
	pilv: "cloud",
};

export function pictureFor(unit: string, lemma: string): WordPicture | undefined {
	const paint = paintFor(unit, lemma);
	if (paint) return { kind: "paint", paint };
	if (!WEATHER_UNITS.has(unit)) return undefined;
	const scene = SCENE_OF[lemma.toLocaleLowerCase()];
	return scene ? { kind: "weather", scene } : undefined;
}
