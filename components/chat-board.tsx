"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { boardPhrases, chatScore, latestDrawing, type LannaViewMessage } from "@/src/core";
import { startDraftSession } from "@/components/new-session";
import { QUIET, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { SketchFigure } from "@/components/sketch-figure";
import { SpokenPhrase } from "@/components/speech";

function replyTexts(messages: readonly LannaViewMessage[]): string[] {
	return messages
		.filter((m) => m.role === "assistant")
		.map((m) =>
			m.parts
				.flatMap((p) => {
					if (p.type === "text") return [p.text];
					const svg =
						p.type === "tool-draw" && p.state === "output-available"
							? (p.output as { svg?: string } | null)?.svg
							: undefined;
					return svg ? ["```svg\n" + svg + "\n```"] : [];
				})
				.join("\n\n"),
		);
}

export function useDrill(messages: readonly LannaViewMessage[], title: string) {
	const router = useRouter();
	const [opening, setOpening] = useState(false);
	const score = useMemo(() => chatScore(messages), [messages]);
	const drill = () => {
		const topic = score.misses.length > 0 ? score.misses.join(", ") : title;
		setOpening(true);
		void startDraftSession(`Drill: ${topic}`, fetch, "practice")
			.then((target) => (target ? router.push(target) : setOpening(false)))
			.catch(() => setOpening(false));
	};
	const label = opening ? "Opening…" : score.misses.length > 0 ? "Drill what I missed" : "Drill this";
	return { score, drill, opening, label };
}

export function ChatBoard({
	messages,
	drill: drillState,
}: {
	messages: readonly LannaViewMessage[];
	drill: ReturnType<typeof useDrill>;
}) {
	const { score, drill, opening, label } = drillState;
	const replies = useMemo(() => replyTexts(messages), [messages]);
	const drawing = useMemo(() => latestDrawing(replies), [replies]);
	const phrases = useMemo(() => boardPhrases(replies), [replies]);

	return (
		<aside
			aria-label="The board"
			data-testid="chat-board"
			className="hidden w-80 shrink-0 overflow-y-auto border-l border-border/60 px-6 pt-8 pb-40 xl:block"
		>
			<h2 className="font-ui text-xs font-semibold text-muted-foreground">How it is going</h2>
			{score.asked > 0 ? (
				<div className="mt-2" data-testid="chat-score">
					<p className="font-ui text-[15px] text-foreground">
						<span className="text-2xl font-semibold tabular-nums">{score.firstTryRight}</span>
						<span className="text-ink-3"> of {score.asked}</span> right on the first try
					</p>
					{score.misses.length > 0 && <p className="mt-1 text-[13px] text-ink-3">Missed: {score.misses.join(", ")}</p>}
				</div>
			) : (
				<p className="mt-2 text-sm text-ink-3">Your answers to the tutor’s questions are counted here.</p>
			)}
			<button
				type="button"
				onClick={drill}
				disabled={opening}
				className={cn(QUIET, SMALL, "mt-2 -ml-3 text-foreground")}
			>
				{label}
			</button>

			<h2 className="mt-8 font-ui text-xs font-semibold text-muted-foreground">On the board</h2>
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
