import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HardWordsWriting } from "@/components/writing/hard-words-writing";
import { Textarea } from "@/components/ui/textarea";

const language = { id: "slovak", english: "Slovak", tag: "sk-SK" };
const targets = [
	{ slug: "one", lemma: "one", gloss: "first target" },
	{ slug: "two", lemma: "two", gloss: "second target" },
	{ slug: "three", lemma: "three", gloss: "third target" },
];

test("one labeled passage field serves all target words, including without AI", () => {
	const html = renderToStaticMarkup(<HardWordsWriting targets={targets} language={language} ready={false} />);
	assert.equal((html.match(/<textarea/g) ?? []).length, 1);
	assert.match(html, /for="writing-text"/);
	assert.match(html, /id="writing-text"/);
	assert.match(html, /aria-describedby="writing-prompt writing-note"/);
	assert.match(html, /one<\/li>/);
	assert.match(html, /three<\/li>/);
	assert.match(html, /data-testid="writing-ai-off"/);
	assert.match(html, /Get feedback/);
	assert.ok(!html.includes("/lesson?mode=hardwords"));
	assert.ok(!html.includes("XP"));
});

test("the empty state has no unusable form or feedback action", () => {
	const html = renderToStaticMarkup(<HardWordsWriting targets={[]} language={language} ready={true} />);
	assert.match(html, /data-testid="writing-empty"/);
	assert.ok(!html.includes("<textarea"));
	assert.ok(!html.includes("Get feedback"));
});

test("shared textarea and bare q-fields retain padded, touch-sized defaults", () => {
	const html = renderToStaticMarkup(<Textarea aria-label="Writing" />);
	for (const token of ["q-field", "px-4", "py-3", "min-h-44", "text-lg", "font-prose"])
		assert.ok(html.includes(token), token);
	const css = fs.readFileSync(new URL("../app/quiet.css", import.meta.url), "utf8");
	assert.match(
		css,
		/@layer components\s*\{\s*:where\(input, textarea\)\.q-field\s*\{\s*min-height: 2\.75rem;\s*padding: 0\.625rem 0\.875rem;/,
	);
});
