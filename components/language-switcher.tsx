"use client";

/**
 * The sidebar's language block (LangHarness): which language profile is
 * running, a switch to the other one, the Today door, and the
 * spaced-review door with its due count. Switching writes the choice and restarts — the desktop app
 * relaunches itself; under `next dev` the learner restarts the server.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RepeatIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileInfo {
	active: string;
	selected: string;
	restartRequired: boolean;
	profiles: Array<{ id: string; endonym: string; english: string; lexicon: boolean; seed: boolean }>;
}

interface Counts {
	due: number;
	learning: number;
	newLeft: number;
}

export function LanguageSwitcher() {
	const pathname = usePathname();
	const [profile, setProfile] = useState<ProfileInfo | null>(null);
	const [counts, setCounts] = useState<Counts | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const refresh = useCallback(() => {
		void fetch("/api/profile")
			.then((r) => r.json() as Promise<ProfileInfo>)
			.then(setProfile)
			.catch(() => {});
		void fetch(`/api/review?peek&tz=${new Date().getTimezoneOffset()}`)
			.then((r) => r.json() as Promise<{ counts: Counts }>)
			.then((s) => setCounts(s.counts))
			.catch(() => {});
	}, []);

	useEffect(() => {
		refresh();
	}, [pathname, refresh]);

	const choose = async (id: string, label: string) => {
		if (!profile || id === profile.selected) return;
		if (!window.confirm(`Switch to ${label}? LangHarness restarts with the ${label} profile; your other language's sessions stay where they are.`)) return;
		const res = await fetch("/api/profile", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ active: id }),
		});
		const next = (await res.json()) as ProfileInfo;
		setProfile(next);
		if (!next.restartRequired) return;
		if (window.lh?.relaunch) window.lh.relaunch();
		else setNote(`Restart the server to switch to ${label}.`);
	};

	const reviewDue = counts ? counts.due + counts.learning : 0;
	const reviewNew = counts?.newLeft ?? 0;

	return (
		<div className="mx-3 mb-2 flex flex-col gap-1.5" data-testid="language-block">
			{profile && (
				<div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background p-0.5" role="radiogroup" aria-label="Language">
					{profile.profiles.map((p) => {
						const running = p.id === profile.active;
						const pending = p.id === profile.selected && profile.restartRequired;
						return (
							<button
								key={p.id}
								type="button"
								role="radio"
								aria-checked={running}
								data-testid={`profile-${p.id}`}
								onClick={() => void choose(p.id, p.english)}
								title={pending ? `${p.english} after restart` : running ? `${p.english} (running)` : `Switch to ${p.english}`}
								className={cn(
									"flex-1 rounded-sm px-2 py-1 text-[11px] tracking-wide transition-colors",
									running ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
									pending && "ring-1 ring-primary/50",
								)}
							>
								{p.endonym}
							</button>
						);
					})}
				</div>
			)}
			{note && <p className="px-1 text-[11px] text-muted-foreground">{note}</p>}
			<Link
				href="/"
				data-testid="today-door"
				className={cn(
					"flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs uppercase tracking-wider transition-colors hover:bg-accent hover:text-foreground",
					pathname === "/" ? "bg-accent text-foreground" : "text-muted-foreground",
				)}
			>
				<SunIcon className="size-3" />
				Today
			</Link>
			<Link
				href="/review"
				data-testid="review-door"
				className={cn(
					"flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs uppercase tracking-wider transition-colors hover:bg-accent hover:text-foreground",
					pathname === "/review" ? "bg-accent text-foreground" : "text-muted-foreground",
				)}
			>
				<RepeatIcon className="size-3" />
				Review
				{counts && (reviewDue > 0 || reviewNew > 0) && (
					<span className="ml-auto flex gap-1.5 font-mono text-[11px] normal-case tracking-normal">
						{reviewDue > 0 && <span className="text-foreground">{reviewDue} due</span>}
						{reviewNew > 0 && <span className="text-muted-foreground">{reviewNew} new</span>}
					</span>
				)}
			</Link>
		</div>
	);
}
