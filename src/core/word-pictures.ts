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

export const HOME_SCENES = ["house", "door", "window", "table", "chair", "sofa", "bed", "key", "wardrobe"] as const;

export type HomeScene = (typeof HOME_SCENES)[number];

export const NATURE_SCENES = ["tree", "forest", "mountain", "river", "sea", "lake", "flower"] as const;

export type NatureScene = (typeof NATURE_SCENES)[number];

export const ANIMAL_SCENES = ["dog", "cat", "horse", "cow", "bird"] as const;

export type AnimalScene = (typeof ANIMAL_SCENES)[number];

export const BODY_SCENES = ["hand", "eye", "ear", "mouth", "heart", "tooth", "face", "back", "belly"] as const;

export type BodyScene = (typeof BODY_SCENES)[number];

export const TRANSPORT_SCENES = ["car", "bus", "train", "plane", "tram", "bicycle"] as const;

export type TransportScene = (typeof TRANSPORT_SCENES)[number];

export const CLOTHES_SCENES = ["shirt", "trousers", "dress", "coat", "jacket", "cap", "bag"] as const;

export type ClothesScene = (typeof CLOTHES_SCENES)[number];

export type ScenePicture =
	| { kind: "scene"; set: "weather"; scene: WeatherScene }
	| { kind: "scene"; set: "food"; scene: FoodScene }
	| { kind: "scene"; set: "home"; scene: HomeScene }
	| { kind: "scene"; set: "nature"; scene: NatureScene }
	| { kind: "scene"; set: "animal"; scene: AnimalScene }
	| { kind: "scene"; set: "body"; scene: BodyScene }
	| { kind: "scene"; set: "transport"; scene: TransportScene }
	| { kind: "scene"; set: "clothes"; scene: ClothesScene };

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
	{
		set: "home",
		units: ["lx-home", "lx-meals", "lx-words-home"],
		of: {
			dom: "house",
			dvere: "door",
			okno: "window",
			posteľ: "bed",
			stôl: "table",
			дом: "house",
			дверь: "door",
			окно: "window",
			стол: "table",
			стул: "chair",
			кровать: "bed",
			ключ: "key",
			диван: "sofa",
			шкаф: "wardrobe",
			maja: "house",
			uks: "door",
			aken: "window",
			laud: "table",
			tool: "chair",
			voodi: "bed",
			võti: "key",
			diivan: "sofa",
		},
	},
	{
		set: "nature",
		units: ["lx-nature", "lx-words-nature"],
		of: {
			strom: "tree",
			les: "forest",
			hora: "mountain",
			rieka: "river",
			more: "sea",
			jazero: "lake",
			kvet: "flower",
			дерево: "tree",
			лес: "forest",
			гора: "mountain",
			река: "river",
			море: "sea",
			озеро: "lake",
			цветок: "flower",
			puu: "tree",
			mets: "forest",
			mägi: "mountain",
			jõgi: "river",
			meri: "sea",
			järv: "lake",
			lill: "flower",
		},
	},
	{
		set: "animal",
		units: ["lx-animals"],
		of: {
			pes: "dog",
			mačka: "cat",
			kôň: "horse",
			krava: "cow",
			vták: "bird",
		},
	},
	{
		set: "food",
		units: ["lx-animals"],
		of: { ryba: "fish" },
	},
	{
		set: "body",
		units: ["lx-body", "lx-words-health"],
		of: {
			ruka: "hand",
			oko: "eye",
			ucho: "ear",
			ústa: "mouth",
			srdce: "heart",
			zub: "tooth",
			рука: "hand",
			глаз: "eye",
			лицо: "face",
			зуб: "tooth",
			живот: "belly",
			спина: "back",
			сердце: "heart",
			käsi: "hand",
			silm: "eye",
			nägu: "face",
			selg: "back",
			kõht: "belly",
			hammas: "tooth",
			süda: "heart",
		},
	},
	{
		set: "transport",
		units: ["lx-transport", "lx-words-places", "lx-words-travel"],
		of: {
			auto: "car",
			autobus: "bus",
			vlak: "train",
			lietadlo: "plane",
			električka: "tram",
			bicykel: "bicycle",
			автобус: "bus",
			поезд: "train",
			машина: "car",
			самолёт: "plane",
			buss: "bus",
			rong: "train",
			lennuk: "plane",
		},
	},
	{
		set: "clothes",
		units: ["lx-clothes", "lx-words-clothes"],
		of: {
			košeľa: "shirt",
			nohavice: "trousers",
			šaty: "dress",
			kabát: "coat",
			čiapka: "cap",
			платье: "dress",
			рубашка: "shirt",
			брюки: "trousers",
			куртка: "jacket",
			пальто: "coat",
			сумка: "bag",
			шапка: "cap",
			kleit: "dress",
			särk: "shirt",
			müts: "cap",
			kott: "bag",
			mantel: "coat",
			jope: "jacket",
		},
	},
];

const SCENE_WORDS: Readonly<Record<ScenePicture["scene"], RegExp>> = {
	sun: /(?<!\p{L})sun/iu,
	rain: /(?<!\p{L})rain/iu,
	snow: /(?<!\p{L})snow/iu,
	wind: /(?<!\p{L})wind/iu,
	cloud: /(?<!\p{L})cloud/iu,
	bread: /(?<!\p{L})bread/iu,
	cheese: /(?<!\p{L})chees/iu,
	egg: /(?<!\p{L})egg/iu,
	rice: /(?<!\p{L})rice(?!\p{L})/iu,
	apple: /(?<!\p{L})apple/iu,
	soup: /(?<!\p{L})soup/iu,
	fish: /(?<!\p{L})fish(?:es)?(?!\p{L})/iu,
	cake: /(?<!\p{L})cake/iu,
	water: /(?<!\p{L})water/iu,
	coffee: /(?<!\p{L})coffee/iu,
	tea: /(?<!\p{L})teas?(?!\p{L})/iu,
	milk: /(?<!\p{L})milk/iu,
	beer: /(?<!\p{L})beers?(?!\p{L})/iu,
	wine: /(?<!\p{L})wines?(?!\p{L})/iu,
	house: /(?<!\p{L})houses?(?!\p{L})/iu,
	door: /(?<!\p{L})doors?(?!\p{L})/iu,
	window: /(?<!\p{L})windows?(?!\p{L})/iu,
	table: /(?<!\p{L})tables?(?!\p{L})/iu,
	chair: /(?<!\p{L})chairs?(?!\p{L})/iu,
	sofa: /(?<!\p{L})(?:sofas?|couch(?:es)?)(?!\p{L})/iu,
	bed: /(?<!\p{L})beds?(?!\p{L})/iu,
	key: /(?<!\p{L})keys?(?!\p{L})/iu,
	wardrobe: /(?<!\p{L})(?:wardrobes?|closets?)(?!\p{L})/iu,
	tree: /(?<!\p{L})trees?(?!\p{L})/iu,
	forest: /(?<!\p{L})(?:forests?|woods)(?!\p{L})/iu,
	mountain: /(?<!\p{L})mountains?(?!\p{L})/iu,
	river: /(?<!\p{L})rivers?(?!\p{L})/iu,
	sea: /(?<!\p{L})seas?(?!\p{L})/iu,
	lake: /(?<!\p{L})lakes?(?!\p{L})/iu,
	flower: /(?<!\p{L})flowers?(?!\p{L})/iu,
	dog: /(?<!\p{L})dogs?(?!\p{L})/iu,
	cat: /(?<!\p{L})cats?(?!\p{L})/iu,
	horse: /(?<!\p{L})horses?(?!\p{L})/iu,
	cow: /(?<!\p{L})cows?(?!\p{L})/iu,
	bird: /(?<!\p{L})birds?(?!\p{L})/iu,
	hand: /(?<!\p{L})(?<!(?:at|on the other) )hands?(?!\p{L})/iu,
	eye: /(?<!\p{L})eyes?(?!\p{L})/iu,
	ear: /(?<!\p{L})ears?(?!\p{L})/iu,
	mouth: /(?<!\p{L})mouths?(?!\p{L})/iu,
	heart: /(?<!\p{L})(?<!(?:by|at) )hearts?(?!\p{L})/iu,
	tooth: /(?<!\p{L})(?:tooth|teeth)(?!\p{L})/iu,
	face: /(?<!\p{L})(?<!(?:to|I|we|you|they|must|can|will|'ll|n't|let's) )faces?(?!\p{L})/iu,
	back: /(?<=(?:(?<!\p{L})(?:my|your|his|her|its|our|their|the|a|this|that|lower|upper|bad|sore|whole)|'s) )backs?(?!\p{L})(?! (?:door|seat|yard|garden|row|of|then|home|up|and forth))/iu,
	belly: /(?<!\p{L})(?:belly|bellies|stomachs?|tumm(?:y|ies))(?!\p{L})/iu,
	car: /(?<!\p{L})cars?(?!\p{L})/iu,
	bus: /(?<!\p{L})bus(?:es|ses)?(?!\p{L})/iu,
	train: /(?<!\p{L})(?<!(?:to|I|we|you|they|must|can|will|'ll|n't) )trains?(?!\p{L})/iu,
	plane: /(?<!\p{L})(?:air|aero)?planes?(?!\p{L})/iu,
	tram: /(?<!\p{L})(?:trams?|streetcars?)(?!\p{L})/iu,
	bicycle: /(?<!\p{L})(?:bicycles?|bikes?)(?!\p{L})/iu,
	shirt: /(?<!\p{L})shirts?(?!\p{L})/iu,
	trousers: /(?<!\p{L})(?:trousers|pants|jeans)(?!\p{L})/iu,
	dress: /(?<!\p{L})(?<!to )dress(?:es)?(?!\p{L})(?! up)/iu,
	coat: /(?<!\p{L})(?:over)?coats?(?!\p{L})/iu,
	jacket: /(?<!\p{L})jackets?(?!\p{L})/iu,
	cap: /(?<!\p{L})(?:caps?|hats?)(?!\p{L})/iu,
	bag: /(?<!\p{L})bags?(?!\p{L})/iu,
};

const PAINT_WORDS: Readonly<Record<Paint, RegExp>> = {
	red: /(?<!\p{L})red(?!\p{L})/iu,
	yellow: /(?<!\p{L})yellow/iu,
	green: /(?<!\p{L})green/iu,
	blue: /(?<!\p{L})blue/iu,
	darkblue: /(?<!\p{L})(?:(?:dark|navy) )?blue/iu,
	lightblue: /(?<!\p{L})(?:(?:light|sky|pale) )?blue/iu,
	black: /(?<!\p{L})black/iu,
	white: /(?<!\p{L})white/iu,
	grey: /(?<!\p{L})gr[ae]y/iu,
	brown: /(?<!\p{L})brown/iu,
	pink: /(?<!\p{L})pink/iu,
	orange: /(?<!\p{L})orange/iu,
	purple: /(?<!\p{L})(?:purple|violet)/iu,
};

/** The English sentence split around the words the picture stands for:
 *  odd indices are the pictured word (with its ending), so the sentence
 *  does not answer the rep the picture asks. */
export function translationAroundPicture(translation: string, picture: WordPicture): string[] {
	const word = picture.kind === "paint" ? PAINT_WORDS[picture.paint] : SCENE_WORDS[picture.scene];
	return translation.split(new RegExp(`((?:${word.source})(?:e|es|s|n?y|ing|ed)?(?!\\p{L}))`, "giu"));
}

export function pictureFor(unit: string, lemma: string, translation?: string): WordPicture | undefined {
	const paint = paintFor(unit, lemma);
	if (paint) return { kind: "paint", paint };
	const key = lemma.toLocaleLowerCase();
	for (const entry of SCENE_SETS) {
		if (!entry.units.includes(unit)) continue;
		const scene = entry.of[key];
		if (!scene) continue;
		const picture = { kind: "scene", set: entry.set, scene } as ScenePicture;
		// Shown only when the sentence names the drawn thing in a form the English blank can hide.
		if (translation !== undefined && translationAroundPicture(translation, picture).length < 3) return undefined;
		return picture;
	}
	return undefined;
}
