"use client";

import { cn } from "@/lib/utils";
import { coverageBand, formatClock } from "@/src/core";
import { Poster } from "@/components/watch/thumb";

const FILL = { comfortable: "bg-teal-2", stretch: "bg-teal-2/60", hard: "bg-ink-3", "too-hard": "bg-ink-4" } as const;
const TEXT = { comfortable: "text-teal-2", stretch: "text-teal-2", hard: "text-ink-2", "too-hard": "text-ink-3" } as const;

/** "92% known" in the colour of its band; `about` for a share estimated from another language's captions. */
export function Known({ coverage, about }: { coverage: number; about?: boolean }) {
	const band = coverageBand(coverage);
	return (
		<span className={cn("font-[600]", TEXT[band.band])} title={band.line}>
			{about ? "about " : ""}
			{Math.round(coverage * 100)}% known
			<span className="font-[450] text-ink-3"> · {band.title.toLowerCase()}</span>
		</span>
	);
}

/**
 * The one shape every video takes on the Watch shelf (a pick, a creator's
 * video, a video of yours): a 16:9 poster with its length and, when it is
 * measured, how much of it you know as a bar along the foot, then the title,
 * the channel, one line of facts, and the actions. Cards in a row align their
 * actions at the foot, so a one-line title does not stagger them.
 */
export function VideoCard({
	id,
	title,
	lang,
	durationSec,
	coverage,
	watched,
	badge,
	by,
	line,
	href,
	onOpen,
	dim,
	children,
	testid,
}: {
	id: string;
	title: string;
	lang?: string;
	durationSec: number;
	coverage?: number;
	watched?: boolean;
	badge?: React.ReactNode;
	by?: React.ReactNode;
	line?: React.ReactNode;
	/** Poster and title open this on YouTube. */
	href?: string;
	/** Poster and title open the video here instead. */
	onOpen?: () => void;
	dim?: boolean;
	children?: React.ReactNode;
	testid?: string;
}) {
	const band = coverage !== undefined ? coverageBand(coverage).band : null;
	const poster = (
		<span className="relative block overflow-hidden rounded-xl">
			<Poster id={id} watched={watched} className="rounded-xl" />
			<span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 font-ui text-[11.5px] font-[600] tabular-nums leading-none text-white">{formatClock(durationSec)}</span>
			{badge && <span className="absolute left-2 top-2">{badge}</span>}
			{band && coverage !== undefined && (
				<span className="absolute inset-x-0 bottom-0 block h-1 bg-black/45">
					<span className={cn("block h-full", FILL[band])} style={{ width: `${Math.max(2, Math.round(coverage * 100))}%` }} />
				</span>
			)}
		</span>
	);
	const label = "line-clamp-2 text-left font-ui text-[15px] font-[600] leading-snug text-foreground hover:underline";
	return (
		<article className={cn("flex h-full min-w-0 flex-col", dim && "opacity-70")} data-testid={testid}>
			{href ? (
				<a href={href} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" className="rounded-xl">
					{poster}
				</a>
			) : (
				<button type="button" onClick={onOpen} tabIndex={-1} aria-hidden="true" className="block w-full rounded-xl text-left">
					{poster}
				</button>
			)}
			<div className="mt-2.5 min-w-0 flex-1">
				{href ? (
					<a href={href} target="_blank" rel="noreferrer" className={label} lang={lang} title={`${title} (opens on YouTube)`} data-testid="watch-card-title">
						{title}
					</a>
				) : (
					<button type="button" onClick={onOpen} className={label} lang={lang} title={title} data-testid="watch-card-title">
						{title}
					</button>
				)}
				{by && <div className="mt-1 flex min-w-0 items-center gap-1.5 truncate font-prose text-[13px] text-ink-3">{by}</div>}
				{line && <div className="mt-0.5 font-prose text-[13px] leading-snug text-ink-3">{line}</div>}
			</div>
			{children && <div className="mt-3 flex items-center gap-1.5">{children}</div>}
		</article>
	);
}

/** A square icon action on a card: the same 32px target everywhere. */
export function CardIconButton({ label, onClick, active, children, testid }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode; testid?: string }) {
	return (
		<button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-11", active ? "bg-accent text-foreground" : "text-muted-foreground")} data-testid={testid}>
			{children}
		</button>
	);
}

/** The grid every list of cards sits in. */
export function CardGrid({ children, testid }: { children: React.ReactNode; testid?: string }) {
	return (
		<ul className="grid grid-cols-1 gap-x-4 gap-y-7 @xl:grid-cols-2 @4xl:grid-cols-3" data-testid={testid}>
			{children}
		</ul>
	);
}
