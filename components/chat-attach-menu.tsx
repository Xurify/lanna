"use client";

import { useEffect, useRef, useState } from "react";
import { FileTextIcon, ImageIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { uploadLearnerImage } from "@/components/chat-image-button";
import { uploadLearnerPdf } from "@/components/chat-pdf-button";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { MenuShell } from "@/components/menu-shell";
import { Hint } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import type { AttachedImage, AttachedPdf } from "@/src/core";

export function ChatAttachMenu({
	onPdfAttached,
	onImageAttached,
	compact = false,
}: {
	onPdfAttached: (pdf: AttachedPdf) => void;
	onImageAttached: (img: AttachedImage) => void;
	compact?: boolean;
}) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const pdfInputRef = useRef<HTMLInputElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [state, setState] = useState<"idle" | "saving">("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target;
			if (!(target instanceof Element)) return;
			if (target.closest("[data-lh-menu]") || triggerRef.current?.contains(target)) return;
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

	async function handlePdf(file: File) {
		setState("saving");
		setError(null);
		try {
			const attached = await uploadLearnerPdf(file);
			onPdfAttached(attached);
		} catch (err) {
			setError(err instanceof Error ? err.message : "The PDF could not be added.");
		} finally {
			setState("idle");
		}
	}

	async function handleImage(file: File) {
		setState("saving");
		setError(null);
		try {
			const attached = await uploadLearnerImage(file);
			onImageAttached(attached);
		} catch (err) {
			setError(err instanceof Error ? err.message : "The image could not be added.");
		} finally {
			setState("idle");
		}
	}

	return (
		<>
			<Hint label={error ?? "Add a PDF or image"} side="top">
				<button
					ref={triggerRef}
					type="button"
					data-testid="chat-attach-button"
					aria-label={error ? `Adding attachment failed: ${error}` : "Add attachment"}
					aria-expanded={open}
					aria-haspopup="menu"
					disabled={state === "saving"}
					data-error={error ? "true" : undefined}
					onClick={(e) => {
						blurAfterPointerClick(e);
						setOpen((v) => !v);
					}}
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-well hover:text-foreground disabled:opacity-60 data-[error=true]:text-miss",
						!compact && "border border-border/50 bg-card shadow-raise hover:border-border",
						open && "bg-well text-foreground",
					)}
				>
					{state === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
				</button>
			</Hint>
			{open && (
				<MenuShell
					anchorRef={triggerRef}
					testid="chat-attach-menu"
					preferredSide="up"
					align="left"
					menuClass="flex w-44 flex-col gap-0.5 rounded-xl border border-border/80 bg-card p-1.5 font-ui text-xs shadow-xl"
				>
					<div role="menu" aria-label="Add attachment" className="flex flex-col gap-0.5">
						<button
							type="button"
							role="menuitem"
							data-testid="chat-image-button"
							aria-label="Add an image"
							onClick={(e) => {
								blurAfterPointerClick(e);
								setOpen(false);
								imageInputRef.current?.click();
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-well focus-visible:bg-well"
						>
							<ImageIcon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
							<span>Add image</span>
						</button>
						<button
							type="button"
							role="menuitem"
							data-testid="chat-pdf-button"
							aria-label="Add a PDF"
							onClick={(e) => {
								blurAfterPointerClick(e);
								setOpen(false);
								pdfInputRef.current?.click();
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-well focus-visible:bg-well"
						>
							<FileTextIcon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
							<span>Add PDF</span>
						</button>
					</div>
				</MenuShell>
			)}
			<input
				ref={imageInputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp"
				className="hidden"
				tabIndex={-1}
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) void handleImage(file);
				}}
			/>
			<input
				ref={pdfInputRef}
				type="file"
				accept="application/pdf,.pdf"
				className="hidden"
				tabIndex={-1}
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) void handlePdf(file);
				}}
			/>
		</>
	);
}
