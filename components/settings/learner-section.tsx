"use client";
/**
 * Settings → Learning: the languages you know and the one the tutor explains
 * in, changeable without re-running setup. Each click saves (PUT /api/progress
 * {goal}). The rest of the profile lives in setup, one link away.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Chips, explainChoices, LanguagePicker, NumberPicker, PickSome } from "@/components/onboarding/controls";
import { keepExplain } from "@/components/onboarding/start";
import { CountryFlag } from "@/components/ui/country-flag";
import { useLanguageActions, type ProfileInfo } from "@/components/language-actions";
import { useActiveLanguage } from "@/components/speech";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import {
	CEFR_ORDER,
	DEFAULT_DAYS_PER_WEEK,
	DEFAULT_XP_PER_HOUR,
	explanationLanguages,
	knownLanguages,
	MAX_EXPLAIN,
	MAX_MINUTES,
	MINUTE_CHOICES,
	parallelsLine,
	parallelsOn,
	xpForPlan,
	type Cefr,
	type Lang,
	type LangLevel,
	type LearnerGoal,
} from "@/src/core";
import { SettingsGroup, Toggle } from "./controls.tsx";

interface Langs {
	languages: Lang[];
	languageLevels: Partial<Record<Lang, LangLevel>>;
	explainIn: Lang[];
	showParallels: boolean;
}

interface Goals {
	level: Cefr;
	minutesPerDay: number;
	daysPerWeek: number;
	/** XP earned per measured hour so far; null until there is an hour of it. */
	xpPerHour: number | null;
}

/** The last thing the tab showed, so opening it again paints at once and the fetch only corrects it. */
let last: { state: Langs; goals: Goals; profile: ProfileInfo | null } | null = null;

const BAR = "animate-pulse rounded-md bg-well-2 motion-reduce:animate-none";

/** The tab's shape before its data: the groups keep their place, so nothing moves when the real ones arrive. */
function Placeholder() {
	return (
		<div aria-hidden="true" data-testid="learner-loading" className="flex flex-col gap-7">
			{[
				[2, "h-9 w-64"],
				[3, "h-[7.5rem] w-full"],
				[3, "h-12 w-full"],
			].map(([n, box], i) => (
				<div key={i} className="flex flex-col gap-3">
					<span className={cn(BAR, "h-3 w-32")} />
					{Array.from({ length: i === 2 ? (n as number) : 1 }, (_, k) => (
						<span key={k} className={cn(BAR, box as string)} />
					))}
				</div>
			))}
		</div>
	);
}

export function LearnerSection({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
	const target = useActiveLanguage();
	const router = useRouter();
	const [state, setState] = useState<Langs | null>(last?.state ?? null);
	const [goals, setGoals] = useState<Goals | null>(last?.goals ?? null);
	// What the goal controls show while edited: the saved goals stay as they were until Save.
	const [draft, setDraft] = useState<Goals | null>(null);
	const [profile, setProfile] = useState<ProfileInfo | null>(last?.profile ?? null);
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "failed">("idle");
	// A click made before the refresh lands must not be overwritten by the older answer.
	const edited = useRef(false);

	useEffect(() => {
		let gone = false;
		// Both answers arrive together, so the target language never pops in above the rest after the first paint.
		void Promise.all([
			fetch("/api/progress").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))) as Promise<{
				goal?: LearnerGoal;
				xpPerHour?: number | null;
			}>,
			fetch("/api/profile")
				.then((r) => (r.ok ? (r.json() as Promise<ProfileInfo>) : null))
				.catch(() => null),
		])
			.then(([s, p]) => {
				if (gone || edited.current) return;
				const next: Langs = {
					languages: knownLanguages(s.goal),
					languageLevels: s.goal?.languageLevels ?? {},
					explainIn: explanationLanguages(s.goal),
					showParallels: parallelsOn(s.goal),
				};
				const g: Goals = {
					level: s.goal?.level ?? "B2",
					minutesPerDay: s.goal?.minutesPerDay ?? 30,
					daysPerWeek: s.goal?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK,
					xpPerHour: s.xpPerHour ?? null,
				};
				last = { state: next, goals: g, profile: p };
				setState(next);
				setGoals(g);
				setProfile(p);
			})
			.catch(() => !gone && !last && setStatus("failed"));
		return () => {
			gone = true;
		};
	}, []);

	const showProfile = (next: ProfileInfo | null) => {
		setProfile(next);
		if (last) last = { ...last, profile: next };
	};
	const languages = useLanguageActions({
		profile,
		onChanged: (next) => {
			if (next) return showProfile(next);
			void fetch("/api/profile")
				.then((r) => (r.ok ? (r.json() as Promise<ProfileInfo>) : null))
				.then((p) => p && showProfile(p))
				.catch(() => {});
		},
	});

	const save = async (next: Langs) => {
		edited.current = true;
		if (last) last = { ...last, state: next };
		setState(next);
		setStatus("saving");
		try {
			const res = await fetch("/api/progress", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ goal: next }),
			});
			if (!res.ok) throw new Error(String(res.status));
			setStatus("saved");
		} catch {
			setStatus("error");
		}
	};

	/** The goals are saved with a button, not on each click: a stray click on a number should not change the plan. The day's XP goal is not saved at all: it follows the minutes. */
	const saveGoals = async () => {
		if (!draft) return;
		setStatus("saving");
		try {
			const res = await fetch("/api/progress", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					goal: { level: draft.level, minutesPerDay: draft.minutesPerDay, daysPerWeek: draft.daysPerWeek },
				}),
			});
			if (!res.ok) throw new Error(String(res.status));
			if (last) last = { ...last, goals: draft };
			setGoals(draft);
			setDraft(null);
			setStatus("saved");
		} catch {
			setStatus("error");
		}
	};

	if (status === "failed")
		return <p className="text-sm text-muted-foreground">The profile could not be loaded — refresh to retry.</p>;
	if (!state || !goals) return <Placeholder />;
	const shown = draft ?? goals;
	const dirty =
		draft !== null &&
		(draft.level !== goals.level ||
			draft.minutesPerDay !== goals.minutesPerDay ||
			draft.daysPerWeek !== goals.daysPerWeek);
	const edit = (next: Goals) => {
		setDraft(next);
		setStatus("idle");
	};
	const dayXp = xpForPlan(shown.minutesPerDay, shown.xpPerHour);

	return (
		<div className="lanna-rise flex flex-col gap-2">
			{profile && profile.profiles.length > 0 && (
				<SettingsGroup
					label="Languages you are learning"
					hint="Each keeps its own progress."
					testid="learner-target-language"
				>
					<ul className="flex flex-col divide-y divide-border/60 rounded-lg bg-well" aria-label="Your languages">
						{profile.profiles.map((p) => {
							const running = p.id === profile.active;
							return (
								<li
									key={p.id}
									className="flex min-h-12 items-center gap-3 px-4 py-2"
									data-testid={`target-language-${p.id}`}
								>
									<CountryFlag lang={p.id} />
									<span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
										<span className="font-ui text-sm font-semibold text-foreground">{p.endonym}</span>
										<span className="text-xs text-muted-foreground">{p.english}</span>
										{running && <span className="text-xs font-medium text-teal">Studying now</span>}
									</span>
									{!running && (
										<button
											type="button"
											disabled={languages.switching !== null}
											onClick={() => languages.choose(p.id)}
											className={cn(SECONDARY, SMALL)}
											data-testid={`target-language-switch-${p.id}`}
										>
											{languages.switching === p.id ? "Switching…" : "Switch"}
										</button>
									)}
									{p.removable ? (
										<button
											type="button"
											onClick={() => languages.askRemove(p)}
											aria-label={`Remove ${p.english}`}
											title={`Remove ${p.english}`}
											className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											data-testid={`target-language-remove-${p.id}`}
										>
											<Trash2Icon className="size-4" />
										</button>
									) : (
										<span className="size-8 shrink-0" aria-hidden="true" />
									)}
								</li>
							);
						})}
					</ul>
					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={() => languages.openAdd()}
							className={cn(SECONDARY, SMALL)}
							data-testid="target-language-add"
						>
							<PlusIcon className="size-4" />
							Add a language
						</button>
						{languages.note && (
							<span className="text-xs text-muted-foreground" role="status">
								{languages.note}
							</span>
						)}
					</div>
					{languages.dialogs}
				</SettingsGroup>
			)}
			<SettingsGroup label="Languages you know" testid="learner-languages">
				<LanguagePicker
					exclude={target?.code}
					value={state.languages}
					levels={state.languageLevels}
					onChange={(languages, languageLevels) =>
						void save({ ...state, languages, languageLevels, explainIn: keepExplain(state.explainIn, languages) })
					}
				/>
				<p className="text-xs text-muted-foreground">
					Any language you can read a simple text in, and your CEFR level in it (A1 to C2, or native). The tutor uses
					them to understand you and to pick what to compare.
				</p>
			</SettingsGroup>
			<SettingsGroup label="Parallels from my languages" testid="learner-parallels">
				<div className="flex items-center justify-between gap-4 py-1">
					<span className="font-prose text-(length:--lanna-prose-size)" data-testid="parallels-line">
						{target && parallelsLine(state, target).replace(/ You can turn it off in Settings → Learning\.$/, "")}
					</span>
					<Toggle
						checked={state.showParallels}
						onChange={(showParallels) => void save({ ...state, showParallels })}
						label="Show parallels from my languages"
					/>
				</div>
			</SettingsGroup>
			<SettingsGroup label="Explain to me in" testid="learner-explain">
				<PickSome
					items={explainChoices(state.languages)}
					value={state.explainIn}
					onChange={(explainIn) => void save({ ...state, explainIn })}
					max={MAX_EXPLAIN}
					fallback="en"
					label="Explain to me in"
					testid="explain-in"
				/>
				<p className="text-xs text-muted-foreground">
					Up to {MAX_EXPLAIN}: the tutor explains in the first and adds the key line and the terms in the second. Lesson
					rules stay in English for now.
				</p>
			</SettingsGroup>
			<SettingsGroup
				label="Study goals"
				hint="How much you want to study. The XP that counts as a day done follows from it."
				testid="learner-goals"
			>
				<div className="flex flex-col gap-4 rounded-lg bg-well px-4 py-3.5">
					<div className="flex flex-col gap-1.5" data-testid="goal-level">
						<span className="font-ui text-sm font-medium text-foreground">Target level</span>
						<Chips
							items={CEFR_ORDER.map((l) => ({ id: l, title: l }))}
							value={shown.level}
							onPick={(level) => edit({ ...shown, level })}
							label="Target level"
							testid="goal-level-chips"
						/>
					</div>
					<div className="flex flex-col gap-1.5" data-testid="goal-minutes">
						<span className="font-ui text-sm font-medium text-foreground">Minutes a day</span>
						<NumberPicker
							value={shown.minutesPerDay}
							onChange={(minutesPerDay) => edit({ ...shown, minutesPerDay })}
							quick={MINUTE_CHOICES}
							min={5}
							max={MAX_MINUTES}
							step={5}
							unit="min"
							label="Minutes a day"
							testid="goal-minutes-picker"
						/>
					</div>
					<div className="flex flex-col gap-1.5" data-testid="goal-days">
						<span className="font-ui text-sm font-medium text-foreground">Days a week</span>
						<Chips
							items={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ id: d, title: String(d) }))}
							value={shown.daysPerWeek}
							onPick={(daysPerWeek) => edit({ ...shown, daysPerWeek })}
							label="Days a week"
							testid="goal-days-chips"
						/>
					</div>
					<p className="text-xs leading-relaxed text-muted-foreground" data-testid="goal-xp">
						A day counts as done at <b className="q-num font-semibold text-foreground">{dayXp} XP</b>:{" "}
						{shown.minutesPerDay} min at {shown.xpPerHour === null ? "a typical pace of" : "your pace of about"}{" "}
						{shown.xpPerHour ?? DEFAULT_XP_PER_HOUR} XP an hour
						{shown.xpPerHour === null ? ", until an hour of your study has been measured" : ""}.
					</p>
					<div className="flex items-center gap-2" data-testid="goal-actions">
						<button
							type="button"
							onClick={() => void saveGoals()}
							disabled={!dirty || status === "saving"}
							className={cn(PRIMARY, SMALL)}
							data-testid="goal-save"
						>
							Save goals
						</button>
						<button
							type="button"
							onClick={() => setDraft(null)}
							disabled={!dirty}
							className={cn(SECONDARY, SMALL)}
							data-testid="goal-discard"
						>
							Discard
						</button>
						<span className="text-xs text-muted-foreground" aria-live="polite">
							{dirty ? "Not saved yet" : ""}
						</span>
					</div>
				</div>
			</SettingsGroup>
			<SettingsGroup label="Purpose and starting level" testid="learner-goal">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1">
					<span className="min-w-0 flex-1 font-prose text-(length:--lanna-prose-size)">
						Why you are learning and where you started are set in setup.
					</span>
					<span className="flex min-w-0 flex-wrap gap-2">
						{[
							{ id: "learner-open-plan", href: "/progress", label: "Open Progress" },
							{ id: "learner-open-setup", href: "/start?edit=1", label: "Open setup" },
							{ id: "learner-recheck", href: "/start?edit=1&check=1", label: "Re-check my level" },
						].map((b) => (
							<button
								key={b.id}
								type="button"
								data-testid={b.id}
								onClick={() => {
									onClose();
									router.push(b.href);
								}}
								className={cn(SECONDARY, SMALL)}
							>
								{b.label}
							</button>
						))}
					</span>
				</div>
			</SettingsGroup>
			<p className="text-xs text-muted-foreground" aria-live="polite" data-testid="learner-status">
				{status === "saving"
					? "Saving…"
					: status === "saved"
						? "Saved."
						: status === "error"
							? "Couldn't save — try again."
							: ""}
			</p>
			{children}
		</div>
	);
}
