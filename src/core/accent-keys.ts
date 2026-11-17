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
	return (
		before.toLocaleLowerCase(tag) !== letter.toLocaleLowerCase(tag) &&
		baseLetter(before, tag) === baseLetter(letter, tag)
	);
}

/** A dead key (´ ˇ ¨ on the learner's layout), an IME composition (229), or Windows VK_PACKET (231, SendInput KEYEVENTF_UNICODE used by tools like PowerToys Quick Accent). */
export function belongsToLayoutAccent(key: { key: string; isComposing: boolean; keyCode: number }): boolean {
	return key.key === "Dead" || key.isComposing || key.keyCode === 229 || key.keyCode === 231;
}

export function isSyntheticUnicodeLetter(key: { key: string; keyCode: number }): boolean {
	if (key.keyCode !== 231 || key.key.length !== 1) return false;
	return (key.key.codePointAt(0) ?? 0) > 127 && /\p{L}/u.test(key.key);
}

export function liveFamily(
	families: readonly LetterFamily[],
	value: string,
	start: number,
	end: number,
	tag: string,
): string | null {
	const before = letterBefore(value, start, end);
	if (!before) return null;
	const family = families.find((f) => f.base === baseLetter(before, tag));
	return family && family.letters.some((letter) => changes(before, letter, tag)) ? family.base : null;
}

export function pickAccent(
	value: string,
	start: number,
	end: number,
	heldBase: string,
	letter: string,
	tag: string,
): { value: string; caret: number } {
	const before = letterBefore(value, start, end);
	if (before && baseLetter(before, tag) === heldBase) {
		const upper = before !== before.toLocaleLowerCase(tag) && before === before.toLocaleUpperCase(tag);
		const typed = upper ? letter.toLocaleUpperCase(tag) : letter;
		const from = start - before.length;
		return { value: value.slice(0, from) + typed + value.slice(start), caret: from + typed.length };
	}
	return { value: value.slice(0, start) + letter + value.slice(end), caret: start + letter.length };
}

export function pressLetter(
	value: string,
	start: number,
	end: number,
	letter: string,
	shift: boolean,
	tag: string,
): { value: string; caret: number } {
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
