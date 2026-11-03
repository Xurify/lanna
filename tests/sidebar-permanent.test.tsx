import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarProvider, useSidebar } from "@/components/sidebar";

function Probe() {
	const { open, drawer } = useSidebar();
	return createElement("i", { "data-open": String(open), "data-drawer": String(drawer) });
}

describe("the sidebar is a permanent column on a desktop window", () => {
	it("renders open on the server, whatever an old cookie said", () => {
		const html = renderToStaticMarkup(createElement(SidebarProvider, null, createElement(Probe)));
		assert.ok(html.includes('data-open="true"'));
		assert.ok(html.includes('data-drawer="false"'));
	});

	it("the root layout no longer reads a collapsed-sidebar cookie", () => {
		const layout = fs.readFileSync("app/layout.tsx", "utf-8");
		assert.ok(!layout.includes("lh-sidebar") && !layout.includes("SIDEBAR_COOKIE"));
	});

	it("the close button belongs to the drawer only", () => {
		const src = fs.readFileSync("components/sidebar.tsx", "utf-8");
		assert.match(src, /aria-label="Close menu"[^>]*md:hidden/);
	});
});
