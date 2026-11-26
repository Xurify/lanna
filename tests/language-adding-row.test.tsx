import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddingRow, LanguageSheetBody } from "../components/language-switcher.tsx";
import type { FeedTask } from "../components/activity-dock.tsx";
import type { ProfileEntry } from "../components/language-actions.tsx";

// A language still being added is listed in the language menu the way a
// set-up one is, with a loading mark and no build step. (2026-11-05)

function adding(over: Partial<FeedTask> = {}): FeedTask {
	return {
		id: "language:estonian",
		kind: "language",
		title: "Adding Estonian",
		step: "Writing the story world",
		status: "running",
		startedAt: Date.now(),
		language: { id: "estonian", english: "Estonian" },
		...over,
	};
}

describe("a language being added, in the language menu", () => {
	it("is listed like a set-up language, with a loading mark and no build step", () => {
		const html = renderToStaticMarkup(<AddingRow task={adding()} />);
		assert.match(html, /data-country-code="EE"/, "the flag is still there");
		assert.match(html, />Eesti</, "the endonym, as in the other rows");
		assert.match(html, />\(Estonian\)</, "the English name in brackets");
		assert.match(html, /animate-spin/, "a loading mark");
		assert.match(html, /Being added/, "a screen reader hears it is being added");
		assert.doesNotMatch(html, /Writing the story world/, "no build step on the row");
		assert.doesNotMatch(html, / · /, "no separator before a step");
	});

	it("falls back to the task title when the task names no language", () => {
		const html = renderToStaticMarkup(<AddingRow task={adding({ language: undefined, title: "Adding something" })} />);
		assert.match(html, /Adding something/);
	});
});

const PROFILES: ProfileEntry[] = [
	{ id: "slovak", tag: "sk", endonym: "Slovenčina", english: "Slovak", lexicon: true, seed: true },
	{ id: "estonian", tag: "et", endonym: "Eesti", english: "Estonian", lexicon: true, seed: true },
	{ id: "russian", tag: "ru", endonym: "Русский", english: "Russian", lexicon: true, seed: true },
];

describe("mobile language picker sheet", () => {
	it("renders touch-sized language rows, active selection, adding rows, and add action", () => {
		const html = renderToStaticMarkup(
			<LanguageSheetBody
				profiles={PROFILES}
				active="russian"
				switching={null}
				addsRunning={[adding({ id: "language:czech", language: { id: "czech", english: "Czech" } })]}
				note={null}
				onChoose={() => {}}
				onOpenAdd={() => {}}
				onClose={() => {}}
			/>,
		);
		assert.match(html, /role="dialog"/);
		assert.match(html, /aria-modal="true"/);
		assert.match(html, /Target language/);
		assert.match(html, /min-h-12/);
		assert.match(html, /data-testid="profile-russian"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-testid="profile-russian"/);
		assert.match(html, /data-testid="profile-adding"/);
		assert.match(html, /data-testid="add-language-open"/);
		assert.match(html, /cap-center[^>]*>Add a language…/);
	});

	it("shows a loading state on the language being switched to and surfaces any error note", () => {
		const html = renderToStaticMarkup(
			<LanguageSheetBody
				profiles={PROFILES}
				active="russian"
				switching="slovak"
				addsRunning={[]}
				note="Wait for the current task to finish."
				onChoose={() => {}}
				onOpenAdd={() => {}}
				onClose={() => {}}
			/>,
		);
		assert.match(html, /animate-spin/);
		assert.match(html, /role="alert"[^>]*>Wait for the current task to finish\./);
	});
});
