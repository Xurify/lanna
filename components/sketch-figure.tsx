"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { parseSketch } from "@/src/core";
import { QUIET, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";

const SKETCH_TOKENS = {
	"--sk-ink": "var(--foreground)",
	"--sk-graphite": "var(--q-ink-2)",
	"--sk-faint": "var(--q-ink-3)",
	"--sk-rule": "var(--q-line-2)",
	"--sk-mark": "var(--q-teal-2)",
	"--sk-wash": "var(--q-teal-wash)",
	"--sk-paper": "var(--card)",
	"--sk-font": "var(--font-prose)",
} as CSSProperties;

const SKETCH_DISPLAY_SCALE = 1.15;

export function SketchFigure({ source, incomplete }: { source: string; incomplete: boolean }) {
	const id = useId().replace(/:/g, "");
	const [animate] = useState(incomplete);
	const sketch = useMemo(() => (incomplete ? null : parseSketch(source, { animate })), [source, incomplete, animate]);
	const [stepIndex, setStepIndex] = useState(0);

	if (incomplete) {
		return (
			<div
				data-testid="md-sketch"
				aria-busy="true"
				className="my-4 flex h-10 items-center text-sm text-muted-foreground"
			>
				Drawing…
			</div>
		);
	}
	if (!sketch) {
		return (
			<p data-testid="md-sketch-failed" className="my-4 text-sm text-muted-foreground">
				This drawing could not be shown.
			</p>
		);
	}

	const displayWidth = `${Math.round(sketch.width * SKETCH_DISPLAY_SCALE)}px`;
	const steps = sketch.steps;
	const current = steps[Math.min(stepIndex, steps.length - 1)];
	const hidden = current ? steps.filter((s) => s.step > current.step) : [];
	const scope = `[data-sketch="${id}"]`;
	const stepRules = [
		`${scope} g[data-step]{transition:opacity 250ms var(--ease-out)}`,
		hidden.length > 0 ? `${hidden.map((s) => `${scope} g[data-step="${s.step}"]`).join(",")}{opacity:0}` : "",
	].join("");

	return (
		<figure
			data-testid="md-sketch"
			data-sketch={id}
			data-no-word-lookup="true"
			className="my-4 flex flex-col items-center select-none"
			style={SKETCH_TOKENS}
		>
			{steps.length > 0 && <style>{stepRules}</style>}
			<svg
				viewBox={sketch.viewBox}
				role="img"
				aria-label={sketch.label || "Drawing"}
				className="h-auto w-full"
				style={{
					maxWidth: displayWidth,
					aspectRatio: `${sketch.width} / ${sketch.height}`,
					fill: "none",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					fontFamily: "var(--sk-font)",
				}}
			>
				<defs>
					<filter id={`sketch-${id}`} x="-4%" y="-6%" width="108%" height="112%">
						<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="grain" />
						<feDisplacementMap in="SourceGraphic" in2="grain" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
					</filter>
				</defs>
				<g filter={`url(#sketch-${id})`} dangerouslySetInnerHTML={{ __html: sketch.body }} />
			</svg>
			{current && (
				<figcaption className="mt-2 flex w-full flex-col gap-1" style={{ maxWidth: displayWidth }}>
					<p aria-live="polite" className="min-h-10 text-sm leading-5 text-ink-2">
						{current.caption}
					</p>
					<div className="flex items-center gap-1">
						<span className="flex-1 font-ui text-xs tabular-nums text-muted-foreground">
							Step {stepIndex + 1} of {steps.length}
						</span>
						<button
							type="button"
							className={cn(QUIET, SMALL)}
							disabled={stepIndex === 0}
							onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
						>
							Back
						</button>
						<button
							type="button"
							className={cn(QUIET, SMALL, "text-foreground")}
							onClick={() => setStepIndex((i) => (i + 1 >= steps.length ? 0 : i + 1))}
						>
							{stepIndex + 1 >= steps.length ? "Again" : "Next"}
						</button>
					</div>
				</figcaption>
			)}
		</figure>
	);
}
