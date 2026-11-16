"use client";

/**
 * One day of the log (src/core/daylog.ts), in the Quiet tool look: the tasks
 * with their times, the rules met, the words added to Review, the mistakes and
 * the minutes by strand. An empty day says so in a sentence.
 */

import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import type { QIconName } from "@/components/quiet/icon-paths";
import { dayLogIsEmpty, STRANDS, type DayEntry, type DayLog } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

const KIND_ICON: Record<string, QIconName> = {
	lesson: "grammar",
	blitz: "fast",
	mixups: "mix",
	personal: "letter",
	listen: "listen",
	speak: "speak",
	fluency: "fast",
	review: "review",
};

export function EntryRow({ e }: { e: DayEntry }) {
	return (
		<li className="grid grid-cols-[44px_20px_minmax(0,1fr)] items-start gap-x-3 py-2.5" data-testid="log-entry">
			<time className="q-num pt-px text-[13px] text-ink-3">{e.time}</time>
			<span className="pt-0.5 text-ink-3">
				<QIcon name={KIND_ICON[e.kind] ?? "check"} />
			</span>
			<span className="min-w-0">
				<span className="block text-[15px] tracking-[-0.006em] text-foreground">{e.title}</span>
				<span className="block text-[13px] text-ink-3">{e.line}</span>
			</span>
		</li>
	);
}

export function DayLogView({ log, isToday }: { log: DayLog; isToday: boolean }) {
	const lang = useActiveLanguage();
	if (dayLogIsEmpty(log)) {
		return (
			<p className="q-line dim" data-testid="log-empty">
				{isToday
					? "Nothing yet today. Each finished task appears here with its time."
					: "Nothing was recorded on this day."}
			</p>
		);
	}
	const total = Math.round(log.strands.total);
	const max = Math.max(1, ...STRANDS.map((s) => log.strands.minutes[s.id]));
	return (
		<div className="flex flex-col gap-6" data-testid="log-day">
			<section aria-label="Done">
				<h3 className="q-sh">
					<QIcon name="check" />
					Done
					{log.entries.length > 0 && (
						<small>
							{log.entries.length} {log.entries.length === 1 ? "entry" : "entries"}
						</small>
					)}
				</h3>
				{log.entries.length > 0 ? (
					<ol className="divide-y divide-[var(--q-line)]">
						{log.entries.map((e) => (
							<EntryRow key={`${e.at}-${e.kind}-${e.title}`} e={e} />
						))}
					</ol>
				) : (
					<p className="text-[14px] text-ink-3">No task with a time was finished on this day.</p>
				)}
				{log.also.length > 0 && <p className="mt-2 text-[13px] text-ink-3">Also: {log.also.join(", ")}.</p>}
			</section>

			{log.rules.length > 0 && (
				<section aria-label="Rules met">
					<h3 className="q-sh">
						<QIcon name="rule" />
						Rules met
					</h3>
					<ul className="flex flex-col gap-2">
						{log.rules.map((r) => (
							<li key={r.unit} className="text-[14px] text-ink-2">
								<b className="font-[550] text-foreground">{r.title}</b>
								<span className="q-num ml-2 text-[13px] text-ink-3">{r.time}</span>
								<span className="block text-[13px] text-ink-3">{r.rule}</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{log.words.length > 0 && (
				<section aria-label="Words added to Review">
					<h3 className="q-sh">
						<QIcon name="words" />
						Added to Review
						<small>
							{log.words.length} {log.words.length === 1 ? "word" : "words"}
						</small>
					</h3>
					<p className="text-[15px] leading-7 text-foreground" lang={lang?.code}>
						{log.words.map((w, i) => (
							<span key={w.lemma} title={w.gloss}>
								{i > 0 && <span className="text-ink-4"> · </span>}
								<b className="font-[550]">{w.lemma}</b> <span className="text-[13px] text-ink-3">{w.gloss}</span>
							</span>
						))}
					</p>
				</section>
			)}

			{log.mistakes.length > 0 && (
				<section aria-label="Mistakes">
					<h3 className="q-sh">
						<QIcon name="chart" />
						Mistakes
						<small>
							{log.mistakes.length} first {log.mistakes.length === 1 ? "try" : "tries"}
						</small>
					</h3>
					<ul className="flex flex-col gap-1.5">
						{log.mistakes.slice(0, 12).map((m, i) => (
							<li key={i} className="text-[14px] text-ink-2" lang={lang?.code}>
								<span className="q-num mr-2 text-[13px] text-ink-3">{m.time}</span>
								<span className="text-miss line-through decoration-1">{m.given}</span>{" "}
								<span className="text-ink-4">→</span> <b className="font-[550] text-foreground">{m.answer}</b>
							</li>
						))}
						{log.mistakes.length > 12 && <li className="text-[13px] text-ink-3">{log.mistakes.length - 12} more.</li>}
					</ul>
				</section>
			)}

			<section aria-label="Minutes by strand">
				<h3 className="q-sh">
					<QIcon name="chart" />
					Minutes
					{total > 0 && (
						<small>
							{total} min
							{log.strands.estimated > 0 ? `, ${Math.round(log.strands.estimated)} counted from the plan` : ""}
						</small>
					)}
				</h3>
				{total > 0 ? (
					<div className="q-bars with-mins" style={{ marginTop: 0 }}>
						{STRANDS.map((s) => {
							const m = log.strands.minutes[s.id];
							return (
								<div key={s.id} className="contents">
									<span className="lab">{s.title}</span>
									<span
										className="q-bar"
										role="meter"
										aria-valuemin={0}
										aria-valuemax={max}
										aria-valuenow={m}
										aria-label={`${s.title}: ${Math.round(m)} minutes`}
									>
										<i style={{ width: `${(m / max) * 100}%` }} />
									</span>
									<span className={cn("mins q-num", m === 0 && "text-ink-4")}>{Math.round(m)} min</span>
									<span className={cn("pct q-num", m === 0 && "text-ink-4")}>
										{total > 0 ? Math.round((m / total) * 100) : 0}%
									</span>
								</div>
							);
						})}
					</div>
				) : (
					<p className="text-[14px] text-ink-3">No minutes were counted on this day.</p>
				)}
			</section>
		</div>
	);
}
