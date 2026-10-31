/** Languages-you-know picker: level storage and defaults. */
import React, { act, useState } from "react";
(globalThis as Record<string, unknown>).React = React;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { LanguagePicker } from "../components/onboarding/controls.tsx";
import type { Lang, LangLevel } from "../src/core/index.ts";

const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, { window: dom.window, document: dom.document, CustomEvent: dom.window.CustomEvent });
const roots: { root: Root; host: HTMLElement }[] = [];
const q = (host: ParentNode, id: string) => host.querySelector<HTMLElement>(`[data-testid='${id}']`);
type Levels = Partial<Record<Lang, LangLevel>>;

/** The picker with a record of every change it asks for; its props never move. */
function recorded(value: Lang[], levels: Levels) {
	const calls: [Lang[], Levels][] = [];
	const element = <LanguagePicker value={value} levels={levels} onChange={(langs, next) => calls.push([langs, next])} />;
	return { element, calls };
}

/** The picker with its own state, so a pressed level shows what was stored. */
function Stateful({ initial, initialLevels }: { initial: Lang[]; initialLevels: Levels }) {
	const [value, setValue] = useState<Lang[]>(initial);
	const [levels, setLevels] = useState<Levels>(initialLevels);
	return (
		<LanguagePicker
			value={value}
			levels={levels}
			onChange={(langs, next) => {
				setValue(langs);
				setLevels(next);
			}}
		/>
	);
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

async function click(element: HTMLElement | null) {
	assert.ok(element, "missing click target");
	await act(async () => {
		element.click();
	});
}

function pressed(host: ParentNode, id: string) {
	return q(host, id)!.getAttribute("aria-pressed");
}

afterEach(async () => {
	for (const { root, host } of roots.splice(0)) {
		await act(async () => {
			root.unmount();
		});
		host.remove();
	}
});

describe("Languages you know: a language you add", () => {
	it("starts at A2 and shows A2 pressed, not B2", async () => {
		const host = await mount(<Stateful initial={["et"]} initialLevels={{ et: "native" }} />);
		await click(q(host, "languages-sv"));
		assert.equal(pressed(host, "level-sv-A2"), "true");
		assert.equal(pressed(host, "level-sv-B2"), "false");
	});

	it("stores A2 for the new language and leaves the others as they were", async () => {
		const { element, calls } = recorded(["et", "de"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "languages-sv"));
		assert.deepEqual(calls.at(-1), [["et", "de", "sv"], { et: "native", sv: "A2" }]);
	});

	it("a language with no level saved still reads B2", async () => {
		const host = await mount(<Stateful initial={["et", "de"]} initialLevels={{ et: "native" }} />);
		assert.equal(pressed(host, "level-de-B2"), "true");
	});

	it("the More languages panel stores A2 for what it adds", async () => {
		const { element, calls } = recorded(["et"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "languages-more"));
		await click(q(host, "languages-pick-sr"));
		await click(q(host, "languages-done"));
		assert.deepEqual(calls.at(-1), [["et", "sr"], { et: "native", sr: "A2" }]);
	});

	it("pressing a level stores that level", async () => {
		const { element, calls } = recorded(["et", "de"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "level-de-C1"));
		assert.deepEqual(calls.at(-1), [["et", "de"], { et: "native", de: "C1" }]);
	});

	it("removing a language drops its level with it", async () => {
		const { element, calls } = recorded(["et", "sv"], { et: "native", sv: "C1" });
		const host = await mount(element);
		await click(host.querySelector<HTMLElement>("[aria-label='Remove Swedish']"));
		assert.deepEqual(calls.at(-1), [["et"], { et: "native" }]);
	});
});
