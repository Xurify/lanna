import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EmptyState, KeyNote } from "@/components/quiet/empty-state";
import { SettingsDialogProvider } from "@/components/settings/settings-dialog";
import { AiCallout } from "@/components/ai-callout";

const wrap = (el: React.ReactElement) => renderToStaticMarkup(createElement(SettingsDialogProvider, null, el));

describe("empty and blocked states", () => {
	it("an empty state names the screen, says why, and has one primary action and at most a text link", () => {
		const html = wrap(
			<EmptyState testid="x" title="No episodes yet" action={<button className="q-btn primary">Add an AI key</button>} secondary={<a className="q-btn ghost">Back to Today</a>}>
				<p>Episodes are short stories at your level.</p>
			</EmptyState>,
		);
		assert.ok(html.includes("No episodes yet"));
		assert.equal((html.match(/q-btn primary/g) ?? []).length, 1);
		assert.ok(html.includes("q-btn ghost"));
	});

	it("the key note points to the one place a key is added, in plain words", () => {
		const html = wrap(<KeyNote />);
		assert.ok(html.includes("written with an AI key"));
		assert.ok(html.includes("Add one in Settings, API keys."));
	});

	it("no screen text names an internal term", () => {
		const html = wrap(<AiCallout status={{ ready: false, reason: "no-model" } as never} title="Better with AI" adds={["A tutor reads your answers"]} />);
		assert.ok(html.includes("No AI key is set."));
		assert.ok(html.includes("Add an AI key"));
		for (const word of ["slot", "cheap", "strong", "token"]) assert.ok(!html.toLowerCase().includes(word), word);
	});
});
