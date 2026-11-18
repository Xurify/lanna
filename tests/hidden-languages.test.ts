import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { setLanguageHidden, shownLanguages } from "../components/hidden-languages.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	},
});

const KEY = "lanna-hidden-languages";
const hiddenNow = (): string[] => JSON.parse(store.get(KEY) ?? "[]") as string[];
const profiles = [{ id: "slovak" }, { id: "russian" }, { id: "estonian" }];

beforeEach(() => store.clear());

test("a hidden language drops out of the menu", () => {
	assert.deepEqual(
		shownLanguages(profiles, "slovak", ["russian"]).map((p) => p.id),
		["slovak", "estonian"],
	);
});

test("the language being studied always shows, even when hidden", () => {
	assert.deepEqual(
		shownLanguages(profiles, "russian", ["russian", "estonian"]).map((p) => p.id),
		["slovak", "russian"],
	);
});

test("hiding twice keeps one entry, and showing removes it", () => {
	setLanguageHidden("russian", true);
	setLanguageHidden("russian", true);
	setLanguageHidden("estonian", true);
	assert.deepEqual(hiddenNow(), ["russian", "estonian"]);
	setLanguageHidden("russian", false);
	assert.deepEqual(hiddenNow(), ["estonian"]);
});

test("a damaged saved value hides nothing and is replaced on the next change", () => {
	store.set(KEY, "{not json");
	setLanguageHidden("estonian", true);
	assert.deepEqual(hiddenNow(), ["estonian"]);
	store.set(KEY, JSON.stringify(["russian", 3, null]));
	setLanguageHidden("slovak", true);
	assert.deepEqual(hiddenNow(), ["russian", "slovak"]);
});
