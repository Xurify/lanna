"use client";

/**
 * Setup (LangHarness onboarding, 2026-10-28) — the minute that replaces
 * the placement chat. Four short screens, every one skippable, no model
 * call anywhere:
 *
 *   1  What Slovak is for    — can-do purposes that map onto the map's
 *                              goals and scenes; the target follows
 *   2  What you bring        — the languages you know and how well,
 *                              how much Slovak already
 *   3  Time                  — minutes a day, days a week, and the date
 *                              that pace reaches the target
 *   4  Where you stand       — the placement drill (src/core/onboarding.ts
 *                              staircase), or "start at the beginning"
 *
 * The profile is written to progress.json after screen 3 (PUT
 * /api/progress {goal}), so skipping the drill loses nothing; the drill's
 * result (POST /api/placement) tests units out and picks the first
 * chapter. Everything the tutor later needs is in that record.
 * ?edit=1 reopens the same screens pre-filled, with a re-check option.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, FlagIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitIcon } from "@/components/lesson/unit-icon";
import { startTutorChat } from "@/components/lesson/tutor";
import { PlacementDrill, type DrillRep, type DrillTier } from "@/components/onboarding/placement-drill";
import { Chips, explainChoices, LanguagePicker, NumberPicker, PickSome } from "@/components/onboarding/controls";
import { HoursSheet } from "@/components/hours-sheet";
import {
	CEFR_ORDER,
	CHAPTERS,
	DEFAULT_DAYS_PER_WEEK,
	etaFromScratch,
	explanationLanguages,
	GUIDED_HOURS,
	knownLanguages,
	MAX_EXPLAIN,
	MAX_PURPOSE_NOTE,
	MAX_PURPOSES,
	MINUTE_CHOICES,
	MAX_MINUTES,
	PRIORS,
	PURPOSES,
	purposePhrase,
	suggestedLevel,
	LEVEL_CAN_DO,
	levelFitLine,
	unitInfo,
	type Cefr,
	type Lang,
	type LangLevel,
	type LearnerGoal,
	type PlacementOutcome,
	type Prior,
	type Purpose,
	type UnitId,
} from "@/src/core";

type Step = 1 | 2 | 3 | 4;

interface Draft {
	purposes: Purpose[];
	purposeNote: string;
	examLevel: Cefr;
	levelOverride: Cefr | null;
	languages: Lang[];
	languageLevels: Partial<Record<Lang, LangLevel>>;
	explainIn: Lang[];
	prior: Prior;
	minutes: number;
	days: number;
}

const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
const PRIMARY = cn(BUTTON, "bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground disabled:hover:brightness-100");
const SECONDARY = cn(BUTTON, "border-2 border-foreground/20 px-5 text-foreground hover:bg-foreground/5");
const COLUMN = "mx-auto w-full max-w-2xl px-6";

/** When a language leaves the known list it leaves the explanation list too; English stands in for an empty one. */
export function keepExplain(explain: readonly Lang[], languages: readonly Lang[]): Lang[] {
	const kept = explain.filter((l) => l === "en" || languages.includes(l));
	return kept.length ? kept : ["en"];
}

function monthOf(iso: string | null): string {
	if (!iso) return "—";
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function draftFrom(goal: LearnerGoal | null): Draft {
	return {
		purposes: goal?.purposes ?? [],
		purposeNote: goal?.purposeNote ?? "",
		examLevel: "B1",
		levelOverride: goal?.onboardedAt && goal.level ? goal.level : null,
		languages: knownLanguages(goal),
		languageLevels: goal?.languageLevels ?? {},
		explainIn: explanationLanguages(goal),
		prior: goal?.prior ?? "none",
		minutes: goal?.minutesPerDay ?? 20,
		days: goal?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK,
	};
}

export function Start({ goal, edit, hoursDone, currentChapter }: { goal: LearnerGoal | null; edit: boolean; hoursDone: number; currentChapter: string }) {
	const router = useRouter();
	const [step, setStep] = useState<Step>(1);
	const [d, setD] = useState<Draft>(() => draftFrom(goal));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drill, setDrill] = useState<{ tiers: DrillTier[]; from: number } | null>(null);
	const [outcome, setOutcome] = useState<PlacementOutcome | null>(null);
	const [missed, setMissed] = useState<DrillRep[]>([]);
	const [drilling, setDrilling] = useState(false);
	const [hoursOpen, setHoursOpen] = useState(false);

	const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
	const suggested = suggestedLevel(d.purposes, d.examLevel);
	const level = d.levelOverride ?? suggested;
	const eta = etaFromScratch(level, d.minutes, d.days, hoursDone, new Date());
	const tz = new Date().getTimezoneOffset();

	// Enter moves on from the first three screens (not while typing).
	useEffect(() => {
		if (step === 4) return;
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (e.key !== "Enter" || (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA"))) return;
			e.preventDefault();
			void next();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const save = useCallback(
		async (extra: Record<string, unknown> = {}) => {
			setSaving(true);
			setError(null);
			try {
				const res = await fetch(`/api/progress?tz=${tz}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						goal: {
							level,
							minutesPerDay: d.minutes,
							daysPerWeek: d.days,
							purposes: d.purposes,
							purposeNote: d.purposes.includes("other") ? d.purposeNote : "",
							languages: d.languages,
							languageLevels: d.languageLevels,
							explainIn: d.explainIn,
							prior: d.prior,
							onboarded: true,
							...extra,
						},
					}),
				});
				if (!res.ok) throw new Error(String(res.status));
				return true;
			} catch {
				setError("Couldn't save. Try again.");
				return false;
			} finally {
				setSaving(false);
			}
		},
		[d, level, tz],
	);

	const next = async () => {
		if (step < 3) return setStep((step + 1) as Step);
		if (step === 3) {
			if (await save()) setStep(4);
		}
	};
	const skipAll = async () => {
		// Skipping still records that setup was seen, with sane defaults.
		if (await fetch(`/api/progress?tz=${tz}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: { onboarded: true } }) }).then((r) => r.ok).catch(() => false)) router.push("/");
	};

	const loadDrill = async (recheck: boolean) => {
		setDrilling(true);
		setError(null);
		try {
			const res = await fetch(`/api/placement${recheck ? "?recheck=1" : ""}`);
			if (!res.ok) throw new Error(String(res.status));
			setDrill((await res.json()) as { tiers: DrillTier[]; from: number });
		} catch {
			setError("Couldn't build the check. Try again.");
			setDrilling(false);
		}
	};

	const finishDrill = async (reps: DrillRep[], ms: number) => {
		setSaving(true);
		try {
			const res = await fetch("/api/placement", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ms,
					tz,
					reps: reps.map((r) => ({
						tier: r.tier,
						itemId: r.item.id,
						slug: r.item.slug,
						kind: r.item.kind,
						verdict: r.verdict,
						detail: { unit: r.item.unit, lemma: r.item.lemma, gloss: r.item.gloss, sentence: r.item.sentence, translation: r.item.translation, answer: r.item.answer, given: r.given, trigger: r.item.trigger, options: r.item.options },
					})),
				}),
			});
			if (!res.ok) throw new Error(String(res.status));
			setOutcome((await res.json()) as PlacementOutcome);
			setMissed(reps.filter((r) => r.verdict === "wrong"));
			setDrill(null);
		} catch {
			setError("Couldn't save the check. Your answers are kept on this screen; try again.");
		} finally {
			setSaving(false);
		}
	};

	/** The Socratic follow-up: a Learn session seeded with the misses. */
	const goDeeper = () => {
		const lines = missed.slice(0, 6).map((r) => `- "${r.item.sentence}" (${r.item.translation}): I wrote "${r.given || "nothing"}", the form is "${r.item.answer}" — ${unitInfo(r.item.unit).title}.`);
		const prompt = [
			"Placement follow-up. In the app's placement drill I missed these:",
			...lines,
			"Probe each point with one or two Socratic questions that make me produce the form and say what decided it, so you can tell a slip from a gap. Then teach the one that matters most for what I need Slovak for.",
		].join("\n");
		void startTutorChat(router, { title: "Placement follow-up", prompt, kind: "teach" }).catch(() => setError("Couldn't open the tutor. Add a model key in Settings first."));
	};

	const progress = step === 4 && outcome ? 4 : step;

	return (
		<div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background" data-testid="start">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className={cn(COLUMN, "relative flex h-16 items-center gap-4 pt-2")}>
				{step > 1 && !drill && !outcome ? (
					<button type="button" onClick={() => setStep((step - 1) as Step)} aria-label="Back" className="lh-no-drag rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<ArrowLeftIcon className="size-5" />
					</button>
				) : goal?.onboardedAt ? (
					<Link href="/" aria-label="Close" className="lh-no-drag rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</Link>
				) : (
					// First run: Today sends a fresh profile here, so closing
					// is the same as skipping (the record is stamped either way).
					<button type="button" onClick={() => void skipAll()} aria-label="Skip setup" className="lh-no-drag rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				)}
				<ol className="flex flex-1 items-center gap-1.5" aria-label={`Step ${step} of 4`}>
					{[1, 2, 3, 4].map((i) => (
						<li key={i} className={cn("h-2 flex-1 rounded-full transition-colors", i <= progress ? "bg-go" : "bg-accent")} />
					))}
				</ol>
				<span className="font-ui text-xs font-bold tabular-nums text-muted-foreground">{step} of 4</span>
				{!edit && !outcome && (
					<button type="button" onClick={() => void skipAll()} className="lh-no-drag font-ui text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="start-skip">
						Skip for now
					</button>
				)}
			</header>

			<main className={cn(COLUMN, "flex-1 py-6")}>
				{step === 1 && (
					<section className="lh-rise" data-testid="start-purposes">
						<Heading title="What is Slovak for?" line={`Pick up to ${MAX_PURPOSES}. This sets your target and which scenes you practise; the tutor stops asking.`} />
						<div className="mt-6 grid gap-3 sm:grid-cols-2">
							{PURPOSES.map((p) => {
								const on = d.purposes.includes(p.id);
								const full = !on && d.purposes.length >= MAX_PURPOSES;
								return (
									<button
										key={p.id}
										type="button"
										aria-pressed={on}
										disabled={full}
										onClick={() => set("purposes", on ? d.purposes.filter((x) => x !== p.id) : [...d.purposes, p.id])}
										className={cn(
											"flex items-start gap-3 rounded-2xl border-2 bg-card px-4 py-3.5 text-left transition-colors",
											on ? "border-go bg-go/10" : "border-border hover:border-foreground/40",
											full && "opacity-50",
										)}
										data-testid={`purpose-${p.id}`}
									>
										<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-go text-go-ink" : "bg-accent text-foreground")}>
											<UnitIcon name={p.glyph} className="size-5" />
										</span>
										<span className="min-w-0">
											<span className="flex items-center gap-2 font-ui text-base font-bold text-foreground">
												{p.title}
												{p.id !== "other" && <span className="rounded-md bg-accent px-1.5 py-0.5 font-ui text-[11px] font-black text-muted-foreground">{p.level}</span>}
											</span>
											<span className="block font-prose text-sm text-muted-foreground">{p.blurb}</span>
										</span>
									</button>
								);
							})}
						</div>
						{d.purposes.includes("other") && (
							<Field label="What for?" hint="in your words; the tutor reads this">
								<textarea
									value={d.purposeNote}
									onChange={(e) => set("purposeNote", e.target.value.slice(0, MAX_PURPOSE_NOTE))}
									rows={2}
									maxLength={MAX_PURPOSE_NOTE}
									placeholder="e.g. Moving to Košice next spring for a nursing job; I want to follow the ward and the paperwork."
									aria-label="What Slovak is for, in your words"
									className="w-full resize-none rounded-xl border-2 border-border bg-card px-4 py-3 font-prose text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-go"
									data-testid="purpose-note"
								/>
							</Field>
						)}
						{d.purposes.includes("exam") && (
							<Field label="The exam's level">
								<Chips items={CEFR_ORDER.map((l) => ({ id: l, title: l }))} value={d.examLevel} onPick={(v) => set("examLevel", v)} label="The exam's level" testid="exam-level" />
							</Field>
						)}
					</section>
				)}

				{step === 2 && (
					<section className="lh-rise" data-testid="start-you">
						<Heading title="What you bring" line="Every language you know is a bridge: the lessons and the tutor show a form the Estonian way, the Russian way, whichever you bring." />
						<Field label="Languages you know" hint="any language you can read a simple text in; then your level, on the CEFR">
							<LanguagePicker
								value={d.languages}
								levels={d.languageLevels}
								onChange={(languages, languageLevels) => setD((x) => ({ ...x, languages, languageLevels, explainIn: keepExplain(x.explainIn, languages) }))}
							/>
							<p className="mt-3 font-prose text-sm text-muted-foreground">Estonian, Finnish, Russian and German also appear inside the lessons, as the same form seen their way: the one you know best leads, one at A1 or A2 is an aside. The tutor draws on all of them.</p>
						</Field>
						<Field label="Explain to me in" hint={`up to ${MAX_EXPLAIN}: the tutor explains in the first and adds the key line in the second`}>
							<PickSome items={explainChoices(d.languages)} value={d.explainIn} onChange={(v) => set("explainIn", v)} max={MAX_EXPLAIN} fallback="en" label="Explain to me in" testid="explain-in" />
							<p className="mt-3 font-prose text-sm text-muted-foreground">Lesson rules stay in English for now; the bridges above are where the lessons show your languages.</p>
						</Field>
						<Field label="Slovak so far">
							<Choices items={PRIORS} value={d.prior} onPick={(v) => set("prior", v)} />
						</Field>
					</section>
				)}

				{step === 3 && (
					<section className="lh-rise" data-testid="start-time">
						<Heading title="How much time?" line="A short session every day beats a long one on Sunday. The plan is cut to fit this." />
						<Field label="Minutes a day" hint="any number up to ten hours">
							<NumberPicker value={d.minutes} onChange={(v) => set("minutes", v)} quick={MINUTE_CHOICES} min={5} max={MAX_MINUTES} step={5} unit="min" label="Minutes a day" testid="minutes" />
						</Field>
						<Field label="Days a week">
							<Chips items={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: n, title: String(n) }))} value={d.days} onPick={(v) => set("days", v)} label="Days a week" testid="days" />
						</Field>
						<div className="mt-8 rounded-2xl border bg-card px-5 py-4" data-testid="start-target">
							<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
								<FlagIcon className="size-4 text-flame" />
								<p className="font-ui text-base font-bold text-foreground">
									Target {level}
									<span className="font-normal text-muted-foreground"> · about {GUIDED_HOURS[level]} guided hours · at this pace around </span>
									{monthOf(eta)}
								</p>
							</div>
							<p className="mt-2 font-prose text-sm text-foreground" data-testid="start-level-cando">
								{LEVEL_CAN_DO[level]}
							</p>
							<p className="mt-1.5 font-prose text-sm text-muted-foreground" data-testid="start-level-fit">
								{levelFitLine(level, d.purposes, d.examLevel) || (d.purposes.includes("other") ? "The map has no level for your own goal: pick the one that sounds like you." : "Nothing picked, so A2: enough to get by.")} The map credits hours as units are done, so the date moves with you.
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-3">
								<span className="font-ui text-sm text-foreground">Aim for</span>
								<Chips items={CEFR_ORDER.map((l) => ({ id: l, title: l, hint: `${LEVEL_CAN_DO[l]} About ${GUIDED_HOURS[l]} guided hours${l === suggested ? " · suggested" : ""}` }))} value={level} onPick={(v) => set("levelOverride", v === suggested ? null : v)} label="Target level" testid="start-level" />
								{level !== suggested && (
									<button type="button" onClick={() => set("levelOverride", null)} className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
										Back to {suggested}, the suggested one
									</button>
								)}
								<button type="button" onClick={() => setHoursOpen(true)} className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="start-hours">
									How long does it take?
								</button>
							</div>
						</div>
					</section>
				)}

				{step === 4 && !drill && !outcome && (
					<section className="lh-rise" data-testid="start-check">
						<Heading
							title={edit && goal?.placedAt ? "Re-check where you stand?" : d.prior === "none" ? "You start at the beginning" : "Where do you stand?"}
							line={
								edit && goal?.placedAt
									? `Your last check (${goal.placedAt.slice(0, 10)}) found ${goal.placedLevel}. A re-check starts from your current chapter and replaces it.`
									: d.prior === "none"
										? "First words and the present tense are the first lesson. If you know more than you said, a 2-minute check can skip you ahead."
										: "A short check of real sentences: it climbs from A1 while you keep three in four right, and stops at your edge. Units you ace are ticked off the map; the ones you miss come first in your plan."
							}
						/>
						<div className="mt-8 flex flex-col gap-3 sm:flex-row">
							{d.prior === "none" && !(edit && goal?.placedAt) ? (
								<>
									<Link href="/" className={PRIMARY} data-testid="start-begin">
										Start learning
									</Link>
									<button type="button" onClick={() => void loadDrill(false)} disabled={drilling} className={SECONDARY}>
										{drilling ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
										Take the check anyway
									</button>
								</>
							) : (
								<>
									<button type="button" onClick={() => void loadDrill(!!(edit && goal?.placedAt))} disabled={drilling} className={PRIMARY} data-testid="start-drill">
										{drilling ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
										{edit && goal?.placedAt ? "Re-check my level" : "Start the check"}
									</button>
									<Link href="/" className={SECONDARY}>
										{edit ? "Keep it as it is" : "Skip, start at the beginning"}
									</Link>
								</>
							)}
						</div>
						<p className="mt-4 font-prose text-sm text-muted-foreground">About 8 to 32 sentences, choose or type, no hints. Every answer is kept in your lesson log.</p>
					</section>
				)}

				{step === 4 && drill && (
					<section>
						<PlacementDrill tiers={drill.tiers} from={drill.from} onDone={(reps, ms) => void finishDrill(reps, ms)} />
					</section>
				)}

				{step === 4 && outcome && <Result outcome={outcome} missed={missed} edit={edit} onDeeper={goDeeper} />}

				{error && (
					<p className="mt-6 rounded-xl border border-miss/40 bg-miss-soft px-4 py-3 font-prose text-sm text-foreground" role="alert">
						{error}
					</p>
				)}
			</main>

			<HoursSheet open={hoursOpen} onClose={() => setHoursOpen(false)} minutesPerDay={d.minutes} daysPerWeek={d.days} target={level} hoursDone={hoursDone} languages={d.languages} />

			{step < 4 && (
				<div className="border-t border-border">
					<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
						<p className="font-prose text-sm text-muted-foreground">{step === 1 ? (d.purposes.length ? `${d.purposes.length} picked · Enter continues` : "Pick at least one, or just continue") : "Enter continues"}</p>
						<button type="button" onClick={() => void next()} disabled={saving} className={PRIMARY} data-testid="start-next">
							{saving ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
							{step === 3 ? "Save and continue" : "Continue"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function Heading({ title, line }: { title: string; line: string }) {
	return (
		<div>
			<h1 className="font-ui text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground">{line}</p>
		</div>
	);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<div className="mt-7">
			<p className="mb-3 font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">
				{label}
				{hint && <span className="font-normal"> · {hint}</span>}
			</p>
			{children}
		</div>
	);
}

function Choices<T extends string>({ items, value, onPick }: { items: ReadonlyArray<{ id: T; title: string; line: string }>; value: T; onPick: (v: T) => void }) {
	return (
		<div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
			{items.map((it) => {
				const on = it.id === value;
				return (
					<button key={it.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(it.id)} className={cn("flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left transition-colors", on ? "border-go bg-go/10" : "border-border hover:border-foreground/40")} data-testid={`choice-${it.id}`}>
						<span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-go bg-go text-go-ink" : "border-border")}>{on && <CheckIcon className="size-4" strokeWidth={3} />}</span>
						<span className="min-w-0">
							<span className="block font-ui text-base font-bold text-foreground">{it.title}</span>
							<span className="block font-prose text-sm text-muted-foreground">{it.line}</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}

/** The drill's result: the level with its evidence, what was tested out,
 *  what comes first in the plan, and the two ways on — the path, or the
 *  tutor for the Socratic part. */
function Result({ outcome, missed, edit, onDeeper }: { outcome: PlacementOutcome; missed: DrillRep[]; edit: boolean; onDeeper: () => void }) {
	const chapter = CHAPTERS.find((c) => c.id === outcome.startChapter);
	const skipped = useMemo(() => CHAPTERS.slice(0, Math.max(0, CHAPTERS.findIndex((c) => c.id === outcome.startChapter))).length, [outcome.startChapter]);
	const title = (id: UnitId) => unitInfo(id).title;
	return (
		<section className="lh-rise" data-testid="start-result">
			<div className="lh-pop mx-auto flex size-20 items-center justify-center rounded-full bg-gold/15 text-gold">
				<FlagIcon className="size-10" />
			</div>
			<h1 className="mt-5 text-center font-ui text-4xl font-black text-foreground">{skipped === 0 ? "Starting at the beginning" : `You start at ${outcome.level}`}</h1>
			<p className="mt-2 text-center font-prose text-lg text-muted-foreground">
				{chapter ? `You start in “${chapter.title}”` : "You start at the top"}
				{skipped > 0 && ` · ${skipped} chapter${skipped === 1 ? "" : "s"} behind you, open to revisit`}
			</p>

			<ol className="mt-6 flex flex-col gap-1 rounded-2xl border bg-card p-3" aria-label="Tiers">
				{outcome.tiers.map((t) => (
					<li key={t.id} className="flex items-center gap-3 px-2 py-1.5">
						<span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-ui text-xs font-black", t.passed ? "bg-go text-go-ink" : "bg-accent text-muted-foreground")}>{t.passed ? <CheckIcon className="size-4" strokeWidth={3} /> : t.level}</span>
						<span className="min-w-0 flex-1 font-ui text-sm font-bold text-foreground">
							{t.level} · {t.title}
						</span>
						<span className="font-ui text-xs tabular-nums text-muted-foreground">
							{t.correct}/{t.reps} {t.passed ? "· passed" : "· your edge"}
						</span>
					</li>
				))}
			</ol>

			{(outcome.testedOut.length > 0 || outcome.weak.length > 0) && (
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					{outcome.testedOut.length > 0 && (
						<div className="rounded-2xl border bg-card p-4">
							<p className="font-ui text-xs font-bold tracking-wide text-go">Tested out</p>
							<p className="mt-1 font-prose text-sm text-foreground">{outcome.testedOut.map(title).join(", ")}</p>
						</div>
					)}
					{outcome.weak.length > 0 && (
						<div className="rounded-2xl border bg-card p-4">
							<p className="font-ui text-xs font-bold tracking-wide text-flame">First in your plan</p>
							<p className="mt-1 font-prose text-sm text-foreground">{outcome.weak.map(title).join(", ")}</p>
						</div>
					)}
				</div>
			)}

			{missed.length > 0 && (
				<div className="mt-4 rounded-2xl border bg-card p-4 text-left">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">The evidence</p>
					<ul className="mt-2 flex flex-col gap-2">
						{missed.slice(0, 6).map((r, i) => (
							<li key={i} className="font-prose text-base leading-snug">
								<span className="text-foreground" lang="sk">
									{r.item.before}
									<b>{r.item.answer}</b>
									{r.item.after}
								</span>
								<span className="block text-sm text-muted-foreground">
									You wrote “{r.given || "—"}” · {title(r.item.unit)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link href="/" className={PRIMARY} data-testid="start-done">
					{edit ? "Back to Today" : "Start learning"}
				</Link>
				{missed.length > 0 && (
					<button type="button" onClick={onDeeper} className={SECONDARY} data-testid="start-deeper">
						Go deeper with the tutor
					</button>
				)}
			</div>
			<p className="mt-4 text-center font-prose text-sm text-muted-foreground">{missed.length > 0 ? "The tutor starts from these sentences and asks the few questions a drill cannot: slip, gap, or misconception." : "Nothing missed, so nothing for the tutor to probe: the lessons measure you from here."}</p>
		</section>
	);
}

