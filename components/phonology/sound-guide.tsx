"use client";

import { useEffect, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { onFocusedControl, PracticeCard } from "@/components/task-frame";
import { SourcesNote } from "@/components/sources/sources-note";
import { speak } from "@/components/speech";
import { getPhonologyData, getSoundNote, getSoundNotes, type SoundNote } from "@/src/core";
import { SoundPictures } from "./sound-pictures";

export function SoundGuide({
	languageId,
	languageCode,
	initialSound,
	onTrain,
}: {
	languageId: string;
	languageCode: string;
	initialSound?: string;
	onTrain: (family: string) => void;
}) {
	const data = getSoundNotes(languageId);
	const sounds = data?.sounds ?? [];
	const [symbol, setSymbol] = useState(
		() => getSoundNote(initialSound ?? "", languageId)?.symbol ?? sounds[0]?.symbol ?? "",
	);
	const index = Math.max(
		0,
		sounds.findIndex((s) => s.symbol === symbol),
	);
	const note = sounds[index];

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || sounds.length === 0) return;
			if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
				e.preventDefault();
				const next = sounds[(index + (e.key === "ArrowRight" ? 1 : sounds.length - 1)) % sounds.length];
				if (next) setSymbol(next.symbol);
				return;
			}
			if (e.key === " " && note && !onFocusedControl(e)) {
				e.preventDefault();
				void speak(note.word).catch(() => {});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (!data || !note) return null;

	const group = data.groups.find((g) => g.id === note.group);
	const family = note.pairs ? getPhonologyData(languageId)?.families.find((f) => f.id === note.pairs) : undefined;

	return (
		<div className="grid gap-x-8 gap-y-5 md:grid-cols-[11rem_minmax(0,1fr)]" data-testid="sound-guide">
			<nav aria-label="Sounds" className="flex flex-wrap gap-1.5 md:sticky md:top-1 md:block md:self-start">
				{data.groups.map((g) => (
					<div key={g.id} className="contents md:mb-5 md:block">
						<p className="mb-2 hidden font-ui text-[12.5px] font-[550] text-ink-3 md:block">{g.label}</p>
						<div className="contents md:flex md:flex-wrap md:gap-1.5">
							{sounds
								.filter((s) => s.group === g.id)
								.map((s) => (
									<SoundChip
										key={s.symbol}
										sound={s}
										on={s.symbol === note.symbol}
										langCode={languageCode}
										onPick={() => setSymbol(s.symbol)}
									/>
								))}
						</div>
					</div>
				))}
			</nav>

			<div className="min-w-0">
				<PracticeCard key={note.symbol} icon="sound" title="Sounds" sub={group?.label} className="lanna-rise">
					<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
						<h2 className="flex items-baseline gap-3">
							<span
								className="font-prose text-[56px] font-semibold leading-[0.9] tracking-[-0.035em] text-foreground"
								lang={languageCode}
								data-testid="sound-symbol"
							>
								{note.symbol}
							</span>
							<span className="font-ui text-[14px] text-ink-3">[{note.ipa}]</span>
						</h2>
						<div className={cn("flex items-center gap-3", note.picture && "sr-only")}>
							<span className="font-ui text-[13px] text-ink-3">{note.meaning}</span>
							<button
								type="button"
								onClick={() => void speak(note.word).catch(() => {})}
								aria-label={`Play ${note.word}`}
								className={cn(SECONDARY, "h-10 gap-2.5 pointer-coarse:h-11")}
								data-testid="sound-hear"
							>
								<Volume2Icon className="size-4 text-ink-3" strokeWidth={1.6} />
								<span className="font-prose text-[16px] font-semibold" lang={languageCode}>
									{note.word}
								</span>
							</button>
						</div>
					</div>

					<SoundPictures note={note} langCode={languageCode} className="mt-6" />

					<p className="mt-6 font-prose text-[16.5px] leading-relaxed text-foreground" data-testid="sound-how">
						{note.how}
					</p>
					<dl className="mt-4 space-y-2.5 font-prose text-[15px] leading-relaxed text-ink-2">
						<Line label="Common slip">{note.slip}</Line>
						{note.writing && <Line label="In writing">{note.writing}</Line>}
						{note.functionalLoad === "high" && note.next && (
							<Line label="Why it matters">
								Mixing it up with <span lang={languageCode}>{note.next.symbol}</span> can change what a word means.
							</Line>
						)}
					</dl>

					{family && (
						<div className="mt-6">
							<button
								type="button"
								onClick={() => onTrain(family.id)}
								className={cn(SECONDARY, SMALL, "pointer-coarse:h-11")}
								data-testid="sound-train"
							>
								Train your ear: {family.label}
							</button>
						</div>
					)}
				</PracticeCard>

				<p className="mt-4 hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 sm:pointer-fine:flex">
					<kbd className={KBD}>←</kbd>
					<kbd className={KBD}>→</kbd> next sound
					<kbd className={cn(KBD, "ms-3")}>Space</kbd> hear the word
				</p>
				<SourcesNote feature="sound-notes" className="mt-10" />
			</div>
		</div>
	);
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid gap-x-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
			<dt className="font-ui text-[13px] font-[550] leading-[1.75] text-ink-3">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}

function SoundChip({
	sound,
	on,
	langCode,
	onPick,
}: {
	sound: SoundNote;
	on: boolean;
	langCode: string;
	onPick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onPick}
			aria-pressed={on}
			aria-label={`${sound.symbol}, as in ${sound.word}`}
			data-testid="sound-chip"
			className={cn(
				"lanna-press flex h-11 min-w-11 items-center justify-center rounded-[10px] px-2.5 font-prose text-[17px] font-semibold tracking-[-0.01em]",
				on
					? "bg-teal-wash text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)]"
					: "bg-card text-foreground shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well",
			)}
		>
			<span lang={langCode}>{sound.symbol}</span>
		</button>
	);
}
