"use client";
/**
 * The Appearance and Graph sections.
 *
 * Appearance writes PUT the whole section and hand the delta back, so the CSS
 * variables move at once. Hex inputs commit on blur or Enter. Mode (System, Day, Night)
 * is per device: it lives in the "lh-theme" cookie (lib/theme.ts), which the server reads into the first HTML, not in the settings record.
 *
 * The reading font lists installed families: the desktop shell asks the OS
 * (window.lh.fonts, electron/fonts-ipc.cjs; Electron's own queryLocalFonts
 * comes back empty), a browser that has window.queryLocalFonts uses that. With
 * neither, a curated list shows, with a footer saying so. Never a fabricated
 * system list.
 *
 * Graph rows dim when a parent is off; stored values persist but resolve inert.
 */

import { useEffect, useRef, useState } from "react";
import {
	resolveSettings,
	type AppearanceSettings,
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

/** Read lazily: SSR has no window. The desktop bridge comes first; its names are already families. */
function localFontsApi(): LocalFontsApi | null {
	if (typeof window === "undefined") return null;
	const desktop = window.lh?.fonts;
	if (desktop) return async () => (await desktop.list()).map((family) => ({ family }));
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
					ariaLabel="Reading font size"
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
					label="Session names in serif"
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
					ariaLabel="Background color"
					testid="input-background"
					onCommit={(v) => onSectionChange({ ...appearance, background: v === "" ? null : v })}
				/>
			</SettingsRow>
			<SettingsRow label="Heading weight" hint={`${resolved.mdRendering.headingWeight}`} testid="row-heading-weight">
				<CommitInput
					type="number"
					value={String(md?.headingWeight ?? "")}
					placeholder="900"
					ariaLabel="Heading weight"
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
					ariaLabel="Bold color"
					testid="input-bold-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, boldColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
			<SettingsRow label="Italic color" hint="Empty = same as text" testid="row-italic-color">
				<CommitInput
					value={md?.italicColor ?? ""}
					placeholder="same as text"
					ariaLabel="Italic color"
					testid="input-italic-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, italicColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
			</SettingsDisclosure>
		</>
	);
}
