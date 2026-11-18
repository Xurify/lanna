"use client";

import { useState } from "react";
import { SpeakHeader } from "@/components/speak/speak-header";
import { IslandChart } from "@/components/speak/islands/island-chart";
import { LoaderCircleIcon } from "lucide-react";
import { IslandDetail } from "@/components/speak/islands/island-detail";
import { PRIMARY } from "@/components/ui/learn-buttons";
import type { IslandPageData, LiveAvailability } from "@/src/core";

type PageResponse = Partial<IslandPageData> & { id?: string; message?: string };

export function IslandsPage({
	initial,
	initialId,
	live,
}: {
	initial: IslandPageData;
	initialId: string | null;
	live: LiveAvailability;
}) {
	const [data, setData] = useState(initial);
	const [selectedId, setSelectedId] = useState<string | null>(initialId);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [custom, setCustom] = useState("");
	const selected = data.islands.find((s) => s.island.id === selectedId) ?? null;

	function apply(out: PageResponse, id?: string): void {
		setData((current) => ({
			islands: out.islands ?? current.islands,
			topics: out.topics ?? current.topics,
			due: out.due ?? current.due,
			level: out.level ?? current.level,
		}));
		if (id) setSelectedId(id);
	}

	async function start(body: { topicId?: string; topic?: string }): Promise<void> {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/islands", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			const out = (await res.json().catch(() => ({}))) as PageResponse;
			if (!res.ok || !out.islands) throw new Error(out.message ?? `HTTP ${res.status}`);
			apply(out, out.id);
			setCustom("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="@container mx-auto max-w-3xl px-5 pt-[5vh] pb-24">
			{selected ? (
				<IslandDetail
					summary={selected}
					level={data.level}
					live={live}
					onBack={() => setSelectedId(null)}
					onPage={(page) => apply(page)}
				/>
			) : (
				<>
					<SpeakHeader
						title="Language islands"
						lead="One topic, about twenty chunks, said out loud until you can hold a conversation about it."
					/>

					{data.due.length > 0 && (
						<section className="mt-8" aria-labelledby="due-heading">
							<h2 id="due-heading" className="q-sh">
								Back to it
							</h2>
							<ul className="divide-y divide-[var(--q-line)]">
								{data.due.map((island) => (
									<li key={island.id}>
										<button
											type="button"
											onClick={() => setSelectedId(island.id)}
											className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-well/60"
										>
											<span className="font-ui text-[15px] font-[600] text-foreground">{island.topic}</span>
											<span className="shrink-0 font-prose text-[13px] text-ink-3">
												{island.faded
													? "faded to Holding"
													: `fades in ${island.daysLeft} ${island.daysLeft === 1 ? "day" : "days"}`}
											</span>
										</button>
									</li>
								))}
							</ul>
						</section>
					)}

					<IslandChart
						data={data}
						busy={busy}
						onOpen={setSelectedId}
						onStart={(t) => void start(t.topicId ? { topicId: t.topicId } : { topic: t.title })}
					/>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (custom.trim()) void start({ topic: custom.trim() });
						}}
						className="mt-6 flex flex-col gap-2 @md:flex-row"
					>
						<input
							value={custom}
							onChange={(e) => setCustom(e.target.value)}
							placeholder="Something else, in your own words"
							aria-label="A topic of your own"
							maxLength={80}
							className="h-9 min-w-0 flex-1 rounded-md bg-well px-3 font-prose text-[15px] text-foreground outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
						/>
						<button type="submit" disabled={busy || !custom.trim()} className={PRIMARY}>
							{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
							{busy ? "Writing the vault…" : "Start"}
						</button>
					</form>

					{error && (
						<p className="mt-5 font-prose text-[14px] text-destructive" role="alert">
							{error}
						</p>
					)}

					<p className="mt-12 max-w-2xl font-ui text-xs text-ink-3">
						Islands that share words link to each other. Each chunk is checked against the dictionary; one it cannot
						confirm is left out, not guessed. Rehearsal time counts toward Speaking.
					</p>
				</>
			)}
		</div>
	);
}
