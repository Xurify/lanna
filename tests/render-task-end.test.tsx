import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EnterHint, onFocusedControl, TaskEnd, TaskFrame } from "@/components/task-frame";

function render(wide = false): string {
	return renderToStaticMarkup(
		<TaskFrame>
			<TaskEnd testId="end" wide={wide} hint={<EnterHint>for Today</EnterHint>} actions={<button type="button">Today</button>}>
				<h1>Done</h1>
			</TaskEnd>
		</TaskFrame>,
	);
}

describe("an end screen in the task frame (E77)", () => {
	it("scrolls its result in its own area and keeps the actions in the dock below it", () => {
		const html = render();
		const body = html.indexOf('data-testid="end"');
		const heading = html.indexOf("<h1>Done</h1>");
		const button = html.indexOf("<button");
		assert.ok(body > 0 && heading > body && button > heading, "result first, then the dock");
		assert.match(html, /tabindex="-1" role="region" aria-label="Your result" data-task-end="" class="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none" data-testid="end"/);
		assert.match(html, /<kbd[^>]*>Enter<\/kbd> for Today/);
	});

	it("gives the result and the dock one width, widened together on a large screen", () => {
		const narrow = render().match(/mx-auto w-full max-w-2xl px-6[^"]*/g) ?? [];
		assert.equal(narrow.length, 2);
		const wide = render(true).match(/mx-auto w-full max-w-2xl px-6 lg:max-w-5xl/g) ?? [];
		assert.equal(wide.length, 2);
	});

	it("leaves Enter to a focused button or link", () => {
		const onButton = { target: { closest: (q: string) => (q.includes("button") ? {} : null) } };
		const onPage = { target: { closest: () => null } };
		const asEvent = (x: object) => x as unknown as KeyboardEvent;
		const restore = globalThis.Element;
		(globalThis as { Element: unknown }).Element = Object;
		try {
			assert.equal(onFocusedControl(asEvent(onButton)), true);
			assert.equal(onFocusedControl(asEvent(onPage)), false);
		} finally {
			(globalThis as { Element: unknown }).Element = restore;
		}
	});
});
