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

export function liveFamily(families: readonly LetterFamily[], value: string, start: number, end: number, tag: string): string | null {
	if (start !== end || start === 0) return null;
	const before = [...value.slice(0, start)].at(-1) ?? "";
	if (!/\p{L}/u.test(before)) return null;
	const base = baseLetter(before, tag);
	return families.some((f) => f.base === base) ? base : null;
}

export function pressLetter(value: string, start: number, end: number, letter: string, shift: boolean, tag: string): { value: string; caret: number } {
	const before = start === end && start > 0 ? ([...value.slice(0, start)].at(-1) ?? "") : "";
	const sameFamily = before !== "" && /\p{L}/u.test(before) && baseLetter(before, tag) === baseLetter(letter, tag);
	if (sameFamily) {
		const upper = shift || (before !== before.toLocaleLowerCase(tag) && before === before.toLocaleUpperCase(tag));
		const typed = upper ? letter.toLocaleUpperCase(tag) : letter;
		const from = start - before.length;
		return { value: value.slice(0, from) + typed + value.slice(start), caret: from + typed.length };
	}
	const typed = shift ? letter.toLocaleUpperCase(tag) : letter;
	return { value: value.slice(0, start) + typed + value.slice(end), caret: start + typed.length };
}
