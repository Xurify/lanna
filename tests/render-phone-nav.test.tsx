import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isPhoneNavPath, PhoneNav } from "@/components/phone-nav";

describe("PhoneNav — the four doors on phones (below md)", () => {
	it("shows on Today, Plan (and Milestones under it), Review and the Skill map only", () => {
		for (const p of ["/", "/plan", "/milestones", "/review", "/map"]) assert.ok(isPhoneNavPath(p), p);
		for (const p of ["/chat/new", "/lesson", "/listen", "/fluency", "/speak", "/watch", "/reading", "/curriculum"]) {
			assert.ok(!isPhoneNavPath(p), `${p} keeps its own bottom bar`);
		}
	});

	it("renders the four doors, hidden from md up, with the active door marked", () => {
		const html = renderToStaticMarkup(createElement(PhoneNav, { pathname: "/review" }));
		assert.ok(html.includes('aria-label="Bottom navigation"'));
		assert.ok(html.includes("md:hidden"), "the bar is phone-only");
		for (const id of ["phone-today-door", "phone-plan-door", "phone-review-door", "phone-map-door"]) {
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
