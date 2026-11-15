import { Box, Curve, Figure, House, Line, Loop, Patch } from "@/components/lesson/ink";

export type CoverMotif = "train" | "mountains" | "cup" | "market" | "home" | "clinic" | "office" | "tree" | "friends";

const MOTIF_WORDS: ReadonlyArray<[CoverMotif, RegExp]> = [
	["train", /vlak|train|stanic|station|cest[ay] /i],
	["clinic", /lekár|doctor|pohotov|chrípk|nemocn|clinic|hospital/i],
	["office", /pohovor|prác|work|office|interview|kancel/i],
	["cup", /kaviar|café|cafe|coffee|káv|obed|kolib|lunch|restaur|pečen|medovn|bak/i],
	["market", /trh|market|potravin|shop|obchod|kúp|kniha|knih/i],
	["mountains", /tatr|hrad|turist|hory|mountain|castle|výlet|trip/i],
	["tree", /záhrad|garden|jabĺk|apple|obdob|season|jese|park/i],
	["home", /dom|byt|rodin|mama|mamy|home|flat|family|sťahov/i],
];

export function coverMotif(text: string): CoverMotif {
	return MOTIF_WORDS.find(([, words]) => words.test(text))?.[0] ?? "friends";
}

export function coverSeed(id: string): number {
	let hash = 7;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
	return hash;
}

const GROUND = 100;

function Motif({ motif, seed }: { motif: CoverMotif; seed: number }) {
	switch (motif) {
		case "train":
			return (
				<g>
					<Patch cx={98} cy={74} rx={50} ry={20} seed={seed + 40} delay={0.5} />
					<Box x={56} y={58} width={86} height={34} seed={seed + 10} tone="ink" />
					{[0, 1, 2].map((i) => (
						<Box key={i} x={64 + i * 26} y={65} width={16} height={11} seed={seed + 11 + i} tone="soft" delay={0.2} />
					))}
					<Loop cx={74} cy={94} rx={5} seed={seed + 15} tone="ink" delay={0.3} />
					<Loop cx={124} cy={94} rx={5} seed={seed + 16} tone="ink" delay={0.3} />
				</g>
			);
		case "mountains":
			return (
				<g>
					<Patch cx={128} cy={58} rx={22} ry={14} seed={seed + 40} delay={0.5} />
					<Curve points={[[18, GROUND], [62, 46], [92, 80], [128, 36], [182, GROUND]]} seed={seed + 10} tone="ink" />
					<Curve points={[[116, 50], [128, 58], [140, 50]]} seed={seed + 11} tone="soft" delay={0.3} />
				</g>
			);
		case "cup":
			return (
				<g>
					<Patch cx={96} cy={78} rx={32} ry={18} seed={seed + 40} delay={0.5} />
					<Curve points={[[72, 64], [76, 92], [100, 96], [120, 92], [124, 64]]} seed={seed + 10} tone="ink" />
					<Line from={[70, 64]} to={[126, 64]} seed={seed + 11} tone="ink" />
					<Loop cx={130} cy={76} rx={8} ry={9} seed={seed + 12} tone="ink" delay={0.2} />
					<Curve points={[[90, 56], [86, 46], [92, 36]]} seed={seed + 13} tone="soft" delay={0.35} />
					<Curve points={[[104, 56], [100, 44], [106, 32]]} seed={seed + 14} tone="soft" delay={0.4} />
				</g>
			);
		case "market":
			return (
				<g>
					<Patch cx={100} cy={76} rx={36} ry={10} seed={seed + 40} delay={0.5} />
					<Curve points={[[58, 50], [142, 50], [150, 66], [50, 66], [58, 50]]} seed={seed + 11} tone="ink" />
					{[0, 1, 2, 3, 4].map((i) => (
						<Line key={i} from={[66 + i * 17, 50]} to={[62 + i * 19, 66]} seed={seed + 20 + i} tone="soft" delay={0.2} />
					))}
					<Line from={[60, 66]} to={[60, GROUND]} seed={seed + 12} tone="ink" delay={0.25} />
					<Line from={[140, 66]} to={[140, GROUND]} seed={seed + 13} tone="ink" delay={0.25} />
					<Line from={[60, 84]} to={[140, 84]} seed={seed + 14} tone="ink" delay={0.3} />
					{[0, 1, 2, 3].map((i) => (
						<Loop key={i} cx={76 + i * 16} cy={78} rx={5.5} seed={seed + 30 + i} tone="soft" delay={0.4} />
					))}
				</g>
			);
		case "tree":
			return (
				<g>
					<Patch cx={100} cy={50} rx={30} ry={22} seed={seed + 40} delay={0.5} />
					<Line from={[100, GROUND]} to={[100, 66]} seed={seed + 10} tone="ink" />
					<Loop cx={100} cy={50} rx={28} ry={22} seed={seed + 11} tone="ink" delay={0.2} />
					<Figure x={150} ground={GROUND} seed={seed + 20} delay={0.4} reach="left" />
				</g>
			);
		case "home":
		case "clinic":
		case "office":
			return (
				<g>
					<Patch cx={98} cy={GROUND - 26} rx={36} ry={22} seed={seed + 40} delay={0.5} />
					<House x={motif === "office" ? 68 : 70} ground={GROUND} seed={seed + 10} kind={motif} />
					<Figure x={150} ground={GROUND} seed={seed + 30} delay={0.4} reach="left" />
				</g>
			);
		default:
			return (
				<g>
					<Patch cx={100} cy={GROUND - 30} rx={38} ry={20} seed={seed + 40} delay={0.5} />
					<Figure x={80} ground={GROUND} seed={seed + 10} reach="right" />
					<Figure x={120} ground={GROUND} seed={seed + 20} delay={0.2} />
				</g>
			);
	}
}

export function CoverScene({ motif, seed, sun = true, className }: { motif: CoverMotif; seed: number; sun?: boolean; className?: string }) {
	return (
		<svg viewBox="0 0 200 120" className={className} aria-hidden="true">
			{sun && <Loop cx={168} cy={24} rx={9} seed={seed + 1} tone="soft" opacity={0.8} />}
			<Curve points={[[6, GROUND + 2], [70, GROUND - 1], [130, GROUND + 1], [194, GROUND - 1]]} seed={seed + 2} tone="soft" />
			<Motif motif={motif} seed={seed} />
		</svg>
	);
}
