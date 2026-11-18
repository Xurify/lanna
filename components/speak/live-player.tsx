"use client";

import { SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallStage } from "@/components/speak/speak-motion";
import { SECONDARY } from "@/components/ui/learn-buttons";
import type { LiveToolEvent, LiveTurn } from "@/src/core";

function clock(sec: number): string {
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function LivePlayer({
	title,
	turns,
	hint,
	used,
	vault,
	level,
	speaker,
	elapsed,
	phase,
	notice,
	lang,
	onEnd,
}: {
	title: string;
	turns: LiveTurn[];
	hint: LiveToolEvent | null;
	used: string[];
	vault: Array<{ id: string; sk: string; en: string }>;
	level: number;
	speaker: "tutor" | "learner" | null;
	elapsed: number;
	phase: "connecting" | "live" | "ending";
	notice: string;
	lang?: string;
	onEnd: () => void;
}) {
	const lit = (chunk: { sk: string }) =>
		used.some((lemma) => {
			const word = lemma.toLocaleLowerCase();
			return word.length > 2 && chunk.sk.toLocaleLowerCase().includes(word);
		});
	return (
		<div className="mx-auto max-w-3xl px-5 pt-8 pb-24">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<div>
					<p className="font-ui text-[12px] font-[550] text-ink-3">Live talk</p>
					<h1 className="mt-1 font-ui text-[26px] font-[600] leading-tight tracking-[-0.02em] text-foreground">
						{title}
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<span className="font-ui text-[13px] tabular-nums text-ink-2" data-testid="live-clock">
						{clock(elapsed)}
					</span>
					<button type="button" onClick={onEnd} disabled={phase === "ending"} className={SECONDARY}>
						<SquareIcon className="size-3.5 fill-current" />
						{phase === "ending" ? "Reading the talk…" : "End the talk"}
					</button>
				</div>
			</div>

			<CallStage speaker={speaker} level={level} connecting={phase === "connecting"} />
			<p className="mt-2 text-center font-ui text-[12px] text-ink-3" aria-hidden="true">
				{phase === "connecting" ? "Connecting…" : phase === "ending" ? "Finishing…" : "Listening"}
			</p>

			{hint && (
				<div
					key={hint.hint}
					className="speak-in mt-4 rounded-xl bg-well px-4 py-3"
					role="status"
					aria-live="polite"
					data-testid="live-hint"
				>
					<p className="font-ui text-[11px] font-[550] text-ink-3">A repair</p>
					<p className="mt-1 font-prose text-[15px] text-foreground" lang={lang}>
						{hint.hint}
					</p>
					{hint.yours && (
						<p className="mt-1 font-prose text-[13px] text-ink-3">
							You said: <span lang={lang}>“{hint.yours}”</span>
						</p>
					)}
				</div>
			)}

			{turns.length === 0 ? (
				<p className="mt-8 font-prose text-[15px] text-ink-2">
					{phase === "connecting"
						? "The tutor is about to say hello."
						: "Say something when you are ready. You can start before the tutor finishes."}
				</p>
			) : (
				<ol className="speak-in mt-6 flex flex-col gap-4" data-testid="live-transcript">
					{turns.map((turn, i) => (
						<li key={`${turn.start}-${i}`} className={turn.role === "learner" ? "pl-4" : ""}>
							<p className="font-ui text-[11px] font-[550] text-ink-3">{turn.role === "learner" ? "You" : "Tutor"}</p>
							<p
								className={cn(
									"mt-0.5 font-prose text-[15px] leading-relaxed",
									turn.role === "learner" ? "text-foreground" : "text-ink-2",
								)}
								lang={lang}
							>
								{turn.text}
							</p>
						</li>
					))}
				</ol>
			)}

			{notice && (
				<p className="mt-5 max-w-prose font-prose text-[13px] text-ink-3" role="status">
					{notice}
				</p>
			)}

			{vault.length > 0 && (
				<section className="mt-8" aria-labelledby="live-vault">
					<h2 id="live-vault" className="q-sh">
						Your vault
					</h2>
					<p className="font-prose text-[13px] text-ink-3">
						The chunks this island runs on. They light up as you say them.
					</p>
					<ul className="mt-2 flex flex-wrap gap-1.5">
						{vault.map((chunk) => (
							<li
								key={chunk.id}
								title={chunk.en}
								className={cn(
									"rounded-full px-3 py-1 font-prose text-[13px] transition-colors duration-300",
									lit(chunk) ? "speak-lit bg-teal-wash text-teal-2" : "bg-well text-ink-2",
								)}
								lang={lang}
							>
								{chunk.sk}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
