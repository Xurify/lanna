import { Stroke, type InkTone } from "@/components/lesson/ink";
import { boxD, curveD, inkRandom, lineD, loopD, patchD, smoothD, type Point } from "@/components/lesson/ink-paths";
import type { CoverMotif } from "@/src/core";

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

function Cloud({
	cx,
	cy,
	rx,
	ry,
	bumps,
	seed,
	...pen
}: Omit<Pen, "seed"> & { cx: number; cy: number; rx: number; ry: number; bumps: number; seed: number }) {
	const points: Point[] = [];
	for (let i = 0; i < bumps * 2; i++) {
		const angle = (i / (bumps * 2)) * Math.PI * 2 - Math.PI / 2;
		const reach = i % 2 === 0 ? 1.08 : 0.9;
		points.push([cx + Math.cos(angle) * rx * reach, cy + Math.sin(angle) * ry * reach]);
	}
	return <Stroke d={smoothD(points, true)} {...outline({ seed, ...pen })} />;
}

function Ground({ seed, from = 14, to = 186 }: { seed: number; from?: number; to?: number }) {
	return (
		<C
			points={[
				[from, GROUND + 1],
				[70, GROUND - 1],
				[130, GROUND + 1],
				[to, GROUND - 0.5],
			]}
			seed={seed}
			tone="soft"
			width={DETAIL}
		/>
	);
}

function Highlight({
	cx,
	cy,
	rx = 17,
	ry = 11,
	seed,
}: {
	cx: number;
	cy: number;
	rx?: number;
	ry?: number;
	seed: number;
}) {
	return (
		<path
			d={patchD(cx, cy, rx, ry, seed)}
			className="ink-fade q-ink-patch"
			style={{ "--ink-delay": "0.5s" } as React.CSSProperties}
		/>
	);
}

type Hue = "ochre" | "rose" | "sage" | "sky";
const HUES: readonly Hue[] = ["ochre", "rose", "sage", "sky"];
const hueFor = (seed: number, shift = 0): Hue => HUES[(Math.floor(seed / 2) + shift) % HUES.length]!;

function Wash({
	cx,
	cy,
	rx,
	ry,
	hue,
	seed,
}: {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	hue: Hue;
	seed: number;
}) {
	return (
		<path
			d={patchD(cx + 1.5, cy + 1.5, rx, ry, seed)}
			className={`ink-fade q-wash-${hue}`}
			style={{ "--ink-delay": "0.45s" } as React.CSSProperties}
		/>
	);
}

function WashBox({ x, y, w, h, hue, seed }: { x: number; y: number; w: number; h: number; hue: Hue; seed: number }) {
	const random = inkRandom(seed);
	const j = () => (random() - 0.5) * 6;
	const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2 + j(), (a[1] + b[1]) / 2 + j()];
	const corners: Point[] = [
		[x + 4 + j(), y + 3 + j()],
		[x + w + 3 + j(), y + 4 + j()],
		[x + w + 2 + j(), y + h + 2 + j()],
		[x + 3 + j(), y + h + 1 + j()],
	];
	const points = corners.flatMap((c, i) => [c, mid(c, corners[(i + 1) % 4]!)]);
	const d = smoothD(points, true);
	return <path d={d} className={`ink-fade q-wash-${hue}`} style={{ "--ink-delay": "0.45s" } as React.CSSProperties} />;
}

function WashPath({ d, hue }: { d: string; hue: Hue }) {
	return (
		<path
			d={d}
			transform="translate(1.5 1.5)"
			className={`ink-fade q-wash-${hue}`}
			style={{ "--ink-delay": "0.45s" } as React.CSSProperties}
		/>
	);
}

function Hatch({
	x,
	y,
	w,
	h,
	seed,
	gap = 4,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	seed: number;
	gap?: number;
}) {
	const lines: Array<[Point, Point]> = [];
	for (let k = gap; k < w + h; k += gap) {
		const from: Point = [x + Math.max(0, k - h), y + Math.min(h, k)];
		const to: Point = [x + Math.min(w, k), y + Math.max(0, k - w)];
		lines.push([from, to]);
	}
	return (
		<>
			{lines.map(([from, to], i) => (
				<Stroke key={i} d={lineD(from, to, seed + i, 0.4)} tone="soft" width={0.8} delay={0.5} />
			))}
		</>
	);
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
			<Dots
				points={[
					[x - r * 0.38, cy - r * 0.05],
					[x + r * 0.38, cy - r * 0.05],
				]}
			/>
			<C
				points={[
					[x - r * 0.38, cy + r * 0.4],
					[x, cy + r * 0.6],
					[x + r * 0.38, cy + r * 0.4],
				]}
				{...fine(seed + 1, 0.3)}
			/>
			{hair === "short" && (
				<C
					points={[
						[x - r * 0.98, cy - r * 0.15],
						[x - r * 0.6, cy - r * 1.02],
						[x + r * 0.4, cy - r * 1.04],
						[x + r * 0.98, cy - r * 0.3],
					]}
					seed={seed + 2}
					delay={0.1}
				/>
			)}
			{hair === "bun" && (
				<>
					<O cx={x + r * 0.15} cy={cy - r * 1.3} rx={r * 0.42} seed={seed + 2} delay={0.1} />
					<C
						points={[
							[x - r * 0.98, cy - r * 0.1],
							[x - r * 0.4, cy - r * 0.95],
							[x + r * 0.6, cy - r * 0.9],
							[x + r * 0.98, cy - r * 0.1],
						]}
						seed={seed + 3}
						delay={0.1}
					/>
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
			<C
				points={[
					[x - half * 0.7, neck],
					[x + half * 0.7, neck],
					[x + half, neck + 4],
					[x + wide, hem],
					[x - wide, hem],
					[x - half, neck + 4],
					[x - half * 0.7, neck],
				]}
				seed={seed + 4}
				delay={0.1}
			/>
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
			<WashPath d="M50 18 L150 18 L156 34 L44 34 Z" hue={hueFor(seed)} />
			<Wash cx={70} cy={62} rx={16} ry={13} hue="rose" seed={seed + 90} />
			<Wash cx={120} cy={67} rx={20} ry={7} hue="ochre" seed={seed + 91} />
			<Hatch x={46} y={82} w={108} h={20} seed={seed + 92} gap={9} />
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
			<C
				points={[
					[71, 45.5],
					[75.5, 43],
					[78, 45.5],
					[72.5, 47],
				]}
				{...fine(seed + 61, 0.55)}
			/>
			<C
				points={[
					[100, 72],
					[108, 64],
					[126, 60],
					[140, 62],
					[134, 70],
					[114, 74],
					[100, 72],
				]}
				seed={seed + 33}
				delay={0.4}
			/>
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

const BUBBLE: readonly Point[] = [
	[106, 12],
	[120, 7],
	[142, 8],
	[150, 16],
	[144, 25],
	[124, 27],
	[112, 34],
	[115, 26],
	[106, 21],
	[106, 12],
];

function Friends({ seed }: { seed: number }) {
	return (
		<g>
			<WashPath d="M84 32 C78 50 70 70 64 92 C76 96 92 96 104 92 C98 70 90 50 86 32 Z" hue="ochre" />
			<WashBox x={102} y={56} w={16} h={26} hue={hueFor(seed)} seed={seed + 91} />
			<Wash cx={160} cy={76} rx={12} ry={16} hue={hueFor(seed, 1)} seed={seed + 92} />
			<Ground seed={seed} />
			<L from={[72, GROUND]} to={[72, 34]} seed={seed + 1} />
			<C
				points={[
					[72, 34],
					[76, 26],
					[86, 24],
				]}
				seed={seed + 2}
			/>
			<Stroke d="M81 25 L91 25 L88 32 L84 32 Z" tone="ink" width={MAIN} delay={0.1} />
			<path
				d={curveD(BUBBLE, seed + 7, 0.5)}
				className="ink-fade q-ink-patch"
				style={{ "--ink-delay": "0.35s" } as React.CSSProperties}
			/>
			<C points={BUBBLE} seed={seed + 7} delay={0.4} />
			<text
				x={128}
				y={21}
				textAnchor="middle"
				transform="rotate(-4 128 18)"
				className="ink-fade fill-current font-prose text-foreground"
				style={{ fontSize: 11.5, fontWeight: 550, "--ink-delay": "0.55s" } as React.CSSProperties}
			>
				Ahoj!
			</text>
			<Person
				x={110}
				top={42}
				height={62}
				seed={seed + 10}
				hair="short"
				arms={[
					[
						[102, 64],
						[100, 76],
					],
					[
						[124, 52],
						[122, 40],
					],
				]}
			/>
			<C
				points={[
					[126, 37],
					[129, 40],
					[128, 44],
				]}
				{...fine(seed + 30, 0.45)}
			/>
			<Person
				x={160}
				top={42}
				height={62}
				seed={seed + 20}
				hair="bun"
				dress
				arms={[
					[
						[146, 54],
						[144, 42],
					],
					[
						[168, 66],
						[170, 78],
					],
				]}
			/>
			<C
				points={[
					[140, 40],
					[137, 43],
					[138, 47],
				]}
				{...fine(seed + 31, 0.45)}
			/>
		</g>
	);
}

function Train({ seed }: { seed: number }) {
	return (
		<g>
			<WashBox x={44} y={36} w={124} h={42} hue={hueFor(seed)} seed={seed + 90} />
			<Hatch x={46} y={68} w={64} h={9} seed={seed + 91} gap={8} />
			<Highlight cx={154} cy={56} rx={12} ry={9} seed={seed + 3} />
			{[48, 58, 68].map((y, i) => (
				<L key={y} from={[26 + i * 3, y]} to={[40, y]} {...fine(seed + 60 + i, 0.5)} />
			))}
			<L from={[44, 36]} to={[144, 36]} seed={seed + 10} />
			<L from={[44, 36]} to={[44, 78]} seed={seed + 11} />
			<L from={[44, 78]} to={[166, 78]} seed={seed + 12} />
			<C
				points={[
					[144, 36],
					[156, 41],
					[165, 59],
					[166, 78],
				]}
				seed={seed + 13}
			/>
			<C
				points={[
					[147, 42],
					[156, 47],
					[160, 58],
					[147, 58],
					[147, 42],
				]}
				{...fine(seed + 14)}
			/>
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
			<L from={[178, GROUND]} to={[178, 62]} {...fine(seed + 70, 0.4)} />
			<B x={170} y={54} w={18} h={9} seed={seed + 71} delay={0.45} />
			<L from={[174, 58.5]} to={[184, 58.5]} {...fine(seed + 72, 0.5)} />
			<C
				points={[
					[24, 92],
					[80, 91.5],
					[140, 92.3],
					[178, 91.8],
				]}
				seed={seed + 40}
			/>
			<C
				points={[
					[24, 101],
					[80, 100.5],
					[140, 101.3],
					[178, 100.8],
				]}
				seed={seed + 41}
				tone="graphite"
				width={DETAIL}
			/>
			{Array.from({ length: 8 }, (_, i) => (
				<L key={i} from={[32 + i * 20, 92]} to={[32 + i * 20, 101]} {...fine(seed + 42 + i, 0.4)} />
			))}
		</g>
	);
}

function Cup({ seed }: { seed: number }) {
	return (
		<g>
			<WashPath d="M68 52 C70 76 82 90 98 92 C114 90 126 76 128 52 Z" hue={hueFor(seed)} />
			<Wash cx={98} cy={96} rx={46} ry={4} hue="sky" seed={seed + 90} />
			<L from={[22, 100]} to={[178, 100]} seed={seed} />
			<L from={[34, 100]} to={[34, 114]} seed={seed + 1} />
			<L from={[166, 100]} to={[166, 114]} seed={seed + 2} />
			<path
				d={loopD(98, 50, 29, 4.6, seed + 12)}
				className="ink-fade q-ink-patch"
				style={{ "--ink-delay": "0.4s" } as React.CSSProperties}
			/>
			<O cx={98} cy={95} rx={50} ry={5} seed={seed + 10} />
			<C
				points={[
					[68, 50],
					[70, 76],
					[82, 90],
					[98, 92],
					[114, 90],
					[126, 76],
					[128, 50],
				]}
				seed={seed + 11}
			/>
			<O cx={98} cy={50} rx={30} ry={5} seed={seed + 12} />
			<C
				points={[
					[127, 58],
					[142, 57],
					[145, 69],
					[137, 79],
					[123, 79],
				]}
				seed={seed + 13}
			/>
			<C
				points={[
					[86, 40],
					[81, 33],
					[88, 26],
					[83, 18],
				]}
				{...fine(seed + 20, 0.4)}
			/>
			<C
				points={[
					[98, 40],
					[93, 32],
					[100, 24],
					[95, 15],
				]}
				{...fine(seed + 21, 0.45)}
			/>
			<C
				points={[
					[110, 40],
					[105, 33],
					[112, 26],
					[107, 18],
				]}
				{...fine(seed + 22, 0.5)}
			/>
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
			<WashBox x={32} y={26} w={108} h={78} hue={hueFor(seed)} seed={seed + 90} />
			<WashBox x={70} y={74} w={32} h={30} hue="ochre" seed={seed + 91} />
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
			<Person
				x={160}
				top={56}
				height={48}
				seed={seed + 40}
				hair="short"
				arms={[
					[
						[154, 70],
						[152, 78],
					],
					[
						[168, 70],
						[172, 76],
					],
				]}
			/>
			<L from={[173, 72]} to={[174, GROUND]} seed={seed + 50} delay={0.35} />
			<C
				points={[
					[173, 72],
					[174, 67],
					[179, 67],
					[179, 71],
				]}
				seed={seed + 51}
				delay={0.4}
			/>
		</g>
	);
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
			<Wash cx={62} cy={78} rx={34} ry={22} hue="sky" seed={seed + 93} />
			<Wash cx={134} cy={64} rx={36} ry={32} hue="sky" seed={seed + 94} />
			<WashPath d="M94 104 L114 62 L134 104 Z" hue={hueFor(seed)} />
			<Ground seed={seed} />
			<Highlight cx={130} cy={36} seed={seed + 3} />
			{ridge.slice(0, -1).map((from, i) => (
				<L key={i} from={from} to={ridge[i + 1]!} seed={seed + 10 + i} delay={i * 0.03} />
			))}
			<Stroke d="M118.5 40 L123 45 L128 39 L133.5 46 L139 39.5 L141 40" tone="graphite" width={DETAIL} delay={0.3} />
			<Stroke d="M53 56 L57.5 60.5 L62.5 54.5 L67 60 L69 58" tone="graphite" width={DETAIL} delay={0.3} />
			<Stroke d="M92 104 L114 60 L136 104" tone="ink" width={MAIN} delay={0.45} />
			<L from={[100, 88]} to={[128, 88]} {...fine(seed + 31, 0.5)} />
			<B x={109} y={92} w={10} h={12} seed={seed + 32} delay={0.5} />
			<B x={110} y={72} w={8} h={8} {...fine(seed + 33, 0.5)} />
			<L from={[114, 72]} to={[114, 80]} {...fine(seed + 34, 0.55)} />
			{[
				[38, 9],
				[54, 6.5],
				[150, 7],
				[164, 9],
			].map(([x, r], i) => (
				<g key={x}>
					<Cloud
						cx={x!}
						cy={GROUND - 8 - r! * 1.2}
						rx={r!}
						ry={r! * 1.25}
						bumps={5}
						seed={seed + 40 + i}
						tone="graphite"
						width={DETAIL}
						delay={0.4}
					/>
					<L from={[x!, GROUND - 8 + r! * 0.1]} to={[x!, GROUND]} {...fine(seed + 50 + i, 0.4)} />
				</g>
			))}
		</g>
	);
}

function Office({ seed }: { seed: number }) {
	return (
		<g>
			<WashBox x={36} y={14} w={76} h={90} hue={hueFor(seed)} seed={seed + 90} />
			<WashBox x={144} y={84} w={22} h={13} hue="ochre" seed={seed + 91} />
			<Ground seed={seed} />
			<Highlight cx={154} cy={90} rx={14} ry={9} seed={seed + 3} />
			<B x={36} y={14} w={76} h={90} seed={seed + 10} />
			{[0, 1].flatMap((row) =>
				[0, 1, 2].map((col) => (
					<B
						key={`${row}${col}`}
						x={44 + col * 22}
						y={24 + row * 18}
						w={15}
						h={11}
						{...fine(seed + 20 + row * 3 + col)}
					/>
				)),
			)}
			<O cx={74} cy={66} rx={6.5} seed={seed + 13} delay={0.15} />
			<L from={[74, 66]} to={[74, 62]} {...fine(seed + 14, 0.3)} />
			<L from={[74, 66]} to={[77, 67]} {...fine(seed + 15, 0.3)} />
			<B x={64} y={78} w={20} h={26} seed={seed + 11} delay={0.2} />
			<L from={[74, 78]} to={[74, 104]} {...fine(seed + 12)} />
			<B x={88} y={82} w={16} h={10} {...fine(seed + 16, 0.3)} />
			<L from={[91, 85.5]} to={[101, 85.5]} {...fine(seed + 17, 0.35)} />
			<L from={[91, 88.5]} to={[98, 88.5]} {...fine(seed + 18, 0.35)} />
			<Person
				x={134}
				top={48}
				height={56}
				seed={seed + 40}
				hair="short"
				stride
				arms={[
					[
						[126, 66],
						[120, 74],
					],
					[
						[144, 70],
						[150, 82],
					],
				]}
			/>
			<Stroke d="M134 64 L132.5 69 L134 73 L135.5 69 Z" tone="ink" width={DETAIL} delay={0.3} />
			<B x={144} y={84} w={22} h={13} seed={seed + 50} delay={0.3} />
			<L from={[144, 89.5]} to={[166, 89.5]} {...fine(seed + 52, 0.35)} />
			<C
				points={[
					[151, 84],
					[152, 81],
					[158, 81],
					[159, 84],
				]}
				seed={seed + 51}
				delay={0.35}
			/>
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
			<Wash cx={82} cy={40} rx={40} ry={24} hue="sage" seed={seed + 90} />
			<WashBox x={124} y={80} w={52} h={8} hue="ochre" seed={seed + 91} />
			<Wash cx={146} cy={76} rx={7} ry={11} hue={hueFor(seed)} seed={seed + 92} />
			<Ground seed={seed} />
			<Highlight cx={156} cy={74} rx={10} ry={8} seed={seed + 3} />
			<C
				points={[
					[73, GROUND],
					[76, 90],
					[77, 66],
				]}
				seed={seed + 10}
			/>
			<C
				points={[
					[87, GROUND],
					[84, 90],
					[83, 66],
				]}
				seed={seed + 11}
			/>
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
			<C
				points={[
					[141, 65],
					[151, 65],
					[153, 86],
					[139, 86],
					[141, 65],
				]}
				seed={seed + 54}
				delay={0.2}
			/>
			<L from={[148, 86]} to={[162, 86]} seed={seed + 55} delay={0.25} />
			<L from={[162, 86]} to={[163, GROUND]} seed={seed + 56} delay={0.27} />
			<L from={[163, GROUND]} to={[168, GROUND]} seed={seed + 57} delay={0.3} />
			<Stroke d="M146 74 L156 70 L166 74 L166 82 L156 78 L146 82 Z" tone="ink" width={MAIN} delay={0.35} />
			<L from={[156, 70]} to={[156, 78]} {...fine(seed + 59, 0.4)} />
			<C
				points={[
					[142, 69],
					[146, 77],
					[150, 79],
				]}
				seed={seed + 60}
				delay={0.25}
			/>
			{[30, 104].map((x, i) => (
				<Stroke
					key={x}
					d={`M${x - 4} ${GROUND} L${x - 5} ${GROUND - 6} M${x} ${GROUND} L${x} ${GROUND - 8} M${x + 4} ${GROUND} L${x + 5} ${GROUND - 6}`}
					tone="graphite"
					width={DETAIL}
					delay={0.45 + i * 0.03}
				/>
			))}
		</g>
	);
}

function Home({ seed }: { seed: number }) {
	return (
		<g>
			<WashPath d="M56 52 L100 20 L144 52 Z" hue="rose" />
			<WashBox x={64} y={48} w={72} h={56} hue={hueFor(seed, 1)} seed={seed + 90} />
			<Wash cx={34} cy={92} rx={16} ry={10} hue="sage" seed={seed + 91} />
			<Ground seed={seed} />
			<Highlight cx={81} cy={66} rx={13} ry={10} seed={seed + 3} />
			<L from={[56, 52]} to={[100, 20]} seed={seed + 10} />
			<L from={[100, 20]} to={[144, 52]} seed={seed + 11} />
			<B x={64} y={48} w={72} h={56} seed={seed + 12} />
			<L from={[122, 36]} to={[122, 20]} seed={seed + 13} />
			<L from={[122, 20]} to={[132, 20]} seed={seed + 14} />
			<L from={[132, 20]} to={[132, 43]} seed={seed + 15} />
			<C
				points={[
					[127, 16],
					[122, 11],
					[130, 7],
					[126, 2],
				]}
				{...fine(seed + 16, 0.5)}
			/>
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
			<C
				points={[
					[18, GROUND],
					[16, 92],
					[24, 82],
					[36, 80],
					[48, 84],
					[52, 94],
					[50, GROUND],
				]}
				seed={seed + 40}
				tone="graphite"
				width={DETAIL}
				delay={0.3}
			/>
		</g>
	);
}

function Heart({
	cx,
	cy,
	size,
	seed,
	tone = "ink",
	width = MAIN,
}: {
	cx: number;
	cy: number;
	size: number;
	seed: number;
	tone?: InkTone;
	width?: number;
}) {
	const k = size / 10;
	return (
		<Stroke
			d={`M${cx} ${cy + 8 * k} C${cx - 12 * k} ${cy} ${cx - 9 * k} ${cy - 9 * k} ${cx} ${cy - 3 * k} C${cx + 9 * k} ${cy - 9 * k} ${cx + 12 * k} ${cy} ${cx} ${cy + 8 * k} Z`}
			tone={tone}
			width={width}
			delay={0.3 + (seed % 3) * 0.02}
		/>
	);
}

function Table({ seed }: { seed: number }) {
	const glass = (x: number, tilt: number, s: number) => (
		<g key={x}>
			<C
				points={[
					[x - 8 + tilt, 40],
					[x - 7 + tilt * 0.6, 52],
					[x, 57],
					[x + 7 + tilt * 0.6, 52],
					[x + 8 + tilt, 40],
				]}
				seed={s}
			/>
			<L from={[x - 8 + tilt, 40]} to={[x + 8 + tilt, 40]} seed={s + 1} />
			<L from={[x, 57]} to={[x, 71]} seed={s + 2} />
			<L from={[x - 6, 72]} to={[x + 6, 72]} seed={s + 3} />
			<C
				points={[
					[x - 6 + tilt * 0.8, 47],
					[x, 48.5],
					[x + 6 + tilt * 0.8, 47],
				]}
				{...fine(s + 4, 0.35)}
			/>
		</g>
	);
	return (
		<g>
			<WashBox x={40} y={74} w={120} h={10} hue={hueFor(seed)} seed={seed + 90} />
			<Wash cx={88} cy={50} rx={6} ry={5} hue="rose" seed={seed + 91} />
			<Wash cx={112} cy={50} rx={6} ry={5} hue="rose" seed={seed + 92} />
			<Wash cx={138} cy={48} rx={4} ry={6} hue="ochre" seed={seed + 93} />
			<Ground seed={seed} />
			<Highlight cx={100} cy={46} rx={22} ry={11} seed={seed + 3} />
			<L from={[40, 74]} to={[160, 74]} seed={seed + 10} />
			<L from={[50, 74]} to={[50, GROUND]} seed={seed + 11} />
			<L from={[150, 74]} to={[150, GROUND]} seed={seed + 12} />
			{glass(88, 3, seed + 20)}
			{glass(112, -3, seed + 30)}
			<L from={[96, 30]} to={[94, 24]} {...fine(seed + 40, 0.5)} />
			<L from={[100, 29]} to={[100, 22]} {...fine(seed + 41, 0.5)} />
			<L from={[104, 30]} to={[106, 24]} {...fine(seed + 42, 0.5)} />
			<B x={134} y={56} w={8} h={18} seed={seed + 43} delay={0.3} />
			<C
				points={[
					[138, 54],
					[134.5, 49],
					[138, 42],
					[141.5, 49],
					[138, 54],
				]}
				{...fine(seed + 44, 0.4)}
			/>
			<O cx={62} cy={71.5} rx={13} ry={2.6} seed={seed + 45} delay={0.3} />
			<L from={[27, 60]} to={[28, GROUND]} seed={seed + 50} delay={0.2} />
			<L from={[28, 82]} to={[44, 82]} seed={seed + 51} delay={0.2} />
			<L from={[44, 82]} to={[44, GROUND]} seed={seed + 52} delay={0.2} />
			<L from={[173, 60]} to={[172, GROUND]} seed={seed + 53} delay={0.2} />
			<L from={[172, 82]} to={[156, 82]} seed={seed + 54} delay={0.2} />
			<L from={[156, 82]} to={[156, GROUND]} seed={seed + 55} delay={0.2} />
		</g>
	);
}

function Bike({ seed }: { seed: number }) {
	const rear: Point = [62, 82];
	const front: Point = [138, 82];
	const crank: Point = [96, 84];
	const seatTop: Point = [86, 54];
	const head: Point = [126, 56];
	return (
		<g>
			<Wash cx={150} cy={59} rx={12} ry={7} hue="ochre" seed={seed + 90} />
			<Wash cx={151} cy={40} rx={7} ry={4} hue="rose" seed={seed + 91} />
			<Ground seed={seed} />
			<Highlight cx={150} cy={52} rx={14} ry={9} seed={seed + 3} />
			<O cx={rear[0]} cy={rear[1]} rx={20} seed={seed + 10} />
			<O cx={front[0]} cy={front[1]} rx={20} seed={seed + 11} />
			<O cx={rear[0]} cy={rear[1]} rx={2} {...fine(seed + 12, 0.3)} />
			<O cx={front[0]} cy={front[1]} rx={2} {...fine(seed + 13, 0.3)} />
			<L from={rear} to={crank} seed={seed + 14} delay={0.15} />
			<L from={rear} to={[88, 60]} seed={seed + 15} delay={0.15} />
			<L from={seatTop} to={crank} seed={seed + 16} delay={0.15} />
			<L from={[88, 60]} to={[124, 62]} seed={seed + 17} delay={0.2} />
			<L from={head} to={crank} seed={seed + 18} delay={0.2} />
			<L from={head} to={front} seed={seed + 19} delay={0.2} />
			<L from={[80, 52]} to={[94, 52]} seed={seed + 20} delay={0.25} />
			<L from={head} to={[124, 46]} seed={seed + 21} delay={0.25} />
			<C
				points={[
					[116, 47],
					[124, 45],
					[132, 43],
				]}
				seed={seed + 22}
				delay={0.25}
			/>
			<O cx={crank[0]} cy={crank[1]} rx={4} {...fine(seed + 23, 0.3)} />
			<L from={crank} to={[104, 94]} {...fine(seed + 24, 0.3)} />
			<L from={[100, 94]} to={[108, 94]} {...fine(seed + 25, 0.3)} />
			<Stroke d="M138 52 L162 52 L158 66 L142 66 Z" tone="ink" width={MAIN} delay={0.35} />
			<L from={[142, 58]} to={[160, 58]} {...fine(seed + 26, 0.4)} />
			<L from={[132, 56]} to={[140, 56]} {...fine(seed + 27, 0.4)} />
			{[148, 154].map((x, i) => (
				<g key={x}>
					<L from={[x, 52]} to={[x + 2, 42]} {...fine(seed + 30 + i, 0.45)} />
					<O cx={x + 2} cy={40} rx={2.6} {...fine(seed + 32 + i, 0.5)} />
				</g>
			))}
			{[24, 176].map((x, i) => (
				<Stroke
					key={x}
					d={`M${x - 4} ${GROUND} L${x - 5} ${GROUND - 6} M${x} ${GROUND} L${x} ${GROUND - 8} M${x + 4} ${GROUND} L${x + 5} ${GROUND - 6}`}
					tone="graphite"
					width={DETAIL}
					delay={0.45 + i * 0.03}
				/>
			))}
		</g>
	);
}

function Family({ seed }: { seed: number }) {
	return (
		<g>
			<WashBox x={54} y={56} w={16} h={26} hue={hueFor(seed)} seed={seed + 90} />
			<Wash cx={100} cy={80} rx={9} ry={11} hue={hueFor(seed, 1)} seed={seed + 91} />
			<Wash cx={138} cy={78} rx={12} ry={16} hue={hueFor(seed, 2)} seed={seed + 92} />
			<Ground seed={seed} />
			<Highlight cx={100} cy={30} rx={13} ry={10} seed={seed + 3} />
			<Person
				x={62}
				top={38}
				height={66}
				seed={seed + 10}
				hair="short"
				arms={[
					[
						[52, 64],
						[50, 78],
					],
					[
						[76, 68],
						[86, 74],
					],
				]}
			/>
			<Person
				x={100}
				top={54}
				height={50}
				seed={seed + 20}
				hair="bun"
				dress
				arms={[
					[
						[92, 68],
						[86, 74],
					],
					[
						[108, 68],
						[114, 74],
					],
				]}
			/>
			<Person
				x={138}
				top={40}
				height={64}
				seed={seed + 30}
				hair="bun"
				dress
				arms={[
					[
						[126, 68],
						[114, 74],
					],
					[
						[150, 64],
						[152, 78],
					],
				]}
			/>
			<Heart cx={100} cy={30} size={13} seed={seed + 40} />
		</g>
	);
}

function Plate({ seed }: { seed: number }) {
	return (
		<g>
			<WashPath d="M58 66 C62 88 80 98 100 98 C120 98 138 88 142 66 Z" hue={hueFor(seed)} />
			<WashBox x={146} y={84} w={30} h={14} hue="ochre" seed={seed + 90} />
			<L from={[18, 100]} to={[182, 100]} seed={seed} tone="soft" width={DETAIL} />
			<path
				d={loopD(100, 66, 40, 6, seed + 10)}
				className="ink-fade q-ink-patch"
				style={{ "--ink-delay": "0.4s" } as React.CSSProperties}
			/>
			<C
				points={[
					[60, 66],
					[64, 86],
					[80, 96],
					[100, 98],
					[120, 96],
					[136, 86],
					[140, 66],
				]}
				seed={seed + 11}
			/>
			<O cx={100} cy={66} rx={40} ry={6} seed={seed + 10} />
			<L from={[84, 99]} to={[116, 99]} seed={seed + 12} />
			<L from={[118, 66]} to={[138, 36]} seed={seed + 13} delay={0.3} />
			<O cx={140} cy={32} rx={4} ry={6} seed={seed + 14} delay={0.35} />
			<C
				points={[
					[84, 56],
					[80, 48],
					[86, 40],
					[82, 32],
				]}
				{...fine(seed + 20, 0.45)}
			/>
			<C
				points={[
					[98, 56],
					[94, 48],
					[100, 40],
					[96, 32],
				]}
				{...fine(seed + 21, 0.5)}
			/>
			<C
				points={[
					[146, 98],
					[146, 88],
					[160, 82],
					[176, 88],
					[176, 98],
				]}
				seed={seed + 30}
				delay={0.3}
			/>
			<L from={[146, 98]} to={[176, 98]} seed={seed + 31} delay={0.3} />
			<L from={[154, 90]} to={[158, 85]} {...fine(seed + 32, 0.45)} />
			<L from={[162, 90]} to={[166, 85]} {...fine(seed + 33, 0.45)} />
		</g>
	);
}

function Books({ seed }: { seed: number }) {
	const book = (x: number, y: number, w: number, s: number) => (
		<g key={s}>
			<B x={x} y={y} w={w} h={13} seed={s} />
			<L from={[x + 8, y]} to={[x + 8, y + 13]} {...fine(s + 1)} />
			<L from={[x + w - 6, y + 4]} to={[x + w + 2, y + 4]} {...fine(s + 2, 0.3)} />
			<L from={[x + w - 6, y + 9]} to={[x + w + 2, y + 9]} {...fine(s + 3, 0.3)} />
		</g>
	);
	return (
		<g>
			<WashBox x={48} y={87} w={76} h={13} hue="rose" seed={seed + 90} />
			<WashBox x={56} y={74} w={64} h={13} hue="sky" seed={seed + 91} />
			<WashBox x={44} y={61} w={70} h={13} hue="sage" seed={seed + 92} />
			<WashPath d="M152 52 L172 46 L180 60 L160 66 Z" hue="ochre" />
			<WashPath d="M162 64 L176 60 L132 92 L112 74 Z" hue="ochre" />
			<L from={[18, 100]} to={[182, 100]} seed={seed} tone="soft" width={DETAIL} />
			<Highlight cx={86} cy={50} rx={20} ry={8} seed={seed + 3} />
			{book(48, 87, 76, seed + 10)}
			{book(56, 74, 64, seed + 20)}
			{book(44, 61, 70, seed + 30)}
			<Stroke d="M60 56 L86 50 L112 56 L112 59 L86 54 L60 59 Z" tone="ink" width={MAIN} delay={0.35} />
			<L from={[86, 50]} to={[86, 54]} {...fine(seed + 40, 0.4)} />
			<L from={[66, 55]} to={[80, 52]} {...fine(seed + 41, 0.45)} />
			<L from={[92, 52]} to={[106, 55]} {...fine(seed + 42, 0.45)} />
			<O cx={156} cy={98} rx={13} ry={2.5} seed={seed + 50} delay={0.2} />
			<C
				points={[
					[156, 97],
					[150, 72],
					[162, 54],
				]}
				seed={seed + 51}
				delay={0.25}
			/>
			<Stroke d="M152 52 L172 46 L180 60 L160 66 Z" tone="ink" width={MAIN} delay={0.3} />
		</g>
	);
}

function City({ seed }: { seed: number }) {
	return (
		<g>
			<WashBox x={20} y={56} w={26} h={48} hue="rose" seed={seed + 90} />
			<WashBox x={46} y={40} w={22} h={64} hue="sky" seed={seed + 91} />
			<WashBox x={146} y={48} w={34} h={56} hue={hueFor(seed)} seed={seed + 92} />
			<WashPath d="M100 52 L66 52 L58 59 L66 66 L100 66 Z" hue="ochre" />
			<Ground seed={seed} />
			<Highlight cx={128} cy={38} rx={20} ry={9} seed={seed + 3} />
			<B x={20} y={56} w={26} h={48} seed={seed + 10} tone="graphite" width={DETAIL} />
			<B x={46} y={40} w={22} h={64} seed={seed + 11} tone="graphite" width={DETAIL} />
			<B x={146} y={48} w={34} h={56} seed={seed + 12} tone="graphite" width={DETAIL} />
			{[
				[26, 64],
				[35, 64],
				[26, 78],
				[35, 78],
				[51, 48],
				[59, 48],
				[51, 62],
				[59, 62],
				[154, 56],
				[168, 56],
				[154, 72],
				[168, 72],
			].map(([x, y], i) => (
				<B key={i} x={x!} y={y!} w={6} h={8} {...fine(seed + 20 + i, 0.3)} />
			))}
			<L from={[100, GROUND]} to={[100, 24]} seed={seed + 40} />
			<Stroke d="M100 30 L142 30 L150 37 L142 44 L100 44 Z" tone="ink" width={MAIN} delay={0.25} />
			<Stroke d="M100 52 L66 52 L58 59 L66 66 L100 66 Z" tone="ink" width={MAIN} delay={0.3} />
			<L from={[108, 37]} to={[134, 37]} {...fine(seed + 41, 0.4)} />
			<L from={[72, 59]} to={[94, 59]} {...fine(seed + 42, 0.4)} />
			<Person
				x={128}
				top={60}
				height={44}
				seed={seed + 60}
				hair="short"
				arms={[
					[
						[122, 70],
						[120, 82],
					],
					[
						[134, 68],
						[140, 60],
					],
				]}
			/>
		</g>
	);
}

function Leaves({ seed }: { seed: number }) {
	const leaf = (x: number, y: number, turn: number, s: number) => (
		<Stroke
			key={s}
			d={`M${x} ${y} q${4 * turn} -6 ${10 * turn} -2 q-${4 * turn} 6 -${10 * turn} 2 Z M${x} ${y} l${7 * turn} -2`}
			tone="ink"
			width={DETAIL}
			delay={0.4 + (s % 7) * 0.03}
		/>
	);
	const pile: Array<[number, number, number]> = [
		[132, 101, 1],
		[142, 99, -1],
		[150, 102, 1],
		[138, 95, 1],
		[148, 94, -1],
		[156, 97, -1],
		[160, 102, 1],
	];
	return (
		<g>
			<Wash cx={148} cy={98} rx={20} ry={7} hue="ochre" seed={seed + 90} />
			<Wash cx={84} cy={36} rx={30} ry={14} hue="rose" seed={seed + 91} />
			<Ground seed={seed} />
			<Highlight cx={148} cy={96} rx={16} ry={7} seed={seed + 3} />
			<C
				points={[
					[78, GROUND],
					[81, 80],
					[82, 56],
				]}
				seed={seed + 10}
			/>
			<C
				points={[
					[92, GROUND],
					[88, 80],
					[87, 56],
				]}
				seed={seed + 11}
			/>
			<L from={[82, 58]} to={[62, 34]} seed={seed + 12} />
			<L from={[87, 56]} to={[90, 24]} seed={seed + 13} />
			<L from={[86, 62]} to={[112, 36]} seed={seed + 14} />
			<L from={[70, 44]} to={[60, 44]} {...fine(seed + 15, 0.2)} />
			<L from={[89, 36]} to={[98, 30]} {...fine(seed + 16, 0.2)} />
			<L from={[104, 44]} to={[116, 46]} {...fine(seed + 17, 0.2)} />
			{leaf(60, 30, 1, seed + 20)}
			{leaf(96, 22, -1, seed + 21)}
			{leaf(114, 34, 1, seed + 22)}
			{leaf(122, 56, -1, seed + 23)}
			{leaf(110, 74, 1, seed + 24)}
			{leaf(52, 70, -1, seed + 25)}
			{pile.map(([x, y, t], i) => leaf(x, y, t, seed + 40 + i))}
			<L from={[176, 40]} to={[160, 92]} seed={seed + 50} delay={0.3} />
			<L from={[150, 92]} to={[172, 98]} seed={seed + 51} delay={0.35} />
			{[0, 1, 2, 3, 4].map((i) => (
				<L
					key={i}
					from={[152 + i * 4.4, 92.6 + i * 1.2]}
					to={[150 + i * 4.4, 99 + i * 1.2]}
					{...fine(seed + 52 + i, 0.4)}
				/>
			))}
		</g>
	);
}

function Baking({ seed }: { seed: number }) {
	const body: Point[] = [
		[94, 47],
		[80, 50],
		[73, 56],
		[79, 61],
		[90, 60],
		[87, 82],
		[81, 96],
		[88, 101],
		[95, 95],
		[100, 84],
		[105, 95],
		[112, 101],
		[119, 96],
		[113, 82],
		[110, 60],
		[121, 61],
		[127, 56],
		[120, 50],
		[106, 47],
	];
	return (
		<g>
			<Wash cx={52} cy={84} rx={9} ry={8} hue="rose" seed={seed + 91} />
			<Wash cx={148} cy={84} rx={9} ry={9} hue="ochre" seed={seed + 92} />
			<WashPath d="M30 104 L38 96 L162 96 L170 104 Z" hue={hueFor(seed)} />
			<WashPath d={smoothD(body, true)} hue="ochre" />
			<path d={loopD(100, 36, 11, 11, seed + 10)} transform="translate(1.5 1.5)" className="ink-fade q-wash-ochre" />
			<Highlight cx={100} cy={68} rx={10} ry={8} seed={seed + 3} />
			<C
				points={[
					[22, 104],
					[178, 104],
				]}
				seed={seed}
				tone="soft"
				width={DETAIL}
			/>
			<L from={[30, 104]} to={[38, 96]} {...fine(seed + 1, 0.1)} />
			<L from={[170, 104]} to={[162, 96]} {...fine(seed + 2, 0.1)} />
			<L from={[38, 96]} to={[162, 96]} {...fine(seed + 4, 0.1)} />
			<O cx={100} cy={36} rx={11} seed={seed + 10} />
			<Stroke d={smoothD(body, true)} tone="ink" width={MAIN} delay={0.15} />
			<Dots
				points={[
					[96, 34],
					[104, 34],
					[100, 62],
					[100, 70],
					[100, 78],
				]}
			/>
			<C
				points={[
					[96, 39],
					[100, 41.5],
					[104, 39],
				]}
				{...fine(seed + 11, 0.3)}
			/>
			<Stroke
				d="M77 55 l2 -2 l2 2 l2 -2 M117 55 l2 -2 l2 2 l2 -2 M84 94 l2 -2 l2 2 M112 94 l2 -2 l2 2"
				tone="graphite"
				width={DETAIL}
				delay={0.4}
			/>
			<Heart cx={52} cy={84} size={11} seed={seed + 20} />
			<Stroke
				d="M148 74 L151 81 L159 81 L153 86 L155 94 L148 89 L141 94 L143 86 L137 81 L145 81 Z"
				tone="ink"
				width={MAIN}
				delay={0.35}
			/>
		</g>
	);
}

function Moving({ seed }: { seed: number }) {
	const box = (x: number, y: number, w: number, h: number, s: number) => (
		<g key={s}>
			<B x={x} y={y} w={w} h={h} seed={s} />
			<L from={[x + w / 2, y]} to={[x + w / 2, y + h * 0.35]} {...fine(s + 1)} />
			<L from={[x, y + 5]} to={[x + w, y + 5]} {...fine(s + 2)} />
		</g>
	);
	return (
		<g>
			<WashBox x={40} y={70} w={46} h={34} hue="ochre" seed={seed + 90} />
			<WashBox x={90} y={62} w={52} h={42} hue="ochre" seed={seed + 91} />
			<WashBox x={66} y={38} w={40} h={32} hue={hueFor(seed)} seed={seed + 92} />
			<Wash cx={160} cy={66} rx={12} ry={8} hue="sage" seed={seed + 93} />
			<Ground seed={seed} />
			<path d="M83 37 L89 37 L89 52 L83 52 Z" className="ink-fade q-ink-patch" />
			<path d="M110 61 L116 61 L116 76 L110 76 Z" className="ink-fade q-ink-patch" />
			{box(40, 70, 46, 34, seed + 10)}
			{box(90, 62, 52, 42, seed + 20)}
			{box(66, 38, 40, 32, seed + 30)}
			<Stroke
				d="M108 84 l4 -6 l4 6 M112 78 l0 10 M120 84 l4 -6 l4 6 M124 78 l0 10"
				tone="graphite"
				width={DETAIL}
				delay={0.4}
			/>
			<Stroke d="M152 104 L148 86 L172 86 L168 104 Z" tone="ink" width={MAIN} delay={0.3} />
			<C
				points={[
					[160, 86],
					[158, 72],
					[150, 62],
				]}
				seed={seed + 40}
				delay={0.35}
			/>
			<C
				points={[
					[160, 86],
					[162, 70],
					[170, 60],
				]}
				seed={seed + 41}
				delay={0.35}
			/>
			<C
				points={[
					[150, 62],
					[146, 70],
					[154, 72],
				]}
				{...fine(seed + 42, 0.4)}
			/>
			<C
				points={[
					[170, 60],
					[176, 66],
					[168, 70],
				]}
				{...fine(seed + 43, 0.4)}
			/>
		</g>
	);
}

function Wedding({ seed }: { seed: number }) {
	const frosting = (x: number, w: number, y: number, s: number) => {
		const points: Point[] = [];
		const n = Math.round(w / 8);
		for (let i = 0; i <= n * 2; i++) points.push([x + (i * w) / (n * 2), y + (i % 2 === 0 ? 0 : 4)]);
		return <C key={s} points={points} {...fine(s, 0.3)} />;
	};
	return (
		<g>
			<WashBox x={62} y={74} w={76} h={22} hue={hueFor(seed, 1)} seed={seed + 90} />
			<WashBox x={74} y={54} w={52} h={20} hue={hueFor(seed, 1)} seed={seed + 91} />
			<WashBox x={86} y={38} w={28} h={16} hue={hueFor(seed, 1)} seed={seed + 92} />
			<Wash cx={40} cy={62} rx={8} ry={9} hue="ochre" seed={seed + 93} />
			<Wash cx={160} cy={62} rx={8} ry={9} hue="ochre" seed={seed + 94} />
			<L from={[18, 100]} to={[182, 100]} seed={seed} tone="soft" width={DETAIL} />
			<Highlight cx={100} cy={26} rx={14} ry={10} seed={seed + 3} />
			<O cx={100} cy={98} rx={46} ry={3.5} seed={seed + 10} />
			<B x={62} y={74} w={76} h={22} seed={seed + 11} />
			<B x={74} y={54} w={52} h={20} seed={seed + 12} delay={0.1} />
			<B x={86} y={38} w={28} h={16} seed={seed + 13} delay={0.2} />
			{frosting(62, 76, 74, seed + 20)}
			{frosting(74, 52, 54, seed + 21)}
			{frosting(86, 28, 38, seed + 22)}
			<Heart cx={100} cy={26} size={11} seed={seed + 30} />
			<C
				points={[
					[18, 24],
					[40, 33],
					[70, 26],
				]}
				{...fine(seed + 60, 0.3)}
			/>
			<C
				points={[
					[130, 26],
					[160, 33],
					[182, 24],
				]}
				{...fine(seed + 61, 0.3)}
			/>
			<L from={[100, 34]} to={[100, 38]} {...fine(seed + 31, 0.4)} />
			{[40, 160].map((x, i) => (
				<g key={x}>
					<C
						points={[
							[x - 8, 70],
							[x - 6, 54],
							[x, 50],
							[x + 6, 54],
							[x + 8, 70],
							[x - 8, 70],
						]}
						seed={seed + 40 + i * 2}
						delay={0.35}
					/>
					<L from={[x, 50]} to={[x, 32]} {...fine(seed + 41 + i * 2, 0.4)} />
					<O cx={x} cy={72} rx={2.4} {...fine(seed + 46 + i, 0.45)} />
				</g>
			))}
		</g>
	);
}

function Clock({ seed }: { seed: number }) {
	return (
		<g>
			<Wash cx={100} cy={64} rx={28} ry={28} hue={hueFor(seed)} seed={seed + 90} />
			<WashBox x={148} y={76} w={24} h={23} hue="ochre" seed={seed + 91} />
			<L from={[18, 100]} to={[182, 100]} seed={seed} tone="soft" width={DETAIL} />
			<Highlight cx={100} cy={62} rx={18} ry={14} seed={seed + 3} />
			<O cx={100} cy={64} rx={28} seed={seed + 10} />
			<O cx={100} cy={64} rx={23} {...fine(seed + 11, 0.2)} />
			<C
				points={[
					[74, 46],
					[70, 34],
					[80, 28],
					[88, 38],
				]}
				seed={seed + 12}
				delay={0.15}
			/>
			<C
				points={[
					[126, 46],
					[130, 34],
					[120, 28],
					[112, 38],
				]}
				seed={seed + 13}
				delay={0.15}
			/>
			<L from={[100, 36]} to={[100, 28]} seed={seed + 14} delay={0.2} />
			<L from={[94, 28]} to={[106, 28]} seed={seed + 15} delay={0.2} />
			<L from={[82, 88]} to={[76, 98]} seed={seed + 16} delay={0.25} />
			<L from={[118, 88]} to={[124, 98]} seed={seed + 17} delay={0.25} />
			<L from={[100, 64]} to={[100, 48]} seed={seed + 18} delay={0.3} />
			<L from={[100, 64]} to={[111, 69]} seed={seed + 19} delay={0.3} />
			{[0, 1, 2, 3].map((i) => {
				const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
				return (
					<L
						key={i}
						from={[100 + Math.cos(angle) * 18, 64 + Math.sin(angle) * 18]}
						to={[100 + Math.cos(angle) * 21, 64 + Math.sin(angle) * 21]}
						{...fine(seed + 20 + i, 0.35)}
					/>
				);
			})}
			<C
				points={[
					[62, 30],
					[58, 26],
				]}
				{...fine(seed + 30, 0.45)}
			/>
			<C
				points={[
					[60, 40],
					[54, 40],
				]}
				{...fine(seed + 31, 0.45)}
			/>
			<C
				points={[
					[138, 30],
					[142, 26],
				]}
				{...fine(seed + 32, 0.45)}
			/>
			<C
				points={[
					[140, 40],
					[146, 40],
				]}
				{...fine(seed + 33, 0.45)}
			/>
			<C
				points={[
					[148, 99],
					[148, 76],
					[172, 76],
					[172, 99],
					[148, 99],
				]}
				seed={seed + 41}
				delay={0.3}
			/>
			<O cx={160} cy={76} rx={12} ry={2.5} {...fine(seed + 40, 0.3)} />
			<C
				points={[
					[172, 81],
					[181, 81],
					[181, 93],
					[172, 93],
				]}
				seed={seed + 42}
				delay={0.35}
			/>
			<C
				points={[
					[156, 70],
					[153, 64],
					[158, 58],
				]}
				{...fine(seed + 43, 0.45)}
			/>
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
	table: Table,
	bike: Bike,
	family: Family,
	plate: Plate,
	books: Books,
	city: City,
	leaves: Leaves,
	baking: Baking,
	moving: Moving,
	wedding: Wedding,
	clock: Clock,
};

const HAS_WORDS: ReadonlySet<CoverMotif> = new Set(["friends"]);

export function CoverScene({ motif, seed, className }: { motif: CoverMotif; seed: number; className?: string }) {
	const Scene = SCENES[motif];
	const mirrored = seed % 2 === 1 && !HAS_WORDS.has(motif);
	return (
		<svg viewBox="0 0 200 120" className={className} aria-hidden="true">
			<g transform={mirrored ? "matrix(-1 0 0 1 200 0)" : undefined}>
				<Scene seed={seed} />
			</g>
		</svg>
	);
}
