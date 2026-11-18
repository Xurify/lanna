import { curveD, smoothD, type Point } from "@/components/lesson/ink-paths";
import type { LipShape, MouthMark, MouthSpec, TongueShape } from "@/src/core";

export const MOUTH_VIEWBOX = "0 0 200 170";

interface Place {
	at: Point;
	rx: number;
	ry: number;
}

interface TongueForm {
	surface: readonly Point[];
	tip: Point;
	jaw: number;
	place: Place;
	air?: readonly (readonly Point[])[];
}

const ROOT: readonly Point[] = [
	[134, 156],
	[139, 130],
];

const TONGUES: Record<TongueShape, TongueForm> = {
	rest: {
		surface: [
			[131, 104],
			[108, 89],
			[86, 86],
			[68, 91],
		],
		tip: [55, 96],
		jaw: 0,
		place: { at: [86, 80], rx: 0, ry: 0 },
	},
	"front-high": {
		surface: [
			[130, 112],
			[108, 90],
			[84, 64],
			[70, 70],
		],
		tip: [54, 96],
		jaw: 0,
		place: { at: [80, 60], rx: 14, ry: 7 },
	},
	"front-mid": {
		surface: [
			[130, 110],
			[108, 92],
			[86, 74],
			[70, 80],
		],
		tip: [54, 97],
		jaw: 2,
		place: { at: [84, 68], rx: 14, ry: 8 },
	},
	"front-low": {
		surface: [
			[131, 112],
			[110, 100],
			[88, 90],
			[70, 93],
		],
		tip: [55, 100],
		jaw: 8,
		place: { at: [84, 86], rx: 13, ry: 7 },
	},
	low: {
		surface: [
			[133, 106],
			[112, 99],
			[90, 98],
			[71, 101],
		],
		tip: [56, 104],
		jaw: 8,
		place: { at: [102, 95], rx: 13, ry: 7 },
	},
	"back-low": {
		surface: [
			[137, 96],
			[118, 92],
			[94, 100],
			[73, 104],
		],
		tip: [60, 107],
		jaw: 8,
		place: { at: [124, 90], rx: 13, ry: 7 },
	},
	"back-mid": {
		surface: [
			[134, 86],
			[114, 79],
			[91, 91],
			[72, 99],
		],
		tip: [59, 103],
		jaw: 3,
		place: { at: [122, 74], rx: 13, ry: 8 },
	},
	"back-high": {
		surface: [
			[133, 76],
			[115, 70],
			[92, 87],
			[73, 98],
		],
		tip: [60, 103],
		jaw: 1,
		place: { at: [123, 66], rx: 13, ry: 7 },
	},
	"middle-high": {
		surface: [
			[131, 94],
			[110, 66],
			[93, 70],
			[74, 86],
		],
		tip: [57, 98],
		jaw: 1,
		place: { at: [107, 61], rx: 14, ry: 7 },
	},
	"tip-teeth": {
		surface: [
			[131, 106],
			[108, 94],
			[86, 90],
			[66, 87],
		],
		tip: [48, 84],
		jaw: 0,
		place: { at: [49, 83], rx: 7, ry: 7 },
	},
	"tip-ridge": {
		surface: [
			[131, 106],
			[108, 94],
			[86, 90],
			[69, 84],
		],
		tip: [57, 75],
		jaw: 0,
		place: { at: [58, 74], rx: 7, ry: 7 },
	},
	"tip-ridge-trill": {
		surface: [
			[131, 106],
			[108, 94],
			[88, 92],
			[72, 88],
		],
		tip: [57, 77],
		jaw: 0,
		place: { at: [58, 74], rx: 7, ry: 7 },
	},
	"body-roof": {
		surface: [
			[130, 112],
			[112, 88],
			[92, 59],
			[78, 60],
			[66, 66],
		],
		tip: [54, 97],
		jaw: 0,
		place: { at: [79, 58], rx: 16, ry: 7 },
	},
	"back-roof": {
		surface: [
			[137, 70],
			[128, 64],
			[116, 63],
			[94, 86],
			[73, 97],
		],
		tip: [59, 102],
		jaw: 0,
		place: { at: [123, 62], rx: 12, ry: 7 },
	},
	"back-near-roof": {
		surface: [
			[136, 82],
			[124, 76],
			[112, 76],
			[92, 90],
			[73, 98],
		],
		tip: [59, 102],
		jaw: 0,
		place: { at: [121, 69], rx: 13, ry: 8 },
		air: [
			[
				[133, 71],
				[127, 69.5],
				[121, 70.5],
			],
			[
				[116, 70],
				[110, 68.5],
				[104, 69.5],
			],
		],
	},
	"tip-teeth-middle-up": {
		surface: [
			[130, 110],
			[110, 84],
			[88, 64],
			[68, 74],
		],
		tip: [50, 81],
		jaw: 0,
		place: { at: [86, 60], rx: 14, ry: 7 },
	},
	"tip-ridge-middle-up": {
		surface: [
			[130, 110],
			[110, 84],
			[90, 64],
			[72, 72],
		],
		tip: [57, 75],
		jaw: 0,
		place: { at: [88, 60], rx: 14, ry: 7 },
	},
	"tip-teeth-back-up": {
		surface: [
			[135, 78],
			[116, 76],
			[90, 95],
			[67, 91],
		],
		tip: [48, 84],
		jaw: 0,
		place: { at: [124, 70], rx: 13, ry: 8 },
	},
	"tip-back": {
		surface: [
			[134, 84],
			[114, 84],
			[94, 94],
			[78, 88],
		],
		tip: [67, 73],
		jaw: 0,
		place: { at: [66, 70], rx: 7, ry: 7 },
	},
	"blade-roof": {
		surface: [
			[130, 110],
			[110, 86],
			[90, 68],
			[74, 68],
		],
		tip: [58, 88],
		jaw: 0,
		place: { at: [77, 63], rx: 11, ry: 7 },
	},
};

const ROOF: readonly Point[] = [
	[50, 78],
	[58, 73],
	[68, 64],
	[88, 57],
	[106, 59],
	[121, 63],
	[135, 65],
	[146, 67],
	[147, 74],
	[143, 80],
];

const THROAT_WALL: readonly Point[] = [
	[130, 45],
	[145, 48],
	[151, 60],
	[153, 92],
	[150, 134],
	[144, 168],
];

const FACE_TOP: readonly Point[] = [
	[60, 4],
	[47, 22],
	[44, 38],
	[33, 50],
	[24, 59],
	[35, 66],
];

const LIPS: Record<LipShape, { upper: readonly Point[]; lower: readonly Point[]; place: Place }> = {
	neutral: {
		upper: [
			[35, 66],
			[37, 71],
			[31, 76],
			[30, 81],
			[39, 85],
		],
		lower: [
			[40, 90],
			[32, 92],
			[31, 97],
			[38, 104],
		],
		place: { at: [32, 87], rx: 10, ry: 13 },
	},
	spread: {
		upper: [
			[35, 66],
			[38, 71],
			[36, 77],
			[37, 82],
			[44, 85],
		],
		lower: [
			[45, 89],
			[38, 91],
			[37, 96],
			[39, 104],
		],
		place: { at: [39, 87], rx: 9, ry: 12 },
	},
	round: {
		upper: [
			[35, 66],
			[33, 71],
			[20, 75],
			[15, 82],
			[27, 86],
		],
		lower: [
			[27, 91],
			[15, 92],
			[19, 100],
			[35, 106],
		],
		place: { at: [20, 88], rx: 12, ry: 14 },
	},
	"lip-to-teeth": {
		upper: [
			[35, 66],
			[37, 71],
			[31, 76],
			[30, 81],
			[39, 85],
		],
		lower: [
			[47, 88],
			[40, 88],
			[35, 94],
			[38, 104],
		],
		place: { at: [44, 88], rx: 7, ry: 6 },
	},
};

const THROAT_PLACE: Place = { at: [141, 153], rx: 11, ry: 10 };

const lowered = (points: readonly Point[], by: number): Point[] => points.map(([x, y]): Point => [x, y + by]);

export interface MouthPaths {
	face: string;
	chin: string;
	upperLip: string;
	lowerLip: string;
	upperTeeth: string;
	lowerTeeth: string;
	roof: string;
	throat: string;
	gum: string;
	tongue: string;
	tongueBody: string;
	taps: string[];
	air: string[];
	folds: string[];
	accent: MouthMark;
	place: { cx: number; cy: number; rx: number; ry: number } | null;
}

/** The mouth on its way from one sound's position to the one drawn: 0 is
 *  `from`, 1 is the drawing as it stands. `tipDrop` lowers the tip alone. */
export interface MouthMotion {
	from: MouthSpec;
	progress: number;
	tipDrop?: number;
}

export const REST_MOUTH: MouthSpec = { tongue: "rest", lips: "neutral" };

const SETTLE_MS = 180;
const REACH_MS = 420;
const TRILL_MS = 540;
const TRILL_TAPS = 3;
const TRILL_DROP = 4;

/** How long a mouth moves after its word starts playing. */
export function mouthMotionMs(spec: MouthSpec): number {
	return SETTLE_MS + REACH_MS + (spec.tongue === "tip-ridge-trill" ? TRILL_MS : 0);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The mouth at a moment after its word started: it lets go to rest, moves
 *  to the sound's position, and for a rolled r the tip then taps. */
export function mouthMotionAt(spec: MouthSpec, elapsedMs: number): MouthMotion {
	if (elapsedMs < SETTLE_MS) return { from: REST_MOUTH, progress: 1 - easeInOut(elapsedMs / SETTLE_MS) };
	const reaching = (elapsedMs - SETTLE_MS) / REACH_MS;
	if (reaching < 1) return { from: REST_MOUTH, progress: easeInOut(reaching) };
	const tapping = (elapsedMs - SETTLE_MS - REACH_MS) / TRILL_MS;
	if (spec.tongue !== "tip-ridge-trill" || tapping >= 1) return { from: REST_MOUTH, progress: 1 };
	return { from: REST_MOUTH, progress: 1, tipDrop: TRILL_DROP * Math.abs(Math.sin(Math.PI * TRILL_TAPS * tapping)) };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPoints = (a: readonly Point[], b: readonly Point[], t: number): Point[] =>
	a.map(([x, y], i): Point => [mix(x, b[i]![0], t), mix(y, b[i]![1], t)]);

const jawOf = (spec: MouthSpec) => (spec.lips === "lip-to-teeth" ? 0 : TONGUES[spec.tongue].jaw);

const SURFACE_POINTS = 5;

function tongueOutline(spec: MouthSpec, even: boolean): { points: Point[]; tipIndex: number } {
	const form = TONGUES[spec.tongue];
	const jaw = jawOf(spec);
	const raised = form.tip[1] < 90;
	const tip: Point = [form.tip[0], form.tip[1] + (raised ? 0 : jaw)];
	const end: Point = [78, 112 + jaw];
	const under: Point[] = raised
		? [[tip[0] + 5, tip[1] + 12], [tip[0] + 13, tip[1] + 24], end]
		: even
			? [[tip[0] + 9, tip[1] + 8], [(tip[0] + 9 + end[0]) / 2, (tip[1] + 8 + end[1]) / 2], end]
			: [[tip[0] + 9, tip[1] + 8], end];
	let surface: readonly Point[] = form.surface;
	if (even && surface.length < SURFACE_POINTS) {
		const [a, b, c, d] = surface as [Point, Point, Point, Point];
		// The point a Catmull-Rom curve through a, b, c, d passes halfway between b and c.
		const middle: Point = [(-a[0] + 9 * b[0] + 9 * c[0] - d[0]) / 16, (-a[1] + 9 * b[1] + 9 * c[1] - d[1]) / 16];
		surface = [a, b, middle, c, d];
	}
	return { points: [...ROOT, ...surface, tip, ...under], tipIndex: ROOT.length + surface.length };
}

export function mouthPaths(spec: MouthSpec, seed: number, motion?: MouthMotion): MouthPaths {
	const form = TONGUES[spec.tongue];
	const accent: MouthMark = spec.mark ?? (spec.lips === "lip-to-teeth" ? "lips" : "tongue");
	const progress = motion ? Math.min(1, Math.max(0, motion.progress)) : 1;
	const moving = motion !== undefined && progress < 1;
	const jaw = moving ? mix(jawOf(motion.from), jawOf(spec), progress) : jawOf(spec);
	const settled = tongueOutline(spec, moving);
	const outline = moving
		? mixPoints(tongueOutline(motion.from, true).points, settled.points, progress)
		: settled.points;
	if (motion?.tipDrop)
		outline[settled.tipIndex] = [outline[settled.tipIndex]![0], outline[settled.tipIndex]![1] + motion.tipDrop];
	const lips = moving
		? {
				upper: mixPoints(LIPS[motion.from.lips].upper, LIPS[spec.lips].upper, progress),
				lower: mixPoints(LIPS[motion.from.lips].lower, LIPS[spec.lips].lower, progress),
				place: LIPS[spec.lips].place,
			}
		: LIPS[spec.lips];
	const lower = lowered(lips.lower, jaw);
	const place = accent === "lips" ? lips.place : accent === "throat" ? THROAT_PLACE : form.place;
	return {
		face: curveD(FACE_TOP, seed + 3),
		chin: curveD([lower[lower.length - 1]!, [37, 121 + jaw], [51, 138 + jaw * 0.6], [88, 147], [97, 168]], seed + 2),
		upperLip: curveD(lips.upper, seed + 4, 0.4),
		lowerLip: curveD(lower, seed + 5, 0.4),
		upperTeeth: "M45.5 76 L43.6 87.5 Q45.8 90 47.8 87.6 L51 78.5 Z",
		lowerTeeth: `M47.5 ${107 + jaw} L45.8 ${96.5 + jaw} Q47.8 ${94 + jaw} 49.8 ${96.4 + jaw} L52.5 ${105 + jaw} Z`,
		roof: curveD(ROOF, seed + 6, 0.4),
		throat: curveD(THROAT_WALL, seed + 7),
		gum: curveD(
			[
				[52, 107 + jaw],
				[58, 115 + jaw],
				[68, 117 + jaw],
				[78, 112 + jaw],
			],
			seed + 8,
			0.3,
		),
		tongue: curveD(outline, seed + 1, 0.5),
		tongueBody: `${smoothD([...outline, [100, 124 + jaw], [124, 140]])} Z`,
		taps:
			spec.tongue === "tip-ridge-trill"
				? [
						smoothD([
							[68, 71],
							[65.5, 76],
							[68, 81],
						]),
						smoothD([
							[74, 70],
							[70.5, 76.5],
							[74, 83],
						]),
					]
				: [],
		air: (form.air ?? []).map((points) => smoothD(points)),
		folds:
			accent === "throat"
				? [
						curveD(
							[
								[136, 150],
								[147, 149],
							],
							seed + 12,
							0.3,
						),
						curveD(
							[
								[136, 156],
								[146, 155.5],
							],
							seed + 13,
							0.3,
						),
					]
				: [],
		accent,
		place: place.rx > 0 ? { cx: place.at[0], cy: place.at[1], rx: place.rx, ry: place.ry } : null,
	};
}

export const LENGTH_VIEWBOX = "0 0 200 70";

export function lengthPaths(units: number, seed: number): { wave: string; start: string; end: string; base: string } {
	const from = 16;
	const unit = 54;
	const to = from + unit * units;
	const points: Point[] = [];
	const waves = Math.round(units * 3);
	for (let i = 0; i <= waves * 2; i++) {
		const x = from + ((to - from) * i) / (waves * 2);
		points.push([x, 34 + (i % 2 === 0 ? 0 : i % 4 === 1 ? -11 : 11)]);
	}
	return {
		wave: curveD(points, seed, 0.6),
		start: curveD(
			[
				[from, 22],
				[from, 46],
			],
			seed + 1,
			0.4,
		),
		end: curveD(
			[
				[to, 22],
				[to, 46],
			],
			seed + 2,
			0.4,
		),
		base: curveD(
			[
				[10, 58],
				[100, 58.6],
				[190, 58],
			],
			seed + 3,
			0.4,
		),
	};
}
