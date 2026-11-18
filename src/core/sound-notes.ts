import slovakNotesJson from "../../curriculum/slovak/sound-notes.json";
import russianNotesJson from "../../curriculum/russian/sound-notes.json";
import estonianNotesJson from "../../curriculum/estonian/sound-notes.json";

export const TONGUE_SHAPES = [
	"rest",
	"front-high",
	"front-mid",
	"front-low",
	"low",
	"back-low",
	"back-mid",
	"back-high",
	"middle-high",
	"tip-teeth",
	"tip-ridge",
	"tip-ridge-trill",
	"body-roof",
	"back-roof",
	"back-near-roof",
	"tip-teeth-middle-up",
	"tip-ridge-middle-up",
	"tip-teeth-back-up",
	"tip-back",
	"blade-roof",
] as const;
export type TongueShape = (typeof TONGUE_SHAPES)[number];

export const LIP_SHAPES = ["neutral", "spread", "round", "lip-to-teeth"] as const;
export type LipShape = (typeof LIP_SHAPES)[number];

export const MOUTH_MARKS = ["tongue", "lips", "throat"] as const;
export type MouthMark = (typeof MOUTH_MARKS)[number];

export interface MouthSpec {
	tongue: TongueShape;
	lips: LipShape;
	mark?: MouthMark;
}

export type SoundPicture = { kind: "mouth"; mouth: MouthSpec; says?: string } | { kind: "length"; units: 1 | 2 | 3 };

export interface SoundNeighbor {
	symbol: string;
	word: string;
	meaning: string;
	picture: SoundPicture;
}

export interface SoundNote {
	symbol: string;
	ipa: string;
	group: string;
	word: string;
	meaning: string;
	how: string;
	slip: string;
	writing?: string;
	functionalLoad: "high" | "medium" | "low";
	picture?: SoundPicture;
	next?: SoundNeighbor;
	also?: SoundNeighbor;
	pairs?: string;
	aliases?: string[];
}

export interface SoundNotesDataset {
	language: string;
	version: number;
	sources: string[];
	groups: Array<{ id: string; label: string }>;
	sounds: SoundNote[];
}

const NOTES_BY_LANGUAGE: Record<string, SoundNotesDataset> = {
	[slovakNotesJson.language]: slovakNotesJson as unknown as SoundNotesDataset,
	[russianNotesJson.language]: russianNotesJson as unknown as SoundNotesDataset,
	[estonianNotesJson.language]: estonianNotesJson as unknown as SoundNotesDataset,
};

export function getSoundNotes(languageId: string | undefined): SoundNotesDataset | null {
	return (languageId && NOTES_BY_LANGUAGE[languageId]) || null;
}

const key = (text: string) => text.trim().toLowerCase().normalize("NFC");

export function getSoundNote(target: string, languageId: string | undefined): SoundNote | null {
	const wanted = key(target);
	if (!wanted) return null;
	return (
		getSoundNotes(languageId)?.sounds.find(
			(s) => key(s.symbol) === wanted || s.aliases?.some((a) => key(a) === wanted),
		) ?? null
	);
}

export function soundGuideWords(languageId: string | undefined): string[] {
	const sounds = getSoundNotes(languageId)?.sounds ?? [];
	return [...new Set(sounds.flatMap((s) => [s.word, s.next?.word, s.also?.word]).filter((w): w is string => !!w))];
}

export function soundNotesForPairs(family: string, languageId: string | undefined): SoundNote[] {
	return getSoundNotes(languageId)?.sounds.filter((s) => s.pairs === family) ?? [];
}
