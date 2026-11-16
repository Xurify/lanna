import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { LannaAppIcon } from "@/components/lanna-mark";
import { LoginForm } from "@/components/login/login-form";

const html = renderToStaticMarkup(createElement(LoginForm, { next: "/read?id=3" }));

describe("the sign-in form", () => {
	it("has one password field that a password manager recognizes", () => {
		assert.equal((html.match(/<input/g) ?? []).length, 1);
		assert.match(html, /type="password"/);
		assert.match(html, /autoComplete="current-password"|autocomplete="current-password"/);
		assert.match(html, /name="password"/);
	});

	it("labels the field, so a screen reader and a tap on the word both reach it", () => {
		assert.match(html, /<label[^>]*for="login-password"[^>]*>Password<\/label>/);
		assert.match(html, /<input[^>]*id="login-password"/);
	});

	it("has a submit button and a Show toggle that is a plain button, not a second submit", () => {
		assert.equal((html.match(/<button/g) ?? []).length, 2);
		assert.equal((html.match(/<button[^>]*type="submit"/g) ?? []).length, 1);
		assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Show password"/);
		assert.match(html, /aria-pressed="false"/);
	});

	it("shows the app's rounded icon above a heading that names the app", () => {
		const beforeHeading = html.slice(0, html.indexOf("<h1"));
		assert.match(beforeHeading, /<svg[^>]*aria-hidden="true"/);
		assert.match(beforeHeading, /fill="#0D6764"/);
		assert.match(html, /<h1[^>]*>Welcome to Lanna<\/h1>/);
	});

	it("is one column on the page, not a card", () => {
		assert.doesNotMatch(html, /\bq-card\b/);
	});

	it("draws the icon exactly as build/icon-flat.svg does", () => {
		const file = readFileSync(new URL("../build/icon-flat.svg", import.meta.url), "utf8");
		const fileTile = file.match(/<path d="([^"]+)" fill="#0D6764"/)?.[1];
		const drawn = renderToStaticMarkup(createElement(LannaAppIcon));
		assert.ok(fileTile, "build/icon-flat.svg has the tile");
		assert.ok(drawn.includes(`d="${fileTile}"`));
		for (const bar of [
			/<rect x="262" y="212" width="116" height="600" rx="22" fill="#FFFFFF"/,
			/<rect x="418" y="696" width="344" height="116" rx="22" fill="#9FE3DE"/,
		]) {
			assert.match(file, bar);
			assert.match(drawn, bar);
		}
	});

	it("keeps the field at 16 px or more, so iOS does not zoom when it focuses", () => {
		const classes = (html.match(/<input[^>]*class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
		assert.ok(classes.includes("text-[16px]"), "the app's text-base is 14 px");
		assert.ok(
			classes.includes("md:text-[16px]"),
			"a shared input class drops to 14 px from 768 px, which is every iPad in portrait",
		);
		assert.equal(
			classes.some((c) => c === "md:text-sm" || c === "text-sm" || c === "text-xs" || c === "text-base"),
			false,
		);
	});

	it("reserves two lines for a message, so an error never moves the form", () => {
		const line = html.match(/<p[^>]*role="alert"[^>]*class="([^"]*)"|<p[^>]*class="([^"]*)"[^>]*role="alert"/);
		assert.ok(line, "an alert line exists before any error");
		assert.match(line![1] ?? line![2] ?? "", /\bmin-h-10\b/);
	});

	it("points the field at the message", () => {
		assert.match(html, /aria-describedby="login-error"/);
		assert.match(html, /<p[^>]*id="login-error"/);
	});

	it("disables the button until something is typed", () => {
		assert.match(html, /<button[^>]*type="submit"[^>]*disabled|<button[^>]*disabled[^>]*type="submit"/);
	});

	it("uses the app's own field and button styles, not stock components", () => {
		assert.match(html, /class="[^"]*\bq-field\b/);
		assert.match(html, /class="[^"]*\bq-btn\b[^"]*\bprimary\b/);
	});

	it("keeps a label for the field even though it is not drawn, and a placeholder that names it", () => {
		assert.match(html, /<label[^>]*class="sr-only"[^>]*>Password<\/label>/);
		assert.match(html, /<input[^>]*placeholder="Password"/);
	});

	it("uses no native widget beyond the text field", () => {
		assert.doesNotMatch(html, /<select|type="checkbox"|type="date"|<textarea/);
	});
});
