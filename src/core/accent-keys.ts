export interface LetterFamily {
	base: string;
	letters: string[];
}

export function baseLetter(letter: string, tag: string): string {
	return letter.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(tag);
}

export function letterFamilies(letters: readonly string[], tag: string): LetterFamily[] {
	const families: LetterFamily[] = [];
	for (const letter of letters) {
		const base = baseLetter(letter, tag);
		const family = families.find((f) => f.base === base);
		if (family) family.letters.push(letter);
		else families.push({ base, letters: [letter] });
	}
	return families;
}

function letterBefore(value: string, start: number, end: number): string {
	if (start !== end || start === 0) return "";
	const before = [...value.slice(0, start)].at(-1) ?? "";
	return /\p{L}/u.test(before) ? before : "";
}

/** Cyrillic letters with a mark are letters of their own: е and ё, и and й follow each other in everyday words (её, русский). */
function changes(before: string, letter: string, tag: string): boolean {
	if (!before || /\p{Script=Cyrillic}/u.test(letter)) return false;
	return before.toLocaleLowerCase(tag) !== letter.toLocaleLowerCase(tag) && baseLetter(before, tag) === baseLetter(letter, tag);
}

export function liveFamily(families: readonly LetterFamily[], value: string, start: number, end: number, tag: string): string | null {
	const before = letterBefore(value, start, end);
	if (!before) return null;
	const family = families.find((f) => f.base === baseLetter(before, tag));
	return family && family.letters.some((letter) => changes(before, letter, tag)) ? family.base : null;
}

export function pressLetter(value: string, start: number, end: number, letter: string, shift: boolean, tag: string): { value: string; caret: number } {
	const before = letterBefore(value, start, end);
	if (changes(before, letter, tag)) {
		const upper = shift || (before !== before.toLocaleLowerCase(tag) && before === before.toLocaleUpperCase(tag));
		const typed = upper ? letter.toLocaleUpperCase(tag) : letter;
		const from = start - before.length;
		return { value: value.slice(0, from) + typed + value.slice(start), caret: from + typed.length };
	}
	const typed = shift ? letter.toLocaleUpperCase(tag) : letter;
	return { value: value.slice(0, start) + typed + value.slice(end), caret: start + typed.length };
}
