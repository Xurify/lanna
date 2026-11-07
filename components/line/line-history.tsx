/**
 * The last 14 days of today's line (LangHarness, 2026-11-06). One column a
 * day, two marks: the morning in the app's de-emphasis gray, the evening in
 * the teal, joined by a hairline when both are in, so the lift from one to the
 * other is the shape the eye reads (the "emphasis" form: one hue plus gray;
 * the pair passes the CVD and normal-vision separation checks on both themes,
 * and the legend and today's figures in the caption carry identity besides the
 * color). Built from HTML columns, not an SVG, so the text keeps its size on a
 * phone. A table twin sits behind one button, so every value is reachable
 * without the chart.
 */

import { cn } from "@/lib/utils";
import type { LineDay } from "@/src/core";

const PLOT_HEIGHT = 132;
const DOT = 9;
const RING = 2;

function share(h: { caught: number; words: number } | null): number | null {
	if (!h || h.words === 0) return null;
	return h.caught / h.words;
}

function monthDay(day: string): string {
	return String(Number(day.slice(8, 10)));
}

function longDay(day: string): string {
	return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function count(h: { caught: number; words: number } | null): string {
	return h ? `${h.caught} of ${h.words}` : "not heard";
}

/** A mark at its share of the plot, from the baseline. */
function Dot({ at, tone }: { at: number; tone: "morning" | "evening" }) {
	return (
		<span
			aria-hidden="true"
			className={cn("absolute left-1/2 rounded-full border-solid", tone === "evening" ? "bg-teal" : "bg-[var(--q-bar)]")}
			style={{
				width: DOT + RING * 2,
				height: DOT + RING * 2,
				borderWidth: RING,
				borderColor: "var(--q-well)",
				bottom: `calc(${at * 100}% - ${(DOT + RING * 2) / 2}px)`,
				transform: "translateX(-50%)",
			}}
		/>
	);
}

export function LineHistory({ days, showTable, onToggleTable }: { days: readonly LineDay[]; showTable: boolean; onToggleTable: () => void }) {
	const heard = days.some((d) => d.morning || d.evening);
	const today = days[days.length - 1];
	const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
	return (
		<section data-testid="line-history" aria-label="The last 14 days">
			<h2 className="q-sh">
				<svg viewBox="0 0 24 24" className="q-ico" aria-hidden="true">
					<path d="M4 18h16M6 14l4-5 4 3 4-6" />
				</svg>
				The last 14 days
			</h2>
			<figure className="q-well" aria-label="Words caught on each of the last 14 days, at the first hearing and at the second">
				<div className="grid grid-cols-[30px_1fr] gap-x-2">
					<div className="relative" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
						{[
							["all", 1],
							["half", 0.5],
							["none", 0],
						].map(([label, s]) => (
							<span key={label} className="absolute left-0 -translate-y-1/2 font-ui text-[11px] text-ink-3" style={{ top: `${(1 - (s as number)) * 100}%` }}>
								{label}
							</span>
						))}
					</div>
					<div className="relative" style={{ height: PLOT_HEIGHT }}>
						{[1, 0.5, 0].map((s) => (
							<span key={s} aria-hidden="true" className="absolute inset-x-0 h-px bg-[var(--q-line)]" style={{ top: `${(1 - s) * 100}%` }} />
						))}
						<div className="absolute inset-0 grid" style={columns}>
							{days.map((d) => {
								const m = share(d.morning);
								const e = share(d.evening);
								const lo = m !== null && e !== null ? Math.min(m, e) : null;
								const hi = m !== null && e !== null ? Math.max(m, e) : null;
								return (
									<div key={d.day} className="relative" title={`${longDay(d.day)} · first ${count(d.morning)} · second ${count(d.evening)}`} data-day={d.day}>
										{lo !== null && hi !== null && (
											<span aria-hidden="true" className="absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-[var(--q-line-2)]" style={{ bottom: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }} />
										)}
										{m !== null && <Dot at={m} tone="morning" />}
										{e !== null && <Dot at={e} tone="evening" />}
									</div>
								);
							})}
						</div>
						{!heard && <p className="absolute inset-0 flex items-center justify-center font-ui text-[13px] text-ink-3">Nothing heard yet. The first mark lands today.</p>}
					</div>
					<span aria-hidden="true" />
					<div className="mt-2 grid" style={columns} aria-hidden="true">
						{days.map((d, i) => (
							<span key={d.day} className={cn("text-center font-ui text-[11px] tabular-nums", i === days.length - 1 ? "font-[550] text-ink-2" : "text-ink-3")}>
								{monthDay(d.day)}
							</span>
						))}
					</div>
				</div>
				<figcaption className="q-legend">
					<span>
						<i style={{ background: "var(--q-bar)" }} />
						First hearing, no text
					</span>
					<span>
						<i style={{ background: "var(--q-teal)" }} />
						Second hearing, after practice
					</span>
					{today && (
						<b className="ml-auto" data-testid="line-history-today">
							Today: {today.morning ? count(today.morning) : "not heard yet"}
							{today.evening && ` → ${count(today.evening)}`}
						</b>
					)}
				</figcaption>
			</figure>
			<p className="mt-2 font-ui text-xs text-ink-3" data-testid="line-history-note">
				The second hearing comes after you have seen the sentence, so the gap between the two marks shows what you remember, not how much better you hear.
			</p>
			<div className="mt-2 flex items-center">
				<button type="button" className="q-btn ghost -ml-2.5" onClick={onToggleTable} aria-expanded={showTable} aria-controls="line-history-table">
					{showTable ? "Hide the table" : "Show as a table"}
				</button>
			</div>
			{showTable && (
				<ol id="line-history-table" className="mt-2 divide-y divide-[var(--q-line)] rounded-[10px] bg-well" data-testid="line-history-table">
					{[...days].reverse().map((d) => (
						<li key={d.day} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5 px-4 py-2 text-[13.5px]">
							<span className="text-ink-2">{longDay(d.day)}</span>
							<span className="q-num text-ink-3">first {d.morning ? `${d.morning.caught} of ${d.morning.words}` : "—"}</span>
							<span className="q-num text-ink-3">second {d.evening ? `${d.evening.caught} of ${d.evening.words}` : "—"}</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
