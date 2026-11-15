"use client";
/**
 * The Tutor section, in three groups.
 *
 * Models: three slots. Strong = Prober + Teacher, Cheap = the five workhorse
 * roles, Vision = Visual maker + PDF reader (image-capable models only). Slots
 * write the `models` section, which is engine-level, not per chat. The dropdowns
 * read the federated catalog from /api/models, so a stored id stays visible even
 * if its provider key lapsed. The Default row clears the override.
 *
 * Tools: research, pdf. An absent key counts as enabled; the UI
 * writes explicit booleans for all four. The search engine (Tavily or Brave) is
 * live only with its key, so the row grays without one.
 *
 * System prompts: Teacher, Prober, then Shared. A prompt switch needs an override
 * file, so a file-less toggle is disabled.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, KeyRoundIcon } from "lucide-react";
import { MenuShell } from "@/components/menu-shell";
import { cn } from "@/lib/utils";
import { useSettingsSaved } from "@/components/settings-signal";
import { defaultOrderLevel, populateLevel, thinkingLabel } from "@/components/thinking-default";
import {
	COMPACTION_THRESHOLD_FLOOR,
	MODEL_SLOTS,
	TRANSCRIPTION_ENGINES,
	resolveSettings,
	type AgentSettings,
	type CompactionSettings,
	type ModelCatalogEntry,
	type ModelSlotName,
	type ModelsSettings,
	type TranscriptionEngineId,
} from "@/src/core";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { modelName } from "@/components/model-names";
import { CommitInput, SettingsDisclosure, SettingsGroup, SettingsRow, SettingsSegmented, Toggle } from "./controls.tsx";
import { MenuOption, ModelMenuList, ThinkingMenuList } from "./model-menu";
import { ChatGPTBackgroundAccess } from "./chatgpt-connection";
import { NativeSubscriptionBackgroundAccess } from "./subscription-connections";

/** Display identity per slot. The roster is the row hint. */
const SLOT_META: Record<ModelSlotName, { label: string; roster: string }> = {
	strong: { label: "Strong", roster: "The main model for your sessions: Learn a topic" },
	cheap: { label: "Cheap", roster: "Speak, Read, Why? and practice, plus grading" },
	vision: { label: "Vision", roster: "The assistant that reads long or scanned PDFs" },
};

/** Search engines, as in src/core/search.ts. */
const SEARCH_ENGINES = ["context", "tavily", "brave"] as const;

const SEARCH_ENGINE_LABELS: Record<(typeof SEARCH_ENGINES)[number], string> = {
	context: "Context",
	tavily: "Tavily",
	brave: "Brave",
};

const TRANSCRIPTION_ENGINE_LABELS: Record<TranscriptionEngineId, string> = {
	whisper: "Whisper (large-v3-turbo)",
	elevenlabs: "ElevenLabs Scribe v2",
};

/** Toggleable tools. Changing this list needs the user's sign-off. */
const TOGGLE_TOOLS = ["research", "pdf"] as const;

/** Learner-facing copy. The ids stay the engine's names. */
const TOOL_COPY: Record<(typeof TOGGLE_TOOLS)[number], { label: string; hint: string }> = {
	research: { label: "Web research", hint: "Looks up facts and current data online. Needs a search key in Settings → API keys." },
	pdf: { label: "Read PDFs", hint: "Reads the PDFs you add with the PDF button and cites their pages." },
};

/** The quiz style's two options (the engine's `explain` switch). */
const QUIZ_OPTIONS: readonly { value: "choice" | "free"; label: string }[] = [
	{ value: "choice", label: "Multiple choice" },
	{ value: "free", label: "Free recall" },
];

const THINKING_LEVELS: readonly ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

/** SegmentInfo as GET /api/settings/prompts returns it. */
interface SegmentInfo {
	path: string;
	sourceText: string;
	overrideText: string | null;
	enabled: boolean;
	shared: boolean;
}

/** The GET /api/models response fields this section consumes. */
interface ModelsBody {
	models: ModelCatalogEntry[];
	/** Resolved pin per tier, null when unset. Used only as the thinking-list fallback. */
	slots: Record<ModelSlotName, { model: { provider: string; id: string }; thinkingLevel?: string } | null>;
}

/** One tool toggled; the rest of the section is carried verbatim. */
function composeTool(agent: AgentSettings | undefined, id: string, on: boolean): AgentSettings {
	return { ...agent, tools: { ...agent?.tools, [id]: on } };
}

/** Exactly one mechanic is active: `explain: true` is free recall, anything else multiple choice. `quiz` is never written here (see quizMechanics in agent/tools.ts). */
/** Lives under Learning: it is how the learner is quizzed, stored with the tutor's tools. */
export function QuizStyleRow({ agent, onSectionChange }: { agent: AgentSettings | undefined; onSectionChange: (next: AgentSettings) => void }) {
	return (
		<SettingsRow
			label="Quiz style"
			hint="How the tutor checks what you know. Multiple choice: pick an answer. Free recall: type it, with no options."
			testid="quiz-mechanics-row"
		>
			<SettingsSegmented
				options={QUIZ_OPTIONS}
				value={agent?.tools?.explain === true ? "free" : "choice"}
				onChange={(m) => onSectionChange(composeQuizMechanics(agent, m))}
				ariaLabel="Quiz style"
				testid="quiz-mechanics"
			/>
		</SettingsRow>
	);
}

function composeQuizMechanics(agent: AgentSettings | undefined, mechanics: "choice" | "free"): AgentSettings {
	return { ...agent, tools: { ...agent?.tools, explain: mechanics === "free" } };
}

/** One slot's override. Empty model = Default (factory pin); empty thinking keeps the resolved level. */
export function composeSlotModel(
	models: ModelsSettings | undefined,
	slot: ModelSlotName,
	provider: string,
	id: string,
	thinking: string,
): ModelsSettings {
	const prev = models?.[slot];
	const next = { ...models };
	if (!provider && !id && !thinking) {
		delete next[slot];
		return next;
	}
	next[slot] = {
		...(provider && id ? { model: { provider, id } } : prev?.model ? { model: prev.model } : {}),
		...(thinking ? { thinkingLevel: thinking as ThinkingLevel } : {}),
	};
	return next;
}

/** null removes the pin, so auto-activation takes over. */
function composeSearchEngine(
	agent: AgentSettings | undefined,
	engine: (typeof SEARCH_ENGINES)[number] | null,
): AgentSettings {
	if (engine === null) {
		if (!agent?.search) return { ...agent };
		const { search: _drop, ...rest } = agent;
		return { ...rest } as AgentSettings;
	}
	return { ...agent, search: { engine } };
}

function composeTranscriptionEngine(
	agent: AgentSettings | undefined,
	engine: TranscriptionEngineId | null,
): AgentSettings {
	if (engine === null) {
		if (!agent?.transcription) return { ...agent };
		const { transcription: _drop, ...rest } = agent;
		return { ...rest } as AgentSettings;
	}
	return { ...agent, transcription: { engine } };
}

/** Hint under a prompt row whose override is in use. Shown only while the switch is on. */
const PROMPT_IN_USE_HINT = "Your version is in use";

/** One prompt section: Teacher, Prober, then Shared. */
interface PromptSection {
	id: "teacher" | "prober" | "shared";
	label: string;
	/** Says what the section's instructions do. Agent names are internal. */
	hint?: string;
	segments: SegmentInfo[];
}

/** Splits the per-agent lists into three sections. Shared segments arrive in both lists, so they are taken once, from the teacher list. */
function sectionedSegments(view: { prober: SegmentInfo[]; teacher: SegmentInfo[] }): PromptSection[] {
	const own = (who: "prober" | "teacher") => view[who].filter((s) => !s.shared);
	return [
		{ id: "teacher", label: "Teaching", hint: "How the tutor explains and guides a lesson", segments: own("teacher") },
		{ id: "prober", label: "Checking", hint: "How the tutor checks what you know", segments: own("prober") },
		{
			id: "shared",
			label: "Shared",
			hint: "Used by both",
			segments: view.teacher.filter((s) => s.shared),
		},
	];
}

/** Off removes the key: absent is the schema's off state. */
function composePromptSwitch(agent: AgentSettings | undefined, path: string, on: boolean): AgentSettings {
	const prompts = { ...agent?.prompts };
	if (on) prompts[path] = true;
	else delete prompts[path];
	return { ...agent, prompts };
}

/** The collapsed select look. Opens the shared dropdown. */
function MenuTrigger({
	value,
	emptyLabel,
	ariaLabel,
	testid,
	open,
	onClick,
	widthClass,
	disabled,
}: {
	value: string;
	/** Shown when there is no override. */
	emptyLabel: string;
	ariaLabel: string;
	testid: string;
	open: boolean;
	onClick: () => void;
	/** Fixed width for the thinking trigger; a minimum width for the model trigger, whose values vary. */
	widthClass: string;
	/** Set when the search row has no key. */
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			aria-expanded={open}
			data-testid={testid}
			onClick={() => {
				if (!disabled) onClick();
			}}
			className={`flex h-8.5 items-center justify-between gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 font-ui text-xs text-foreground transition-colors ${
				disabled ? "cursor-not-allowed opacity-50" : "hover:border-border hover:bg-background focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
			} ${widthClass}`}
		>
			<span className="min-w-0 flex-1 truncate text-left">{value || emptyLabel}</span>
			<ChevronDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
		</button>
	);
}

// The dropdowns mount the shared MenuShell, anchored to the open trigger by testid.
// data-lh-menu marks them as exempt from the outside-click handler.

export function AiSection({
	agent,
	models,
	compaction,
	onSectionChange,
	onModelsChange,
	onCompactionChange,
}: {
	agent: AgentSettings | undefined;
	/** Slot pins. Engine-level, written to /api/settings/models. */
	models: ModelsSettings | undefined;
	/** Its own PUT, since the threshold is engine behavior rather than an agent key. */
	compaction: CompactionSettings | undefined;
	onSectionChange: (next: AgentSettings) => void;
	onModelsChange: (next: ModelsSettings) => void;
	onCompactionChange: (next: CompactionSettings) => void;
}) {
	const [catalog, setCatalog] = useState<ModelCatalogEntry[] | null>(null);
	const [slots, setSlots] = useState<ModelsBody["slots"] | null>(null);
	/** Live search state; feeds the row's reason line. */
	const [search, setSearch] = useState<{ available: boolean; engine: string | null; reason: string } | null>(null);
	/** Which search engines have a key. With none, the row grays. */
	const [engineKeys, setEngineKeys] = useState<Partial<Record<(typeof SEARCH_ENGINES)[number] | "elevenlabs", boolean>>>({});
	const [prompts, setPrompts] = useState<{ prober: SegmentInfo[]; teacher: SegmentInfo[] } | null>(null);
	const [openSegment, setOpenSegment] = useState<string | null>(null);
	const [segmentDraft, setSegmentDraft] = useState<Record<string, string>>({});
	const [segmentStatus, setSegmentStatus] = useState<string | null>(null);
	const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
	/** One open dropdown per section: the slot or search row, and the kind. */
	const [openMenu, setOpenMenu] = useState<{ target: ModelSlotName | "search" | "transcription"; kind: "model" | "thinking" | "engine" } | null>(null);
	const menuAnchorRef = useRef<HTMLSpanElement>(null);

	const refreshSearch = () =>
		fetch("/api/search")
			.then((r) => r.json())
			.then((body: { available: boolean; engine: string | null; reason: string }) => setSearch(body))
			.catch(() => setSearch(null));

	/** Re-read the prompt view. Its enabled flags derive from the agent switches, so an agent write must trigger a re-read. */
	const readPrompts = useCallback(() => {
		fetch("/api/settings/prompts")
			.then((r) => r.json())
			.then((body: { prober: SegmentInfo[]; teacher: SegmentInfo[] }) => setPrompts(body))
			.catch(() => {});
	}, []);

	// One fetch each per mount. The models read also re-runs on the settings-saved signal.
	const modelsRequest = useRef(0);
	const modelsMounted = useRef(false);
	const readModels = useCallback((connectionChanged = false) => {
		const request = ++modelsRequest.current;
		if (connectionChanged) setCatalog(null);
		fetch("/api/models")
			.then((r) => { if (!r.ok) throw new Error("Catalog unavailable"); return r.json(); })
			.then((body: ModelsBody) => {
				if (!modelsMounted.current || request !== modelsRequest.current) return;
				setCatalog(body.models);
				setSlots(body.slots);
			})
			.catch(() => { if (modelsMounted.current && request === modelsRequest.current) setCatalog(null); });
	}, []);

	useSettingsSaved((section) => {
		if (section === "models" || section === "keys") readModels(section === "keys");
		// Prompt switches write through the agent section, so the prompt view must re-read here too.
		if (section === "agent") readPrompts();
	});

	useEffect(() => {
		modelsMounted.current = true;
		readModels();
		fetch("/api/settings/prompts")
			.then((r) => r.json())
			.then((body: { prober: SegmentInfo[]; teacher: SegmentInfo[] }) => setPrompts(body))
			.catch(() => setPrompts(null));
		fetch("/api/keys")
			.then((r) => r.json())
			.then((body: { keys: { id: string; present: boolean }[] }) => {
				const present: Partial<Record<(typeof SEARCH_ENGINES)[number] | "elevenlabs", boolean>> = {};
				for (const id of SEARCH_ENGINES) {
					const envVar = id === "context" ? "CONTEXT_API_KEY" : id === "tavily" ? "TAVILY_API_KEY" : "BRAVE_API_KEY";
					present[id] = body.keys.some((k) => k.id === envVar && k.present);
				}
				present.elevenlabs = body.keys.some((k) => k.id === "ELEVENLABS_API_KEY" && k.present);
				setEngineKeys(present);
			})
			.catch(() => {});
		return () => { modelsMounted.current = false; modelsRequest.current++; };
	}, []);

	// Re-read after an engine write lands, so the reason never contradicts the trigger.
	useEffect(() => {
		refreshSearch();
	}, [agent?.search?.engine]);

	// Any click outside the open menu, or Esc, closes it. Esc stops propagation so the dialog stays open.
	useEffect(() => {
		if (openMenu === null) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (menuAnchorRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (target instanceof Element && target.closest('[role="dialog"]')) {
				setOpenMenu(null);
			}
			// else: outside the dialog — the dialog's own close handles it.
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setOpenMenu(null);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [openMenu]);

	async function saveSegment(path: string, text: string) {
		setSegmentStatus(null);
		const res = await fetch(`/api/settings/prompts/${path}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
		});
		if (!res.ok) {
			setSegmentStatus(`Couldn't save: ${(await res.json().catch(() => ({}))).error ?? res.status}`);
			return;
		}
		readPrompts();
		setSegmentStatus("Saved");
		// Saving also turns the switch on. The file exists first, which keeps the validation happy; the order matters.
		if (agent?.prompts?.[path] !== true) {
			onSectionChange(composePromptSwitch(agent, path, true));
		}
	}

	async function deleteSegment(path: string) {
		setSegmentStatus(null);
		const res = await fetch(`/api/settings/prompts/${path}`, { method: "DELETE" });
		if (!res.ok) {
			setSegmentStatus("Couldn't delete this version. Try again.");
			return;
		}
		// Deleting the file while the switch is on would leave an ON switch with no file, and validation rejects every later write.
		if (agent?.prompts?.[path] === true) {
			onSectionChange(composePromptSwitch(agent, path, false));
		}
		readPrompts();
		setSegmentStatus("Deleted");
	}

	/** Search-engine menu row: label, a has-key mark, and a check on the chosen engine. */
	const engineOption = (
		id: string,
		label: string,
		active: boolean,
		live: boolean | null,
		onPick: () => void,
	) => (
		<MenuOption
			key={id}
			data-testid={`engine-option-${id}`}
			aria-current={active ? "true" : undefined}
			onClick={onPick}
			className="flex w-full items-center justify-between text-card-foreground"
		>
			<span>{label}</span>
			<span className="flex items-center gap-2">
				{live !== null && (
					<span
						role="img"
						aria-label={live ? "Key saved" : "No key yet"}
						title={live ? "Key saved" : "No key yet. Add it in API keys."}
						className="flex"
					>
						<KeyRoundIcon aria-hidden className={cn("size-3.5", live ? "text-go" : "text-muted-foreground/50")} />
					</span>
				)}
				{active && <CheckIcon aria-hidden className="size-3.5 text-go" />}
			</span>
		</MenuOption>
	);

	const segmentRow = (info: SegmentInfo) => {
		const fileExists = info.overrideText !== null;
		const open = openSegment === info.path;
		// Save is clickable only when the draft differs from the file on disk.
		const draft = segmentDraft[info.path] ?? info.overrideText ?? "";
		const dirty = draft !== (info.overrideText ?? "");
		return (
			<div key={info.path} data-testid={`prompt-segment-${info.path}`}>
				<SettingsRow
					label={info.path}
					// Shows the in-use line only while the switch is on.
					hint={info.enabled ? PROMPT_IN_USE_HINT : undefined}
					testid={`prompt-row-${info.path}`}
				>
					{/* Only the toggle dims without an override file. The name stays full contrast. */}
					<span className={fileExists ? undefined : "opacity-40"}>
						<Toggle
							checked={info.enabled}
							disabled={!fileExists}
							label={`prompt ${info.path}`}
							onChange={(on) => onSectionChange(composePromptSwitch(agent, info.path, on))}
						/>
					</span>
				</SettingsRow>
				<button
					type="button"
					onClick={() => {
						setOpenSegment(open ? null : info.path);
						setSegmentStatus(null);
					}}
					className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				>
					{open ? "Hide text" : "Show text"}
				</button>
				{open && (
					<div className="mt-1 flex flex-col gap-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">Original</p>
							<textarea
								readOnly
								value={info.sourceText}
								aria-label="The original instructions"
								className="h-24 w-full resize-y rounded-sm border border-border bg-muted p-2 font-ui text-xs text-muted-foreground"
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">Your version</p>
							<textarea
								value={segmentDraft[info.path] ?? info.overrideText ?? ""}
								onChange={(e) => setSegmentDraft({ ...segmentDraft, [info.path]: e.target.value })}
								aria-label="Your version of the instructions"
								placeholder="Add your own instructions…"
								className="h-24 w-full resize-y rounded-sm border border-border bg-background p-2 font-ui text-xs text-foreground outline-none"
							/>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								disabled={!dirty}
								onClick={() => void saveSegment(info.path, segmentDraft[info.path] ?? "")}
								className={
									dirty
										? "text-xs text-foreground underline-offset-2 hover:underline"
										: "cursor-not-allowed text-xs text-ink-4 underline-offset-2"
								}
							>
								Save
							</button>
							{fileExists && confirmDeletePath !== info.path && (
								<button
									type="button"
									onClick={() => setConfirmDeletePath(info.path)}
									className="text-xs text-muted-foreground underline-offset-2 hover:text-miss hover:underline"
								>
									Delete
								</button>
							)}
							{fileExists && confirmDeletePath === info.path && (
								<span className="flex items-center gap-2 text-xs" data-testid="segment-delete-confirm">
									<span className="text-muted-foreground">Delete your version? The original instructions are used again.</span>
									<button
										type="button"
										onClick={() => {
											setConfirmDeletePath(null);
											void deleteSegment(info.path);
										}}
										className="text-miss underline-offset-2 hover:underline"
									>
										Delete
									</button>
									<button
										type="button"
										onClick={() => setConfirmDeletePath(null)}
										className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
									>
										Keep
									</button>
								</span>
							)}
							{/* Inline status beside the action. One editor is open at a time, so one status suffices. */}
							{segmentStatus && (
								<p className="text-xs text-muted-foreground" data-testid="segment-status">
									{segmentStatus}
								</p>
							)}
						</div>
					</div>
				)}
			</div>
		);
	};

	// Same core resolver as the server, so the hint reports the number the trigger uses.
	const resolvedCompaction = resolveSettings(
		compaction === undefined ? null : { version: 1, compaction },
	).compaction;
	// The hint's "Default" is the factory threshold; the stored one is the effective value.
	const factoryCompaction = resolveSettings(null).compaction.thresholdTokens;

	return (
		<>
			<SettingsGroup label="Models" testid="group-models">
				{MODEL_SLOTS.map((slot) => {
					const override = models?.[slot];
					const modelId = override?.model?.id ?? "";
					const provider = override?.model?.provider ?? "";
					const thinking = override?.thinkingLevel ?? "";
					// The UI never names the factory pin. It only sets the thinking list when no override names a model.
					const pin = slots?.[slot];
					// Thinking levels come from the override's model, else the pin's, else the standard ladder.
					const coord = override?.model ?? pin?.model;
					const chosen = coord ? catalog?.find((m) => m.id === coord.id && m.provider === coord.provider) : undefined;
					const levels = chosen ? chosen.supportedLevels : THINKING_LEVELS;
					const thisMenuOpen = openMenu?.target === slot ? openMenu.kind : null;
					// Vision slots pick from image-capable models only.
					const slotCatalog =
						slot === "vision" ? catalog?.filter((m) => m.input.includes("image")) : catalog;
					return (
						<SettingsRow
							key={slot}
							label={SLOT_META[slot].label}
							hint={SLOT_META[slot].roster}
							testid={`slot-row-${slot}`}
							stack={false}
						>
							{/* Outside-click anchor: the span holding both triggers. */}
							<span
								ref={thisMenuOpen ? menuAnchorRef : undefined}
								className="relative flex items-center gap-2"
							>
								{slot !== "strong" && <><ChatGPTBackgroundAccess provider={coord?.provider} /><NativeSubscriptionBackgroundAccess provider={coord?.provider} /></>}
								<MenuTrigger
									value={modelId ? modelName(catalog, provider, modelId) : ""}
									emptyLabel="—"
									ariaLabel={`${SLOT_META[slot].label} model`}
									testid={`slot-model-${slot}`}
									open={thisMenuOpen === "model"}
									onClick={() => setOpenMenu(thisMenuOpen === "model" ? null : { target: slot, kind: "model" })}
									widthClass="min-w-20 max-w-44"
								/>
								<MenuTrigger
									// Unset level on a known model shows the resolved one. Display only until a pick writes.
									value={thinkingLabel(thinking || (chosen ? defaultOrderLevel(levels) : ""))}
									emptyLabel="—"
									ariaLabel={`${SLOT_META[slot].label} thinking`}
									testid={`slot-thinking-${slot}`}
									open={thisMenuOpen === "thinking"}
									onClick={() => setOpenMenu(thisMenuOpen === "thinking" ? null : { target: slot, kind: "thinking" })}
									widthClass="w-28"
								/>
								{thisMenuOpen === "model" && (
									<MenuShell
										preferredSide="down"
											anchorTestid={`slot-model-${slot}`}
										testid={`slot-model-menu-${slot}`}
										menuClass="flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
									>
										<ModelMenuList
											models={slotCatalog ?? undefined}
											effectiveId={modelId}
											effectiveProvider={provider}
											onPick={(entry) => {
												// A pick writes a level: the stored one if set (the server clamps it), else the first in order.
												const next = populateLevel(thinking || undefined, entry.supportedLevels);
												onModelsChange(composeSlotModel(models, slot, entry.provider, entry.id, next));
												setOpenMenu(null);
											}}
											footer={
												catalog && catalog.length === 0
													? "No models — add a provider key in Settings → API keys"
													: "Used for everything listed in this row. Prices are per million tokens."
											}
										/>
									</MenuShell>
								)}
								{thisMenuOpen === "thinking" && (
									<MenuShell
										preferredSide="down"
											anchorTestid={`slot-thinking-${slot}`}
										testid={`slot-thinking-menu-${slot}`}
										menuClass="flex w-44 flex-col gap-0.5 rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
									>
										<ThinkingMenuList
											levels={levels.map(String)}
											// The check sits on the resolved level, matching the trigger.
											effectiveLevel={thinking || (chosen ? defaultOrderLevel(levels) : undefined)}
											onPick={(level) => {
												onModelsChange(composeSlotModel(models, slot, provider, modelId, level));
												setOpenMenu(null);
											}}
										/>
									</MenuShell>
								)}
							</span>
						</SettingsRow>
					);
				})}
			</SettingsGroup>

			<SettingsGroup label="Tools" testid="group-tools">
				{TOGGLE_TOOLS.map((id) => (
					<SettingsRow
						key={id}
						label={TOOL_COPY[id].label}
						hint={TOOL_COPY[id].hint}
						stack={false}
						testid={`tool-row-${id}`}
					>
						<Toggle
							checked={agent?.tools?.[id] ?? true}
							label={TOOL_COPY[id].label}
							testid={`toggle-tool-${id}`}
							onChange={(on) => onSectionChange(composeTool(agent, id, on))}
						/>
					</SettingsRow>
				))}
				{(() => {
					const engine = agent?.search?.engine ?? null;
					const anyKey = SEARCH_ENGINES.some((id) => engineKeys[id] === true);
					const open = openMenu?.target === "search";
					return (
						<SettingsRow
							label="Search engine"
							hint={search?.reason ?? undefined}
							testid="search-engine-row"
							dimmed={!anyKey}
						>
							<span ref={open ? menuAnchorRef : undefined} className="relative flex items-center gap-2">
								<MenuTrigger
									value={engine ? SEARCH_ENGINE_LABELS[engine] : ""}
									emptyLabel="Automatic"
									ariaLabel="Search engine"
									testid="search-engine-trigger"
									open={open}
									onClick={() => setOpenMenu(open ? null : { target: "search", kind: "engine" })}
									widthClass="min-w-20"
									disabled={!anyKey}
								/>
								{open && (
									<MenuShell
										preferredSide="down"
											anchorTestid="search-engine-trigger"
										testid="search-engine-menu"
										menuClass="flex w-44 flex-col gap-0.5 rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
									>
										{engineOption("auto", "Automatic", engine === null, null, () => {
											onSectionChange(composeSearchEngine(agent, null));
											setOpenMenu(null);
										})}
										{SEARCH_ENGINES.map((id) =>
											engineOption(id, SEARCH_ENGINE_LABELS[id], engine === id, engineKeys[id] ?? false, () => {
												onSectionChange(composeSearchEngine(agent, id));
												setOpenMenu(null);
											}),
										)}
									</MenuShell>
								)}
							</span>
						</SettingsRow>
					);
				})()}
				{(() => {
					const engine = agent?.transcription?.engine ?? null;
					const open = openMenu?.target === "transcription";
					return (
						<SettingsRow
							label="Transcription engine"
							hint="Transcribes Spotify tracks and captionless videos. Automatic prefers local Whisper (large-v3-turbo) and falls back to ElevenLabs Scribe v2."
							testid="transcription-engine-row"
						>
							<span ref={open ? menuAnchorRef : undefined} className="relative flex items-center gap-2">
								<MenuTrigger
									value={engine ? TRANSCRIPTION_ENGINE_LABELS[engine] : ""}
									emptyLabel="Automatic"
									ariaLabel="Transcription engine"
									testid="transcription-engine-trigger"
									open={open}
									onClick={() => setOpenMenu(open ? null : { target: "transcription", kind: "engine" })}
									widthClass="min-w-28"
								/>
								{open && (
									<MenuShell
										preferredSide="down"
										anchorTestid="transcription-engine-trigger"
										testid="transcription-engine-menu"
										menuClass="flex w-56 flex-col gap-0.5 rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
									>
										{engineOption("auto-transcription", "Automatic (Whisper → ElevenLabs)", engine === null, null, () => {
											onSectionChange(composeTranscriptionEngine(agent, null));
											setOpenMenu(null);
										})}
										{TRANSCRIPTION_ENGINES.map((id) =>
											engineOption(
												id,
												TRANSCRIPTION_ENGINE_LABELS[id],
												engine === id,
												id === "elevenlabs" ? (engineKeys.elevenlabs ?? false) : null,
												() => {
													onSectionChange(composeTranscriptionEngine(agent, id));
													setOpenMenu(null);
												},
											),
										)}
									</MenuShell>
								)}
							</span>
						</SettingsRow>
					);
				})()}
			</SettingsGroup>

			<SettingsDisclosure
				label="Advanced"
				hint="Long chats and the instructions the tutor follows. Most people never need to open this."
				testid="advanced-tutor"
			>
			<SettingsGroup label="Long chats" testid="group-context">
				<SettingsRow
					label="Summarize long chats after"
					hint={`Tokens of conversation before older messages are summarized. Default ${factoryCompaction.toLocaleString("en-GB")}.`}
					testid="compaction-row-threshold"
				>
					<CommitInput
						type="number"
						value={String(compaction?.thresholdTokens ?? "")}
						placeholder={String(resolvedCompaction.thresholdTokens)}
						ariaLabel="Summarize long chats after"
						testid="input-compaction-threshold"
						onCommit={(v) => {
							// Empty = factory default. Absence is the unset for numbers.
							if (v === "") {
								onCompactionChange({ ...compaction, thresholdTokens: undefined });
								return;
							}
							const n = Number(v);
							if (!Number.isFinite(n) || n <= 0) return; // bad input: no write
							// Mirror the server floor (each compaction keeps a ~20k-token tail). No ceiling.
							onCompactionChange({
								...compaction,
								thresholdTokens: Math.max(COMPACTION_THRESHOLD_FLOOR, Math.round(n)),
							});
						}}
					/>
				</SettingsRow>
			</SettingsGroup>

			<SettingsGroup label="System prompts" testid="group-prompts">
				{prompts === null ? (
					<p className="text-xs text-muted-foreground">Loading prompt segments…</p>
				) : (
					<div className="flex flex-col gap-4">
						{sectionedSegments(prompts).map((section) => (
							<div key={section.id} data-testid={`prompt-section-${section.id}`}>
								<p className="mb-1 text-xs text-muted-foreground">
									{section.label}
								</p>
								{section.hint && (
									<p className="mb-1 text-xs text-muted-foreground">{section.hint}</p>
								)}
								<div className="flex flex-col gap-2">
									{section.segments.map((info) => segmentRow(info))}
								</div>
							</div>
						))}
					</div>
				)}
			</SettingsGroup>
			</SettingsDisclosure>
		</>
	);
}
