"use client";
/**
 * Settings → Learning: the languages you know and the one the tutor explains
 * in, changeable without re-running setup. Each click saves (PUT /api/progress
 * {goal}). The rest of the profile lives in setup, one link away.
 */

import { useEffect, useState } from "react";
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

export function LearnerSection({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const [state, setState] = useState<Langs | null>(null);
	const [profile, setProfile] = useState<ProfileInfo | null>(null);
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "failed">("idle");

	useEffect(() => {
		let gone = false;
		void fetch("/api/progress")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((s: { goal?: LearnerGoal }) => {
				if (gone) return;
				setState({ languages: knownLanguages(s.goal), languageLevels: s.goal?.languageLevels ?? {}, explainIn: explanationLanguages(s.goal), showParallels: parallelsOn(s.goal) });
			})
			.catch(() => !gone && setStatus("failed"));

		void fetch("/api/profile")
			.then((r) => (r.ok ? r.json() : null))
			.then((d: ProfileInfo | null) => {
				if (!gone && d) setProfile(d);
			})
			.catch(() => undefined);

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
			if (next.restartRequired) {
				window.location.reload();
			}
		} catch {
			// ignore
		}
	};

	const save = async (next: Langs) => {
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
	if (!state) return <p className="text-sm text-muted-foreground">Loading…</p>;

	return (
		<>
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
										"flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-ui text-sm font-semibold transition-all",
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
							{ id: "learner-open-plan", href: "/plan", label: "Open plan" },
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
		</>
	);
}
