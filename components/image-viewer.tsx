"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";

export function ImageViewer({ src, name, onClose }: { src: string | null; name: string; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!src) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeRef.current?.focus();
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			// A window-level stopPropagation cannot stop the earlier-registered
			// global window listener, so claim Esc at the document level.
			e.preventDefault();
			e.stopPropagation();
			onClose();
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			opener?.focus();
		};
	}, [src, onClose]);

	return (
		<Dialog open={src !== null} onClose={onClose}>
			<DialogPortal>
				<DialogOverlay className="bg-black/80 p-6 max-sm:p-3">
					<figure
						role="dialog"
						aria-modal="true"
						aria-label={name}
						className="relative flex max-h-full max-w-full flex-col items-center gap-2 animate-in zoom-in-95 duration-150"
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={src ?? undefined}
							alt={name}
							className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-3rem)] rounded-lg object-contain shadow-raise-hi"
						/>
						<figcaption className="flex max-w-full items-center gap-2 font-ui text-[13px] text-white/80">
							<span className="truncate">{name}</span>
							<button
								ref={closeRef}
								type="button"
								aria-label="Close"
								onClick={onClose}
								className="shrink-0 rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal"
							>
								<XIcon className="size-4" />
							</button>
						</figcaption>
					</figure>
				</DialogOverlay>
			</DialogPortal>
		</Dialog>
	);
}
