"use client";

/**
 * The sidebar's language block (LangHarness): which language profile is
 * running, a switch to the other one, the Today door, and the
 * spaced-review door with its due count. Switching writes the choice and restarts — the desktop app
 * relaunches itself; under `next dev` the learner restarts the server.
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
	GlobeIcon,
	MicIcon,
	MountainSnowIcon,
	PlusIcon,
	RepeatIcon,
	SunIcon,
	XIcon,
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
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState<{ id: string; label: string } | null>(null);
	const [showAddHelp, setShowAddHelp] = useState(false);

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
	const reviewDue = counts ? counts.due + counts.learning : 0;
	const reviewNew = counts?.newLeft ?? 0;
	const activeProfile = profile?.profiles.find((p) => p.id === profile.active);
	const pendingProfile = pending ? profile?.profiles.find((p) => p.id === pending.id) : null;

	const modalDismiss = useBackdropDismiss(() => setPending(null));
	const helpDismiss = useBackdropDismiss(() => setShowAddHelp(false));

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
										<button
											key={p.id}
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
							<div className="my-1 border-t border-border/50" />
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									setShowAddHelp(true);
								}}
								className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
							>
								<PlusIcon className="size-3.5" />
								<span>Add a language...</span>
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

			{/* Add Language Guide Modal */}
			{showAddHelp && typeof document !== "undefined" && createPortal(
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
					{...helpDismiss}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="add-lang-title"
						className="flex w-full max-w-md flex-col gap-3.5 rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								<GlobeIcon className="size-5 text-primary" />
								<h3 id="add-lang-title" className="text-base font-semibold text-foreground">
									Adding a New Language
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowAddHelp(false)}
								className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
							>
								<XIcon className="size-4" />
							</button>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							LangHarness has a modular multi-language system designed to make adding any language straightforward:
						</p>
						<div className="flex flex-col gap-2 rounded-xl bg-accent/40 p-3 text-xs">
							<div className="flex gap-2">
								<span className="font-semibold text-primary">1.</span>
								<span>
									<strong>Register profile:</strong> Add metadata to <code className="rounded bg-muted px-1 py-0.5">src/core/language.ts</code> (or pick from <code className="rounded bg-muted px-1 py-0.5">LANGUAGE_PRESETS</code>).
								</span>
							</div>
							<div className="flex gap-2">
								<span className="font-semibold text-primary">2.</span>
								<span>
									<strong>Enable profile:</strong> Add to <code className="rounded bg-muted px-1 py-0.5">config.ts</code> <code className="rounded bg-muted px-1 py-0.5">LANGUAGE_PROFILES</code>.
								</span>
							</div>
							<div className="flex gap-2">
								<span className="font-semibold text-primary">3.</span>
								<span>
									<strong>Curriculum assets:</strong> Provide vocabulary in <code className="rounded bg-muted px-1 py-0.5">curriculum/&lt;lang&gt;/lexicon.json</code>.
								</span>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							See <strong className="text-foreground">docs/adding-a-language.md</strong> or use the <code className="rounded bg-muted px-1 py-0.5 font-semibold text-foreground">add-language</code> skill for the automated walkthrough.
						</p>
						<div className="flex justify-end pt-1">
							<button
								type="button"
								onClick={() => setShowAddHelp(false)}
								className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
							>
								Got it
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
								<NavItem key={item.id} href={item.href} testid={`${item.id}-door`} active={activeNav?.id === item.id} icon={<Icon className="size-[18px]" />}>
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
const NAV_ICONS: Record<NavId, LucideIcon> = {
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
	icon,
	children,
}: {
	href: string;
	testid: string;
	active: boolean;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			data-testid={testid}
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
