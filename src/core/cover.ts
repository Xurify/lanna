/** Every scene a story cover can show; the story writer picks one by name (components/reading/cover-scene.tsx draws them). */
export const COVER_MOTIFS = [
	"market",
	"friends",
	"train",
	"cup",
	"clinic",
	"mountains",
	"office",
	"tree",
	"home",
	"table",
	"bike",
	"family",
	"plate",
	"books",
	"city",
	"leaves",
	"baking",
	"moving",
	"wedding",
	"clock",
] as const;

export type CoverMotif = (typeof COVER_MOTIFS)[number];

export function isCoverMotif(value: unknown): value is CoverMotif {
	return typeof value === "string" && (COVER_MOTIFS as readonly string[]).includes(value);
}

const MOTIF_WORDS: ReadonlyArray<[CoverMotif, RegExp]> = [
	["train", /vlak|train|stanic|station|nádraž/i],
	["clinic", /lekár|doctor|pohotov|chrípk|nemocn|clinic|hospital|zdrav/i],
	["office", /pohovor|prác|work|office|interview|kancel/i],
	["wedding", /svadb|wedding|sobáš/i],
	["baking", /pečen|medovn|koláč|perník|bake|baking|cookie/i],
	["moving", /sťahov|moving/i],
	["cup", /kaviar|café|cafe|coffee|káv|čaj|(?<!\p{L})tea/iu],
	["plate", /obed|kolib|lunch|dinner|jedl|reštaur|restaur|food|varí|cook/i],
	["table", /priate|friend|večer|party|oslav|evening/i],
	["books", /knih|book|škol|school|čítan|library|knižnic/i],
	["market", /trh|market|potravin|shop|obchod|nákup|kúp/i],
	["mountains", /tatr|(?<!\p{L})hrad|turist|hory|mountain|castle|výlet|trip|hike/iu],
	["city", /mest|cest|námest|ulic|city|street|direction|town/i],
	["leaves", /jese|autumn|jabĺk|apple|obdob|season|počas|weather/i],
	["tree", /záhrad|garden|park/i],
	["bike", /víkend|weekend|bicyk|bike|šport|sport/i],
	["family", /rodin|family|mam|otec|(?<!\p{L})det|babk|starej|stará/iu],
	["home", /dom|byt|home|flat|house/i],
	["clock", /ráno|morning|budík|(?<!\p{L})deň|(?<!\p{L})day|rutin/iu],
	["friends", /ahoj|zozn|meet|predstav|hello|ja som/i],
];

const UNMATCHED: readonly CoverMotif[] = ["friends", "books", "city", "bike", "table"];

/** The cover for a story the writer gave none: the first scene whose words the title or theme contains, else one of the general scenes by seed. */
export function coverMotif(text: string, seed = 0): CoverMotif {
	return matchedCoverMotif(text) ?? UNMATCHED[seed % UNMATCHED.length]!;
}

/** The scene whose words the text contains, or undefined when none does. */
export function matchedCoverMotif(text: string): CoverMotif | undefined {
	return MOTIF_WORDS.find(([, words]) => words.test(text))?.[0];
}

export function coverSeed(id: string): number {
	let hash = 7;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
	return hash;
}
