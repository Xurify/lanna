/**
 * Advanced disclosures (Tutor, Skill map, Appearance): closed in the first
 * paint, controls mounted once opened. SSR cannot open a disclosure, so this
 * file mounts with linkedom and clicks the toggle.
 */
import React, { act } from "react";
(globalThis as Record<string, unknown>).React = React;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { AgentSection } from "../components/settings/agent-section.tsx";
import { AppearanceSection, GraphSection } from "../components/settings/appearance-section.tsx";
import { resolveSettings } from "../src/core/index.ts";

const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, { window: dom.window, document: dom.document, CustomEvent: dom.window.CustomEvent });
const originalFetch = globalThis.fetch;
const roots: { root: Root; host: HTMLElement }[] = [];
const q = (host: ParentNode, id: string) => host.querySelector<HTMLElement>(`[data-testid='${id}']`);
const factory = resolveSettings(null);
const fmt = (n: number) => n.toLocaleString("en-GB");

/** A fetch that never settles keeps the sections in their loading state. */
function hangFetches() {
	globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
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

async function open(host: HTMLElement, testid: string) {
	const toggle = q(host, `${testid}-toggle`);
	assert.ok(toggle, `${testid} toggle`);
	await act(async () => {
		toggle.click();
	});
}

afterEach(async () => {
	for (const { root, host } of roots.splice(0)) {
		await act(async () => {
			root.unmount();
		});
		host.remove();
	}
	globalThis.fetch = originalFetch;
});

describe("Settings → Tutor → Advanced", () => {
	it("closed at first; opened, it holds the long-chat threshold and the prompts, which wait for their fetch", async () => {
		hangFetches();
		const host = await mount(
			<AgentSection
				agent={undefined}
				models={undefined}
				graph={undefined}
				compaction={undefined}
				onSectionChange={() => {}}
				onModelsChange={() => {}}
				onCompactionChange={() => {}}
			/>,
		);
		assert.equal(q(host, "input-compaction-threshold"), null, "closed by default");
		await open(host, "advanced-tutor");
		assert.equal(q(host, "input-compaction-threshold")!.getAttribute("placeholder"), String(factory.compaction.thresholdTokens));
		assert.ok(q(host, "compaction-row-threshold")!.textContent!.includes(`Default ${fmt(factory.compaction.thresholdTokens)}.`));
		assert.ok(q(host, "group-prompts"), "the prompts open with the disclosure");
		assert.ok(host.textContent!.includes("Loading prompt segments"));
	});

	it("a stored threshold shows its value; the hint still names the factory default", async () => {
		hangFetches();
		const host = await mount(
			<AgentSection
				agent={undefined}
				models={undefined}
				graph={undefined}
				compaction={{ thresholdTokens: 50000 }}
				onSectionChange={() => {}}
				onModelsChange={() => {}}
				onCompactionChange={() => {}}
			/>,
		);
		await open(host, "advanced-tutor");
		assert.equal(q(host, "input-compaction-threshold")!.getAttribute("value"), "50000");
		assert.ok(q(host, "compaction-row-threshold")!.textContent!.includes(`Default ${fmt(factory.compaction.thresholdTokens)}.`), "the default, not the stored 50,000");
	});
});

describe("Settings → Skill map → Advanced", () => {
	it("closed at first; opened, the update size is empty and its placeholder is the factory budget", async () => {
		const host = await mount(<GraphSection graph={undefined} onSectionChange={() => {}} />);
		assert.equal(q(host, "input-chunk-tokens"), null, "closed by default");
		await open(host, "advanced-graph");
		assert.equal(q(host, "input-chunk-tokens")!.getAttribute("placeholder"), String(factory.graph.extractionChunkTokens));
		assert.ok(q(host, "graph-row-chunk-tokens")!.textContent!.includes(`Default ${fmt(factory.graph.extractionChunkTokens)}.`));
	});

	it("a stored budget shows its value; the hint still names the factory default", async () => {
		const host = await mount(<GraphSection graph={{ enabled: true, extractionChunkTokens: 6000 }} onSectionChange={() => {}} />);
		await open(host, "advanced-graph");
		assert.equal(q(host, "input-chunk-tokens")!.getAttribute("value"), "6000");
		assert.ok(q(host, "graph-row-chunk-tokens")!.textContent!.includes(`Default ${fmt(factory.graph.extractionChunkTokens)}.`), "the default, not the stored 6,000");
	});
});

describe("Settings → Appearance → Advanced", () => {
	it("closed at first; opened, the background and the emphasis inks show, and an empty ink reads 'same as text'", async () => {
		hangFetches();
		const host = await mount(<AppearanceSection appearance={undefined} onSectionChange={() => {}} />);
		assert.equal(q(host, "input-background"), null, "closed by default");
		await open(host, "advanced-appearance");
		assert.equal(q(host, "input-background")!.getAttribute("placeholder"), "#141414");
		assert.equal(q(host, "input-bold-color")!.getAttribute("placeholder"), "same as text");
		assert.equal(q(host, "input-italic-color")!.getAttribute("placeholder"), "same as text");
		assert.equal((host.textContent!.match(/Empty = same as text/g) ?? []).length, 2, "bold + italic rows");
	});

	it("a set background shows in its input; the hint still names the factory colour", async () => {
		hangFetches();
		const host = await mount(<AppearanceSection appearance={{ background: "#1a1a2e" }} onSectionChange={() => {}} />);
		await open(host, "advanced-appearance");
		assert.equal(q(host, "input-background")!.getAttribute("value"), "#1a1a2e");
		assert.ok(q(host, "row-background")!.textContent!.includes("Empty = #141414"), "a set colour is not the default");
	});
});
