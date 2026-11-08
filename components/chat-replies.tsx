"use client";

import { quickReplies } from "@/src/core";

export function ChatReplies({ reply, open, onPick, drill }: { reply: string; open?: boolean; onPick: (text: string) => void; drill?: { label: string; onDrill: () => void; opening: boolean } }) {
	const replies = quickReplies(reply, open);
	if (replies.length === 0) return null;
	return (
		<div data-testid="chat-replies" className="-mt-1 flex flex-wrap gap-2">
			{replies.map((text) => (
				<button
					key={text}
					type="button"
					onClick={() => onPick(text)}
					className="lh-press rounded-full border border-line-2 px-3.5 py-1.5 font-ui text-[13px] font-medium text-ink-2 transition-colors hover:bg-well hover:text-foreground"
				>
					{text}
				</button>
			))}
			{drill && (
				<button
					type="button"
					onClick={drill.onDrill}
					disabled={drill.opening}
					className="lh-press rounded-full px-3 py-1.5 font-ui text-[13px] font-medium text-ink-3 underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground xl:hidden"
				>
					{drill.label}
				</button>
			)}
		</div>
	);
}
