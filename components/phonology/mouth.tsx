import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Sheet, Stroke } from "@/components/lesson/ink";
import { patchD } from "@/components/lesson/ink-paths";
import type { MouthSpec, SoundPicture } from "@/src/core";
import { LENGTH_VIEWBOX, MOUTH_VIEWBOX, lengthPaths, mouthPaths } from "./mouth-paths";

const delayed = (seconds: number) => ({ "--ink-delay": `${seconds}s` }) as CSSProperties;

export function Mouth({
	spec,
	seed,
	quiet = false,
	className,
}: {
	spec: MouthSpec;
	seed: number;
	quiet?: boolean;
	className?: string;
}) {
	const m = mouthPaths(spec, seed);
	const lit = (part: typeof m.accent) => !quiet && m.accent === part;
	const wash = quiet ? "fill-foreground/[0.14]" : "fill-teal/20";
	return (
		<Sheet viewBox={MOUTH_VIEWBOX} className={className}>
			<Stroke d={m.face} tone="soft" />
			<Stroke d={m.chin} tone="soft" delay={0.08} />
			<Stroke d={m.throat} tone="soft" delay={0.14} />
			<Stroke d={m.roof} tone="graphite" delay={0.22} />
			<Stroke d={m.upperTeeth} tone="graphite" delay={0.3} />
			<Stroke d={m.lowerTeeth} tone="graphite" delay={0.34} />
			<Stroke d={m.gum} tone="soft" delay={0.38} />
			<path
				d={m.tongueBody}
				className={cn("ink-fade", lit("tongue") ? "fill-teal/10" : "fill-foreground/[0.05]")}
				style={delayed(0.5)}
			/>
			{m.place && (
				<path
					d={patchD(m.place.cx, m.place.cy, m.place.rx, m.place.ry, seed + 11)}
					className={cn("ink-fade", wash)}
					style={delayed(0.6)}
				/>
			)}
			<Stroke d={m.tongue} tone={lit("tongue") ? "mark" : "graphite"} width={2.1} delay={0.66} />
			<Stroke d={m.upperLip} tone={lit("lips") ? "mark" : "ink"} width={lit("lips") ? 2.1 : 1.7} delay={0.44} />
			<Stroke d={m.lowerLip} tone={lit("lips") ? "mark" : "ink"} width={lit("lips") ? 2.1 : 1.7} delay={0.5} />
			{[...m.taps, ...m.air].map((d, i) => (
				<Stroke key={i} d={d} tone={quiet ? "graphite" : "mark"} delay={1.2 + i * 0.12} />
			))}
			{m.folds.map((d, i) => (
				<Stroke key={i} d={d} tone={quiet ? "graphite" : "mark"} width={2.1} delay={1 + i * 0.1} />
			))}
		</Sheet>
	);
}

export function LengthWave({
	units,
	seed,
	quiet = false,
	className,
}: {
	units: 1 | 2 | 3;
	seed: number;
	quiet?: boolean;
	className?: string;
}) {
	const l = lengthPaths(units, seed);
	return (
		<Sheet viewBox={LENGTH_VIEWBOX} className={className}>
			<Stroke d={l.base} tone="soft" />
			<Stroke d={l.start} tone="graphite" delay={0.1} />
			<Stroke d={l.wave} tone={quiet ? "graphite" : "mark"} width={2.1} delay={0.2} />
			<Stroke d={l.end} tone="graphite" delay={0.8} />
		</Sheet>
	);
}

export function SoundDrawing({
	picture,
	seed,
	quiet = false,
	className,
}: {
	picture: SoundPicture;
	seed: number;
	quiet?: boolean;
	className?: string;
}) {
	return picture.kind === "mouth" ? (
		<Mouth spec={picture.mouth} seed={seed} quiet={quiet} className={className} />
	) : (
		<LengthWave units={picture.units} seed={seed} quiet={quiet} className={className} />
	);
}
