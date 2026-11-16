"use client";

import type { Ref } from "react";
import { FileTextIcon, ImageIcon } from "lucide-react";
import { answerMark, splitAttachedPdfs, type AnswerTone, type AttachedImage, type AttachedPdf, type LearnerLine } from "@/src/core";
import { cn } from "@/lib/utils";

const TONE: Record<AnswerTone, string> = {
	right: "text-teal-2",
	near: "text-ink-2",
	miss: "text-miss",
	shown: "text-ink-3",
};

const STROKE: Record<AnswerTone, string> = {
	right: "M4.6 12.8 Q7 15.4 9.8 18.2 Q14 10.8 19.8 4.8",
	near: "M4.6 12.8 Q7 15.4 9.8 18.2 Q14 10.8 19.8 4.8",
	miss: "M6.2 5.8 Q12 12.4 18 18.3 M18.1 5.6 Q12.2 12 5.8 18.4",
	shown: "M6 12.2 Q12 11.6 18 12.1",
};

function PdfChips({ pdfs, className }: { pdfs: readonly AttachedPdf[]; className?: string }) {
	if (pdfs.length === 0) return null;
	return (
		<ul data-testid="attached-pdfs" className={cn("flex flex-wrap gap-2", className)}>
			{pdfs.map((pdf) => (
				<li key={pdf.path} title={pdf.path} className="flex max-w-full items-center gap-1.5 rounded-md bg-well px-2.5 py-1 font-ui text-[13px] text-ink-2">
					<FileTextIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
					<span className="truncate">{pdf.name}</span>
					<span className="shrink-0 text-ink-3">· {pdf.pages} page{pdf.pages === 1 ? "" : "s"}</span>
				</li>
			))}
		</ul>
	);
}

function ImageChips({ images, className }: { images: readonly AttachedImage[]; className?: string }) {
	if (images.length === 0) return null;
	return (
		<ul data-testid="attached-images" className={cn("flex flex-wrap gap-2.5", className)}>
			{images.map((img) => {
				const fileName = img.path.split(/[/\\]/).pop() ?? img.name;
				return (
					<li key={img.path} title={img.path} className="flex max-w-full flex-col gap-1.5 rounded-xl border border-line-2 bg-well p-2 font-ui text-[13px] text-ink-2">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={`/api/learner-images?file=${encodeURIComponent(fileName)}`}
							alt={img.name}
							className="max-h-60 max-w-xs rounded-lg object-contain bg-background/40"
							onError={(e) => {
								(e.currentTarget as HTMLElement).style.display = "none";
							}}
						/>
						<div className="flex items-center gap-1.5 px-0.5">
							<ImageIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
							<span className="truncate max-w-[220px]">{img.name}</span>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export function LearnerLineView({ line, text: raw, recede, titleRef }: { line: LearnerLine; text: string; recede?: boolean; titleRef?: Ref<HTMLHeadingElement> }) {
	const step = recede ? "lh-recede" : undefined;
	const { pdfs, images, rest } = splitAttachedPdfs(raw);
	const text = rest || (pdfs[0]?.name ?? images[0]?.name ?? raw);
	if (line.kind === "title") {
		return (
			<>
				<PdfChips pdfs={pdfs} className={cn("mb-3", step)} />
				<ImageChips images={images} className={cn("mb-3", step)} />
				<h1 ref={titleRef} data-testid="user-message" data-line="title" className={cn("font-ui text-[28px] leading-[1.18] font-semibold tracking-[-0.022em] text-balance whitespace-pre-wrap text-foreground max-sm:text-2xl", step)}>
					{text}
				</h1>
			</>
		);
	}
	if (line.kind === "ask") {
		return (
			<>
				<PdfChips pdfs={pdfs} className={cn("mt-8", step)} />
				<ImageChips images={images} className={cn("mt-8", step)} />
				<h2 data-testid="user-message" data-line="ask" className={cn(pdfs.length > 0 || images.length > 0 ? "mt-3" : "mt-8", "font-ui text-xl leading-snug font-semibold tracking-[-0.015em] text-balance whitespace-pre-wrap text-foreground", step)}>
					{text}
				</h2>
			</>
		);
	}
	if (line.kind === "request") {
		return (
			<p data-testid="user-message" data-line="request" className={cn("font-ui text-[13px] font-medium text-ink-3", step)}>
				<span className="sr-only">You asked: </span>
				{text}
			</p>
		);
	}
	const mark = line.kind === "answer" && line.grade ? answerMark(line.grade) : null;
	return (
		<p data-testid="user-message" data-line="answer" data-tone={mark?.tone} className={cn("mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1", step)}>
			<span className="sr-only">Your answer: </span>
			<span className="font-ui text-lg leading-snug font-semibold whitespace-pre-wrap text-foreground">{text}</span>
			{mark && (
				<span data-testid="answer-mark" className={cn("inline-flex items-baseline gap-1 font-ui text-[13px] font-medium", TONE[mark.tone])}>
					<svg viewBox="0 0 24 24" className="size-4 translate-y-[0.22em]" aria-hidden="true">
						<path d={STROKE[mark.tone]} pathLength={1} className="fill-none stroke-current" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					{mark.label}
				</span>
			)}
		</p>
	);
}

export function HeldLine({ text }: { text: string }) {
	return (
		<p data-testid="held-answer" className="mt-2 flex flex-wrap items-baseline gap-x-3">
			<span className="font-ui text-lg leading-snug font-semibold whitespace-pre-wrap text-ink-3">{text}</span>
			<span className="font-ui text-[13px] text-ink-3">sends when the tutor is done</span>
		</p>
	);
}

export function TutorWriting() {
	return (
		<span role="status" data-testid="tutor-writing" className="flex h-7 items-center gap-2.5 font-ui text-[13px] text-ink-3">
			<svg viewBox="0 0 44 12" className="h-3 w-11 text-teal" aria-hidden="true">
				<path d="M2 8 C8 2 12 11 18 6 S28 3 32 7 S38 9 42 5" className="fill-none stroke-line-2" strokeWidth={1.6} strokeLinecap="round" />
				<path d="M2 8 C8 2 12 11 18 6 S28 3 32 7 S38 9 42 5" pathLength={1} className="lh-pen fill-none stroke-current" strokeWidth={1.6} strokeLinecap="round" />
			</svg>
			Writing…
		</span>
	);
}
