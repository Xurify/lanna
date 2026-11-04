import Link from "next/link";
import { QIcon } from "@/components/quiet/icon";
import { ZoneGauge } from "@/components/flow/zone-gauge";
import { FLOW_HIGH, FLOW_LOW, zoneLine, type FlowSummary } from "@/src/core";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "Verb forms" from "Grammar: Verb forms": the unit's name without its kind. */
const bare = (title: string) => title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");

/**
 * Today's "Your zone" section (E42): the one unit worth acting on, drawn on
 * the gauge against the band, then a count of where the rest sit. A unit is
 * placed only after enough first tries, so a new learner sees what the zone
 * is and when it starts, never a figure with nothing behind it.
 */
export function ZoneSection({ flow, titles }: { flow: FlowSummary; titles: Record<string, string> }) {
	const { counts, focus } = flow;
	const placed = counts.easy + counts.zone + counts.hard;
	const title = focus ? bare(titles[focus.unit] ?? focus.unit) : "";
	const parts = [counts.zone > 0 && `${counts.zone} in your zone`, counts.hard > 0 && `${counts.hard} below it`, counts.easy > 0 && `${counts.easy} above it`, counts.new > 0 && `${counts.new} not placed yet`].filter(Boolean);
	return (
		<section className="mt-6 q-rise @max-6xl:mt-5" style={{ animationDelay: ".09s" }} data-testid="zone-section" aria-label="Your zone">
			<h2 className="q-sh">
				<QIcon name="chart" />
				Your zone
			</h2>
			{placed === 0 ? (
				<p className="q-line">
					Practice teaches most when {pct(FLOW_LOW)} to {pct(FLOW_HIGH)} of your first tries are right. A unit is placed after {flow.minReps} first tries.
				</p>
			) : (
				<>
					<p className="q-line" data-testid="zone-line">
						{focus?.kind === "hard" && (
							<>
								The <b className="q-sk">{title}</b> unit is below your zone. Its next lesson starts easier.
							</>
						)}
						{focus?.kind === "easy" && (
							<>
								The <b className="q-sk">{title}</b> unit is above your zone. Its next lesson asks for more.
							</>
						)}
						{!focus && <>Every unit you have placed is in your zone.</>}
					</p>
					<div className="mt-3 max-w-md">
						{focus ? <ZoneGauge accuracy={focus.zone.accuracy} low={focus.zone.low} high={focus.zone.high} /> : <ZoneGauge accuracy={null} />}
						<p className="q-sub" style={{ marginTop: 6 }}>
							{focus ? `${zoneLine(focus.zone)}.` : `The zone is ${pct(FLOW_LOW)}–${pct(FLOW_HIGH)} of first tries right.`}
						</p>
					</div>
					{parts.length > 1 || (parts.length === 1 && focus) ? <p className="q-sub">{parts.join(" · ")}.</p> : null}
					{focus?.kind === "hard" && (
						<div className="q-acts @max-xl:[&_.q-btn]:h-10" style={{ marginTop: 16 }}>
							<Link href={`/lesson?unit=${focus.unit}`} className="q-btn sec t" data-testid="zone-practice">
								<QIcon name="grammar" />
								Lesson on the {title}
							</Link>
						</div>
					)}
				</>
			)}
		</section>
	);
}
