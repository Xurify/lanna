"use client";

import { Fragment } from "react";
import Link from "next/link";
import { PlayButton, useActiveLanguage } from "@/components/speech";
import type { AskedAbout as AskedAboutData } from "@/src/core";

function withPartMarked(sentence: string, part: string | null) {
	const at = part ? sentence.indexOf(part) : -1;
	if (!part || at < 0) return sentence;
	return (
		<Fragment>
			{sentence.slice(0, at)}
			<b className="font-semibold text-foreground underline decoration-teal decoration-2 underline-offset-[5px]">
				{part}
			</b>
			{sentence.slice(at + part.length)}
		</Fragment>
	);
}

const WORD_CLASSES = new Set([
	"noun",
	"verb",
	"adjective",
	"adverb",
	"pronoun",
	"preposition",
	"conjunction",
	"numeral",
	"particle",
	"interjection",
]);

export function AskedAbout({ about }: { about: AskedAboutData }) {
	const lang = useActiveLanguage();
	const { sentence, part, given, translation, entry } = about;
	const wrote = given.trim() && given.trim() !== part ? given.trim() : "";
	return (
		<section
			aria-label="What this chat is about"
			className="rounded-xl bg-well px-4 py-3.5"
			data-testid="asked-about"
			data-word-lookup-enabled="true"
		>
			<div className="flex items-start gap-3">
				<p className="min-w-0 flex-1 text-[18px] leading-[28px] text-ink-2" lang={lang?.code}>
					{withPartMarked(sentence, part)}
				</p>
				<PlayButton
					text={sentence}
					className="mt-0.5 size-8 shrink-0 rounded-full bg-background text-ink-2 hover:bg-well-2"
					label="Play the sentence"
				/>
			</div>
			{translation && (
				<p className="mt-1 text-[14px] text-ink-3" data-no-word-lookup="true">
					{translation}
				</p>
			)}
			{wrote && (
				<p className="mt-2 text-[13px] text-ink-3" data-no-word-lookup="true">
					You wrote{" "}
					<span
						className="font-semibold text-ink-2 underline decoration-miss decoration-2 underline-offset-4"
						lang={lang?.code}
					>
						{wrote}
					</span>
				</p>
			)}
			{entry && (
				<p
					className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-[var(--q-line)] pt-3 text-[14px]"
					data-no-word-lookup="true"
				>
					<Link
						href={`/words?search=${encodeURIComponent(entry.lemma)}`}
						lang={lang?.code}
						className="font-semibold text-foreground underline decoration-line-2 underline-offset-2 hover:text-ink"
					>
						{entry.lemma}
					</Link>
					{entry.pos && WORD_CLASSES.has(entry.pos.toLowerCase()) && (
						<span className="text-[12.5px] text-ink-3">{entry.pos.toLowerCase()}</span>
					)}
					<span className="text-ink-2">{entry.gloss}</span>
					{entry.formNote && <span className="w-full text-[12.5px] text-ink-3">{entry.formNote}</span>}
				</p>
			)}
		</section>
	);
}
