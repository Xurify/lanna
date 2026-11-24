import { useId } from "react";
import { Sheet, Stroke } from "@/components/lesson/ink";
import { curveD, inkRandom, type Point } from "@/components/lesson/ink-paths";
import { DETAIL, Ground, GROUND, L, MAIN, Oval, Outline, Wash, type Hue } from "@/components/lesson/scene-kit";
import type { InkTone } from "@/components/lesson/ink";
import type { NatureScene as Scene } from "@/src/core";

function jaggedD(points: readonly Point[], seed: number, closed = false): string {
	const random = inkRandom(seed);
	const moved = points.map(
		([x, y]) => `${(x + (random() - 0.5) * 1.2).toFixed(1)} ${(y + (random() - 0.5) * 1.2).toFixed(1)}`,
	);
	return `M${moved.join(" L")}${closed ? " Z" : ""}`;
}

function spruceOutline(x: number, base: number, height: number, width: number): Point[] {
	const half = width / 2;
	const tier = height / 3;
	return [
		[x - half, base],
		[x - half * 0.45, base - tier],
		[x - half * 0.8, base - tier],
		[x - half * 0.3, base - tier * 2],
		[x - half * 0.6, base - tier * 2],
		[x, base - height],
		[x + half * 0.6, base - tier * 2],
		[x + half * 0.3, base - tier * 2],
		[x + half * 0.8, base - tier],
		[x + half * 0.45, base - tier],
		[x + half, base],
	];
}

function Spruce({
	x,
	base = GROUND - 7,
	height,
	width,
	seed,
	tone = "ink",
	hue,
	delay = 0.1,
}: {
	x: number;
	base?: number;
	height: number;
	width: number;
	seed: number;
	tone?: InkTone;
	hue?: Hue;
	delay?: number;
}) {
	const outline = spruceOutline(x, base, height, width);
	return (
		<>
			{hue && <Wash d={jaggedD(outline, seed, true)} hue={hue} />}
			<Stroke d={jaggedD(outline, seed, true)} tone={tone} width={tone === "ink" ? MAIN : DETAIL} delay={delay} />
			<Stroke d={`M${x} ${base} L${x} ${base + 7}`} tone={tone} width={MAIN} delay={delay + 0.1} />
		</>
	);
}

function Tufts({ at, seed, delay = 0.6 }: { at: readonly Point[]; seed: number; delay?: number }) {
	const random = inkRandom(seed);
	const d = at
		.map(([x, y]) => {
			const lean = (random() - 0.5) * 2;
			return `M${x - 4} ${y} Q${x - 3} ${y - 4} ${x - 5 + lean} ${y - 7} M${x} ${y} Q${x} ${y - 5} ${x + lean} ${y - 9} M${x + 4} ${y} Q${x + 3} ${y - 4} ${x + 5 + lean} ${y - 7}`;
		})
		.join(" ");
	return <Stroke d={d} tone="graphite" width={DETAIL} delay={delay} />;
}

function Tree() {
	const crown: Point[] = [
		[62, 66],
		[52, 52],
		[56, 36],
		[70, 24],
		[88, 15],
		[108, 14],
		[126, 20],
		[140, 32],
		[148, 48],
		[142, 64],
		[126, 74],
		[108, 72],
		[92, 74],
		[74, 74],
	];
	return (
		<>
			<Ground />
			<Wash d="M92 112 L95 72 L105 72 L109 112 Z" hue="ochre" />
			<Outline points={crown} hue="sage" seed={600} />
			<Stroke d="M90 112 Q95 104 95 92 L95 73" width={MAIN} delay={0.2} />
			<Stroke d="M111 112 Q105 104 105 92 L105 74" width={MAIN} delay={0.25} />
			<Stroke d="M95 86 Q88 80 82 74 M105 82 Q112 78 118 73" width={MAIN} delay={0.35} />
			<Tufts
				at={[
					[60, GROUND],
					[140, GROUND],
				]}
				seed={604}
			/>
		</>
	);
}

const FOREST_FRONT: ReadonlyArray<readonly [x: number, height: number, width: number]> = [
	[38, 66, 33],
	[72, 76, 33],
	[106, 68, 33],
	[140, 78, 33],
	[171, 60, 28],
];

const FOREST_BACK: ReadonlyArray<readonly [x: number, height: number]> = [
	[55, 92],
	[89, 100],
	[123, 94],
	[156, 88],
];

function Forest() {
	const clip = `forest-${useId().replace(/:/g, "")}`;
	const fronts = FOREST_FRONT.map(([x, height, width]) => spruceOutline(x, GROUND - 7, height, width));
	return (
		<>
			<defs>
				<clipPath id={clip}>
					<path
						clipRule="evenodd"
						d={`M0 0 H200 V130 H0 Z ${fronts.map((points) => `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`).join(" ")}`}
					/>
				</clipPath>
			</defs>
			<Ground />
			<g clipPath={`url(#${clip})`}>
				{FOREST_BACK.map(([x, height], i) => (
					<Spruce key={x} x={x} height={height} width={30} seed={612 + i * 2} tone="soft" delay={0} />
				))}
			</g>
			{FOREST_FRONT.map(([x, height, width], i) => (
				<Spruce key={x} x={x} height={height} width={width} seed={620 + i * 2} hue="sage" delay={0.1 + i * 0.05} />
			))}
		</>
	);
}

function Mountain() {
	return (
		<>
			<Ground />
			<Wash d="M127 76 L150 50 L182 112 L138 112 Z" hue="sky" />
			<Stroke
				d={jaggedD(
					[
						[127, 76],
						[150, 50],
						[182, 112],
					],
					640,
				)}
				tone="graphite"
				width={DETAIL}
				delay={0}
			/>
			<Stroke
				d={jaggedD(
					[
						[142, 62],
						[146, 66],
						[150, 60],
						[154, 66],
						[157, 64],
					],
					641,
				)}
				tone="graphite"
				width={DETAIL}
				delay={0.3}
			/>
			<Wash d="M34 112 L77 44 L107 44 L150 112 Z" hue="sky" />
			<Stroke
				d={jaggedD(
					[
						[34, 112],
						[70, 54],
						[92, 20],
						[116, 58],
						[150, 112],
					],
					642,
				)}
				width={MAIN}
				delay={0.1}
			/>
			<Stroke
				d={jaggedD(
					[
						[76, 45],
						[82, 52],
						[87, 45],
						[93, 54],
						[99, 46],
						[104, 52],
						[108, 45],
					],
					644,
				)}
				width={MAIN}
				delay={0.35}
			/>
			<Stroke
				d={jaggedD(
					[
						[93, 54],
						[86, 80],
						[90, 100],
					],
					646,
				)}
				tone="graphite"
				width={DETAIL}
				delay={0.5}
			/>
			<Stroke
				d={jaggedD(
					[
						[104, 52],
						[116, 76],
						[114, 92],
					],
					648,
				)}
				tone="graphite"
				width={DETAIL}
				delay={0.55}
			/>
		</>
	);
}

function River() {
	const left: Point[] = [
		[97, 40],
		[90, 50],
		[96, 62],
		[80, 78],
		[48, 96],
		[30, 118],
	];
	const right: Point[] = [
		[103, 40],
		[100, 50],
		[114, 62],
		[114, 80],
		[96, 98],
		[92, 118],
	];
	const water = curveD([...left, ...[...right].reverse()], 660, 0);
	return (
		<>
			<Stroke
				d={curveD(
					[
						[16, 44],
						[50, 34],
						[84, 40],
						[118, 30],
						[150, 38],
						[184, 34],
					],
					661,
				)}
				tone="soft"
				width={DETAIL}
				delay={0}
			/>
			<Wash d={`${water} Z`} hue="sky" />
			<Stroke d={curveD(left, 662, 0.5)} width={MAIN} delay={0.1} />
			<Stroke d={curveD(right, 664, 0.5)} width={MAIN} delay={0.15} />
			<Stroke
				d="M96 56 q3 -2 6 0 M98 70 q4 -3 8 0 M86 84 q5 -3 10 0 M68 98 q6 -3 12 0 M56 110 q6 -3 12 0 M76 104 q5 -3 10 0"
				tone="mark"
				width={DETAIL}
				delay={0.5}
			/>
			<Tufts
				at={[
					[136, 74],
					[150, 96],
					[40, 72],
				]}
				seed={666}
			/>
			<Oval cx={150} cy={52} rx={9} ry={8} seed={668} hue="sage" tone="graphite" width={DETAIL} delay={0.4} />
			<L from={[150, 60]} to={[150, 68]} seed={669} tone="graphite" width={DETAIL} delay={0.45} />
			<Oval cx={52} cy={50} rx={8} ry={7} seed={670} hue="sage" tone="graphite" width={DETAIL} delay={0.4} />
			<L from={[52, 57]} to={[52, 64]} seed={671} tone="graphite" width={DETAIL} delay={0.45} />
		</>
	);
}

function waveD(y: number, from: number, to: number, size: number): string {
	let d = `M${from} ${y}`;
	for (let x = from; x + size * 2 <= to; x += size * 2)
		d += ` q${size / 2} ${-size / 1.6} ${size} 0 q${size / 2} ${size / 1.6} ${size} 0`;
	return d;
}

function Sea() {
	return (
		<>
			<Wash d="M14 58 L186 58 L186 112 Q140 116 100 112 Q60 108 14 113 Z" hue="sky" />
			<L from={[14, 58]} to={[186, 58]} seed={680} />
			<Stroke
				d="M132 54 L150 54 L147 58 L135 58 Z M141 54 L141 36 L150 52 L141 52"
				tone="graphite"
				width={DETAIL}
				delay={0.3}
			/>
			<Stroke d={waveD(70, 28, 96, 6)} tone="graphite" width={DETAIL} delay={0.4} />
			<Stroke d={waveD(72, 116, 176, 6)} tone="graphite" width={DETAIL} delay={0.45} />
			<Stroke d={waveD(86, 18, 110, 9)} width={DETAIL} delay={0.5} />
			<Stroke d={waveD(90, 124, 186, 9)} width={DETAIL} delay={0.55} />
			<Stroke d={waveD(106, 14, 186, 12)} width={MAIN} delay={0.6} />
		</>
	);
}

const REEDS: ReadonlyArray<readonly [x: number, top: number]> = [
	[22, 76],
	[28, 70],
	[34, 80],
	[166, 78],
	[172, 72],
];

function Lake() {
	return (
		<>
			<Stroke
				d={curveD(
					[
						[16, 68],
						[44, 46],
						[74, 52],
						[110, 34],
						[150, 48],
						[184, 68],
					],
					700,
				)}
				tone="soft"
				width={DETAIL}
				delay={0}
			/>
			<Spruce x={62} base={62} height={20} width={10} seed={702} tone="graphite" />
			<Spruce x={74} base={63} height={26} width={12} seed={704} tone="graphite" />
			<Spruce x={136} base={62} height={22} width={10} seed={706} tone="graphite" />
			<Oval cx={100} cy={86} rx={64} ry={19} seed={708} hue="sky" delay={0.2} />
			<Stroke d="M66 80 h16 M98 76 h22 M126 84 h16 M80 94 h20 M114 98 h14" tone="graphite" width={DETAIL} delay={0.5} />
			{REEDS.map(([x, top], i) => (
				<g key={x}>
					<Stroke
						d={`M${x} 110 Q${x - 1} ${(110 + top) / 2 + 6} ${x + 1} ${top + 12}`}
						tone="graphite"
						width={DETAIL}
						delay={0.6 + i * 0.05}
					/>
					<Oval
						cx={x + 1}
						cy={top + 6}
						rx={2.6}
						ry={6}
						seed={720 + i}
						hue="ochre"
						width={DETAIL}
						delay={0.7 + i * 0.05}
					/>
				</g>
			))}
			<Tufts
				at={[
					[60, 116],
					[104, 118],
					[146, 116],
				]}
				seed={730}
			/>
		</>
	);
}

function Flower() {
	const head: Point = [100, 40];
	return (
		<>
			<Ground />
			<Stroke d="M100 112 Q96 88 101 68 Q103 60 100 54" width={MAIN} delay={0.1} />
			<Outline
				points={[
					[99, 90],
					[86, 80],
					[72, 80],
					[84, 92],
				]}
				hue="sage"
				seed={740}
				delay={0.3}
			/>
			<Outline
				points={[
					[101, 78],
					[114, 68],
					[130, 68],
					[116, 82],
				]}
				hue="sage"
				seed={742}
				delay={0.35}
			/>
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<g key={i} transform={`rotate(${i * 60 + 10} ${head[0]} ${head[1]})`}>
					<Oval cx={head[0]} cy={head[1] - 20} rx={9} ry={11.5} seed={744 + i} hue="rose" delay={0.4 + i * 0.05} />
				</g>
			))}
			<Oval cx={head[0]} cy={head[1]} rx={9} ry={9} seed={752} hue="ochre" delay={0.75} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	tree: Tree,
	forest: Forest,
	mountain: Mountain,
	river: River,
	sea: Sea,
	lake: Lake,
	flower: Flower,
};

export function NatureScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
