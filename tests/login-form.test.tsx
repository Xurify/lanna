import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginForm } from "@/components/login/login-form";

const html = renderToStaticMarkup(createElement(LoginForm, { next: "/read?id=3" }));

describe("the sign-in form", () => {
	it("has one password field that a password manager recognizes, and one button", () => {
		assert.equal((html.match(/<input/g) ?? []).length, 1);
		assert.match(html, /type="password"/);
		assert.match(html, /autoComplete="current-password"|autocomplete="current-password"/);
		assert.match(html, /name="password"/);
		assert.equal((html.match(/<button/g) ?? []).length, 1);
	});

	it("keeps the field at 16 px or more, so iOS does not zoom when it focuses", () => {
		const classes = (html.match(/<input[^>]*class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
		assert.ok(classes.includes("text-[16px]"), "the app's text-base is 14 px");
		assert.ok(classes.includes("md:text-[16px]"), "the shared Input drops to 14 px from 768 px, which is every iPad in portrait");
		assert.equal(classes.some((c) => c === "md:text-sm" || c === "text-sm" || c === "text-xs" || c === "text-base"), false);
	});

	it("reserves the error line out of the flow, so a message never moves the form", () => {
		const line = html.match(/<p[^>]*role="alert"[^>]*class="([^"]*)"|<p[^>]*class="([^"]*)"[^>]*role="alert"/);
		assert.ok(line, "an alert line exists before any error");
		assert.match(line![1] ?? line![2] ?? "", /\babsolute\b/);
	});

	it("disables the button until something is typed", () => {
		assert.match(html, /<button[^>]*disabled/);
	});

	it("uses no native widget beyond the text field", () => {
		assert.doesNotMatch(html, /<select|type="checkbox"|type="date"|<textarea/);
	});
});
