export const PAINTS = [
	"red",
	"yellow",
	"green",
	"blue",
	"darkblue",
	"lightblue",
	"black",
	"white",
	"grey",
	"brown",
	"pink",
	"orange",
	"purple",
] as const;

export type Paint = (typeof PAINTS)[number];

const COLOR_UNITS: ReadonlySet<string> = new Set(["lx-colours", "lx-words-colors"]);

const PAINT_OF: Readonly<Record<string, Paint>> = {
	červený: "red",
	žltý: "yellow",
	zelený: "green",
	modrý: "blue",
	čierny: "black",
	biely: "white",
	sivý: "grey",
	hnedý: "brown",
	ružový: "pink",
	oranžový: "orange",
	fialový: "purple",
	красный: "red",
	жёлтый: "yellow",
	желтый: "yellow",
	зелёный: "green",
	зеленый: "green",
	синий: "darkblue",
	голубой: "lightblue",
	чёрный: "black",
	черный: "black",
	белый: "white",
	серый: "grey",
	коричневый: "brown",
	розовый: "pink",
	оранжевый: "orange",
	фиолетовый: "purple",
	punane: "red",
	kollane: "yellow",
	roheline: "green",
	sinine: "blue",
	must: "black",
	valge: "white",
	hall: "grey",
	pruun: "brown",
	roosa: "pink",
	oranž: "orange",
	lilla: "purple",
};

export function paintFor(unit: string, lemma: string): Paint | undefined {
	if (!COLOR_UNITS.has(unit)) return undefined;
	return PAINT_OF[lemma.toLocaleLowerCase()];
}
