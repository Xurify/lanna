"use client";

import { useMemo } from "react";
import { boardPhrases, latestDrawing, type LhViewMessage } from "@/src/core";
import { SketchFigure } from "@/components/sketch-figure";
import { SpokenPhrase } from "@/components/speech";

function replyTexts(messages: readonly LhViewMessage[]): string[] {
	return messages.filter((m) => m.role === "assistant").map((m) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n\n"));
}

export function ChatBoard({ messages }: { messages: readonly LhViewMessage[] }) {
	const replies = useMemo(() => replyTexts(messages), [messages]);
	const drawing = useMemo(() => latestDrawing(replies), [replies]);
	const phrases = useMemo(() => boardPhrases(replies), [replies]);

	return (
		<aside aria-label="The board" data-testid="chat-board" className="hidden w-80 shrink-0 overflow-y-auto border-l border-border/60 px-6 pt-8 pb-40 xl:block">
			<h2 className="font-ui text-xs font-semibold text-muted-foreground">On the board</h2>
			{drawing ? (
				<div className="mt-2 -mx-2">
					<SketchFigure key={drawing} source={drawing} incomplete={false} />
				</div>
			) : (
				<p className="mt-2 text-sm text-ink-3">The last drawing stays here while you answer.</p>
			)}
			<h2 className="mt-8 font-ui text-xs font-semibold text-muted-foreground">Words in this chat</h2>
			{phrases.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2.5">
					{phrases.map(({ phrase, meaning }) => (
						<li key={phrase} className="flex flex-col items-start gap-0.5">
							<SpokenPhrase text={phrase} />
							<span className="pl-1.5 text-[13px] text-ink-3">{meaning}</span>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-sm text-ink-3">Every form the tutor glosses lands here, ready to play.</p>
			)}
		</aside>
	);
}
