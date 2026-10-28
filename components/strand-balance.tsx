"use client";

/**
 * This week's balance (LangHarness, 2026-10-28) — the week's minutes by
 * Nation's four strands against a quarter each, under the daily plan.
 * One bar per strand with the target marked, and one line saying which
 * strand is furthest behind and where it grows. The minutes are the
 * plan's estimates per activity (src/core/strands.ts), and the strip
 * says so, because a learner who sees "76% words & rules" should know
 * how it was counted.
 */

import { HeadphonesIcon, MessagesSquareIcon, PencilRulerIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STRANDS, strandAdvice, type Strand, type StrandBalance as Balance } from "@/src/core";

const INK: Record<Strand, { bar: string; text: string; icon: React.ReactNode }> = {
	input: { bar: "bg-sky", text: "text-sky", icon: <HeadphonesIcon className="size-3.5" /> },
	output: { bar: "bg-xp", text: "text-xp", icon: <MessagesSquareIcon className="size-3.5" /> },
	form: { bar: "bg-go", text: "text-go", icon: <PencilRulerIcon className="size-3.5" /> },
	fluency: { bar: "bg-gold", text: "text-gold", icon: <ZapIcon className="size-3.5" /> },
};

export function StrandBalance({ balance }: { balance: Balance | null }) {
	if (!balance) return null;
	const max = Math.max(balance.target * 2, ...STRANDS.map((s) => balance.share[s.id]));
	return (
		<div className="mt-4 border-t pt-4" data-testid="strand-balance" aria-label="This week's balance">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">This week&apos;s balance</p>
				<p className="font-ui text-xs text-muted-foreground">
					{balance.total > 0 ? `about ${Math.round(balance.total)} min · a quarter each is the aim` : "a quarter each is the aim"}
				</p>
			</div>
			<ul className="mt-2 grid gap-1.5 sm:grid-cols-2 sm:gap-x-6">
				{STRANDS.map((s) => {
					const share = balance.share[s.id];
					const pct = Math.round(share * 100);
					const behind = balance.behind === s.id;
					return (
						<li key={s.id} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2" title={`${s.title}: ${s.line} · ${balance.minutes[s.id]} min`}>
							<span className={cn("flex items-center gap-1.5 font-ui text-xs font-bold", INK[s.id].text)}>
								{INK[s.id].icon}
								{s.title}
							</span>
							<span className="relative h-2.5 overflow-hidden rounded-full bg-accent" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${s.title}: ${pct}% of the week`}>
								<span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", INK[s.id].bar, behind && "opacity-70")} style={{ width: `${Math.min(100, (share / max) * 100)}%` }} />
								{/* The quarter mark. */}
								<span className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${(balance.target / max) * 100}%` }} aria-hidden="true" />
							</span>
							<span className={cn("text-right font-ui text-xs font-bold tabular-nums", behind ? "text-foreground" : "text-muted-foreground")}>{pct}%</span>
						</li>
					);
				})}
			</ul>
			<p className="mt-2 font-prose text-sm text-muted-foreground" data-testid="strand-advice">
				{strandAdvice(balance)} <span className="text-muted-foreground/70">Minutes are the plan&apos;s estimates per activity.</span>
			</p>
		</div>
	);
}
