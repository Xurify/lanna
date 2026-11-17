import React, { act } from "react";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { MilestoneForm } from "../components/milestones/milestone-form.tsx";
import type { MilestonesReport } from "../src/core/milestones.ts";

const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, {
	React,
	IS_REACT_ACT_ENVIRONMENT: true,
	window: dom.window,
	document: dom.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
});
const { createRoot } = await import("react-dom/client");
const roots: { root: Root; host: HTMLElement }[] = [];
const originalFetch = globalThis.fetch;
afterEach(async () => {
	globalThis.fetch = originalFetch;
	for (const { root, host } of roots.splice(0)) {
		await act(async () => root.unmount());
		host.remove();
	}
});
async function mount(modelReady = true) {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push({ root, host });
	const added: unknown[] = [];
	await act(async () =>
		root.render(<MilestoneForm modelReady={modelReady} today="2026-11-17" onAdded={(...args) => added.push(args)} />),
	);
	return { host, added };
}
const q = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
async function click(element: HTMLElement) {
	await act(async () => element.click());
}
async function type(host: HTMLElement, value: string) {
	const input = q(host, "milestone-input") as HTMLInputElement;
	// linkedom fires no event React's change plugin accepts for text inputs, so the test calls the handler React attached.
	const propsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"))!;
	const props = (input as unknown as Record<string, { onChange: (event: { target: { value: string } }) => void }>)[
		propsKey
	]!;
	await act(async () => props.onChange({ target: { value } }));
}
async function submit(host: HTMLElement) {
	await act(async () => {
		host.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
	});
}

test("one form explains estimates and reveals target-date behavior only when requested", async () => {
	const { host } = await mount();
	assert.equal(host.querySelectorAll("form").length, 1);
	assert.equal(host.querySelector('[data-testid="date-picker"]'), null);
	assert.match(host.textContent!, /No deadline needed/);
	await click(q(host, "milestone-target-toggle"));
	assert.equal(q(host, "milestone-target-toggle").getAttribute("aria-expanded"), "true");
	assert.ok(q(host, "date-picker"));
	assert.match(host.textContent!, /record how it went/);
	assert.match(host.textContent!, /a goal, not a promise/);
	assert.ok(q(host, "milestone-submit").hasAttribute("disabled"));
	await click(q(host, "date-choice-1m"));
	await click(q(host, "milestone-target-toggle"));
	assert.equal(host.querySelector('[data-testid="date-picker"]'), null);
});

test("without AI, the form explains why adding is unavailable", async () => {
	const { host } = await mount(false);
	assert.ok(q(host, "milestone-input").hasAttribute("disabled"));
	assert.ok(q(host, "milestone-submit").hasAttribute("disabled"));
	assert.match(host.textContent!, /Turn on AI in Settings/);
});

test("undated and dated submissions use the existing routes and clear the successful form", async () => {
	const calls: { url: string; body: unknown }[] = [];
	globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
		calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
		return Response.json({ id: "custom-test", report: {} as MilestonesReport });
	}) as typeof fetch;
	const { host, added } = await mount();
	await type(host, "follow phone calls");
	await submit(host);
	assert.equal(calls.length, 1);
	assert.match(calls[0]!.url, /\/api\/milestones\?tz=/);
	assert.deepEqual(calls[0]!.body, { text: "follow phone calls" });
	assert.equal((q(host, "milestone-input") as HTMLInputElement).value, "");
	await type(host, "lunch with friends");
	await click(q(host, "milestone-target-toggle"));
	await submit(host);
	assert.equal(calls.length, 1, "a target requires a date");
	await click(q(host, "date-choice-1m"));
	await submit(host);
	assert.match(calls[1]!.url, /\/api\/milestones\/dated\?tz=/);
	assert.deepEqual(calls[1]!.body, { text: "lunch with friends", date: "2026-12-17" });
	assert.equal(added.length, 2);
	assert.equal(host.querySelector('[data-testid="date-picker"]'), null);
});

test("a failed save keeps the learner's text and target date for a retry", async () => {
	globalThis.fetch = (async () => Response.json({ message: "Try again." }, { status: 422 })) as typeof fetch;
	const { host, added } = await mount();
	await type(host, "lunch with friends");
	await click(q(host, "milestone-target-toggle"));
	await click(q(host, "date-choice-1m"));
	await submit(host);
	assert.equal(added.length, 0);
	assert.match(host.querySelector('[role="alert"]')!.textContent!, /Try again/);
	assert.equal((q(host, "milestone-input") as HTMLInputElement).value, "lunch with friends");
	assert.match(q(host, "date-words").textContent!, /December 17/);
});
