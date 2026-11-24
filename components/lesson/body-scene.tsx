import type { CSSProperties } from "react";
import { Patch, Sheet, Stroke } from "@/components/lesson/ink";
import { loopD } from "@/components/lesson/ink-paths";
import { DETAIL, MAIN, Oval, Outline } from "@/components/lesson/scene-kit";
import type { BodyScene as Scene } from "@/src/core";

function Dot({ x, y, r = 1.8, delay = 0.6 }: { x: number; y: number; r?: number; delay?: number }) {
	return (
		<path
			d={loopD(x, y, r, r, Math.round(x * 31 + y))}
			className="ink-fade fill-current text-foreground"
			style={{ "--ink-delay": `${delay}s` } as CSSProperties}
		/>
	);
}

function Hand() {
	return (
		<>
			<Outline
				points={[
					[86, 114],
					[86, 98],
					[80, 86],
					[66, 72],
					[58, 62],
					[61, 56],
					[70, 59],
					[82, 70],
					[84, 58],
					[83, 32],
					[86, 25],
					[92, 25],
					[95, 32],
					[96, 54],
					[97, 23],
					[100, 15],
					[106, 15],
					[108, 23],
					[108, 54],
					[110, 28],
					[113, 21],
					[119, 22],
					[120, 30],
					[118, 58],
					[122, 42],
					[126, 36],
					[131, 38],
					[131, 46],
					[126, 68],
					[124, 82],
					[118, 98],
					[116, 114],
				]}
				hue="rose"
				seed={620}
				closed={false}
			/>
			<Stroke d="M90 80 Q102 86 116 76 M94 92 Q104 88 110 82" tone="graphite" width={DETAIL} delay={0.5} />
		</>
	);
}

function Eye() {
	return (
		<>
			<Stroke d="M40 66 Q100 18 160 66" width={MAIN} delay={0} />
			<Stroke d="M40 66 Q100 106 160 66" width={MAIN} delay={0.1} />
			<Oval cx={100} cy={64} rx={18} ry={18} seed={630} hue="sky" delay={0.25} />
			<Dot x={100} y={64} r={8} delay={0.5} />
			<path
				d={loopD(105, 59, 2.6, 2.6, 631)}
				className="ink-fade fill-current text-background"
				style={{ "--ink-delay": "0.7s" } as CSSProperties}
			/>
			<Stroke
				d="M58 52 L52 44 M72 42 L68 33 M88 37 L86 27 M104 36 L105 26 M120 39 L124 30 M136 46 L142 38 M148 54 L155 47"
				width={DETAIL}
				delay={0.55}
			/>
			<Stroke d="M50 30 Q100 6 150 26" tone="graphite" width={MAIN} delay={0.65} />
		</>
	);
}

function Ear() {
	return (
		<>
			<Outline
				points={[
					[86, 34],
					[96, 18],
					[116, 14],
					[134, 22],
					[142, 40],
					[140, 60],
					[130, 76],
					[122, 92],
					[116, 106],
					[104, 112],
					[92, 108],
					[88, 98],
				]}
				hue="rose"
				seed={640}
				closed={false}
			/>
			<Stroke d="M100 40 Q104 28 116 28 Q130 30 130 46 Q130 60 120 70 Q112 80 114 92" width={MAIN} delay={0.35} />
			<Stroke d="M108 54 Q112 46 118 48 Q122 54 116 62 Q108 66 106 76" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke d="M86 34 Q78 64 88 98" tone="soft" width={DETAIL} delay={0.6} />
		</>
	);
}

function Mouth() {
	return (
		<>
			<Outline
				points={[
					[40, 62],
					[62, 46],
					[84, 40],
					[100, 46],
					[116, 40],
					[138, 46],
					[160, 62],
					[138, 88],
					[100, 98],
					[62, 88],
				]}
				hue="rose"
				seed={650}
			/>
			<Outline
				points={[
					[52, 63],
					[76, 56],
					[100, 58],
					[124, 56],
					[148, 63],
					[124, 76],
					[100, 80],
					[76, 76],
				]}
				seed={652}
				delay={0.3}
			/>
			<Stroke d="M70 72 Q86 64 100 68 Q114 64 130 72" tone="graphite" width={DETAIL} delay={0.5} />
		</>
	);
}

function Heart() {
	return (
		<Outline
			points={[
				[100, 40],
				[110, 24],
				[128, 16],
				[146, 22],
				[154, 40],
				[148, 62],
				[128, 84],
				[100, 108],
				[72, 84],
				[52, 62],
				[46, 40],
				[54, 22],
				[72, 16],
				[90, 24],
			]}
			hue="rose"
			seed={660}
		/>
	);
}

function Tooth() {
	return (
		<>
			<Outline
				points={[
					[70, 30],
					[84, 18],
					[100, 24],
					[116, 18],
					[130, 30],
					[132, 52],
					[126, 72],
					[122, 96],
					[116, 112],
					[108, 108],
					[104, 86],
					[100, 78],
					[96, 86],
					[92, 108],
					[84, 112],
					[78, 96],
					[74, 72],
					[68, 52],
				]}
				hue="sky"
				seed={670}
			/>
			<Stroke d="M80 36 Q84 28 92 28" tone="graphite" width={DETAIL} delay={0.5} />
		</>
	);
}

function Face() {
	return (
		<>
			<Oval cx={100} cy={65} rx={42} ry={54} seed={680} hue="rose" />
			<Stroke d="M70 30 Q84 18 100 22 Q116 18 130 30" tone="graphite" width={DETAIL} delay={0.2} />
			<Stroke d="M74 48 Q82 42 92 47 M108 47 Q118 42 126 48" width={MAIN} delay={0.3} />
			<Stroke d="M74 58 Q83 51 92 58 Q83 64 74 58 M108 58 Q117 51 126 58 Q117 64 108 58" width={DETAIL} delay={0.4} />
			<Dot x={83} y={58} r={3.2} />
			<Dot x={117} y={58} r={3.2} />
			<Stroke d="M100 60 L94 82 Q100 86 106 82" width={MAIN} delay={0.6} />
			<Stroke d="M82 96 Q100 108 118 96 M84 97 Q100 100 116 97" width={MAIN} delay={0.7} />
		</>
	);
}

function Back() {
	return (
		<>
			<Patch cx={100} cy={76} rx={30} ry={28} seed={691} delay={0.5} bold />
			<Oval cx={100} cy={22} rx={14} ry={16} seed={692} delay={0.2} />
			<Stroke
				d="M88 14 Q94 22 92 34 M94 8 Q100 20 98 36 M102 7 Q106 20 104 36 M109 10 Q112 22 110 34"
				tone="graphite"
				width={DETAIL}
				delay={0.3}
			/>
			<Stroke d="M86 20 Q82 24 86 30 M114 20 Q118 24 114 30" width={DETAIL} delay={0.35} />
			<Outline
				points={[
					[94, 37],
					[93, 44],
					[70, 48],
					[56, 58],
					[52, 84],
					[50, 122],
					[68, 122],
					[68, 76],
					[70, 104],
					[72, 122],
					[128, 122],
					[130, 104],
					[132, 76],
					[132, 122],
					[150, 122],
					[148, 84],
					[144, 58],
					[130, 48],
					[107, 44],
					[106, 37],
				]}
				seed={694}
				closed={false}
				delay={0.1}
			/>
			<Stroke d="M100 46 Q102 76 100 108" tone="graphite" width={DETAIL} delay={0.4} />
			<Stroke d="M80 60 Q76 72 90 78 M120 60 Q124 72 110 78" width={DETAIL} delay={0.45} />
			<Stroke d="M71 110 L129 110" tone="graphite" width={DETAIL} delay={0.55} />
		</>
	);
}

function Belly() {
	return (
		<>
			<Patch cx={100} cy={76} rx={27} ry={21} seed={701} delay={0.5} bold />
			<Oval cx={100} cy={17} rx={10} ry={11} seed={702} delay={0.2} />
			<Stroke d="M90 14 Q92 5 100 6 Q109 5 110 14" tone="graphite" width={DETAIL} delay={0.3} />
			<Dot x={96} y={17} r={1.3} />
			<Dot x={104} y={17} r={1.3} />
			<Stroke d="M96 22 Q100 24 104 22" tone="graphite" width={DETAIL} delay={0.6} />
			<Outline
				points={[
					[95, 28],
					[94, 33],
					[76, 37],
					[66, 44],
					[60, 70],
					[58, 96],
					[64, 98],
					[68, 72],
					[72, 54],
					[72, 64],
					[70, 80],
					[74, 96],
					[78, 104],
					[78, 124],
					[122, 124],
					[122, 104],
					[126, 96],
					[130, 80],
					[128, 64],
					[128, 54],
					[132, 72],
					[136, 98],
					[142, 96],
					[140, 70],
					[134, 44],
					[124, 37],
					[106, 33],
					[105, 28],
				]}
				seed={704}
				closed={false}
				delay={0.1}
			/>
			<Stroke d="M84 50 Q90 54 96 50 M104 50 Q110 54 116 50" tone="graphite" width={DETAIL} delay={0.4} />
			<Dot x={100} y={80} r={2} delay={0.65} />
			<Stroke d="M78 104 Q100 100 122 104 M100 104 L100 124" tone="graphite" width={DETAIL} delay={0.55} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	hand: Hand,
	eye: Eye,
	ear: Ear,
	mouth: Mouth,
	heart: Heart,
	tooth: Tooth,
	face: Face,
	back: Back,
	belly: Belly,
};

export function BodyScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
