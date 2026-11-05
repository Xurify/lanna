/** Languages-you-know picker: a level is only what the learner presses. */
import React, { act, useState } from "react";
(globalThis as Record<string, unknown>).React = React;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { LanguagePicker } from "../components/onboarding/controls.tsx";
import type { Lang, LangLevel } from "../src/core/index.ts";

// The More languages panel is portaled (MenuShell): it lives on document.body, not in the host.
const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, {
	window: dom.window,
	document: dom.document,
	Element: dom.window.Element,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	CustomEvent: dom.window.CustomEvent,
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
});
Object.assign(dom.window, { innerWidth: 1280, innerHeight: 800 });
const rectProto = dom.window.HTMLElement.prototype as unknown as { getBoundingClientRect?: () => unknown; focus?: () => void };
rectProto.getBoundingClientRect ??= () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
rectProto.focus ??= () => {};

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

describe("Languages you know: the language being learned is not one you know", () => {
	it("leaves its row out, but it rides along on every change for the other languages", async () => {
		const calls: [Lang[], Levels][] = [];
		const host = await mount(
			<LanguagePicker value={["en", "ru", "et"]} levels={{ en: "native", ru: "A1", et: "A2" }} exclude="et" onChange={(langs, next) => calls.push([langs, next])} />,
		);
		assert.equal(q(host, "level-et"), null, "no row for the language being learned");
		assert.ok(q(host, "level-ru"), "the other languages keep their rows");
		await click(q(host, "level-ru-B1"));
		assert.deepEqual(calls.at(-1), [["en", "ru", "et"], { en: "native", ru: "B1", et: "A2" }]);
	});

	it("removing another language still keeps the one being learned", async () => {
		const calls: [Lang[], Levels][] = [];
		const host = await mount(
			<LanguagePicker value={["en", "et", "sv"]} levels={{ en: "native", et: "A2", sv: "C1" }} exclude="et" onChange={(langs, next) => calls.push([langs, next])} />,
		);
		await click(host.querySelector<HTMLElement>("[aria-label='Remove Swedish']"));
		assert.deepEqual(calls.at(-1), [["en", "et"], { en: "native", et: "A2" }]);
	});
});

describe("Languages you know: a language you add has no level until you press one", () => {
	it("shows no level pressed and asks for one", async () => {
		const host = await mount(<Stateful initial={["et"]} initialLevels={{ et: "native" }} />);
		await click(q(host, "languages-sv"));
		for (const lv of ["A1", "A2", "B1", "B2", "C1", "C2", "native"]) assert.equal(pressed(host, `level-sv-${lv}`), "false", lv);
		assert.ok(q(host, "level-sv-unset"), "the row says a level is still to pick");
	});

	it("stores no level for the new language and leaves the others as they were", async () => {
		const { element, calls } = recorded(["et", "de"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "languages-sv"));
		assert.deepEqual(calls.at(-1), [["et", "de", "sv"], { et: "native" }]);
	});

	it("a language with no level saved shows none pressed, not B2", async () => {
		const host = await mount(<Stateful initial={["et", "de"]} initialLevels={{ et: "native" }} />);
		assert.equal(pressed(host, "level-de-B2"), "false");
		assert.ok(q(host, "level-de-unset"));
	});

	it("the More languages panel adds a language without a level", async () => {
		const { element, calls } = recorded(["et"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "languages-more"));
		await click(q(document, "languages-pick-sr"));
		await click(q(document, "languages-done"));
		assert.deepEqual(calls.at(-1), [["et", "sr"], { et: "native" }]);
	});

	it("pressing a level stores that level", async () => {
		const { element, calls } = recorded(["et", "de"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "level-de-C1"));
		assert.deepEqual(calls.at(-1), [["et", "de"], { et: "native", de: "C1" }]);
	});

	it("pressing B2 stores B2, so the choice is kept", async () => {
		const { element, calls } = recorded(["et", "de"], { et: "native" });
		const host = await mount(element);
		await click(q(host, "level-de-B2"));
		assert.deepEqual(calls.at(-1), [["et", "de"], { et: "native", de: "B2" }]);
	});

	it("removing a language drops its level with it", async () => {
		const { element, calls } = recorded(["et", "sv"], { et: "native", sv: "C1" });
		const host = await mount(element);
		await click(host.querySelector<HTMLElement>("[aria-label='Remove Swedish']"));
		assert.deepEqual(calls.at(-1), [["et"], { et: "native" }]);
	});
});
