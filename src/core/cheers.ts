/**
 * Exclamations said in the language being learned: the praise after a right
 * answer and the heading at the end of a lesson (E78). Every form is backed
 * by the Slovak lexicon or English Wiktionary; the sources are listed in
 * docs/research/target-language-ui.md.
 */

export interface Cheer {
	text: string;
	gloss: string;
}

export interface Cheers {
	praise: readonly string[];
	done: Cheer;
	perfect: Cheer;
	timeUp: Cheer;
	newBest: Cheer;
}

export type CheerKey = Exclude<keyof Cheers, "praise">;

const CHEERS: Record<string, Cheers> = {
	sk: {
		praise: ["Výborne!", "Super!", "Presne tak!", "Skvelé!", "Bravo!", "Paráda!"],
		done: { text: "Je to hotové!", gloss: "it's done" },
		perfect: { text: "Bez chyby!", gloss: "no mistakes" },
		timeUp: { text: "Koniec!", gloss: "the end" },
		newBest: { text: "Nový rekord!", gloss: "new record" },
	},
	et: {
		praise: ["Tubli!", "Väga hea!", "Täpselt!", "Suurepärane!", "Õige!"],
		done: { text: "Valmis!", gloss: "done" },
		perfect: { text: "Vigadeta!", gloss: "no mistakes" },
		timeUp: { text: "Aeg on läbi!", gloss: "time's up" },
		newBest: { text: "Uus rekord!", gloss: "new record" },
	},
	ru: {
		praise: ["Отлично!", "Молодец!", "Верно!", "Точно!", "Здорово!"],
		done: { text: "Готово!", gloss: "done" },
		perfect: { text: "Без ошибок!", gloss: "no mistakes" },
		timeUp: { text: "Время вышло!", gloss: "time's up" },
		newBest: { text: "Новый рекорд!", gloss: "new record" },
	},
};

const ENGLISH_PRAISE: readonly string[] = ["Right!", "Nice!", "Exactly!", "Well done!"];

/** The language codes (ISO 639-1) that have their own exclamations. */
export const CHEER_LANGUAGES: readonly string[] = Object.keys(CHEERS);

export function cheersFor(code: string | undefined): Cheers | null {
	return (code && CHEERS[code]) || null;
}

export function praiseFor(code: string | undefined, n: number): { text: string; lang: string | undefined } {
	const own = cheersFor(code);
	const list = own?.praise ?? ENGLISH_PRAISE;
	return { text: list[Math.abs(Math.trunc(n)) % list.length]!, lang: own ? code : undefined };
}
