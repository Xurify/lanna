import { Sheet, Stroke } from "@/components/lesson/ink";
import { DETAIL, Ground, MAIN, Oval, Outline, Rect, Wash } from "@/components/lesson/scene-kit";
import type { ClothesScene as Scene } from "@/src/core";

function Buttons({ x, ys, delay = 0.55 }: { x: number; ys: readonly number[]; delay?: number }) {
	return (
		<>
			{ys.map((y, i) => (
				<Oval
					key={y}
					cx={x}
					cy={y}
					rx={2}
					ry={2}
					seed={Math.round(x * 13 + y)}
					width={DETAIL}
					delay={delay + i * 0.04}
				/>
			))}
		</>
	);
}

function Shirt() {
	return (
		<>
			<Outline
				points={[
					[88, 18],
					[68, 24],
					[50, 44],
					[32, 90],
					[44, 96],
					[62, 58],
					[68, 56],
					[68, 110],
					[132, 110],
					[132, 56],
					[138, 58],
					[156, 96],
					[168, 90],
					[150, 44],
					[132, 24],
					[112, 18],
				]}
				hue="sky"
				seed={1100}
				closed={false}
			/>
			<Stroke d="M88 18 L94 36 L100 26 L106 36 L112 18 Q100 24 88 18" width={MAIN} delay={0.3} />
			<Stroke d="M100 26 L100 110" tone="graphite" width={DETAIL} delay={0.4} />
			<Buttons x={104} ys={[44, 62, 80, 98]} />
			<Stroke d="M36 86 L46 92 M164 86 L154 92" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke d="M76 46 L90 46 L90 58 L76 58 Z" tone="graphite" width={DETAIL} delay={0.6} />
		</>
	);
}

function Trousers() {
	const legs = "M70 14 L130 14 L132 24 L138 116 L108 116 L100 48 L92 116 L62 116 L68 24 Z";
	return (
		<>
			<Wash d={legs} hue="sky" />
			<Stroke d={legs} width={MAIN} delay={0.1} />
			<Stroke d="M69 24 L131 24" width={MAIN} delay={0.3} />
			<Stroke d="M100 24 L100 46 M100 24 Q94 36 100 46" tone="graphite" width={DETAIL} delay={0.4} />
			<Stroke d="M72 30 Q82 34 84 26 M128 30 Q118 34 116 26" tone="graphite" width={DETAIL} delay={0.45} />
			<Stroke d="M80 14 L80 24 M120 14 L120 24" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke d="M63 108 L92 108 M108 108 L137 108" tone="graphite" width={DETAIL} delay={0.55} />
		</>
	);
}

function Dress() {
	return (
		<>
			<Outline
				points={[
					[100, 30],
					[86, 14],
					[84, 30],
					[80, 44],
					[86, 56],
					[66, 92],
					[48, 116],
					[100, 120],
					[152, 116],
					[134, 92],
					[114, 56],
					[120, 44],
					[116, 30],
					[114, 14],
					[100, 30],
				]}
				hue="rose"
				seed={1140}
				closed={false}
			/>
			<Stroke d="M86 56 Q100 60 114 56" width={MAIN} delay={0.35} />
			<Stroke
				d="M90 64 Q82 92 74 116 M110 64 Q118 92 126 116 M100 62 L100 118"
				tone="soft"
				width={DETAIL}
				delay={0.5}
			/>
		</>
	);
}

function Coat() {
	return (
		<>
			<Outline
				points={[
					[100, 46],
					[84, 22],
					[88, 8],
					[72, 12],
					[60, 26],
					[48, 84],
					[58, 88],
					[68, 40],
					[70, 60],
					[66, 124],
					[134, 124],
					[130, 60],
					[132, 40],
					[142, 88],
					[152, 84],
					[140, 26],
					[128, 12],
					[112, 8],
					[116, 22],
					[100, 46],
					[84, 22],
				]}
				hue="ochre"
				seed={1160}
				closed={false}
			/>
			<Stroke d="M100 46 L100 124" width={MAIN} delay={0.3} />
			<Stroke
				d="M90 10 L93 30 L84 22 M93 30 L100 46 M110 10 L107 30 L116 22 M107 30 L100 46"
				width={MAIN}
				delay={0.35}
			/>
			<Buttons x={92} ys={[56, 74, 92]} />
			<Buttons x={110} ys={[56, 74, 92]} delay={0.6} />
			<Stroke d="M74 100 L90 100 M110 100 L126 100" tone="graphite" width={DETAIL} delay={0.7} />
		</>
	);
}

function Jacket() {
	const opening = "M91 26 Q100 34 109 26 L111 96 L89 96 Z";
	const teeth = Array.from({ length: 12 }, (_, i) => {
		const y = 40 + i * 5;
		return `M89.5 ${y} L92.5 ${y} M110.5 ${y} L107.5 ${y}`;
	}).join(" ");
	return (
		<>
			<Outline
				points={[
					[86, 18],
					[66, 24],
					[50, 42],
					[34, 84],
					[46, 90],
					[62, 58],
					[68, 56],
					[68, 96],
					[132, 96],
					[132, 56],
					[138, 58],
					[154, 90],
					[166, 84],
					[150, 42],
					[134, 24],
					[114, 18],
				]}
				hue="sage"
				seed={1182}
				closed={false}
			/>
			<path d={opening} className="ink-fade fill-current text-background" />
			<Stroke d="M91 26 Q100 34 109 26 M90 30 L89 96 M110 30 L111 96" width={MAIN} delay={0.25} />
			<Stroke d={teeth} tone="graphite" width={DETAIL} delay={0.4} />
			<Outline
				points={[
					[86, 16],
					[74, 22],
					[80, 42],
					[91, 28],
				]}
				hue="sage"
				seed={1184}
				delay={0.3}
			/>
			<Outline
				points={[
					[114, 16],
					[126, 22],
					[120, 42],
					[109, 28],
				]}
				hue="sage"
				seed={1186}
				delay={0.32}
			/>
			<Stroke d="M86 16 Q100 12 114 16" width={MAIN} delay={0.35} />
			<Stroke d="M38 80 L48 86 M162 80 L152 86" tone="graphite" width={DETAIL} delay={0.5} />
			<Stroke d="M72 66 L80 84 M128 66 L120 84" width={MAIN} delay={0.55} />
		</>
	);
}

function Cap() {
	return (
		<>
			<Outline
				points={[
					[56, 84],
					[58, 56],
					[76, 36],
					[100, 30],
					[124, 36],
					[142, 56],
					[144, 84],
				]}
				hue="rose"
				seed={1200}
				closed={false}
			/>
			<Outline
				points={[
					[52, 84],
					[148, 84],
					[150, 106],
					[50, 106],
				]}
				hue="rose"
				seed={1202}
				delay={0.2}
			/>
			<Stroke
				d={[60, 70, 80, 90, 100, 110, 120, 130, 140].map((x) => `M${x} 87 L${x} 103`).join(" ")}
				tone="graphite"
				width={DETAIL}
				delay={0.4}
			/>
			<Stroke d="M80 46 Q78 64 76 82 M100 34 L100 82 M120 46 Q122 64 124 82" tone="soft" width={DETAIL} delay={0.5} />
			<Oval cx={100} cy={20} rx={12} ry={11} seed={1204} hue="rose" delay={0.3} />
			<Stroke
				d="M94 14 L92 10 M100 12 L100 8 M106 14 L108 10 M90 20 L86 20 M110 20 L114 20"
				tone="graphite"
				width={DETAIL}
				delay={0.6}
			/>
		</>
	);
}

function Bag() {
	const body = "M52 56 L148 56 L158 110 L42 110 Z";
	return (
		<>
			<Ground />
			<Stroke d="M70 56 Q70 18 100 18 Q130 18 130 56" width={MAIN} delay={0.3} />
			<Stroke d="M78 56 Q78 26 100 26 Q122 26 122 56" tone="graphite" width={DETAIL} delay={0.35} />
			<Wash d={body} hue="ochre" />
			<Stroke d={body} width={MAIN} delay={0.1} />
			<Stroke d="M53 57 L56 76 Q100 88 144 76 L147 57" width={MAIN} delay={0.4} />
			<Rect x={96} y={78} w={8} h={8} seed={1224} width={DETAIL} delay={0.5} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	shirt: Shirt,
	trousers: Trousers,
	dress: Dress,
	coat: Coat,
	jacket: Jacket,
	cap: Cap,
	bag: Bag,
};

export function ClothesScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
