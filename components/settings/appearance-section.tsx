"use client";
/**
 * The Appearance and Graph sections.
 *
 * Appearance writes PUT the whole section and hand the delta back, so the CSS
 * variables move at once. Hex inputs commit on blur or Enter. Mode (System, Day, Night)
 * is per device: it lives in the "lh-theme" cookie (lib/theme.ts), which the server reads into the first HTML, not in the settings record.
 *
 * The reading font lists installed families via window.queryLocalFonts in the
 * desktop shell. In a plain browser the API is absent: a curated list shows,
 * with a footer saying so. Never a fabricated system list.
 *
 * Graph rows dim when a parent is off; stored values persist but resolve inert.
 */

import { useEffect, useRef, useState } from "react";
import {
	EXTRACTION_CHUNK_TOKENS_FLOOR,
	resolveSettings,
	type AppearanceSettings,
	type GraphSettings,
} from "@/src/core";
import { MenuShell } from "@/components/menu-shell";
import { applyTheme, readThemeChoice, type ThemeChoice } from "@/lib/theme";
import { Hint } from "@/components/ui/hint";
import { useAppearance } from "./appearance.tsx";
import { FontMenuList } from "./model-menu";
import { CommitInput, SettingsDisclosure, SettingsRow, SettingsSegmented, Toggle } from "./controls.tsx";

export type { ThemeChoice };
const MODE_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "day", label: "Day" },
	{ value: "night", label: "Night" },
];

function applyThemeChoice(choice: ThemeChoice) {
	applyTheme(choice);
}

/** Factory reading family. Unset means this. */
export const DEFAULT_READING_FONT = "Geist";
/** Factory dark background. A set color must not read as the default. */
const FACTORY_BACKGROUND = "#0f1519";

/** Dev-browser fallback when queryLocalFonts is absent. Labeled as common families, never as the system list. */
export const CURATED_FALLBACK_FONTS: readonly string[] = [
	"Arial",
	"CMU Serif",
	"Courier New",
	"Georgia",
	"Helvetica",
	"Helvetica Neue",
	"Menlo",
	"Times New Roman",
	"Trebuchet MS",
	"Verdana",
];

/** window.queryLocalFonts' shape as this section consumes it (family is
 *  the only field used; the API returns one FontData per FACE — the
 *  caller dedupes). */
type LocalFontsApi = () => Promise<Array<{ family: string }>>;

/** Read lazily: SSR has no window. */
function localFontsApi(): LocalFontsApi | null {
	if (typeof window === "undefined") return null;
	return (window as unknown as { queryLocalFonts?: LocalFontsApi }).queryLocalFonts ?? null;
}

/** null or blank = the factory Geist; otherwise the trimmed family. */
export function composeFontFamily(
	appearance: AppearanceSettings | undefined,
	family: string | null,
): AppearanceSettings {
	const value = family?.trim() ?? "";
	return { ...appearance, fontFamily: value === "" ? null : value };
}

export function AppearanceSection({
	appearance,
	onSectionChange,
}: {
	/** The record's appearance delta (absent = factory). */
	appearance: AppearanceSettings | undefined;
	/** PUT the whole appearance section; the page re-applies on success. */
	onSectionChange: (next: AppearanceSettings) => void;
}) {
	const { appearance: resolved } = useAppearance();
	const md = appearance?.mdRendering;
	// Read after mount so the server render and first client render agree.
	const [mode, setMode] = useState<ThemeChoice>("system");
	useEffect(() => setMode(readThemeChoice()), []);

	// Font enumeration cache: undefined = not enumerated yet; null = unavailable (absent, rejected or empty), so the curated list shows; a list = deduped families.
	// enumEmpty records why it fell back, for the footer.
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [localFonts, setLocalFonts] = useState<string[] | null | undefined>(undefined);
	const [enumEmpty, setEnumEmpty] = useState(false);
	const menuAnchorRef = useRef<HTMLSpanElement>(null);

	// Enumeration runs inside the trigger click, since queryLocalFonts needs user activation.
	// It runs once and is cached; any unavailable result falls back to the curated list.
	const openFontMenu = () => {
		setFontMenuOpen((open) => {
			if (!open && localFonts === undefined) {
				const api = localFontsApi();
				if (api === null) {
					setLocalFonts(null);
					setEnumEmpty(false);
				} else {
					void api()
						.then((fonts) => {
							const families = [...new Set(fonts.map((f) => f.family))]
								.filter((f) => f !== DEFAULT_READING_FONT)
								.sort((a, b) => a.localeCompare(b));
							if (families.length === 0) {
								// Resolved but empty counts as unavailable (Electron 44 lists nothing even when granted).
								setLocalFonts(null);
								setEnumEmpty(true);
							} else {
								setLocalFonts(families);
							}
						})
						.catch(() => {
							setLocalFonts(null);
							setEnumEmpty(false);
						});
				}
			}
			return !open;
		});
	};

	const pickFont = (family: string | null) => {
		setFontMenuOpen(false);
		onSectionChange(composeFontFamily(appearance, family));
	};

	// Any click outside the open menu, or Esc, closes it. Esc stops propagation so the dialog stays open.
	useEffect(() => {
		if (!fontMenuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (menuAnchorRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (target instanceof Element && target.closest('[role="dialog"]')) {
				setFontMenuOpen(false);
			}
			// else: outside the dialog — the dialog's own close handles it.
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setFontMenuOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [fontMenuOpen]);

	return (
		<>
			<SettingsRow label="Mode" hint="System follows your device" testid="row-mode">
				<SettingsSegmented
					options={MODE_OPTIONS}
					value={mode}
					ariaLabel="Mode"
					testid="mode-value"
					onChange={(next) => {
						setMode(next);
						applyThemeChoice(next);
					}}
				/>
			</SettingsRow>
			<SettingsRow
				label="Reading font"
				hint={`Empty = ${DEFAULT_READING_FONT}`}
				testid="row-font"
			>
				<span ref={fontMenuOpen ? menuAnchorRef : undefined} className="relative flex items-center gap-2">
					{/* Trigger styled like ai-section's MenuTrigger (unexported there). The tooltip shows on the closed button only. */}
					{(() => {
						const triggerButton = (
							<button
								type="button"
								aria-label="Reading font"
								aria-expanded={fontMenuOpen}
								data-testid="font-trigger"
								onClick={openFontMenu}
								className="flex h-9 min-w-24 items-center justify-between gap-2 rounded-md bg-card px-2.5 font-ui text-sm text-foreground ring-1 ring-line-2 transition-shadow hover:bg-well focus-visible:ring-2 focus-visible:ring-teal"
							>
								<span className="min-w-0 flex-1 truncate text-left">{appearance?.fontFamily || DEFAULT_READING_FONT}</span>
								<span aria-hidden className="text-muted-foreground">
									▾
								</span>
							</button>
						);
						return fontMenuOpen ? (
							triggerButton
						) : (
							<Hint label="Choose from your installed fonts" side="left">
								{triggerButton}
							</Hint>
						);
					})()}
					{fontMenuOpen && (
						<MenuShell
							preferredSide="down"
							anchorTestid="font-trigger"
							testid="font-menu"
							menuClass="flex w-[18rem] flex-col gap-0.5 rounded-lg bg-card p-2 text-xs shadow-raise-hi"
						>
							<FontMenuList
								families={localFonts === undefined ? undefined : (localFonts ?? [...CURATED_FALLBACK_FONTS])}
								effectiveFamily={appearance?.fontFamily ?? null}
								onPick={pickFont}
								footer={
									localFonts === undefined
										? undefined
										: localFonts === null
											? enumEmpty
												? "Common families — installed fonts could not be read"
												: "Common families — your installed list needs the desktop app"
											: "Your installed fonts"
								}
							/>
						</MenuShell>
					)}
				</span>
			</SettingsRow>
			<SettingsRow label="Reading font size" hint={`${resolved.proseFontSize}px`} testid="row-prose-size">
				<CommitInput
					type="number"
					value={String(appearance?.proseFontSize ?? "")}
					placeholder="16"
					ariaLabel="prose font size"
					testid="input-prose-size"
					onCommit={(v) => {
						// Empty = factory default: omit the key. Absence is the unset for numbers; Number("") is 0.
						if (v === "") {
							onSectionChange({ ...appearance, proseFontSize: undefined });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return; // bad input: no write, factory stays
						onSectionChange({ ...appearance, proseFontSize: Math.min(24, Math.max(12, Math.round(n))) });
					}}
				/>
			</SettingsRow>
			<SettingsRow label="Session names in serif" testid="row-session-serif">
				<Toggle
					checked={appearance?.sessionNameSerif ?? true}
					label="session names serif"
					onChange={(on) => onSectionChange({ ...appearance, sessionNameSerif: on })}
				/>
			</SettingsRow>
			<SettingsDisclosure
				label="Advanced"
				hint="Colors and weights. Empty = the built-in look."
				testid="advanced-appearance"
			>
			<SettingsRow
				label="Background color"
				hint={`Empty = ${FACTORY_BACKGROUND}`}
				testid="row-background"
			>
				<CommitInput
					value={appearance?.background ?? ""}
					placeholder={FACTORY_BACKGROUND}
					ariaLabel="background hex"
					testid="input-background"
					onCommit={(v) => onSectionChange({ ...appearance, background: v === "" ? null : v })}
				/>
			</SettingsRow>
			<SettingsRow label="Heading weight" hint={`${resolved.mdRendering.headingWeight}`} testid="row-heading-weight">
				<CommitInput
					type="number"
					value={String(md?.headingWeight ?? "")}
					placeholder="900"
					ariaLabel="heading weight"
					testid="input-heading-weight"
					onCommit={(v) => {
						// Empty = factory default: absence is the unset representation (Number("") is 0).
						if (v === "") {
							onSectionChange({ ...appearance, mdRendering: { ...md, headingWeight: undefined } });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return;
						onSectionChange({
							...appearance,
							mdRendering: { ...md, headingWeight: Math.min(900, Math.max(100, Math.round(n))) },
						});
					}}
				/>
			</SettingsRow>
			{/* Emphasis inks default to the regular text color; the empty-state labels say so. */}
			<SettingsRow label="Bold color" hint="Empty = same as text" testid="row-bold-color">
				<CommitInput
					value={md?.boldColor ?? ""}
					placeholder="same as text"
					ariaLabel="bold color"
					testid="input-bold-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, boldColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
			<SettingsRow label="Italic color" hint="Empty = same as text" testid="row-italic-color">
				<CommitInput
					value={md?.italicColor ?? ""}
					placeholder="same as text"
					ariaLabel="italic color"
					testid="input-italic-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, italicColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
			</SettingsDisclosure>
		</>
	);
}

export function GraphSection({
	graph,
	onSectionChange,
}: {
	graph: GraphSettings | undefined;
	onSectionChange: (next: GraphSettings) => void;
}) {
	// The section holds the extraction master switch and the chunk budget. The budget sets the coverage ring
	// and gates the auto-extraction trigger (turn settle >= budget fires a run).
	//
	// Resolved through the same core resolver as the server, so the hint reports the number the trigger uses.
	const resolved = resolveSettings(graph === undefined ? null : { version: 1, graph }).graph;
	// The hint's "Default" is the factory budget; `resolved` is the stored one when set.
	const factoryChunk = resolveSettings(null).graph.extractionChunkTokens;
	return (
		<>
			{/* Extraction: the data channel (pipeline, auditor, prober's graph tools). Off means the map stops growing. */}
			<SettingsRow label="Keep building the map" hint="Off = the map stops growing" testid="graph-row-enabled">
				<Toggle
					checked={graph?.enabled ?? true}
					label="Keep building the map"
					testid="toggle-extraction-enabled"
					onChange={(on) =>
						// Spread the stored section so the sibling chunk budget survives.
						onSectionChange({ ...graph, enabled: on })
					}
				/>
			</SettingsRow>
			{/* Rendering is display only. Off shows the chains view on home; data work keeps running. */}
			<SettingsRow label="Show the map on home" hint="Off = home shows the chains view instead" testid="graph-row-rendering">
				<Toggle
					checked={graph?.rendering ?? true}
					label="Show the map on home"
					testid="toggle-graph-rendering-enabled"
					onChange={(on) => onSectionChange({ ...graph, rendering: on })}
				/>
			</SettingsRow>
			<SettingsDisclosure
				label="Advanced"
				hint="How much conversation each map update reads. Empty = the built-in size."
				testid="advanced-graph"
			>
			<SettingsRow
				label="Map update size"
				hint={`Tokens of conversation per update. Default ${factoryChunk.toLocaleString("en-GB")}.`}
				testid="graph-row-chunk-tokens"
			>
				<CommitInput
					type="number"
					value={String(graph?.extractionChunkTokens ?? "")}
					placeholder={String(resolved.extractionChunkTokens)}
					ariaLabel="extraction chunk budget"
					testid="input-chunk-tokens"
					onCommit={(v) => {
						// Empty = factory default. Absence is the unset for numbers; Number("") is 0.
						if (v === "") {
							onSectionChange({ ...graph, extractionChunkTokens: undefined });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n) || n <= 0) return; // bad input: no write
						// Mirror the server: floor only (cost protection), no ceiling.
						onSectionChange({
							...graph,
							extractionChunkTokens: Math.max(EXTRACTION_CHUNK_TOKENS_FLOOR, Math.round(n)),
						});
					}}
				/>
			</SettingsRow>
			</SettingsDisclosure>
		</>
	);
}