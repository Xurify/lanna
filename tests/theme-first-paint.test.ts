import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { THEME_COOKIE, themeFromCookie } from "../lib/theme.ts";

describe("the theme is right in the first HTML", () => {
	it("an explicit choice comes from the cookie; anything else follows the system", () => {
		assert.equal(themeFromCookie("night"), "night");
		assert.equal(themeFromCookie("day"), "day");
		assert.equal(themeFromCookie(undefined), "system");
		assert.equal(themeFromCookie("purple"), "system");
	});

	it("the root layout reads the cookie on the server and writes data-theme and the dark class into <html>", () => {
		const layout = fs.readFileSync("app/layout.tsx", "utf-8");
		assert.ok(layout.includes(THEME_COOKIE) || layout.includes("THEME_COOKIE"));
		assert.match(layout, /cookies\(\)\)\.get\(THEME_COOKIE\)/);
		assert.match(layout, /data-theme=\{theme === "system" \? undefined : theme\}/);
		assert.match(layout, /theme === "night" \? " dark" : ""/);
		assert.ok(!layout.includes("<script"), "no script element in the React tree (React warns when it re-renders one)");
	});

	it("Night tokens answer to data-theme, to the dark class and, for a system set to dark, to a media query", () => {
		const css = fs.readFileSync("app/globals.css", "utf-8");
		assert.match(css, /\.dark,\s*:root\[data-theme="night"\]\s*\{/);
		assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="day"\]\)/);
	});

	it("fonts: Geist is preloaded and never swaps late; the code font is not preloaded", () => {
		const layout = fs.readFileSync("app/layout.tsx", "utf-8");
		assert.match(layout, /Geist\(\{[^}]*display: "optional"/);
		assert.match(layout, /JetBrains_Mono\(\{[^}]*preload: false/);
	});
});
