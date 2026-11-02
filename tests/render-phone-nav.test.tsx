import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isPhoneNavPath, PhoneNav } from "@/components/phone-nav";

describe("PhoneNav — the five doors on phones (below md)", () => {
	it("shows on Today, the Climb, Review, Stories and Progress (with Milestones and the map under it) only", () => {
		for (const p of ["/", "/curriculum", "/plan", "/milestones", "/review", "/map", "/read"]) assert.ok(isPhoneNavPath(p), p);
		for (const p of ["/chat/new", "/lesson", "/listen", "/fluency", "/speak", "/watch", "/reading"]) {
			assert.ok(!isPhoneNavPath(p), `${p} keeps its own bottom bar`);
		}
	});

	it("renders the five doors, hidden from md up, with the active door marked", () => {
		const html = renderToStaticMarkup(createElement(PhoneNav, { pathname: "/review" }));
		assert.ok(html.includes('aria-label="Bottom navigation"'));
		assert.ok(html.includes("md:hidden"), "the bar is phone-only");
		for (const id of ["phone-today-door", "phone-path-door", "phone-review-door", "phone-stories-door", "phone-plan-door"]) {
			assert.ok(html.includes(`data-testid="${id}"`), id);
		}
		const review = html.split('data-testid="phone-review-door"')[1]?.split("</a>")[0] ?? "";
		assert.ok(review.includes('aria-current="page"'), "Review is the current door");
		const today = html.split('data-testid="phone-today-door"')[1]?.split("</a>")[0] ?? "";
		assert.ok(!today.includes("aria-current"), "Today is not current on /review");
	});

	it("renders nothing on a page without the bar", () => {
		assert.equal(renderToStaticMarkup(createElement(PhoneNav, { pathname: "/chat/new" })), "");
	});
});
