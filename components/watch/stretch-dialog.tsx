"use client";

import { useEffect, useRef } from "react";
import { FragmentsPanel } from "@/components/watch/fragments";
import type { FragmentRange } from "@/src/core";

/**
 * "Pick a stretch" in a sheet over the shelf. In a grid a panel has no row of
 * its own to open in, and a sheet keeps the shelf where it was. Escape closes
 * it and stops there: on this screen Escape otherwise leaves Watch.
 */
export function StretchDialog({
	videoId,
	title,
	canPrepare,
	onPrepare,
	onClose,
}: {
	videoId: string;
	title?: string;
	canPrepare: boolean;
	onPrepare: (range?: FragmentRange) => void;
	onClose: () => void;
}) {
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const back = document.activeElement as HTMLElement | null;
		box.current?.querySelector<HTMLElement>("button")?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			onClose();
		};
		// Capture, so the window's own Escape (leave Watch) never sees it.
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("keydown", onKey, true);
			back?.focus?.();
		};
	}, [onClose]);
	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
			data-testid="watch-stretch-dialog"
		>
			<div
				ref={box}
				role="dialog"
				aria-modal="true"
				aria-label="Pick a stretch of this video"
				className="q-card max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-b-none sm:rounded-b-[var(--radius-lg)]"
			>
				<FragmentsPanel
					plain
					videoId={videoId}
					title={title}
					canPrepare={canPrepare}
					onPrepare={onPrepare}
					onClose={onClose}
				/>
			</div>
		</div>
	);
}
