import React, { act } from "react";
(globalThis as { React?: typeof React }).React = React;
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { AnsweredCard } from "../components/answered-card.tsx";
import { type QuestionAnswerData } from "../src/core/index.ts";

const dom = parseHTML("<html><body></body></html>");
Object.assign(globalThis, { window: dom.window, document: dom.document, Element: dom.window.Element,
	HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });

test("committed-answer reveals keep the first paragraph inline without flattening later paragraphs", async () => {
	const committed = "First paragraph.\n\nSecond paragraph with a plain sentence and a **bold** word.";
	const answer: QuestionAnswerData = { kind: "explain", questionText: "Explain the gradient.", answers: [], text: "Synthetic answer", committed, dontKnow: false, answeredAt: "2026-10-26T00:00:00.000Z" };
	const input = { question: answer.questionText, correctAnswer: committed };
	const before = structuredClone(answer);
	const host = document.createElement("div"); document.body.append(host);
	const root = createRoot(host);
	try {
		await act(async () => root.render(<AnsweredCard answer={answer} input={input} />));
		const paragraphs = host.querySelectorAll("p");
		assert.equal(paragraphs.length, 3, "question plus two committed-answer paragraphs");
		assert.ok(paragraphs[1]!.parentElement!.classList.contains("[&>p:first-child]:inline"));
		assert.ok(!paragraphs[1]!.parentElement!.classList.contains("[&_p]:inline"));
		assert.deepEqual(answer, before);
	} finally { await act(async () => root.unmount()); host.remove(); }
});
