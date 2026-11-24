import { Sheet, Stroke } from "@/components/lesson/ink";
import { DETAIL, Ground, L, MAIN, Oval, Outline, Rect } from "@/components/lesson/scene-kit";
import type { TransportScene as Scene } from "@/src/core";

function Wheel({ cx, cy, r, seed, delay = 0.3 }: { cx: number; cy: number; r: number; seed: number; delay?: number }) {
	return (
		<>
			<Oval cx={cx} cy={cy} rx={r} ry={r} seed={seed} delay={delay} />
			<Oval
				cx={cx}
				cy={cy}
				rx={r * 0.38}
				ry={r * 0.38}
				seed={seed + 1}
				tone="graphite"
				width={DETAIL}
				delay={delay + 0.1}
			/>
		</>
	);
}

function Car() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[24, 98],
					[22, 82],
					[32, 74],
					[60, 70],
					[78, 50],
					[124, 48],
					[146, 68],
					[170, 72],
					[180, 82],
					[178, 98],
				]}
				hue="rose"
				seed={900}
				closed={false}
			/>
			<Stroke d="M24 98 L40 98 M72 98 L132 98 M164 98 L178 98" width={MAIN} delay={0.2} />
			<Stroke d="M40 98 Q42 82 56 82 Q70 82 72 98 M132 98 Q134 82 148 82 Q162 82 164 98" width={MAIN} delay={0.25} />
			<Wheel cx={56} cy={99} r={12} seed={902} />
			<Wheel cx={148} cy={99} r={12} seed={904} />
			<Outline
				points={[
					[70, 70],
					[84, 55],
					[100, 54],
					[100, 70],
				]}
				hue="sky"
				seed={906}
				delay={0.4}
			/>
			<Outline
				points={[
					[106, 70],
					[106, 54],
					[122, 54],
					[138, 70],
				]}
				hue="sky"
				seed={908}
				delay={0.45}
			/>
			<Stroke d="M103 72 L103 96 M110 78 L118 78" tone="graphite" width={DETAIL} delay={0.55} />
			<Stroke d="M172 78 L178 80" width={MAIN} delay={0.6} />
		</>
	);
}

function Bus() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[22, 100],
					[20, 36],
					[26, 30],
					[168, 30],
					[178, 38],
					[180, 100],
				]}
				hue="ochre"
				seed={910}
				closed={false}
			/>
			<Stroke d="M22 100 L34 100 M66 100 L130 100 M162 100 L180 100" width={MAIN} delay={0.2} />
			<Stroke
				d="M34 100 Q36 86 50 86 Q64 86 66 100 M130 100 Q132 86 146 86 Q160 86 162 100"
				width={MAIN}
				delay={0.25}
			/>
			<Wheel cx={50} cy={101} r={11} seed={912} />
			<Wheel cx={146} cy={101} r={11} seed={914} />
			{[28, 52, 76, 100, 124].map((x, i) => (
				<Rect key={x} x={x} y={40} w={18} h={22} seed={916 + i * 3} hue="sky" width={DETAIL} delay={0.4 + i * 0.05} />
			))}
			<Rect x={150} y={40} w={14} h={52} seed={932} width={DETAIL} delay={0.6} />
			<L from={[157, 40]} to={[157, 92]} seed={934} tone="graphite" width={DETAIL} delay={0.65} />
			<Outline
				points={[
					[168, 40],
					[176, 42],
					[178, 66],
					[168, 66],
				]}
				hue="sky"
				seed={936}
				delay={0.6}
			/>
			<Stroke d="M20 72 L148 72" tone="graphite" width={DETAIL} delay={0.7} />
		</>
	);
}

function Train() {
	const sleepers = [26, 42, 58, 74, 90, 106, 122, 138, 154, 170];
	return (
		<>
			<L from={[16, 108]} to={[184, 108]} seed={940} />
			<Stroke d={sleepers.map((x) => `M${x} 108 L${x - 2} 114`).join(" ")} tone="soft" width={DETAIL} delay={0.1} />
			<Rect x={18} y={52} w={68} h={44} seed={942} hue="sky" delay={0.15} />
			<Stroke d="M16 52 Q52 42 88 52" width={MAIN} delay={0.2} />
			{[24, 44, 64].map((x, i) => (
				<Rect
					key={x}
					x={x}
					y={60}
					w={14}
					h={14}
					seed={944 + i * 3}
					tone="graphite"
					width={DETAIL}
					delay={0.3 + i * 0.05}
				/>
			))}
			<Oval cx={32} cy={101} rx={6} ry={6} seed={954} delay={0.35} />
			<Oval cx={72} cy={101} rx={6} ry={6} seed={956} delay={0.35} />
			<L from={[86, 88]} to={[98, 88]} seed={958} width={DETAIL} delay={0.4} />
			<Rect x={98} y={40} w={26} h={56} seed={960} hue="ochre" delay={0.2} />
			<Stroke d="M94 40 L128 40" width={MAIN} delay={0.25} />
			<Rect x={104} y={48} w={14} h={14} seed={962} tone="graphite" width={DETAIL} delay={0.35} />
			<Outline
				points={[
					[124, 62],
					[168, 62],
					[174, 72],
					[172, 90],
					[124, 90],
				]}
				hue="ochre"
				seed={964}
				delay={0.25}
			/>
			<Stroke d="M152 62 L150 44 L162 44 L160 62" width={MAIN} delay={0.3} />
			<Stroke d="M174 90 L184 104 L168 104" width={MAIN} delay={0.4} />
			<Oval cx={160} cy={32} rx={9} ry={6} seed={966} tone="soft" width={DETAIL} delay={0.6} />
			<Oval cx={146} cy={20} rx={12} ry={7} seed={968} tone="soft" width={DETAIL} delay={0.65} />
			<Wheel cx={112} cy={99} r={9} seed={970} delay={0.4} />
			<Wheel cx={138} cy={99} r={9} seed={972} delay={0.45} />
			<Oval cx={162} cy={102} rx={6} ry={6} seed={974} delay={0.5} />
			<L from={[112, 99]} to={[138, 99]} seed={976} tone="graphite" width={DETAIL} delay={0.55} />
		</>
	);
}

function Plane() {
	return (
		<>
			<Outline
				points={[
					[28, 66],
					[40, 58],
					[150, 54],
					[170, 56],
					[182, 62],
					[178, 70],
					[160, 74],
					[40, 74],
				]}
				hue="sky"
				seed={980}
			/>
			<Outline
				points={[
					[34, 60],
					[24, 28],
					[38, 28],
					[62, 57],
				]}
				hue="sky"
				seed={982}
				delay={0.2}
				closed={false}
			/>
			<Outline
				points={[
					[86, 72],
					[62, 104],
					[78, 104],
					[124, 72],
				]}
				hue="sky"
				seed={984}
				delay={0.3}
				closed={false}
			/>
			<Stroke d="M96 56 L112 40 L122 40 L114 55" tone="graphite" width={DETAIL} delay={0.35} />
			<Oval cx={90} cy={86} rx={10} ry={4.5} seed={986} width={DETAIL} delay={0.4} />
			<Stroke d="M164 60 L174 60 L176 64" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke
				d={[60, 72, 84, 96, 108, 120, 132, 144].map((x) => `M${x} 62 L${x + 2} 62`).join(" ")}
				width={2.6}
				delay={0.55}
			/>
			<Stroke d="M30 92 L50 92 M18 102 L44 102" tone="soft" width={DETAIL} delay={0.7} />
		</>
	);
}

function Tram() {
	return (
		<>
			<L from={[14, 16]} to={[186, 16]} seed={1000} tone="graphite" width={DETAIL} />
			<Stroke d="M40 10 L40 16 M160 10 L160 16" tone="soft" width={DETAIL} delay={0.05} />
			<L from={[18, 108]} to={[182, 108]} seed={1002} />
			<Ground from={18} to={182} seed={1003} />
			<Stroke d="M90 40 L112 40 M96 40 L112 28 L98 17 M88 17 L108 17" width={MAIN} delay={0.15} />
			<Outline
				points={[
					[28, 98],
					[26, 52],
					[34, 40],
					[166, 40],
					[174, 52],
					[172, 98],
				]}
				hue="sage"
				seed={1004}
				delay={0.2}
			/>
			{[38, 64, 90, 116, 142].map((x, i) => (
				<Rect key={x} x={x} y={50} w={20} h={20} seed={1006 + i * 3} hue="sky" width={DETAIL} delay={0.35 + i * 0.05} />
			))}
			<Stroke d="M26 80 L174 80" tone="graphite" width={DETAIL} delay={0.6} />
			{[46, 62, 138, 154].map((x, i) => (
				<Oval key={x} cx={x} cy={102} rx={5.5} ry={5.5} seed={1022 + i * 2} delay={0.5} />
			))}
		</>
	);
}

function Bicycle() {
	return (
		<>
			<Ground />
			<Wheel cx={52} cy={84} r={27} seed={1040} delay={0.1} />
			<Wheel cx={148} cy={84} r={27} seed={1042} delay={0.15} />
			<Stroke d="M52 84 L98 84 L88 50 Z M88 52 L136 50 L98 84" tone="mark" width={MAIN} delay={0.3} />
			<Stroke d="M136 50 L148 84 M136 50 L132 38 M124 36 L142 34" width={MAIN} delay={0.4} />
			<Stroke d="M88 50 L86 42 M78 41 Q86 38 96 42" width={MAIN} delay={0.45} />
			<Oval cx={98} cy={84} rx={5} ry={5} seed={1044} width={DETAIL} delay={0.5} />
			<Stroke d="M98 84 L106 94 M102 95 L110 93" tone="graphite" width={DETAIL} delay={0.55} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	car: Car,
	bus: Bus,
	train: Train,
	plane: Plane,
	tram: Tram,
	bicycle: Bicycle,
};

export function TransportScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
