"use client";

/**
 * The static explanation of a contrast (LessonExplain in src/core/lesson.ts):
 * two worked sentences with the form in bold, one note, an aspect timeline or
 * a case grid, the three cue points, the trap, and a page-level slovak.wiki
 * link. Shown under "Parallels and examples" in the Why? panel, after a miss,
 * so a miss opens the rule alone and the picture comes on request.
 *
 * Deterministic and static: nothing here calls a model, and nothing here is a
 * drill item or touches the first try or the mix-up record. Every visual has a
 * text equivalent beside it (the timeline's lines, the grids' cells as text).
 */

import { isAllowedReferenceUrl, type LessonExplain } from "@/src/core";
import { cn } from "@/lib/utils";

const LABEL = "font-ui text-[12.5px] font-semibold text-ink-3";

/** The sentence with its form in bold, so the contrast reads at a glance. */
function Highlight({ sk, form }: { sk: string; form: string }) {
	const at = sk.indexOf(form);
	if (at < 0) return <>{sk}</>;
	return (
		<>
			{sk.slice(0, at)}
			<b className="font-semibold text-teal-2">{form}</b>
			{sk.slice(at + form.length)}
		</>
	);
}

function Contrast({ c }: { c: LessonExplain["contrast"] }) {
	return (
		<div className="flex flex-col gap-2" data-testid="explain-contrast">
			{[c.first, c.second].map((line) => (
				<div key={line.sk}>
					<p className="text-foreground" lang="sk">
						<Highlight sk={line.sk} form={line.form} />
					</p>
					<p className="text-muted-foreground" data-no-word-lookup="true">
						{line.en}
					</p>
				</div>
			))}
			<p className="text-foreground">{c.note}</p>
		</div>
	);
}

/** Aspect: one line per twin. The imperfective has no end point; the
 *  perfective ends at a finished point. The text beside it says the same. */
function Timeline({ t }: { t: NonNullable<LessonExplain["timeline"]> }) {
	return (
		<figure className="flex flex-col gap-2" data-testid="explain-timeline">
			<svg viewBox="0 0 320 92" className="h-[92px] w-full" aria-hidden="true" focusable="false">
				<text x="0" y="14" fontSize="13" fill="currentColor" className="text-ink-3">
					čítať
				</text>
				<line x1="0" y1="32" x2="306" y2="32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-ink-3" />
				<path d="M 298 25 L 308 32 L 298 39" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="text-ink-3" />
				<text x="0" y="60" fontSize="13" fill="currentColor" className="text-teal-2">
					prečítať
				</text>
				<line x1="0" y1="78" x2="200" y2="78" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-teal-2" />
				<circle cx="200" cy="78" r="5" fill="currentColor" className="text-teal-2" />
				<text x="212" y="82" fontSize="13" fill="currentColor" className="text-teal-2">
					finished
				</text>
			</svg>
			<figcaption className="flex flex-col gap-1 text-foreground">
				<span className="font-ui text-[12px] text-ink-3">Example: a sketch of the two lines, not to scale.</span>
				<span>{t.imperfective}</span>
				<span>{t.perfective}</span>
			</figcaption>
		</figure>
	);
}

type Grid = NonNullable<LessonExplain["tables"]>[number];

/** A case-by-gender grid, cells as the reference has them. "not yet" marks a
 *  form the reference does not name; it is never filled in. */
function CaseGrid({ grid }: { grid: Grid }) {
	return (
		<div className="flex flex-col gap-1.5" data-testid="explain-table">
			<p className="font-ui text-[13px] font-semibold text-ink-2">{grid.title}</p>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-[14px]">
					<thead>
						<tr>
							<th scope="col" className="px-2 py-1 text-left font-ui text-[12.5px] font-semibold text-ink-3">
								<span className="sr-only">Case</span>
							</th>
							{grid.cols.map((col) => (
								<th key={col} scope="col" className="px-2 py-1 text-left font-ui text-[12.5px] font-semibold text-ink-3">
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{grid.rows.map((row) => (
							<tr key={row.case} className="border-t border-[var(--q-line)]">
								<th scope="row" className="px-2 py-1 text-left font-ui text-[13px] font-semibold text-ink-3">
									{row.case}
								</th>
								{row.cells.map((cell, i) => {
									const missing = cell === "not yet";
									return (
										<td key={i} className={cn("px-2 py-1 align-top", missing ? "font-ui text-[13px] italic text-ink-3" : "text-foreground")} lang={missing ? undefined : "sk"}>
											{cell}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function GrammarExplain({ explain }: { explain: LessonExplain }) {
	const link = isAllowedReferenceUrl(explain.wiki) ? explain.wiki : null;
	return (
		<div className="flex flex-col gap-4 font-prose text-[15px] leading-relaxed" data-testid="grammar-explain" data-checked={explain.checked ?? "unchecked"}>
			<Contrast c={explain.contrast} />
			{explain.timeline && <Timeline t={explain.timeline} />}
			{explain.points && explain.points.length > 0 && (
				<ol className="flex list-decimal flex-col gap-1 pl-5 text-foreground marker:text-ink-3" data-testid="explain-points">
					{explain.points.map((p) => (
						<li key={p}>{p}</li>
					))}
				</ol>
			)}
			{explain.tables?.map((grid) => (
				<CaseGrid key={grid.title} grid={grid} />
			))}
			{explain.tables && explain.tables.length > 0 && (
				<p className="font-ui text-[12.5px] text-ink-3">N nominative, G genitive, D dative, A accusative, L locative, I instrumental.</p>
			)}
			<p className="text-foreground">
				<span className={cn(LABEL, "mr-2")}>Trap</span>
				{explain.trap}
			</p>
			{link && (
				<a href={link} target="_blank" rel="noopener noreferrer" className="font-ui text-[13px] font-[550] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2">
					The grammar page on slovak.wiki
				</a>
			)}
		</div>
	);
}
