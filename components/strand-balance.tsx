"use client";

/**
 * This week's balance (LangHarness, 2026-10-28) — the week's minutes by
 * Nation's four strands against a quarter each. One bar per strand with
 * the quarter marked, and one line saying which strand is furthest behind
 * and where it grows. The minutes are measured while the learner was active
 * (src/core/active-time.ts), with the plan's estimate per activity for what
 * has no timer (src/core/strands.ts); the card says which, because a learner
 * who sees "76% words & rules" should know how it was counted.
 */

import { HeadphonesIcon, MessagesSquareIcon, PencilRulerIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STRAND_STYLE } from "@/components/strand-style";
import { STRANDS, strandAdvice, strandCaption, type Strand, type StrandBalance as Balance } from "@/src/core";
import { fillStyle } from "@/components/ui/fill";

export const STRAND_ICON: Record<Strand, React.ComponentType<{ className?: string }>> = {
	input: HeadphonesIcon,
	output: MessagesSquareIcon,
	form: PencilRulerIcon,
	fluency: ZapIcon,
};

export function StrandBalance({ balance }: { balance: Balance | null }) {
	if (!balance) return null;
	const max = Math.max(balance.target * 2, ...STRANDS.map((s) => balance.share[s.id]));
	return (
		<div data-testid="strand-balance" aria-label="This week's balance">
			<ul className="flex flex-col gap-2">
				{STRANDS.map((s) => {
					const share = balance.share[s.id];
					const pct = Math.round(share * 100);
					const behind = balance.behind === s.id;
					const Icon = STRAND_ICON[s.id];
					return (
						<li key={s.id} className="grid grid-cols-[7.5rem_1fr_2.75rem] items-center gap-3" title={`${s.title}: ${s.line} · ${balance.minutes[s.id]} min`}>
							<span className={cn("flex items-center gap-1.5 text-sm font-bold", STRAND_STYLE[s.id].text)}>
								<Icon className="size-4 shrink-0" />
								<span className="truncate">{s.title}</span>
							</span>
							<span className="relative h-2 overflow-hidden rounded-full bg-accent" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${s.title}: ${pct}% of the week`}>
								<span className={cn("lh-fill absolute inset-0 rounded-full", STRAND_STYLE[s.id].bar)} style={fillStyle(share / max)} />
								{/* The quarter mark. */}
								<span className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: `${(balance.target / max) * 100}%` }} aria-hidden="true" />
							</span>
							<span className={cn("text-right text-sm font-bold tabular-nums", behind ? "text-foreground" : "text-muted-foreground")}>{pct}%</span>
						</li>
					);
				})}
			</ul>
			<p className="mt-3 text-sm text-pretty text-foreground/85" data-testid="strand-advice">
				{strandAdvice(balance)}
			</p>
			<p className="mt-1 text-xs text-muted-foreground" data-testid="strand-caption">
				{strandCaption(balance)}
			</p>
		</div>
	);
}
