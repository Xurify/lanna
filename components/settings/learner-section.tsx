"use client";
/**
 * Settings → Learning: the languages you know and the one the tutor explains
 * in, changeable without re-running setup. Each click saves (PUT /api/progress
 * {goal}). The rest of the profile lives in setup, one link away.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { explainChoices, LanguagePicker, PickSome } from "@/components/onboarding/controls";
import { keepExplain } from "@/components/onboarding/start";
import { CountryFlag } from "@/components/ui/country-flag";
import { SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { explanationLanguages, knownLanguages, MAX_EXPLAIN, parallelsLine, parallelsOn, type Lang, type LangLevel, type LearnerGoal } from "@/src/core";
import { SettingsGroup, Toggle } from "./controls.tsx";

interface Langs {
	languages: Lang[];
	languageLevels: Partial<Record<Lang, LangLevel>>;
	explainIn: Lang[];
	showParallels: boolean;
}

interface ProfileInfo {
	active: string;
	selected: string;
	restartRequired: boolean;
	profiles: Array<{
		id: string;
		code: string;
		tag: string;
		endonym: string;
		english: string;
		description: string;
	}>;
}

/** The last thing the tab showed, so opening it again paints at once and the fetch only corrects it. */
let last: { state: Langs; profile: ProfileInfo | null } | null = null;

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
	const router = useRouter();
	const [state, setState] = useState<Langs | null>(last?.state ?? null);
	const [profile, setProfile] = useState<ProfileInfo | null>(last?.profile ?? null);
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "failed">("idle");
	// A click made before the refresh lands must not be overwritten by the older answer.
	const edited = useRef(false);

	useEffect(() => {
		let gone = false;
		// Both answers arrive together, so the target language never pops in above the rest after the first paint.
		void Promise.all([
			fetch("/api/progress").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))) as Promise<{ goal?: LearnerGoal }>,
			fetch("/api/profile")
				.then((r) => (r.ok ? (r.json() as Promise<ProfileInfo>) : null))
				.catch(() => null),
		])
			.then(([s, p]) => {
				if (gone || edited.current) return;
				const next: Langs = { languages: knownLanguages(s.goal), languageLevels: s.goal?.languageLevels ?? {}, explainIn: explanationLanguages(s.goal), showParallels: parallelsOn(s.goal) };
				last = { state: next, profile: p };
				setState(next);
				setProfile(p);
			})
			.catch(() => !gone && !last && setStatus("failed"));
		return () => {
			gone = true;
		};
	}, []);

	const switchProfile = async (id: string) => {
		if (profile?.active === id) return;
		try {
			const res = await fetch("/api/profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ active: id }),
			});
			if (!res.ok) return;
			const next: ProfileInfo = await res.json();
			setProfile(next);
			if (last) last = { ...last, profile: next };
			if (next.restartRequired) {
				window.location.reload();
			}
		} catch {
			// ignore
		}
	};

	const save = async (next: Langs) => {
		edited.current = true;
		last = { state: next, profile: last?.profile ?? profile };
		setState(next);
		setStatus("saving");
		try {
			const res = await fetch("/api/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: next }) });
			if (!res.ok) throw new Error(String(res.status));
			setStatus("saved");
		} catch {
			setStatus("error");
		}
	};

	if (status === "failed") return <p className="text-sm text-muted-foreground">The profile could not be loaded — refresh to retry.</p>;
	if (!state) return <Placeholder />;

	return (
		<div className="lh-rise flex flex-col gap-2">
			{profile && profile.profiles.length > 0 && (
				<SettingsGroup label="Target language" testid="learner-target-language">
					<div className="flex flex-wrap items-center gap-2 py-1">
						{profile.profiles.map((p) => {
							const running = p.id === profile.active;
							return (
								<button
									key={p.id}
									type="button"
									aria-pressed={running}
									onClick={() => void switchProfile(p.id)}
									className={cn(
										"flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-ui text-sm font-semibold transition-colors",
										running
											? "border-primary/80 bg-primary/15 text-primary font-semibold shadow-xs"
											: "border-border/80 bg-accent/20 text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground",
									)}
									data-testid={`target-language-${p.id}`}
								>
									<CountryFlag lang={p.id} />
									<span>{p.endonym}</span>
									<span className="text-xs font-normal opacity-70">({p.english})</span>
								</button>
							);
						})}
					</div>
					<p className="text-xs text-muted-foreground">The language you are studying in LangHarness.</p>
				</SettingsGroup>
			)}
			<SettingsGroup label="Languages you know" testid="learner-languages">
				<LanguagePicker value={state.languages} levels={state.languageLevels} onChange={(languages, languageLevels) => void save({ ...state, languages, languageLevels, explainIn: keepExplain(state.explainIn, languages) })} />
				<p className="text-xs text-muted-foreground">Any language you can read a simple text in, and your CEFR level in it (A1 to C2, or native). The tutor uses them to understand you and to pick what to compare.</p>
			</SettingsGroup>
			<SettingsGroup label="Parallels from my languages" testid="learner-parallels">
				<div className="flex items-center justify-between gap-4 py-1">
					<span className="font-prose text-(length:--lh-prose-size)" data-testid="parallels-line">
						{parallelsLine(state).replace(/ You can turn it off in Settings → Learning\.$/, "")}
					</span>
					<Toggle checked={state.showParallels} onChange={(showParallels) => void save({ ...state, showParallels })} label="Show parallels from my languages" />
				</div>
			</SettingsGroup>
			<SettingsGroup label="Explain to me in" testid="learner-explain">
				<PickSome items={explainChoices(state.languages)} value={state.explainIn} onChange={(explainIn) => void save({ ...state, explainIn })} max={MAX_EXPLAIN} fallback="en" label="Explain to me in" testid="explain-in" />
				<p className="text-xs text-muted-foreground">Up to {MAX_EXPLAIN}: the tutor explains in the first and adds the key line and the terms in the second. Lesson rules stay in English for now.</p>
			</SettingsGroup>
			<SettingsGroup label="Goal and level" testid="learner-goal">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1">
					<span className="min-w-0 flex-1 font-prose text-(length:--lh-prose-size)">Your pace lives on the plan. The purposes, the target and your starting level live in setup.</span>
					<span className="flex min-w-0 flex-wrap gap-2">
						{[
							{ id: "learner-open-plan", href: "/progress", label: "Open progress" },
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
				{status === "saving" ? "Saving…" : status === "saved" ? "Saved." : status === "error" ? "Couldn't save — try again." : ""}
			</p>
			{children}
		</div>
	);
}
