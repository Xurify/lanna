import type { CSSProperties } from "react";
import { Stroke, type InkTone } from "@/components/lesson/ink";
import { boxD, inkRandom, lineD, loopD, smoothD, type Point } from "@/components/lesson/ink-paths";

export const MAIN = 1.7;
export const DETAIL = 1.3;
export const ACCENT = 2.1;
export const GROUND = 112;

export type Hue = "ochre" | "rose" | "sage" | "sky";

export function Wash({ d, hue, delay = 0.45 }: { d: string; hue: Hue; delay?: number }) {
	return (
		<path
			d={d}
			transform="translate(1.5 1.5)"
			className={`ink-fade q-wash-${hue}`}
			style={{ "--ink-delay": `${delay}s` } as CSSProperties}
		/>
	);
}

export function L({
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

export function Ground({ from = 22, to = 178, seed = 1 }: { from?: number; to?: number; seed?: number }) {
	return <L from={[from, GROUND]} to={[to, GROUND]} seed={seed} tone="soft" width={DETAIL} />;
}

export function Outline({
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

export function Oval({
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
	tone?: InkTone;
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

export function Rect({
	x,
	y,
	w,
	h,
	seed,
	hue,
	tone = "ink",
	width = MAIN,
	delay = 0.1,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	seed: number;
	hue?: Hue;
	tone?: InkTone;
	width?: number;
	delay?: number;
}) {
	return (
		<>
			{hue && <Wash d={`M${x} ${y} h${w} v${h} h${-w} Z`} hue={hue} />}
			<Stroke d={boxD(x, y, w, h, seed)} tone={tone} width={width} delay={delay} />
		</>
	);
}
