import { Sheet, Stroke } from "@/components/lesson/ink";
import { DETAIL, Ground, GROUND, L, MAIN, Oval, Outline, Rect, Wash } from "@/components/lesson/scene-kit";
import type { HomeScene as Scene } from "@/src/core";

function House() {
	return (
		<>
			<Ground />
			<Wash d="M54 64 L146 64 L146 112 L54 112 Z" hue="ochre" />
			<Wash d="M42 66 L100 26 L158 66 Z" hue="rose" />
			<L from={[54, 64]} to={[54, GROUND]} seed={400} />
			<L from={[146, 64]} to={[146, GROUND]} seed={401} />
			<L from={[40, 66]} to={[100, 24]} seed={402} />
			<L from={[100, 24]} to={[160, 66]} seed={403} />
			<L from={[40, 66]} to={[160, 66]} seed={404} width={DETAIL} />
			<Stroke d="M124 41 L124 26 L134 26 L134 48" width={MAIN} delay={0.3} />
			<Rect x={92} y={84} w={18} h={28} seed={405} delay={0.4} />
			<Rect x={64} y={76} w={18} h={16} seed={406} hue="sky" width={DETAIL} delay={0.45} />
			<Rect x={120} y={76} w={18} h={16} seed={407} hue="sky" width={DETAIL} delay={0.5} />
			<Stroke d="M73 76 V92 M64 84 H82 M129 76 V92 M120 84 H138" tone="graphite" width={DETAIL} delay={0.6} />
		</>
	);
}

function Door() {
	return (
		<>
			<Ground from={30} to={170} />
			<Rect x={68} y={14} w={64} h={98} seed={410} tone="graphite" width={DETAIL} delay={0} />
			<Rect x={74} y={20} w={52} h={92} seed={412} hue="ochre" delay={0.2} />
			<Rect x={82} y={28} w={36} h={30} seed={414} tone="graphite" width={DETAIL} delay={0.4} />
			<Rect x={82} y={70} w={36} h={34} seed={416} tone="graphite" width={DETAIL} delay={0.45} />
			<Oval cx={117} cy={64} rx={3.2} ry={3.2} seed={418} delay={0.55} />
			<Stroke d="M117 67 L117 72" width={DETAIL} delay={0.6} />
		</>
	);
}

function Window() {
	return (
		<>
			<Rect x={56} y={18} w={88} h={78} seed={420} hue="sky" delay={0} />
			<Rect x={61} y={23} w={78} h={68} seed={422} tone="graphite" width={DETAIL} delay={0.2} />
			<L from={[100, 23]} to={[100, 91]} seed={424} delay={0.3} />
			<L from={[61, 57]} to={[139, 57]} seed={425} delay={0.35} />
			<Rect x={48} y={96} w={104} h={7} seed={426} delay={0.4} />
			<Stroke
				d="M72 34 Q78 30 84 34 M112 40 Q118 36 124 40 M118 72 Q124 68 130 72"
				tone="soft"
				width={DETAIL}
				delay={0.6}
			/>
		</>
	);
}

function Table() {
	return (
		<>
			<Ground />
			<Wash d="M56 42 L144 42 L164 56 L36 56 Z" hue="ochre" />
			<L from={[56, 42]} to={[144, 42]} seed={430} />
			<L from={[144, 42]} to={[164, 56]} seed={431} />
			<L from={[56, 42]} to={[36, 56]} seed={429} />
			<Rect x={36} y={56} w={128} h={7} seed={432} hue="ochre" delay={0.2} />
			<Rect x={42} y={63} w={6} h={49} seed={434} delay={0.3} />
			<Rect x={152} y={63} w={6} h={49} seed={435} delay={0.3} />
			<Rect x={60} y={63} w={5} h={33} seed={436} tone="graphite" width={DETAIL} delay={0.4} />
			<Rect x={135} y={63} w={5} h={33} seed={437} tone="graphite" width={DETAIL} delay={0.4} />
		</>
	);
}

function Chair() {
	return (
		<>
			<Ground />
			<Wash d="M72 70 L124 70 L134 80 L82 80 Z" hue="ochre" />
			<Wash d="M72 38 L92 33 L92 52 L72 56 Z" hue="ochre" />
			<L from={[72, 36]} to={[72, GROUND]} seed={440} />
			<L from={[92, 31]} to={[92, 70]} seed={441} />
			<Stroke d="M71 36 Q82 28 93 31" width={MAIN} delay={0.2} />
			<L from={[72, 56]} to={[92, 52]} seed={442} delay={0.3} />
			<L from={[72, 70]} to={[124, 70]} seed={445} delay={0.2} />
			<L from={[124, 70]} to={[134, 80]} seed={446} delay={0.25} />
			<L from={[72, 80]} to={[134, 80]} seed={447} delay={0.25} />
			<L from={[134, 80]} to={[134, GROUND]} seed={448} delay={0.3} />
			<L from={[124, 70]} to={[124, 102]} seed={449} delay={0.35} />
			<L from={[86, 80]} to={[86, 102]} seed={450} delay={0.35} />
		</>
	);
}

function Sofa() {
	return (
		<>
			<Ground />
			<Outline
				points={[
					[42, 82],
					[42, 48],
					[50, 40],
					[150, 40],
					[158, 48],
					[158, 82],
				]}
				hue="sage"
				seed={460}
				closed={false}
			/>
			<Outline
				points={[
					[24, 102],
					[22, 66],
					[32, 58],
					[44, 64],
					[46, 102],
				]}
				hue="sage"
				seed={462}
				delay={0.2}
			/>
			<Outline
				points={[
					[176, 102],
					[178, 66],
					[168, 58],
					[156, 64],
					[154, 102],
				]}
				hue="sage"
				seed={464}
				delay={0.2}
			/>
			<Rect x={46} y={82} w={54} h={12} seed={466} delay={0.3} />
			<Rect x={100} y={82} w={54} h={12} seed={467} delay={0.35} />
			<L from={[24, 102]} to={[176, 102]} seed={468} delay={0.4} />
			<L from={[46, 94]} to={[46, 102]} seed={469} width={DETAIL} delay={0.4} />
			<L from={[154, 94]} to={[154, 102]} seed={470} width={DETAIL} delay={0.4} />
			<Stroke d="M32 102 L32 111 M168 102 L168 111" width={MAIN} delay={0.5} />
		</>
	);
}

function Bed() {
	return (
		<>
			<Ground />
			<L from={[26, 30]} to={[26, GROUND]} seed={480} />
			<L from={[40, 34]} to={[40, 76]} seed={481} />
			<Stroke d="M26 30 Q33 22 40 34" width={MAIN} delay={0.2} />
			<L from={[174, 62]} to={[174, GROUND]} seed={482} />
			<L from={[162, 66]} to={[162, 76]} seed={483} delay={0.1} />
			<Stroke d="M162 66 Q168 58 174 62" width={MAIN} delay={0.2} />
			<L from={[40, 76]} to={[84, 76]} seed={484} delay={0.2} />
			<L from={[26, 90]} to={[80, 90]} seed={485} delay={0.25} />
			<L from={[164, 90]} to={[174, 90]} seed={487} delay={0.25} />
			<Outline
				points={[
					[44, 76],
					[46, 62],
					[64, 58],
					[78, 62],
					[78, 76],
				]}
				seed={486}
				delay={0.3}
			/>
			<Outline
				points={[
					[82, 76],
					[90, 64],
					[120, 62],
					[160, 64],
					[164, 74],
					[166, 96],
					[78, 96],
				]}
				hue="sky"
				seed={488}
				delay={0.4}
			/>
		</>
	);
}

function Key() {
	return (
		<>
			<Oval cx={58} cy={64} rx={26} ry={26} seed={520} hue="ochre" />
			<Oval cx={52} cy={64} rx={8} ry={8} seed={521} delay={0.2} />
			<Wash d="M84 59 L172 59 L172 69 L84 69 Z" hue="ochre" />
			<L from={[84, 59]} to={[172, 59]} seed={522} delay={0.3} />
			<Stroke
				d="M84 69 L134 69 L134 84 L144 84 L144 74 L152 74 L152 86 L162 86 L162 69 L172 69 L172 59"
				width={MAIN}
				delay={0.4}
			/>
		</>
	);
}

function Wardrobe() {
	return (
		<>
			<Ground />
			<Rect x={46} y={18} w={84} h={88} seed={530} hue="ochre" />
			<L from={[42, 18]} to={[134, 18]} seed={532} delay={0.1} />
			<L from={[88, 18]} to={[88, 106]} seed={533} delay={0.2} />
			<Stroke d="M52 106 L52 112 M124 106 L124 112" width={MAIN} delay={0.25} />
			<Stroke d="M82 58 v8" width={MAIN} delay={0.35} />
			<L from={[90, 28]} to={[128, 28]} seed={534} tone="graphite" width={DETAIL} delay={0.4} />
			{[97, 109, 121].map((x, i) => (
				<Stroke
					key={x}
					d={`M${x} 28 q0 -3 2 -3 M${x} 28 L${x - 5} 32 L${x + 5} 32 M${x - 5} 32 L${x - 4} 44 L${x - 6} 58 L${x + 6} 58 L${x + 4} 44 L${x + 5} 32`}
					tone="graphite"
					width={DETAIL}
					delay={0.5 + i * 0.1}
				/>
			))}
			<Stroke d="M130 18 L160 26 L160 108 L130 106" width={MAIN} delay={0.3} />
			<Wash d="M130 18 L160 26 L160 108 L130 106 Z" hue="ochre" />
			<Stroke d="M154 62 v8" width={MAIN} delay={0.4} />
		</>
	);
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
	house: House,
	door: Door,
	window: Window,
	table: Table,
	chair: Chair,
	sofa: Sofa,
	bed: Bed,
	key: Key,
	wardrobe: Wardrobe,
};

export function HomeScene({ scene, className }: { scene: Scene; className?: string }) {
	const Drawn = SCENES[scene];
	return (
		<Sheet viewBox="0 0 200 130" className={className}>
			<Drawn />
		</Sheet>
	);
}
