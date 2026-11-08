import { useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { UNDERLINE_D, arrowD, boxD, curveD, lineD, loopD, patchD, type Point } from "@/components/lesson/ink-paths";

const TONES = {
	ink: "text-foreground",
	graphite: "text-ink-2",
	soft: "text-ink-3",
	mark: "text-teal-2",
} as const;

export type InkTone = keyof typeof TONES;

function delayed(delay: number): CSSProperties {
	return { "--ink-delay": `${delay}s` } as CSSProperties;
}

export function Stroke({ d, delay = 0, tone = "ink", width = 1.4, opacity }: { d: string; delay?: number; tone?: InkTone; width?: number; opacity?: number }) {
	return (
		<path
			d={d}
			pathLength={1}
			className={cn("ink-draw fill-none stroke-current", TONES[tone])}
			strokeWidth={width}
			strokeLinecap="round"
			strokeLinejoin="round"
			opacity={opacity}
			style={delayed(delay)}
		/>
	);
}

export function Patch({ cx, cy, rx, ry, seed, delay = 0 }: { cx: number; cy: number; rx: number; ry: number; seed: number; delay?: number }) {
	return <path d={patchD(cx, cy, rx, ry, seed)} className="ink-fade fill-teal/20" style={delayed(delay)} />;
}

export function Dot({ cx, cy, r = 6.5, seed, delay = 0 }: { cx: number; cy: number; r?: number; seed: number; delay?: number }) {
	return <path d={patchD(cx, cy, r, r, seed)} className="ink-fade fill-teal-2" style={delayed(delay)} />;
}

export function Line({ from, to, seed, ...stroke }: { from: Point; to: Point; seed: number; delay?: number; tone?: InkTone; width?: number; opacity?: number }) {
	return <Stroke d={lineD(from, to, seed)} {...stroke} />;
}

export function Box({ x, y, width, height, seed, ...stroke }: { x: number; y: number; width: number; height: number; seed: number; delay?: number; tone?: InkTone; opacity?: number }) {
	return <Stroke d={boxD(x, y, width, height, seed)} {...stroke} />;
}

export function Loop({ cx, cy, rx, ry = rx, seed, ...stroke }: { cx: number; cy: number; rx: number; ry?: number; seed: number; delay?: number; tone?: InkTone; width?: number; opacity?: number }) {
	return <Stroke d={loopD(cx, cy, rx, ry, seed)} {...stroke} />;
}

export function Curve({ points, seed, ...stroke }: { points: readonly Point[]; seed: number; delay?: number; tone?: InkTone; width?: number; opacity?: number }) {
	return <Stroke d={curveD(points, seed)} {...stroke} />;
}

export function Arrow({ from, to, seed, bend = 0, delay = 0 }: { from: Point; to: Point; seed: number; bend?: number; delay?: number }) {
	const { shaft, head } = arrowD(from, to, seed, bend);
	return (
		<>
			<Stroke d={shaft} tone="mark" width={2.1} delay={delay} />
			<Stroke d={head} tone="mark" width={2.1} delay={delay + 0.4} />
		</>
	);
}

export function Figure({ x, ground, seed, tone = "graphite", delay = 0, reach }: { x: number; ground: number; seed: number; tone?: InkTone; delay?: number; reach?: "right" | "left" }) {
	const side = reach === "left" ? -1 : 1;
	const neck = ground - 36;
	const hip = ground - 13;
	const shoulder = neck + 9;
	return (
		<g>
			<Loop cx={x} cy={ground - 45} rx={8} seed={seed} tone={tone} delay={delay} />
			<Line from={[x, neck]} to={[x, hip]} seed={seed + 1} tone={tone} delay={delay + 0.12} />
			{reach ? (
				<Line from={[x, shoulder]} to={[x + 22 * side, shoulder - 9]} seed={seed + 2} tone={tone} delay={delay + 0.22} />
			) : (
				<>
					<Line from={[x, shoulder]} to={[x - 11, shoulder + 14]} seed={seed + 2} tone={tone} delay={delay + 0.22} />
					<Line from={[x, shoulder]} to={[x + 11, shoulder + 14]} seed={seed + 5} tone={tone} delay={delay + 0.25} />
				</>
			)}
			<Line from={[x, hip]} to={[x - 11, ground]} seed={seed + 3} tone={tone} delay={delay + 0.32} />
			<Line from={[x, hip]} to={[x + 11, ground]} seed={seed + 4} tone={tone} delay={delay + 0.36} />
		</g>
	);
}

export function House({ x, ground, seed, delay = 0, kind = "home" }: { x: number; ground: number; seed: number; delay?: number; kind?: "home" | "school" | "office" }) {
	if (kind === "office") {
		const top = ground - 82;
		return (
			<g>
				<Box x={x} y={top} width={62} height={82} seed={seed} tone="soft" delay={delay} />
				{[0, 1, 2].map((row) =>
					[0, 1].map((col) => (
						<Box key={`${row}-${col}`} x={x + 10 + col * 26} y={top + 10 + row * 16} width={16} height={10} seed={seed + 20 + row * 2 + col} tone="soft" opacity={0.7} delay={delay + 0.25 + row * 0.05} />
					)),
				)}
				<Curve points={[[x + 25, ground], [x + 25, ground - 22], [x + 37, ground - 22], [x + 37, ground]]} seed={seed + 12} tone="soft" delay={delay + 0.4} />
			</g>
		);
	}
	const top = ground - 50;
	return (
		<g>
			<Box x={x} y={top} width={58} height={50} seed={seed} tone="soft" delay={delay} />
			<Curve points={[[x - 7, top + 1], [x + 29, top - 26], [x + 65, top + 1]]} seed={seed + 11} tone="soft" delay={delay + 0.2} />
			<Curve points={[[x + 24, ground], [x + 24, ground - 24], [x + 36, ground - 24], [x + 36, ground]]} seed={seed + 12} tone="soft" delay={delay + 0.35} />
			{kind === "school" && (
				<>
					<Line from={[x + 29, top - 25]} to={[x + 29, top - 46]} seed={seed + 13} tone="soft" delay={delay + 0.45} />
					<Curve points={[[x + 29, top - 46], [x + 42, top - 43], [x + 29, top - 36]]} seed={seed + 14} tone="soft" delay={delay + 0.5} />
				</>
			)}
		</g>
	);
}

export function PenRule({ delay = 0, className }: { delay?: number; className?: string }) {
	return (
		<svg viewBox="0 0 100 4" preserveAspectRatio="none" className={cn("pointer-events-none h-1 w-full overflow-visible", className)} aria-hidden="true">
			<path d="M1 2.2 C22 1 40 3.2 62 2 S90 1.4 99 2.4" pathLength={1} className="ink-draw fill-none stroke-current text-line-2" strokeWidth={1.2} strokeLinecap="round" style={delayed(delay)} />
		</svg>
	);
}

export function Note({ x, y, children, anchor = "middle", tone = "ink", delay = 0 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; tone?: InkTone; delay?: number }) {
	return (
		<text x={x} y={y} textAnchor={anchor} className={cn("ink-fade fill-current font-prose text-[15px] font-semibold", TONES[tone])} style={delayed(delay)}>
			{children}
		</text>
	);
}

export function Sheet({ viewBox, className, children }: { viewBox: string; className?: string; children: ReactNode }) {
	const filter = `ink-${useId().replace(/:/g, "")}`;
	return (
		<svg viewBox={viewBox} className={className} aria-hidden="true">
			<defs>
				<filter id={filter} x="-4%" y="-6%" width="108%" height="112%">
					<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="grain" />
					<feDisplacementMap in="SourceGraphic" in2="grain" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
				</filter>
			</defs>
			<g filter={`url(#${filter})`}>{children}</g>
		</svg>
	);
}

export function PenUnderline({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 100 8" preserveAspectRatio="none" className={cn("pointer-events-none absolute -bottom-1.5 left-0 h-1.5 w-full overflow-visible", className)} aria-hidden="true">
			<path d={UNDERLINE_D} pathLength={1} className="ink-draw fill-none stroke-teal-2" strokeWidth={2.4} strokeLinecap="round" style={delayed(0.35)} />
		</svg>
	);
}
