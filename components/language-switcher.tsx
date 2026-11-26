"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
	XIcon,
	ZapIcon,
} from "lucide-react";
import { CapLabel, withCapLabels } from "@/components/ui/cap-label";
import { NAV, navItemFor, type NavId } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { MenuShell } from "@/components/menu-shell";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { CountryFlag } from "@/components/ui/country-flag";
import { sharedJson } from "@/lib/shared-fetch";
import { useActivity, type FeedTask } from "@/components/activity-dock";
import { useLanguageActions, type ProfileEntry, type ProfileInfo } from "@/components/language-actions";
import { catalogLanguage } from "@/src/core";
import { shownLanguages, useHiddenLanguages } from "@/components/hidden-languages";

interface Counts {
	due: number;
	learning: number;
	newLeft: number;
}

export function AddingRow({ task, sheet = false }: { task: FeedTask; sheet?: boolean }) {
	const id = task.language?.id ?? "";
	const english = task.language?.english ?? task.title;
	const endonym = catalogLanguage(id)?.endonym ?? english;
	return (
		<div
			className={cn(
				"flex w-full items-center justify-between gap-2 text-left text-muted-foreground",
				sheet ? "min-h-12 rounded-xl px-3 py-2.5 text-sm" : "rounded-md px-2.5 py-1.5 text-xs",
			)}
			data-testid="profile-adding"
		>
			<div className={cn("flex min-w-0 items-center truncate", sheet ? "gap-3" : "gap-2")}>
				<CountryFlag lang={id} className={sheet ? "h-[18px] w-[27px] rounded-[3px]" : undefined} />
				<span className="truncate font-semibold">{endonym}</span>
				<span className={cn("truncate text-muted-foreground", sheet ? "text-xs" : "text-[11px]")}>({english})</span>
			</div>
			<LoaderCircleIcon className={cn("shrink-0 animate-spin", sheet ? "size-4" : "size-3.5")} aria-hidden />
			<span className="sr-only">Being added</span>
		</div>
	);
}

export function LanguageSheetBody({
	profiles,
	active,
	switching,
	addsRunning,
	note,
	onChoose,
	onOpenAdd,
	onClose,
}: {
	profiles: ProfileEntry[];
	active: string;
	switching: string | null;
	addsRunning: FeedTask[];
	note: string | null;
	onChoose: (id: string) => void;
	onOpenAdd: () => void;
	onClose: () => void;
}) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="language-sheet-title"
			data-testid="language-menu"
			onClick={(event) => event.stopPropagation()}
			className="flex w-full flex-col rounded-t-2xl border-t border-border bg-card shadow-raise-hi animate-in slide-in-from-bottom-4 duration-150 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
		>
			<div className="flex items-center justify-between px-4 pt-3.5 pb-2">
				<h2 id="language-sheet-title" className="text-[15px] font-semibold text-foreground">
					Target language
				</h2>
				<button
					type="button"
					aria-label="Close"
					data-testid="language-sheet-close"
					onClick={onClose}
					className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-11"
				>
					<XIcon className="size-4" aria-hidden />
				</button>
			</div>
			<div
				role="listbox"
				aria-label="Languages"
				className="flex max-h-[60dvh] flex-col gap-1 overflow-y-auto px-2 pb-2"
			>
				{profiles.map((entry) => {
					const running = entry.id === active;
					const pending = switching === entry.id;
					return (
						<button
							key={entry.id}
							type="button"
							role="option"
							aria-selected={running}
							disabled={switching !== null && !pending}
							data-testid={`profile-${entry.id}`}
							onClick={() => onChoose(entry.id)}
							className={cn(
								"flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50",
								running ? "bg-accent font-semibold text-foreground" : "text-foreground/90 hover:bg-accent",
							)}
						>
							<div className="flex min-w-0 items-center gap-3">
								<CountryFlag lang={entry.id} className="h-[18px] w-[27px] shrink-0 rounded-[3px]" />
								<div className="flex min-w-0 items-baseline gap-1.5">
									<span className="truncate font-semibold text-foreground">{entry.endonym}</span>
									<span className="truncate text-xs font-normal text-muted-foreground">({entry.english})</span>
								</div>
							</div>
							{pending ? (
								<LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
							) : running ? (
								<CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
							) : null}
						</button>
					);
				})}
				{addsRunning.map((task) => (
					<AddingRow key={task.id} task={task} sheet />
				))}
			</div>
			{note && (
				<p className="mx-3 mb-2 rounded-lg bg-miss-soft px-3 py-2 text-xs text-foreground" role="alert">
					{note}
				</p>
			)}
			<div className="border-t border-border/60 px-2 pt-2">
				<button
					type="button"
					data-testid="add-language-open"
					disabled={switching !== null}
					onClick={onOpenAdd}
					className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
				>
					<PlusIcon className="size-4 shrink-0" aria-hidden />
					<CapLabel>Add a language…</CapLabel>
				</button>
			</div>
		</div>
	);
}

function LanguageSheet({
	profiles,
	active,
	switching,
	addsRunning,
	note,
	onChoose,
	onOpenAdd,
	onClose,
}: {
	profiles: ProfileEntry[];
	active: string;
	switching: string | null;
	addsRunning: FeedTask[];
	note: string | null;
	onChoose: (id: string) => void;
	onOpenAdd: () => void;
	onClose: () => void;
}) {
	const dismiss = useBackdropDismiss(onClose);
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopImmediatePropagation();
			closeRef.current();
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			if (previous?.isConnected) previous.focus();
		};
	}, []);

	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-end bg-black/55 animate-in fade-in duration-100"
			data-testid="language-sheet-backdrop"
			{...dismiss}
		>
			<LanguageSheetBody
				profiles={profiles}
				active={active}
				switching={switching}
				addsRunning={addsRunning}
				note={note}
				onChoose={onChoose}
				onOpenAdd={onOpenAdd}
				onClose={onClose}
			/>
		</div>,
		document.body,
	);
}

export function LanguageSwitcher({ phone = false, drawerOpen = true }: { phone?: boolean; drawerOpen?: boolean }) {
	const pathname = usePathname();
	const [profile, setProfile] = useState<ProfileInfo | null>(null);
	const [counts, setCounts] = useState<Counts | null>(null);
	const [open, setOpen] = useState(false);
	const { feed } = useActivity();
	const hidden = useHiddenLanguages();
	const addsRunning = feed.tasks.filter((task) => task.kind === "language" && task.status === "running");

	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(() => {
		const timezoneOffset = new Date().getTimezoneOffset();
		void sharedJson<ProfileInfo>("/api/profile")
			.then(setProfile)
			.catch(() => {});
		void sharedJson<{ counts: Counts }>(`/api/review?peek&tz=${timezoneOffset}`, 300)
			.then((snapshot) => setCounts(snapshot.counts))
			.catch(() => {});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh, pathname]);
	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);
	useEffect(() => {
		if (phone && !drawerOpen) setOpen(false);
	}, [phone, drawerOpen]);
	useEffect(() => {
		window.addEventListener("lanna:review-changed", refresh);
		return () => window.removeEventListener("lanna:review-changed", refresh);
	}, [refresh]);

	useEffect(() => {
		if (!open || phone) return;
		const onPointerDown = (event: PointerEvent) => {
			if (triggerRef.current?.contains(event.target as Node)) return;
			if (menuRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open, phone]);

	const languages = useLanguageActions({ profile, onChanged: (next) => (next ? setProfile(next) : refresh()) });
	const choose = (id: string) => {
		if (!profile || id === profile.active) {
			setOpen(false);
			return;
		}
		if (!phone) setOpen(false);
		languages.choose(id);
	};

	const activeNav = navItemFor(pathname);
	const [pressed, setPressed] = useState<{ id: NavId; from: string } | null>(null);
	const lit = pressed && pressed.from === pathname ? pressed.id : activeNav?.id;
	useEffect(() => {
		setPressed(null);
	}, [pathname]);
	const reviewDue = counts ? counts.due + counts.learning : 0;
	const reviewNew = counts?.newLeft ?? 0;
	const activeProfile = profile?.profiles.find((entry) => entry.id === profile.active);
	const visibleProfiles = profile ? shownLanguages(profile.profiles, profile.active, hidden) : [];

	return (
		<div className="mx-3 mb-3 flex flex-col gap-3" data-testid="language-block">
			<div className="relative h-9 max-md:h-11 touch-narrow:h-11">
				{profile ? (
					<button
						ref={triggerRef}
						type="button"
						aria-haspopup={phone ? "dialog" : "listbox"}
						aria-expanded={open}
						data-testid="profile-trigger"
						onClick={() => setOpen((wasOpen) => !wasOpen)}
						className={cn(
							"flex h-9 w-full items-center justify-between gap-2 rounded-xl bg-card px-2.5 text-xs font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] transition-colors hover:bg-accent max-md:h-11 max-md:px-3 max-md:text-sm touch-narrow:h-11 touch-narrow:px-3 touch-narrow:text-sm",
							open && "ring-1 ring-border",
						)}
					>
						<div className="flex min-w-0 items-center gap-2 truncate">
							<CountryFlag lang={activeProfile?.id ?? "slovak"} />
							<span className="truncate">{activeProfile?.endonym ?? "Language"}</span>
							{activeProfile && (
								<span className="truncate text-[11px] font-normal text-muted-foreground max-md:text-xs touch-narrow:text-xs">
									({activeProfile.english})
								</span>
							)}
						</div>
						{languages.switching ? (
							<LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
						) : (
							<ChevronDownIcon
								className={cn(
									"size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
									open && "rotate-180",
								)}
							/>
						)}
					</button>
				) : (
					<div
						className="h-9 animate-pulse rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--q-line-2)] max-md:h-11 touch-narrow:h-11"
						aria-hidden
					/>
				)}

				{open && profile && phone && (
					<LanguageSheet
						profiles={visibleProfiles}
						active={profile.active}
						switching={languages.switching}
						addsRunning={addsRunning}
						note={languages.note}
						onChoose={choose}
						onOpenAdd={() => {
							setOpen(false);
							languages.openAdd();
						}}
						onClose={() => setOpen(false)}
					/>
				)}

				{open && profile && !phone && (
					<MenuShell
						anchorRef={triggerRef}
						testid="language-menu"
						preferredSide="down"
						align="left"
						matchAnchorWidth
						menuClass="flex flex-col gap-0.5 rounded-xl border bg-card p-1.5 text-xs shadow-raise-hi"
					>
						<div ref={menuRef} role="listbox" aria-label="Languages" className="flex flex-col gap-0.5">
							<div className="px-2 py-1 text-xs font-semibold text-ink-3">Target language</div>
							<div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
								{visibleProfiles.map((entry) => {
									const running = entry.id === profile.active;
									const pending = languages.switching === entry.id;
									return (
										<button
											key={entry.id}
											type="button"
											role="option"
											aria-selected={running}
											data-testid={`profile-${entry.id}`}
											onClick={() => choose(entry.id)}
											className={cn(
												"flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
												running
													? "bg-accent font-semibold text-foreground"
													: "text-muted-foreground hover:bg-accent hover:text-foreground",
											)}
										>
											<div className="flex min-w-0 items-center gap-2 truncate">
												<CountryFlag lang={entry.id} />
												<span className="truncate font-semibold">{entry.endonym}</span>
												<span className="truncate text-[11px] text-muted-foreground">({entry.english})</span>
											</div>
											{pending ? (
												<LoaderCircleIcon
													className="size-3.5 shrink-0 animate-spin text-muted-foreground"
													aria-hidden
												/>
											) : running ? (
												<CheckIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
											) : null}
										</button>
									);
								})}
							</div>
							{addsRunning.map((task) => (
								<AddingRow key={task.id} task={task} />
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
								<PlusIcon className="size-3.5 shrink-0" aria-hidden />
								<CapLabel>Add a language…</CapLabel>
							</button>
						</div>
					</MenuShell>
				)}
			</div>

			{languages.dialogs}

			{languages.note && !open && (
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
			{withCapLabels(children)}
		</Link>
	);
}
