import { paintFor, type Paint } from "./color-words.ts";

export const WEATHER_SCENES = ["sun", "rain", "snow", "wind", "cloud"] as const;

export type WeatherScene = (typeof WEATHER_SCENES)[number];

export const FOOD_SCENES = [
	"bread",
	"cheese",
	"egg",
	"rice",
	"apple",
	"soup",
	"fish",
	"cake",
	"water",
	"coffee",
	"tea",
	"milk",
	"beer",
	"wine",
] as const;

export type FoodScene = (typeof FOOD_SCENES)[number];

export type ScenePicture =
	| { kind: "scene"; set: "weather"; scene: WeatherScene }
	| { kind: "scene"; set: "food"; scene: FoodScene };

export type WordPicture = { kind: "paint"; paint: Paint } | ScenePicture;

type SceneSet = {
	[S in ScenePicture as S["set"]]: {
		set: S["set"];
		units: readonly string[];
		of: Readonly<Record<string, S["scene"]>>;
	};
}[ScenePicture["set"]];

export const SCENE_SETS: readonly SceneSet[] = [
	{
		set: "weather",
		units: ["lx-weather", "lx-words-weather"],
		of: {
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
		},
	},
	{
		set: "food",
		units: ["lx-food", "lx-drinks", "lx-words-food"],
		of: {
			chlieb: "bread",
			syr: "cheese",
			vajce: "egg",
			ryža: "rice",
			jablko: "apple",
			polievka: "soup",
			voda: "water",
			káva: "coffee",
			čaj: "tea",
			mlieko: "milk",
			pivo: "beer",
			víno: "wine",
			хлеб: "bread",
			сыр: "cheese",
			яйцо: "egg",
			яблоко: "apple",
			суп: "soup",
			рыба: "fish",
			торт: "cake",
			вода: "water",
			кофе: "coffee",
			молоко: "milk",
			пиво: "beer",
			вино: "wine",
			leib: "bread",
			juust: "cheese",
			muna: "egg",
			õun: "apple",
			supp: "soup",
			kala: "fish",
			vesi: "water",
			kohv: "coffee",
			piim: "milk",
			õlu: "beer",
			vein: "wine",
		},
	},
];

export function pictureFor(unit: string, lemma: string): WordPicture | undefined {
	const paint = paintFor(unit, lemma);
	if (paint) return { kind: "paint", paint };
	const key = lemma.toLocaleLowerCase();
	for (const entry of SCENE_SETS) {
		if (!entry.units.includes(unit)) continue;
		if (entry.set === "weather") {
			const scene = entry.of[key];
			return scene ? { kind: "scene", set: "weather", scene } : undefined;
		}
		const scene = entry.of[key];
		return scene ? { kind: "scene", set: "food", scene } : undefined;
	}
	return undefined;
}
