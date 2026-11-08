"use client";

import { cn } from "@/lib/utils";
import { Arrow, Box, Curve, Dot, Figure, House, Line, Loop, Note, Patch, Sheet, Stroke } from "@/components/lesson/ink";
import type { UnitId } from "@/src/core";

/**
 * Case sketches (the click-through diagrams on the learn-first intro):
 * one drawing per case that shows what the preposition does, staged across
 * the unit's trigger words and across the genders, then landing on a real
 * sentence with the case ending marked. Drawn in ink (components/lesson/ink.tsx),
 * so it works offline and needs no generation. Built for the Slovak atlas
 * units; other languages get no sketch and keep the plain intro.
 */

export type SceneKind = "into" | "outof" | "at" | "inside" | "on" | "about" | "together" | "infront" | "vehicle" | "toward" | "gift" | "cup" | "without" | "town" | "pen" | "have" | "see";

export interface SketchStage {
	label: string;
	kind: SceneKind;
	before: string;
	base: string;
	ending: string;
	after: string;
	meaning: string;
	dictionary: string;
	gender: "feminine" | "masculine" | "neuter";
	cue: string;
	why: string;
}

export interface SummaryRow {
	who: "masculine person" | "masculine thing" | "feminine" | "neuter";
	from: string;
	stem: string;
	ending: string;
	note?: string;
}

/** The ending logic of one case, after the sketch stages: one row per kind
 *  of word, so the whole case reads at a glance. Every Slovak form is checked
 *  against the site's own case pages (slovak.wiki: /grammar/cases/<case>). */
export interface SketchSummary {
	calls: string;
	rows: readonly SummaryRow[];
	exceptions?: string;
	slug: string;
}

const stage = (s: SketchStage): SketchStage => s;

const SKETCHES: Partial<Record<UnitId, SketchStage[]>> = {
	gen: [
		stage({ label: "do means “into”", kind: "into", before: "Idem do ", base: "škol", ending: "y", after: ".", meaning: "I am going to school.", dictionary: "škola", gender: "feminine", cue: "after do", why: "Feminine words ending in -a swap it for -y: škola → školy, ruka → ruky." }),
		stage({ label: "z means “out of”", kind: "outof", before: "Idem z ", base: "prác", ending: "e", after: ".", meaning: "I am coming from work.", dictionary: "práca", gender: "feminine", cue: "after z", why: "Words ending in -ca take -e instead of -y: práca → práce, ulica → ulice." }),
		stage({ label: "u means “at someone’s place”", kind: "at", before: "Som u ", base: "lekár", ending: "a", after: ".", meaning: "I am at the doctor’s.", dictionary: "lekár", gender: "masculine", cue: "after u", why: "A male person adds -a: lekár → lekára." }),
		stage({ label: "bez means “without”", kind: "without", before: "Káva bez ", base: "mliek", ending: "a", after: ".", meaning: "Coffee without milk.", dictionary: "mlieko", gender: "neuter", cue: "after bez", why: "A neuter word swaps -o for -a: mlieko → mlieka." }),
	],
	loc: [
		stage({ label: "v means “inside”", kind: "inside", before: "Žijem v ", base: "mest", ending: "e", after: ".", meaning: "I live in the town.", dictionary: "mesto", gender: "neuter", cue: "after v", why: "A word ending in -o swaps it for -e: mesto → meste." }),
		stage({ label: "na means “on top of”", kind: "on", before: "Kniha je na ", base: "stol", ending: "e", after: ".", meaning: "The book is on the table.", dictionary: "stôl", gender: "masculine", cue: "after na", why: "A masculine thing adds -e: stôl → stole (the ô becomes o)." }),
		stage({ label: "o means “about”", kind: "about", before: "Hovoríme o ", base: "škol", ending: "e", after: ".", meaning: "We are talking about school.", dictionary: "škola", gender: "feminine", cue: "after o", why: "Feminine words ending in -a swap it for -e: škola → škole. o calls for this case just like v and na." }),
	],
	ins: [
		stage({ label: "s means “together with”", kind: "together", before: "Športujem s ", base: "kamarát", ending: "om", after: ".", meaning: "I play sports with a friend.", dictionary: "kamarát", gender: "masculine", cue: "after s", why: "A masculine word adds -om: kamarát → kamarátom." }),
		stage({ label: "pred means “in front of”", kind: "infront", before: "Stojím pred ", base: "škol", ending: "ou", after: ".", meaning: "I am standing in front of the school.", dictionary: "škola", gender: "feminine", cue: "after pred", why: "Feminine words ending in -a swap it for -ou: škola → školou." }),
		stage({ label: "-om alone means “by”", kind: "vehicle", before: "Idem ", base: "autobus", ending: "om", after: ".", meaning: "I am going by bus.", dictionary: "autobus", gender: "masculine", cue: "no preposition", why: "No preposition here. The -om ending alone means “by”: autobus → autobusom." }),
		stage({ label: "-om alone also means “with” a tool", kind: "pen", before: "Píšem ", base: "per", ending: "om", after: ".", meaning: "I write with a pen.", dictionary: "pero", gender: "neuter", cue: "no preposition", why: "A neuter word swaps -o for -om: pero → perom." }),
	],
	dat: [
		stage({ label: "k means “toward”", kind: "toward", before: "Idem k ", base: "brat", ending: "ovi", after: ".", meaning: "I am going to my brother’s.", dictionary: "brat", gender: "masculine", cue: "after k", why: "A male person adds -ovi: brat → bratovi." }),
		stage({ label: "vďaka means “thanks to”", kind: "gift", before: "Vďaka ", base: "mam", ending: "e", after: ".", meaning: "Thanks to mom.", dictionary: "mama", gender: "feminine", cue: "after vďaka", why: "Feminine words ending in -a swap it for -e: mama → mame." }),
		stage({ label: "k also points toward a place", kind: "town", before: "Idem k ", base: "mest", ending: "u", after: ".", meaning: "I am going toward the town.", dictionary: "mesto", gender: "neuter", cue: "after k", why: "A neuter word swaps -o for -u: mesto → mestu." }),
	],
	"acc-people": [
		stage({ label: "A male person as the object", kind: "have", before: "Mám ", base: "brat", ending: "a", after: ".", meaning: "I have a brother.", dictionary: "brat", gender: "masculine", cue: "as the object", why: "A male person as the object adds -a: brat → brata." }),
		stage({ label: "Another male person as the object", kind: "see", before: "Vidím ", base: "učiteľ", ending: "a", after: ".", meaning: "I see the teacher.", dictionary: "učiteľ", gender: "masculine", cue: "as the object", why: "Every male person does this: učiteľ → učiteľa." }),
	],
	"acc-fem": [
		stage({ label: "A woman as the object", kind: "have", before: "Mám ", base: "sestr", ending: "u", after: ".", meaning: "I have a sister.", dictionary: "sestra", gender: "feminine", cue: "as the object", why: "Feminine words ending in -a swap it for -u when they are the object: sestra → sestru." }),
		stage({ label: "A thing in -a as the object", kind: "cup", before: "Pijem ", base: "káv", ending: "u", after: ".", meaning: "I drink coffee.", dictionary: "káva", gender: "feminine", cue: "as the object", why: "The same swap: káva → kávu." }),
	],
};

export const SKETCH_UNITS = Object.keys(SKETCHES) as UnitId[];

const LEADS: Partial<Record<UnitId, string>> = {
	gen: "After do, z, od, bez and u, a word changes its ending.",
	loc: "After v, na and o, a word changes its ending.",
	ins: "After s and pred, and to say “by” or “with”, a word changes its ending.",
	dat: "After k and vďaka, a word changes its ending.",
	"acc-people": "When a male person is the object (I have a brother), the word changes its ending.",
	"acc-fem": "When a feminine word ending in -a is the object (I have a sister), it changes its ending.",
};

const ACCUSATIVE_ROWS: readonly SummaryRow[] = [
	{ who: "masculine person", from: "brat", stem: "brat", ending: "a" },
	{ who: "masculine thing", from: "dom", stem: "dom", ending: "", note: "no change" },
	{ who: "feminine", from: "škola", stem: "škol", ending: "u" },
	{ who: "neuter", from: "mesto", stem: "mesto", ending: "", note: "no change" },
];

const SUMMARIES: Partial<Record<UnitId, SketchSummary>> = {
	gen: {
		slug: "genitive",
		calls: "do, z, od, bez, u and okolo call for the genitive. The ending depends on the word’s gender:",
		rows: [
			{ who: "masculine person", from: "lekár", stem: "lekár", ending: "a" },
			{ who: "masculine thing", from: "dom", stem: "dom", ending: "u", note: "or -a: stôl → stola" },
			{ who: "feminine", from: "škola", stem: "škol", ending: "y", note: "after c, dz, dž, j, č, š, ž, ľ, ň, ď, ť: -e (práca → práce)" },
			{ who: "neuter", from: "mesto", stem: "mest", ending: "a" },
		],
		exceptions: "A few men end in -a too (hrdina). They follow the masculine pattern: hrdinu. A few words follow the soft pattern anyway: večera is declined like ulica, so večere.",
	},
	loc: {
		slug: "locative",
		calls: "v, na and o call for the locative. It never stands alone. The ending depends on the word’s gender:",
		rows: [
			{ who: "masculine person", from: "brat", stem: "brat", ending: "ovi" },
			{ who: "masculine thing", from: "dom", stem: "dom", ending: "e", note: "after k, g, h, ch: -u (park → parku)" },
			{ who: "feminine", from: "škola", stem: "škol", ending: "e", note: "after c, dz, dž, j, č, š, ž, ľ, ň, ď, ť: -i (ulica → ulici)" },
			{ who: "neuter", from: "mesto", stem: "mest", ending: "e" },
		],
		exceptions: "A few words follow the soft pattern anyway: večera is declined like ulica, so o večeri.",
	},
	ins: {
		slug: "instrumental",
		calls: "s and pred call for the instrumental. Alone, it also means “by” or “with” a tool. The ending depends on the word’s gender:",
		rows: [
			{ who: "masculine person", from: "brat", stem: "brat", ending: "om" },
			{ who: "masculine thing", from: "dom", stem: "dom", ending: "om" },
			{ who: "feminine", from: "škola", stem: "škol", ending: "ou" },
			{ who: "neuter", from: "mesto", stem: "mest", ending: "om" },
		],
		exceptions: "In the plural -ami is the usual ending, and male people take -mi: bratmi.",
	},
	dat: {
		slug: "dative",
		calls: "k and vďaka call for the dative. The ending depends on the word’s gender:",
		rows: [
			{ who: "masculine person", from: "brat", stem: "brat", ending: "ovi" },
			{ who: "masculine thing", from: "dom", stem: "dom", ending: "u" },
			{ who: "feminine", from: "škola", stem: "škol", ending: "e", note: "after c, dz, dž, j, č, š, ž, ľ, ň, ď, ť: -i (ulica → ulici)" },
			{ who: "neuter", from: "mesto", stem: "mest", ending: "u" },
		],
		exceptions: "A few words follow the soft pattern anyway: večera is declined like ulica, so večeri.",
	},
	"acc-people": {
		slug: "accusative",
		calls: "The object of a verb (I have, I see) is in the accusative. Only some words change:",
		rows: ACCUSATIVE_ROWS,
		exceptions: "Male persons keep this in the plural too: Vidím študentov.",
	},
	"acc-fem": {
		slug: "accusative",
		calls: "The object of a verb (I have, I see) is in the accusative. Only some words change:",
		rows: ACCUSATIVE_ROWS,
	},
};

export function sketchLead(unit: UnitId): string {
	return LEADS[unit] ?? "";
}

export function sketchStages(unit: UnitId): SketchStage[] {
	return SKETCHES[unit] ?? [];
}

export function sketchSummary(unit: UnitId): SketchSummary | undefined {
	return SUMMARIES[unit];
}

const GROUND = 104;

function Ground() {
	return <Line from={[8, GROUND]} to={[332, GROUND]} seed={3} tone="soft" width={1.3} opacity={0.55} />;
}

function Scene({ kind }: { kind: SceneKind }) {
	switch (kind) {
		case "into":
			return (
				<>
					<Ground />
					<House kind="school" x={232} ground={GROUND} seed={11} />
					<Figure x={64} ground={GROUND} seed={21} reach="right" delay={0.1} />
					<Patch cx={262} cy={92} rx={15} ry={17} seed={5} delay={0.6} />
					<Arrow from={[94, 71]} to={[252, 92]} seed={31} bend={9} delay={0.7} />
					<Note x={170} y={126} delay={1.1}>do</Note>
				</>
			);
		case "outof":
			return (
				<>
					<Ground />
					<House kind="office" x={40} ground={GROUND} seed={12} />
					<Figure x={256} ground={GROUND} seed={22} delay={0.1} />
					<Patch cx={71} cy={92} rx={15} ry={17} seed={6} delay={0.6} />
					<Arrow from={[72, 90]} to={[200, 84]} seed={32} bend={-7} delay={0.7} />
					<Note x={150} y={126} delay={1.1}>z</Note>
				</>
			);
		case "at":
			return (
				<>
					<Ground />
					<House kind="clinic" x={176} ground={GROUND} seed={14} />
					<Figure x={136} ground={GROUND} seed={24} delay={0.2} />
					<Patch cx={176} cy={66} rx={76} ry={42} seed={7} delay={0.7} />
					<Note x={168} y={126} delay={1.1}>u</Note>
				</>
			);
		case "without":
			return (
				<>
					<Box x={134} y={46} width={40} height={50} seed={61} />
					<Curve points={[[134, 46], [154, 32], [174, 46]]} seed={62} delay={0.15} />
					<Curve points={[[154, 60], [147, 72], [154, 82], [161, 72], [154, 60]]} seed={70} tone="soft" delay={0.3} />
					<Patch cx={154} cy={70} rx={30} ry={34} seed={14} delay={0.5} />
					<Loop cx={154} cy={66} rx={42} ry={42} seed={63} tone="mark" width={2.1} delay={0.6} />
					<Line from={[124, 36]} to={[184, 96]} seed={64} tone="mark" width={2.1} delay={0.9} />
					<Note x={154} y={126} delay={1.2}>bez</Note>
				</>
			);
		case "inside":
			return (
				<>
					<Loop cx={170} cy={58} rx={42} ry={38} seed={41} tone="soft" width={1.9} />
					<Patch cx={170} cy={58} rx={14} ry={14} seed={8} delay={0.7} />
					<Dot cx={170} cy={58} r={6.5} seed={9} delay={0.9} />
					<Note x={254} y={64} delay={1.1}>v</Note>
				</>
			);
		case "on":
			return (
				<>
					<Ground />
					<Line from={[84, 52]} to={[186, 52]} seed={42} tone="soft" width={2} />
					<Line from={[96, 52]} to={[102, GROUND]} seed={43} tone="soft" delay={0.15} />
					<Line from={[174, 52]} to={[168, GROUND]} seed={44} tone="soft" delay={0.2} />
					<Patch cx={134} cy={42} rx={14} ry={12} seed={10} delay={0.6} />
					<Dot cx={134} cy={42} r={6.5} seed={13} delay={0.8} />
					<Note x={66} y={96} delay={1.1}>na</Note>
				</>
			);
		case "about":
			return (
				<>
					<Ground />
					<Figure x={62} ground={GROUND} seed={25} reach="right" />
					<Loop cx={222} cy={44} rx={72} ry={28} seed={45} tone="soft" delay={0.2} />
					<Loop cx={152} cy={74} rx={5} seed={46} tone="soft" delay={0.4} />
					<Loop cx={140} cy={86} rx={3} seed={47} tone="soft" delay={0.45} />
					<Line from={[170, 38]} to={[270, 38]} seed={48} tone="soft" opacity={0.6} delay={0.5} />
					<Line from={[178, 50]} to={[250, 50]} seed={49} tone="soft" opacity={0.45} delay={0.55} />
					<Patch cx={222} cy={44} rx={60} ry={20} seed={14} delay={0.7} />
					<Arrow from={[92, 62]} to={[146, 54]} seed={34} bend={5} delay={0.8} />
					<Note x={110} y={126} delay={1.2}>o</Note>
				</>
			);
		case "together":
			return (
				<>
					<Ground />
					<Figure x={84} ground={GROUND} seed={26} reach="right" />
					<Figure x={252} ground={GROUND} seed={27} reach="left" delay={0.1} />
					<Patch cx={168} cy={70} rx={64} ry={14} seed={15} delay={0.6} />
					<Curve points={[[106, 74], [140, 68], [196, 72], [230, 66]]} seed={35} tone="mark" width={2.1} delay={0.7} />
					<Note x={168} y={126} delay={1.1}>s</Note>
				</>
			);
		case "infront":
			return (
				<>
					<Ground />
					<House kind="school" x={196} ground={GROUND} seed={13} />
					<Figure x={96} ground={GROUND} seed={28} reach="right" delay={0.1} />
					<Patch cx={96} cy={70} rx={24} ry={42} seed={16} delay={0.6} />
					<Line from={[148, 62]} to={[148, GROUND]} seed={50} tone="soft" opacity={0.5} delay={0.5} />
					<Note x={122} y={126} delay={1.1}>pred</Note>
				</>
			);
		case "vehicle":
			return (
				<>
					<Ground />
					<Box x={64} y={50} width={130} height={42} seed={51} delay={0} />
					<Line from={[64, 68]} to={[194, 68]} seed={52} tone="soft" delay={0.2} />
					<Loop cx={94} cy={96} rx={8} seed={53} delay={0.3} />
					<Loop cx={166} cy={96} rx={8} seed={54} delay={0.35} />
					<Patch cx={129} cy={72} rx={80} ry={32} seed={17} delay={0.6} />
					<Arrow from={[212, 70]} to={[306, 70]} seed={36} bend={-4} delay={0.7} />
					<Note x={129} y={126} delay={1.1}>autobus</Note>
				</>
			);
		case "pen":
			return (
				<>
					<Stroke d="M204 24 L216 34 L170 86 L150 94 L154 74 Z" tone="ink" />
					<Line from={[154, 74]} to={[170, 86]} seed={65} tone="ink" delay={0.2} />
					<Patch cx={130} cy={96} rx={50} ry={14} seed={18} delay={0.5} />
					<Curve points={[[150, 96], [132, 88], [114, 98], [96, 90], [78, 98]]} seed={66} tone="mark" width={2.1} delay={0.6} />
					<Note x={246} y={100} delay={1.1}>-om</Note>
				</>
			);
		case "toward":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={29} reach="right" />
					<Figure x={258} ground={GROUND} seed={30} delay={0.1} />
					<Patch cx={258} cy={68} rx={26} ry={40} seed={18} delay={0.6} />
					<Arrow from={[92, 68]} to={[230, 68]} seed={37} bend={11} delay={0.7} />
					<Note x={160} y={126} delay={1.1}>k</Note>
				</>
			);
		case "have":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={71} reach="right" />
					<Figure x={258} ground={GROUND} seed={72} delay={0.1} />
					<Patch cx={258} cy={68} rx={26} ry={40} seed={21} delay={0.6} />
					<Arrow from={[92, 68]} to={[230, 68]} seed={73} bend={11} delay={0.7} />
					<Note x={160} y={126} delay={1.1}>mám</Note>
				</>
			);
		case "see":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={74} reach="right" />
					<Figure x={258} ground={GROUND} seed={75} delay={0.1} />
					<Curve points={[[132, 42], [150, 30], [168, 42], [150, 52], [132, 42]]} seed={76} tone="soft" delay={0.3} />
					<Dot cx={150} cy={41} r={3.5} seed={77} delay={0.5} />
					<Patch cx={258} cy={68} rx={26} ry={40} seed={22} delay={0.6} />
					<Arrow from={[84, 56]} to={[230, 60]} seed={78} bend={-4} delay={0.7} />
					<Note x={160} y={126} delay={1.1}>vidím</Note>
				</>
			);
		case "town":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={31} reach="right" />
					<Box x={222} y={62} width={26} height={42} seed={67} tone="soft" delay={0.1} />
					<Box x={252} y={44} width={30} height={60} seed={68} tone="soft" delay={0.2} />
					<Box x={286} y={70} width={24} height={34} seed={69} tone="soft" delay={0.3} />
					<Patch cx={266} cy={76} rx={48} ry={34} seed={19} delay={0.6} />
					<Arrow from={[92, 68]} to={[206, 78]} seed={38} bend={8} delay={0.7} />
					<Note x={150} y={126} delay={1.1}>k</Note>
				</>
			);
		case "gift":
			return (
				<>
					<Ground />
					<Box x={76} y={62} width={44} height={34} seed={55} />
					<Line from={[98, 62]} to={[98, 96]} seed={56} tone="soft" delay={0.2} />
					<Curve points={[[98, 62], [88, 50], [92, 44], [98, 62], [104, 44], [108, 50], [98, 62]]} seed={57} tone="soft" delay={0.3} />
					<Figure x={268} ground={GROUND} seed={31} delay={0.1} />
					<Patch cx={268} cy={68} rx={26} ry={40} seed={19} delay={0.6} />
					<Arrow from={[134, 78]} to={[238, 70]} seed={38} bend={10} delay={0.7} />
					<Note x={190} y={126} delay={1.1}>vďaka</Note>
				</>
			);
		case "cup":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={79} reach="right" />
					<Curve points={[[222, 58], [260, 59], [298, 58], [297, 78], [290, 98], [270, 104], [250, 104], [230, 98], [223, 78], [222, 58]]} seed={58} />
					<Curve points={[[298, 66], [316, 66], [318, 82], [310, 88], [296, 86]]} seed={59} delay={0.25} />
					<Curve points={[[248, 46], [254, 38], [246, 30], [252, 22]]} seed={60} tone="soft" opacity={0.7} delay={0.4} />
					<Curve points={[[272, 46], [278, 38], [270, 30], [276, 22]]} seed={61} tone="soft" opacity={0.7} delay={0.45} />
					<Patch cx={260} cy={80} rx={34} ry={20} seed={20} delay={0.7} />
					<Arrow from={[92, 68]} to={[206, 82]} seed={80} bend={8} delay={0.8} />
					<Note x={150} y={126} delay={1.2}>pijem</Note>
				</>
			);
		default:
			return <Ground />;
	}
}

export function CaseSketch({ unit, stage: index, className }: { unit: UnitId; stage: number; className?: string }) {
	const scene = sketchStages(unit)[index];
	if (!scene) return null;
	return (
		<Sheet key={`${unit}-${index}`} viewBox="0 0 340 132" className={cn("h-auto w-full max-w-[420px]", className)}>
			<Scene kind={scene.kind} />
		</Sheet>
	);
}
