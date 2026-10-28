"use client";
/**
 * Settings → Learner (2026-10-28): the languages you know and the one the
 * tutor explains in, changeable without re-running the setup. Each click
 * saves (PUT /api/progress {goal}); the rest of the profile (what Slovak
 * is for, the level, the time) still lives in the setup, one link away.
 * Xurify: "I still would like the ability to choose other languages that
 * I know because sometimes I do want to see the Estonian way".
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { explainChoices, LanguagePicker, PickSome } from "@/components/onboarding/controls";
import { keepExplain } from "@/components/onboarding/start";
import { explanationLanguages, knownLanguages, MAX_EXPLAIN, type Lang, type LearnerGoal } from "@/src/core";
import { SettingsGroup } from "./controls.tsx";

interface Langs {
	languages: Lang[];
	otherLanguages: string[];
	explainIn: Lang[];
}

export function LearnerSection({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const [state, setState] = useState<Langs | null>(null);
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "failed">("idle");

	useEffect(() => {
		let gone = false;
		void fetch("/api/progress")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((s: { goal?: LearnerGoal }) => {
				if (gone) return;
				setState({ languages: knownLanguages(s.goal), otherLanguages: s.goal?.otherLanguages ?? [], explainIn: explanationLanguages(s.goal) });
			})
			.catch(() => !gone && setStatus("failed"));
		return () => {
			gone = true;
		};
	}, []);

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
			<SettingsGroup label="Languages you know" testid="learner-languages">
				<LanguagePicker value={state.languages} other={state.otherLanguages} onChange={(languages, otherLanguages) => void save({ languages, otherLanguages, explainIn: keepExplain(state.explainIn, languages) })} />
				<p className="text-xs text-muted-foreground">Estonian, Finnish, Russian and German show up inside the lessons as the same form seen their way; the tutor draws on every language here.</p>
			</SettingsGroup>
			<SettingsGroup label="Explain to me in" testid="learner-explain">
				<PickSome items={explainChoices(state.languages)} value={state.explainIn} onChange={(explainIn) => void save({ ...state, explainIn })} max={MAX_EXPLAIN} fallback="en" label="Explain to me in" testid="explain-in" />
				<p className="text-xs text-muted-foreground">Up to {MAX_EXPLAIN}: the tutor explains in the first and adds the key line and the terms in the second. Lesson rules stay in English for now.</p>
			</SettingsGroup>
			<SettingsGroup label="Goal, level and time" testid="learner-goal">
				<div className="flex items-center justify-between gap-4 py-1">
					<span className="font-prose text-(length:--lh-prose-size)">What Slovak is for, the target level, minutes a day, and the placement check.</span>
					<button
						type="button"
						data-testid="learner-open-setup"
						onClick={() => {
							onClose();
							router.push("/start?edit=1");
						}}
						className="shrink-0 rounded-xl border-2 border-border px-4 py-1.5 font-ui text-sm font-bold text-foreground transition-colors hover:border-foreground/40"
					>
						Open setup
					</button>
				</div>
			</SettingsGroup>
			<p className="text-xs text-muted-foreground" aria-live="polite" data-testid="learner-status">
				{status === "saving" ? "Saving…" : status === "saved" ? "Saved." : status === "error" ? "Couldn't save — try again." : ""}
			</p>
		</>
	);
}
