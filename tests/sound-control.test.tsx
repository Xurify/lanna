import React, { act } from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { SoundControl } from "../components/sound-control.tsx";

(globalThis as Record<string, unknown>).React = React;
const dom = parseHTML("<html><body></body></html>");
Object.assign(dom.window, { setTimeout, clearTimeout });
Object.assign(globalThis, { window: dom.window, document: dom.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });

const HOVER_WAIT_MS = 750;
const CLOSE_WAIT_MS = 600;

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

function fire(target: Element, type: string, init: Record<string, unknown> = {}) {
	const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, init);
	target.dispatchEvent(event);
}

function mount() {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	return { host, root };
}

const popoverIn = (host: HTMLElement) => host.querySelector('[data-testid="volume-popover"]');

test("focus leaving the volume popover keeps it open while the pointer is still on it", async () => {
	const { host, root } = mount();
	try {
		await act(async () => root.render(<SoundControl />));
		const button = host.querySelector('[data-testid="sound-toggle"]')!;
		const slider = host.querySelector('[data-testid="volume-slider"]');
		assert.equal(slider, null);

		await act(async () => fire(button, "pointerover", { pointerType: "mouse", relatedTarget: null }));
		await wait(HOVER_WAIT_MS);
		const opened = popoverIn(host);
		assert.ok(opened, "resting on the speaker opens the popover");

		await act(async () => fire(opened.querySelector('[data-testid="volume-slider"]')!, "focusout", { relatedTarget: null }));
		await wait(CLOSE_WAIT_MS);
		assert.ok(popoverIn(host), "focus leaving while the pointer is on the popover does not close it");

		await act(async () => fire(button, "pointerout", { pointerType: "mouse", relatedTarget: document.body }));
		await wait(CLOSE_WAIT_MS);
		assert.equal(popoverIn(host), null, "the popover closes once the pointer leaves");
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});

test("focus leaving the volume control closes the popover when the pointer is not on it", async () => {
	const { host, root } = mount();
	try {
		await act(async () => root.render(<SoundControl />));
		const button = host.querySelector('[data-testid="sound-toggle"]')!;

		await act(async () => fire(button, "keydown", { key: "ArrowUp" }));
		assert.ok(popoverIn(host), "ArrowUp opens the popover");

		await act(async () => fire(button, "focusout", { relatedTarget: null }));
		await wait(CLOSE_WAIT_MS);
		assert.equal(popoverIn(host), null);
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
