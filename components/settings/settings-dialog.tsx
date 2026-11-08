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
	Fragment,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
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
import { LessonSoundsRow, PlaybackSpeedRow, VolumeRow, WordLookupModeRow } from "./device-prefs.tsx";
import { UpdateSettings } from "./update-settings.tsx";
import { AiSection, QuizStyleRow } from "./ai-section.tsx";
import type { ModelsSettings } from "@/src/core";
import { MENU_CLOSE_EVENT, MENU_OPEN_EVENT } from "@/components/menu-shell";
import { notifySettingsSaved } from "@/components/settings-signal";
import { KeysSection } from "./keys-section.tsx";
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
import { ChatGPTUIProvider } from "./chatgpt-connection.tsx";
import { NativeSubscriptionUIProvider } from "./subscription-connections.tsx";
import { sharedJson } from "@/lib/shared-fetch";

/** The nav label is the section's heading. Ids are internal: deep links and tests use them.
 *  Everyday settings come first; the AI setup and the app's data sit below a divider. */
const SECTIONS = [
	{ id: "general", label: "General" },
	{ id: "learner", label: "Learning" },
	{ id: "sound", label: "Sound" },
	{ id: "appearance", label: "Appearance" },
	{ id: "keyboard", label: "Keyboard" },
	{ id: "graph", label: "Skill map" },
	{ id: "devices", label: "Devices" },
	{ id: "ai", label: "AI models", divider: true },
	{ id: "keys", label: "API keys" },
	{ id: "usage", label: "Spending" },
	{ id: "data", label: "Data" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
	keys: KeyRoundIcon,
	ai: BotIcon,
	learner: GraduationCapIcon,
	appearance: PaletteIcon,
	graph: NetworkIcon,
	keyboard: KeyboardIcon,
	devices: SmartphoneIcon,
	usage: CoinsIcon,
	general: SlidersHorizontalIcon,
	sound: Volume2Icon,
	data: DatabaseIcon,
};

export function SettingsDialogOpen({
	onClose,
	initialSection,
	initialRow,
}: {
	onClose: () => void;
	initialSection: SectionId;
	initialRow: string | null;
}) {
	return (
		<ChatGPTUIProvider>
			<NativeSubscriptionUIProvider>
				<SettingsDialog onClose={onClose} initialSection={initialSection} initialRow={initialRow} />
			</NativeSubscriptionUIProvider>
		</ChatGPTUIProvider>
	);
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
	initialSection = "general",
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
		sharedJson<{ settings: UserSettings | null }>("/api/settings")
			.then((body) =>
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
				setError(`Couldn't save this setting: ${detail.error ?? `error ${res.status}`}`);
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
			className="flex h-[640px] max-h-[85vh] w-[940px] max-w-[92vw] flex-col overflow-hidden rounded-xl bg-card shadow-raise-hi animate-in zoom-in-95 duration-150"
			onClick={(e) => e.stopPropagation()}
		>
			<header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-lg bg-teal-wash text-teal">
						<SlidersIcon className="size-5" />
					</div>
					<div>
						<h2 className="font-ui text-base font-semibold tracking-[-0.01em] text-foreground">Settings</h2>
						<p className="text-xs text-muted-foreground">How LangHarness teaches, sounds and looks</p>
					</div>
				</div>
				<button
					type="button"
					aria-label="Close settings"
					data-testid="settings-close"
					className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-well hover:text-ink-2"
					onClick={onClose}
				>
					<XIcon className="size-4" />
				</button>
			</header>

			<div className="flex min-h-0 flex-1">
				<nav
					aria-label="Settings sections"
					data-testid="settings-nav"
					className="flex w-48 shrink-0 flex-col gap-1 bg-side p-3 shadow-[inset_-1px_0_0_var(--q-line)]"
				>
					{SECTIONS.map((s) => {
						const Icon = SECTION_ICONS[s.id];
						return (
							<Fragment key={s.id}>
							{"divider" in s && <div role="separator" className="mx-3 my-2 h-px shrink-0 bg-border" />}
							<button
								type="button"
								data-testid={`settings-nav-${s.id}`}
								aria-current={active === s.id}
								className={cn(
									"flex items-center gap-2.5 rounded-lg px-3 py-2 text-left font-ui text-sm transition-colors",
									active === s.id
										? "bg-card font-semibold text-teal-2 shadow-raise"
										: "text-ink-2 hover:bg-well-2 hover:text-foreground",
								)}
								onClick={() => setActive(s.id)}
							>
								{Icon && (
									<Icon
										className={cn(
											"size-4 shrink-0 transition-colors",
											active === s.id ? "text-teal" : "text-ink-3",
										)}
									/>
								)}
								{s.label}
							</button>
							</Fragment>
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
									hint="App updates and word lookup."
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
									<SettingsGroup label="Dictionary & word lookup" testid="group-word-lookup">
										<WordLookupModeRow />
									</SettingsGroup>
									<SettingsGroup label="Credits" testid="group-credits">
										<p className="text-[13px] text-muted-foreground" data-testid="credits-sentences">
											Sentences from slovak.wiki: curated examples and Tatoeba (CC BY 2.0 FR).
										</p>
									</SettingsGroup>
								</SettingsSection>
							)}
							{active === "sound" && (
								<SettingsSection
									title="Sound"
									hint="Volume, speech speed and lesson sounds. Saved on this device."
									testid="section-sound"
								>
									<SettingsGroup label="Voice" testid="group-voice">
										<VolumeRow />
										<PlaybackSpeedRow />
									</SettingsGroup>
									<SettingsGroup label="Lessons" testid="group-sound">
										<LessonSoundsRow />
									</SettingsGroup>
								</SettingsSection>
							)}
							{active === "keys" && (
								<SettingsSection
									title="API keys"
									hint="The keys and subscriptions that let LangHarness use AI models and AI voices."
									testid="section-keys"
								>
									<KeysSection initialRow={initialRow ?? undefined} />
								</SettingsSection>
							)}
							{active === "ai" && (
								<SettingsSection
									title="AI models"
									hint="Which AI models LangHarness uses, what they may look up, and their instructions. Needs an API key."
									testid="section-ai"
								>
									<AiSection
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
									hint="Day or night, the reading font and text colors."
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
									hint="The map of what you have learned, built from your sessions."
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
							{active === "devices" && (
								<SettingsSection
									title="Devices"
									hint="Use LangHarness on a phone or iPad over your own Tailscale network. Off by default: until you turn it on, only this computer can open the app."
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
									<LearnerSection onClose={onClose}>
										<SettingsGroup label="Quizzes" testid="group-quizzes">
											<QuizStyleRow
												agent={record.agent}
												onSectionChange={(next: AgentSettings) => void write("agent", next)}
											/>
										</SettingsGroup>
									</LearnerSection>
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
