"use client";

import { useRef, useState } from "react";
import { FileTextIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { Hint } from "@/components/ui/hint";
import type { AttachedPdf } from "@/src/core";
import { cn } from "@/lib/utils";

export function ChatPdfButton({ onAttached, compact = false }: { onAttached: (pdf: AttachedPdf) => void; compact?: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const [state, setState] = useState<"idle" | "saving">("idle");
	const [error, setError] = useState<string | null>(null);

	async function upload(file: File) {
		setState("saving");
		setError(null);
		try {
			const body = new FormData();
			body.append("file", file);
			const res = await fetch("/api/learner-pdfs", { method: "POST", body });
			const data = (await res.json().catch(() => ({}))) as Partial<AttachedPdf> & { message?: string };
			if (!res.ok || !data.path) throw new Error(data.message ?? "The PDF could not be added.");
			onAttached({ path: data.path, name: data.name ?? file.name, pages: data.pages ?? 0 });
		} catch (err) {
			setError(err instanceof Error ? err.message : "The PDF could not be added.");
		} finally {
			setState("idle");
		}
	}

	return (
		<>
		<Hint label={error ?? "Add a PDF for the tutor to read"} side="top">
			<button
				type="button"
				data-testid="chat-pdf-button"
				aria-label={error ? `Adding the PDF failed: ${error}` : "Add a PDF"}
				disabled={state === "saving"}
				onClick={() => input.current?.click()}
				className={cn(
					"flex h-8 shrink-0 items-center justify-center gap-1 rounded-full font-ui text-xs font-medium text-ink-3 transition-colors hover:bg-well hover:text-foreground disabled:opacity-60 data-[error=true]:text-miss",
					compact ? "w-8" : "px-2",
				)}
				data-error={error ? "true" : undefined}
			>
				{state === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
				{!compact && "PDF"}
			</button>
		</Hint>
			<input
				ref={input}
				type="file"
				accept="application/pdf,.pdf"
				className="hidden"
				tabIndex={-1}
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) void upload(file);
				}}
			/>
		</>
	);
}

export function DraftPdfChips({ pdfs, onRemove, className }: { pdfs: readonly AttachedPdf[]; onRemove: (pdf: AttachedPdf) => void; className?: string }) {
	if (pdfs.length === 0) return null;
	return (
		<ul data-testid="draft-pdfs" className={cn("flex min-w-0 flex-wrap gap-2", className)}>
			{pdfs.map((pdf) => (
				<li key={pdf.path} title={pdf.path} className="flex max-w-full min-w-0 items-center gap-1.5 rounded-md bg-well py-1 pr-1 pl-2.5 font-ui text-[13px] text-ink-2">
					<FileTextIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
					<span className="truncate">{pdf.name}</span>
					<span className="shrink-0 text-ink-3">· {pdf.pages} page{pdf.pages === 1 ? "" : "s"}</span>
					<button
						type="button"
						onClick={() => onRemove(pdf)}
						aria-label={`Remove ${pdf.name}`}
						className="flex size-5 shrink-0 items-center justify-center rounded text-ink-3 transition-colors hover:bg-well-2 hover:text-foreground"
					>
						<XIcon className="size-3.5" />
					</button>
				</li>
			))}
		</ul>
	);
}
