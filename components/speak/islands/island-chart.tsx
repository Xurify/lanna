"use client";

import type { CSSProperties } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { smoothD, type Point } from "@/components/lesson/ink-paths";
import {
	ISLAND_STEP_LABELS,
	type IslandPageData,
	type IslandStep,
	type IslandSummary,
	type TopicSuggestion,
} from "@/src/core";

export interface IslandViewProps {
	data: IslandPageData;
	busy: boolean;
	onOpen: (id: string) => void;
	onStart: (topic: TopicSuggestion) => void;
}

const RANK: Record<IslandStep, number> = { started: 0, built: 1, rehearsed: 2, holding: 3, fluent: 4 };
const RING = 9;

function hash(text: string): number {
	let h = 2166136261;
	for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
}

function rand(seed: number): () => number {
	let x = seed || 1;
	return () => {
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		return ((x >>> 0) % 10000) / 10000;
	};
}

function coast(seed: number, r: number, grow = 0): string {
	const random = rand(seed);
	const points: Point[] = Array.from({ length: 9 }, (_, i) => {
		const angle = (i / 9) * Math.PI * 2;
		const k = 0.82 + random() * 0.32;
		return [Math.cos(angle) * (r * k + grow), Math.sin(angle) * (r * k * 0.78 + grow)];
	});
	return smoothD(points, true);
}

function IslandGlyph({
	seed,
	r,
	rings,
	dashed,
	lit,
}: {
	seed: number;
	r: number;
	rings: number;
	dashed?: boolean;
	lit?: boolean;
}) {
	const R = r + 4 * RING + 6;
	return (
		<svg
			viewBox={`${-R} ${-R * 0.85} ${2 * R} ${2 * R * 0.85}`}
			className="block w-full overflow-visible"
			aria-hidden="true"
		>
			{lit && <path d={coast(seed, r, 4)} className="ink-fade q-ink-patch" />}
			{Array.from({ length: rings }, (_, i) => (
				<path
					key={i}
					d={coast(seed, r, (i + 1) * RING)}
					className="ink-draw fill-none stroke-current text-ink-4"
					pathLength={1}
					strokeWidth={1.1}
					style={{ "--ink-delay": `${0.25 + i * 0.12}s` } as CSSProperties}
				/>
			))}
			<path
				d={coast(seed, r)}
				className={cn("fill-none stroke-current", !dashed && "ink-draw")}
				pathLength={dashed ? undefined : 1}
				strokeWidth={dashed ? 1.4 : 2}
				strokeDasharray={dashed ? "5 6" : undefined}
				strokeLinecap="round"
			/>
		</svg>
	);
}

type Spot = { x: number; y: number; r: number; R: number };

function layout(count: number, cols: number, seedOf: (i: number) => number, radiusOf: (i: number) => number) {
	const cell = 1000 / cols;
	const rowH = 250;
	const spots: Spot[] = [];
	for (let i = 0; i < count; i++) {
		const row = Math.floor(i / cols);
		const col = i % cols;
		const random = rand(seedOf(i));
		const r = radiusOf(i);
		const x = Math.min(
			1000 - r - 40,
			Math.max(r + 40, (col + 0.5 + (row % 2 ? 0.22 : -0.12)) * cell + (random() - 0.5) * 50),
		);
		const y = row * rowH + 120 + (random() - 0.5) * 50;
		spots.push({ x, y, r, R: r + 4 * RING + 6 });
	}
	return { spots, height: Math.ceil(count / cols) * rowH + 40 };
}

export function IslandChart({ data, busy, onOpen, onStart }: IslandViewProps) {
	const islands = data.islands;
	const topics = data.topics;
	const items = [
		...islands.map((s) => ({ kind: "island" as const, s })),
		...topics.map((t) => ({ kind: "topic" as const, t })),
	];
	const keyOf = (i: number) => {
		const item = items[i]!;
		return item.kind === "island" ? item.s.island.id : `topic-${item.t.title}`;
	};
	const { spots, height } = layout(
		items.length,
		3,
		(i) => hash(keyOf(i)),
		(i) => {
			const item = items[i]!;
			return item.kind === "island"
				? 52 + RANK[item.s.readiness.step] * 7 + Math.min(14, item.s.readiness.stats.chunks / 3)
				: 36;
		},
	);
	const where = new Map(items.map((_, i) => [keyOf(i), spots[i]!]));
	const firstDue = data.due[0]?.id ?? islands[0]?.island.id;
	const bridges = islands.flatMap((s) =>
		s.bridges.filter((b) => s.island.id < b.id).map((b) => ({ a: s.island.id, b: b.id, shared: b.shared })),
	);

	const ripples: Point[] = [];
	const sea = rand(hash(`sea-${items.length}`));
	for (let y = 50; y < height - 30; y += 85)
		for (let x = 40; x < 940; x += 150) {
			const px = x + sea() * 70;
			const py = y + sea() * 40;
			const clear = spots.every(
				(spot) =>
					Math.hypot(px + 30 - spot.x, py - spot.y) > spot.R + 30 &&
					!(Math.abs(px + 30 - spot.x) < spot.R * 1.3 && py > spot.y && py < spot.y + spot.R + 75),
			);
			if (clear && sea() < 0.45) ripples.push([Math.round(px), Math.round(py)]);
		}

	if (items.length === 0) return null;
	return (
		<div className="mt-8">
			<div
				className="relative w-full overflow-hidden rounded-2xl bg-well/40 shadow-[0_0_0_1px_var(--q-line)]"
				style={{ aspectRatio: `1000 / ${height}` }}
				data-testid="island-chart"
			>
				<svg viewBox={`0 0 1000 ${height}`} className="absolute inset-0 h-full w-full text-ink-3" aria-hidden="true">
					{ripples.map(([x, y]) => (
						<path
							key={`${x}-${y}`}
							d={`M${x} ${y} q 10 -6 20 0 t 20 0 t 20 0`}
							className="fill-none stroke-current text-ink-4"
							strokeWidth={1.2}
							strokeLinecap="round"
						/>
					))}
					{bridges.map(({ a, b, shared }) => {
						const p = where.get(a);
						const q = where.get(b);
						if (!p || !q) return null;
						const mx = (p.x + q.x) / 2;
						const my = (p.y + q.y) / 2 - 24;
						return (
							<g key={`${a}-${b}`}>
								<path
									d={`M${p.x} ${p.y} Q ${mx} ${my - 30} ${q.x} ${q.y}`}
									className="fill-none stroke-current text-ink-2"
									strokeWidth={1.6}
									strokeDasharray="7 8"
									strokeLinecap="round"
								/>
								<text
									x={mx}
									y={my - 18}
									textAnchor="middle"
									className="fill-current font-ui text-ink-2"
									style={{ fontSize: 22, fontWeight: 550 }}
								>
									{shared} {shared === 1 ? "word" : "words"}
								</text>
							</g>
						);
					})}
				</svg>
				<div className="speak-in absolute inset-0">
					{items.map((item, i) => {
						const spot = spots[i]!;
						const left = ((spot.x - spot.R) / 1000) * 100;
						const top = ((spot.y - spot.R * 0.85) / height) * 100;
						const width = ((2 * spot.R) / 1000) * 100;
						if (item.kind === "topic") {
							return (
								<button
									key={keyOf(i)}
									type="button"
									disabled={busy}
									onClick={() => onStart(item.t)}
									aria-label={`Start an island: ${item.t.title}`}
									title={item.t.reason}
									className="group absolute flex flex-col items-center rounded-2xl text-ink-3 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
									style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, "--i": i } as CSSProperties}
								>
									<span className="relative block w-full">
										<IslandGlyph seed={hash(keyOf(i))} r={spot.r} rings={0} dashed />
										<PlusIcon className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2" />
									</span>
									<span className="-mt-1 max-w-[180%] text-center font-ui text-[12px] leading-tight font-[550] @md:text-[13px]">
										{item.t.title}
									</span>
								</button>
							);
						}
						const s: IslandSummary = item.s;
						const rings = RANK[s.readiness.step];
						return (
							<button
								key={keyOf(i)}
								type="button"
								onClick={() => onOpen(s.island.id)}
								aria-label={`${s.island.topic}: ${ISLAND_STEP_LABELS[s.readiness.step]}, ${s.readiness.stats.chunks} chunks`}
								data-testid="island-row"
								className="group absolute flex flex-col items-center rounded-2xl text-ink-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, "--i": i } as CSSProperties}
							>
								<span className="block w-full transition-transform duration-300 group-hover:-translate-y-1">
									<IslandGlyph
										seed={hash(keyOf(i))}
										r={spot.r}
										rings={rings}
										dashed={s.readiness.faded}
										lit={s.island.id === firstDue}
									/>
								</span>
								<span className="-mt-2 max-w-[160%] text-center font-ui text-[13px] leading-tight font-[600] text-foreground @md:text-[15px]">
									{s.island.topic}
								</span>
								<span className="mt-0.5 hidden font-ui text-[12px] text-ink-3 @md:block">
									{ISLAND_STEP_LABELS[s.readiness.step]} · {s.readiness.stats.chunks} chunks
								</span>
							</button>
						);
					})}
				</div>
			</div>
			<p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-xs text-ink-3">
				<span>Rings round an island: one per step, from Built to Fluent.</span>
				<span>Dashed: faded, or not started.</span>
				<span>Dashed routes: words two islands share.</span>
			</p>
		</div>
	);
}
