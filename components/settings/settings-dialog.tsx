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

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import {
	CURRENT_SETTINGS_VERSION,
	type AgentSettings,
	type AppearanceSettings,
	type CompactionSettings,
	type GraphSettings,
	type UserSettings,
} from "@/src/core";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppearance } from "./appearance.tsx";
import { SettingsGroup, SettingsSection } from "./controls.tsx";
import { LessonSoundsRow, WordLookupModeRow } from "./device-prefs.tsx";
import { UpdateSettings } from "./update-settings.tsx";
import { AgentSection } from "./agent-section.tsx";
import type { ModelsSettings } from "@/src/core";
import { MENU_CLOSE_EVENT, MENU_OPEN_EVENT } from "@/components/menu-shell";
import { notifySettingsSaved } from "@/components/settings-signal";
import { KeysSection } from "./keys-section.tsx";
import { Hint } from "@/components/ui/hint";
import { AppearanceSection, GraphSection } from "./appearance-section.tsx";
import {
	BotIcon,
	CoinsIcon,
	DatabaseIcon,
	GraduationCapIcon,
	KeyboardIcon,
	KeyRoundIcon,
	NetworkIcon,
	PaletteIcon,
	SlidersHorizontalIcon,
	SlidersIcon,
	XIcon,
} from "lucide-react";
import { KeyboardSection } from "./keyboard-section.tsx";
import { UsageSection } from "./usage-section.tsx";
import { LearnerSection } from "./learner-section.tsx";
import { ResetSection } from "./reset-section.tsx";
import { StorageSection } from "./storage-section.tsx";
import { ChatGPTUIProvider } from "./chatgpt-connection.tsx";
import { NativeSubscriptionUIProvider } from "./subscription-connections.tsx";

/** The nav label is the section's heading. Ids are internal: deep links and tests use them. */
const SECTIONS = [
	{ id: "keys", label: "Keys" },
	{ id: "agent", label: "Tutor" },
	{ id: "learner", label: "Learning" },
	{ id: "appearance", label: "Appearance" },
	{ id: "graph", label: "Skill map" },
	{ id: "keyboard", label: "Keyboard" },
	{ id: "usage", label: "Spending" },
	{ id: "general", label: "General" },
	{ id: "data", label: "Data" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
	keys: KeyRoundIcon,
	agent: BotIcon,
	learner: GraduationCapIcon,
	appearance: PaletteIcon,
	graph: NetworkIcon,
	keyboard: KeyboardIcon,
	usage: CoinsIcon,
	general: SlidersHorizontalIcon,
	data: DatabaseIcon,
};

/** `open(section?, row?)`. `row` is the key id (the env-var name) to unfold in Keys. */
const DialogContext = createContext<{ open: (section?: string, row?: string) => void }>({ open: () => {} });

/** AppShell-level mount: the sidebar row and the mod+, chord call this.
 *  `open(section)` lands the dialog on a specific section (the first-run
 *  setup flow deep-links to Keys when no provider key exists yet). */
export function SettingsDialogProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [show, setShow] = useState(false);
	const [landOn, setLandOn] = useState<SectionId>("keys");
	const [landOnRow, setLandOnRow] = useState<string | null>(null);
	const open = useCallback((section?: string, row?: string) => {
		setLandOn(section ? section as SectionId : "keys");
		setLandOnRow(row ?? null);
		setShow(true);
	}, []);
	useEffect(() => window.lh?.onOpenSettings?.((section) => open(section)), [open]);
	return (
		<ChatGPTUIProvider><NativeSubscriptionUIProvider><DialogContext.Provider value={{ open }}>
			{children}
			{show && (
				<SettingsDialog onClose={() => setShow(false)} initialSection={landOn} initialRow={landOnRow} />
			)}
		</DialogContext.Provider></NativeSubscriptionUIProvider></ChatGPTUIProvider>
	);
}

export function useSettingsDialog() {
	return useContext(DialogContext);
}

function SettingsDialog({
	onClose,
	initialSection,
	initialRow,
}: {
	onClose: () => void;
	initialSection: SectionId;
	/** Keys row to unfold on open. */
	initialRow: string | null;
}) {
	return (
		<Dialog open={true} onClose={onClose}>
			<DialogPortal>
				<DialogOverlay data-testid="settings-backdrop">
					<SettingsDialogBody onClose={onClose} initialSection={initialSection} initialRow={initialRow} />
				</DialogOverlay>
			</DialogPortal>
		</Dialog>
	);
}

/** The dialog without the portal/backdrop — the SSR-testable frame
 *  (portals render nothing under renderToStaticMarkup). */
export function SettingsDialogBody({
	onClose,
	initialSection = "keys",
	initialRow = null,
}: {
	onClose: () => void;
	initialSection?: SectionId;
	/** Keys row to unfold on arrival (null = none). */
	initialRow?: string | null;
}) {
	const { onAppearanceChange } = useAppearance();
	const [record, setRecord] = useState<UserSettings | null | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | null>(null);
	// MenuShell open-count — drives the content column's scroll lock.
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
	const [active, setActive] = useState<SectionId>(initialSection);
	// A deep link while the dialog is already open changes initialSection; follow it.
	useEffect(() => {
		setActive(initialSection);
	}, [initialSection]);

	// Fetch once per mount. 200 with {settings: null} is first boot, not an error.
	useEffect(() => {
		fetch("/api/settings")
			.then((r) =>
				r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)),
			)
			.then((body: { settings: UserSettings | null }) =>
				setRecord(body.settings ?? { version: CURRENT_SETTINGS_VERSION }),
			)
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
		async (
			section: "general" | "agent" | "models" | "appearance" | "graph" | "compaction",
			body: object,
		) => {
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
				setError(`${section}: ${detail.error ?? res.status}`);
				return;
			}
			// Store the server's answer, not the request body: the models section clamps thinking levels on write.
			const stored = (
				(await res.json().catch(() => null)) as { settings?: UserSettings } | null
			)?.settings;
			setRecord(
				(prev) =>
					stored ?? ({ ...(prev ?? {}), [section]: body }) as UserSettings,
			);
			notifySettingsSaved(section);
			if (section === "appearance")
				onAppearanceChange(body as AppearanceSettings);
		},
		[onAppearanceChange],
	);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Settings"
			data-testid="settings-dialog"
			className="flex h-[640px] max-h-[85vh] w-[940px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-150"
			onClick={(e) => e.stopPropagation()}
		>
			<header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-6">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
						<SlidersIcon className="size-5" />
					</div>
					<div>
						<h2 className="font-ui text-base font-bold tracking-tight text-foreground">Settings</h2>
						<p className="text-xs text-muted-foreground">Manage your workspace preferences, models, and tools</p>
					</div>
				</div>
				<button
					type="button"
					aria-label="Close settings"
					data-testid="settings-close"
					className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onClick={onClose}
				>
					<XIcon className="size-4" />
				</button>
			</header>

			<div className="flex min-h-0 flex-1">
				<nav
					aria-label="Settings sections"
					data-testid="settings-nav"
					className="flex w-48 shrink-0 flex-col gap-1 border-r border-border/60 bg-muted/10 p-3"
				>
					{SECTIONS.map((s) => {
						const Icon = SECTION_ICONS[s.id];
						return (
							<button
								key={s.id}
								type="button"
								data-testid={`settings-nav-${s.id}`}
								aria-current={active === s.id}
								className={cn(
									"flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-ui text-sm transition-all",
									active === s.id
										? "border border-border/60 bg-accent/80 font-medium text-foreground shadow-2xs"
										: "border border-transparent text-muted-foreground hover:bg-accent/30 hover:text-foreground",
								)}
								onClick={() => setActive(s.id)}
							>
								{Icon && (
									<Icon
										className={cn(
											"size-4 shrink-0 transition-colors",
											active === s.id ? "text-foreground" : "text-muted-foreground",
										)}
									/>
								)}
								{s.label}
							</button>
						);
					})}
				</nav>

				{/* Content column: one section at a time. Scroll locks while a MenuShell is open. */}
				<div
					ref={contentRef}
					className="min-w-0 flex-1 overflow-y-auto"
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
						<p className="px-6 py-5 text-xs text-muted-foreground">
							Loading settings…
						</p>
					) : record === null ? (
						<p className="px-6 py-5 text-xs text-muted-foreground">
							Settings could not be loaded — refresh to retry.
						</p>
					) : (
						<div>
							{active === "general" && (
								<SettingsSection
									title="General"
									hint="App updates, sound effects, and translation preferences."
									testid="section-general"
								>
									<SettingsGroup label="Updates" testid="group-updates">
										<UpdateSettings
											autoUpdate={record.general?.autoUpdate ?? true}
											onAutoUpdateChange={(on) =>
												void write("general", { ...record.general, autoUpdate: on })
											}
										/>
									</SettingsGroup>
									<SettingsGroup label="Sound" testid="group-sound">
										<LessonSoundsRow />
									</SettingsGroup>
									<SettingsGroup label="Dictionary & word lookup" testid="group-word-lookup">
										<WordLookupModeRow />
									</SettingsGroup>
								</SettingsSection>
							)}
							{active === "keys" && (
								<SettingsSection
									title="Keys"
									hint="Manage API keys and external model subscriptions."
									testid="section-keys"
								>
									<KeysSection initialRow={initialRow ?? undefined} />
								</SettingsSection>
							)}
							{active === "agent" && (
								<SettingsSection
									title="Tutor"
									hint="Model routing, specialized tools, and system prompt customization."
									testid="section-agent"
								>
									<AgentSection
										agent={record.agent}
										models={record.models}
										graph={record.graph}
										compaction={record.compaction}
										onModelsChange={(next: ModelsSettings) =>
											void write("models", next)
										}
										onSectionChange={(next: AgentSettings) =>
											void write("agent", next)
										}
										onCompactionChange={(next: CompactionSettings) =>
											void write("compaction", next)
										}
									/>
								</SettingsSection>
							)}
							{active === "appearance" && (
								<SettingsSection
									title="Appearance"
									hint="Theme, typography, and reading interface customization."
									testid="section-appearance"
								>
									<AppearanceSection
										appearance={record.appearance}
										onSectionChange={(next: AppearanceSettings) =>
											void write("appearance", next)
										}
									/>
								</SettingsSection>
							)}
							{active === "graph" && (
								<SettingsSection
									title="Skill map"
									hint="Knowledge graph extraction and concept exploration settings."
									testid="section-graph"
								>
									<GraphSection
										graph={record.graph}
										onSectionChange={(next: GraphSettings) =>
											void write("graph", next)
										}
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
							{active === "learner" && (
								<SettingsSection
									title="Learning"
									hint="The languages you know, and how the tutor explains things to you."
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
							{active === "usage" && (
								<SettingsSection
									title="Spending"
									hint="What the tutor has cost so far, from the usage each session records"
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
