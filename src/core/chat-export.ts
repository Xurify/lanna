/**
 * Chat export utilities: Markdown, Clozemaster sentence file, JSON, and print helpers.
 * Pure core: browser-safe, no fs, no network.
 */

import type { LhMessage } from "./native-messages.ts";
import type { LhViewMessage } from "./view.ts";
import type { QuestionAnswerData } from "./question-core.ts";
import { userFacingTextOf } from "./native-messages.ts";
import { QUESTION_TOOLS } from "./pending.ts";
import { boardPhrases } from "./chat-board.ts";

type ExportMessage = LhViewMessage | LhMessage;
type Speaker = "Learner" | "Tutor";

export interface ClozeSentence {
	sentence: string;
	translation: string;
	cloze: string;
}

export interface ChatExportOptions {
	title?: string;
	chatId?: string;
	exportedAt?: string;
}

export function slugifyTitle(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "chat";
}

function extractMessageText(message: ExportMessage): string {
	if ("parts" in message && Array.isArray(message.parts)) {
		const texts = message.parts
			.filter((p) => p.type === "text" && typeof p.text === "string" && p.text.trim())
			.map((p) => (p as { type: "text"; text: string }).text.trim());
		return texts.join("\n\n");
	}
	if ("content" in message) {
		const texts = userFacingTextOf((message as { content: unknown }).content);
		return texts.map((t) => t.trim()).filter(Boolean).join("\n\n");
	}
	return "";
}

const SAY_SPAN = /`say:\s*([^`]+?)\s*`/g;
const APP_LINK = /(?<!!)\[([^\]\n]+)\]\(\/[^)\s]*\)/g;
const FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{1,6})(?=\s)/;
const BLOCK_LINE = /^\s*(?:#{1,6}\s|>|\||[-*+]\s|\d+[.)]\s|-{3,}\s*$|$)/;
const SPEAKER_HEADING = "##";

function proseLines(text: string): { line: string; prose: boolean }[] {
	let fenced = false;
	return text.split("\n").map((line) => {
		const fence = FENCE.test(line);
		if (fence) fenced = !fenced;
		return { line, prose: !fence && !fenced };
	});
}

function portableMarkdown(text: string): string {
	const lines = proseLines(text);
	const headingLevels = lines.flatMap(({ line, prose }) => {
		const heading = prose ? HEADING.exec(line) : null;
		return heading ? [heading[1]!.length] : [];
	});
	const demoteBy = headingLevels.length > 0 ? Math.max(0, SPEAKER_HEADING.length + 1 - Math.min(...headingLevels)) : 0;
	const isParagraphLine = (at: number) => {
		const entry = lines[at];
		return entry !== undefined && entry.prose && !BLOCK_LINE.test(entry.line);
	};

	return lines
		.map(({ line, prose }, at) => {
			if (!prose) return line;
			const readable = line.replace(SAY_SPAN, "**$1**").replace(APP_LINK, "$1");
			const heading = HEADING.exec(readable);
			if (heading) return "#".repeat(Math.min(6, heading[1]!.length + demoteBy)) + readable.slice(heading[1]!.length);
			// CommonMark joins consecutive lines into one; two trailing spaces are its hard line break.
			return isParagraphLine(at) && isParagraphLine(at + 1) ? `${readable.trimEnd()}  ` : readable;
		})
		.join("\n");
}

function svgFence(svg: unknown): string {
	return typeof svg === "string" && svg.trim() ? ["```svg", svg.trim(), "```"].join("\n") : "";
}

function answeredQuestion(toolName: string | undefined, details: unknown): QuestionAnswerData | null {
	if (!(QUESTION_TOOLS as readonly string[]).includes(toolName ?? "")) return null;
	const answer = details as Partial<QuestionAnswerData> | null | undefined;
	return typeof answer?.questionText === "string" && Array.isArray(answer.answers) ? (answer as QuestionAnswerData) : null;
}

function questionMarkdown(question: QuestionAnswerData): string {
	const options = (question.options ?? []).map((option) => `- ${option.label}${question.correctIndices?.includes(option.index) ? " (correct)" : ""}`);
	return [question.questionText.trim(), ...(options.length > 0 ? ["", ...options] : [])].join("\n");
}

function answerMarkdown(question: QuestionAnswerData): string {
	if (question.dismissed) return "*Skipped.*";
	if (question.dontKnow) return "*I don't know.*";
	return [question.text, ...question.answers.map((answer) => answer.label), question.other]
		.map((given) => given?.trim())
		.filter(Boolean)
		.join(", ");
}

export function exportChatMarkdown(messages: ReadonlyArray<ExportMessage>, opts: ChatExportOptions = {}): string {
	const title = opts.title?.trim() || "Chat";
	const date = opts.exportedAt || new Date().toISOString().slice(0, 10);
	const blocks: string[] = [`# ${title}`, `*Exported from LangHarness · ${date}*`, "---"];

	let speaking: Speaker | null = null;
	const say = (speaker: Speaker, body: string) => {
		if (!body.trim()) return;
		blocks.push(speaker === speaking ? body : `${SPEAKER_HEADING} ${speaker}\n\n${body}`);
		speaking = speaker;
	};
	const sayQuestion = (toolName: string | undefined, details: unknown) => {
		const question = answeredQuestion(toolName, details);
		if (!question) return;
		say("Tutor", portableMarkdown(questionMarkdown(question)));
		say("Learner", portableMarkdown(answerMarkdown(question)));
	};

	for (const message of messages) {
		if (message.role === "user") {
			say("Learner", portableMarkdown(extractMessageText(message)));
		} else if (message.role === "assistant") {
			say("Tutor", portableMarkdown(extractMessageText(message)));
			if (!("parts" in message) || !Array.isArray(message.parts)) continue;
			for (const part of message.parts) {
				if (part.type === "tool-draw") say("Tutor", svgFence((part.output as { svg?: unknown } | undefined)?.svg));
				else sayQuestion(part.type.replace(/^tool-/, ""), part.output);
			}
		} else if (message.role === "toolResult") {
			const result = message as { toolName?: string; isError?: boolean; details?: unknown };
			if (result.isError) continue;
			if (result.toolName === "draw") say("Tutor", svgFence((result.details as { svg?: unknown } | undefined)?.svg));
			else sayQuestion(result.toolName, result.details);
		}
	}

	return blocks.join("\n\n") + "\n";
}

const REVIEW_TOOL = "add_to_review";
const WORD_EDGES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const SENTENCE_END = /[.!?…]$/;

function wordsOf(sentence: string): string[] {
	return sentence
		.split(/\s+/)
		.map((word) => word.replace(WORD_EDGES, ""))
		.filter(Boolean);
}

function wordsSentToReview(messages: ReadonlyArray<ExportMessage>): Set<string> {
	const sent = new Set<string>();
	const keep = (input: unknown) => {
		const words = (input as { words?: unknown } | null | undefined)?.words;
		if (!Array.isArray(words)) return;
		for (const entry of words) {
			const single = typeof entry === "string" ? wordsOf(entry) : [];
			if (single.length === 1) sent.add(single[0]!.toLowerCase());
		}
	};
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		if ("parts" in message && Array.isArray(message.parts)) {
			for (const part of message.parts) if (part.type === `tool-${REVIEW_TOOL}`) keep(part.input);
		} else if ("content" in message && Array.isArray(message.content)) {
			for (const block of message.content as { type?: string; name?: string; arguments?: unknown }[]) {
				if (block.type === "toolCall" && block.name === REVIEW_TOOL) keep(block.arguments);
			}
		}
	}
	return sent;
}

function fold(text: string): string {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function prefixLength(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	return i;
}

function stemsMatch(wordFold: string, taughtFold: string): boolean {
	if (wordFold === taughtFold) return true;
	const prefix = prefixLength(wordFold, taughtFold);
	if (prefix < 3) return false;
	if (Math.abs(wordFold.length - taughtFold.length) > 3) return false;
	return prefix >= Math.min(wordFold.length, taughtFold.length) - 1;
}

function longestWord(words: readonly string[]): string | null {
	let best: string | null = null;
	for (const word of words) {
		if (best === null || word.length > best.length) best = word;
	}
	return best;
}

export function pickClozeWord(words: readonly string[], taught: ReadonlySet<string>): string | null {
	if (words.length === 0) return null;
	const exact = words.find((word) => taught.has(word.toLowerCase()));
	if (exact) return exact;

	if (taught.size > 0) {
		const foldedTaught = Array.from(taught, fold);
		for (const word of words) {
			const wFold = fold(word);
			if (foldedTaught.some((tFold) => stemsMatch(wFold, tFold))) {
				return word;
			}
		}
		return null;
	}

	return longestWord(words);
}

export function chatClozeSentences(messages: ReadonlyArray<ExportMessage>): ClozeSentence[] {
	const replies = messages
		.filter((message) => message.role === "assistant")
		.map(extractMessageText)
		.filter(Boolean);
	const taught = wordsSentToReview(messages);
	const sentences: ClozeSentence[] = [];
	for (const { phrase, meaning } of boardPhrases(replies)) {
		const words = wordsOf(phrase);
		if (words.length < 2) continue;
		const cloze = pickClozeWord(words, taught);
		if (cloze === null || !words.includes(cloze)) continue;
		const translation = SENTENCE_END.test(phrase) && !SENTENCE_END.test(meaning) ? `${meaning}.` : meaning;
		sentences.push({ sentence: phrase, translation, cloze });
	}
	return sentences;
}

// Clozemaster's collection upload reads tab-separated Sentence, Translation, Cloze: no header row, no {{braces}}
// (those are for typing a sentence in by hand), and users report that a line break after the last row fails the upload.
// https://forum.clozemaster.com/t/how-to-load-new-custom-lists-easily/59104
// https://forum.clozemaster.com/t/how-i-solved-my-problem-importing-sentences-in-csv-format/35169
export function exportChatClozemasterTsv(messages: ReadonlyArray<ExportMessage>): string {
	const cell = (text: string) => text.replace(/\s+/g, " ").trim();
	return chatClozeSentences(messages)
		.map(({ sentence, translation, cloze }) => [sentence, translation, cloze].map(cell).join("\t"))
		.join("\n");
}

export function exportChatJson(
	chatId: string,
	title: string,
	messages: ReadonlyArray<ExportMessage>,
	extra?: Record<string, unknown>,
): string {
	const payload = {
		version: 1,
		format: "langharness-chat-export",
		chatId,
		title: title.trim() || "Chat",
		exportedAt: new Date().toISOString(),
		messageCount: messages.length,
		messages,
		...extra,
	};
	return JSON.stringify(payload, null, 2);
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
	if (typeof window === "undefined" || typeof document === "undefined") return;
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof window === "undefined" || typeof navigator === "undefined") return false;
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Browsers reject clipboard.writeText without focus or permission; execCommand below still works there.
	}
	try {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.position = "fixed";
		textArea.style.opacity = "0";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		const success = document.execCommand("copy");
		document.body.removeChild(textArea);
		return success;
	} catch {
		return false;
	}
}
