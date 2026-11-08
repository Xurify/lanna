"use client";

import { cn } from "@/lib/utils";
import { Arrow, Box, Curve, Dot, Figure, House, Line, Loop, Note, Patch, Sheet } from "@/components/lesson/ink";
import type { UnitId } from "@/src/core";

/**
 * Case sketches (the click-through diagrams on the learn-first intro):
 * one drawing per case that shows what the preposition does — an arrow
 * going in, a dot inside a circle — staged across the unit's trigger
 * words, then landing on a real sentence with the case ending marked.
 * Drawn in ink (components/lesson/ink.tsx), so it works offline and needs
 * no generation. Built for the Slovak atlas units; other languages get no
 * sketch and keep the plain intro.
 */

export interface SketchStage {
	label: string;
	kind: SceneKind;
	before: string;
	base: string;
	ending: string;
	after: string;
	meaning: string;
	dictionary: string;
	cue: string;
	why: string;
}

/** The ending logic of one case, after the sketch stages: the noun's pattern
 *  is what chooses the ending, the exceptions that remain, and the case
 *  page on slovak.wiki. Every Slovak line is checked against the site's own
 *  case tables (slovak.wiki: src/lib/catalog/reference/cases.ts). */
export interface SketchSummary {
	lines: readonly string[];
	exceptions?: string;
	/** The case-page slug under /grammar/cases/. */
	slug: string;
}

export type SceneKind = "into" | "outof" | "at" | "inside" | "on" | "about" | "together" | "infront" | "vehicle" | "toward" | "gift" | "cup";

const SKETCHES: Partial<Record<UnitId, SketchStage[]>> = {
	gen: [
		{ label: "do means “into”", kind: "into", before: "Idem do ", base: "škol", ending: "y", after: ".", meaning: "I am going to school.", dictionary: "škola", cue: "after do", why: "Most words ending in -a swap it for -y: škola → školy, ruka → ruky." },
		{ label: "z means “out of”", kind: "outof", before: "Idem z ", base: "prác", ending: "e", after: ".", meaning: "I am coming from work.", dictionary: "práca", cue: "after z", why: "A few words ending in -ca take -e instead: práca → práce, ulica → ulice. Learn which with each word." },
		{ label: "u means “at someone’s place”", kind: "at", before: "Som u ", base: "lekár", ending: "a", after: ".", meaning: "I am at the doctor’s.", dictionary: "lekár", cue: "after u", why: "A male person adds -a: lekár → lekára." },
	],
	loc: [
		{ label: "v means “inside”", kind: "inside", before: "Žijem v ", base: "mest", ending: "e", after: ".", meaning: "I live in the town.", dictionary: "mesto", cue: "after v", why: "A word ending in -o swaps it for -e: mesto → meste." },
		{ label: "na means “on top of”", kind: "on", before: "Kniha je na ", base: "stol", ending: "e", after: ".", meaning: "The book is on the table.", dictionary: "stôl", cue: "after na", why: "A masculine thing adds -e: stôl → stole (the ô becomes o)." },
		{ label: "o means “about”", kind: "about", before: "Hovoríme o ", base: "škol", ending: "e", after: ".", meaning: "We are talking about school.", dictionary: "škola", cue: "after o", why: "Words in -a swap it for -e: škola → škole. o calls for this case just like v and na." },
	],
	ins: [
		{ label: "s means “together with”", kind: "together", before: "Športujem s ", base: "kamarát", ending: "om", after: ".", meaning: "I play sports with a friend.", dictionary: "kamarát", cue: "after s", why: "A masculine word adds -om: kamarát → kamarátom." },
		{ label: "pred means “in front of”", kind: "infront", before: "Stojím pred ", base: "dom", ending: "om", after: ".", meaning: "I am standing in front of the house.", dictionary: "dom", cue: "after pred", why: "The same -om on a masculine thing: dom → domom." },
		{ label: "-om alone means “by”", kind: "vehicle", before: "Idem ", base: "autobus", ending: "om", after: ".", meaning: "I am going by bus.", dictionary: "autobus", cue: "no preposition", why: "No preposition here. The -om ending alone means “by”: autobus → autobusom." },
	],
	dat: [
		{ label: "k means “toward”", kind: "toward", before: "Idem k ", base: "brat", ending: "ovi", after: ".", meaning: "I am going to my brother’s.", dictionary: "brat", cue: "after k", why: "A male person adds -ovi: brat → bratovi." },
		{ label: "vďaka means “thanks to”", kind: "gift", before: "Vďaka ", base: "mam", ending: "e", after: ".", meaning: "Thanks to mom.", dictionary: "mama", cue: "after vďaka", why: "Words ending in -a swap it for -e: mama → mame." },
	],
	"acc-people": [
		{ label: "A male person as the object", kind: "toward", before: "Mám ", base: "brat", ending: "a", after: ".", meaning: "I have a brother.", dictionary: "brat", cue: "as the object", why: "A male person as the object adds -a: brat → brata." },
		{ label: "Another male person as the object", kind: "toward", before: "Vidím ", base: "učiteľ", ending: "a", after: ".", meaning: "I see the teacher.", dictionary: "učiteľ", cue: "as the object", why: "Every male person does this: učiteľ → učiteľa." },
	],
	"acc-fem": [
		{ label: "A woman as the object", kind: "toward", before: "Mám ", base: "sestr", ending: "u", after: ".", meaning: "I have a sister.", dictionary: "sestra", cue: "as the object", why: "Words ending in -a swap it for -u when they are the object: sestra → sestru." },
		{ label: "Another word in -a as the object", kind: "cup", before: "Pijem ", base: "káv", ending: "u", after: ".", meaning: "I drink coffee.", dictionary: "káva", cue: "as the object", why: "The same swap: káva → kávu." },
	],
};

const LEADS: Partial<Record<UnitId, string>> = {
	gen: "After do, z, od, bez and u, a word changes its ending.",
	loc: "After v, na and o, a word changes its ending.",
	ins: "After s and pred, and to say “by bus”, a word changes its ending.",
	dat: "After k and vďaka, a word changes its ending.",
	"acc-people": "When a male person is the object (I have a brother), the word changes its ending.",
	"acc-fem": "When a word ending in -a is the object (I have a sister), it changes its ending.",
};

export function sketchLead(unit: UnitId): string {
	return LEADS[unit] ?? "";
}

/** The ending logic after the sketch stages, per case. */
const SUMMARIES: Partial<Record<UnitId, SketchSummary>> = {
	gen: {
		slug: "genitive",
		lines: [
			"The preposition (do, z, od, bez, u, okolo) calls for this case. The word itself decides the ending.",
			"Most words in -a swap it for -y: škola → školy, ruka → ruky. A few, like práca and ulica, take -e: práce, ulice.",
			"A male person adds -a (lekár → lekára). A neuter word swaps -o for -a (mesto → mesta).",
		],
		exceptions: "A masculine thing takes -u or -a, and there is no safe rule. Learn it with the word: dom → domu, stôl → stola, deň → dňa.",
	},
	loc: {
		slug: "locative",
		lines: [
			"v, na and o call for this case. The word brings the ending, usually -e.",
			"The same ending after all three: v meste, na stole, o škole.",
			"A male person takes -ovi instead: o bratovi.",
		],
		exceptions: "After k, g, h and ch a masculine thing takes -u: v parku.",
	},
	ins: {
		slug: "instrumental",
		lines: [
			"s and pred call for this case. The word brings the ending.",
			"Masculine and neuter words take -om (kamarátom, domom). Feminine words take -ou (mamou).",
		],
		exceptions: "In the plural -ami is the common ending, and male people take -mi: bratmi.",
	},
	dat: {
		slug: "dative",
		lines: [
			"k and vďaka call for this case.",
			"A male person adds -ovi (bratovi). Words in -a swap it for -e (mame).",
		],
		exceptions: "Words like ulica take -i instead: ulici.",
	},
	"acc-people": {
		slug: "accusative",
		lines: [
			"A male person as the object adds -a: brata.",
			"Most other singular words stay as in the dictionary: Vidím mesto.",
		],
		exceptions: "Male persons keep this in the plural too: Vidím študentov.",
	},
	"acc-fem": {
		slug: "accusative",
		lines: [
			"Words in -a swap it for -u as the object (sestru, kávu).",
			"Other singular words do not change: Mám dom, Vidím mesto.",
		],
	},
};

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
					<House x={232} ground={GROUND} seed={11} />
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
					<House x={52} ground={GROUND} seed={12} />
					<Figure x={272} ground={GROUND} seed={22} reach="left" delay={0.1} />
					<Patch cx={82} cy={92} rx={15} ry={17} seed={6} delay={0.6} />
					<Arrow from={[90, 90]} to={[246, 76]} seed={32} bend={-9} delay={0.7} />
					<Note x={174} y={126} delay={1.1}>z</Note>
				</>
			);
		case "at":
			return (
				<>
					<Ground />
					<Figure x={70} ground={GROUND} seed={23} reach="right" />
					<Figure x={250} ground={GROUND} seed={24} delay={0.1} />
					<Patch cx={250} cy={68} rx={26} ry={40} seed={7} delay={0.6} />
					<Arrow from={[98, 68]} to={[222, 68]} seed={33} bend={7} delay={0.7} />
					<Note x={168} y={126} delay={1.1}>u</Note>
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
					<House x={196} ground={GROUND} seed={13} />
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
		case "toward":
			return (
				<>
					<Ground />
					<Figure x={64} ground={GROUND} seed={29} reach="right" />
					<Figure x={258} ground={GROUND} seed={30} delay={0.1} />
					<Patch cx={258} cy={68} rx={26} ry={40} seed={18} delay={0.6} />
					<Arrow from={[92, 68]} to={[230, 68]} seed={37} bend={11} delay={0.7} />
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
					<Curve points={[[102, 58], [140, 59], [178, 58], [177, 78], [170, 98], [150, 104], [130, 104], [110, 98], [103, 78], [102, 58]]} seed={58} />
					<Curve points={[[178, 66], [196, 66], [198, 82], [190, 88], [176, 86]]} seed={59} delay={0.25} />
					<Curve points={[[128, 46], [134, 38], [126, 30], [132, 22]]} seed={60} tone="soft" opacity={0.7} delay={0.4} />
					<Curve points={[[152, 46], [158, 38], [150, 30], [156, 22]]} seed={61} tone="soft" opacity={0.7} delay={0.45} />
					<Patch cx={140} cy={80} rx={34} ry={20} seed={20} delay={0.7} />
					<Note x={140} y={126} delay={1.1}>káva</Note>
				</>
			);
		default:
			return <Ground />;
	}
}

export function CaseSketch({ unit, stage, className }: { unit: UnitId; stage: number; className?: string }) {
	const stages = sketchStages(unit);
	const scene = stages[stage];
	if (!scene) return null;
	return (
		<Sheet key={`${unit}-${stage}`} viewBox="0 0 340 132" className={cn("h-auto w-full max-w-[420px]", className)}>
			<Scene kind={scene.kind} />
		</Sheet>
	);
}
