/**
 * Where you are (LangHarness, 2026-11-06; creator-hooks proposals 3 and 4):
 * one card on Today for the horizon. The stage sentence names the gap that
 * limits the learner; two meters under it carry the same numbers, the binding
 * one in teal, with the need as a marker on the track; a dated scene, when
 * there is one, sits in the same card. One primitive, rows in a card, and no
 * primary button: the plan's Start stays the one next step (E4a).
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { DatedSceneCard } from "@/components/dated-scene-card";
import type { DatedSceneView, StageMeter, StageView } from "@/src/core";

function Meter({ label, meter, unit, hot }: { label: string; meter: StageMeter; unit: string; hot: boolean }) {
	// The track runs a little past the need, so the marker never sits on the edge.
	const max = Math.max(meter.need, meter.have) * 1.08;
	const fill = max > 0 ? Math.min(1, meter.have / max) : 0;
	const target = max > 0 ? meter.need / max : 0;
	return (
		<div className="contents" data-testid={`stage-meter-${label.toLowerCase()}`}>
			<span className={cn("text-[13px]", hot ? "font-[600] text-teal-2" : "text-ink-2")}>{label}</span>
			<span
				className={cn("q-bar block", hot && "hot")}
				role="meter"
				aria-valuemin={0}
				aria-valuemax={meter.need}
				aria-valuenow={meter.have}
				aria-label={`${label}: ${meter.have} of ${meter.need}${unit}`}
			>
				<i style={{ width: `${fill * 100}%` }} />
				<span className="target" style={{ left: `${target * 100}%` }} aria-hidden="true" />
			</span>
			<span
				className={cn("q-num whitespace-nowrap text-right text-[13px]", hot ? "font-[600] text-teal-2" : "text-ink-2")}
			>
				{meter.have}
				<span className="font-[450] text-ink-4"> / {meter.need}</span>
				{unit && <span className="font-[450] text-ink-3">{unit}</span>}
				{meter.estimated && <span className="font-[450] text-ink-4"> est.</span>}
			</span>
		</div>
	);
}

export function WhereYouAre({ stage, scene }: { stage: StageView | null; scene: DatedSceneView | null }) {
	if (!stage && !scene) return null;
	return (
		<section
			className="mt-6 q-rise @max-6xl:mt-5"
			style={{ animationDelay: ".06s" }}
			data-testid="where-you-are"
			aria-label="Where you are"
		>
			<h2 className="q-sh">
				<QIcon name="flag" />
				Where you are
			</h2>
			<div className="q-card">
				{stage && (
					<div className="px-[18px] pb-4 pt-4">
						<p className="q-line dim text-[16px]">{stage.line}</p>
						{(stage.words || stage.speed) && (
							<div className="mt-4 grid grid-cols-[56px_1fr_auto] items-center gap-x-3 gap-y-2.5">
								{stage.words && <Meter label="Words" meter={stage.words} unit="" hot={stage.binding === "words"} />}
								{stage.speed && (
									<Meter label="Speed" meter={stage.speed} unit=" w/min" hot={stage.binding === "speed"} />
								)}
							</div>
						)}
						{stage.detail && <p className="mt-3 text-[12.5px] text-ink-3">{stage.detail}</p>}
					</div>
				)}
				{scene && (
					<div className={cn("px-[18px] pb-4 pt-4", stage && "border-t border-[var(--q-line)]")}>
						<DatedSceneCard scene={scene} />
					</div>
				)}
				<div className="flex items-center border-t border-[var(--q-line)] px-2.5 py-1.5">
					<Link href="/milestones" className="q-btn ghost">
						See the evidence
						<QIcon name="chev" />
					</Link>
				</div>
			</div>
		</section>
	);
}
