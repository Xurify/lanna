"use client";

/**
 * The sidebar's language block (LangHarness): which language profile is
 * running, a switch to the other one, the Today door, and the
 * spaced-review door with its due count. Switching writes the choice and restarts — the desktop app
 * relaunches itself; under `next dev` the learner restarts the server.
 * "Add a language" builds a new one in the background; while it runs, the
 * menu lists it with its current step.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	BookAIcon,
	BookOpenIcon,
	ChartNoAxesColumnIcon,
	CheckIcon,
	ChevronDownIcon,
	LoaderCircleIcon,
	MicIcon,
	MountainSnowIcon,
	PlusIcon,
	RepeatIcon,
	SunIcon,
	Trash2Icon,
	CircleAlertIcon,
	ClapperboardIcon,
	FlagIcon,
	HeadphonesIcon,
	HistoryIcon,
	type LucideIcon,
	MapIcon,
	TableIcon,
	ZapIcon,
} from "lucide-react";
import { NAV, navItemFor, type NavId } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { MenuShell } from "@/components/menu-shell";
import { CountryFlag } from "@/components/ui/country-flag";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { sharedJson } from "@/lib/shared-fetch";
import { useActivity } from "@/components/activity-dock";
import { AddLanguageDialog } from "@/components/add-language-dialog";

interface ProfileInfo {
	active: string;
	selected: string;
	restartRequired: boolean;
	profiles: Array<{ id: string; tag: string; endonym: string; english: string; lexicon: boolean; seed: boolean; removable?: boolean }>;
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
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState<{ id: string; label: string } | null>(null);
	const [removing, setRemoving] = useState<{ id: string; english: string } | null>(null);
	const [removeError, setRemoveError] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const { feed } = useActivity();
	const addsRunning = feed.tasks.filter((t) => t.kind === "language" && t.status === "running");

	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(() => {
		void sharedJson<ProfileInfo>("/api/profile")
			.then(setProfile)
			.catch(() => {});
		void sharedJson<{ counts: Counts }>(`/api/review?peek&tz=${new Date().getTimezoneOffset()}`, 300)
			.then((s) => setCounts(s.counts))
			.catch(() => {});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);
	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);
	useEffect(() => {
		window.addEventListener("lh:review-changed", refresh);
		return () => window.removeEventListener("lh:review-changed", refresh);
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

	const choose = (id: string, label: string) => {
		setOpen(false);
		if (!profile || id === profile.selected) return;
		setPending({ id, label });
	};

	const confirmSwitch = async () => {
		if (!pending) return;
		const { id, label } = pending;
		setPending(null);
		const res = await fetch("/api/profile", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ active: id }),
		});
		const next = (await res.json()) as ProfileInfo;
		setProfile(next);
		if (!next.restartRequired) return;
		if (window.lh?.relaunch) window.lh.relaunch();
		else setNote(`Restart LangHarness to switch to ${label}.`);
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
	const pendingProfile = pending ? profile?.profiles.find((p) => p.id === pending.id) : null;

	const modalDismiss = useBackdropDismiss(() => setPending(null));
	const removeDismiss = useBackdropDismiss(() => setRemoving(null));

	const confirmRemove = async () => {
		if (!removing) return;
		setRemoveError(null);
		const res = await fetch("/api/languages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remove", id: removing.id }) }).catch(() => null);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => null)) as { message?: string } | null;
			setRemoveError(body?.message ?? `Could not remove ${removing.english}.`);
			return;
		}
		setRemoving(null);
		refresh();
	};

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
							"flex h-9 w-full items-center justify-between gap-2 rounded-xl bg-card px-2.5 text-xs font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] transition-colors hover:bg-accent/70",
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
							<div className="px-2 py-1 text-[10px] font-boldr text-muted-foreground/70">
								Target Language
							</div>
							<div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
								{profile.profiles.map((p) => {
									const running = p.id === profile.active;
									const isPending = p.id === profile.selected && profile.restartRequired;
									return (
										<div key={p.id} className="group relative">
										<button
											type="button"
											role="option"
											aria-selected={running}
											data-testid={`profile-${p.id}`}
											onClick={() => choose(p.id, p.english)}
											className={cn(
												"flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
												running
													? "bg-accent font-semibold text-foreground shadow-xs"
													: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
												isPending && "ring-1 ring-primary/50",
												p.removable && "pr-8",
											)}
										>
											<div className="flex min-w-0 items-center gap-2 truncate">
												<CountryFlag lang={p.id} />
												<span className="truncate font-semibold">{p.endonym}</span>
												<span className="truncate text-[11px] text-muted-foreground">({p.english})</span>
											</div>
											{running && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
										</button>
										{p.removable && (
											<button
												type="button"
												aria-label={`Remove ${p.english}`}
												title={`Remove ${p.english}`}
												data-testid={`profile-remove-${p.id}`}
												onClick={() => {
													setOpen(false);
													setRemoveError(null);
													setRemoving({ id: p.id, english: p.english });
												}}
												className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
											>
												<Trash2Icon className="size-3.5" />
											</button>
										)}
										</div>
									);
								})}
							</div>
							{addsRunning.map((t) => (
								<div key={t.id} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground" data-testid="profile-adding">
									<LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
									<span className="min-w-0 flex-1 truncate">
										<span className="font-semibold">{t.language?.english ?? t.title}</span> · {t.step}
									</span>
								</div>
							))}
							<div className="my-1 border-t border-border/50" />
							<button
								type="button"
								data-testid="add-language-open"
								onClick={() => {
									setOpen(false);
									setAdding(true);
								}}
								className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
							>
								<PlusIcon className="size-3.5" />
								<span>Add a language…</span>
							</button>
						</div>
					</MenuShell>
				)}
			</div>

			{/* Centered Modal Confirmation — zero layout shift on sidebar navigation */}
			{pending && typeof document !== "undefined" && createPortal(
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
					{...modalDismiss}
				>
					<div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="switch-dialog-title"
						data-testid="profile-confirm"
						className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-5 shadow-raise-hi animate-in zoom-in-95 duration-150"
					>
						<div className="flex items-center gap-3">
							<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/40">
								<CountryFlag lang={pending.id} className="w-[30px] h-[20px] rounded-[4px]" />
							</div>
							<div className="min-w-0 flex-1">
								<h3 id="switch-dialog-title" className="text-sm font-semibold text-foreground">
									Switch to {pending.label}?
								</h3>
								<p className="text-xs text-muted-foreground">
									LangHarness restarts in {pending.label}.
								</p>
							</div>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							Your {activeProfile?.english ?? "current"} progress stays safely as it is.
						</p>
						<div className="flex items-center justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={() => setPending(null)}
								className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								Cancel
							</button>
							<button
								type="button"
								data-testid="profile-confirm-switch"
								onClick={() => void confirmSwitch()}
								className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
							>
								Switch &amp; Restart
							</button>
						</div>
					</div>
				</div>,
				document.body,
			)}

			{adding && typeof document !== "undefined" && <AddLanguageDialog onClose={() => setAdding(false)} onStarted={() => setAdding(false)} />}

			{removing && typeof document !== "undefined" && createPortal(
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...removeDismiss}>
					<div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="remove-lang-title"
						data-testid="profile-remove-confirm"
						className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-5 shadow-raise-hi animate-in zoom-in-95 duration-150"
					>
						<h3 id="remove-lang-title" className="text-sm font-semibold text-foreground">
							Remove {removing.english}?
						</h3>
						<p className="text-xs leading-relaxed text-muted-foreground">
							Its downloaded words, sentences and grammar map are deleted. Your {removing.english} progress stays: add {removing.english} again and you pick up where you were.
						</p>
						{removeError && (
							<p className="text-xs text-destructive" role="alert">
								{removeError}
							</p>
						)}
						<div className="flex items-center justify-end gap-2 pt-2">
							<button type="button" onClick={() => setRemoving(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
								Cancel
							</button>
							<button
								type="button"
								data-testid="profile-remove-confirm-button"
								onClick={() => void confirmRemove()}
								className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-destructive/90 dark:bg-destructive/60"
							>
								Remove
							</button>
						</div>
					</div>
				</div>,
				document.body,
			)}

			{note && <p className="px-1 text-xs text-muted-foreground">{note}</p>}
			<nav className="flex flex-col gap-3" aria-label="Main">
				{NAV.map((group) => (
					<div key={group.id} className="flex flex-col gap-0.5" role={group.label ? "group" : undefined} aria-label={group.label ?? undefined} data-testid={`nav-group-${group.id}`}>
						{group.label && <p className="px-2.5 pb-0.5 pt-1 text-xs font-bold text-muted-foreground">{group.label}</p>}
						{group.items.map((item) => {
							const Icon = NAV_ICONS[item.id];
							return (
								<NavItem key={item.id} href={item.href} testid={`${item.id}-door`} active={lit === item.id} onPress={() => setPressed({ id: item.id, from: pathname })} icon={<Icon className="size-[18px]" />}>
									{item.label}
									{item.id === "review" && counts && (reviewDue > 0 || reviewNew > 0) && (
										<span
											className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", reviewDue > 0 ? "bg-sun text-sun-ink" : "bg-accent text-foreground")}
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
export const NAV_ICONS: Record<NavId, LucideIcon> = {
	today: SunIcon,
	curriculum: MountainSnowIcon,
	review: RepeatIcon,
	read: BookOpenIcon,
	listen: HeadphonesIcon,
	watch: ClapperboardIcon,
	speak: MicIcon,
	fluency: ZapIcon,
	words: BookAIcon,
	grammar: TableIcon,
	map: MapIcon,
	progress: ChartNoAxesColumnIcon,
	milestones: FlagIcon,
	mistakes: CircleAlertIcon,
	log: HistoryIcon,
};

function NavItem({
	href,
	testid,
	active,
	onPress,
	icon,
	children,
}: {
	href: string;
	testid: string;
	active: boolean;
	onPress?: () => void;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			data-testid={testid}
			onClick={(e) => {
				if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) onPress?.();
			}}
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors",
				active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
			)}
		>
			{active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sun" aria-hidden="true" />}
			<span className={cn("shrink-0", active ? "text-sun" : "")}>{icon}</span>
			{children}
		</Link>
	);
}
