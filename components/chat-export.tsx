"use client";

import { useMemo, useRef, useState } from "react";
import { CheckIcon, CodeIcon, CopyIcon, DownloadIcon, FileTextIcon, LayersIcon, PrinterIcon } from "lucide-react";
import {
	copyTextToClipboard,
	exportChatAnkiTsv,
	exportChatJson,
	exportChatMarkdown,
	extractChatAnkiCards,
	slugifyTitle,
	triggerFileDownload,
	type LhMessage,
	type LhViewMessage,
} from "@/src/core";
import { MenuShell } from "@/components/menu-shell";
import { Hint } from "@/components/ui/hint";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { cn } from "@/lib/utils";

export interface ChatExportMenuProps {
	chatId: string;
	title: string;
	messages: readonly LhViewMessage[];
	nativeMessages?: readonly LhMessage[];
}

export function ChatExportMenu({ chatId, title, messages, nativeMessages }: ChatExportMenuProps) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	// The source of truth for export: use native messages if available, fallback to view messages
	const sourceMessages = useMemo(() => {
		if (nativeMessages && nativeMessages.length > 0) return nativeMessages;
		return messages;
	}, [nativeMessages, messages]);

	const slug = useMemo(() => slugifyTitle(title), [title]);
	const ankiCards = useMemo(() => extractChatAnkiCards(sourceMessages, { title }), [sourceMessages, title]);

	const handleCopyMarkdown = async (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		const md = exportChatMarkdown(sourceMessages, { title, chatId });
		const ok = await copyTextToClipboard(md);
		if (ok) {
			setCopied(true);
			if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
			copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleDownloadMarkdown = (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		const md = exportChatMarkdown(sourceMessages, { title, chatId });
		triggerFileDownload(`${slug}.md`, md, "text/markdown;charset=utf-8");
		setOpen(false);
	};

	const handleDownloadAnki = (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		const tsv = exportChatAnkiTsv(sourceMessages, { title });
		triggerFileDownload(`${slug}-anki.tsv`, tsv, "text/tab-separated-values;charset=utf-8");
		setOpen(false);
	};

	const handleDownloadJson = (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		const json = exportChatJson(chatId, title, sourceMessages);
		triggerFileDownload(`${slug}-session.json`, json, "application/json;charset=utf-8");
		setOpen(false);
	};

	const handlePrint = (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		setOpen(false);
		if (typeof window !== "undefined") {
			// Allow menu close DOM updates to paint before invoking native print modal
			setTimeout(() => {
				window.print();
			}, 100);
		}
	};

	return (
		<div className="relative">
			<Hint label="Export chat (Markdown, Anki, PDF, JSON)" side="bottom">
				<button
					ref={triggerRef}
					type="button"
					data-testid="export-chat-trigger"
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={(e) => {
						blurAfterPointerClick(e);
						setOpen((v) => !v);
					}}
					className={cn(
						"lh-no-drag flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors",
						open
							? "border-border bg-accent text-foreground"
							: "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
					)}
				>
					<DownloadIcon className="size-3.5" aria-hidden />
					Export
				</button>
			</Hint>

			{open && (
				<MenuShell
					anchorRef={triggerRef}
					testid="export-chat-menu"
					preferredSide="down"
					align="right"
					menuClass="flex w-60 flex-col gap-0.5 rounded-xl border border-border/80 bg-card p-1.5 text-xs shadow-xl"
				>
					<div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						Export Chat
					</div>

					<button
						type="button"
						data-testid="export-copy-markdown"
						onClick={handleCopyMarkdown}
						className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent"
					>
						<span className="flex items-center gap-2">
							{copied ? (
								<CheckIcon className="size-3.5 text-teal" aria-hidden />
							) : (
								<CopyIcon className="size-3.5 text-muted-foreground" aria-hidden />
							)}
							<span>{copied ? "Copied to clipboard!" : "Copy as Markdown"}</span>
						</span>
						<span className="text-[10px] text-muted-foreground">.md</span>
					</button>

					<button
						type="button"
						data-testid="export-download-markdown"
						onClick={handleDownloadMarkdown}
						className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent"
					>
						<span className="flex items-center gap-2">
							<FileTextIcon className="size-3.5 text-muted-foreground" aria-hidden />
							<span>Markdown file</span>
						</span>
						<span className="text-[10px] text-muted-foreground">.md</span>
					</button>

					<button
						type="button"
						data-testid="export-download-anki"
						onClick={handleDownloadAnki}
						className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent"
					>
						<span className="flex items-center gap-2">
							<LayersIcon className="size-3.5 text-muted-foreground" aria-hidden />
							<span>Anki deck</span>
						</span>
						<span className="text-[10px] text-muted-foreground">
							{ankiCards.length > 0 ? `${ankiCards.length} cards` : ".tsv"}
						</span>
					</button>

					<button
						type="button"
						data-testid="export-print-pdf"
						onClick={handlePrint}
						className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent"
					>
						<span className="flex items-center gap-2">
							<PrinterIcon className="size-3.5 text-muted-foreground" aria-hidden />
							<span>Print / Save as PDF</span>
						</span>
						<span className="text-[10px] text-muted-foreground">PDF</span>
					</button>

					<button
						type="button"
						data-testid="export-download-json"
						onClick={handleDownloadJson}
						className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent"
					>
						<span className="flex items-center gap-2">
							<CodeIcon className="size-3.5 text-muted-foreground" aria-hidden />
							<span>Raw session data</span>
						</span>
						<span className="text-[10px] text-muted-foreground">.json</span>
					</button>
				</MenuShell>
			)}
		</div>
	);
}
