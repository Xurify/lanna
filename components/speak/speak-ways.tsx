import type { ReactNode } from "react";
import { Sheet, Stroke } from "@/components/lesson/ink";
import { curveD, type Point } from "@/components/lesson/ink-paths";
import { B, C, Cloud, fine, Ground, Highlight, L, O, Person } from "@/components/reading/cover-scene";

const VIEW = "0 0 200 120";

function bubblePoints(cx: number, cy: number, w: number, h: number, tail: Point): Point[] {
	const left = cx - w / 2;
	const right = cx + w / 2;
	const top = cy - h / 2;
	const bottom = cy + h / 2;
	const base = Math.min(Math.max(tail[0], left + 8), right - 8);
	return [
		[left + 4, top],
		[right - 4, top],
		[right, top + 4],
		[right, bottom - 4],
		[right - 4, bottom],
		[base + 4, bottom],
		tail,
		[base - 3, bottom],
		[left + 4, bottom],
		[left, bottom - 4],
		[left, top + 4],
		[left + 4, top],
	];
}

function Bubble({
	cx,
	cy,
	w,
	h,
	tail,
	seed,
	lit,
	delay = 0.4,
}: {
	cx: number;
	cy: number;
	w: number;
	h: number;
	tail: Point;
	seed: number;
	lit?: boolean;
	delay?: number;
}) {
	const points = bubblePoints(cx, cy, w, h, tail);
	return (
		<g>
			{lit && (
				<path
					d={curveD(points, seed, 0.4)}
					className="ink-fade q-ink-patch"
					style={{ "--ink-delay": `${delay - 0.05}s` } as React.CSSProperties}
				/>
			)}
			<C points={points} seed={seed} delay={delay} tone={lit ? "ink" : "graphite"} width={lit ? 1.7 : 1.3} />
			<L from={[cx - w / 2 + 7, cy - 2.5]} to={[cx + w / 2 - 7, cy - 2.5]} {...fine(seed + 1, delay + 0.15)} />
			<L from={[cx - w / 2 + 7, cy + 3]} to={[cx + w / 6, cy + 3]} {...fine(seed + 2, delay + 0.2)} />
		</g>
	);
}

function Voice({
	x,
	y,
	dir,
	seed,
	delay = 0.5,
	count = 3,
	step = 4,
}: {
	x: number;
	y: number;
	dir: 1 | -1;
	seed: number;
	delay?: number;
	count?: number;
	step?: number;
}) {
	return (
		<>
			{Array.from({ length: count }, (_, i) => {
				const reach = 3 + i * step;
				const span = 3.5 + i * 2.2;
				return (
					<C
						key={i}
						points={[
							[x + dir * reach, y - span],
							[x + dir * (reach + 2.6), y],
							[x + dir * reach, y + span],
						]}
						seed={seed + i}
						tone="mark"
						width={1.6}
						delay={delay + i * 0.08}
					/>
				);
			})}
		</>
	);
}

function TutorSketch() {
	return (
		<Sheet viewBox={VIEW} className="w-full">
			<Ground seed={1} />
			<L from={[80, 80]} to={[120, 80]} seed={2} />
			<L from={[86, 80]} to={[86, 104]} seed={3} tone="graphite" width={1.2} />
			<L from={[114, 80]} to={[114, 104]} seed={4} tone="graphite" width={1.2} />
			<B x={88} y={72} w={7} h={8} seed={5} tone="graphite" width={1.2} delay={0.3} />
			<B x={105} y={72} w={7} h={8} seed={6} tone="graphite" width={1.2} delay={0.3} />
			<Person
				x={58}
				top={42}
				height={62}
				seed={10}
				hair="short"
				arms={[
					[
						[48, 72],
						[48, 82],
					],
					[
						[74, 70],
						[84, 76],
					],
				]}
			/>
			<Person
				x={142}
				top={42}
				height={62}
				seed={30}
				hair="bun"
				dress
				arms={[
					[
						[126, 70],
						[116, 76],
					],
					[
						[152, 72],
						[152, 82],
					],
				]}
			/>
			<Bubble cx={150} cy={18} w={40} h={20} tail={[144, 36]} seed={50} delay={0.35} />
			<Bubble cx={50} cy={24} w={40} h={20} tail={[57, 40]} seed={60} lit delay={0.6} />
		</Sheet>
	);
}

function LiveSketch() {
	return (
		<Sheet viewBox={VIEW} className="w-full">
			<Ground seed={101} from={14} to={84} />
			<Ground seed={102} from={116} to={186} />
			<Person
				x={50}
				top={42}
				height={62}
				seed={110}
				hair="short"
				arms={[
					[
						[40, 72],
						[40, 82],
					],
					[
						[64, 62],
						[59, 50],
					],
				]}
			/>
			<B x={57} y={42} w={5} h={12} seed={125} delay={0.3} />
			<Person
				x={150}
				top={42}
				height={62}
				seed={130}
				hair="bun"
				dress
				arms={[
					[
						[136, 62],
						[141, 50],
					],
					[
						[160, 72],
						[160, 82],
					],
				]}
			/>
			<B x={138} y={42} w={5} h={12} seed={145} delay={0.3} />
			<Highlight cx={100} cy={51} rx={13} ry={17} seed={150} />
			<Voice x={66} y={50} dir={1} seed={160} count={5} step={7.5} />
			<Voice x={134} y={50} dir={-1} seed={170} count={5} step={7.5} delay={0.55} />
		</Sheet>
	);
}

function SoloSketch() {
	const wave = [3, 7, 11, 6, 9, 4, 8, 5];
	return (
		<Sheet viewBox={VIEW} className="w-full">
			<Ground seed={201} />
			<L from={[112, 80]} to={[176, 80]} seed={202} />
			<L from={[118, 80]} to={[118, 104]} seed={203} tone="graphite" width={1.2} />
			<L from={[170, 80]} to={[170, 104]} seed={204} tone="graphite" width={1.2} />
			<Person
				x={66}
				top={42}
				height={62}
				seed={210}
				hair="short"
				arms={[
					[
						[56, 72],
						[56, 82],
					],
					[
						[80, 70],
						[84, 80],
					],
				]}
			/>
			<Highlight cx={136} cy={63} rx={15} ry={19} seed={230} />
			<B x={126} y={46} w={20} h={33} seed={231} delay={0.3} />
			<L from={[132, 76]} to={[140, 76]} {...fine(232, 0.4)} />
			{wave.map((h, i) => (
				<L
					key={i}
					from={[129.5 + i * 2, 61 - h / 2]}
					to={[129.5 + i * 2, 61 + h / 2]}
					seed={240 + i}
					tone="mark"
					width={1.3}
					delay={0.6 + i * 0.04}
				/>
			))}
			<O cx={161} cy={71} rx={7} seed={250} delay={0.35} />
			<L from={[161, 64]} to={[161, 61]} seed={251} delay={0.35} />
			<L from={[158, 61]} to={[164, 61]} seed={252} delay={0.35} />
			<L from={[161, 71]} to={[164, 67]} {...fine(253, 0.45)} />
			<Voice x={80} y={50} dir={1} seed={260} />
		</Sheet>
	);
}

function Isle({ points, seed, tone }: { points: Point[]; seed: number; tone?: "ink" | "graphite" }) {
	return <C points={points} seed={seed} tone={tone} />;
}

function Ripples({ at, seed }: { at: Point[]; seed: number }) {
	return (
		<>
			{at.map(([x, y], i) => (
				<C
					key={`${x}-${y}`}
					points={[
						[x, y],
						[x + 4, y - 1.5],
						[x + 8, y],
						[x + 12, y - 1.5],
						[x + 16, y],
					]}
					seed={seed + i}
					tone="soft"
					width={1.1}
				/>
			))}
		</>
	);
}

function Water({ y = 100, from = 12, to = 188, seed }: { y?: number; from?: number; to?: number; seed: number }) {
	const mid = (from + to) / 2;
	return (
		<C
			points={[
				[from, y],
				[(from + mid) / 2, y - 1.4],
				[mid, y + 0.6],
				[(mid + to) / 2, y - 1.4],
				[to, y],
			]}
			seed={seed}
			tone="soft"
			width={1.2}
		/>
	);
}

function Palm({ x, base, height, seed }: { x: number; base: number; height: number; seed: number }) {
	const top: Point = [x + height * 0.18, base - height];
	return (
		<>
			<C
				points={[[x, base], [x + height * 0.04, base - height * 0.5], top]}
				seed={seed}
				tone="graphite"
				width={1.4}
				delay={0.25}
			/>
			{[
				[-14, 4],
				[-10, -5],
				[12, -4],
				[15, 5],
			].map(([dx, dy], i) => (
				<C
					key={i}
					points={[top, [top[0] + dx! * 0.55, top[1] + dy! - 3], [top[0] + dx!, top[1] + dy! + 2]]}
					seed={seed + 1 + i}
					tone="graphite"
					width={1.3}
					delay={0.32 + i * 0.04}
				/>
			))}
		</>
	);
}

function Trail({ points, seed }: { points: Point[]; seed: number }) {
	return (
		<>
			{points.map(([x, y], i) => (
				<O key={i} cx={x} cy={y} rx={2.2} ry={1.2} seed={seed + i} tone="graphite" width={1} delay={0.6 + i * 0.05} />
			))}
		</>
	);
}

function IslandSketch() {
	return (
		<Sheet viewBox={VIEW} className="w-full">
			<Water seed={401} />
			<L from={[82, 80.5]} to={[124, 80.5]} seed={402} tone="soft" width={1.1} />
			<L from={[154, 62.5]} to={[188, 62.5]} seed={403} tone="soft" width={1.1} />
			<Ripples
				at={[
					[24, 108],
					[96, 106],
					[150, 109],
				]}
				seed={404}
			/>
			<Highlight cx={45} cy={94} rx={30} ry={7} seed={410} />
			<Isle
				points={[
					[14, 100],
					[26, 90],
					[44, 86],
					[62, 90],
					[76, 100],
				]}
				seed={411}
			/>
			<Isle
				points={[
					[118, 100],
					[130, 92],
					[148, 89],
					[164, 92],
					[180, 100],
				]}
				seed={412}
				tone="graphite"
			/>
			<Isle
				points={[
					[86, 80],
					[94, 75.5],
					[104, 74],
					[114, 75.5],
					[121, 80],
				]}
				seed={413}
				tone="graphite"
			/>
			<Isle
				points={[
					[158, 62],
					[164, 59],
					[171, 58.5],
					[178, 59.5],
					[184, 62],
				]}
				seed={414}
				tone="graphite"
			/>
			<Palm x={140} base={89} height={20} seed={420} />
			<Stroke d="M98 66 L99 73 Q103.5 75.5 108 73 L109 66 Z" tone="graphite" width={1.2} delay={0.3} />
			<C
				points={[
					[109, 67.5],
					[112.5, 68.5],
					[108.5, 71.5],
				]}
				seed={421}
				tone="graphite"
				width={1.1}
				delay={0.35}
			/>
			<C
				points={[
					[101.5, 63.5],
					[100.5, 61],
					[102, 58.5],
				]}
				seed={422}
				tone="soft"
				width={1}
				delay={0.45}
			/>
			<C
				points={[
					[105.5, 63.5],
					[104.5, 61],
					[106, 58.5],
				]}
				seed={423}
				tone="soft"
				width={1}
				delay={0.5}
			/>
			<L from={[171, 58.5]} to={[171, 50]} seed={425} tone="graphite" width={1.1} />
			<Cloud cx={171} cy={46} rx={5} ry={4.5} bumps={5} seed={426} tone="graphite" width={1.1} delay={0.3} />
			<Trail
				points={[
					[86, 99],
					[96, 98],
					[106, 99],
				]}
				seed={430}
			/>
			<Trail
				points={[
					[74, 90],
					[79, 85.5],
				]}
				seed={435}
			/>
			<Trail
				points={[
					[128, 76],
					[138, 71],
					[148, 66],
				]}
				seed={438}
			/>
			<Person
				x={42}
				top={46}
				height={40}
				seed={440}
				hair="short"
				arms={[
					[
						[35, 66],
						[34, 73],
					],
					[
						[50, 66],
						[52, 73],
					],
				]}
			/>
			<Voice x={49} y={53} dir={1} seed={455} />
		</Sheet>
	);
}

export type SpeakWayId = "tutor" | "live" | "solo" | "islands";

export interface SpeakWay {
	id: SpeakWayId;
	href: string;
	title: string;
	line: string;
	Sketch: () => ReactNode;
}

export const SPEAK_WAYS: SpeakWay[] = [
	{
		id: "tutor",
		href: "/speak/tutor",
		title: "With a tutor",
		line: "The tutor plays the other person in a scene and answers you, one turn at a time.",
		Sketch: TutorSketch,
	},
	{
		id: "live",
		href: "/speak/live",
		title: "Live call",
		line: "A real conversation: you both speak freely, and either of you can interrupt.",
		Sketch: LiveSketch,
	},
	{
		id: "solo",
		href: "/speak/self-talk",
		title: "On your own",
		line: "Talk about a topic for a few minutes, then hear it back with what to fix.",
		Sketch: SoloSketch,
	},
	{
		id: "islands",
		href: "/speak/islands",
		title: "Language islands",
		line: "Prepare one topic well enough to hold a whole conversation about it.",
		Sketch: IslandSketch,
	},
];
