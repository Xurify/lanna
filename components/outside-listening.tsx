"use client";

/**
 * Listening outside the app, on Today (2026-11-07): log a stretch of a
 * podcast, TV or a video elsewhere as focused or background, and see the
 * last 14 days. It stays apart from the measured minutes; the milestones page
 * counts focused time at OUTSIDE_WEIGHT.focused (src/core/outside.ts).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { QIcon } from "@/components/quiet/icon";
import { Chips, NumberPicker } from "@/components/onboarding/controls";
import { SourcesNote } from "@/components/sources/sources-note";
import {
	MAX_ENTRY_MINUTES,
	MAX_WHAT,
	OUTSIDE_WEIGHT,
	type Attention,
	type OutsideEntry,
	type OutsideSummary,
} from "@/src/core";

interface State {
	recent: OutsideEntry[];
	summary: OutsideSummary;
	days: string[];
}

const QUICK = [15, 30, 60, 120] as const;
const ATTENTION: ReadonlyArray<{ id: Attention; title: string; hint: string }> = [
	{ id: "focused", title: "Focused", hint: "You followed it and did little else" },
	{ id: "background", title: "In the background", hint: "It played while you did something else" },
];

const tz = () => new Date().getTimezoneOffset();

function dayLabel(key: string, days: string[]): string {
	if (key === days[0]) return "Today";
	if (key === days[1]) return "Yesterday";
	return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });
}

export function OutsideListening() {
	const [state, setState] = useState<State | null>(null);
	const [open, setOpen] = useState(false);
	const [minutes, setMinutes] = useState(30);
	const [attention, setAttention] = useState<Attention | null>(null);
	const [day, setDay] = useState<string | null>(null);
	const [what, setWhat] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(() => {
		void fetch(`/api/outside?tz=${tz()}`)
			.then((r) => (r.ok ? (r.json() as Promise<State>) : null))
			.then((x) => x && setState(x))
			.catch(() => {});
	}, []);
	useEffect(() => load(), [load]);

	const save = async () => {
		if (!attention || !state) return;
		setBusy(true);
		setError(null);
		try {
			const r = await fetch(`/api/outside?tz=${tz()}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					minutes,
					attention,
					day: day ?? state.days[0],
					...(what.trim() ? { what: what.trim() } : {}),
				}),
			});
			const body = (await r.json()) as { state?: State; message?: string };
			if (!r.ok || !body.state) throw new Error(body.message ?? `Could not save (${r.status})`);
			setState(body.state);
			setOpen(false);
			setWhat("");
			setAttention(null);
			setDay(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	const remove = async (id: string) => {
		const r = await fetch(`/api/outside?id=${encodeURIComponent(id)}&tz=${tz()}`, { method: "DELETE" }).catch(
			() => null,
		);
		const body = r?.ok ? ((await r.json()) as { state?: State }) : null;
		if (body?.state) setState(body.state);
		else load();
	};

	const s = state?.summary;
	const days = state?.days ?? [];
	return (
		<section
			className="mt-6 q-rise @max-6xl:mt-5"
			style={{ animationDelay: ".09s" }}
			data-testid="outside-listening"
			aria-label="Listening outside the app"
		>
			<h2 className="q-sh">
				<QIcon name="ear" />
				Listening outside the app
				{!open && (
					<button
						type="button"
						onClick={() => setOpen(true)}
						data-testid="outside-open"
						className="lh-press order-3 -my-1 inline-flex h-7 items-center rounded-md bg-well px-2.5 text-[12.5px] font-[550] text-ink-2 hover:bg-well-2 hover:text-foreground pointer-coarse:h-11"
					>
						Log listening
					</button>
				)}
			</h2>
			<p className="text-[14px] text-ink-3" data-testid="outside-summary">
				{!s
					? " "
					: s.entries === 0
						? "A podcast, TV or a video in another player. The app cannot measure it, so it is kept apart from your minutes, XP and streak."
						: `Last 14 days: about ${Math.round(s.focusedPerDay)} min a day focused and ${Math.round(s.backgroundPerDay)} in the background. Kept apart from your measured minutes; `}
				{s && s.entries > 0 && (
					<>
						<Link href="/milestones" className="font-[550] text-ink-2 underline underline-offset-2">
							Milestones
						</Link>{" "}
						counts focused time at {OUTSIDE_WEIGHT.focused === 0.5 ? "half" : `${OUTSIDE_WEIGHT.focused}×`}
						{OUTSIDE_WEIGHT.background === 0 ? " and background time not at all" : ""}.
					</>
				)}
			</p>

			{open && state && (
				<div className="mt-3 flex flex-col gap-4 rounded-[10px] bg-well p-4" data-testid="outside-form">
					<div>
						<p className="mb-2 text-[13px] font-[550] text-ink-2">How long</p>
						<NumberPicker
							value={minutes}
							onChange={setMinutes}
							quick={QUICK}
							min={1}
							max={MAX_ENTRY_MINUTES}
							step={5}
							unit="min"
							label="Minutes listened"
							testid="outside-minutes"
						/>
					</div>
					<div>
						<p className="mb-2 text-[13px] font-[550] text-ink-2">How you listened</p>
						<Chips
							items={ATTENTION}
							value={attention}
							onPick={setAttention}
							label="How you listened"
							testid="outside-attention"
						/>
						<p className="mt-1.5 text-[13px] text-ink-3">
							{attention
								? ATTENTION.find((a) => a.id === attention)!.hint
								: "Pick one. Background time is kept, but no estimate counts it."}
						</p>
					</div>
					<div>
						<p className="mb-2 text-[13px] font-[550] text-ink-2">When</p>
						<Chips
							items={days.slice(0, 3).map((d) => ({ id: d, title: dayLabel(d, days) }))}
							value={day ?? days[0] ?? null}
							onPick={setDay}
							label="Day listened"
							testid="outside-day"
						/>
					</div>
					<label className="block">
						<span className="mb-2 block text-[13px] font-[550] text-ink-2">What it was (optional)</span>
						<input
							type="text"
							value={what}
							maxLength={MAX_WHAT}
							onChange={(e) => setWhat(e.target.value)}
							placeholder="A podcast, a show, a channel"
							className="h-10 w-full rounded-lg bg-card px-3 text-[15px] text-foreground shadow-[0_0_0_1px_var(--q-line-2)] outline-none focus:shadow-[0_0_0_2px_var(--q-teal)]"
							data-testid="outside-what"
						/>
					</label>
					{error && (
						<p className="text-[14px] text-miss" role="alert">
							{error}
						</p>
					)}
					<div className="q-acts" style={{ marginTop: 0 }}>
						<button
							type="button"
							className="q-btn primary"
							onClick={() => void save()}
							disabled={busy || !attention}
							data-testid="outside-save"
						>
							Log {minutes} min
						</button>
						<button type="button" className="q-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
							Cancel
						</button>
					</div>
					<SourcesNote feature="outside" />
				</div>
			)}

			{state && state.recent.length > 0 && (
				<ol className="mt-2 divide-y divide-[var(--q-line)]" data-testid="outside-recent">
					{state.recent.slice(0, 4).map((e) => (
						<li key={e.id} className="flex items-center gap-3 py-2 text-[14px]">
							<span className="q-num w-16 shrink-0 text-ink-3">{dayLabel(e.day, days)}</span>
							<span className="min-w-0 flex-1 truncate text-foreground">{e.what ?? "Listening"}</span>
							<span className="q-pill grey shrink-0">{e.attention === "focused" ? "Focused" : "Background"}</span>
							<span className="q-num w-14 shrink-0 text-right text-ink-3">{e.minutes} min</span>
							<button
								type="button"
								onClick={() => void remove(e.id)}
								aria-label={`Remove ${e.minutes} min of ${e.what ?? "listening"}`}
								className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-well hover:text-foreground pointer-coarse:size-11"
							>
								<XIcon className="size-4" strokeWidth={1.8} aria-hidden="true" />
							</button>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
