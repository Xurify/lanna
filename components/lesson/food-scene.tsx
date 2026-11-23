import type { CSSProperties } from "react";
import { Sheet, Stroke } from "@/components/lesson/ink";
import { curveD, inkRandom, loopD, smoothD, type Point } from "@/components/lesson/ink-paths";
import { ACCENT, DETAIL, Ground, GROUND, L, MAIN, Wash, type Hue } from "@/components/lesson/scene-kit";
import type { FoodScene as Scene } from "@/src/core";

function Outline({
	points,
	hue,
	seed,
	closed = true,
	delay = 0.1,
}: {
	points: readonly Point[];
	hue?: Hue;
	seed: number;
	closed?: boolean;
	delay?: number;
}) {
	const random = inkRandom(seed);
	const d = smoothD(
		points.map(([x, y]): Point => [x + (random() - 0.5) * 1.2, y + (random() - 0.5) * 1.2]),
		closed,
	);
	return (
		<>
			{hue && <Wash d={d} hue={hue} />}
			<Stroke d={d} width={MAIN} delay={delay} />
		</>
	);
}

function Oval({
	cx,
	cy,
	rx,
	ry,
	seed,
	hue,
	tone = "ink",
	width = MAIN,
	delay = 0.1,
}: {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	seed: number;
	hue?: Hue;
	tone?: "ink" | "graphite" | "soft" | "mark";
	width?: number;
	delay?: number;
}) {
	const d = loopD(cx, cy, rx, ry, seed);
	return (
		<>
			{hue && <Wash d={d} hue={hue} />}
			<Stroke d={d} tone={tone} width={width} delay={delay} />
		</>
	);
}

function Bread() {
	const loaf: Point[] = [
		[30, GROUND],
		[28, 96],
		[40, 76],
		[64, 64],
		[94, 60],
		[118, 66],
		[134, 82],
		[138, 98],
		[136, GROUND],
	];
	const slice: Point[] = [
		[150, GROUND],
		[149, 76],
		[145, 67],
		[151, 58],
		[166, 55],
		[181, 58],
		[187, 67],
		[183, 76],
		[182, GROUND],
	];
	const crumb: Point[] = [
		[154, GROUND - 3],
		[153, 76],
		[150, 68],
		[154, 62],
		[166, 59],
		[178, 62],
		[182, 68],
		[178, 76],
		[178, GROUND - 3],
	];
	return (
		<>
			<Ground />
			<Outline points={loaf} hue="ochre" seed={200} closed={false} />
			<L from={[54, 84]} to={[66, 68]} seed={204} tone="graphite" width={DETAIL} delay={0.4} />
			<L from={[78, 80]} to={[90, 63]} seed={205} tone="graphite" width={DETAIL} delay={0.45} />
			<L from={[102, 80]} to={[114, 66]} seed={206} tone="graphite" width={DETAIL} delay={0.5} />
			<Outline points={slice} seed={210} closed={false} delay={0.3} />
			<Outline points={crumb} hue="ochre" seed={212} closed={false} delay={0.4} />
		</>
	);
}

function Cheese() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[32, 96],
					[140, 56],
					[168, 70],
				]}
				hue="ochre"
				seed={230}
			/>
			<Wash d="M32 96 L168 70 L168 108 L32 108 Z" hue="ochre" />
			<L from={[32, 96]} to={[32, GROUND]} seed={233} />
			<L from={[168, 70]} to={[168, GROUND]} seed={234} />
			<L from={[32, GROUND]} to={[168, GROUND]} seed={235} />
			<Oval cx={66} cy={100} rx={6} ry={4} seed={236} tone="graphite" width={DETAIL} delay={0.5} />
			<Oval cx={104} cy={94} rx={8} ry={5.5} seed={237} tone="graphite" width={DETAIL} delay={0.55} />
			<Oval cx={144} cy={98} rx={6} ry={5} seed={238} tone="graphite" width={DETAIL} delay={0.6} />
			<Oval cx={132} cy={82} rx={4} ry={3} seed={239} tone="graphite" width={DETAIL} delay={0.65} />
			<Oval cx={98} cy={74} rx={5} ry={2.5} seed={240} tone="graphite" width={DETAIL} delay={0.7} />
		</>
	);
}

function Egg() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[78, 50],
					[92, 56],
					[101, 75],
					[99, 96],
					[89, 108],
					[78, 110],
					[66, 108],
					[56, 96],
					[54, 75],
					[63, 56],
				]}
				seed={250}
			/>
			<Wash d={loopD(140, 84, 13, 8, 252)} hue="ochre" delay={0.55} />
			<Oval cx={140} cy={84} rx={13} ry={8} seed={252} hue="ochre" delay={0.5} />
			<Stroke
				d="M112 88 L117 82 L122 89 L128 83 L134 89 L140 83 L146 89 L152 83 L158 89 L163 83 L168 88"
				width={MAIN}
				delay={0.3}
			/>
			<Outline
				points={[
					[112, 88],
					[115, 101],
					[140, 111],
					[165, 101],
					[168, 88],
				]}
				seed={254}
				closed={false}
				delay={0.2}
			/>
		</>
	);
}

const HEAP: ReadonlyArray<readonly [number, number, number]> = [
	[54, 92, 10],
	[59, 92, 22],
	[64, 92, 30],
	[69, 92, 36],
	[74, 92, 42],
];

function grains(seed: number, rows: ReadonlyArray<readonly [number, number, number]>): string {
	const random = inkRandom(seed);
	const r = (n: number) => Math.round(n * 10) / 10;
	const out: string[] = [];
	for (const [y, middle, half] of rows)
		for (let x = middle - half; x <= middle + half; x += 7) {
			const cx = x + (random() - 0.5) * 3;
			const cy = y + (random() - 0.5) * 2;
			const angle = (random() - 0.5) * 1.6;
			const ring: Point[] = [0, 1, 2, 3, 4, 5].map((k) => {
				const t = (k / 6) * Math.PI * 2;
				const x = Math.cos(t) * 3.2,
					y = Math.sin(t) * 1.5;
				return [r(cx + x * Math.cos(angle) - y * Math.sin(angle)), r(cy + x * Math.sin(angle) + y * Math.cos(angle))];
			});
			out.push(smoothD(ring, true));
		}
	return out.join(" ");
}

function Rice() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[44, 78],
					[58, 60],
					[78, 50],
					[92, 48],
					[106, 50],
					[126, 60],
					[140, 78],
				]}
				seed={260}
				closed={false}
			/>
			<Oval cx={92} cy={78} rx={50} ry={6} seed={262} />
			<Outline
				points={[
					[42, 79],
					[52, 96],
					[74, 106],
					[110, 106],
					[132, 96],
					[142, 79],
				]}
				hue="sky"
				seed={264}
				closed={false}
				delay={0.2}
			/>
			<L from={[78, 106]} to={[80, GROUND]} seed={266} width={DETAIL} />
			<L from={[106, 106]} to={[104, GROUND]} seed={267} width={DETAIL} />
			<Stroke d={grains(268, HEAP)} width={DETAIL} delay={0.5} />
			<Stroke d={grains(271, [[109, 128, 7]])} width={DETAIL} delay={0.7} />
			<L from={[150, 108]} to={[188, 82]} seed={269} width={MAIN} delay={0.6} />
			<L from={[156, 110]} to={[192, 86]} seed={270} width={MAIN} delay={0.65} />
		</>
	);
}

function Apple() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[100, 52],
					[114, 44],
					[132, 48],
					[143, 64],
					[143, 84],
					[133, 102],
					[116, 110],
					[100, 106],
					[84, 110],
					[67, 102],
					[57, 84],
					[57, 64],
					[68, 48],
					[86, 44],
				]}
				hue="rose"
				seed={270}
			/>
			<Stroke d="M100 52 Q99 42 104 32" width={MAIN} delay={0.4} />
			<Outline
				points={[
					[103, 40],
					[112, 30],
					[128, 28],
					[118, 38],
				]}
				hue="sage"
				seed={274}
				delay={0.5}
			/>
			<Stroke d="M70 66 Q72 58 78 54" tone="graphite" width={DETAIL} delay={0.6} />
		</>
	);
}

function Soup() {
	return (
		<>
			<Ground />
			<Oval cx={92} cy={62} rx={56} ry={9} seed={280} />
			<Oval cx={92} cy={63} rx={48} ry={5.5} seed={281} hue="ochre" tone="graphite" width={DETAIL} delay={0.3} />
			<Outline
				points={[
					[36, 63],
					[41, 86],
					[62, 102],
					[122, 102],
					[143, 86],
					[148, 63],
				]}
				seed={282}
				closed={false}
				delay={0.2}
			/>
			<L from={[76, 102]} to={[74, GROUND]} seed={284} width={DETAIL} />
			<L from={[108, 102]} to={[110, GROUND]} seed={285} width={DETAIL} />
			<Oval cx={78} cy={63} rx={3} ry={1.6} seed={286} tone="graphite" width={DETAIL} delay={0.5} />
			<Oval cx={100} cy={61} rx={3} ry={1.6} seed={287} tone="graphite" width={DETAIL} delay={0.55} />
			<Oval cx={116} cy={64} rx={2.5} ry={1.4} seed={288} tone="graphite" width={DETAIL} delay={0.6} />
			<Oval cx={160} cy={106} rx={13} ry={5.5} seed={289} delay={0.5} />
			<L from={[173, 105]} to={[196, 100]} seed={298} delay={0.55} />
			{[72, 92, 112].map((x, i) => (
				<Stroke
					key={x}
					d={curveD(
						[
							[x, 50],
							[x - 5, 40],
							[x + 4, 30],
							[x - 3, 18],
						],
						290 + i,
						0.4,
					)}
					tone="soft"
					width={DETAIL}
					delay={0.7 + i * 0.1}
				/>
			))}
		</>
	);
}

function Fish() {
	return (
		<>
			<Oval cx={100} cy={96} rx={76} ry={16} seed={300} delay={0} />
			<Oval cx={100} cy={96} rx={64} ry={11} seed={301} tone="soft" width={DETAIL} delay={0.1} />
			<Outline
				points={[
					[42, 82],
					[56, 70],
					[86, 63],
					[118, 67],
					[138, 78],
					[118, 90],
					[86, 94],
					[56, 92],
				]}
				hue="sky"
				seed={302}
				delay={0.2}
			/>
			<Stroke d="M138 78 L160 62 L154 79 L161 95 Z" width={MAIN} delay={0.3} />
			<Oval cx={54} cy={78} rx={2.4} ry={2.4} seed={304} delay={0.5} />
			<Stroke d="M66 70 Q72 79 66 90" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke
				d="M84 74 q4 4 0 8 M96 72 q4 5 0 10 M108 73 q4 4 0 8 M96 84 q3 3 0 6"
				tone="graphite"
				width={DETAIL}
				delay={0.6}
			/>
		</>
	);
}

function Cake() {
	return (
		<>
			<Oval cx={100} cy={52} rx={50} ry={10} seed={310} hue="rose" />
			<L from={[50, 52]} to={[50, 96]} seed={311} />
			<L from={[150, 52]} to={[150, 96]} seed={312} />
			<Outline
				points={[
					[50, 96],
					[100, 106],
					[150, 96],
				]}
				seed={313}
				closed={false}
			/>
			<Wash d="M50 52 L150 52 L150 96 Q100 106 50 96 Z" hue="ochre" />
			<Stroke
				d="M50 55 Q54 66 58 60 Q62 70 68 62 Q74 72 82 64 Q90 72 98 65 Q106 73 114 64 Q122 72 130 63 Q137 70 142 61 Q147 67 150 55"
				width={DETAIL}
				delay={0.4}
			/>
			<Outline
				points={[
					[50, 80],
					[100, 89],
					[150, 80],
				]}
				seed={315}
				closed={false}
				delay={0.5}
			/>
			{[70, 88, 106, 124].map((x, i) => (
				<Oval key={x} cx={x} cy={48 + (i % 2) * 2} rx={5} ry={3.6} seed={316 + i} width={DETAIL} delay={0.6} />
			))}
			<Oval cx={100} cy={102} rx={64} ry={6} seed={322} delay={0.2} />
			<Ground />
		</>
	);
}

function Water() {
	return (
		<>
			<Ground />
			<Stroke d="M186 18 L132 18 Q114 18 112 34 L112 42" width={MAIN} />
			<Stroke d="M186 28 L134 28 Q124 28 122 36 L122 42" width={MAIN} />
			<L from={[109, 42]} to={[125, 42]} seed={330} />
			<L from={[154, 18]} to={[154, 9]} seed={331} />
			<L from={[144, 8]} to={[164, 8]} seed={332} />
			<L from={[115, 46]} to={[115, 82]} seed={333} tone="mark" width={2.1} delay={0.5} />
			<L from={[119, 46]} to={[119, 82]} seed={334} tone="mark" width={2.1} delay={0.55} />
			<Wash d="M96 82 L142 82 L138 110 L100 110 Z" hue="sky" />
			<L from={[94, 60]} to={[100, GROUND]} seed={335} />
			<L from={[144, 60]} to={[138, GROUND]} seed={336} />
			<L from={[100, GROUND]} to={[138, GROUND]} seed={337} />
			<Stroke d="M96 82 Q106 79 112 82 Q122 85 130 81 Q137 79 142 82" tone="graphite" width={DETAIL} delay={0.4} />
			<Stroke d="M106 78 q-3 -4 -6 -3 M128 78 q3 -4 6 -3" tone="mark" width={DETAIL} delay={0.7} />
		</>
	);
}

function Coffee() {
	const surface = loopD(80, 73, 26, 4, 343);
	return (
		<>
			<Ground />
			<Oval cx={80} cy={104} rx={52} ry={7} seed={340} delay={0} />
			<Outline
				points={[
					[50, 72],
					[52, 90],
					[64, 101],
					[96, 101],
					[108, 90],
					[110, 72],
				]}
				seed={341}
				closed={false}
			/>
			<Oval cx={80} cy={72} rx={30} ry={6} seed={342} />
			<Wash d={surface} hue="ochre" />
			<Wash d={surface} hue="rose" delay={0.5} />
			<Stroke
				d="M58 73 L66 70 M60 76 L74 70 M66 77 L82 70 M74 77 L90 70 M82 77 L98 70 M90 77 L102 72"
				tone="graphite"
				width={DETAIL}
				delay={0.4}
			/>
			<Stroke d={surface} tone="graphite" width={DETAIL} delay={0.3} />
			<Stroke d="M109 77 Q124 76 123 86 Q121 95 105 94" width={MAIN} delay={0.3} />
			{(
				[
					[148, 92, -25],
					[178, 96, 20],
				] as const
			).map(([x, y, turn], i) => (
				<g key={i} transform={`rotate(${turn} ${x} ${y})`}>
					<Wash d={loopD(x, y, 15, 10.5, 344 + i)} hue="rose" />
					<Oval cx={x} cy={y} rx={15} ry={10.5} seed={344 + i} hue="ochre" delay={0.5 + i * 0.1} />
					<Stroke
						d={`M${x - 13} ${y} Q${x - 5} ${y - 6} ${x} ${y} Q${x + 5} ${y + 6} ${x + 13} ${y}`}
						width={ACCENT}
						delay={0.6 + i * 0.1}
					/>
				</g>
			))}
		</>
	);
}

function Tea() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[56, 54],
					[58, 86],
					[66, 106],
					[102, 106],
					[110, 86],
					[112, 54],
				]}
				seed={350}
				closed={false}
			/>
			<L from={[66, 106]} to={[68, GROUND]} seed={351} width={DETAIL} />
			<L from={[102, 106]} to={[100, GROUND]} seed={352} width={DETAIL} />
			<Oval cx={84} cy={54} rx={28} ry={5.5} seed={353} />
			<Oval cx={84} cy={56} rx={24} ry={3.6} seed={354} hue="ochre" tone="graphite" width={DETAIL} delay={0.3} />
			<Stroke d="M57 62 Q40 62 41 76 Q42 90 60 88" width={MAIN} delay={0.3} />
			<Stroke d="M94 56 Q104 42 113 50 Q122 60 132 78" width={MAIN} delay={0.5} />
			<Wash d="M120 78 L146 78 L146 108 L120 108 Z" hue="sage" />
			<Stroke d="M120 78 L146 78 L146 108 L120 108 Z" width={MAIN} delay={0.6} />
			<Stroke d="M125 103 Q127 88 141 83 Q140 99 125 103 M125 103 L135 91" tone="graphite" width={DETAIL} delay={0.7} />
		</>
	);
}

function Spot({ points }: { points: readonly Point[] }) {
	return (
		<path
			d={smoothD(points, true)}
			className="ink-fade fill-current text-ink-2"
			style={{ "--ink-delay": "0.5s" } as CSSProperties}
		/>
	);
}

function Milk() {
	return (
		<>
			<Ground />
			<g transform="translate(100 112) scale(1.18) translate(-82 -112)">
				<L from={[52, 50]} to={[52, GROUND]} seed={360} />
				<L from={[92, 50]} to={[92, GROUND]} seed={361} />
				<L from={[52, 50]} to={[92, 50]} seed={362} />
				<Stroke d="M52 50 L72 30 L92 50" width={MAIN} delay={0.2} />
				<Stroke d="M92 50 L112 42 L112 106 L92 112" width={MAIN} delay={0.25} />
				<Stroke d="M72 30 L92 23 L112 42" width={MAIN} delay={0.3} />
				<Stroke d="M70 30 L70 24 L90 17 L92 23" width={DETAIL} delay={0.35} />
				<Spot
					points={[
						[54, 58],
						[66, 55],
						[74, 62],
						[70, 70],
						[60, 74],
						[55, 67],
					]}
				/>
				<Spot
					points={[
						[76, 80],
						[86, 76],
						[90, 84],
						[84, 94],
						[74, 92],
						[70, 86],
					]}
				/>
				<Spot
					points={[
						[53, 92],
						[60, 96],
						[64, 104],
						[57, 108],
						[53, 102],
					]}
				/>
				<Spot
					points={[
						[96, 62],
						[104, 58],
						[108, 66],
						[102, 74],
						[97, 70],
					]}
				/>
				<Spot
					points={[
						[98, 90],
						[106, 88],
						[109, 98],
						[102, 104],
						[97, 98],
					]}
				/>
			</g>
		</>
	);
}

function Beer() {
	return (
		<>
			<Ground />
			<Wash d="M72 56 L124 56 L124 108 L72 108 Z" hue="ochre" />
			<L from={[72, 52]} to={[72, 108]} seed={370} />
			<L from={[124, 52]} to={[124, 108]} seed={371} />
			<Stroke d="M72 108 Q72 112 76 112 L120 112 Q124 112 124 108" width={MAIN} delay={0.1} />
			<Stroke d="M124 64 Q146 62 146 80 Q146 98 124 98" width={MAIN} delay={0.2} />
			<Stroke d="M124 72 Q138 72 138 80 Q138 90 124 90" width={DETAIL} delay={0.25} />
			<Outline
				points={[
					[66, 54],
					[64, 42],
					[74, 34],
					[86, 36],
					[96, 28],
					[110, 32],
					[122, 30],
					[132, 40],
					[130, 54],
					[124, 58],
					[118, 66],
					[112, 58],
					[90, 58],
					[82, 70],
					[76, 58],
				]}
				seed={372}
				delay={0.4}
			/>
			<L from={[86, 76]} to={[86, 102]} seed={374} tone="graphite" width={DETAIL} delay={0.5} />
			<L from={[98, 74]} to={[98, 102]} seed={375} tone="graphite" width={DETAIL} delay={0.5} />
			<L from={[110, 74]} to={[110, 102]} seed={376} tone="graphite" width={DETAIL} delay={0.5} />
		</>
	);
}

function Wine() {
	return (
		<>
			<Ground />
			<Wash d="M54 74 L82 74 L82 112 L54 112 Z" hue="rose" />
			<Outline
				points={[
					[54, GROUND],
					[54, 66],
					[58, 54],
					[64, 46],
					[64, 26],
				]}
				seed={380}
				closed={false}
			/>
			<Outline
				points={[
					[82, GROUND],
					[82, 66],
					[78, 54],
					[72, 46],
					[72, 26],
				]}
				seed={381}
				closed={false}
			/>
			<L from={[54, GROUND]} to={[82, GROUND]} seed={382} />
			<Stroke d="M63 26 L63 18 L73 18 L73 26 Z" width={DETAIL} delay={0.3} />
			<Stroke d="M56 74 L80 74 M56 96 L80 96" tone="graphite" width={DETAIL} delay={0.4} />
			<Wash d="M115 58 Q118 76 132 76 Q146 76 149 58 Z" hue="rose" />
			<Outline
				points={[
					[112, 38],
					[113, 62],
					[132, 78],
					[151, 62],
					[152, 38],
				]}
				seed={384}
				closed={false}
				delay={0.2}
			/>
			<Stroke d="M115 58 Q132 61 149 58" tone="graphite" width={DETAIL} delay={0.4} />
			<L from={[132, 78]} to={[132, 108]} seed={385} />
			<Oval cx={132} cy={109} rx={16} ry={3.5} seed={386} delay={0.3} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	bread: Bread,
	cheese: Cheese,
	egg: Egg,
	rice: Rice,
	apple: Apple,
	soup: Soup,
	fish: Fish,
	cake: Cake,
	water: Water,
	coffee: Coffee,
	tea: Tea,
	milk: Milk,
	beer: Beer,
	wine: Wine,
};

export function FoodScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
