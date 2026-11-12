import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListenInLanguage } from "../components/experiment/listen-in-language.tsx";

const russian = { id: "russian", name: "Russian", code: "RU", tag: "ru-RU" };

describe("the Study page's Listen button", () => {
	it("is a plain link when the app already runs the study language", () => {
		const html = renderToStaticMarkup(
			<ListenInLanguage language={russian} running="russian" className="btn">
				Start Russian Listen
			</ListenInLanguage>,
		);
		assert.match(html, /<a [^>]*href="\/listen"/);
		assert.doesNotMatch(html, /<button/);
	});

	it("switches the language first when the app runs another one", () => {
		const html = renderToStaticMarkup(
			<ListenInLanguage language={russian} running="slovak" className="btn">
				Start Russian Listen
			</ListenInLanguage>,
		);
		assert.match(html, /<button type="button"/, "a plain link would open Listen in Slovak");
		assert.doesNotMatch(html, /href="\/listen"/);
	});
});
