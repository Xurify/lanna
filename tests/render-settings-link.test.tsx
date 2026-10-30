/**
 * The learning screens' "Set up a model" lines open the settings dialog.
 * They used to link to /settings, which only redirects (the dialog is
 * modal-only), so the link dead-ended on the chat. SSR pins the control;
 * the source pin keeps a /settings link from coming back.
 */
import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsLink } from "../components/settings/settings-link.tsx";

describe("SettingsLink", () => {
	it("renders a button, not a link: the dialog opens in place", () => {
		const html = renderToStaticMarkup(<SettingsLink className="underline">Set up a model</SettingsLink>);
		assert.ok(html.startsWith("<button"), html);
		assert.ok(html.includes('type="button"'));
		assert.ok(html.includes('class="underline"'));
		assert.ok(html.includes(">Set up a model</button>"));
		assert.ok(!html.includes("href"), "no href: /settings only redirects");
	});
});

describe("learning screens", () => {
	it("no player links to /settings any more", () => {
		for (const file of ["components/reading/reader.tsx", "components/watch/watch-player.tsx", "components/speak/speak-player.tsx"]) {
			const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
			assert.ok(!src.includes('href="/settings'), file);
			assert.ok(src.includes("SettingsLink"), file);
		}
	});
});
