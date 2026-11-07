/**
 * The app window's right-click menu: a link to another site can be copied
 * or opened in the browser; the app's own links and plain clicks get no menu.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const { contextMenuTemplate } = require("../electron/context-menu.cjs") as {
	contextMenuTemplate: (params: Record<string, unknown>, ownOrigin: string, act: { copy: (s: string) => void; open: (s: string) => void }) => Array<{ label?: string; role?: string; type?: string; click?: () => void }>;
};

const OWN = "http://127.0.0.1:3010";

describe("right-click menu", () => {
	it("copies or opens a YouTube link", () => {
		const copied: string[] = [];
		const opened: string[] = [];
		const items = contextMenuTemplate({ linkURL: "https://www.youtube.com/watch?v=abc123", selectionText: "" }, OWN, { copy: (s) => copied.push(s), open: (s) => opened.push(s) });
		assert.deepEqual(items.map((i) => i.label), ["Copy link", "Open in browser"]);
		items[0]!.click!();
		items[1]!.click!();
		assert.deepEqual(copied, ["https://www.youtube.com/watch?v=abc123"]);
		assert.deepEqual(opened, ["https://www.youtube.com/watch?v=abc123"]);
	});

	it("offers nothing for the app's own links or an empty spot, and Copy for selected text", () => {
		const act = { copy: () => {}, open: () => {} };
		assert.deepEqual(contextMenuTemplate({ linkURL: `${OWN}/watch`, selectionText: "" }, OWN, act), []);
		assert.deepEqual(contextMenuTemplate({ linkURL: "", selectionText: "  " }, OWN, act), []);
		assert.deepEqual(contextMenuTemplate({ linkURL: "javascript:alert(1)", selectionText: "" }, OWN, act), []);
		assert.deepEqual(contextMenuTemplate({ linkURL: "", selectionText: "Mart on Tartus." }, OWN, act).map((i) => i.role), ["copy"]);
	});

	it("puts the editing items in a text field, after the link items", () => {
		const items = contextMenuTemplate({ linkURL: "https://example.com/", isEditable: true, selectionText: "", editFlags: { canCut: false, canCopy: false, canPaste: true } }, OWN, { copy: () => {}, open: () => {} });
		assert.deepEqual(items.map((i) => i.label ?? i.role ?? i.type), ["Copy link", "Open in browser", "separator", "cut", "copy", "paste", "separator", "selectAll"]);
	});
});
