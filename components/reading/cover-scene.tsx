import { Stroke, type InkTone } from "@/components/lesson/ink";
import { boxD, curveD, lineD, loopD, patchD, smoothD, type Point } from "@/components/lesson/ink-paths";

export type CoverMotif = "train" | "mountains" | "cup" | "market" | "home" | "clinic" | "office" | "tree" | "friends";

const MOTIF_WORDS: ReadonlyArray<[CoverMotif, RegExp]> = [
	["train", /vlak|train|stanic|station|cest[ay] /i],
	["clinic", /lekár|doctor|pohotov|chrípk|nemocn|clinic|hospital/i],
	["office", /pohovor|prác|work|office|interview|kancel/i],
	["cup", /kaviar|café|cafe|coffee|káv|obed|kolib|lunch|restaur|pečen|medovn|bak/i],
	["market", /trh|market|potravin|shop|obchod|kúp|kniha|knih/i],
	["mountains", /tatr|(?<!\p{L})hrad|turist|hory|mountain|castle|výlet|trip/iu],
	["tree", /záhrad|garden|jabĺk|apple|obdob|season|jese|park/i],
	["home", /dom|byt|rodin|mama|mamy|home|flat|family|sťahov/i],
];

export function coverMotif(text: string): CoverMotif {
	return MOTIF_WORDS.find(([, words]) => words.test(text))?.[0] ?? "friends";
}

export function coverSeed(id: string): number {
	let hash = 7;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
	return hash;
}

const GROUND = 104;
const MAIN = 1.7;
const DETAIL = 1.2;

interface Pen {
	seed: number;
	tone?: InkTone;
	width?: number;
	delay?: number;
}

const outline = ({ tone = "ink", width = MAIN, delay = 0 }: Pen) => ({ tone, width, delay });
const detail = ({ tone = "graphite", width = DETAIL, delay = 0.25 }: Pen) => ({ tone, width, delay });

function L({ from, to, ...pen }: Pen & { from: Point; to: Point }) {
	const bow = Math.hypot(to[0] - from[0], to[1] - from[1]) > 60 ? 0.5 : 1.7;
	return <Stroke d={lineD(from, to, pen.seed, bow)} {...outline(pen)} />;
}
function C({ points, ...pen }: Pen & { points: readonly Point[] }) {
	return <Stroke d={curveD(points, pen.seed, 0.5)} {...outline(pen)} />;
}
function O({ cx, cy, rx, ry = rx, ...pen }: Pen & { cx: number; cy: number; rx: number; ry?: number }) {
	return <Stroke d={loopD(cx, cy, rx, ry, pen.seed)} {...outline(pen)} />;
}
function B({ x, y, w, h, ...pen }: Pen & { x: number; y: number; w: number; h: number }) {
	return <Stroke d={boxD(x, y, w, h, pen.seed)} {...outline(pen)} />;
}
const fine = (seed: number, delay = 0.25): Pen => ({ seed, ...detail({ seed, delay }) });

function Cloud({ cx, cy, rx, ry, bumps, seed, ...pen }: Omit<Pen, "seed"> & { cx: number; cy: number; rx: number; ry: number; bumps: number; seed: number }) {
	const points: Point[] = [];
	for (let i = 0; i < bumps * 2; i++) {
		const angle = (i / (bumps * 2)) * Math.PI * 2 - Math.PI / 2;
		const reach = i % 2 === 0 ? 1.08 : 0.9;
		points.push([cx + Math.cos(angle) * rx * reach, cy + Math.sin(angle) * ry * reach]);
	}
	return <Stroke d={smoothD(points, true)} {...outline({ seed, ...pen })} />;
}

function Ground({ seed, from = 14, to = 186 }: { seed: number; from?: number; to?: number }) {
	return <C points={[[from, GROUND + 1], [70, GROUND - 1], [130, GROUND + 1], [to, GROUND - 0.5]]} seed={seed} tone="soft" width={DETAIL} />;
}

function Highlight({ cx, cy, rx = 17, ry = 11, seed }: { cx: number; cy: number; rx?: number; ry?: number; seed: number }) {
	return <path d={patchD(cx, cy, rx, ry, seed)} className="ink-fade q-ink-patch" style={{ "--ink-delay": "0.5s" } as React.CSSProperties} />;
}

function Dots({ points }: { points: readonly Point[] }) {
	return (
		<>
			{points.map(([x, y], i) => (
				<Stroke key={i} d={`M${x} ${y} l0.1 0.1`} tone="ink" width={2.2} delay={0.3 + i * 0.02} />
			))}
		</>
	);
}

interface Body {
	x: number;
	top: number;
	height: number;
	seed: number;
	arms: [readonly Point[], readonly Point[]];
	hair?: "short" | "bun";
	dress?: boolean;
	stride?: boolean;
}

function Head({ x, cy, r, seed, hair }: { x: number; cy: number; r: number; seed: number; hair?: "short" | "bun" }) {
	return (
		<g>
			<O cx={x} cy={cy} rx={r} seed={seed} />
			<Dots points={[[x - r * 0.38, cy - r * 0.05], [x + r * 0.38, cy - r * 0.05]]} />
			<C points={[[x - r * 0.38, cy + r * 0.4], [x, cy + r * 0.6], [x + r * 0.38, cy + r * 0.4]]} {...fine(seed + 1, 0.3)} />
			{hair === "short" && <C points={[[x - r * 0.98, cy - r * 0.15], [x - r * 0.6, cy - r * 1.02], [x + r * 0.4, cy - r * 1.04], [x + r * 0.98, cy - r * 0.3]]} seed={seed + 2} delay={0.1} />}
			{hair === "bun" && (
				<>
					<O cx={x + r * 0.15} cy={cy - r * 1.3} rx={r * 0.42} seed={seed + 2} delay={0.1} />
					<C points={[[x - r * 0.98, cy - r * 0.1], [x - r * 0.4, cy - r * 0.95], [x + r * 0.6, cy - r * 0.9], [x + r * 0.98, cy - r * 0.1]]} seed={seed + 3} delay={0.1} />
				</>
			)}
		</g>
	);
}

function Person({ x, top, height, seed, arms, hair, dress, stride }: Body) {
	const r = height * 0.11;
	const neck = top + r * 2 + 1;
	const half = height * 0.12;
	const hem = top + height * (dress ? 0.7 : 0.62);
	const wide = dress ? half * 1.7 : half * 0.95;
	const foot = top + height;
	const legL = x - (stride ? height * 0.2 : half * 0.6);
	const legR = x + (stride ? height * 0.18 : half * 0.6);
	return (
		<g>
			<Head x={x} cy={top + r} r={r} seed={seed} hair={hair} />
			<C points={[[x - half * 0.7, neck], [x + half * 0.7, neck], [x + half, neck + 4], [x + wide, hem], [x - wide, hem], [x - half, neck + 4], [x - half * 0.7, neck]]} seed={seed + 4} delay={0.1} />
			{!dress && <L from={[x, neck + 3]} to={[x, hem - 2]} {...fine(seed + 5, 0.2)} />}
			<C points={[[x - half, neck + 4], ...arms[0]]} seed={seed + 6} delay={0.15} />
			<C points={[[x + half, neck + 4], ...arms[1]]} seed={seed + 7} delay={0.15} />
			<L from={[x - half * 0.5, hem]} to={[legL, foot]} seed={seed + 8} delay={0.2} />
			<L from={[x + half * 0.5, hem]} to={[legR, foot]} seed={seed + 9} delay={0.2} />
			<L from={[legL, foot]} to={[legL - 5, foot]} seed={seed + 10} delay={0.25} />
			<L from={[legR, foot]} to={[legR + 5, foot]} seed={seed + 11} delay={0.25} />
		</g>
	);
}

function Market({ seed }: { seed: number }) {
	const scallops: Point[] = [];
	for (let i = 0; i <= 12; i++) scallops.push([44 + i * (112 / 12), i % 2 === 0 ? 34 : 41]);
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={70} cy={64} rx={20} ry={12} seed={seed + 3} />
			<L from={[50, 18]} to={[150, 18]} seed={seed + 10} />
			<L from={[50, 18]} to={[44, 34]} seed={seed + 11} />
			<L from={[150, 18]} to={[156, 34]} seed={seed + 12} />
			<C points={scallops} seed={seed + 13} />
			{[1, 2, 3, 4, 5].map((i) => (
				<L key={i} from={[50 + i * 16.7, 18]} to={[44 + i * 18.7, 34]} {...fine(seed + 20 + i)} />
			))}
			<L from={[52, 40]} to={[52, 76]} seed={seed + 14} />
			<L from={[148, 40]} to={[148, 76]} seed={seed + 15} />
			<L from={[42, 76]} to={[158, 76]} seed={seed + 16} />
			<L from={[46, 76]} to={[46, GROUND]} seed={seed + 17} />
			<L from={[154, 76]} to={[154, GROUND]} seed={seed + 18} />
			<O cx={62} cy={68} rx={7.5} seed={seed + 30} delay={0.35} />
			<O cx={78} cy={68} rx={7.5} seed={seed + 31} delay={0.4} />
			<O cx={70} cy={55.5} rx={7.5} seed={seed + 32} delay={0.45} />
			<L from={[70, 48]} to={[71, 44.5]} {...fine(seed + 60, 0.5)} />
			<C points={[[71, 45.5], [75.5, 43], [78, 45.5], [72.5, 47]]} {...fine(seed + 61, 0.55)} />
			<C points={[[100, 72], [108, 64], [126, 60], [140, 62], [134, 70], [114, 74], [100, 72]]} seed={seed + 33} delay={0.4} />
			<L from={[112, 67]} to={[116, 63]} {...fine(seed + 34, 0.5)} />
			<L from={[120, 66]} to={[124, 62]} {...fine(seed + 35, 0.5)} />
			<L from={[128, 65]} to={[132, 61]} {...fine(seed + 36, 0.5)} />
			<L from={[93, 41]} to={[93, 49]} {...fine(seed + 38)} />
			<Stroke d="M87 49 L99 49 L99 58 L87 58 Z" tone="graphite" width={DETAIL} delay={0.4} />
			<O cx={93} cy={51.5} rx={1.1} {...fine(seed + 39, 0.45)} />
			{[60, 80, 100, 120, 140].map((x, i) => (
				<L key={x} from={[x, 79]} to={[x, GROUND - 1]} {...fine(seed + 70 + i, 0.35)} />
			))}
		</g>
	);
}

function Friends({ seed }: { seed: number }) {
	return (
		<g>
			<Ground seed={seed} />
			<L from={[72, GROUND]} to={[72, 34]} seed={seed + 1} />
			<C points={[[72, 34], [76, 26], [86, 24]]} seed={seed + 2} />
			<Stroke d="M81 25 L91 25 L88 32 L84 32 Z" tone="ink" width={MAIN} delay={0.1} />
			<Highlight cx={128} cy={20} rx={20} ry={10} seed={seed + 3} />
			<C points={[[106, 12], [120, 7], [142, 8], [150, 16], [144, 25], [124, 27], [112, 34], [115, 26], [106, 21], [106, 12]]} seed={seed + 7} delay={0.4} />
			<text x={128} y={21} textAnchor="middle" transform="rotate(-4 128 18)" className="ink-fade fill-current font-prose text-foreground" style={{ fontSize: 11.5, fontWeight: 550, "--ink-delay": "0.55s" } as React.CSSProperties}>
				Ahoj!
			</text>
			<Person x={110} top={42} height={62} seed={seed + 10} hair="short" arms={[[[102, 64], [100, 76]], [[124, 52], [122, 40]]]} />
			<C points={[[126, 37], [129, 40], [128, 44]]} {...fine(seed + 30, 0.45)} />
			<Person x={160} top={42} height={62} seed={seed + 20} hair="bun" dress arms={[[[146, 54], [144, 42]], [[168, 66], [170, 78]]]} />
			<C points={[[140, 40], [137, 43], [138, 47]]} {...fine(seed + 31, 0.45)} />
		</g>
	);
}

function Train({ seed }: { seed: number }) {
	return (
		<g>
			<Highlight cx={154} cy={56} rx={12} ry={9} seed={seed + 3} />
			{[48, 58, 68].map((y, i) => (
				<L key={y} from={[26 + i * 3, y]} to={[40, y]} {...fine(seed + 60 + i, 0.5)} />
			))}
			<L from={[44, 36]} to={[144, 36]} seed={seed + 10} />
			<L from={[44, 36]} to={[44, 78]} seed={seed + 11} />
			<L from={[44, 78]} to={[166, 78]} seed={seed + 12} />
			<C points={[[144, 36], [156, 41], [165, 59], [166, 78]]} seed={seed + 13} />
			<C points={[[147, 42], [156, 47], [160, 58], [147, 58], [147, 42]]} {...fine(seed + 14)} />
			{[51, 71, 91].map((x, i) => (
				<B key={x} x={x} y={45} w={14} h={11} {...fine(seed + 20 + i)} />
			))}
			<B x={112} y={43} w={16} h={31} {...fine(seed + 24)} />
			<L from={[120, 43]} to={[120, 74]} {...fine(seed + 25)} />
			<L from={[44, 66]} to={[112, 66]} {...fine(seed + 26)} />
			<L from={[128, 66]} to={[164, 66]} {...fine(seed + 27)} />
			{[60, 80, 128, 148].map((x, i) => (
				<O key={x} cx={x} cy={85} rx={6.5} seed={seed + 30 + i} delay={0.35} />
			))}
			<L from={[178, 88]} to={[178, 62]} {...fine(seed + 70, 0.4)} />
			<B x={170} y={54} w={18} h={9} seed={seed + 71} delay={0.45} />
			<L from={[174, 58.5]} to={[184, 58.5]} {...fine(seed + 72, 0.5)} />
			<C points={[[24, 92], [80, 91.5], [140, 92.3], [178, 91.8]]} seed={seed + 40} />
			<C points={[[24, 101], [80, 100.5], [140, 101.3], [178, 100.8]]} seed={seed + 41} tone="graphite" width={DETAIL} />
			{Array.from({ length: 8 }, (_, i) => (
				<L key={i} from={[32 + i * 20, 92]} to={[32 + i * 20, 101]} {...fine(seed + 42 + i, 0.4)} />
			))}
		</g>
	);
}

function Cup({ seed }: { seed: number }) {
	return (
		<g>
			<L from={[22, 100]} to={[178, 100]} seed={seed} />
			<L from={[34, 100]} to={[34, 114]} seed={seed + 1} />
			<L from={[166, 100]} to={[166, 114]} seed={seed + 2} />
			<Highlight cx={98} cy={51} rx={24} ry={3.6} seed={seed + 3} />
			<O cx={98} cy={95} rx={50} ry={5} seed={seed + 10} />
			<C points={[[68, 50], [70, 76], [82, 90], [98, 92], [114, 90], [126, 76], [128, 50]]} seed={seed + 11} />
			<O cx={98} cy={50} rx={30} ry={5} seed={seed + 12} />
			<C points={[[127, 58], [142, 57], [145, 69], [137, 79], [123, 79]]} seed={seed + 13} />
			<C points={[[86, 40], [81, 33], [88, 26], [83, 18]]} {...fine(seed + 20, 0.4)} />
			<C points={[[98, 40], [93, 32], [100, 24], [95, 15]]} {...fine(seed + 21, 0.45)} />
			<C points={[[110, 40], [105, 33], [112, 26], [107, 18]]} {...fine(seed + 22, 0.5)} />
			<O cx={128} cy={94.5} rx={5} ry={2.4} {...fine(seed + 30, 0.4)} />
			<L from={[133, 94]} to={[150, 90]} {...fine(seed + 31, 0.42)} />
		</g>
	);
}

function Clinic({ seed }: { seed: number }) {
	const cx = 86;
	const cy = 48;
	const a = 3.5;
	const l = 9;
	const cross = `M${cx - a} ${cy - l} L${cx + a} ${cy - l} L${cx + a} ${cy - a} L${cx + l} ${cy - a} L${cx + l} ${cy + a} L${cx + a} ${cy + a} L${cx + a} ${cy + l} L${cx - a} ${cy + l} L${cx - a} ${cy + a} L${cx - l} ${cy + a} L${cx - l} ${cy - a} L${cx - a} ${cy - a} Z`;
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={84} cy={50} rx={15} ry={12} seed={seed + 3} />
			<L from={[28, 26]} to={[144, 26]} seed={seed + 15} />
			<B x={32} y={26} w={108} h={78} seed={seed + 11} />
			<Stroke d={cross} tone="ink" width={MAIN} delay={0.3} />
			{[
				[42, 36],
				[110, 36],
				[42, 70],
				[110, 70],
			].map(([x, y], i) => (
				<B key={i} x={x!} y={y!} w={20} h={15} {...fine(seed + 20 + i)} />
			))}
			<B x={64} y={67} w={44} h={4} seed={seed + 18} delay={0.2} />
			<B x={70} y={74} w={32} h={30} seed={seed + 30} delay={0.2} />
			<L from={[86, 74]} to={[86, 104]} {...fine(seed + 31)} />
			<Person x={160} top={56} height={48} seed={seed + 40} hair="short" arms={[[[154, 70], [152, 78]], [[168, 70], [172, 76]]]} />
			<L from={[172, 76]} to={[174, GROUND]} seed={seed + 50} delay={0.35} />
		</g>
	);
}

function Pine({ x, size, seed }: { x: number; size: number; seed: number }) {
	const w = size * 0.32;
	return <Stroke d={`M${x} ${GROUND} L${x} ${GROUND - size * 0.25} M${x - w} ${GROUND - size * 0.25} L${x} ${GROUND - size} L${x + w} ${GROUND - size * 0.25} Z`} tone="graphite" width={DETAIL} delay={0.4 + (seed % 5) * 0.02} />;
}

function Mountains({ seed }: { seed: number }) {
	const ridge: Point[] = [
		[18, GROUND],
		[40, 76],
		[62, 42],
		[90, 72],
		[130, 22],
		[182, GROUND],
	];
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={130} cy={36} seed={seed + 3} />
			{ridge.slice(0, -1).map((from, i) => (
				<L key={i} from={from} to={ridge[i + 1]!} seed={seed + 10 + i} delay={i * 0.03} />
			))}
			<Stroke d="M118.5 40 L123 45 L128 39 L133.5 46 L139 39.5 L141 40" tone="graphite" width={DETAIL} delay={0.3} />
			<Stroke d="M53 56 L57.5 60.5 L62.5 54.5 L67 60 L69 58" tone="graphite" width={DETAIL} delay={0.3} />
			<B x={100} y={82} w={34} h={22} seed={seed + 30} delay={0.45} />
			<Stroke d="M95 83 L117 66 L139 83" tone="ink" width={MAIN} delay={0.5} />
			<B x={113} y={91} w={8} h={13} {...fine(seed + 31, 0.5)} />
			<B x={103} y={88} w={7} h={6} {...fine(seed + 32, 0.5)} />
			<L from={[128, 74.5]} to={[128, 66]} seed={seed + 33} delay={0.5} />
			<L from={[128, 66]} to={[133, 66]} seed={seed + 35} delay={0.5} />
			<L from={[133, 66]} to={[133, 78]} seed={seed + 36} delay={0.5} />
			<C points={[[130.5, 63], [128, 59], [132, 56]]} {...fine(seed + 34, 0.55)} />
			{[
				[38, 9],
				[54, 6.5],
				[150, 7],
				[164, 9],
			].map(([x, r], i) => (
				<g key={x}>
					<Cloud cx={x!} cy={GROUND - 8 - r! * 1.2} rx={r!} ry={r! * 1.25} bumps={5} seed={seed + 40 + i} tone="graphite" width={DETAIL} delay={0.4} />
					<L from={[x!, GROUND - 8 + r! * 0.1]} to={[x!, GROUND]} {...fine(seed + 50 + i, 0.4)} />
				</g>
			))}
		</g>
	);
}

function Office({ seed }: { seed: number }) {
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={154} cy={90} rx={14} ry={9} seed={seed + 3} />
			<B x={36} y={14} w={76} h={90} seed={seed + 10} />
			{[0, 1].flatMap((row) =>
				[0, 1, 2].map((col) => <B key={`${row}${col}`} x={44 + col * 22} y={24 + row * 18} w={15} h={11} {...fine(seed + 20 + row * 3 + col)} />),
			)}
			<O cx={74} cy={66} rx={6.5} seed={seed + 13} delay={0.15} />
			<L from={[74, 66]} to={[74, 62]} {...fine(seed + 14, 0.3)} />
			<L from={[74, 66]} to={[77, 67]} {...fine(seed + 15, 0.3)} />
			<B x={64} y={78} w={20} h={26} seed={seed + 11} delay={0.2} />
			<L from={[74, 78]} to={[74, 104]} {...fine(seed + 12)} />
			<B x={88} y={82} w={16} h={10} {...fine(seed + 16, 0.3)} />
			<L from={[91, 85.5]} to={[101, 85.5]} {...fine(seed + 17, 0.35)} />
			<L from={[91, 88.5]} to={[98, 88.5]} {...fine(seed + 18, 0.35)} />
			<Person x={134} top={48} height={56} seed={seed + 40} hair="short" stride arms={[[[126, 66], [120, 74]], [[144, 70], [150, 82]]]} />
			<Stroke d="M134 64 L132.5 69 L134 73 L135.5 69 Z" tone="ink" width={DETAIL} delay={0.3} />
			<B x={144} y={84} w={22} h={13} seed={seed + 50} delay={0.3} />
			<L from={[144, 89.5]} to={[166, 89.5]} {...fine(seed + 52, 0.35)} />
			<C points={[[151, 84], [152, 81], [158, 81], [159, 84]]} seed={seed + 51} delay={0.35} />
		</g>
	);
}

function Tree({ seed }: { seed: number }) {
	const lobes: Point[] = [];
	const reach = [1.04, 0.93, 1.08, 0.94, 1.0, 0.92, 1.07, 0.95, 1.02, 0.92, 1.06, 0.94, 1.01, 0.93, 1.05, 0.95];
	for (let i = 0; i < reach.length; i++) {
		const angle = (i / reach.length) * Math.PI * 2 - Math.PI / 2;
		lobes.push([80 + Math.cos(angle) * 44 * reach[i]!, 40 + Math.sin(angle) * 28 * reach[i]!]);
	}
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={156} cy={74} rx={10} ry={8} seed={seed + 3} />
			<C points={[[73, GROUND], [76, 90], [77, 66]]} seed={seed + 10} />
			<C points={[[87, GROUND], [84, 90], [83, 66]]} seed={seed + 11} />
			<Stroke d={smoothD(lobes, true)} tone="ink" width={MAIN} delay={0.15} />
			<L from={[124, 88]} to={[176, 88]} seed={seed + 30} delay={0.3} />
			<L from={[128, 72]} to={[138, 72]} {...fine(seed + 31, 0.3)} />
			<L from={[128, 79]} to={[138, 79]} {...fine(seed + 36, 0.3)} />
			<L from={[156, 72]} to={[174, 72]} {...fine(seed + 37, 0.3)} />
			<L from={[156, 79]} to={[174, 79]} {...fine(seed + 38, 0.3)} />
			<L from={[128, 70]} to={[126, 88]} {...fine(seed + 32, 0.35)} />
			<L from={[174, 70]} to={[172, 88]} {...fine(seed + 33, 0.35)} />
			<L from={[126, 88]} to={[124, GROUND]} seed={seed + 34} delay={0.35} />
			<L from={[172, 88]} to={[174, GROUND]} seed={seed + 35} delay={0.35} />
			<Head x={146} cy={56} r={7.5} seed={seed + 50} hair="short" />
			<C points={[[141, 65], [151, 65], [153, 86], [139, 86], [141, 65]]} seed={seed + 54} delay={0.2} />
			<L from={[148, 86]} to={[162, 86]} seed={seed + 55} delay={0.25} />
			<L from={[162, 86]} to={[163, GROUND]} seed={seed + 56} delay={0.27} />
			<L from={[163, GROUND]} to={[168, GROUND]} seed={seed + 57} delay={0.3} />
			<Stroke d="M150 76 L156 72 L162 76 L162 81 L156 78 L150 81 Z" tone="ink" width={DETAIL} delay={0.35} />
			<L from={[156, 72]} to={[156, 78]} {...fine(seed + 59, 0.4)} />
			<C points={[[142, 69], [146, 77], [150, 79]]} seed={seed + 60} delay={0.25} />
			{[30, 104].map((x, i) => (
				<Stroke key={x} d={`M${x - 4} ${GROUND} L${x - 5} ${GROUND - 6} M${x} ${GROUND} L${x} ${GROUND - 8} M${x + 4} ${GROUND} L${x + 5} ${GROUND - 6}`} tone="graphite" width={DETAIL} delay={0.45 + i * 0.03} />
			))}
		</g>
	);
}

function Home({ seed }: { seed: number }) {
	return (
		<g>
			<Ground seed={seed} />
			<Highlight cx={81} cy={66} rx={13} ry={10} seed={seed + 3} />
			<L from={[56, 52]} to={[100, 20]} seed={seed + 10} />
			<L from={[100, 20]} to={[144, 52]} seed={seed + 11} />
			<B x={64} y={48} w={72} h={56} seed={seed + 12} />
			<L from={[122, 36]} to={[122, 20]} seed={seed + 13} />
			<L from={[122, 20]} to={[132, 20]} seed={seed + 14} />
			<L from={[132, 20]} to={[132, 43]} seed={seed + 15} />
			<C points={[[127, 16], [122, 11], [130, 7], [126, 2]]} {...fine(seed + 16, 0.5)} />
			{[72, 110].map((x, i) => (
				<g key={x}>
					<B x={x} y={58} w={18} h={16} {...fine(seed + 20 + i * 3)} />
					<L from={[x + 9, 58]} to={[x + 9, 74]} {...fine(seed + 21 + i * 3)} />
					<L from={[x, 66]} to={[x + 18, 66]} {...fine(seed + 22 + i * 3)} />
				</g>
			))}
			<B x={92} y={72} w={16} h={32} seed={seed + 30} delay={0.2} />
			<O cx={104} cy={89} rx={1.2} {...fine(seed + 31, 0.4)} />
			<B x={70} y={75} w={22} h={5} seed={seed + 35} delay={0.3} />
			{[74, 81, 88].map((fx, i) => (
				<g key={fx}>
					<L from={[fx, 75]} to={[fx, 70]} {...fine(seed + 36 + i, 0.45)} />
					<Dots points={[[fx, 69]]} />
				</g>
			))}
			<C points={[[18, GROUND], [16, 92], [24, 82], [36, 80], [48, 84], [52, 94], [50, GROUND]]} seed={seed + 40} tone="graphite" width={DETAIL} delay={0.3} />
		</g>
	);
}

const SCENES: Record<CoverMotif, (props: { seed: number }) => React.ReactElement> = {
	market: Market,
	friends: Friends,
	train: Train,
	cup: Cup,
	clinic: Clinic,
	mountains: Mountains,
	office: Office,
	tree: Tree,
	home: Home,
};

export function CoverScene({ motif, seed, className }: { motif: CoverMotif; seed: number; sun?: boolean; className?: string }) {
	const Scene = SCENES[motif];
	return (
		<svg viewBox="0 0 200 120" className={className} aria-hidden="true">
			<Scene seed={seed} />
		</svg>
	);
}
