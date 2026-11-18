import type { VariantGroup } from "@/components/variant-picker";

type Option = { id: string; label: string };

export const MOTION: Option[] = [
	{ id: "ink", label: "Ink · strokes draw, voices breathe" },
	{ id: "lively", label: "Lively · bigger moves, everything arrives" },
	{ id: "still", label: "Still · no motion" },
];

export const LAYOUTS = {
	tutor: [
		{ id: "stage", label: "Stage · one scene big, postcards below" },
		{ id: "filmstrip", label: "Filmstrip · swipe scene to scene" },
		{ id: "ledger", label: "Ledger · list and sheet (today)" },
	],
	solo: [
		{ id: "deck", label: "Deck · one card, shuffle" },
		{ id: "board", label: "Board · every topic pinned up" },
		{ id: "ledger", label: "Ledger · list and sheet (today)" },
	],
	islands: [
		{ id: "chart", label: "Chart · a sea map of your islands" },
		{ id: "ladder", label: "Ladder · islands by step" },
		{ id: "ledger", label: "Ledger · lists (today)" },
	],
	live: [
		{ id: "contacts", label: "Contacts · who will you call?" },
		{ id: "dial", label: "Dial · one call, ready to ring" },
		{ id: "ledger", label: "Ledger · lists (today)" },
	],
} satisfies Record<string, Option[]>;

export type SpeakPage = keyof typeof LAYOUTS;

export function chosen(options: Option[], value: string | undefined): string {
	return options.find((o) => o.id === value)?.id ?? options[0]!.id;
}

export function harnessGroups(page: SpeakPage, layout: string | undefined, motion: string | undefined): VariantGroup[] {
	return [
		{ label: "Layout", param: "__variant", value: chosen(LAYOUTS[page], layout), variants: LAYOUTS[page] },
		{ label: "Motion", param: "__motion", value: chosen(MOTION, motion), variants: MOTION },
	];
}
