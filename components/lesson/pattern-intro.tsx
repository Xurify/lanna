"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { COLUMN, PracticeCard } from "@/components/task-frame";
import { speak, useActiveLanguage } from "@/components/speech";
import { IntroDock } from "@/components/lesson/lesson-intro";
import { unitInfo, type LessonPlan, type PatternForm, type VerbPattern } from "@/src/core";

export function PatternIntro({
	plan,
	patterns,
	onStart,
}: {
	plan: LessonPlan;
	patterns: readonly VerbPattern[];
	onStart: () => void;
}) {
	const info = unitInfo(plan.unit);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || e.target instanceof HTMLButtonElement) return;
			e.preventDefault();
			onStart();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onStart]);

	return (
		<>
			<div className={cn(COLUMN, "lanna-rise flex flex-1 flex-col")}>
				<PracticeCard icon="rule" title={info.title} sub="The pattern">
					<p className="max-w-xl font-prose text-[16px] leading-relaxed text-ink-2" data-testid="pattern-rule">
						{info.rule}
					</p>
					<div
						className={cn("mt-6 grid gap-x-10 gap-y-8", patterns.length > 1 ? "sm:grid-cols-2" : "max-w-md")}
						data-testid="pattern-tables"
					>
						{patterns.map((p) => (
							<PatternTable key={p.verb} pattern={p} />
						))}
					</div>
				</PracticeCard>
			</div>
			<IntroDock step={0} finished single onBack={() => {}} onNext={onStart} onStart={onStart} />
		</>
	);
}

function PatternTable({ pattern }: { pattern: VerbPattern }) {
	const lang = useActiveLanguage();
	const say = (text: string) => lang && void speak(text, lang).catch(() => {});
	const spoken = (f: PatternForm) => `${f.stem}${f.ending}${f.tail ? ` ${f.tail}` : ""}`;
	return (
		<section>
			<h2 className="flex items-baseline gap-2.5">
				<span className="font-prose text-[24px] font-semibold tracking-[-0.02em] text-foreground" lang={lang?.code}>
					{pattern.verb}
				</span>
				<span className="font-ui text-[13px] text-ink-3">{pattern.gloss}</span>
			</h2>
			<ul className="mt-2 divide-y divide-[var(--q-line)]">
				{pattern.rows.map((row) => (
					<li key={row.who}>
						<button
							type="button"
							onClick={() => say(row.forms.map(spoken).join(", "))}
							className="grid w-full grid-cols-[7.5rem_1fr] items-baseline gap-3 rounded-[6px] py-1.5 text-left hover:bg-well sm:grid-cols-[9rem_1fr]"
						>
							<span className="font-ui text-[13px] text-ink-3">
								<span lang={lang?.code}>{row.who}</span>
								<span className="block text-[12px] text-ink-4">{row.en}</span>
							</span>
							<span className="font-prose text-[19px] text-foreground" lang={lang?.code}>
								{row.forms.map((f, i) => (
									<span key={i}>
										{i > 0 && <span className="text-ink-4"> · </span>}
										<span className="whitespace-nowrap">
											{f.stem}
											<span className="font-semibold text-teal-2">{f.ending}</span>
											{f.tail && <span className="text-ink-2"> {f.tail}</span>}
										</span>
									</span>
								))}
							</span>
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}
