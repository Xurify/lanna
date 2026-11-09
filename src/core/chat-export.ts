/**
 * Chat export utilities: Markdown, Anki TSV flashcard deck, JSON, and print helpers.
 * Pure core: browser-safe, no fs, no network.
 */

import type { LhMessage } from "./native-messages.ts";
import type { LhViewMessage } from "./view.ts";
import { userFacingTextOf } from "./native-messages.ts";
import { boardPhrases } from "./chat-board.ts";

export interface AnkiCard {
	front: string;
	back: string;
	tags: string;
}

export interface ChatExportOptions {
	title?: string;
	chatId?: string;
	exportedAt?: string;
	tag?: string;
}

/** Converts a title to a clean filename-safe slug. */
export function slugifyTitle(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "chat";
}

/** Extracts user-facing prose text from a view or native message. */
function extractMessageText(message: LhViewMessage | LhMessage): string {
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

/** Extracts SVG drawing code from a view or native message if present. */
function extractDrawingSvg(message: LhViewMessage | LhMessage): string | null {
	if ("parts" in message && Array.isArray(message.parts)) {
		for (const part of message.parts) {
			if (part.type === "tool-draw") {
				const output = part.output as { svg?: string } | undefined;
				if (typeof output?.svg === "string" && output.svg.trim()) {
					return output.svg.trim();
				}
			}
		}
	}
	if ("role" in message && message.role === "toolResult") {
		const result = message as { toolName?: string; details?: { svg?: string } };
		if (result.toolName === "draw" && typeof result.details?.svg === "string") {
			return result.details.svg.trim();
		}
	}
	return null;
}

const SAY_SPAN = /`say:\s*([^`]+?)\s*`/g;

function withoutSayMarkup(text: string): string {
	return text.replace(SAY_SPAN, "**$1**");
}

/** Formats a chat session as clean, readable Markdown. */
export function exportChatMarkdown(
	messages: ReadonlyArray<LhViewMessage | LhMessage>,
	opts: ChatExportOptions = {},
): string {
	const title = opts.title?.trim() || "Chat";
	const date = opts.exportedAt || new Date().toISOString().slice(0, 10);
	const lines: string[] = [`# ${title}`, "", `*Exported from LangHarness · ${date}*`, "", "---", ""];

	for (const msg of messages) {
		const role = msg.role;
		if (role !== "user" && role !== "assistant") continue;

		const text = extractMessageText(msg);
		const svg = extractDrawingSvg(msg);
		if (!text && !svg) continue;

		const speaker = role === "user" ? "### Learner" : "### Tutor";
		lines.push(speaker, "");
		if (text) lines.push(withoutSayMarkup(text), "");
		if (svg) {
			lines.push("```svg", svg, "```", "");
		}
	}

	return lines.join("\n").trimEnd() + "\n";
}

/** Extracts Anki-compatible flashcards from the forms the tutor glossed in the chat. */
export function extractChatAnkiCards(
	messages: ReadonlyArray<LhViewMessage | LhMessage>,
	opts: ChatExportOptions = {},
): AnkiCard[] {
	const defaultTag = opts.tag || "langharness::chat";
	const cards: AnkiCard[] = [];
	const seen = new Set<string>();

	const replyTexts: string[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			const text = extractMessageText(msg);
			if (text) replyTexts.push(text);
		}
	}
	const phrases = boardPhrases(replyTexts);
	for (const p of phrases) {
		const front = p.phrase.trim();
		const back = p.meaning.trim();
		const key = front.toLowerCase();
		if (!front || !back || seen.has(key)) continue;
		seen.add(key);
		cards.push({
			front,
			back,
			tags: `${defaultTag}::vocab`,
		});
	}

	return cards;
}

/** Formats the chat's glossed forms as a TSV file ready for Anki import. */
export function exportChatAnkiTsv(
	messages: ReadonlyArray<LhViewMessage | LhMessage>,
	opts: ChatExportOptions = {},
): string {
	const cards = extractChatAnkiCards(messages, opts);
	const lines: string[] = [
		"#separator:tab",
		"#html:true",
		"#tags column:3",
	];

	for (const card of cards) {
		// Escape tabs and convert newlines to <br> for Anki TSV format
		const front = card.front.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
		const back = card.back.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
		const tags = card.tags.replace(/\t/g, " ");
		lines.push(`${front}\t${back}\t${tags}`);
	}

	return lines.join("\n") + "\n";
}

/** Formats a chat session as complete JSON for backup and machine ingestion. */
export function exportChatJson(
	chatId: string,
	title: string,
	messages: ReadonlyArray<LhViewMessage | LhMessage>,
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

/** Browser helper: triggers download of text content as a file. */
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

/** Browser helper: copies text to clipboard with fallback. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof window === "undefined" || typeof navigator === "undefined") return false;
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fallback for environments where clipboard write is restricted
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
