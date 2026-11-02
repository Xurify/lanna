/**
 * Slovak rules a program can check for certain (LangHarness, 2026-11-01).
 *
 * The accuracy eval (docs/research/slovak-accuracy-eval.md) found models
 * accepting "s sestrou" with the rule in their context, and rejecting
 * curated, correct sentences. So the rules that need no judgment are checked
 * here, and their hits are handed to the tutor as evidence:
 *
 *   s/z/k/v → so/zo/ku/vo   before a word starting with the same sound group
 *   nie je                  never "nieje"
 *   no Czech letters        ř, ě, ů
 *   budem + perfective      a short list of common perfective infinitives
 *   dva / dve / dvaja       against the noun's gender, when the dictionary
 *                           gives that form one gender only
 *
 * A sentence equal to a curated dictionary example is `verified`. No hit
 * proves nothing: most mistakes need a person or a model. Pure; the
 * dictionary comes in through `lookup`.
 */

export interface SlovakIssue {
	rule: "vocalized-preposition" | "nie-je" | "czech-letter" | "budem-perfective" | "numeral-gender";
	/** The text as written. */
	found: string;
	/** What standard Slovak writes instead, when there is one answer. */
	fix?: string;
	/** One plain sentence for the tutor. */
	why: string;
}

export interface SlovakCheck {
	/** The whole text is a curated dictionary example. */
	verified: boolean;
	issues: SlovakIssue[];
}

export interface SlovakLookup {
	/** Genders the dictionary gives this lowercased form ("feminine",
	 *  "neuter", "masculine-animate", "masculine-inanimate"); empty when it is
	 *  not a noun form it knows. */
	genders(form: string): string[];
	/** The text is a curated example sentence. */
	isVerifiedExample(text: string): boolean;
}

/** Vocalized prepositions: the bare form before a word that starts with these letters. */
const VOCALIZE: Record<string, { before: RegExp; full: string; letters: string }> = {
	s: { before: /^[szšž]/i, full: "so", letters: "s, z, š or ž" },
	z: { before: /^[szšž]/i, full: "zo", letters: "s, z, š or ž" },
	k: { before: /^[kg]/i, full: "ku", letters: "k or g" },
	v: { before: /^[vf]/i, full: "vo", letters: "v or f" },
};

/** Every form but "bude": with it the infinitive can be the subject ("Najlepšie
 *  bude zavolať mu.") or hang on modal "dať sa" ("Bude sa to dať opraviť?"),
 *  and both are right. */
const BUDEM = new Set(["budem", "budeš", "budeme", "budete", "budú"]);

/** Common perfective infinitives (each one checked against KSSJ "dok."). */
const PERFECTIVE = new Set([
	"urobiť", "spraviť", "napísať", "prečítať", "kúpiť", "predať", "povedať", "prísť", "odísť", "dať",
	"vziať", "zobrať", "zavolať", "pomôcť", "zjesť", "vypiť", "nájsť", "otvoriť", "zatvoriť", "začať",
	"skončiť", "stretnúť", "poslať", "pozrieť", "uvariť", "zaplatiť", "vrátiť", "zistiť", "zabudnúť", "naučiť",
]);

const CLITICS = new Set(["sa", "si", "to", "ho", "mu", "mi", "ti", "ju", "ich", "ma", "ťa", "nám", "vám", "im", "jej"]);

const GENDERS = new Set(["feminine", "neuter", "masculine-animate", "masculine-inanimate"]);

const WORD = /[\p{L}]+/gu;

function capitalized(word: string, like: string): string {
	return like[0] === like[0]!.toLocaleUpperCase("sk") ? word[0]!.toLocaleUpperCase("sk") + word.slice(1) : word;
}

export function checkSlovak(text: string, lookup?: SlovakLookup): SlovakCheck {
	const clean = text.normalize("NFC");
	const words = [...clean.matchAll(WORD)].map((m) => m[0]);
	const lower = words.map((w) => w.toLocaleLowerCase("sk"));
	const issues: SlovakIssue[] = [];

	for (let i = 0; i < words.length - 1; i++) {
		const rule = VOCALIZE[lower[i]!];
		if (rule && rule.before.test(lower[i + 1]!)) {
			issues.push({ rule: "vocalized-preposition", found: `${words[i]} ${words[i + 1]}`, fix: `${capitalized(rule.full, words[i]!)} ${words[i + 1]}`, why: `Before a word starting with ${rule.letters} the preposition is written "${rule.full}".` });
		}
	}

	for (const w of words) if (w.toLocaleLowerCase("sk") === "nieje") issues.push({ rule: "nie-je", found: w, fix: capitalized("nie je", w), why: '"nie je" is always two words.' });

	// A capitalized word after the first is a name: "Počúvam Dvořáka." is right.
	const czech = words.find((w, i) => (i === 0 || w[0] === w[0]!.toLocaleLowerCase("sk")) && /[řěůŘĚŮ]/u.test(w))?.match(/[řěůŘĚŮ]/u);
	if (czech) issues.push({ rule: "czech-letter", found: czech[0], why: `"${czech[0]}" is a Czech letter; Slovak has no ř, ě or ů.` });

	for (let i = 0; i < words.length; i++) {
		if (!BUDEM.has(lower[i]!)) continue;
		// The infinitive right after budem, or after its clitics: "budem musieť urobiť" is right.
		let j = i + 1;
		while (j < lower.length && CLITICS.has(lower[j]!)) j++;
		const inf = PERFECTIVE.has(lower[j] ?? "") ? lower[j]! : null;
		if (inf) issues.push({ rule: "budem-perfective", found: `${words[i]} … ${inf}`, why: `"${words[i]}" takes an imperfective infinitive; "${inf}" is perfective, so its present form already means the future.` });
	}

	if (lookup) {
		for (let i = 0; i < words.length; i++) {
			const num = lower[i]!;
			if (num !== "dva" && num !== "dve" && num !== "dvaja") continue;
			const noun = lower.slice(i + 1, i + 4).find((w) => lookup.genders(w).length > 0);
			if (!noun) continue;
			const genders = new Set(lookup.genders(noun));
			if (genders.size !== 1 || !GENDERS.has([...genders][0]!)) continue;
			const gender = [...genders][0]!;
			const femNeut = gender === "feminine" || gender === "neuter";
			if (femNeut && num !== "dve") issues.push({ rule: "numeral-gender", found: `${words[i]} ${noun}`, fix: `${capitalized("dve", words[i]!)} ${noun}`, why: `"${noun}" is ${gender}, and feminine and neuter nouns take "dve".` });
			else if (!femNeut && num === "dve") issues.push({ rule: "numeral-gender", found: `${words[i]} ${noun}`, why: `"${noun}" is masculine: "dva" for things and animals, "dvaja" for male persons.` });
		}
	}

	return { verified: !!lookup?.isVerifiedExample(clean), issues };
}

/** The checker's findings as one line for the tutor, or null when it has nothing to say. */
export function checkerNote(check: SlovakCheck): string | null {
	if (check.verified) return "[Checker: this is a verified dictionary example sentence. Its Slovak is correct; do not mark its Slovak wrong. Whether it answers the task is still yours to judge.]";
	if (check.issues.length === 0) return null;
	const lines = check.issues.map((i) => `${i.found}${i.fix ? ` → ${i.fix}` : ""}: ${i.why}`);
	return `[Checker, certain rules only: ${lines.join(" ")}]`;
}
