import type { CSSProperties } from "react";
import { Sheet, Stroke } from "@/components/lesson/ink";
import { smoothD, type Point } from "@/components/lesson/ink-paths";
import { ACCENT, DETAIL, Ground, MAIN, Oval, Outline } from "@/components/lesson/scene-kit";
import type { AnimalScene as Scene } from "@/src/core";

function Eye({ x, y }: { x: number; y: number }) {
	return (
		<path
			d={smoothD(
				[
					[x - 1.6, y],
					[x, y - 1.6],
					[x + 1.6, y],
					[x, y + 1.6],
				],
				true,
			)}
			className="ink-fade fill-current text-foreground"
			style={{ "--ink-delay": "0.6s" } as CSSProperties}
		/>
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

function Dog() {
	return (
		<>
			<Ground />
			<Stroke d="M84 88 L82 112 M142 90 L146 112" tone="graphite" width={DETAIL} delay={0.1} />
			<Outline
				points={[
					[30, 52],
					[36, 46],
					[48, 44],
					[56, 36],
					[66, 33],
					[74, 38],
					[78, 50],
					[92, 58],
					[122, 58],
					[142, 60],
					[150, 70],
					[148, 84],
					[146, 98],
					[150, 110],
					[140, 112],
					[137, 98],
					[132, 90],
					[112, 90],
					[96, 90],
					[92, 100],
					[92, 112],
					[82, 112],
					[80, 96],
					[74, 84],
					[64, 72],
					[58, 62],
					[46, 60],
					[34, 58],
				]}
				hue="ochre"
				seed={800}
			/>
			<Outline
				points={[
					[60, 38],
					[70, 36],
					[76, 46],
					[74, 58],
					[68, 58],
					[63, 48],
				]}
				hue="ochre"
				seed={802}
				delay={0.3}
			/>
			<Stroke d="M147 64 Q158 54 160 40" width={MAIN} delay={0.35} />
			<Stroke d="M78 50 Q72 60 64 66" tone="mark" width={ACCENT} delay={0.55} />
			<Oval cx={31} cy={52} rx={2.6} ry={2.2} seed={804} delay={0.5} />
			<Eye x={50} y={45} />
			<Stroke d="M36 57 Q42 58 46 56" tone="graphite" width={DETAIL} delay={0.6} />
		</>
	);
}

function Cat() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[90, 58],
					[78, 72],
					[70, 92],
					[72, 112],
					[122, 112],
					[126, 92],
					[118, 70],
					[106, 58],
				]}
				hue="ochre"
				seed={820}
				closed={false}
			/>
			<Outline
				points={[
					[80, 46],
					[80, 30],
					[83, 16],
					[94, 27],
					[102, 27],
					[113, 16],
					[116, 30],
					[116, 46],
					[108, 58],
					[98, 61],
					[88, 58],
				]}
				hue="ochre"
				seed={822}
				delay={0.2}
			/>
			<Stroke d="M90 76 Q89 96 90 112 M104 76 Q105 96 104 112" tone="graphite" width={DETAIL} delay={0.35} />
			<Stroke d="M122 110 Q146 114 156 100 Q162 88 152 80" width={MAIN} delay={0.4} />
			<Eye x={91} y={40} />
			<Eye x={105} y={40} />
			<Stroke d="M96 46 L100 46 L98 49 Z" width={DETAIL} delay={0.55} />
			<Stroke
				d="M90 48 L68 44 M90 51 L68 52 M90 54 L70 59 M106 48 L128 44 M106 51 L128 52 M106 54 L126 59"
				tone="graphite"
				width={DETAIL}
				delay={0.65}
			/>
		</>
	);
}

function Horse() {
	return (
		<>
			<Ground />
			<Stroke d="M90 80 L92 112 M140 82 Q146 96 140 112" tone="graphite" width={DETAIL} delay={0.1} />
			<Outline
				points={[
					[28, 62],
					[22, 55],
					[26, 46],
					[36, 30],
					[42, 22],
					[45, 15],
					[50, 21],
					[60, 30],
					[72, 44],
					[82, 50],
					[104, 52],
					[128, 51],
					[146, 52],
					[156, 64],
					[152, 78],
					[150, 92],
					[154, 100],
					[152, 112],
					[144, 112],
					[144, 98],
					[140, 84],
					[128, 80],
					[106, 82],
					[88, 80],
					[84, 90],
					[84, 112],
					[76, 112],
					[76, 92],
					[72, 78],
					[66, 66],
					[56, 54],
					[46, 50],
					[38, 60],
				]}
				hue="ochre"
				seed={840}
			/>
			<Stroke
				d="M48 22 Q40 26 38 22 M53 22 Q60 28 58 34 M58 28 Q66 34 64 40 M64 34 Q72 40 70 46 M70 40 Q78 46 77 52 M76 46 Q84 50 85 55"
				width={MAIN}
				delay={0.4}
			/>
			<Stroke d="M76 110 H84 M144 110 H152" width={MAIN} delay={0.5} />
			<Stroke d="M155 60 Q168 74 166 100 M155 62 Q164 80 160 102 M154 64 Q174 80 172 96" width={MAIN} delay={0.45} />
			<Eye x={40} y={31} />
			<Oval cx={27} cy={52} rx={1.8} ry={1.4} seed={844} tone="graphite" width={DETAIL} delay={0.6} />
		</>
	);
}

function Cow() {
	return (
		<>
			<Ground />
			<Stroke d="M96 88 L96 112 M142 88 L140 112" tone="graphite" width={DETAIL} delay={0.1} />
			<Outline
				points={[
					[62, 50],
					[100, 46],
					[140, 46],
					[158, 50],
					[162, 64],
					[158, 80],
					[158, 112],
					[148, 112],
					[148, 92],
					[140, 86],
					[100, 88],
					[88, 88],
					[86, 112],
					[76, 112],
					[76, 90],
					[66, 82],
					[60, 66],
				]}
				seed={860}
			/>
			<Outline
				points={[
					[60, 50],
					[44, 44],
					[32, 48],
					[26, 62],
					[28, 76],
					[42, 78],
					[52, 70],
					[60, 64],
				]}
				seed={862}
				delay={0.2}
			/>
			<Oval cx={34} cy={72} rx={9} ry={6} seed={864} hue="rose" tone="graphite" width={DETAIL} delay={0.35} />
			<Stroke d="M40 45 Q34 40 34 32 M52 46 Q58 40 60 32" width={MAIN} delay={0.4} />
			<Stroke d="M60 52 Q68 48 72 52 Q68 56 60 56" tone="graphite" width={DETAIL} delay={0.45} />
			<Outline
				points={[
					[126, 87],
					[128, 96],
					[136, 98],
					[142, 92],
					[141, 86],
				]}
				hue="rose"
				seed={866}
				delay={0.5}
				closed={false}
			/>
			<Stroke d="M161 56 Q170 72 168 92" width={DETAIL} delay={0.5} />
			<Oval cx={168} cy={96} rx={2.8} ry={4} seed={868} tone="graphite" width={DETAIL} delay={0.55} />
			<Spot
				points={[
					[88, 52],
					[104, 50],
					[110, 60],
					[102, 70],
					[90, 66],
				]}
			/>
			<Spot
				points={[
					[124, 58],
					[140, 54],
					[150, 62],
					[146, 74],
					[130, 76],
					[122, 68],
				]}
			/>
			<Spot
				points={[
					[72, 64],
					[80, 66],
					[82, 76],
					[74, 80],
					[68, 72],
				]}
			/>
			<Eye x={42} y={56} />
		</>
	);
}

function Bird() {
	return (
		<>
			<Stroke
				d="M24 100 Q70 94 112 96 Q148 98 178 90 M144 97 Q152 104 160 106"
				tone="graphite"
				width={MAIN}
				delay={0}
			/>
			<Outline
				points={[
					[160, 106],
					[170, 98],
					[182, 98],
					[174, 108],
				]}
				hue="sage"
				seed={880}
				delay={0.2}
			/>
			<Stroke d="M160 106 Q170 102 180 99" tone="graphite" width={DETAIL} delay={0.3} />
			<Outline
				points={[
					[66, 40],
					[76, 32],
					[90, 34],
					[110, 48],
					[140, 64],
					[158, 74],
					[152, 82],
					[128, 78],
					[110, 84],
					[90, 82],
					[74, 70],
					[68, 54],
				]}
				hue="sky"
				seed={882}
				delay={0.1}
			/>
			<Stroke d="M67 42 L54 46 L67 50" width={MAIN} delay={0.3} />
			<Stroke d="M92 56 Q112 56 132 70 Q112 74 98 68" tone="graphite" width={DETAIL} delay={0.4} />
			<Stroke
				d="M98 84 L96 96 M90 97 L96 96 L100 99 M110 84 L110 96 M104 97 L110 96 L114 99"
				width={DETAIL}
				delay={0.5}
			/>
			<Eye x={76} y={42} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	dog: Dog,
	cat: Cat,
	horse: Horse,
	cow: Cow,
	bird: Bird,
};

export function AnimalScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
