"use client";

import { CheckIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface CommonWord {
	slug: string;
	lemma: string;
	gloss: string;
	rank: number;
	known: boolean;
}

type Filter = "all" | "unknown";

const BAND_SIZE = 100;
const WHOLE_RANKING = 100_000;
// Adolphs & Schmitt (2007): 2,000 word families cover most casual text; 500 is a usable starter.
const PRESETS = [200, 500, 1000, 2000];
const number = (value: number) => value.toLocaleString("en-US");

function bandsOf(words: CommonWord[]) {
	const bands: { from: number; to: number; words: CommonWord[]; known: number }[] = [];
	for (let start = 0; start < words.length; start += BAND_SIZE) {
		const slice = words.slice(start, start + BAND_SIZE);
		bands.push({
			from: slice[0]!.rank,
			to: slice.at(-1)!.rank,
			words: slice,
			known: slice.filter((word) => word.known).length,
		});
	}
	return bands;
}

export function CommonWords({ onKnownChange }: { onKnownChange: () => void }) {
	const [count, setCount] = useState(0);
	const [ranking, setRanking] = useState<{ total: number; items: CommonWord[] } | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [confirming, setConfirming] = useState(false);
	const [saving, setSaving] = useState<string | null>(null);
	const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [reload, setReload] = useState(0);
	const selected = ranking ? ranking.items.slice(0, count) : [];
	const knownCount = selected.filter((word) => word.known).length;
	const unmarked = selected.length - knownCount;
	const total = ranking?.total ?? 0;
	const listedCount = useDeferredValue(count);
	const bands = useMemo(() => bandsOf(ranking ? ranking.items.slice(0, listedCount) : []), [ranking, listedCount]);
	const stops = useMemo(() => {
		const presets = PRESETS.filter((preset) => preset < total);
		const values = [0, ...presets, total];
		return values.map((val) => ({
			value: val,
			label: val === 0 ? "0" : val === total ? "All" : number(val),
		}));
	}, [total]);

	useEffect(() => {
		const controller = new AbortController();
		fetch(`/api/words/common?count=${WHOLE_RANKING}`, { signal: controller.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error("Could not load common words. Try again.");
				return res.json() as Promise<{ total: number; items: CommonWord[] }>;
			})
			.then((data) => {
				if (controller.signal.aborted) return;
				setRanking(data);
				setCount((value) => Math.min(value, data.total));
			})
			.catch((err: unknown) => {
				if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load words.");
			});
		return () => controller.abort();
	}, [reload]);

	function selectCount(next: number) {
		setCount(next);
		setConfirming(false);
		setNotice("");
	}

	function setKnown(isTarget: (word: CommonWord) => boolean, known: boolean) {
		setRanking(
			(current) =>
				current && {
					...current,
					items: current.items.map((word) => (isTarget(word) ? { ...word, known } : word)),
				},
		);
	}

	async function toggle(word: CommonWord) {
		if (pending.has(word.slug)) return;
		const known = !word.known;
		setPending((current) => new Set(current).add(word.slug));
		setKnown((item) => item.slug === word.slug, known);
		setError("");
		try {
			const res = await fetch("/api/words/known", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug: word.slug, known }),
			});
			if (!res.ok) throw new Error();
			onKnownChange();
		} catch {
			setKnown((item) => item.slug === word.slug, word.known);
			setError(`Could not save ${word.lemma}. Try again.`);
		} finally {
			setPending((current) => {
				const next = new Set(current);
				next.delete(word.slug);
				return next;
			});
		}
	}

	async function markRange(from: number, to: number) {
		if (saving) return;
		const key = `${from}-${to}`;
		setSaving(key);
		setError("");
		setNotice("");
		try {
			const res = await fetch("/api/words/common", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ from, count: to }),
			});
			if (!res.ok) throw new Error();
			const result = (await res.json()) as { added: number };
			setKnown((word) => word.rank >= from && word.rank <= to, true);
			setConfirming(false);
			setNotice(`${number(result.added)} words from ${number(from)} to ${number(to)} marked known.`);
			onKnownChange();
		} catch {
			setError("Could not save known words. Try again.");
		} finally {
			setSaving(null);
		}
	}

	if (!ranking)
		return (
			<section aria-labelledby="common-words-title" className="space-y-3">
				<Intro />
				{error ? (
					<div role="alert" className="space-y-2">
						<p className="font-prose text-sm text-foreground">{error}</p>
						<Button
							variant="outline"
							onClick={() => {
								setError("");
								setReload((v) => v + 1);
							}}
						>
							Try again
						</Button>
					</div>
				) : (
					<p className="q-sub" role="status">
						Loading common words…
					</p>
				)}
			</section>
		);

	if (ranking.total === 0)
		return (
			<section aria-labelledby="common-words-title" className="space-y-3">
				<Intro />
				<p className="q-sub">This language has no dictionary words yet.</p>
			</section>
		);

	return (
		<section aria-labelledby="common-words-title" className="space-y-6">
			<Intro />
			<div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
				<Slider
					header
					label="Most common"
					value={Math.min(count, total)}
					onChange={selectCount}
					stops={stops}
					valueText={
						count === 0
							? "0 words"
							: count >= total
								? `All ${number(total)} words`
								: `Top ${number(selected.length)} of ${number(total)}`
					}
					testid="common-words-slider"
					valueTestid="common-words-count"
				/>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="font-prose text-sm text-muted-foreground" data-testid="common-words-summary">
						<span className="font-semibold text-foreground tabular-nums">{number(knownCount)}</span> known,{" "}
						<span className="font-semibold text-foreground tabular-nums">{number(unmarked)}</span> to learn
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<FilterSwitch value={filter} onChange={setFilter} />
						{!confirming && (
							<Button disabled={saving !== null || unmarked === 0} onClick={() => setConfirming(true)}>
								{count === 0 ? "Mark known" : unmarked === 0 ? "All marked known" : `Mark ${number(unmarked)} known`}
							</Button>
						)}
					</div>
				</div>
				{confirming && (
					<div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
						<p className="min-w-0 flex-1 font-prose text-sm text-foreground">
							Mark {number(unmarked)} more words as known? Words you marked before stay marked, and you can undo any
							word by tapping it.
						</p>
						<div className="flex gap-2">
							<Button variant="outline" disabled={saving !== null} onClick={() => setConfirming(false)}>
								Cancel
							</Button>
							<Button disabled={saving !== null} onClick={() => void markRange(1, selected.length)}>
								{saving === `1-${selected.length}` ? "Saving…" : "Mark known"}
							</Button>
						</div>
					</div>
				)}
				<p role="status" className="min-h-5 font-prose text-sm text-muted-foreground empty:hidden">
					{notice}
				</p>
				{error && (
					<p role="alert" className="font-prose text-sm text-foreground">
						{error}
					</p>
				)}
			</div>
			<p className="font-prose text-sm text-muted-foreground">
				{count === 0
					? "Slide or tap a segment to select common words to view and mark."
					: "Tap a word to mark or un-mark it."}
			</p>
			<div className="space-y-10">
				{bands.map((band) => (
					<Band
						key={band.from}
						{...band}
						filter={filter}
						pending={pending}
						saving={saving === `${band.from}-${band.to}`}
						savingOther={saving !== null}
						onToggle={(word) => void toggle(word)}
						onMarkAll={() => void markRange(band.from, band.to)}
					/>
				))}
			</div>
		</section>
	);
}

function Intro() {
	return (
		<div>
			<h2 id="common-words-title" className="font-title text-xl font-semibold text-foreground">
				Most common words
			</h2>
			<p className="q-sub max-w-[65ch]">
				Ordered by use in this dictionary&apos;s example sentences, not a national corpus. Mark the words you already
				know so Read, Listen and Watch can choose material at your level. These are your own marks, not tested recall;
				your Review schedule stays unchanged.
			</p>
		</div>
	);
}

function FilterSwitch({ value, onChange }: { value: Filter; onChange: (next: Filter) => void }) {
	const options: { id: Filter; label: string }[] = [
		{ id: "all", label: "All" },
		{ id: "unknown", label: "To learn" },
	];
	return (
		<div role="group" aria-label="Show" className="flex rounded-lg bg-well p-0.5">
			{options.map((option) => (
				<button
					key={option.id}
					type="button"
					aria-pressed={value === option.id}
					onClick={() => onChange(option.id)}
					className={cn(
						"h-8 rounded-md px-3 font-ui text-sm transition-colors",
						value === option.id
							? "bg-card font-semibold text-foreground shadow-[0_0_0_1px_var(--q-line-2)]"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<span className="cap-center">{option.label}</span>
				</button>
			))}
		</div>
	);
}

function Band({
	from,
	to,
	words,
	known,
	filter,
	pending,
	saving,
	savingOther,
	onToggle,
	onMarkAll,
}: {
	from: number;
	to: number;
	words: CommonWord[];
	known: number;
	filter: Filter;
	pending: ReadonlySet<string>;
	saving: boolean;
	savingOther: boolean;
	onToggle: (word: CommonWord) => void;
	onMarkAll: () => void;
}) {
	const visible = filter === "unknown" ? words.filter((word) => !word.known) : words;
	const left = words.length - known;
	const titleId = `common-band-${from}`;
	return (
		<section
			aria-labelledby={titleId}
			className="-m-1 p-1 [content-visibility:auto] [contain-intrinsic-size:auto_488px]"
		>
			<div className="flex min-h-9 items-center gap-3">
				<h3 id={titleId} className="w-20 shrink-0 font-ui text-sm sm:w-24 font-semibold text-foreground tabular-nums">
					{number(from)}–{number(to)}
				</h3>
				<div
					role="progressbar"
					aria-label={`Words ${number(from)} to ${number(to)} known`}
					aria-valuemin={0}
					aria-valuemax={words.length}
					aria-valuenow={known}
					className="h-[3px] min-w-12 flex-1 overflow-hidden rounded-full bg-line-2"
				>
					<div className="h-full rounded-full bg-teal" style={{ width: `${(known / words.length) * 100}%` }} />
				</div>
				<span className="shrink-0 font-ui text-xs text-muted-foreground tabular-nums">
					{known} of {words.length}
				</span>
				<Button
					variant="ghost"
					size="sm"
					className={cn("px-2 sm:w-32", left === 0 && "invisible")}
					disabled={savingOther || left === 0}
					onClick={onMarkAll}
					aria-label={`Mark words ${number(from)} to ${number(to)} known`}
				>
					{saving ? "Saving…" : `Mark ${left} known`}
				</Button>
			</div>
			{visible.length === 0 ? (
				<p className="py-2 font-prose text-sm text-muted-foreground">All {words.length} known.</p>
			) : (
				<ol className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{visible.map((word) => (
						<li key={word.slug} className="min-w-0">
							<button
								type="button"
								aria-pressed={word.known}
								aria-label={`${word.lemma}, ${word.gloss}, rank ${word.rank}`}
								title={`${word.rank}. ${word.lemma}: ${word.gloss}`}
								disabled={pending.has(word.slug)}
								onClick={() => onToggle(word)}
								className={cn(
									"relative flex min-h-14 w-full flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-teal/40",
									word.known
										? "text-ink-2 hover:bg-well"
										: "bg-well-2 text-foreground shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well",
								)}
							>
								<span className="w-full overflow-x-clip pr-5 font-prose text-base font-semibold text-ellipsis whitespace-nowrap">
									{word.lemma}
								</span>
								<span className="w-full overflow-x-clip font-prose text-xs text-muted-foreground text-ellipsis whitespace-nowrap">
									{word.gloss}
								</span>
								{word.known && (
									<CheckIcon
										aria-hidden="true"
										className="absolute top-2 right-2 size-3.5 text-teal"
										strokeWidth={2.5}
									/>
								)}
							</button>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
