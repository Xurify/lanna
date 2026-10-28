"use client";

/**
 * A tappable word (LangHarness, 2026-10-28) — shared by the Read and
 * Watch tasks. The popover under the word shows the dictionary form, the
 * form "here", the gloss, the part of speech and whether the word is new
 * to the learner. A fresh word carries a dotted underline so the eye
 * knows where the new ground is; a word looked up keeps a faint mark.
 */

import { useEffect, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/components/speech";
import type { StoryToken } from "@/src/core";

/** One tappable word. A fresh word (not met before) carries a dotted
 *  underline so the eye knows where the new ground is; a word looked up
 *  keeps a faint mark. The popover opens under the word. */
export function Word({ token, looked, open, onOpen, onClose }: { token: StoryToken; looked: boolean; open: boolean; onOpen: () => void; onClose: () => void }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [side, setSide] = useState<"left" | "right">("left");
	useEffect(() => {
		if (!open || !ref.current) return;
		const r = ref.current.getBoundingClientRect();
		const column = (ref.current.closest("[data-word-column]") ?? ref.current.closest("article"))?.getBoundingClientRect();
		if (column) setSide(r.left - column.left > column.width * 0.55 ? "right" : "left");
	}, [open]);
	return (
		<span ref={ref} className="relative inline">
			<button
				type="button"
				data-word
				onClick={() => (open ? onClose() : onOpen())}
				aria-expanded={open}
				className={cn(
					"rounded-md px-0.5 -mx-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-go",
					token.fresh && "underline decoration-dotted decoration-xp decoration-2 underline-offset-[5px]",
					looked && !token.fresh && "underline decoration-dotted decoration-foreground/30 decoration-2 underline-offset-[5px]",
					open && "bg-accent",
				)}
			>
				{token.text}
			</button>
			{open && (
				<span
					data-word-popover
					role="dialog"
					aria-label={`About ${token.text}`}
					className={cn("lh-pop absolute top-full z-10 mt-2 block w-max min-w-[13rem] max-w-[22rem] rounded-2xl border-2 bg-card p-4 text-left font-prose text-base shadow-lg", side === "left" ? "left-0" : "right-0")}
					data-testid="word-popover"
				>
					<span className="flex items-baseline justify-between gap-3">
						<span className="font-ui text-xl font-black text-foreground" lang="sk">
							{token.lemma ?? token.text}
						</span>
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => void speak(token.lemma ?? token.text).catch(() => {})}
							aria-label="Play the word"
							className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
						>
							<Volume2Icon className="size-4" />
						</button>
					</span>
					{token.lemma && token.lemma.toLocaleLowerCase("sk-SK") !== token.text.toLocaleLowerCase("sk-SK") && (
						<span className="block font-ui text-xs text-muted-foreground">
							here: <span lang="sk">{token.text}</span>
						</span>
					)}
					<span className="mt-1 block leading-snug text-foreground">{token.gloss ?? "Not in the dictionary yet."}</span>
					{(token.cat || token.gender || token.fresh) && (
						<span className="mt-1.5 flex flex-wrap gap-1.5">
							{token.cat && <Tag>{token.cat.toLowerCase()}</Tag>}
							{token.gender && <Tag>{token.gender}</Tag>}
							{token.fresh && <Tag className="bg-xp/15 text-xp">new word</Tag>}
						</span>
					)}
				</span>
			)}
		</span>
	);
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
	return <span className={cn("rounded-full bg-accent px-2 py-0.5 font-ui text-[11px] font-bold text-muted-foreground", className)}>{children}</span>;
}

