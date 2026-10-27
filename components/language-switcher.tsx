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
import { MapIcon, RepeatIcon, SunIcon } from "lucide-react";
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
		<div className="mx-3 mb-3 flex flex-col gap-3" data-testid="language-block">
			{/* Reserved height: the profile arrives after mount, and the nav
			    below must not jump when it does (CLS). */}
			<div className="h-9">
				{profile ? (
					<div className="flex h-9 items-center gap-1 rounded-xl bg-card p-1" role="radiogroup" aria-label="Language">
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
										"flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors",
										running ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
										pending && "ring-1 ring-primary/50",
									)}
								>
									{p.endonym}
								</button>
							);
						})}
					</div>
				) : (
					<div className="h-9 animate-pulse rounded-xl bg-card" aria-hidden />
				)}
			</div>
			{note && <p className="px-1 text-xs text-muted-foreground">{note}</p>}
			<nav className="flex flex-col gap-0.5" aria-label="Main">
				<NavItem href="/" testid="today-door" active={pathname === "/"} icon={<SunIcon className="size-[18px]" />} tint="text-gold">
					Today
				</NavItem>
				<NavItem href="/review" testid="review-door" active={pathname === "/review"} icon={<RepeatIcon className="size-[18px]" />} tint="text-sky">
					Review
					{counts && (reviewDue > 0 || reviewNew > 0) && (
						<span
							className={cn(
								"ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
								reviewDue > 0 ? "bg-sky/20 text-sky" : "bg-accent text-foreground",
							)}
						>
							{reviewDue > 0 ? `${reviewDue} due` : `${reviewNew} new`}
						</span>
					)}
				</NavItem>
				<NavItem href="/map" testid="map-door" active={pathname === "/map"} icon={<MapIcon className="size-[18px]" />} tint="text-xp">
					Skill map
				</NavItem>
			</nav>
		</div>
	);
}

/** One primary destination: icon in its own color, label in sentence case. */
function NavItem({
	href,
	testid,
	active,
	icon,
	tint,
	children,
}: {
	href: string;
	testid: string;
	active: boolean;
	icon: React.ReactNode;
	tint: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			data-testid={testid}
			aria-current={active ? "page" : undefined}
			className={cn(
				"flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors",
				active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
			)}
		>
			<span className={cn("shrink-0", active ? tint : "")}>{icon}</span>
			{children}
		</Link>
	);
}
