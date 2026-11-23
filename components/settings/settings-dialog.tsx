"use client";
/**
 * The settings dialog: a centered modal over whatever screen is open, with a
 * left section nav and one scrolling content column. It is surface-agnostic:
 * sections talk only to /api/settings* and localStorage, so it could move into
 * its own window.
 *
 * One record instance serves the whole dialog. Sections write through `write`,
 * and switching sections never refetches.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
	CURRENT_SETTINGS_VERSION,
	type AgentSettings,
	type AppearanceSettings,
	type CompactionSettings,
	type UserSettings,
} from "@/src/core";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAppearance } from "./appearance.tsx";
import { SettingsGroup, SettingsSection } from "./controls.tsx";
import { LessonSoundsRow, PlaybackSpeedRow, VolumeRow, WordLookupModeRow } from "./device-prefs.tsx";
import { SystemVoicesRow } from "./system-voices.tsx";
import { SourcesSection } from "./sources-section.tsx";
import { UpdateSettings } from "./update-settings.tsx";
import { AiSection } from "./ai-section.tsx";
import type { ModelsSettings } from "@/src/core";
import { MENU_CLOSE_EVENT, MENU_OPEN_EVENT } from "@/components/menu-shell";
import { notifySettingsSaved } from "@/components/settings-signal";
import { KeysSection } from "./keys-section.tsx";
import { AppearanceSection } from "./appearance-section.tsx";
import { NotificationsSection } from "./notifications-section.tsx";
import {
	BellIcon,
	BookMarkedIcon,
	BotIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloudUploadIcon,
	CoinsIcon,
	DatabaseIcon,
	GraduationCapIcon,
	KeyboardIcon,
	KeyRoundIcon,
	PaletteIcon,
	SearchIcon,
	SmartphoneIcon,
	SlidersHorizontalIcon,
	SlidersIcon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { KeyboardSection } from "./keyboard-section.tsx";
import { DevicesSection } from "./devices-section.tsx";
import { UsageSection } from "./usage-section.tsx";
import { LearnerSection } from "./learner-section.tsx";
import { ResetSection } from "./reset-section.tsx";
import { StorageSection } from "./storage-section.tsx";
import { BackupSection } from "./backup-section.tsx";
import { sharedJson } from "@/lib/shared-fetch";

/** The nav label is the section's heading. Ids are internal: deep links and tests use them.
 *  Listed in the order a learner reaches for them: lesson settings first, the app's own settings last. */
export const SETTINGS_SECTIONS = [
	{ id: "learner", label: "Learning", group: "Lessons" },
	{ id: "sound", label: "Sound", group: "Lessons" },
	{ id: "notifications", label: "Notifications", group: "Lessons" },
	{ id: "appearance", label: "Appearance", group: "Look and controls" },
	{ id: "keyboard", label: "Keyboard", group: "Look and controls" },
	{ id: "ai", label: "AI models", group: "AI" },
	{ id: "keys", label: "API keys", group: "AI" },
	{ id: "usage", label: "Spending", group: "AI" },
	{ id: "general", label: "General", group: "App and data" },
	{ id: "devices", label: "Devices", group: "App and data" },
	{ id: "data", label: "Data", group: "App and data" },
	{ id: "backup", label: "Backup", group: "App and data" },
	{ id: "sources", label: "Sources", group: "App and data" },
] as const;
export type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** Words a learner might type for a section, beyond its own label. */
const SECTION_KEYWORDS: Record<SectionId, string> = {
	learner: "languages goals level explain parallels purpose minutes days",
	sound: "volume speed voice voices playback lesson sounds audio",
	notifications: "reminders alerts notify",
	appearance: "theme day night dark light font colors text",
	keyboard: "shortcuts keys rebind hotkeys",
	ai: "models strong cheap vision tools web research pdf prompts instructions long chats",
	keys: "api key subscription provider",
	usage: "spending cost money usage tokens",
	general: "updates version dictionary word lookup",
	devices: "phone ipad tailscale remote access pair",
	data: "storage cache reset start over delete",
	backup: "backup cloudflare r2 folder copy",
	sources: "credits licenses attribution",
};

export function sectionMatches(section: { id: SectionId; label: string; group: string }, query: string): boolean {
	const words = query.trim().toLowerCase().split(/s+/).filter(Boolean);
	const haystack = `${section.label} ${section.group} ${SECTION_KEYWORDS[section.id]}`.toLowerCase();
	return words.every((word) => haystack.includes(word));
}

const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
	keys: KeyRoundIcon,
	ai: BotIcon,
	learner: GraduationCapIcon,
	notifications: BellIcon,
	appearance: PaletteIcon,
	keyboard: KeyboardIcon,
	devices: SmartphoneIcon,
	usage: CoinsIcon,
	general: SlidersHorizontalIcon,
	sound: Volume2Icon,
	data: DatabaseIcon,
	backup: CloudUploadIcon,
	sources: BookMarkedIcon,
};

export function SettingsDialogOpen({
	onClose,
	initialSection,
	initialRow,
}: {
	onClose: () => void;
	initialSection: SectionId | null;
	initialRow: string | null;
}) {
	return <SettingsDialog onClose={onClose} initialSection={initialSection} initialRow={initialRow} />;
}

function SettingsDialog({
	onClose,
	initialSection,
	initialRow,
}: {
	onClose: () => void;
	initialSection: SectionId | null;
	/** Keys row to unfold on open. */
	initialRow: string | null;
}) {
	return (
		<Dialog open={true} onClose={onClose}>
			<DialogPortal>
				<DialogOverlay data-testid="settings-backdrop" className="max-md:p-0">
					<SettingsDialogBody onClose={onClose} initialSection={initialSection} initialRow={initialRow} />
				</DialogOverlay>
			</DialogPortal>
		</Dialog>
	);
}

/** The dialog without the portal/backdrop â the SSR-testable frame
 *  (portals render nothing under renderToStaticMarkup). */
function SettingsDialogBody({
	onClose,
	initialSection = "learner",
	initialRow = null,
}: {
	onClose: () => void;
	initialSection?: SectionId | null;
	/** Keys row to unfold on arrival (null = none). */
	initialRow?: string | null;
}) {
	const { onAppearanceChange } = useAppearance();
	const [record, setRecord] = useState<UserSettings | null | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);
	// MenuShell open-count â drives the content column's scroll lock.
	const [openMenus, setOpenMenus] = useState(0);
	const contentRef = useRef<HTMLDivElement | null>(null);
	// While a MenuShell is open, wheel and touchmove on the content column are blocked.
	// The scrollbar stays, so nothing shifts. Native listeners are needed: React attaches wheel and touch passively.
	useEffect(() => {
		const el = contentRef.current;
		if (!el || openMenus === 0) return;
		const block = (e: Event) => e.preventDefault();
		el.addEventListener("wheel", block, { passive: false });
		el.addEventListener("touchmove", block, { passive: false });
		return () => {
			el.removeEventListener("wheel", block);
			el.removeEventListener("touchmove", block);
		};
	}, [openMenus]);

	useEffect(() => {
		const onOpen = () => setOpenMenus((n) => n + 1);
		const onClose = () => setOpenMenus((n) => Math.max(0, n - 1));
		window.addEventListener(MENU_OPEN_EVENT, onOpen);
		window.addEventListener(MENU_CLOSE_EVENT, onClose);
		return () => {
			window.removeEventListener(MENU_OPEN_EVENT, onOpen);
			window.removeEventListener(MENU_CLOSE_EVENT, onClose);
		};
	}, []);
	const [active, setActive] = useState<SectionId>(initialSection ?? "learner");
	const [phoneShowsSection, setPhoneShowsSection] = useState(initialSection !== null);
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (window.matchMedia("(min-width: 768px)").matches) searchRef.current?.focus();
		const focusSearch = () => searchRef.current?.focus();
		const slashToSearch = (e: KeyboardEvent) => {
			const typing = (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]');
			if (e.key !== "/" || typing || e.metaKey || e.ctrlKey || e.altKey) return;
			e.preventDefault();
			focusSearch();
		};
		document.addEventListener("keydown", slashToSearch);
		window.addEventListener("lanna:kbd-cycle-fields", focusSearch);
		return () => {
			window.removeEventListener("lanna:kbd-cycle-fields", focusSearch);
			document.removeEventListener("keydown", slashToSearch);
		};
	}, []);
	const visibleSections = SETTINGS_SECTIONS.filter((s) => sectionMatches(s, query));
	// A deep link while the dialog is already open changes initialSection; follow it.
	useEffect(() => {
		setActive(initialSection ?? "learner");
		setPhoneShowsSection(initialSection !== null);
	}, [initialSection]);

	// Fetch once per mount. 200 with {settings: null} is first boot, not an error.
	useEffect(() => {
		sharedJson<{ settings: UserSettings | null }>("/api/settings")
			.then((body) => setRecord(body.settings ?? { version: CURRENT_SETTINGS_VERSION }))
			.catch(() => setRecord(null));
	}, []);

	// Escape closes the dialog, the outer layer. Inner editors handle Esc first.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// One Esc, one action: claim it at document level so the window chain does not also act.
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	/** The one writer: PUT the section, sync the record, show route errors inline. */
	const write = useCallback(
		async (section: "general" | "agent" | "models" | "appearance" | "compaction" | "notifications", body: object) => {
			setError(null);
			const res = await fetch(`/api/settings/${section}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const detail = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(`Couldn't save this setting: ${detail.error ?? `error ${res.status}`}`);
				return;
			}
			// Store the server's answer, not the request body: the models section clamps thinking levels on write.
			const stored = ((await res.json().catch(() => null)) as { settings?: UserSettings } | null)?.settings;
			setRecord((prev) => stored ?? ({ ...(prev ?? {}), [section]: body } as UserSettings));
			notifySettingsSaved(section);
			if (section === "appearance") onAppearanceChange(body as AppearanceSettings);
		},
		[onAppearanceChange],
	);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Settings"
			data-testid="settings-dialog"
			className="flex h-[640px] max-h-[85vh] w-[940px] max-w-[92vw] flex-col overflow-hidden rounded-xl bg-card shadow-raise-hi animate-in zoom-in-95 duration-150 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none"
			onClick={(e) => e.stopPropagation()}
		>
			<header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 max-md:h-14 max-md:px-2">
				<div className="flex min-w-0 items-center gap-3 max-md:gap-1">
					{phoneShowsSection && (
						<button
							type="button"
							aria-label="All settings"
							data-testid="settings-back"
							className="flex size-11 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-well md:hidden"
							onClick={() => setPhoneShowsSection(false)}
						>
							<ChevronLeftIcon className="size-5" />
						</button>
					)}
					<div
						className={cn(
							"flex size-9 items-center justify-center rounded-lg bg-teal-wash text-teal max-md:ml-2",
							phoneShowsSection && "max-md:hidden",
						)}
					>
						<SlidersIcon className="size-5" />
					</div>
					<div className="min-w-0">
						<h2 className="truncate font-ui text-base font-semibold tracking-[-0.01em] text-foreground">Settings</h2>
						<p className="text-xs text-muted-foreground max-md:hidden">How Lanna teaches, sounds and looks</p>
					</div>
				</div>
				<button
					type="button"
					aria-label="Close settings"
					data-testid="settings-close"
					className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-well hover:text-ink-2 max-md:flex max-md:size-11 max-md:items-center max-md:justify-center"
					onClick={onClose}
				>
					<XIcon className="size-4 max-md:size-5" />
				</button>
			</header>

			<div className="flex min-h-0 flex-1">
				<nav
					aria-label="Settings sections"
					data-testid="settings-nav"
					className={cn(
						"flex w-52 shrink-0 flex-col gap-1 overflow-y-auto bg-side p-3 shadow-[inset_-1px_0_0_var(--q-line)] max-md:w-full max-md:gap-0.5 max-md:bg-card max-md:p-2 max-md:shadow-none",
						phoneShowsSection && "max-md:hidden",
					)}
				>
					<div className="relative mb-2 max-md:px-1 max-md:pt-1">
						<SearchIcon
							aria-hidden
							className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3 max-md:left-4"
						/>
						<Input
							aria-label="Search settings"
							className="h-10 bg-card pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
							id="settings-search"
							ref={searchRef}
							type="search"
							value={query}
							placeholder="Search"
							data-testid="settings-search"
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape" && query) {
									e.stopPropagation();
									setQuery("");
									return;
								}
								const first = visibleSections[0];
								if (e.key !== "Enter" || !first) return;
								setActive(first.id);
								setPhoneShowsSection(true);
							}}
						/>
						{!query && (
							<kbd
								aria-hidden
								className="q-kbd pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 max-md:hidden"
							>
								/
							</kbd>
						)}
					</div>
					{visibleSections.length === 0 && (
						<p className="px-3 py-2 text-xs text-ink-2" data-testid="settings-search-empty">
							No setting matches &ldquo;{query.trim()}&rdquo;.
						</p>
					)}
					{visibleSections.map((s, index) => {
						const Icon = SECTION_ICONS[s.id];
						return (
							<Fragment key={s.id}>
								{(index === 0 || visibleSections[index - 1]?.group !== s.group) && (
									<p
										className={cn(
											"px-3 pb-1 font-ui text-xs font-medium text-ink-2",
											index === 0 ? "pt-1" : "pt-4 max-md:pt-5",
										)}
									>
										{s.group}
									</p>
								)}
								<button
									type="button"
									data-testid={`settings-nav-${s.id}`}
									aria-current={active === s.id}
									className={cn(
										"flex items-center gap-2.5 rounded-lg px-3 py-2 text-left font-ui text-sm transition-colors max-md:min-h-12 max-md:gap-3 max-md:text-[15px] max-md:text-foreground max-md:hover:bg-well",
										active === s.id
											? "md:bg-card md:font-semibold md:text-teal-2 md:shadow-raise"
											: "text-ink-2 hover:bg-well-2 hover:text-foreground",
									)}
									onClick={() => {
										setActive(s.id);
										setPhoneShowsSection(true);
									}}
								>
									{Icon && (
										<Icon
											className={cn(
												"size-4 shrink-0 transition-colors",
												active === s.id ? "md:text-teal" : "text-ink-3",
												"max-md:size-5 max-md:text-ink-2",
											)}
										/>
									)}
									<span className="cap-center flex-1">{s.label}</span>
									<ChevronRightIcon className="size-4 text-ink-4 md:hidden" aria-hidden />
								</button>
							</Fragment>
						);
					})}
				</nav>

				{/* Content column: one section at a time. Scroll locks while a MenuShell is open. */}
				<div
					ref={contentRef}
					className={cn("min-w-0 flex-1 overflow-y-auto", !phoneShowsSection && "max-md:hidden")}
					data-testid="settings-content"
				>
					{error && (
						<p
							role="alert"
							className="m-4 rounded-sm border border-red-500/40 px-3 py-2 text-xs text-red-500"
							data-testid="settings-error"
						>
							{error}
						</p>
					)}
					{record === undefined ? (
						<p className="px-6 py-5 text-xs text-muted-foreground">Loading settingsâ¦</p>
					) : record === null ? (
						<p className="px-6 py-5 text-xs text-muted-foreground">
							Settings could not be loaded â refresh to retry.
						</p>
					) : (
						<div>
							{active === "general" && (
								<SettingsSection title="General" hint="App updates and word lookup." testid="section-general">
									<SettingsGroup label="Updates" testid="group-updates">
										<UpdateSettings
											autoUpdate={record.general?.autoUpdate ?? true}
											onAutoUpdateChange={(on) => void write("general", { ...record.general, autoUpdate: on })}
										/>
									</SettingsGroup>
									<SettingsGroup label="Dictionary & word lookup" testid="group-word-lookup">
										<WordLookupModeRow />
									</SettingsGroup>
								</SettingsSection>
							)}
							{active === "notifications" && (
								<NotificationsSection
									settings={record.notifications}
									onSave={(next) => void write("notifications", next)}
								/>
							)}
							{active === "sound" && (
								<SettingsSection
									title="Sound"
									hint="Volume, speech speed, system voices and lesson sounds. Saved on this device."
									testid="section-sound"
								>
									<SettingsGroup label="Voice" testid="group-voice">
										<VolumeRow />
										<PlaybackSpeedRow />
										<SystemVoicesRow />
									</SettingsGroup>
									<SettingsGroup label="Lessons" testid="group-sound">
										<LessonSoundsRow />
									</SettingsGroup>
								</SettingsSection>
							)}
							{active === "keys" && (
								<SettingsSection
									title="API keys"
									hint="The keys and subscriptions that let Lanna use AI models and AI voices."
									testid="section-keys"
								>
									<KeysSection initialRow={initialRow ?? undefined} />
								</SettingsSection>
							)}
							{active === "ai" && (
								<SettingsSection
									title="AI models"
									hint="Which AI models Lanna uses, what they may look up, and their instructions. Needs an API key."
									testid="section-ai"
								>
									<AiSection
										agent={record.agent}
										models={record.models}
										compaction={record.compaction}
										onModelsChange={(next: ModelsSettings) => void write("models", next)}
										onSectionChange={(next: AgentSettings) => void write("agent", next)}
										onCompactionChange={(next: CompactionSettings) => void write("compaction", next)}
										onOpenKeys={() => {
											setActive("keys");
											setPhoneShowsSection(true);
										}}
									/>
								</SettingsSection>
							)}
							{active === "appearance" && (
								<SettingsSection
									title="Appearance"
									hint="Day or night, the reading font and text colors."
									testid="section-appearance"
								>
									<AppearanceSection
										appearance={record.appearance}
										onSectionChange={(next: AppearanceSettings) => void write("appearance", next)}
									/>
								</SettingsSection>
							)}
							{active === "keyboard" && (
								<SettingsSection
									title="Keyboard"
									hint="Click Rebind, then press the new keys."
									testid="section-keyboard"
								>
									<KeyboardSection />
								</SettingsSection>
							)}
							{active === "devices" && (
								<SettingsSection
									title="Devices"
									hint="Use Lanna on a phone or iPad over your own Tailscale network. Off by default: until you turn it on, only this computer can open the app."
									testid="section-devices"
								>
									<DevicesSection />
								</SettingsSection>
							)}
							{active === "learner" && (
								<SettingsSection
									title="Learning"
									hint="Your languages, your goals, and how the tutor explains and checks."
									testid="section-learner"
								>
									<LearnerSection onClose={onClose} />
								</SettingsSection>
							)}
							{active === "data" && (
								<SettingsSection
									title="Data"
									hint="What the app keeps on this computer. The cache can be cleared; voice clips, progress and backups stay."
									testid="section-storage"
								>
									<StorageSection />
								</SettingsSection>
							)}
							{active === "data" && (
								<SettingsSection title="Reset" hint="Start over from scratch" testid="section-reset">
									<ResetSection />
								</SettingsSection>
							)}
							{active === "backup" && (
								<SettingsSection
									title="Backup"
									hint="Copies of everything the app keeps, in a folder on this computer, in your own Cloudflare R2 bucket, or in both. This computer stays the one Lanna reads and writes."
									testid="section-backup"
								>
									<BackupSection />
								</SettingsSection>
							)}
							{active === "sources" && (
								<SettingsSection
									title="Sources"
									hint="Where the app's words, sentences, voices, scores and art come from, with the license where one is known."
									testid="section-sources"
								>
									<SourcesSection onNavigate={onClose} />
								</SettingsSection>
							)}
							{active === "usage" && (
								<SettingsSection
									title="Spending"
									hint="What the AI has cost so far, from the usage each session records."
									testid="section-usage"
								>
									<UsageSection />
								</SettingsSection>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
