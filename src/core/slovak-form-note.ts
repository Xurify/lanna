import { foldDiacritics } from "./language.ts";

export interface FormNoteEntry {
	lemma: string;
	pos?: string;
	gender?: string;
}

type EndingTable = Readonly<Record<string, string>>;

// Adjective endings of the hard pattern "pekný" in Pravidlá slovenského pravopisu.
// The soft pattern "cudzí" maps onto it in softToHard; the short endings after a
// long syllable (rhythmic law: "krásny", "krásneho") fold onto the long ones.
const ADJECTIVE: EndingTable = {
	a: "feminine nominative singular",
	e: "nominative or accusative plural, or neuter nominative or accusative singular",
	i: "masculine personal nominative plural",
	eho: "masculine or neuter genitive singular, or masculine animate accusative singular",
	emu: "masculine or neuter dative singular",
	om: "masculine or neuter locative singular",
	ym: "masculine or neuter instrumental singular, or dative plural",
	u: "feminine accusative singular",
	ej: "feminine genitive, dative or locative singular",
	ou: "feminine instrumental singular",
	ych: "genitive or locative plural, or masculine personal accusative plural",
	ymi: "instrumental plural",
};

const SOFT_TO_HARD: EndingTable = {
	ia: "a",
	ie: "e",
	ieho: "eho",
	iemu: "emu",
	iu: "u",
	im: "ym",
	ich: "ych",
	imi: "ymi",
};

// Noun endings by gender, from the patterns in Pravidlá slovenského pravopisu:
// chlap and hrdina (masculine animate), dub and stroj (masculine inanimate),
// žena and ulica, dlaň, kosť (feminine), mesto, srdce, vysvedčenie (neuter).
// Only the endings that name the same cells in every pattern of that group.
const MASCULINE_ANIMATE: EndingTable = {
	ovi: "dative or locative singular",
	om: "instrumental singular, or dative plural",
	ovia: "nominative plural",
	ov: "genitive or accusative plural",
	och: "locative plural",
	ami: "instrumental plural",
	mi: "instrumental plural",
};

const MASCULINE_ANIMATE_CONSONANT: EndingTable = { ...MASCULINE_ANIMATE, a: "genitive or accusative singular" };
const MASCULINE_ANIMATE_A: EndingTable = { ...MASCULINE_ANIMATE, u: "genitive or accusative singular" };

const MASCULINE_INANIMATE: EndingTable = {
	om: "instrumental singular, or dative plural",
	ov: "genitive plural",
	y: "nominative or accusative plural",
	och: "locative plural",
	ami: "instrumental plural",
	mi: "instrumental plural",
};

const FEMININE_A: EndingTable = {
	y: "genitive singular, or nominative or accusative plural",
	u: "accusative singular",
	ou: "instrumental singular",
	ám: "dative plural",
	am: "dative plural",
	iam: "dative plural",
	ách: "locative plural",
	ach: "locative plural",
	iach: "locative plural",
	ami: "instrumental plural",
};

const FEMININE_DLAN: EndingTable = {
	e: "genitive singular, or nominative or accusative plural",
	i: "dative or locative singular",
	ou: "instrumental singular",
	í: "genitive plural",
	am: "dative plural",
	ach: "locative plural",
	ami: "instrumental plural",
};

const FEMININE_KOST: EndingTable = {
	i: "genitive, dative or locative singular, or nominative or accusative plural",
	ou: "instrumental singular",
	í: "genitive plural",
	iam: "dative plural",
	iach: "locative plural",
	ami: "instrumental plural",
};

const NEUTER_O: EndingTable = {
	u: "dative singular",
	e: "locative singular",
	om: "instrumental singular",
	á: "nominative or accusative plural",
	ám: "dative plural",
	am: "dative plural",
	ách: "locative plural",
	ach: "locative plural",
	ami: "instrumental plural",
};

const NEUTER_E: EndingTable = {
	a: "genitive singular",
	u: "dative singular",
	i: "locative singular",
	om: "instrumental singular",
	ia: "nominative or accusative plural",
	iam: "dative plural",
	iach: "locative plural",
	ami: "instrumental plural",
};

const NEUTER_IE: EndingTable = {
	ia: "genitive singular, or nominative or accusative plural",
	iu: "dative singular",
	í: "locative singular, or genitive plural",
	ím: "instrumental singular",
	iam: "dative plural",
	iach: "locative plural",
	iami: "instrumental plural",
};

const ANY_NOUN: EndingTable = {
	ovi: "dative or locative singular",
	ou: "instrumental singular",
	ách: "locative plural",
	iach: "locative plural",
	och: "locative plural",
	ami: "instrumental plural",
	iami: "instrumental plural",
};

const LONG_SYLLABLE = /(?:[áéíóúýôŕĺ]|ia|ie|iu)[^aeiouyáéíóúýäô]*$/;

/** The grammar cells a Slovak form fills, read from its ending against its
 *  dictionary form ("strednom", stredný → "masculine or neuter locative
 *  singular"), or undefined when the ending is ambiguous or the stem changed. */
export function slovakFormCells(surface: string, entry: FormNoteEntry): string | undefined {
	const form = surface.toLocaleLowerCase("sk-SK");
	const lemma = entry.lemma.toLocaleLowerCase("sk-SK");
	if (!form || form === lemma) return undefined;
	const pos = entry.pos?.toLowerCase();
	if (pos === "adjective") return adjectiveCells(form, lemma);
	if (pos && pos !== "noun") return undefined;
	return nounCells(form, lemma, entry.gender);
}

function adjectiveCells(form: string, lemma: string): string | undefined {
	const folded = foldDiacritics(lemma);
	if (!/[yi]$/.test(folded)) return undefined;
	const soft = folded.endsWith("i");
	const ending = endingAfter(form, lemma.slice(0, -1));
	if (ending === undefined) return undefined;
	const plain = foldDiacritics(ending);
	if (soft && plain === "i") return undefined;
	return ADJECTIVE[soft ? (SOFT_TO_HARD[plain] ?? plain) : plain];
}

function nounCells(form: string, lemma: string, gender: string | undefined): string | undefined {
	const [stem, table] = nounPattern(lemma, gender);
	const ending = endingAfter(form, stem) ?? fleetingVowelEnding(form, lemma);
	if (ending === undefined) return undefined;
	if (table === NEUTER_O && ending === "a")
		return LONG_SYLLABLE.test(stem) ? "genitive singular, or nominative or accusative plural" : "genitive singular";
	return table[ending];
}

function nounPattern(lemma: string, gender: string | undefined): [string, EndingTable] {
	const vowelEnd = /[aeoiu]$/.test(lemma);
	switch (gender) {
		case "masculine-animate":
			return lemma.endsWith("a") ? [lemma.slice(0, -1), MASCULINE_ANIMATE_A] : [lemma, MASCULINE_ANIMATE_CONSONANT];
		case "masculine-inanimate":
			return vowelEnd ? [lemma.slice(0, -1), ANY_NOUN] : [lemma, MASCULINE_INANIMATE];
		case "feminine":
			if (lemma.endsWith("a")) return [lemma.slice(0, -1), FEMININE_A];
			if (lemma.endsWith("osť")) return [lemma, FEMININE_KOST];
			if (lemma.endsWith("ň")) return [lemma, FEMININE_DLAN];
			return [lemma, ANY_NOUN];
		case "neuter":
			if (lemma.endsWith("ie")) return [lemma.slice(0, -2), NEUTER_IE];
			if (lemma.endsWith("o")) return [lemma.slice(0, -1), NEUTER_O];
			if (lemma.endsWith("e")) return [lemma.slice(0, -1), NEUTER_E];
			return [lemma, ANY_NOUN];
		default:
			return [vowelEnd ? lemma.slice(0, -1) : lemma, ANY_NOUN];
	}
}

/** The ending after the stem, compared without diacritics because a soft
 *  consonant drops its mark before e and i ("dlaň" → "dlane"). */
function endingAfter(form: string, stem: string): string | undefined {
	if (!stem || !foldDiacritics(form).startsWith(foldDiacritics(stem))) return undefined;
	return form.slice(stem.length);
}

/** "kaviareň" → "kaviarne", "pieseň" → "piesne": the e or ie before the last
 *  consonant drops out of every other form. */
function fleetingVowelEnding(form: string, lemma: string): string | undefined {
	const match = /^(.*?)(?:ie|e|o)([^aeiouyáéíóúýäô])$/.exec(lemma);
	if (!match) return undefined;
	return endingAfter(form, `${match[1]}${match[2]}`);
}
