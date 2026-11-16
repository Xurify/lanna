"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { ImageViewer, learnerImageSrc } from "@/components/image-viewer";
import { Hint } from "@/components/ui/hint";
import type { AttachedImage } from "@/src/core";
import { cn } from "@/lib/utils";

export async function uploadLearnerImage(file: File): Promise<AttachedImage> {
	const body = new FormData();
	body.append("file", file);
	const res = await fetch("/api/learner-images", { method: "POST", body });
	const data = (await res.json().catch(() => ({}))) as Partial<AttachedImage> & { message?: string };
	if (!res.ok || !data.path) throw new Error(data.message ?? "The image could not be added.");
	return { path: data.path, name: data.name ?? file.name };
}

export function ChatImageButton({
	onAttached,
	compact = false,
}: {
	onAttached: (img: AttachedImage) => void;
	compact?: boolean;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [state, setState] = useState<"idle" | "saving">("idle");
	const [error, setError] = useState<string | null>(null);

	async function upload(file: File) {
		setState("saving");
		setError(null);
		try {
			const attached = await uploadLearnerImage(file);
			onAttached(attached);
		} catch (err) {
			setError(err instanceof Error ? err.message : "The image could not be added.");
		} finally {
			setState("idle");
		}
	}

	return (
		<>
			<Hint label={error ?? "Add an image for the tutor to see"} side="top">
				<button
					type="button"
					data-testid="chat-image-button"
					aria-label={error ? `Adding the image failed: ${error}` : "Add an image"}
					disabled={state === "saving"}
					onClick={() => input.current?.click()}
					className={cn(
						"flex h-8 shrink-0 items-center justify-center gap-1 rounded-full font-ui text-xs font-medium text-ink-3 transition-colors hover:bg-well hover:text-foreground disabled:opacity-60 data-[error=true]:text-miss",
						compact ? "w-8" : "px-2",
					)}
					data-error={error ? "true" : undefined}
				>
					{state === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
					{!compact && "Image"}
				</button>
			</Hint>
			<input
				ref={input}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp"
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

function ChipThumb({ src }: { src: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return <ImageIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />;
	}
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt=""
			onError={() => setFailed(true)}
			className="size-5 shrink-0 rounded-xs object-cover bg-background/40"
		/>
	);
}

export function DraftImageChips({
	images,
	onRemove,
	className,
}: {
	images: readonly AttachedImage[];
	onRemove: (img: AttachedImage) => void;
	className?: string;
}) {
	const [open, setOpen] = useState<{ src: string; name: string } | null>(null);
	const close = useCallback(() => setOpen(null), []);
	if (images.length === 0) return null;
	return (
		<>
			<ul data-testid="draft-images" className={cn("flex min-w-0 flex-wrap gap-2", className)}>
				{images.map((img) => {
					const src = learnerImageSrc(img);
					return (
						<li
							key={img.path}
							className="flex max-w-full min-w-0 items-center gap-0.5 rounded-md bg-well p-1 font-ui text-[13px] text-ink-2"
						>
							<button
								type="button"
								title={`View ${img.name}`}
								aria-label={`View ${img.name}`}
								onClick={() => setOpen({ src, name: img.name })}
								className="flex min-w-0 cursor-zoom-in items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-well-2 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal"
							>
								<ChipThumb src={src} />
								<span className="truncate">{img.name}</span>
							</button>
							<button
								type="button"
								onClick={() => onRemove(img)}
								aria-label={`Remove ${img.name}`}
								className="flex size-5 shrink-0 items-center justify-center rounded text-ink-3 transition-colors hover:bg-well-2 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal"
							>
								<XIcon className="size-3.5" />
							</button>
						</li>
					);
				})}
			</ul>
			<ImageViewer src={open?.src ?? null} name={open?.name ?? ""} onClose={close} />
		</>
	);
}
