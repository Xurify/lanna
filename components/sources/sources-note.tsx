"use client";

/**
 * The research behind a page, folded under it (LangHarness, 2026-11-06,
 * DECISIONS E63). Closed it is one quiet line; open it says what the
 * research found, what it did not show, which numbers are the app's own
 * choice, and links every source. The text lives in src/core/sources.ts
 * so the page and the /sources reference say the same thing.
 */

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { featureById, sourcesOf, sourceUrl, type Source } from "@/src/core";

const CHECKED: Record<Source["checked"], string> = {
	read: "abstract read",
	doi: "link checked",
	listed: "no link: cited from our notes",
};

/** One reference: who, what, where, and the link when there is one. */
export function SourceItem({ source }: { source: Source }) {
	const url = sourceUrl(source);
	return (
		<li className="font-prose text-[14px] leading-snug text-ink-2" data-testid="source-item" id={`src-${source.id}`}>
			<span className="font-[550] text-foreground">{source.cite}.</span> {source.title}. <span className="text-ink-3">{source.venue}.</span>{" "}
			{url ? (
				<a href={url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:text-foreground">
					doi.org/{source.doi}
				</a>
			) : null}
			<span className="block font-ui text-xs text-ink-3">
				{source.kind} · {CHECKED[source.checked]}
				{source.says ? ` · ${source.says}` : ""}
			</span>
		</li>
	);
}

export function SourcesNote({ feature, className }: { feature: string; className?: string }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const f = featureById(feature);
	if (!f) return null;
	const sources = sourcesOf(f);
	return (
		<section className={cn("border-t border-[var(--q-line)] pt-3", className)} data-testid="sources-note" data-feature={f.id}>
			<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 pointer-coarse:min-h-11">
				<span>
					Why this works <span className="font-normal">· {sources.length} sources</span>
				</span>
				<ChevronDownIcon className={cn("size-4 shrink-0", open && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
			</button>
			{open && (
				<div id={id} className="mt-2 flex flex-col gap-4 pb-1">
					<div>
						<p className="font-ui text-xs font-semibold text-ink-3">What the research found</p>
						<p className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.evidence}</p>
					</div>
					<div>
						<p className="font-ui text-xs font-semibold text-ink-3">What it did not show</p>
						<p className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.limits}</p>
					</div>
					<div>
						<p className="font-ui text-xs font-semibold text-ink-3">The app&apos;s own choices</p>
						<p className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.ours}</p>
					</div>
					<ul className="flex flex-col gap-2.5">
						{sources.map((s) => (
							<SourceItem key={s.id} source={s} />
						))}
					</ul>
					<p className="font-ui text-xs text-ink-3">
						<Link href={`/sources#${f.id}`} className="underline decoration-line-2 underline-offset-[3px] hover:text-ink-2">
							All sources, by feature
						</Link>
					</p>
				</div>
			)}
		</section>
	);
}
