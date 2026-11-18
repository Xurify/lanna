"use client";

import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useVoicing } from "@/components/speech";
import type { SoundNeighbor, SoundNote, SoundPicture } from "@/src/core";
import { LiveSoundDrawing } from "./sound-motion";

interface Figure extends SoundNeighbor {
	quiet: boolean;
}

export function hearSoundWord(word: string): void {
	void speak(word, undefined, { prefer: "elevenlabs" }).catch(() => {});
}

const LENGTH_WORDS: Record<1 | 2 | 3, string> = { 1: "short", 2: "about twice as long", 3: "longer still" };

function pictureSays(picture: SoundPicture): string | undefined {
	return picture.kind === "mouth" ? picture.says : LENGTH_WORDS[picture.units];
}

function seedOf(text: string): number {
	let seed = 7;
	for (const ch of text) seed = (seed * 31 + (ch.codePointAt(0) ?? 0)) % 9973;
	return seed;
}

function figuresOf(note: SoundNote): Figure[] {
	if (!note.picture || !note.next) return [];
	return [
		{ ...note.next, quiet: true },
		{ symbol: note.symbol, word: note.word, meaning: note.meaning, picture: note.picture, quiet: false },
		...(note.also ? [{ ...note.also, quiet: false }] : []),
	];
}

function Caption({ figure, langCode }: { figure: Figure; langCode: string }) {
	const says = pictureSays(figure.picture);
	return (
		<span className="block min-w-0">
			<span className="flex items-baseline gap-2">
				<span
					className={cn(
						"font-prose text-[19px] font-semibold leading-none tracking-[-0.02em]",
						figure.quiet ? "text-ink-2" : "text-teal-2",
					)}
					lang={langCode}
				>
					{figure.symbol}
				</span>
				<span className="truncate font-prose text-[15px] font-medium text-foreground" lang={langCode}>
					{figure.word}
				</span>
				<Volume2Icon
					className="size-3.5 shrink-0 self-center text-ink-4 group-hover:text-ink-2"
					strokeWidth={1.6}
					aria-hidden="true"
				/>
			</span>
			<span className="mt-1 block font-ui text-[12.5px] leading-snug text-ink-3">
				{says ? `${figure.meaning} · ${says}` : figure.meaning}
			</span>
		</span>
	);
}

export function SoundPictures({
	note,
	langCode,
	className,
}: {
	note: SoundNote;
	langCode: string;
	className?: string;
}) {
	const figures = figuresOf(note);
	if (figures.length === 0) return null;
	const length = figures[0]!.picture.kind === "length";
	const voicing = useVoicing();
	return (
		<div
			className={cn(length ? "flex flex-col gap-2" : "grid grid-cols-2 gap-3", className)}
			data-testid="sound-pictures"
		>
			{figures.map((figure, i) => {
				const seed = seedOf(`${note.symbol}:${i}`);
				return length ? (
					<button
						key={i}
						type="button"
						onClick={() => hearSoundWord(figure.word)}
						aria-label={`Play ${figure.word}`}
						className="lanna-press group grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 rounded-xl bg-well px-4 py-2.5 text-start hover:bg-well-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
					>
						<Caption figure={figure} langCode={langCode} />
						<LiveSoundDrawing
							picture={figure.picture}
							seed={seed}
							quiet={figure.quiet}
							playing={voicing === figure.word}
							className="h-auto w-full max-w-[19rem]"
						/>
					</button>
				) : (
					<button
						key={i}
						type="button"
						onClick={() => hearSoundWord(figure.word)}
						aria-label={`Play ${figure.word}`}
						className="lanna-press group flex flex-col rounded-xl bg-well px-3 pb-3.5 pt-2 text-start hover:bg-well-2 sm:px-4"
					>
						<LiveSoundDrawing
							picture={figure.picture}
							seed={seed}
							quiet={figure.quiet}
							playing={voicing === figure.word}
							className="mx-auto h-auto w-full max-w-[15rem]"
						/>
						<Caption figure={figure} langCode={langCode} />
					</button>
				);
			})}
		</div>
	);
}
