"use client";

import { quickReplies } from "@/src/core";

export function ChatReplies({ reply, onPick }: { reply: string; onPick: (text: string) => void }) {
	const replies = quickReplies(reply);
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
		</div>
	);
}
