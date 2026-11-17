import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";

test("a Button puts its text in one cap-center label beside the icon", () => {
	const html = renderToStaticMarkup(
		<Button>
			<svg />
			Delete {2} chats
		</Button>,
	);
	assert.match(html, /<svg><\/svg><span data-slot="label" class="cap-center">Delete 2 chats<\/span>/);
});

test("a Button leaves element children and asChild content alone", () => {
	assert.doesNotMatch(
		renderToStaticMarkup(
			<Button>
				<span>Kept</span>
			</Button>,
		),
		/cap-center/,
	);
	assert.doesNotMatch(
		renderToStaticMarkup(
			<Button asChild>
				<a href="https://example.com">Home</a>
			</Button>,
		),
		/cap-center/,
	);
});
