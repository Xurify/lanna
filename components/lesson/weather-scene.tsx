import type { CSSProperties } from "react";
import { Sheet, Stroke, type InkTone } from "@/components/lesson/ink";
import { curveD, inkRandom, lineD, loopD, patchD, smoothD, type Point } from "@/components/lesson/ink-paths";
import type { WeatherScene as Scene } from "@/src/core";

const MAIN = 1.7;
const DETAIL = 1.3;
const ACCENT = 2.1;
const GROUND = 112;

type Hue = "ochre" | "rose" | "sage" | "sky";

function Wash({ d, hue, delay = 0.45 }: { d: string; hue: Hue; delay?: number }) {
	return (
		<path
			d={d}
			transform="translate(1.5 1.5)"
			className={`ink-fade q-wash-${hue}`}
			style={{ "--ink-delay": `${delay}s` } as CSSProperties}
		/>
	);
}

function L({
	from,
	to,
	seed,
	tone = "ink",
	width = MAIN,
	delay = 0,
}: {
	from: Point;
	to: Point;
	seed: number;
	tone?: InkTone;
	width?: number;
	delay?: number;
}) {
	return <Stroke d={lineD(from, to, seed, 0.8)} tone={tone} width={width} delay={delay} />;
}

function Ground({ from = 22, to = 178, seed = 1 }: { from?: number; to?: number; seed?: number }) {
	return <L from={[from, GROUND]} to={[to, GROUND]} seed={seed} tone="soft" width={DETAIL} />;
}

const CLOUD: readonly Point[] = [
	[-46, 14],
	[-52, 2],
	[-42, -9],
	[-28, -10],
	[-20, -24],
	[-2, -30],
	[14, -22],
	[24, -26],
	[40, -18],
	[48, -4],
	[50, 10],
	[36, 16],
	[0, 17],
];

function cloudD(cx: number, cy: number, scale: number, seed: number): string {
	const random = inkRandom(seed);
	return smoothD(
		CLOUD.map(([x, y]): Point => [cx + x * scale + (random() - 0.5) * 1.6, cy + y * scale + (random() - 0.5) * 1.6]),
		true,
	);
}

function Cloud({
	cx,
	cy,
	scale = 1,
	seed,
	delay = 0.1,
}: {
	cx: number;
	cy: number;
	scale?: number;
	seed: number;
	delay?: number;
}) {
	const d = cloudD(cx, cy, scale, seed);
	return (
		<>
			<Wash d={d} hue="sky" />
			<Stroke d={d} width={MAIN} delay={delay} />
		</>
	);
}

function Sun({
	cx,
	cy,
	r,
	rays = 10,
	seed,
	delay = 0.1,
}: {
	cx: number;
	cy: number;
	r: number;
	rays?: number;
	seed: number;
	delay?: number;
}) {
	const disc = loopD(cx, cy, r, r, seed);
	return (
		<>
			<path
				d={patchD(cx + 1.5, cy + 1.5, r, r, seed + 1)}
				className="ink-fade q-wash-ochre"
				style={{ "--ink-delay": "0.45s" } as CSSProperties}
			/>
			<Stroke d={disc} width={MAIN} delay={delay} />
			{Array.from({ length: rays }, (_, i) => {
				const angle = (i / rays) * Math.PI * 2 + 0.2;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				return (
					<L
						key={i}
						from={[cx + cos * (r + 6), cy + sin * (r + 6)]}
						to={[cx + cos * (r + 6 + r * 0.45), cy + sin * (r + 6 + r * 0.45)]}
						seed={seed + 10 + i}
						delay={delay + 0.25 + i * 0.03}
					/>
				);
			})}
		</>
	);
}

function Flake({ cx, cy, r, seed, delay = 0.4 }: { cx: number; cy: number; r: number; seed: number; delay?: number }) {
	const pen = { tone: "mark" as const, width: ACCENT * 0.75, delay };
	const twig = r * 0.38;
	return (
		<>
			{[0, 1, 2].map((i) => {
				const angle = Math.PI / 2 + (i * Math.PI) / 3;
				const dx = Math.cos(angle) * r;
				const dy = Math.sin(angle) * r;
				return <L key={i} from={[cx - dx, cy - dy]} to={[cx + dx, cy + dy]} seed={seed + i} {...pen} />;
			})}
			{[0, 1, 2, 3, 4, 5].map((i) => {
				const angle = Math.PI / 2 + (i * Math.PI) / 3;
				const at: Point = [cx + Math.cos(angle) * r * 0.62, cy + Math.sin(angle) * r * 0.62];
				return [-1, 1].map((side) => {
					const branch = angle + side * 0.75;
					return (
						<L
							key={`${i}${side}`}
							from={at}
							to={[at[0] + Math.cos(branch) * twig, at[1] + Math.sin(branch) * twig]}
							seed={seed + 10 + i * 2 + side}
							{...pen}
							width={ACCENT * 0.6}
						/>
					);
				});
			})}
		</>
	);
}

function Drops({
	cx,
	top,
	seed,
	scale = 1,
	delay = 0.45,
}: {
	cx: number;
	top: number;
	seed: number;
	scale?: number;
	delay?: number;
}) {
	const drops: Point[] = [
		[-30, 0],
		[-12, 4],
		[6, 0],
		[24, 4],
		[-22, 20],
		[-4, 24],
		[14, 20],
		[32, 24],
	];
	return (
		<>
			{drops.map(([x, y], i) => (
				<L
					key={i}
					from={[cx + (x + 3) * scale, top + y * scale]}
					to={[cx + (x - 2) * scale, top + (y + 11) * scale]}
					seed={seed + i}
					tone="mark"
					width={ACCENT}
					delay={delay + i * 0.04}
				/>
			))}
		</>
	);
}

function Gust({
	y,
	from,
	to,
	curl,
	seed,
	delay,
}: {
	y: number;
	from: number;
	to: number;
	curl: number;
	seed: number;
	delay: number;
}) {
	const points: Point[] = [
		[from, y],
		[(from + to) / 2, y - 3],
		[to, y],
		[to + curl * 0.9, y - curl * 0.6],
		[to + curl * 0.4, y - curl * 1.3],
		[to - curl * 0.2, y - curl * 0.9],
	];
	return <Stroke d={curveD(points, seed, 0.4)} tone="mark" width={ACCENT} delay={delay} />;
}

function Leaf({ x, y, delay }: { x: number; y: number; delay: number }) {
	return (
		<Stroke
			d={`M${x - 6} ${y + 1} Q${x} ${y - 5} ${x + 6} ${y - 1} Q${x} ${y + 5} ${x - 6} ${y + 1} L${x + 4} ${y - 0.5}`}
			tone="graphite"
			width={DETAIL}
			delay={delay}
		/>
	);
}

function SunScene() {
	return (
		<>
			<Sun cx={100} cy={65} r={26} seed={70} />
		</>
	);
}

function Rain() {
	return (
		<>
			<Ground />
			<Cloud cx={100} cy={42} seed={80} />
			<Drops cx={100} top={66} seed={90} />
			<Stroke d={loopD(100, GROUND - 1, 26, 4, 99)} tone="graphite" width={DETAIL} delay={0.8} />
		</>
	);
}

function Snow() {
	const drift = curveD(
		[
			[22, GROUND],
			[54, GROUND - 9],
			[96, GROUND - 4],
			[140, GROUND - 11],
			[178, GROUND - 2],
		],
		110,
	);
	return (
		<>
			<Ground />
			<Stroke d={drift} width={MAIN} delay={0.1} />
			<Flake cx={48} cy={30} r={9} seed={120} delay={0.3} />
			<Flake cx={98} cy={22} r={11} seed={124} delay={0.38} />
			<Flake cx={150} cy={36} r={9} seed={128} delay={0.46} />
			<Flake cx={70} cy={66} r={8} seed={132} delay={0.54} />
			<Flake cx={128} cy={72} r={10} seed={136} delay={0.62} />
		</>
	);
}

function Wind() {
	const trunk = curveD(
		[
			[56, GROUND],
			[58, 92],
			[64, 74],
		],
		140,
	);
	const crown = smoothD(
		[
			[56, 70],
			[60, 54],
			[78, 46],
			[100, 52],
			[108, 62],
			[96, 74],
			[74, 78],
		],
		true,
	);
	return (
		<>
			<Ground />
			<Wash d={crown} hue="sage" />
			<Stroke d={trunk} width={MAIN} delay={0.1} />
			<Stroke d={crown} width={MAIN} delay={0.2} />
			<Gust y={40} from={110} to={160} curl={10} seed={150} delay={0.5} />
			<Gust y={64} from={122} to={172} curl={9} seed={152} delay={0.6} />
			<Gust y={88} from={104} to={150} curl={8} seed={154} delay={0.7} />
			<Leaf x={134} y={77} delay={0.8} />
			<Leaf x={154} y={101} delay={0.85} />
		</>
	);
}

function CloudScene() {
	return (
		<>
			<Cloud cx={100} cy={70} scale={1.2} seed={160} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	sun: SunScene,
	rain: Rain,
	snow: Snow,
	wind: Wind,
	cloud: CloudScene,
};

export function WeatherScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
