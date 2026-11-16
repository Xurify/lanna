"use client";

import { quickReplies } from "@/src/core";
import { QUIET, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";

export function ChatReplies({
	reply,
	open,
	onPick,
	drill,
}: {
	reply: string;
	open?: boolean;
	onPick: (text: string) => void;
	drill?: { label: string; onDrill: () => void; opening: boolean };
}) {
	const replies = quickReplies(reply, open);
	if (replies.length === 0) return null;
	return (
		<div data-testid="chat-replies" className="-mt-2 -ms-2.5 flex flex-wrap items-center gap-x-1 gap-y-1">
			{replies.map((text) => (
				<button key={text} type="button" onClick={() => onPick(text)} className={cn(QUIET, SMALL)}>
					{text}
				</button>
			))}
			{drill && (
				<button
					type="button"
					onClick={drill.onDrill}
					disabled={drill.opening}
					className={cn(QUIET, SMALL, "xl:hidden")}
				>
					{drill.label}
				</button>
			)}
		</div>
	);
}
