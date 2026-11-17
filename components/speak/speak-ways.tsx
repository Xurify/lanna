import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, Box, Curve, Dot, Figure, Line, Loop, Patch, Sheet } from "@/components/lesson/ink";
import type { Point } from "@/components/lesson/ink-paths";
import { cn } from "@/lib/utils";

const GROUND = 104;

function TutorSketch() {
	return (
		<Sheet viewBox="0 0 340 132" className="w-full">
			<Line from={[18, GROUND]} to={[322, GROUND]} seed={1} tone="soft" width={1.1} />
			<Figure x={92} ground={GROUND} seed={11} reach="right" delay={0.05} />
			<Figure x={246} ground={GROUND} seed={21} reach="left" delay={0.2} />

			<Line from={[150, 88]} to={[194, 88]} seed={2} width={1.3} delay={0.3} />
			<Line from={[156, 88]} to={[156, GROUND]} seed={3} width={1.1} tone="soft" delay={0.34} />
			<Line from={[188, 88]} to={[188, GROUND]} seed={4} width={1.1} tone="soft" delay={0.34} />
			<Loop cx={172} cy={82} rx={4} ry={5} seed={5} width={1.1} delay={0.4} />

			<Patch cx={246} cy={38} rx={25} ry={18} seed={6} delay={0.4} />
			<Loop cx={92} cy={38} rx={20} ry={13} seed={7} delay={0.52} />
			<Line from={[100, 50]} to={[108, 58]} seed={8} width={1.2} delay={0.6} />
			<Loop cx={84} cy={38} rx={1.6} ry={1.6} seed={9} width={1.2} delay={0.62} />
			<Loop cx={91} cy={38} rx={1.6} ry={1.6} seed={10} width={1.2} delay={0.64} />
			<Loop cx={98} cy={38} rx={1.6} ry={1.6} seed={12} width={1.2} delay={0.66} />

			<Loop cx={246} cy={38} rx={20} ry={13} seed={13} tone="mark" width={1.6} delay={0.46} />
			<Line from={[238, 50]} to={[230, 58]} seed={14} tone="mark" width={1.4} delay={0.52} />

			<Arrow from={[116, 38]} to={[220, 38]} seed={15} bend={-9} delay={0.75} />
		</Sheet>
	);
}

const LEFT_ARCS: Point[][] = [
	[
		[118, 50],
		[126, 58],
		[118, 66],
	],
	[
		[126, 44],
		[136, 58],
		[126, 72],
	],
	[
		[134, 38],
		[150, 58],
		[134, 78],
	],
];

const RIGHT_ARCS: Point[][] = [
	[
		[222, 50],
		[214, 58],
		[222, 66],
	],
	[
		[214, 44],
		[204, 58],
		[214, 72],
	],
	[
		[206, 38],
		[190, 58],
		[206, 78],
	],
];

function LiveSketch() {
	return (
		<Sheet viewBox="0 0 340 132" className="w-full">
			<Line from={[18, GROUND]} to={[322, GROUND]} seed={31} tone="soft" width={1.1} />
			<Figure x={104} ground={GROUND} seed={32} reach="right" delay={0.05} />
			<Figure x={236} ground={GROUND} seed={38} reach="left" delay={0.2} />

			{LEFT_ARCS.map((points, i) => (
				<Curve key={`l${i}`} points={points} seed={44 + i} tone="mark" width={1.8} delay={0.5 + i * 0.06} />
			))}
			{RIGHT_ARCS.map((points, i) => (
				<Curve key={`r${i}`} points={points} seed={48 + i} tone="mark" width={1.8} delay={0.52 + i * 0.06} />
			))}

			<Patch cx={170} cy={80} rx={22} ry={24} seed={52} delay={0.28} />
			<Loop cx={170} cy={74} rx={7} ry={10} seed={53} width={1.5} delay={0.3} />
			<Line from={[165, 70]} to={[175, 70]} seed={56} tone="soft" width={1} delay={0.38} />
			<Line from={[170, 84]} to={[170, 95]} seed={54} width={1.3} delay={0.4} />
			<Line from={[160, 95]} to={[180, 95]} seed={55} width={1.3} delay={0.44} />
		</Sheet>
	);
}

function SoloSketch() {
	return (
		<Sheet viewBox="0 0 340 132" className="w-full">
			<Line from={[18, GROUND]} to={[322, GROUND]} seed={61} tone="soft" width={1.1} />
			<Figure x={126} ground={GROUND} seed={62} reach="right" delay={0.05} />

			<Curve
				points={[
					[146, 50],
					[154, 58],
					[146, 66],
				]}
				seed={68}
				tone="mark"
				width={1.8}
				delay={0.5}
			/>
			<Curve
				points={[
					[154, 44],
					[164, 58],
					[154, 72],
				]}
				seed={69}
				tone="mark"
				width={1.8}
				delay={0.56}
			/>
			<Curve
				points={[
					[162, 38],
					[174, 58],
					[162, 78],
				]}
				seed={70}
				tone="mark"
				width={1.8}
				delay={0.62}
			/>

			<Patch cx={236} cy={95} rx={32} ry={17} seed={71} delay={0.3} />
			<Box x={212} y={84} width={48} height={22} seed={72} delay={0.32} />
			<Dot cx={222} cy={95} r={3} seed={73} delay={0.5} />
			<Loop cx={242} cy={95} rx={4} ry={4} seed={74} tone="soft" width={1.1} delay={0.52} />

			<Arrow from={[206, 88]} to={[156, 98]} seed={75} bend={14} delay={0.8} />
		</Sheet>
	);
}

function IslandSketch() {
	return (
		<Sheet viewBox="0 0 340 132" className="w-full">
			<Curve
				points={[
					[20, 114],
					[80, 110],
					[140, 114],
					[200, 110],
					[262, 114],
					[320, 110],
				]}
				seed={81}
				tone="soft"
				width={1.1}
			/>
			<Patch cx={96} cy={104} rx={40} ry={11} seed={82} delay={0.2} />

			<Curve
				points={[
					[62, 108],
					[94, 88],
					[126, 108],
				]}
				seed={83}
				width={1.4}
				delay={0.22}
			/>
			<Curve
				points={[
					[212, 108],
					[238, 96],
					[264, 108],
				]}
				seed={84}
				width={1.2}
				delay={0.3}
				tone="soft"
			/>

			<Figure x={96} ground={97} seed={85} delay={0.35} />
			<Line from={[120, 94]} to={[120, 62]} seed={91} width={1.3} delay={0.5} />
			<Curve
				points={[
					[120, 62],
					[138, 67],
					[120, 75],
				]}
				seed={92}
				width={1.3}
				delay={0.58}
			/>

			<Loop cx={66} cy={102} rx={3} ry={3} seed={93} width={1.1} tone="soft" delay={0.6} />
			<Loop cx={76} cy={99} rx={3.4} ry={3} seed={94} width={1.1} tone="soft" delay={0.64} />

			{[0, 1, 2, 3, 4].map((i) => (
				<Loop
					key={i}
					cx={132 + i * 17}
					cy={i % 2 === 0 ? 110 : 108}
					rx={2.3}
					ry={1.7}
					seed={95 + i}
					tone="soft"
					width={1}
					delay={0.7 + i * 0.06}
				/>
			))}
		</Sheet>
	);
}

export type SpeakWayId = "tutor" | "live" | "solo" | "islands";

const WAYS: Array<{ id: SpeakWayId; href: string; title: string; line: string; sketch: () => ReactNode }> = [
	{
		id: "tutor",
		href: "/speak",
		title: "With a tutor",
		line: "The tutor plays the other person and answers out loud, a turn at a time.",
		sketch: TutorSketch,
	},
	{
		id: "live",
		href: "/speak/live",
		title: "Live",
		line: "A real call: you both speak at once, and either of you can interrupt.",
		sketch: LiveSketch,
	},
	{
		id: "solo",
		href: "/speak/self-talk",
		title: "On your own",
		line: "Talk alone for a few minutes, then hear it back with what to fix.",
		sketch: SoloSketch,
	},
	{
		id: "islands",
		href: "/speak/islands",
		title: "Language islands",
		line: "One topic prepared well enough to hold a whole conversation.",
		sketch: IslandSketch,
	},
];

export function SpeakWays({ current }: { current: SpeakWayId }) {
	return (
		<section className="mt-6" aria-label="Ways to speak" data-testid="speak-ways">
			<ul className="grid grid-cols-2 gap-x-4 gap-y-5 @2xl:grid-cols-4 @2xl:gap-x-6">
				{WAYS.map((way) => {
					const Sketch = way.sketch;
					const here = way.id === current;
					return (
						<li key={way.id}>
							<Link
								href={way.href}
								aria-current={here ? "page" : undefined}
								data-testid={`speak-way-${way.id}`}
								className={cn(
									"group -mx-1 block rounded-xl px-1 pb-1.5 transition-colors",
									"hover:bg-well/60 focus-visible:bg-well/60 focus-visible:outline-none",
								)}
							>
								<span className="block text-ink-2 transition-colors group-hover:text-foreground">
									<Sketch />
								</span>
								<span className="mt-0.5 flex items-baseline gap-1.5">
									<span className="font-ui text-[14px] font-[600] text-foreground">{way.title}</span>
									{here && <span className="font-ui text-[11px] text-teal-2">Here</span>}
								</span>
								<span className="mt-0.5 block font-prose text-[12px] leading-snug text-ink-3">{way.line}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
