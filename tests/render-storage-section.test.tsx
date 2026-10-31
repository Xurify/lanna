/** Settings → Data UI: the desktop shows the app's HTTP cache with a clear action, the browser says where its own cache lives, and saved areas are measured and never offer a clear. */
import React, { act } from "react";
(globalThis as Record<string, unknown>).React = React;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { SettingsDialogBody } from "../components/settings/settings-dialog.tsx";
import { StorageSection } from "../components/settings/storage-section.tsx";

const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, { window: dom.window, document: dom.document, CustomEvent: dom.window.CustomEvent });
const originalFetch = globalThis.fetch;
const roots: { root: Root; host: HTMLElement }[] = [];
const q = (host: ParentNode, id: string) => host.querySelector<HTMLElement>(`[data-testid='${id}']`);

const report = {
	language: "Slovak",
	areas: [
		{ id: "clips", label: "Voice clips", path: "/data/audio", bytes: 210 * 1024 * 1024, files: 1204 },
		{ id: "progress", label: "Learning progress", path: "/data/profiles/slovak", bytes: 12 * 1024 * 1024, files: 300 },
		{ id: "backups", label: "Backups", path: "/data/backups", bytes: 0, files: 0 },
	],
};

/** GET /api/storage answers with the report (or a failure); the dialog's own settings read is stubbed too. */
function serve(storageStatus = 200) {
	globalThis.fetch = (async (input: RequestInfo | URL) =>
		String(input) === "/api/storage"
			? Response.json(storageStatus === 200 ? report : { error: "boom" }, { status: storageStatus })
			: Response.json({ settings: { version: 1 } })) as typeof fetch;
}

/** The desktop bridge: the cache starts at 4 MB; clearing empties it. */
function desktop({ failClear = false, failMeasure = false } = {}) {
	const calls = { clear: 0 };
	let cache = 4 * 1024 * 1024;
	window.lh = {
		expandWindow() {},
		storage: {
			// An older desktop shell has no handler for this channel.
			cacheSize: async () => {
				if (failMeasure) throw new Error("No handler registered for 'lh:storage:cache-size'");
				return cache;
			},
			clearCache: async () => {
				calls.clear++;
				if (failClear) throw new Error("raw diagnostics");
				cache = 0;
				return cache;
			},
		},
	};
	return { calls };
}

async function mount(element: React.ReactElement) {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push({ root, host });
	await act(async () => {
		root.render(element);
	});
	return host;
}

/** Let the fetch and bridge promises resolve, then flush React. */
async function settle() {
	for (let i = 0; i < 4; i++) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
}

async function click(element: HTMLElement | null) {
	assert.ok(element, "missing click target");
	await act(async () => {
		element.click();
	});
}

afterEach(async () => {
	for (const { root, host } of roots.splice(0)) {
		await act(async () => {
			root.unmount();
		});
		host.remove();
	}
	delete window.lh;
	globalThis.fetch = originalFetch;
});

describe("Storage section", () => {
	it("server render shows the browser cache and the three saved rows, with no clear control", () => {
		const html = renderToStaticMarkup(<StorageSection />);
		assert.ok(html.includes("Browser cache"));
		assert.ok(!html.includes("storage-clear-cache"));
		for (const id of ["clips", "progress", "backups"]) assert.ok(html.includes(`data-testid="storage-row-${id}"`));
		assert.ok(html.includes("Measuring…"));
	});

	it("draws the three saved rows before the measure lands, so nothing shifts when it does", async () => {
		globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
		const host = await mount(<StorageSection />);
		await settle();
		for (const id of ["clips", "progress", "backups"]) {
			assert.ok(q(host, `storage-row-${id}`));
			assert.equal(q(host, `storage-size-${id}`)!.textContent, "…");
		}
	});

	it("web: says where the browser cache lives, offers no clear, and measures the saved areas (empty backups say Empty)", async () => {
		serve();
		const host = await mount(<StorageSection />);
		await settle();
		assert.ok(host.textContent!.includes("Browser cache"));
		assert.equal(q(host, "storage-clear-cache"), null);
		assert.equal(q(host, "storage-size-clips")!.textContent, "210 MB");
		assert.equal(q(host, "storage-size-progress")!.textContent, "12 MB");
		assert.equal(q(host, "storage-size-backups")!.textContent, "Empty");
		assert.ok(host.textContent!.includes("/data/audio"));
	});

	it("desktop: shows the app's HTTP cache size, clears it, and shows the size afterwards without touching saved areas", async () => {
		serve();
		const { calls } = desktop();
		const host = await mount(<StorageSection />);
		await settle();
		assert.ok(host.textContent!.includes("App cache"));
		assert.equal(q(host, "storage-cache-size")!.textContent, "4.0 MB");
		await click(q(host, "storage-clear-cache"));
		await settle();
		assert.equal(calls.clear, 1);
		assert.equal(q(host, "storage-cache-size")!.textContent, "0 B");
		assert.equal(q(host, "storage-notice")!.getAttribute("role"), "status");
		assert.equal(q(host, "storage-size-clips")!.textContent, "210 MB");
	});

	it("a failed clear shows one generic alert, keeps the old size, and leaks no raw error", async () => {
		serve();
		desktop({ failClear: true });
		const host = await mount(<StorageSection />);
		await settle();
		await click(q(host, "storage-clear-cache"));
		await settle();
		assert.equal(q(host, "storage-notice")!.getAttribute("role"), "alert");
		assert.equal(q(host, "storage-notice")!.textContent, "Couldn’t clear the cache. Restart LangHarness and try again.");
		assert.equal(q(host, "storage-cache-size")!.textContent, "4.0 MB");
		assert.ok(!host.textContent!.includes("raw diagnostics"));
	});

	it("a bridge that cannot measure says to restart, offers no clear, and keeps the saved areas", async () => {
		serve();
		desktop({ failMeasure: true });
		const host = await mount(<StorageSection />);
		await settle();
		assert.equal(q(host, "storage-cache-size")!.textContent, "Unavailable");
		assert.ok(host.textContent!.includes("Restart LangHarness to measure and clear the app cache."));
		assert.ok(q(host, "storage-clear-cache")!.hasAttribute("disabled"));
		assert.equal(q(host, "storage-size-clips")!.textContent, "210 MB");
	});

	it("a failed measurement says so in the saved group", async () => {
		serve(500);
		const host = await mount(<StorageSection />);
		await settle();
		assert.equal(q(host, "storage-saved")!.querySelector("[role='alert']")!.textContent, "Couldn’t measure storage. Refresh to try again.");
	});

	it("the settings dialog opens Data from its nav, with the storage rows", async () => {
		serve();
		const host = await mount(<SettingsDialogBody initialSection="general" onClose={() => {}} />);
		await settle();
		await click(q(host, "settings-nav-data"));
		await settle();
		assert.equal(q(host, "settings-nav-data")!.getAttribute("aria-current"), "true");
		assert.ok(q(host, "section-storage"));
		assert.ok(q(host, "storage-row-clips"));
	});
});
