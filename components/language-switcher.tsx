"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	BookAIcon,
	BookOpenIcon,
	ChartNoAxesColumnIcon,
	CheckIcon,
	ChevronDownIcon,
	EarIcon,
	LoaderCircleIcon,
	MicIcon,
	MountainSnowIcon,
	PenLineIcon,
	PlusIcon,
	RepeatIcon,
	SunIcon,
	CircleAlertIcon,
	ClapperboardIcon,
	NotebookPenIcon,
	FlagIcon,
	HeadphonesIcon,
	HistoryIcon,
	type LucideIcon,
	TableIcon,
	ZapIcon,
} from "lucide-react";
import { NAV, navItemFor, type NavId } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { MenuShell } from "@/components/menu-shell";
import { CountryFlag } from "@/components/ui/country-flag";
import { sharedJson } from "@/lib/shared-fetch";
import { useActivity, type FeedTask } from "@/components/activity-dock";
import { useLanguageActions, type ProfileInfo } from "@/components/language-actions";
import { catalogLanguage } from "@/src/core";

interface Counts {
	due: number;
	learning: number;
	newLeft: number;
}

/** A language being added, listed the way a set-up one is, with a loading mark
 *  where its check would be. Its build step lives on the Tasks page. */
export function AddingRow({ task }: { task: FeedTask }) {
	const id = task.language?.id ?? "";
	const english = task.language?.english ?? task.title;
	const endonym = catalogLanguage(id)?.endonym ?? english;
	return (
		<div
			className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground"
			data-testid="profile-adding"
		>
			<div className="flex min-w-0 items-center gap-2 truncate">
				<CountryFlag lang={id} />
				<span className="truncate font-semibold">{endonym}</span>
				<span className="truncate text-[11px] text-muted-foreground">({english})</span>
			</div>
			<LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
			<span className="sr-only">Being added</span>
		</div>
	);
}

export function LanguageSwitcher() {
	const pathname = usePathname();
	const [profile, setProfile] = useState<ProfileInfo | null>(null);
	const [counts, setCounts] = useState<Counts | null>(null);
	const [open, setOpen] = useState(false);
	const { feed } = useActivity();
	const addsRunning = feed.tasks.filter((t) => t.kind === "language" && t.status === "running");

	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(() => {
		const tz = new Date().getTimezoneOffset();
		void sharedJson<ProfileInfo>("/api/profile")
			.then(setProfile)
			.catch(() => {});
		void sharedJson<{ counts: Counts }>(`/api/review?peek&tz=${tz}`, 300)
			.then((s) => setCounts(s.counts))
			.catch(() => {});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh, pathname]);
	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);
	useEffect(() => {
		window.addEventListener("lanna:review-changed", refresh);
		return () => window.removeEventListener("lanna:review-changed", refresh);
	}, [refresh]);

	// Close menu on outside click or Esc
	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (triggerRef.current?.contains(e.target as Node)) return;
			if (menuRef.current?.contains(e.target as Node)) return;
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const languages = useLanguageActions({ profile, onChanged: (next) => (next ? setProfile(next) : refresh()) });
	const choose = (id: string) => {
		setOpen(false);
		languages.choose(id);
	};

	const activeNav = navItemFor(pathname);
	// The row you pressed lights at once; the route (and a slow server render) catches up after. Cleared when the path changes.
	const [pressed, setPressed] = useState<{ id: NavId; from: string } | null>(null);
	const lit = pressed && pressed.from === pathname ? pressed.id : activeNav?.id;
	// Once the route has changed the press is spent: arriving back on the page it was pressed from must not light it again.
	useEffect(() => {
		setPressed(null);
	}, [pathname]);
	const reviewDue = counts ? counts.due + counts.learning : 0;
	const reviewNew = counts?.newLeft ?? 0;
	const activeProfile = profile?.profiles.find((p) => p.id === profile.active);

	return (
		<div className="mx-3 mb-3 flex flex-col gap-3" data-testid="language-block">
			{/* Reserved height: the profile arrives after mount, and the nav
			    below must not jump when it does (CLS = 0). */}
			<div className="relative h-9">
				{profile ? (
					<button
						ref={triggerRef}
						type="button"
						aria-haspopup="listbox"
						aria-expanded={open}
						data-testid="profile-trigger"
						onClick={() => setOpen((v) => !v)}
						className={cn(
							"flex h-9 w-full items-center justify-between gap-2 rounded-xl bg-card px-2.5 text-xs font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] transition-colors hover:bg-accent",
							open && "ring-1 ring-border",
						)}
					>
						<div className="flex min-w-0 items-center gap-2 truncate">
							<CountryFlag lang={activeProfile?.id ?? "slovak"} />
							<span className="truncate">{activeProfile?.endonym ?? "Language"}</span>
							{activeProfile && (
								<span className="truncate text-[11px] font-normal text-muted-foreground">
									({activeProfile.english})
								</span>
							)}
						</div>
						<ChevronDownIcon
							className={cn(
								"size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
								open && "rotate-180",
							)}
						/>
					</button>
				) : (
					<div className="h-9 animate-pulse rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--q-line-2)]" aria-hidden />
				)}

				{open && profile && (
					<MenuShell
						anchorRef={triggerRef}
						testid="language-menu"
						preferredSide="down"
						align="left"
						menuClass="flex w-60 flex-col gap-0.5 rounded-xl border bg-card p-1.5 text-xs shadow-xl"
					>
						<div ref={menuRef} role="listbox" aria-label="Languages" className="flex flex-col gap-0.5">
							<div className="px-2 py-1 text-xs font-semibold text-ink-3">Target Language</div>
							<div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
								{profile.profiles.map((p) => {
									const running = p.id === profile.active;
									return (
										<button
											key={p.id}
											type="button"
											role="option"
											aria-selected={running}
											data-testid={`profile-${p.id}`}
											onClick={() => choose(p.id)}
											className={cn(
												"flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
												running
													? "bg-accent font-semibold text-foreground shadow-xs"
													: "text-muted-foreground hover:bg-accent hover:text-foreground",
											)}
										>
											<div className="flex min-w-0 items-center gap-2 truncate">
												<CountryFlag lang={p.id} />
												<span className="truncate font-semibold">{p.endonym}</span>
												<span className="truncate text-[11px] text-muted-foreground">({p.english})</span>
											</div>
											{running && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
										</button>
									);
								})}
							</div>
							{addsRunning.map((t) => (
								<AddingRow key={t.id} task={t} />
							))}
							<div className="my-1 border-t border-border/50" />
							<button
								type="button"
								data-testid="add-language-open"
								onClick={() => {
									setOpen(false);
									languages.openAdd();
								}}
								className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<PlusIcon className="size-3.5" />
								<span>Add a language…</span>
							</button>
						</div>
					</MenuShell>
				)}
			</div>

			{languages.dialogs}

			{languages.note && (
				<p className="px-1 text-xs text-muted-foreground" role="status">
					{languages.note}
				</p>
			)}
			<nav className="flex flex-col gap-3" aria-label="Main">
				{NAV.map((group) => (
					<div
						key={group.id}
						className="flex flex-col gap-0.5"
						role={group.label ? "group" : undefined}
						aria-label={group.label ?? undefined}
						data-testid={`nav-group-${group.id}`}
					>
						{group.id === "trial" && <div className="mb-2 border-t border-border/40" />}
						{group.label && <p className="px-2.5 pb-0.5 pt-1 text-xs font-bold text-muted-foreground">{group.label}</p>}
						{group.items.map((item) => {
							const Icon = NAV_ICONS[item.id];
							return (
								<NavItem
									key={item.id}
									href={item.href}
									testid={`${item.id}-door`}
									active={lit === item.id}
									accent="sun"
									onPress={() => setPressed({ id: item.id, from: pathname })}
									icon={<Icon className="size-[18px]" />}
								>
									{item.label}
									{item.badge && (
										<span
											className="ml-auto rounded-full border border-teal/30 bg-teal-wash px-1.5 py-0.5 text-[10px] font-semibold text-teal tabular-nums"
											data-testid={`${item.id}-badge`}
										>
											{item.badge}
										</span>
									)}
									{item.id === "review" && counts && (reviewDue > 0 || reviewNew > 0) && (
										<span
											className={cn(
												"ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
												reviewDue > 0 ? "bg-sun text-sun-ink" : "bg-accent text-foreground",
											)}
											data-testid="review-badge"
										>
											{reviewDue > 0 ? reviewDue : `${reviewNew} new`}
										</span>
									)}
								</NavItem>
							);
						})}
					</div>
				))}
			</nav>
		</div>
	);
}

/** One primary destination: a trail-sign row. The one you are on is lit
 *  with a sun bar at its edge and a brighter icon, no pill. */
const NAV_ICONS: Record<NavId, LucideIcon> = {
	today: SunIcon,
	ask: PenLineIcon,
	curriculum: MountainSnowIcon,
	review: RepeatIcon,
	read: BookOpenIcon,
	listen: HeadphonesIcon,
	watch: ClapperboardIcon,
	speak: MicIcon,
	eargym: EarIcon,
	fluency: ZapIcon,
	words: BookAIcon,
	grammar: TableIcon,
	notes: NotebookPenIcon,
	progress: ChartNoAxesColumnIcon,
	milestones: FlagIcon,
	mistakes: CircleAlertIcon,
	log: HistoryIcon,
};

function NavItem({
	href,
	testid,
	active,
	accent = "sun",
	onPress,
	icon,
	children,
}: {
	href: string;
	testid: string;
	active: boolean;
	accent?: "sun" | "teal";
	onPress?: () => void;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const wentOnMouseDown = useRef(false);
	const plain = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) =>
		!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
	return (
		<Link
			href={href}
			data-testid={testid}
			onPointerDown={(e) => {
				wentOnMouseDown.current = e.pointerType === "mouse" && plain(e);
				if (!wentOnMouseDown.current) return;
				// UI Events: the click, when there is one, is dispatched right after pointerup, before a timer set in it runs. A press let go off the row has no click to clear the mark.
				const pressEnded = new AbortController();
				const forget = () => {
					pressEnded.abort();
					window.setTimeout(() => (wentOnMouseDown.current = false), 0);
				};
				window.addEventListener("pointerup", forget, { signal: pressEnded.signal });
				window.addEventListener("pointercancel", forget, { signal: pressEnded.signal });
				onPress?.();
				router.push(href);
			}}
			onClick={(e) => {
				if (!plain(e)) return;
				// UI Events: `detail` is the click count for a pointer click and 0 for a click made by Enter, which no mouse-down came before.
				if (wentOnMouseDown.current && e.detail > 0) {
					wentOnMouseDown.current = false;
					e.preventDefault();
					return;
				}
				onPress?.();
			}}
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors",
				active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
			)}
		>
			{active && (
				<span
					className={cn(
						"absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full",
						accent === "teal" ? "bg-teal" : "bg-sun",
					)}
					aria-hidden="true"
				/>
			)}
			<span className={cn("shrink-0", active ? (accent === "teal" ? "text-teal" : "text-sun") : "")}>{icon}</span>
			{children}
		</Link>
	);
}
