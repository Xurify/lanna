"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CodeIcon, CopyIcon, DownloadIcon, FileTextIcon, PrinterIcon } from "lucide-react";
import {
	copyTextToClipboard,
	chatClozeSentences,
	exportChatClozemasterTsv,
	exportChatJson,
	exportChatMarkdown,
	slugifyTitle,
	triggerFileDownload,
	type LannaMessage,
	type LannaViewMessage,
} from "@/src/core";
import { MenuShell } from "@/components/menu-shell";
import { Hint } from "@/components/ui/hint";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { cn } from "@/lib/utils";

function ClozemasterIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor" className={className} aria-hidden="true">
			<path fillRule="evenodd" d="M0 0h4v2h2v2h2V2h2V0h4v14h-4v-4H4v4H0V0Zm4 8h2v2H4V8Zm4 0h2v2H8V8Z" />
		</svg>
	);
}

export interface ChatExportMenuProps {
	chatId: string;
	title: string;
	messages: readonly LannaViewMessage[];
	nativeMessages?: readonly LannaMessage[];
	plain?: boolean;
}

type CopyState = "idle" | "copied" | "failed";

const COPY_LABEL: Record<"idle" | "copied" | "failed", string> = {
	idle: "Copy as Markdown",
	copied: "Copied to clipboard",
	failed: "Could not copy",
};

function ExportItem({
	icon,
	label,
	detail,
	disabled,
	testid,
	onSelect,
}: {
	icon: ReactNode;
	label: string;
	detail?: string;
	disabled?: boolean;
	testid: string;
	onSelect: (e: React.MouseEvent) => void;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			data-testid={testid}
			disabled={disabled}
			onClick={onSelect}
			className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent disabled:text-ink-3 disabled:hover:bg-transparent"
		>
			<span className="flex size-4 shrink-0 items-center justify-center text-ink-3" aria-hidden="true">
				{icon}
			</span>
			<span className="flex-1 font-medium">{label}</span>
			{detail ? <span className="shrink-0 text-ink-3 tabular-nums">{detail}</span> : null}
		</button>
	);
}

export function ChatExportMenu({ chatId, title, messages, nativeMessages, plain }: ChatExportMenuProps) {
	const [open, setOpen] = useState(false);
	const [copy, setCopy] = useState<CopyState>("idle");
	const triggerRef = useRef<HTMLButtonElement>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const sourceMessages = useMemo(
		() => (nativeMessages && nativeMessages.length > 0 ? nativeMessages : messages),
		[nativeMessages, messages],
	);
	const slug = useMemo(() => slugifyTitle(title), [title]);
	const sentenceCount = useMemo(() => chatClozeSentences(sourceMessages).length, [sourceMessages]);

	useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target;
			if (!(target instanceof Element)) return;
			if (target.closest("[data-lanna-menu]") || triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const showCopy = (state: CopyState) => {
		setCopy(state);
		clearTimeout(copyTimeoutRef.current);
		copyTimeoutRef.current = setTimeout(() => setCopy("idle"), 2000);
	};

	const copyMarkdown = async (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		const ok = await copyTextToClipboard(exportChatMarkdown(sourceMessages, { title, chatId }));
		showCopy(ok ? "copied" : "failed");
	};

	const download = (e: React.MouseEvent, filename: string, content: string, mimeType: string) => {
		blurAfterPointerClick(e);
		triggerFileDownload(filename, content, mimeType);
		setOpen(false);
	};

	const print = (e: React.MouseEvent) => {
		blurAfterPointerClick(e);
		setOpen(false);
		// The print dialog blocks painting, so let the menu close first.
		setTimeout(() => window.print(), 100);
	};

	return (
		<div className="relative">
			<Hint label="Export this chat" side="bottom">
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
						"lanna-no-drag flex shrink-0 items-center gap-1.5 text-xs font-semibold transition-colors",
						plain
							? cn(
									"h-8 rounded-lg px-2.5",
									open ? "bg-well text-foreground" : "text-ink-3 hover:bg-well hover:text-foreground",
								)
							: cn(
									"rounded-full border px-2 py-0.5",
									open
										? "border-border bg-accent text-foreground"
										: "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
								),
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
					menuClass="flex w-72 flex-col gap-0.5 rounded-xl border border-border/80 bg-card p-1.5 text-xs shadow-xl"
				>
					<div role="menu" aria-label="Export this chat" className="flex flex-col gap-0.5">
						<ExportItem
							testid="export-copy-markdown"
							icon={
								copy === "copied" ? (
									<CheckIcon className="size-3.5 shrink-0 text-teal" aria-hidden />
								) : (
									<CopyIcon className="size-3.5 shrink-0" aria-hidden />
								)
							}
							label={COPY_LABEL[copy]}
							onSelect={copyMarkdown}
						/>
						<ExportItem
							testid="export-download-markdown"
							icon={<FileTextIcon className="size-3.5 shrink-0" aria-hidden />}
							label="Download as Markdown"
							detail=".md"
							onSelect={(e) =>
								download(
									e,
									`${slug}.md`,
									exportChatMarkdown(sourceMessages, { title, chatId }),
									"text/markdown;charset=utf-8",
								)
							}
						/>
						<ExportItem
							testid="export-download-clozemaster"
							icon={<ClozemasterIcon className="size-3.5 shrink-0" aria-hidden />}
							label="Export to Clozemaster"
							detail={
								sentenceCount === 0 ? "none yet" : sentenceCount === 1 ? "1 sentence" : `${sentenceCount} sentences`
							}
							disabled={sentenceCount === 0}
							onSelect={(e) =>
								download(
									e,
									`${slug}-clozemaster.tsv`,
									exportChatClozemasterTsv(sourceMessages),
									"text/tab-separated-values;charset=utf-8",
								)
							}
						/>
						<ExportItem
							testid="export-print-pdf"
							icon={<PrinterIcon className="size-3.5 shrink-0" aria-hidden />}
							label="Print or save as PDF"
							detail="PDF"
							onSelect={print}
						/>
						<div role="separator" className="mx-2.5 my-1 h-px bg-border" />
						<ExportItem
							testid="export-download-json"
							icon={<CodeIcon className="size-3.5 shrink-0" aria-hidden />}
							label="Full session data"
							detail=".json"
							onSelect={(e) =>
								download(
									e,
									`${slug}-session.json`,
									exportChatJson(chatId, title, sourceMessages),
									"application/json;charset=utf-8",
								)
							}
						/>
					</div>
					<span role="status" className="sr-only">
						{copy === "idle" ? "" : copy === "copied" ? "Copied the chat as Markdown" : "Could not copy the chat"}
					</span>
				</MenuShell>
			)}
		</div>
	);
}
